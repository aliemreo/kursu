"""Game rules: create games, play rounds, judge sessions and apply validated results.

These functions change ORM objects but never commit; the route commits, so a failure
anywhere in a round leaves the database unchanged.
"""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from pydantic import ValidationError

from app import ai
from app.content import METRICS, OTHER_CHOICE, ROUNDS_PER_SESSION, TOPICS, TopicConfig, final_score
from app.models import DebateSession, Game, Turn, User, Verdict
from app.schemas import CreateGameRequest, JudgeQualitative, JudgeQuantitative, Side


def opposite(side: Side) -> Side:
    return "against" if side == "for" else "for"


def create_game(owner: User, request: CreateGameRequest) -> Game:
    unknown = [s.topic_id for s in request.sessions if s.topic_id not in TOPICS]
    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown topic id(s): {', '.join(unknown)}"
        )
    sessions = [
        DebateSession(
            session_no=no,
            topic_id=s.topic_id,
            player_side=s.player_side,
            max_rounds=ROUNDS_PER_SESSION,
            status="in_progress" if no == 1 else "pending",
        )
        for no, s in enumerate(request.sessions, start=1)
    ]
    return Game(
        owner_id=owner.id,
        status="active",
        current_session=1,
        metrics={metric.id: metric.initial for metric in METRICS},
        sessions=sessions,
    )


def get_session(game: Game, session_no: int) -> DebateSession:
    if not 1 <= session_no <= len(game.sessions):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return game.sessions[session_no - 1]


def play_round(game: Game, session_no: int, text: str) -> tuple[Turn, Turn]:
    """Add the player's turn and the opponent's reply; judge the session after its last round."""
    if game.status == "finished":
        raise HTTPException(status.HTTP_409_CONFLICT, "The game has already finished")
    session = get_session(game, session_no)
    if session.status != "in_progress":
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Session {game.current_session} is in progress"
        )

    config = TOPICS[session.topic_id]
    transcript = [ai.TranscriptLine(t.speaker, t.text) for t in session.turns]
    transcript.append(ai.TranscriptLine("player", text))
    try:
        reply = ai.get_opponent().reply(
            ai.OpponentRequest(
                topic=config.topic,
                side=opposite(session.player_side),
                transcript=transcript,
                round_no=session.rounds_played + 1,
                max_rounds=session.max_rounds,
            )
        )
    except ai.OpponentUnavailable as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "The opponent could not reply"
        ) from exc

    seq = len(session.turns)
    # Ids are set here, not on insert, because the judge cites turns before the commit.
    player_turn = Turn(id=uuid.uuid4(), seq=seq, speaker="player", text=text, citations=[])
    opponent_turn = Turn(
        id=uuid.uuid4(),
        seq=seq + 1,
        speaker="opponent",
        text=reply.text,
        citations=[c.model_dump(mode="json") for c in reply.citations],
    )
    session.turns.extend([player_turn, opponent_turn])
    if session.rounds_played == session.max_rounds:
        finish_session(game, session, config)
    return player_turn, opponent_turn


def finish_session(game: Game, session: DebateSession, config: TopicConfig) -> None:
    verdict = judge_session(game, session, config)
    session.verdict = verdict
    session.status = "finished"
    game.metrics = dict(verdict.metrics_after)
    if session.session_no < len(game.sessions):
        game.current_session = session.session_no + 1
        game.sessions[session.session_no].status = "in_progress"
    else:
        game.status = "finished"
        game.final_score = final_score(game.metrics)
        game.finished_at = datetime.now(UTC)


def judge_session(game: Game, session: DebateSession, config: TopicConfig) -> Verdict:
    judge = ai.get_judge()
    request = ai.JudgeRequest(
        topic=config.topic,
        player_side=session.player_side,
        transcript=[(str(t.id), ai.TranscriptLine(t.speaker, t.text)) for t in session.turns],
        category_options={c.id: c.choices for c in config.categories},
        metric_ids=[metric.id for metric in METRICS],
    )
    try:
        qualitative = judge.qualitative(request)
        quantitative = judge.quantitative(request, qualitative)
    except (ai.JudgeUnavailable, ValidationError) as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "The judge could not evaluate the session"
        ) from exc

    before = dict(game.metrics)
    reason = validate_verdict(qualitative, quantitative, config, {str(t.id) for t in session.turns})
    return Verdict(
        qualitative=qualitative.model_dump(mode="json"),
        quantitative=quantitative.model_dump(mode="json"),
        applied=reason is None,
        rejection_reason=reason,
        metrics_before=before,
        metrics_after=before if reason else apply_deltas(before, quantitative),
        judge_model=judge.model_name,
    )


def validate_verdict(
    qualitative: JudgeQualitative,
    quantitative: JudgeQuantitative,
    config: TopicConfig,
    turn_ids: set[str],
) -> str | None:
    """Return why the judge's report cannot be applied, or None if it is valid."""
    options = {c.id: c.choices for c in config.categories}
    seen: set[str] = set()
    for choice in qualitative.categories:
        if choice.category_id not in options:
            return f"Unknown category {choice.category_id!r}"
        if choice.category_id in seen:
            return f"Category {choice.category_id!r} chosen twice"
        seen.add(choice.category_id)
        if choice.choice_id == OTHER_CHOICE:
            if not (choice.explanation or "").strip():
                return f"Category {choice.category_id!r} is 'other' without an explanation"
        elif choice.choice_id not in options[choice.category_id]:
            return f"Unknown choice {choice.choice_id!r} for {choice.category_id!r}"
    for evidence in qualitative.evidence:
        if evidence.turn_id not in turn_ids:
            return f"Evidence cites unknown turn {evidence.turn_id!r}"

    seen = set()
    for item in quantitative.metric_deltas:
        if item.metric_id not in config.max_delta:
            return f"Unknown metric {item.metric_id!r}"
        if item.metric_id in seen:
            return f"Metric {item.metric_id!r} changed twice"
        seen.add(item.metric_id)
        if abs(item.delta) > config.max_delta[item.metric_id]:
            return f"Change {item.delta} for {item.metric_id!r} exceeds the topic's limit"
    return None


def apply_deltas(values: dict[str, float], quantitative: JudgeQuantitative) -> dict[str, float]:
    bounds = {metric.id: metric for metric in METRICS}
    result = dict(values)
    for item in quantitative.metric_deltas:
        metric = bounds[item.metric_id]
        value = result[item.metric_id] + item.delta
        result[item.metric_id] = min(metric.max, max(metric.min, value))
    return result

"""Game rules: create games, open sessions, play rounds, judge sessions and apply results.

These functions change ORM objects but never commit; the route commits, so a failure
anywhere in a request leaves the database unchanged.
"""

import uuid
from datetime import UTC, datetime

from fastapi import status
from pydantic import ValidationError

from app import ai, content
from app.content import METRICS, OTHER_CHOICE, TopicConfig, final_score
from app.errors import ApiError
from app.models import DebateSession, Game, Turn, User, Verdict
from app.schemas import JudgeQualitative, JudgeQuantitative, Side, Topic


def opposite(side: Side) -> Side:
    return "against" if side == "for" else "for"


def create_game(owner: User, session_count: int) -> Game:
    """A new game with a different catalog topic per session and every metric at its start."""
    config = content.game_config()
    if not config.min_sessions <= session_count <= config.max_sessions:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "INVALID_SESSION_COUNT",
            f"A game has {config.min_sessions} to {config.max_sessions} sessions",
        )
    sessions = [
        DebateSession(
            session_no=no,
            topic_id=topic_id,
            topic=content.TOPICS[topic_id].topic.model_dump(mode="json"),
            player_side=None,
            max_rounds=config.rounds_per_session,
            status="choosing_side" if no == 1 else "pending",
        )
        for no, topic_id in enumerate(content.pick_topics(session_count), start=1)
    ]
    return Game(
        owner_id=owner.id,
        status="active",
        current_session=1,
        catalog_version=config.catalog_version,
        metrics={metric.id: metric.initial for metric in METRICS},
        sessions=sessions,
    )


def get_session(game: Game, session_no: int) -> DebateSession:
    if not 1 <= session_no <= len(game.sessions):
        raise ApiError(status.HTTP_404_NOT_FOUND, "SESSION_NOT_FOUND", "Session not found")
    return game.sessions[session_no - 1]


def choose_side(game: Game, session_no: int, side: Side) -> DebateSession:
    """Record the player's side once, while the session is open for it."""
    session = get_session(game, session_no)
    if session.player_side is not None:
        raise ApiError(
            status.HTTP_409_CONFLICT, "SIDE_ALREADY_CHOSEN", "The side is already chosen"
        )
    if session.status != "choosing_side":
        raise ApiError(status.HTTP_409_CONFLICT, "SESSION_NOT_ACTIVE", "The session is not open")
    session.player_side = side
    # The `for` side always speaks first.
    session.status = "awaiting_player" if side == "for" else "awaiting_opponent"
    return session


def topic_config(session: DebateSession) -> TopicConfig:
    """The catalog rules (categories, metric limits) of the session's topic."""
    config = content.TOPICS.get(session.topic_id)
    if config is None:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "SESSION_NOT_ACTIVE",
            f"Topic {session.topic_id!r} is no longer in the catalog",
        )
    return config


def play_round(game: Game, session_no: int, text: str) -> tuple[Turn, Turn]:
    """Add the player's turn and the opponent's reply; judge the session after its last round.

    Interim v0.2 flow until WBS-3.2: only sessions waiting for the player can be played, so
    a player on the `against` side waits for the opponent-turn endpoint.
    """
    if game.status == "finished":
        raise ApiError(status.HTTP_409_CONFLICT, "GAME_FINISHED", "The game has already finished")
    session = get_session(game, session_no)
    if session.status == "awaiting_opponent":
        raise ApiError(status.HTTP_409_CONFLICT, "NOT_YOUR_TURN", "It is the opponent's turn")
    if session.status != "awaiting_player":
        raise ApiError(
            status.HTTP_409_CONFLICT, "SESSION_NOT_ACTIVE", "The session is not open for turns"
        )

    config = topic_config(session)
    transcript = [ai.TranscriptLine(t.speaker, t.text) for t in session.turns]
    transcript.append(ai.TranscriptLine("player", text))
    try:
        reply = ai.get_opponent().reply(
            ai.OpponentRequest(
                topic=Topic.model_validate(session.topic),
                side=opposite(session.player_side),
                transcript=transcript,
                round_no=session.rounds_played + 1,
                max_rounds=session.max_rounds,
            )
        )
    except ai.OpponentUnavailable as exc:
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "OPPONENT_UNAVAILABLE",
            "The opponent could not reply",
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
        game.sessions[session.session_no].status = "choosing_side"
    else:
        game.status = "finished"
        game.final_score = final_score(game.metrics)
        game.finished_at = datetime.now(UTC)


def judge_session(game: Game, session: DebateSession, config: TopicConfig) -> Verdict:
    judge = ai.get_judge()
    request = ai.JudgeRequest(
        topic=Topic.model_validate(session.topic),
        player_side=session.player_side,
        transcript=[(str(t.id), ai.TranscriptLine(t.speaker, t.text)) for t in session.turns],
        category_options={c.id: c.choices for c in config.categories},
        metric_ids=[metric.id for metric in METRICS],
    )
    try:
        qualitative = judge.qualitative(request)
        quantitative = judge.quantitative(request, qualitative)
    except (ai.JudgeUnavailable, ValidationError) as exc:
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "EVALUATION_FAILED",
            "The judge could not evaluate the session",
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

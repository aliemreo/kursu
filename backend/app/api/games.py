import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import game as rules
from app import models
from app.api.deps import CurrentUser, DbSession
from app.content import METRICS
from app.errors import ApiError
from app.schemas import (
    ChooseSideRequest,
    CreateGameRequest,
    Game,
    GameSummary,
    JudgeQualitative,
    JudgeQuantitative,
    Metric,
    OpponentTurnResult,
    Session,
    Speaker,
    Topic,
    Turn,
    TurnRequest,
    TurnResult,
    Verdict,
)

router = APIRouter(prefix="/games", tags=["games"])

SessionNo = Annotated[int, Path(ge=1)]

# Who speaks next in each session status; no one in the others.
NEXT_SPEAKER: dict[str, Speaker] = {
    "awaiting_player": "player",
    "awaiting_opponent": "opponent",
}


def owned_game(
    db: DbSession, game_id: uuid.UUID, user: models.User, *, lock: bool = False
) -> models.Game:
    """The user's game. With `lock`, the game row stays locked until the request commits, so
    concurrent changes to the same game run one after the other (PostgreSQL; SQLite ignores
    it and serialises writes anyway)."""
    game = db.get(models.Game, game_id, with_for_update=lock)
    # Someone else's game is reported as missing, so game ids cannot be probed.
    if game is None or game.owner_id != user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, "GAME_NOT_FOUND", "Game not found")
    return game


def to_metrics(values: dict[str, float]) -> list[Metric]:
    return [
        Metric(id=m.id, name=m.name, value=values[m.id], min=m.min, max=m.max) for m in METRICS
    ]


def to_session(session: models.DebateSession) -> Session:
    return Session(
        session_no=session.session_no,
        topic=Topic.model_validate(session.topic),
        player_side=session.player_side,
        status=session.status,
        next_speaker=NEXT_SPEAKER.get(session.status),
        rounds_played=session.rounds_played,
        max_rounds=session.max_rounds,
        turns=[Turn.model_validate(t) for t in session.turns],
        verdict_available=session.verdict is not None,
        # Set once verdicts adopt a policy (WBS-3.3).
        adopted_side=None,
    )


def to_summary(game: models.Game) -> GameSummary:
    return GameSummary(
        id=game.id,
        status=game.status,
        session_count=len(game.sessions),
        completed_sessions=sum(s.status == "finished" for s in game.sessions),
        current_session=game.current_session,
        final_score=game.final_score,
        created_at=game.created_at,
        finished_at=game.finished_at,
    )


def to_game(game: models.Game) -> Game:
    return Game(
        **to_summary(game).model_dump(),
        catalog_version=game.catalog_version,
        metrics=to_metrics(game.metrics),
        sessions=[to_session(s) for s in game.sessions],
    )


@router.get("", response_model=list[GameSummary])
def list_games(db: DbSession, user: CurrentUser) -> list[GameSummary]:
    """The player's own games, newest first."""
    games = db.scalars(
        select(models.Game)
        .where(models.Game.owner_id == user.id)
        .order_by(models.Game.created_at.desc())
    )
    return [to_summary(g) for g in games]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Game)
def create_game(body: CreateGameRequest, db: DbSession, user: CurrentUser) -> Game:
    """Start a game; an unfinished earlier game stays saved."""
    game = rules.create_game(user, body.session_count)
    db.add(game)
    db.commit()
    return to_game(game)


@router.get("/{game_id}", response_model=Game)
def get_game(game_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Game:
    return to_game(owned_game(db, game_id, user))


@router.post("/{game_id}/sessions/{session_no}/side", response_model=Session)
def choose_side(
    game_id: uuid.UUID,
    session_no: SessionNo,
    body: ChooseSideRequest,
    db: DbSession,
    user: CurrentUser,
) -> Session:
    """Choose the player's side; the opponent takes the other one."""
    # Locked, so two requests with different sides cannot both succeed.
    game = owned_game(db, game_id, user, lock=True)
    session = rules.choose_side(game, session_no, body.side)
    db.commit()
    return to_session(session)


def play_opponent(
    db: DbSession, game_id: uuid.UUID, user: models.User, session_no: int
) -> tuple[models.Turn, models.DebateSession]:
    """Generate and store the pending opponent turn.

    The model can take up to a minute or more, so no transaction or row lock is held while it
    works: the state is checked under the lock, the lock is released, the model replies, and
    the turn is stored under the lock only if no other request stored it meanwhile. Otherwise
    the stored turn is returned, so concurrent calls all answer with the same turn.
    """
    game = owned_game(db, game_id, user, lock=True)
    session = rules.get_session(game, session_no)
    request = rules.opponent_request(game, session)
    seq = len(session.turns)
    db.commit()  # nothing changed; ends the transaction and releases the lock

    reply = rules.ask_opponent(request)

    db.expire_all()  # read what other requests stored while the model worked
    game = owned_game(db, game_id, user, lock=True)
    session = rules.get_session(game, session_no)
    if len(session.turns) == seq and session.status == "awaiting_opponent":
        turn = rules.add_opponent_turn(session, reply)
        try:
            db.commit()
            return turn, session
        except IntegrityError:
            # Another request stored this turn between our check and our commit.
            db.rollback()
            session = rules.get_session(owned_game(db, game_id, user), session_no)
    db.commit()
    stored = rules.turn_at(session, seq)
    if stored is None or stored.speaker != "opponent":
        raise ApiError(status.HTTP_409_CONFLICT, "NOT_YOUR_TURN", "No opponent turn is pending")
    return stored, session


def stored_round(
    session: models.DebateSession, client_turn_id: uuid.UUID, response: Response
) -> TurnResult | None:
    """The earlier answer for a resent turn (200), or None for a new turn."""
    stored = rules.find_round(session, client_turn_id)
    if stored is None:
        return None
    player_turn, opponent_turn = stored
    response.status_code = status.HTTP_200_OK
    return TurnResult(
        player_turn=Turn.model_validate(player_turn),
        opponent_turn=Turn.model_validate(opponent_turn) if opponent_turn else None,
        session=to_session(session),
    )


@router.post(
    "/{game_id}/sessions/{session_no}/turns",
    status_code=status.HTTP_201_CREATED,
    response_model=TurnResult,
)
def submit_turn(
    game_id: uuid.UUID,
    session_no: SessionNo,
    body: TurnRequest,
    response: Response,
    db: DbSession,
    user: CurrentUser,
) -> TurnResult:
    """Store the player's turn, then generate the opponent's reply if one is due.

    The player's turn is committed before the opponent is asked, so it is kept when the
    opponent fails; the client then retries with the opponent-turn endpoint.
    """
    try:
        game = owned_game(db, game_id, user, lock=True)
        session = rules.get_session(game, session_no)
        # Checked before the turn rules: a resent turn may arrive after the session moved on.
        if (earlier := stored_round(session, body.client_turn_id, response)) is not None:
            db.commit()
            return earlier
        player_turn = rules.add_player_turn(game, session, body.text, body.client_turn_id)
        try:
            db.commit()
        except IntegrityError:
            # A concurrent request stored this turn (same client id) or this position first.
            db.rollback()
            session = rules.get_session(owned_game(db, game_id, user), session_no)
            if (earlier := stored_round(session, body.client_turn_id, response)) is not None:
                return earlier
            raise ApiError(
                status.HTTP_409_CONFLICT, "NOT_YOUR_TURN", "This turn was already played"
            ) from None

        opponent_turn = None
        if session.status == "awaiting_opponent":
            opponent_turn, session = play_opponent(db, game_id, user, session_no)
    except HTTPException:
        db.rollback()
        raise
    return TurnResult(
        player_turn=Turn.model_validate(player_turn),
        opponent_turn=Turn.model_validate(opponent_turn) if opponent_turn else None,
        session=to_session(session),
    )


@router.post(
    "/{game_id}/sessions/{session_no}/opponent-turn",
    status_code=status.HTTP_201_CREATED,
    response_model=OpponentTurnResult,
)
def request_opponent_turn(
    game_id: uuid.UUID, session_no: SessionNo, db: DbSession, user: CurrentUser
) -> OpponentTurnResult:
    """Generate the pending opponent turn: the opening, a retry, or after resuming."""
    try:
        turn, session = play_opponent(db, game_id, user, session_no)
    except HTTPException:
        db.rollback()
        raise
    return OpponentTurnResult(opponent_turn=Turn.model_validate(turn), session=to_session(session))


@router.get("/{game_id}/sessions/{session_no}/verdict", response_model=Verdict)
def get_verdict(
    game_id: uuid.UUID, session_no: SessionNo, db: DbSession, user: CurrentUser
) -> Verdict:
    session = rules.get_session(owned_game(db, game_id, user), session_no)
    verdict = session.verdict
    if verdict is None:
        raise ApiError(
            status.HTTP_409_CONFLICT, "EVALUATION_NOT_READY", "The session has not finished yet"
        )
    return Verdict(
        session_no=session.session_no,
        qualitative=JudgeQualitative.model_validate(verdict.qualitative),
        quantitative=JudgeQuantitative.model_validate(verdict.quantitative),
        applied=verdict.applied,
        rejection_reason=verdict.rejection_reason,
        metrics_before=to_metrics(verdict.metrics_before),
        metrics_after=to_metrics(verdict.metrics_after),
        judge_model=verdict.judge_model,
    )

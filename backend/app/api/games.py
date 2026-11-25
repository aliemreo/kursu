import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status
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


@router.post(
    "/{game_id}/sessions/{session_no}/turns",
    status_code=status.HTTP_201_CREATED,
    response_model=TurnResult,
)
def submit_turn(
    game_id: uuid.UUID, session_no: SessionNo, body: TurnRequest, db: DbSession, user: CurrentUser
) -> TurnResult:
    """Play one round: store the player's turn and return the opponent's reply."""
    game = owned_game(db, game_id, user)
    try:
        player_turn, opponent_turn = rules.play_round(game, session_no, body.text)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        # Another request stored this round first.
        db.rollback()
        raise ApiError(
            status.HTTP_409_CONFLICT, "NOT_YOUR_TURN", "This round was already played"
        ) from None
    session = game.sessions[session_no - 1]
    return TurnResult(
        player_turn=Turn.model_validate(player_turn),
        opponent_turn=Turn.model_validate(opponent_turn),
        session_finished=session.status == "finished",
        game_finished=game.status == "finished",
    )


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

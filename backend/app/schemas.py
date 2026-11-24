"""Game request and response models. They mirror contracts/openapi.yaml; change the contract
first. The judge's two report models are also what the judge adapters must return."""

import datetime as dt
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Side = Literal["for", "against"]
Speaker = Literal["player", "opponent"]
GameStatus = Literal["active", "finished"]
SessionStatus = Literal[
    "pending",
    "choosing_side",
    "awaiting_player",
    "awaiting_opponent",
    "awaiting_evaluation",
    "evaluation_failed",
    "evaluated",
    "finished",
]

# Longest player turn in characters; /game-config reports it to the client.
MAX_TURN_LENGTH = 4000


class Positions(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    for_: str = Field(alias="for")
    against: str


class Topic(BaseModel):
    id: str
    title: str
    motion: str
    positions: Positions


class Metric(BaseModel):
    id: str
    name: str
    value: float
    min: float
    max: float


class GameConfig(BaseModel):
    min_sessions: int
    max_sessions: int
    rounds_per_session: int
    max_turn_length: int
    catalog_version: str


class CreateGameRequest(BaseModel):
    # Strict, so true or "3" are rejected instead of converted. The range is checked by the
    # game rules against /game-config, so that every out-of-range count answers
    # INVALID_SESSION_COUNT.
    session_count: int = Field(strict=True)


class ChooseSideRequest(BaseModel):
    side: Side


class Citation(BaseModel):
    speech_id: str
    speaker: str | None = None
    date: dt.date | None = None
    excerpt: str


class Turn(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    speaker: Speaker
    text: str
    created_at: dt.datetime
    citations: list[Citation] = []


class Session(BaseModel):
    session_no: int
    topic: Topic
    player_side: Side | None
    status: SessionStatus
    next_speaker: Speaker | None
    rounds_played: int
    max_rounds: int
    turns: list[Turn]
    verdict_available: bool
    adopted_side: Side | None


class GameSummary(BaseModel):
    id: uuid.UUID
    status: GameStatus
    session_count: int
    completed_sessions: int
    current_session: int
    final_score: float | None = None
    created_at: dt.datetime
    finished_at: dt.datetime | None = None


class Game(GameSummary):
    catalog_version: str
    metrics: list[Metric]
    sessions: list[Session]


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TURN_LENGTH)


class TurnResult(BaseModel):
    player_turn: Turn
    opponent_turn: Turn
    session_finished: bool
    game_finished: bool


class CategoryChoice(BaseModel):
    category_id: str
    choice_id: str
    explanation: str | None = None


class Evidence(BaseModel):
    turn_id: str
    quote: str


class JudgeQualitative(BaseModel):
    winner: Literal["player", "opponent", "draw"]
    victory_strength: Literal["narrow", "clear", "decisive"]
    narrative: str
    categories: list[CategoryChoice]
    evidence: list[Evidence] = []


class MetricDelta(BaseModel):
    metric_id: str
    delta: float
    reason: str | None = None


class JudgeQuantitative(BaseModel):
    metric_deltas: list[MetricDelta]


class Verdict(BaseModel):
    session_no: int
    qualitative: JudgeQualitative
    quantitative: JudgeQuantitative
    applied: bool
    rejection_reason: str | None = None
    metrics_before: list[Metric]
    metrics_after: list[Metric]
    judge_model: str

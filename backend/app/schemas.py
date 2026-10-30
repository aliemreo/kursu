"""Game request and response models. They mirror contracts/openapi.yaml; change the contract
first. The judge's two report models are also what the judge adapters must return."""

import datetime as dt
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Side = Literal["for", "against"]
Speaker = Literal["player", "opponent"]
GameStatus = Literal["active", "finished"]
SessionStatus = Literal["pending", "in_progress", "finished"]


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


class SessionRequest(BaseModel):
    topic_id: str
    player_side: Side


class CreateGameRequest(BaseModel):
    sessions: list[SessionRequest] = Field(min_length=1, max_length=10)


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
    model_config = ConfigDict(from_attributes=True)

    session_no: int
    topic_id: str
    player_side: Side
    status: SessionStatus
    max_rounds: int
    turns: list[Turn]
    verdict_available: bool


class GameSummary(BaseModel):
    id: uuid.UUID
    status: GameStatus
    session_count: int
    current_session: int
    final_score: float | None = None
    created_at: dt.datetime


class Game(GameSummary):
    metrics: list[Metric]
    sessions: list[Session]


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


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

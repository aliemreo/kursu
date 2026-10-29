"""AI adapters: the opponent and the two-stage judge. LLM_PROVIDER selects the implementation."""

from app.ai.judge import Judge, JudgeRequest, JudgeUnavailable, MockJudge
from app.ai.opponent import (
    MockOpponent,
    Opponent,
    OpponentReply,
    OpponentRequest,
    OpponentUnavailable,
    TranscriptLine,
)
from app.config import settings


def get_opponent() -> Opponent:
    if settings.llm_provider == "mock":
        return MockOpponent()
    raise ValueError(f"Unknown LLM_PROVIDER for the opponent: {settings.llm_provider!r}")


def get_judge() -> Judge:
    if settings.llm_provider == "mock":
        return MockJudge()
    raise ValueError(f"Unknown LLM_PROVIDER for the judge: {settings.llm_provider!r}")


__all__ = [
    "Judge",
    "JudgeRequest",
    "JudgeUnavailable",
    "MockJudge",
    "MockOpponent",
    "Opponent",
    "OpponentReply",
    "OpponentRequest",
    "OpponentUnavailable",
    "TranscriptLine",
    "get_judge",
    "get_opponent",
]

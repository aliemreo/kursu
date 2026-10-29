from dataclasses import dataclass
from typing import Protocol

from app.ai.opponent import TranscriptLine
from app.schemas import (
    CategoryChoice,
    Evidence,
    JudgeQualitative,
    JudgeQuantitative,
    MetricDelta,
    Side,
    Topic,
)


class JudgeUnavailable(Exception):
    """The model could not produce a report (down, timed out, unparseable output)."""


@dataclass(frozen=True)
class JudgeRequest:
    topic: Topic
    player_side: Side
    transcript: list[tuple[str, TranscriptLine]]  # (turn id, line)
    category_options: dict[str, tuple[str, ...]]  # category id -> allowed choice ids
    metric_ids: list[str]


class Judge(Protocol):
    model_name: str

    def qualitative(self, request: JudgeRequest) -> JudgeQualitative: ...

    def quantitative(
        self, request: JudgeRequest, qualitative: JudgeQualitative
    ) -> JudgeQuantitative: ...


class MockJudge:
    """Deterministic two-stage verdict: the side that wrote more words wins."""

    model_name = "mock-judge"

    def qualitative(self, request: JudgeRequest) -> JudgeQualitative:
        words = {"player": 0, "opponent": 0}
        for _, line in request.transcript:
            words[line.speaker] += len(line.text.split())
        player, opponent = words["player"], words["opponent"]
        if player == opponent:
            winner, ratio = "draw", 1.0
        else:
            winner = "player" if player > opponent else "opponent"
            ratio = max(player, opponent) / max(1, min(player, opponent))
        strength = "decisive" if ratio >= 2 else "clear" if ratio >= 1.3 else "narrow"
        turn_id, line = max(
            ((tid, ln) for tid, ln in request.transcript if ln.speaker == "player"),
            key=lambda item: len(item[1].text),
        )
        return JudgeQualitative(
            winner=winner,
            victory_strength=strength,
            narrative=f"Mock verdict on '{request.topic.title}': {winner} ({strength}).",
            categories=[
                CategoryChoice(category_id=category_id, choice_id=choices[0])
                for category_id, choices in request.category_options.items()
            ],
            evidence=[Evidence(turn_id=turn_id, quote=line.text[:120])],
        )

    def quantitative(
        self, request: JudgeRequest, qualitative: JudgeQualitative
    ) -> JudgeQuantitative:
        size = {"narrow": 2, "clear": 4, "decisive": 6}[qualitative.victory_strength]
        sign = {"player": 1, "opponent": -1, "draw": 0}[qualitative.winner]
        return JudgeQuantitative(
            metric_deltas=[
                MetricDelta(metric_id=metric_id, delta=sign * size, reason="mock")
                for metric_id in request.metric_ids
            ]
        )

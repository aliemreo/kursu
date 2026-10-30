from dataclasses import dataclass, field
from typing import Protocol

from app.schemas import Citation, Side, Speaker, Topic


class OpponentUnavailable(Exception):
    """The model could not produce a reply (down, timed out, invalid output)."""


@dataclass(frozen=True)
class TranscriptLine:
    speaker: Speaker
    text: str


@dataclass(frozen=True)
class OpponentRequest:
    topic: Topic
    side: Side  # the side the opponent defends
    transcript: list[TranscriptLine]  # ends with the player's newest turn
    round_no: int
    max_rounds: int


@dataclass(frozen=True)
class OpponentReply:
    text: str
    citations: list[Citation] = field(default_factory=list)


class Opponent(Protocol):
    def reply(self, request: OpponentRequest) -> OpponentReply: ...


class MockOpponent:
    """Deterministic replies for development and tests; no model needed."""

    def reply(self, request: OpponentRequest) -> OpponentReply:
        position = getattr(request.topic.positions, "for_" if request.side == "for" else "against")
        player_words = request.transcript[-1].text.split()
        quoted = " ".join(player_words[:8]) + ("…" if len(player_words) > 8 else "")
        closing = " Son sözüm budur." if request.round_no == request.max_rounds else ""
        return OpponentReply(
            text=(
                f"Sayın konuşmacı \"{quoted}\" diyor, ancak bu görüşe katılmıyorum. "
                f"{position} {request.round_no}. turda bu nedenle karşı görüşümü koruyorum."
                f"{closing}"
            )
        )

"""Speaking order and session status, without the API (WBS-3.2)."""

import pytest

from app import game as rules
from app.models import DebateSession, Turn

ROUNDS = 3


def session_for(side: str) -> DebateSession:
    session = DebateSession(player_side=side, max_rounds=ROUNDS, status="choosing_side", turns=[])
    rules.advance(session)
    return session


def play_out(session: DebateSession) -> list[tuple[str, str]]:
    """(speaker, status after the turn) for every turn until the session closes."""
    history = []
    while session.status != "awaiting_evaluation":
        speaker = "player" if session.status == "awaiting_player" else "opponent"
        session.turns.append(Turn(seq=len(session.turns), speaker=speaker, text="x"))
        rules.advance(session)
        history.append((speaker, session.status))
    return history


@pytest.mark.parametrize(
    ("side", "opening"), [("for", "awaiting_player"), ("against", "awaiting_opponent")]
)
def test_the_for_side_opens(side: str, opening: str) -> None:
    assert session_for(side).status == opening


@pytest.mark.parametrize(
    ("side", "speakers"),
    [
        ("for", ["player", "opponent"] * ROUNDS),
        ("against", ["opponent", "player"] * ROUNDS),
    ],
)
def test_sides_alternate_and_each_speaks_max_rounds_times(side: str, speakers: list) -> None:
    session = session_for(side)

    history = play_out(session)

    assert [speaker for speaker, _ in history] == speakers
    assert session.rounds_played == ROUNDS


def test_session_waits_for_evaluation_only_after_the_last_turn() -> None:
    history = play_out(session_for("for"))

    statuses = [status for _, status in history]
    assert statuses == [
        "awaiting_opponent",
        "awaiting_player",
        "awaiting_opponent",
        "awaiting_player",
        "awaiting_opponent",
        "awaiting_evaluation",
    ]


def test_an_against_player_closes_the_debate_without_a_reply() -> None:
    history = play_out(session_for("against"))

    assert history[-1] == ("player", "awaiting_evaluation")


@pytest.mark.parametrize("side", ["for", "against"])
def test_speaker_at_follows_the_side(side: str) -> None:
    session = session_for(side)

    speakers = [rules.speaker_at(session, i) for i in range(2 * ROUNDS)]

    first = "player" if side == "for" else "opponent"
    assert speakers[::2] == [first] * ROUNDS
    assert first not in speakers[1::2]

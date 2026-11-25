"""Turns and the debate state machine through the API (WBS-3.2; FR-06, FR-07, FR-08, FR-16)."""

import time
import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app import ai, models
from app.config import settings
from app.content import ROUNDS_PER_SESSION
from app.db import get_db
from app.main import app
from app.schemas import MAX_TURN_LENGTH

Headers = dict[str, str]


def turn(
    client: TestClient,
    headers: Headers,
    game_id: str,
    text: str = "Bu politika eğitime erişimi artırır.",
    client_turn_id: uuid.UUID | None = None,
    session_no: int = 1,
):
    body = {"text": text, "client_turn_id": str(client_turn_id or uuid.uuid4())}
    return client.post(
        f"/api/v1/games/{game_id}/sessions/{session_no}/turns", json=body, headers=headers
    )


def opponent(client: TestClient, headers: Headers, game_id: str, session_no: int = 1):
    return client.post(
        f"/api/v1/games/{game_id}/sessions/{session_no}/opponent-turn", headers=headers
    )


def session_of(client: TestClient, headers: Headers, game_id: str, session_no: int = 1) -> dict:
    return client.get(f"/api/v1/games/{game_id}", headers=headers).json()["sessions"][
        session_no - 1
    ]


def code(response) -> tuple[int, str]:
    return response.status_code, response.json().get("code")


class RecordingOpponent:
    """Replies like a model and records what it was asked."""

    def __init__(self) -> None:
        self.requests: list[ai.OpponentRequest] = []

    def reply(self, request: ai.OpponentRequest) -> ai.OpponentReply:
        self.requests.append(request)
        return ai.OpponentReply(text=f"Rakip {len(self.requests)}")


class DownOpponent:
    calls = 0

    def reply(self, request: ai.OpponentRequest) -> ai.OpponentReply:
        DownOpponent.calls += 1
        raise ai.OpponentUnavailable


@pytest.fixture
def use_opponent(monkeypatch: pytest.MonkeyPatch) -> Callable[[object], None]:
    def use(opponent: object) -> None:
        monkeypatch.setattr(ai, "get_opponent", lambda: opponent)

    return use


# Turn order and closing (FR-06, FR-08)


def test_for_side_debates_every_round_and_closes(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(side="for")["id"]

    for round_no in range(1, ROUNDS_PER_SESSION + 1):
        response = turn(client, player, game_id)
        assert response.status_code == 201
        body = response.json()
        assert body["player_turn"]["speaker"] == "player"
        assert body["opponent_turn"]["speaker"] == "opponent"
        assert body["session"]["rounds_played"] == round_no

    session = body["session"]
    assert session["status"] == "awaiting_evaluation"
    assert session["next_speaker"] is None
    assert [t["speaker"] for t in session["turns"]] == ["player", "opponent"] * ROUNDS_PER_SESSION
    assert session_of(client, player, game_id) == session


def test_against_side_lets_the_opponent_open_and_closes_without_a_reply(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(side="against")["id"]

    opening = opponent(client, player, game_id)

    assert opening.status_code == 201
    assert opening.json()["session"]["status"] == "awaiting_player"
    for _ in range(ROUNDS_PER_SESSION - 1):
        assert turn(client, player, game_id).json()["opponent_turn"] is not None
    last = turn(client, player, game_id)
    assert last.status_code == 201
    assert last.json()["opponent_turn"] is None
    session = last.json()["session"]
    assert session["status"] == "awaiting_evaluation"
    assert [t["speaker"] for t in session["turns"]] == ["opponent", "player"] * ROUNDS_PER_SESSION


def test_no_turn_is_accepted_after_the_session_closes(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(2, side="for")["id"]
    for _ in range(ROUNDS_PER_SESSION):
        turn(client, player, game_id)

    assert code(turn(client, player, game_id)) == (409, "SESSION_NOT_ACTIVE")
    assert code(opponent(client, player, game_id)) == (409, "SESSION_NOT_ACTIVE")
    game = client.get(f"/api/v1/games/{game_id}", headers=player).json()
    # The next session opens only after the evaluation (WBS-3.3).
    assert (game["current_session"], game["sessions"][1]["status"]) == (1, "pending")
    assert len(game["sessions"][0]["turns"]) == 2 * ROUNDS_PER_SESSION


def test_turns_out_of_order_are_rejected_and_change_nothing(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    for_game = start_game(2, side="for")["id"]
    against_game = start_game(side="against")["id"]
    unchosen_game = start_game(side=None)["id"]

    assert code(opponent(client, player, for_game)) == (409, "NOT_YOUR_TURN")
    assert code(turn(client, player, against_game)) == (409, "NOT_YOUR_TURN")
    assert code(turn(client, player, unchosen_game)) == (409, "SESSION_NOT_ACTIVE")
    assert code(opponent(client, player, unchosen_game)) == (409, "SESSION_NOT_ACTIVE")
    assert code(turn(client, player, for_game, session_no=2)) == (409, "SESSION_NOT_ACTIVE")
    assert code(turn(client, player, for_game, session_no=3)) == (404, "SESSION_NOT_FOUND")
    for game_id in (for_game, against_game, unchosen_game):
        assert session_of(client, player, game_id)["turns"] == []


def test_a_finished_game_takes_no_turns(
    client: TestClient, player: Headers, start_game: Callable[..., dict], db_session: Session
) -> None:
    game_id = start_game(side="for")["id"]
    db_session.get(models.Game, uuid.UUID(game_id)).status = "finished"
    db_session.commit()

    assert code(turn(client, player, game_id)) == (409, "GAME_FINISHED")


def test_other_players_cannot_take_turns(
    client: TestClient, register: Callable[[str], Headers], start_game: Callable[..., dict]
) -> None:
    stranger = register("yabanci")
    for_game, against_game = start_game(side="for")["id"], start_game(side="against")["id"]

    assert code(turn(client, stranger, for_game)) == (404, "GAME_NOT_FOUND")
    assert code(opponent(client, stranger, against_game)) == (404, "GAME_NOT_FOUND")


# Player input (FR-06)


@pytest.mark.parametrize(
    "body",
    [
        {"text": "", "client_turn_id": str(uuid.uuid4())},
        {"text": "   \n ", "client_turn_id": str(uuid.uuid4())},
        {"text": "a" * (MAX_TURN_LENGTH + 1), "client_turn_id": str(uuid.uuid4())},
        {"text": "Argüman"},
        {"text": "Argüman", "client_turn_id": "not-a-uuid"},
    ],
    ids=["empty", "whitespace", "too-long", "no-client-id", "bad-client-id"],
)
def test_invalid_turns_are_rejected_and_not_stored(
    client: TestClient, player: Headers, start_game: Callable[..., dict], body: dict
) -> None:
    game_id = start_game(side="for")["id"]

    response = client.post(f"/api/v1/games/{game_id}/sessions/1/turns", json=body, headers=player)

    assert response.status_code == 422
    assert session_of(client, player, game_id)["turns"] == []


def test_turn_text_is_stored_without_surrounding_whitespace(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(side="for")["id"]

    response = turn(client, player, game_id, text="  Argümanım budur.\n")

    assert response.json()["player_turn"]["text"] == "Argümanım budur."


# Resent turns (FR-06, UC-04 A3)


def test_a_resent_turn_is_stored_once(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(side="for")["id"]
    client_turn_id = uuid.uuid4()

    first = turn(client, player, game_id, "İlk metin", client_turn_id)
    again = turn(client, player, game_id, "Farklı metin", client_turn_id)

    assert (first.status_code, again.status_code) == (201, 200)
    assert again.json()["player_turn"] == first.json()["player_turn"]
    assert again.json()["opponent_turn"] == first.json()["opponent_turn"]
    assert again.json()["player_turn"]["text"] == "İlk metin"
    assert len(session_of(client, player, game_id)["turns"]) == 2


def test_a_turn_resent_after_the_session_closed_still_gets_its_round(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(side="for")["id"]
    first_id = uuid.uuid4()
    first = turn(client, player, game_id, client_turn_id=first_id)
    for _ in range(ROUNDS_PER_SESSION - 1):
        turn(client, player, game_id)

    again = turn(client, player, game_id, client_turn_id=first_id)

    assert again.status_code == 200
    assert again.json()["player_turn"]["id"] == first.json()["player_turn"]["id"]
    assert again.json()["session"]["status"] == "awaiting_evaluation"


# Opponent failures and retries (FR-07, UC-04 E1)


def test_opponent_failure_keeps_the_player_turn_until_the_retry(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
) -> None:
    game_id = start_game(side="for")["id"]
    client_turn_id = uuid.uuid4()
    use_opponent(DownOpponent())

    failed = turn(client, player, game_id, "Kaybolmamalı", client_turn_id)

    assert code(failed) == (503, "OPPONENT_UNAVAILABLE")
    session = session_of(client, player, game_id)
    assert [(t["speaker"], t["text"]) for t in session["turns"]] == [("player", "Kaybolmamalı")]
    assert (session["status"], session["next_speaker"]) == ("awaiting_opponent", "opponent")
    resent = turn(client, player, game_id, "Kaybolmamalı", client_turn_id)
    assert (resent.status_code, resent.json()["opponent_turn"]) == (200, None)

    use_opponent(ai.MockOpponent())
    retried = opponent(client, player, game_id)

    assert retried.status_code == 201
    assert retried.json()["session"]["status"] == "awaiting_player"
    assert [t["speaker"] for t in retried.json()["session"]["turns"]] == ["player", "opponent"]


def test_failed_opponent_turn_stores_nothing(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
) -> None:
    game_id = start_game(side="against")["id"]
    use_opponent(DownOpponent())

    assert code(opponent(client, player, game_id)) == (503, "OPPONENT_UNAVAILABLE")
    assert session_of(client, player, game_id)["turns"] == []
    assert session_of(client, player, game_id)["status"] == "awaiting_opponent"


@pytest.mark.parametrize(("retries", "calls"), [(0, 1), (1, 2), (2, 3)])
def test_the_opponent_is_tried_once_more_per_retry(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
    monkeypatch: pytest.MonkeyPatch,
    retries: int,
    calls: int,
) -> None:
    game_id = start_game(side="against")["id"]
    monkeypatch.setattr(settings, "opponent_retries", retries)
    monkeypatch.setattr(DownOpponent, "calls", 0)
    use_opponent(DownOpponent())

    assert opponent(client, player, game_id).status_code == 503
    assert DownOpponent.calls == calls


def test_a_retry_after_one_failure_succeeds_within_the_request(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FlakyOpponent:
        calls = 0

        def reply(self, request):
            FlakyOpponent.calls += 1
            if FlakyOpponent.calls == 1:
                raise ai.OpponentUnavailable
            return ai.OpponentReply(text="İkinci denemede geldim.")

    game_id = start_game(side="against")["id"]
    monkeypatch.setattr(settings, "opponent_retries", 1)
    use_opponent(FlakyOpponent())

    response = opponent(client, player, game_id)

    assert response.status_code == 201
    assert response.json()["opponent_turn"]["text"] == "İkinci denemede geldim."


def test_a_timed_out_opponent_keeps_the_player_turn_and_can_be_retried(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """FR-07 acceptance: a forced timeout shows an error, keeps the player's turn, stores no
    opponent turn, and the request can be retried. The engine enforces the timeout even when
    the adapter does not."""

    class HangingOpponent:
        def reply(self, request):
            time.sleep(1)
            return ai.OpponentReply(text="çok geç")

    game_id = start_game(side="for")["id"]
    monkeypatch.setattr(settings, "ai_timeout_seconds", 0.1)
    monkeypatch.setattr(settings, "opponent_retries", 0)
    use_opponent(HangingOpponent())

    started = time.monotonic()
    response = turn(client, player, game_id, "Zaman aşımına rağmen")
    elapsed = time.monotonic() - started

    assert code(response) == (503, "OPPONENT_UNAVAILABLE")
    assert elapsed < 0.9
    session = session_of(client, player, game_id)
    assert [(t["speaker"], t["text"]) for t in session["turns"]] == [
        ("player", "Zaman aşımına rağmen")
    ]
    assert session["status"] == "awaiting_opponent"
    use_opponent(ai.MockOpponent())
    assert opponent(client, player, game_id).status_code == 201


def test_a_finished_game_takes_no_opponent_turns(
    client: TestClient, player: Headers, start_game: Callable[..., dict], db_session: Session
) -> None:
    game_id = start_game(side="against")["id"]
    db_session.get(models.Game, uuid.UUID(game_id)).status = "finished"
    db_session.commit()

    assert code(opponent(client, player, game_id)) == (409, "GAME_FINISHED")


def test_an_empty_opponent_reply_counts_as_a_failure(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
) -> None:
    class BlankOpponent:
        def reply(self, request):
            return ai.OpponentReply(text=" \n ")

    game_id = start_game(side="against")["id"]
    use_opponent(BlankOpponent())

    assert code(opponent(client, player, game_id)) == (503, "OPPONENT_UNAVAILABLE")
    assert session_of(client, player, game_id)["turns"] == []


# What the opponent is told


def test_the_opponent_gets_the_other_side_and_the_transcript_so_far(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
) -> None:
    recorder = RecordingOpponent()
    use_opponent(recorder)
    for_game = start_game(side="for")["id"]
    against_game = start_game(side="against")["id"]

    turn(client, player, for_game, "Birinci")
    turn(client, player, for_game, "İkinci")
    opponent(client, player, against_game)

    first, second, opening = recorder.requests
    assert (first.side, first.round_no, first.max_rounds) == ("against", 1, ROUNDS_PER_SESSION)
    assert [(line.speaker, line.text) for line in first.transcript] == [("player", "Birinci")]
    assert second.round_no == 2
    assert [line.text for line in second.transcript] == ["Birinci", "Rakip 1", "İkinci"]
    assert (opening.side, opening.round_no, opening.transcript) == ("for", 1, [])


def test_the_mock_opponent_can_open_a_debate(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(side="against")["id"]

    response = opponent(client, player, game_id)

    assert response.status_code == 201
    assert response.json()["opponent_turn"]["text"].startswith("Açılış konuşmamda")


# Concurrency and resuming (NFR-05, FR-16)


def test_concurrent_opponent_requests_store_one_turn_and_return_it(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
) -> None:
    """A second request arrives while the model is still working on the first one."""
    game_id = start_game(side="against")["id"]
    inner: list = []

    class SlowOpponent:
        calls = 0

        def reply(self, request):
            SlowOpponent.calls += 1
            if SlowOpponent.calls == 1:
                # While the first call waits for the model, a second call completes.
                inner.append(opponent(client, player, game_id))
                return ai.OpponentReply(text="dış istek")
            return ai.OpponentReply(text="iç istek")

    use_opponent(SlowOpponent())

    outer = opponent(client, player, game_id)

    assert (outer.status_code, inner[0].status_code) == (201, 201)
    assert outer.json()["opponent_turn"] == inner[0].json()["opponent_turn"]
    turns = session_of(client, player, game_id)["turns"]
    assert [(t["speaker"], t["text"]) for t in turns] == [("opponent", "iç istek")]


def test_a_pending_opponent_turn_is_generated_after_a_restart(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    use_opponent: Callable[[object], None],
    engine: Engine,
) -> None:
    game_id = start_game(side="for")["id"]
    use_opponent(DownOpponent())
    turn(client, player, game_id, "Kesintiden önce")
    use_opponent(ai.MockOpponent())

    # A new database session reads everything from the database, not from loaded objects.
    restarted = sessionmaker(bind=engine, expire_on_commit=False)()
    app.dependency_overrides[get_db] = lambda: restarted
    try:
        resumed = session_of(client, player, game_id)
        assert (resumed["status"], resumed["next_speaker"]) == ("awaiting_opponent", "opponent")
        response = opponent(client, player, game_id)
    finally:
        restarted.close()

    assert response.status_code == 201
    assert [t["text"] for t in response.json()["session"]["turns"]][0] == "Kesintiden önce"


# Evaluation is not part of WBS-3.2


def test_a_closed_session_waits_for_its_evaluation(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game = start_game(side="for")
    for _ in range(ROUNDS_PER_SESSION):
        turn(client, player, game["id"])

    verdict = client.get(f"/api/v1/games/{game['id']}/sessions/1/verdict", headers=player)

    assert code(verdict) == (409, "EVALUATION_NOT_READY")
    after = client.get(f"/api/v1/games/{game['id']}", headers=player).json()
    assert after["metrics"] == game["metrics"]
    assert after["status"] == "active"

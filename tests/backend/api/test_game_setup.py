"""Starting games, the topic catalog, choosing sides and resuming (WBS-3.1)."""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app import content, models
from app.content import CATALOG_VERSION, METRICS, ROUNDS_PER_SESSION, game_config
from app.db import get_db
from app.main import app
from app.schemas import MAX_TURN_LENGTH

Headers = dict[str, str]


def create(client: TestClient, headers: Headers, session_count: int):
    return client.post("/api/v1/games", json={"session_count": session_count}, headers=headers)


def choose(client: TestClient, headers: Headers, game_id: str, session_no: int, side: str):
    return client.post(
        f"/api/v1/games/{game_id}/sessions/{session_no}/side", json={"side": side}, headers=headers
    )


def test_game_config_is_public_and_fits_the_catalog(client: TestClient) -> None:
    response = client.get("/api/v1/game-config")

    assert response.status_code == 200
    config = response.json()
    assert config == game_config().model_dump()
    assert config["catalog_version"] == CATALOG_VERSION
    assert 1 <= config["min_sessions"] <= config["max_sessions"] <= len(content.TOPICS)


def test_new_game_has_distinct_topics_baseline_metrics_and_catalog_version(
    client: TestClient, player: Headers
) -> None:
    count = game_config().max_sessions

    response = create(client, player, count)

    assert response.status_code == 201
    game = response.json()
    topic_ids = [s["topic"]["id"] for s in game["sessions"]]
    assert len(topic_ids) == len(set(topic_ids)) == count
    assert set(topic_ids) <= set(content.TOPICS)
    assert {m["id"]: m["value"] for m in game["metrics"]} == {m.id: m.initial for m in METRICS}
    assert game["catalog_version"] == CATALOG_VERSION
    assert game["status"] == "active"
    assert game["session_count"] == count
    assert game["completed_sessions"] == 0
    assert game["current_session"] == 1
    assert game["final_score"] is None
    assert game["finished_at"] is None


@pytest.mark.parametrize("offset", [-1, 1, 100], ids=["below", "above", "far-above"])
def test_session_count_outside_the_range_is_rejected(
    client: TestClient, player: Headers, offset: int
) -> None:
    config = game_config()
    count = config.min_sessions + offset if offset < 0 else config.max_sessions + offset

    response = create(client, player, count)

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_SESSION_COUNT"
    assert client.get("/api/v1/games", headers=player).json() == []


@pytest.mark.parametrize("value", [True, "1", 1.5, None])
def test_session_count_must_be_an_integer(client: TestClient, player: Headers, value) -> None:
    response = client.post("/api/v1/games", json={"session_count": value}, headers=player)

    assert response.status_code == 422
    assert client.get("/api/v1/games", headers=player).json() == []


def test_first_session_shows_the_topic_and_waits_for_a_side(
    start_game: Callable[..., dict],
) -> None:
    first, second = start_game(2, side=None)["sessions"]

    assert first["status"] == "choosing_side"
    assert first["player_side"] is None
    assert first["next_speaker"] is None
    assert first["rounds_played"] == 0
    assert first["max_rounds"] == ROUNDS_PER_SESSION
    assert first["turns"] == []
    assert first["verdict_available"] is False
    assert first["adopted_side"] is None
    expected = content.TOPICS[first["topic"]["id"]].topic.model_dump(mode="json")
    assert first["topic"] == expected
    assert set(first["topic"]["positions"]) == {"for", "against"}
    assert second["status"] == "pending"


@pytest.mark.parametrize(
    ("side", "status", "speaker"),
    [("for", "awaiting_player", "player"), ("against", "awaiting_opponent", "opponent")],
)
def test_the_for_side_speaks_first(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    side: str,
    status: str,
    speaker: str,
) -> None:
    game_id = start_game(side=None)["id"]

    response = choose(client, player, game_id, 1, side)

    assert response.status_code == 200
    session = response.json()
    assert (session["player_side"], session["status"], session["next_speaker"]) == (
        side,
        status,
        speaker,
    )
    stored = client.get(f"/api/v1/games/{game_id}", headers=player).json()["sessions"][0]
    assert stored == session


def test_side_is_chosen_only_once_and_only_in_the_open_session(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(2, side="for")["id"]

    again = choose(client, player, game_id, 1, "against")
    early = choose(client, player, game_id, 2, "for")

    assert (again.status_code, again.json()["code"]) == (409, "SIDE_ALREADY_CHOSEN")
    assert (early.status_code, early.json()["code"]) == (409, "SESSION_NOT_ACTIVE")
    first = client.get(f"/api/v1/games/{game_id}", headers=player).json()["sessions"][0]
    assert first["player_side"] == "for"


def test_unknown_session_is_not_found(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(side=None)["id"]

    missing = choose(client, player, game_id, 2, "for")

    assert (missing.status_code, missing.json()["code"]) == (404, "SESSION_NOT_FOUND")
    assert choose(client, player, game_id, 0, "for").status_code == 422


def test_starting_a_new_game_keeps_the_unfinished_one(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    first = start_game()
    second = start_game()

    games = client.get("/api/v1/games", headers=player).json()

    assert {g["id"] for g in games} == {first["id"], second["id"]}
    assert all(g["status"] == "active" for g in games)


def test_games_are_listed_newest_first(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    db_session: Session,
) -> None:
    older, newer = start_game()["id"], start_game()["id"]
    # SQLite stores now() in whole seconds, so the order is set explicitly.
    for game_id, day in ((older, 1), (newer, 2)):
        db_session.get(models.Game, uuid.UUID(game_id)).created_at = datetime(
            2026, 11, day, tzinfo=UTC
        )
    db_session.commit()

    games = client.get("/api/v1/games", headers=player).json()

    assert [g["id"] for g in games] == [newer, older]
    assert games[0]["completed_sessions"] == 0


def test_other_players_games_are_not_found(
    client: TestClient,
    register: Callable[[str], Headers],
    start_game: Callable[..., dict],
) -> None:
    stranger = register("yabanci")
    game_id = start_game(side=None)["id"]

    reads = client.get(f"/api/v1/games/{game_id}", headers=stranger)
    sides = choose(client, stranger, game_id, 1, "for")

    for response in (reads, sides):
        assert (response.status_code, response.json()["code"]) == (404, "GAME_NOT_FOUND")
    assert client.get("/api/v1/games", headers=stranger).json() == []
    missing = client.get(f"/api/v1/games/{uuid.uuid4()}", headers=stranger)
    assert missing.json()["code"] == "GAME_NOT_FOUND"


def test_requests_without_a_token_carry_a_code(client: TestClient) -> None:
    response = client.post("/api/v1/games", json={"session_count": 1})

    assert response.status_code == 401
    assert response.json()["code"] == "NOT_AUTHENTICATED"
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_game_resumes_exactly_after_a_restart(
    client: TestClient, player: Headers, start_game: Callable[..., dict], engine: Engine
) -> None:
    game_id = start_game(2)["id"]
    turn = client.post(
        f"/api/v1/games/{game_id}/sessions/1/turns", json={"text": "Açılış"}, headers=player
    )
    assert turn.status_code == 201
    before = client.get(f"/api/v1/games/{game_id}", headers=player).json()

    # A new database session reads everything from the database, not from loaded objects.
    restarted = sessionmaker(bind=engine)()
    app.dependency_overrides[get_db] = lambda: restarted
    try:
        after = client.get(f"/api/v1/games/{game_id}", headers=player).json()
    finally:
        restarted.close()

    assert after == before
    assert after["sessions"][0]["rounds_played"] == 1
    assert after["sessions"][0]["next_speaker"] == "player"


def test_a_catalog_change_does_not_alter_a_running_game(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    game = start_game()
    monkeypatch.setattr(content, "TOPICS", {})

    after = client.get(f"/api/v1/games/{game['id']}", headers=player).json()

    assert after["sessions"][0]["topic"] == game["sessions"][0]["topic"]
    assert after["catalog_version"] == game["catalog_version"]


def test_turn_longer_than_the_limit_is_rejected(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game()["id"]

    response = client.post(
        f"/api/v1/games/{game_id}/sessions/1/turns",
        json={"text": "a" * (MAX_TURN_LENGTH + 1)},
        headers=player,
    )

    assert response.status_code == 422
    assert game_config().max_turn_length == MAX_TURN_LENGTH

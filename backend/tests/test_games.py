import secrets
import uuid

import pytest
from fastapi.testclient import TestClient

from app import ai
from app.content import METRICS, ROUNDS_PER_SESSION
from app.schemas import JudgeQuantitative, MetricDelta

# Generated per run so that no password-like literal is committed (secret scanners flag them).
PASSWORD = secrets.token_urlsafe(12)


def auth_headers(client: TestClient, email: str = "oyuncu@example.com") -> dict[str, str]:
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    token = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def new_game(client: TestClient, headers: dict[str, str], *topics: str) -> dict:
    sessions = [
        {"topic_id": topic, "player_side": "for"} for topic in topics or ("public-transport",)
    ]
    response = client.post("/api/v1/games", json={"sessions": sessions}, headers=headers)
    assert response.status_code == 201
    return response.json()


def play(client: TestClient, headers: dict[str, str], game_id: str, session_no: int, text: str):
    return client.post(
        f"/api/v1/games/{game_id}/sessions/{session_no}/turns", json={"text": text}, headers=headers
    )


def play_session(client: TestClient, headers: dict[str, str], game_id: str, session_no: int):
    for _ in range(ROUNDS_PER_SESSION):
        response = play(client, headers, game_id, session_no, "Bu politika " * 40)
        assert response.status_code == 201
    return response.json()


def test_topics_list_both_positions(client: TestClient) -> None:
    topics = client.get("/api/v1/topics").json()

    assert len(topics) >= 5
    assert set(topics[0]["positions"]) == {"for", "against"}


def test_games_require_a_token(client: TestClient) -> None:
    assert client.get("/api/v1/games").status_code == 401
    assert client.post("/api/v1/games", json={"sessions": []}).status_code == 401


def test_create_game_starts_first_session(client: TestClient) -> None:
    headers = auth_headers(client)

    game = new_game(client, headers, "public-transport", "remote-work")

    assert game["status"] == "active"
    assert game["current_session"] == 1
    assert [s["status"] for s in game["sessions"]] == ["in_progress", "pending"]
    assert {m["id"]: m["value"] for m in game["metrics"]} == {m.id: m.initial for m in METRICS}


def test_create_game_rejects_unknown_topic_and_empty_sessions(client: TestClient) -> None:
    headers = auth_headers(client)
    unknown = {"sessions": [{"topic_id": "nope", "player_side": "for"}]}

    assert client.post("/api/v1/games", json=unknown, headers=headers).status_code == 422
    assert client.post("/api/v1/games", json={"sessions": []}, headers=headers).status_code == 422


def test_turn_returns_opponent_reply_and_is_stored(client: TestClient) -> None:
    headers = auth_headers(client)
    game = new_game(client, headers)

    response = play(client, headers, game["id"], 1, "Ücretsiz ulaşım eğitime erişimi artırır.")

    assert response.status_code == 201
    body = response.json()
    assert body["player_turn"]["speaker"] == "player"
    assert body["opponent_turn"]["speaker"] == "opponent"
    assert body["session_finished"] is False
    turns = client.get(f"/api/v1/games/{game['id']}", headers=headers).json()["sessions"][0]
    assert [t["speaker"] for t in turns["turns"]] == ["player", "opponent"]


def test_full_game_judges_each_session_and_finishes(client: TestClient) -> None:
    headers = auth_headers(client)
    game_id = new_game(client, headers, "public-transport", "remote-work")["id"]

    last = play_session(client, headers, game_id, 1)
    assert last["session_finished"] is True
    assert last["game_finished"] is False
    game = client.get(f"/api/v1/games/{game_id}", headers=headers).json()
    assert game["current_session"] == 2
    assert game["sessions"][0]["verdict_available"] is True

    verdict = client.get(f"/api/v1/games/{game_id}/sessions/1/verdict", headers=headers).json()
    assert verdict["applied"] is True
    assert verdict["judge_model"] == "mock-judge"
    after = {m["id"]: m["value"] for m in verdict["metrics_after"]}
    assert after == {m["id"]: m["value"] for m in game["metrics"]}

    assert play_session(client, headers, game_id, 2)["game_finished"] is True
    game = client.get(f"/api/v1/games/{game_id}", headers=headers).json()
    assert game["status"] == "finished"
    assert game["final_score"] is not None
    assert play(client, headers, game_id, 2, "Bir tur daha").status_code == 409


def test_only_the_current_session_can_be_played(client: TestClient) -> None:
    headers = auth_headers(client)
    game_id = new_game(client, headers, "public-transport", "remote-work")["id"]

    assert play(client, headers, game_id, 2, "Erken").status_code == 409
    assert play(client, headers, game_id, 3, "Yok").status_code == 404


def test_verdict_waits_for_the_session_to_finish(client: TestClient) -> None:
    headers = auth_headers(client)
    game_id = new_game(client, headers)["id"]

    response = client.get(f"/api/v1/games/{game_id}/sessions/1/verdict", headers=headers)

    assert response.status_code == 409


def test_other_players_games_are_not_found(client: TestClient) -> None:
    owner = auth_headers(client)
    stranger = auth_headers(client, email="baska@example.com")
    game_id = new_game(client, owner)["id"]

    assert client.get(f"/api/v1/games/{game_id}", headers=stranger).status_code == 404
    assert play(client, stranger, game_id, 1, "Merhaba").status_code == 404
    assert client.get("/api/v1/games", headers=stranger).json() == []
    missing = client.get(f"/api/v1/games/{uuid.uuid4()}", headers=owner)
    assert missing.status_code == 404


def test_opponent_failure_stores_nothing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    class DownOpponent:
        def reply(self, request: ai.OpponentRequest) -> ai.OpponentReply:
            raise ai.OpponentUnavailable

    headers = auth_headers(client)
    game_id = new_game(client, headers)["id"]
    monkeypatch.setattr(ai, "get_opponent", DownOpponent)

    assert play(client, headers, game_id, 1, "Merhaba").status_code == 503
    game = client.get(f"/api/v1/games/{game_id}", headers=headers).json()
    assert game["sessions"][0]["turns"] == []


def test_judge_failure_keeps_the_last_round_unplayed(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    class DownJudge(ai.MockJudge):
        def qualitative(self, request: ai.JudgeRequest):
            raise ai.JudgeUnavailable

    headers = auth_headers(client)
    game_id = new_game(client, headers)["id"]
    for _ in range(ROUNDS_PER_SESSION - 1):
        play(client, headers, game_id, 1, "Tur")
    monkeypatch.setattr(ai, "get_judge", DownJudge)

    assert play(client, headers, game_id, 1, "Son tur").status_code == 503
    session = client.get(f"/api/v1/games/{game_id}", headers=headers).json()["sessions"][0]
    assert len(session["turns"]) == 2 * (ROUNDS_PER_SESSION - 1)
    assert session["status"] == "in_progress"


def test_out_of_range_judge_deltas_are_rejected_and_metrics_kept(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    class GreedyJudge(ai.MockJudge):
        def quantitative(self, request, qualitative) -> JudgeQuantitative:
            return JudgeQuantitative(
                metric_deltas=[MetricDelta(metric_id=METRICS[0].id, delta=50)]
            )

    headers = auth_headers(client)
    game_id = new_game(client, headers)["id"]
    monkeypatch.setattr(ai, "get_judge", GreedyJudge)

    play_session(client, headers, game_id, 1)

    verdict = client.get(f"/api/v1/games/{game_id}/sessions/1/verdict", headers=headers).json()
    assert verdict["applied"] is False
    assert "limit" in verdict["rejection_reason"]
    assert verdict["metrics_after"] == verdict["metrics_before"]
    game = client.get(f"/api/v1/games/{game_id}", headers=headers).json()
    assert {m["id"]: m["value"] for m in game["metrics"]} == {m.id: m.initial for m in METRICS}

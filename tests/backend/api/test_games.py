"""Turns and verdicts. Interim v0.2 round flow until WBS-3.2 and WBS-3.3 replace it."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app import ai
from app.content import METRICS, ROUNDS_PER_SESSION
from app.schemas import JudgeQuantitative, MetricDelta

Headers = dict[str, str]


def play(client: TestClient, headers: Headers, game_id: str, session_no: int, text: str):
    return client.post(
        f"/api/v1/games/{game_id}/sessions/{session_no}/turns", json={"text": text}, headers=headers
    )


def play_session(client: TestClient, headers: Headers, game_id: str, session_no: int):
    for _ in range(ROUNDS_PER_SESSION):
        response = play(client, headers, game_id, session_no, "Bu politika " * 40)
        assert response.status_code == 201, response.text
    return response.json()


def test_topics_list_both_positions(client: TestClient) -> None:
    topics = client.get("/api/v1/topics").json()

    assert len(topics) >= 5
    assert set(topics[0]["positions"]) == {"for", "against"}


def test_games_require_a_token(client: TestClient) -> None:
    assert client.get("/api/v1/games").status_code == 401
    assert client.post("/api/v1/games", json={"session_count": 1}).status_code == 401


def test_turn_returns_opponent_reply_and_is_stored(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game()["id"]

    response = play(client, player, game_id, 1, "Ücretsiz ulaşım eğitime erişimi artırır.")

    assert response.status_code == 201
    body = response.json()
    assert body["player_turn"]["speaker"] == "player"
    assert body["opponent_turn"]["speaker"] == "opponent"
    assert body["session_finished"] is False
    session = client.get(f"/api/v1/games/{game_id}", headers=player).json()["sessions"][0]
    assert [t["speaker"] for t in session["turns"]] == ["player", "opponent"]
    assert session["status"] == "awaiting_player"


def test_full_game_judges_each_session_and_finishes(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(2)["id"]

    last = play_session(client, player, game_id, 1)
    assert last["session_finished"] is True
    assert last["game_finished"] is False
    game = client.get(f"/api/v1/games/{game_id}", headers=player).json()
    assert game["current_session"] == 2
    assert game["completed_sessions"] == 1
    assert game["sessions"][0]["verdict_available"] is True
    assert game["sessions"][1]["status"] == "choosing_side"

    verdict = client.get(f"/api/v1/games/{game_id}/sessions/1/verdict", headers=player).json()
    assert verdict["applied"] is True
    assert verdict["judge_model"] == "mock-judge"
    after = {m["id"]: m["value"] for m in verdict["metrics_after"]}
    assert after == {m["id"]: m["value"] for m in game["metrics"]}

    side = client.post(
        f"/api/v1/games/{game_id}/sessions/2/side", json={"side": "for"}, headers=player
    )
    assert side.status_code == 200
    assert play_session(client, player, game_id, 2)["game_finished"] is True
    game = client.get(f"/api/v1/games/{game_id}", headers=player).json()
    assert game["status"] == "finished"
    assert game["completed_sessions"] == 2
    assert game["final_score"] is not None
    assert game["finished_at"] is not None
    finished = play(client, player, game_id, 2, "Bir tur daha")
    assert (finished.status_code, finished.json()["code"]) == (409, "GAME_FINISHED")


def test_only_the_current_session_can_be_played(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game(2)["id"]

    early = play(client, player, game_id, 2, "Erken")

    assert (early.status_code, early.json()["code"]) == (409, "SESSION_NOT_ACTIVE")
    assert play(client, player, game_id, 3, "Yok").json()["code"] == "SESSION_NOT_FOUND"


def test_turns_wait_for_the_side_and_the_player_turn(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    unchosen = play(client, player, start_game(side=None)["id"], 1, "Merhaba")
    against = play(client, player, start_game(side="against")["id"], 1, "Merhaba")

    assert (unchosen.status_code, unchosen.json()["code"]) == (409, "SESSION_NOT_ACTIVE")
    assert (against.status_code, against.json()["code"]) == (409, "NOT_YOUR_TURN")


def test_verdict_waits_for_the_session_to_finish(
    client: TestClient, player: Headers, start_game: Callable[..., dict]
) -> None:
    game_id = start_game()["id"]

    response = client.get(f"/api/v1/games/{game_id}/sessions/1/verdict", headers=player)

    assert (response.status_code, response.json()["code"]) == (409, "EVALUATION_NOT_READY")


def test_other_players_cannot_play_or_read_verdicts(
    client: TestClient, register: Callable[[str], Headers], start_game: Callable[..., dict]
) -> None:
    stranger = register("yabanci")
    game_id = start_game()["id"]

    assert play(client, stranger, game_id, 1, "Merhaba").status_code == 404
    verdict = client.get(f"/api/v1/games/{game_id}/sessions/1/verdict", headers=stranger)
    assert verdict.status_code == 404


def test_opponent_failure_stores_nothing(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DownOpponent:
        def reply(self, request: ai.OpponentRequest) -> ai.OpponentReply:
            raise ai.OpponentUnavailable

    game_id = start_game()["id"]
    monkeypatch.setattr(ai, "get_opponent", DownOpponent)

    response = play(client, player, game_id, 1, "Merhaba")

    assert (response.status_code, response.json()["code"]) == (503, "OPPONENT_UNAVAILABLE")
    game = client.get(f"/api/v1/games/{game_id}", headers=player).json()
    assert game["sessions"][0]["turns"] == []


def test_judge_failure_keeps_the_last_round_unplayed(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DownJudge(ai.MockJudge):
        def qualitative(self, request: ai.JudgeRequest):
            raise ai.JudgeUnavailable

    game_id = start_game()["id"]
    for _ in range(ROUNDS_PER_SESSION - 1):
        play(client, player, game_id, 1, "Tur")
    monkeypatch.setattr(ai, "get_judge", DownJudge)

    response = play(client, player, game_id, 1, "Son tur")

    assert (response.status_code, response.json()["code"]) == (503, "EVALUATION_FAILED")
    session = client.get(f"/api/v1/games/{game_id}", headers=player).json()["sessions"][0]
    assert len(session["turns"]) == 2 * (ROUNDS_PER_SESSION - 1)
    assert session["status"] == "awaiting_player"


def test_out_of_range_judge_deltas_are_rejected_and_metrics_kept(
    client: TestClient,
    player: Headers,
    start_game: Callable[..., dict],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class GreedyJudge(ai.MockJudge):
        def quantitative(self, request, qualitative) -> JudgeQuantitative:
            return JudgeQuantitative(metric_deltas=[MetricDelta(metric_id=METRICS[0].id, delta=50)])

    game_id = start_game()["id"]
    monkeypatch.setattr(ai, "get_judge", GreedyJudge)

    play_session(client, player, game_id, 1)

    verdict = client.get(f"/api/v1/games/{game_id}/sessions/1/verdict", headers=player).json()
    assert verdict["applied"] is False
    assert "limit" in verdict["rejection_reason"]
    assert verdict["metrics_after"] == verdict["metrics_before"]
    game = client.get(f"/api/v1/games/{game_id}", headers=player).json()
    assert {m["id"]: m["value"] for m in game["metrics"]} == {m.id: m.initial for m in METRICS}

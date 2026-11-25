import secrets
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

# Generated per run so that no password-like literal is committed (secret scanners flag them).
PASSWORD = secrets.token_urlsafe(12)

Headers = dict[str, str]


@pytest.fixture
def engine() -> Iterator[Engine]:
    """A fresh in-memory SQLite database per test, so CI needs no PostgreSQL."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def register(client: TestClient) -> Callable[[str], Headers]:
    """Registers an account and returns its authorization header."""

    def register(username: str) -> Headers:
        response = client.post(
            "/api/v1/auth/register",
            json={"email": f"{username}@example.com", "password": PASSWORD, "username": username},
        )
        assert response.status_code == 201, response.text
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return register


@pytest.fixture
def player(register: Callable[[str], Headers]) -> Headers:
    return register("oyuncu")


@pytest.fixture
def start_game(client: TestClient, player: Headers) -> Callable[..., dict[str, Any]]:
    """Creates a game for `player` and, unless `side` is None, chooses the side of session 1."""

    def start_game(
        session_count: int = 1, side: str | None = "for", headers: Headers | None = None
    ) -> dict[str, Any]:
        headers = headers or player
        response = client.post(
            "/api/v1/games", json={"session_count": session_count}, headers=headers
        )
        assert response.status_code == 201, response.text
        game = response.json()
        if side is not None:
            chosen = client.post(
                f"/api/v1/games/{game['id']}/sessions/1/side", json={"side": side}, headers=headers
            )
            assert chosen.status_code == 200, chosen.text
            game = client.get(f"/api/v1/games/{game['id']}", headers=headers).json()
        return game

    return start_game

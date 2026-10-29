import secrets
import uuid
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from app.security import create_access_token

EMAIL = "oyuncu@example.com"
# Generated per run so that no password-like literal is committed (secret scanners flag them).
PASSWORD = secrets.token_urlsafe(12)
OTHER_PASSWORD = secrets.token_urlsafe(12)


def register(client: TestClient, email: str = EMAIL, password: str = PASSWORD):
    return client.post("/api/v1/auth/register", json={"email": email, "password": password})


def login(client: TestClient, email: str = EMAIL, password: str = PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def me(client: TestClient, token: str | None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get("/api/v1/auth/me", headers=headers)


def test_register_returns_user_without_password(client: TestClient) -> None:
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == EMAIL
    assert set(body) == {"id", "email", "created_at"}


def test_register_rejects_duplicate_email_case_insensitively(client: TestClient) -> None:
    register(client)

    response = register(client, email=EMAIL.upper())

    assert response.status_code == 409


def test_register_validates_input(client: TestClient) -> None:
    assert register(client, password=PASSWORD[:7]).status_code == 422
    assert register(client, email="not-an-email").status_code == 422


def test_login_token_gives_access_to_me(client: TestClient) -> None:
    register(client)

    response = login(client, email=EMAIL.upper())

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    me_response = me(client, response.json()["access_token"])
    assert me_response.status_code == 200
    assert me_response.json()["email"] == EMAIL


def test_login_gives_same_error_for_wrong_password_and_unknown_email(client: TestClient) -> None:
    register(client)

    wrong_password = login(client, password=OTHER_PASSWORD)
    unknown_email = login(client, email="kimse@example.com")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_me_requires_a_token(client: TestClient) -> None:
    response = me(client, None)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_me_rejects_tampered_token(client: TestClient) -> None:
    register(client)
    token = login(client).json()["access_token"]
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")

    assert me(client, tampered).status_code == 401
    assert me(client, "not.a.jwt").status_code == 401


def test_me_rejects_expired_token(client: TestClient) -> None:
    user_id = uuid.UUID(register(client).json()["id"])
    expired = create_access_token(user_id, expires_delta=timedelta(minutes=-1))

    assert me(client, expired).status_code == 401


def test_me_rejects_token_of_deleted_user(client: TestClient, db_session: Session) -> None:
    register(client)
    token = login(client).json()["access_token"]
    db_session.query(User).delete()
    db_session.commit()

    assert me(client, token).status_code == 401

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User
from app.security import ALGORITHM, create_access_token

EMAIL = "oyuncu@example.com"
USERNAME = "oyuncu"
# Generated per run so that no password-like literal is committed (secret scanners flag them).
PASSWORD = secrets.token_urlsafe(12)
OTHER_PASSWORD = secrets.token_urlsafe(12)


def register(
    client: TestClient, email: str = EMAIL, password: str = PASSWORD, username: str = USERNAME
):
    return client.post(
        "/api/v1/auth/register", json={"email": email, "password": password, "username": username}
    )


def login(client: TestClient, email: str = EMAIL, password: str = PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def me(client: TestClient, token: str | None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get("/api/v1/auth/me", headers=headers)


def logout(client: TestClient, token: str | None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post("/api/v1/auth/logout", headers=headers)


def test_register_returns_user_without_password(client: TestClient) -> None:
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == EMAIL
    assert body["user"]["username"] == USERNAME
    assert set(body["user"]) == {"id", "email", "username", "created_at"}


def test_register_logs_the_user_in(client: TestClient) -> None:
    token = register(client).json()["access_token"]

    assert me(client, token).json()["username"] == USERNAME


def test_register_stores_username_in_lowercase(client: TestClient) -> None:
    register(client, username="Oyuncu_1.TR")
    token = login(client).json()["access_token"]

    assert me(client, token).json()["username"] == "oyuncu_1.tr"


def test_register_rejects_duplicate_email_case_insensitively(client: TestClient) -> None:
    register(client)

    response = register(client, email=EMAIL.upper(), username="baska")

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"


def test_register_rejects_duplicate_username_case_insensitively(client: TestClient) -> None:
    register(client)

    response = register(client, email="baska@example.com", username=USERNAME.upper())

    assert response.status_code == 409
    assert response.json()["detail"] == "Username already taken"


def test_register_validates_input(client: TestClient) -> None:
    assert register(client, password=PASSWORD[:7]).status_code == 422
    assert register(client, email="not-an-email").status_code == 422
    missing_username = {"email": EMAIL, "password": PASSWORD}
    assert client.post("/api/v1/auth/register", json=missing_username).status_code == 422


@pytest.mark.parametrize("username", ["ab", "a" * 31, "iki kelime", "türkçe", "x@y", ""])
def test_register_rejects_invalid_username(client: TestClient, username: str) -> None:
    assert register(client, username=username).status_code == 422


def test_login_token_gives_access_to_me(client: TestClient) -> None:
    register(client)

    response = login(client, email=EMAIL.upper())

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["user"]["username"] == USERNAME
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
    user_id = uuid.UUID(register(client).json()["user"]["id"])
    expired = create_access_token(user_id, 0, expires_delta=timedelta(minutes=-1))

    assert me(client, expired).status_code == 401


def test_me_rejects_token_without_version(client: TestClient) -> None:
    """Tokens issued before logout existed carry no version and must not stay valid."""
    user_id = register(client).json()["user"]["id"]
    claims = {"sub": user_id, "iat": datetime.now(UTC), "exp": datetime.now(UTC) + timedelta(1)}
    unversioned = jwt.encode(claims, settings.jwt_secret, algorithm=ALGORITHM)

    assert me(client, unversioned).status_code == 401


def test_logout_invalidates_the_token(client: TestClient) -> None:
    token = register(client).json()["access_token"]

    assert logout(client, token).status_code == 204
    assert me(client, token).status_code == 401
    assert logout(client, token).status_code == 401


def test_logout_invalidates_tokens_on_all_devices(client: TestClient) -> None:
    laptop = register(client).json()["access_token"]
    user_id = uuid.UUID(me(client, laptop).json()["id"])
    # A different expiry guarantees a distinct token even within the same second.
    phone = create_access_token(user_id, 0, expires_delta=timedelta(hours=2))
    assert phone != laptop
    assert me(client, phone).status_code == 200

    logout(client, laptop)

    assert me(client, phone).status_code == 401


def test_login_after_logout_gives_a_working_token(client: TestClient) -> None:
    logout(client, register(client).json()["access_token"])

    token = login(client).json()["access_token"]

    assert me(client, token).status_code == 200


def test_logout_requires_a_token(client: TestClient) -> None:
    assert logout(client, None).status_code == 401


def test_me_rejects_token_of_deleted_user(client: TestClient, db_session: Session) -> None:
    register(client)
    token = login(client).json()["access_token"]
    db_session.query(User).delete()
    db_session.commit()

    assert me(client, token).status_code == 401

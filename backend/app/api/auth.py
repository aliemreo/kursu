import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession
from app.models import User
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


# ASCII only: Turkish İ/ı do not round-trip through lower(), which would break uniqueness.
Username = Annotated[
    str,
    StringConstraints(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_.]+$", to_lower=True),
]


class Registration(Credentials):
    username: Username


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    username: str
    created_at: datetime


class AuthResult(BaseModel):
    """Returned by register and login, so the client needs no extra /auth/me call."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut


def auth_result(user: User) -> AuthResult:
    return AuthResult(
        access_token=create_access_token(user.id, user.token_version),
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=AuthResult, status_code=status.HTTP_201_CREATED)
def register(registration: Registration, db: DbSession) -> AuthResult:
    """Create an account and log it in."""
    email = registration.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if db.scalar(select(User.id).where(User.username == registration.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")

    user = User(
        email=email,
        username=registration.username,
        password_hash=hash_password(registration.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent registration took the email or the username first.
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Email already registered or username already taken"
        ) from None
    db.refresh(user)
    return auth_result(user)


@router.post("/login", response_model=AuthResult)
def login(credentials: Credentials, db: DbSession) -> AuthResult:
    user = db.scalar(select(User).where(User.email == credentials.email.lower()))
    # Same answer for an unknown email and a wrong password, so accounts cannot be probed.
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Wrong email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return auth_result(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: CurrentUser, db: DbSession) -> None:
    """Invalidate every token of the user, on all devices."""
    # Incremented in SQL, so two logouts at the same time both count.
    user.token_version = User.token_version + 1
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user

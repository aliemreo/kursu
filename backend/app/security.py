import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import settings

ALGORITHM = "HS256"

_password_hash = PasswordHash.recommended()


class InvalidTokenError(Exception):
    """The access token is missing a claim, malformed, tampered with or expired."""


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


@dataclass(frozen=True)
class TokenClaims:
    user_id: uuid.UUID
    # Must equal the user's current token_version, or the token was revoked by a logout.
    token_version: int


def create_access_token(
    user_id: uuid.UUID, token_version: int, expires_delta: timedelta | None = None
) -> str:
    now = datetime.now(UTC)
    expires = now + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    claims = {"sub": str(user_id), "ver": token_version, "iat": now, "exp": expires}
    return jwt.encode(claims, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> TokenClaims:
    """Return the claims of a valid token, or raise InvalidTokenError."""
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "ver", "exp"]},
        )
        version = claims["ver"]
        # bool is an int subclass; a token saying "ver": true is not one we issued.
        if not isinstance(version, int) or isinstance(version, bool):
            raise InvalidTokenError
        return TokenClaims(user_id=uuid.UUID(claims["sub"]), token_version=version)
    except (jwt.PyJWTError, ValueError) as exc:
        raise InvalidTokenError from exc

from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-0000"

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Application settings, read from environment variables or a local .env file.

    The repository root .env is shared with docker compose; backend/.env, if present,
    overrides it. Both are found regardless of the working directory.
    """

    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"), extra="ignore"
    )

    app_env: str = "development"
    database_url: str = "postgresql://kursu:change-me@localhost:5432/kursu"
    llm_provider: str = "mock"
    jwt_secret: str = DEV_JWT_SECRET
    jwt_expire_minutes: int = 1440

    @model_validator(mode="after")
    def require_real_secret_outside_development(self) -> "Settings":
        if self.app_env == "development":
            return self
        if self.jwt_secret in (DEV_JWT_SECRET, "change-me") or len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must be a real secret of at least 32 characters")
        return self


settings = Settings()

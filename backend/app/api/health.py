from fastapi import APIRouter
from pydantic import BaseModel

from app import __version__
from app.config import settings

router = APIRouter(tags=["health"])


class Health(BaseModel):
    status: str
    version: str
    environment: str
    llm_provider: str


@router.get("/health", response_model=Health)
def health() -> Health:
    """Liveness check used by CI, Docker and the frontend."""
    return Health(
        status="ok",
        version=__version__,
        environment=settings.app_env,
        llm_provider=settings.llm_provider,
    )

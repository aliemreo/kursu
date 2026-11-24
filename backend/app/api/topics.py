from fastapi import APIRouter

from app.content import TOPICS, game_config
from app.schemas import GameConfig, Topic

router = APIRouter(tags=["topics"])


@router.get("/topics", response_model=list[Topic])
def list_topics() -> list[Topic]:
    return [config.topic for config in TOPICS.values()]


@router.get("/game-config", response_model=GameConfig)
def get_game_config() -> GameConfig:
    """Limits the new-game screen needs. Public."""
    return game_config()

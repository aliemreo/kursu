from fastapi import APIRouter

from app.content import TOPICS
from app.schemas import Topic

router = APIRouter(tags=["topics"])


@router.get("/topics", response_model=list[Topic])
def list_topics() -> list[Topic]:
    return [config.topic for config in TOPICS.values()]

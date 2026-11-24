from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import auth, games, health, topics
from app.errors import ApiError, api_error_handler

app = FastAPI(title="Kürsü API", version=__version__)
app.add_exception_handler(ApiError, api_error_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(topics.router, prefix="/api/v1")
app.include_router(games.router, prefix="/api/v1")

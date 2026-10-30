import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Stored lowercased so that uniqueness is case-insensitive.
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    current_session: Mapped[int] = mapped_column(Integer, default=1)
    # Current value per metric id; metric names and bounds live in app.content.
    metrics: Mapped[dict[str, float]] = mapped_column(JSON)
    final_score: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sessions: Mapped[list["DebateSession"]] = relationship(
        back_populates="game", order_by="DebateSession.session_no", cascade="all, delete-orphan"
    )


class DebateSession(Base):
    """One topic debated over a fixed number of rounds (named so it is not confused with
    the database session)."""

    __tablename__ = "debate_sessions"
    __table_args__ = (UniqueConstraint("game_id", "session_no"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    game_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    session_no: Mapped[int] = mapped_column(Integer)
    topic_id: Mapped[str] = mapped_column(String(64))
    player_side: Mapped[str] = mapped_column(String(8))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    max_rounds: Mapped[int] = mapped_column(Integer)

    game: Mapped[Game] = relationship(back_populates="sessions")
    turns: Mapped[list["Turn"]] = relationship(
        back_populates="session", order_by="Turn.seq", cascade="all, delete-orphan"
    )
    verdict: Mapped["Verdict | None"] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

    @property
    def rounds_played(self) -> int:
        return sum(1 for turn in self.turns if turn.speaker == "player")


class Turn(Base):
    __tablename__ = "turns"
    # The unique sequence number stops two concurrent requests from playing the same round.
    __table_args__ = (UniqueConstraint("session_id", "seq"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("debate_sessions.id", ondelete="CASCADE")
    )
    seq: Mapped[int] = mapped_column(Integer)
    speaker: Mapped[str] = mapped_column(String(16))
    text: Mapped[str] = mapped_column(Text)
    citations: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped[DebateSession] = relationship(back_populates="turns")


class Verdict(Base):
    __tablename__ = "verdicts"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("debate_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    # The judge's two reports, stored as returned (JudgeQualitative / JudgeQuantitative).
    qualitative: Mapped[dict[str, Any]] = mapped_column(JSON)
    quantitative: Mapped[dict[str, Any]] = mapped_column(JSON)
    applied: Mapped[bool] = mapped_column(Boolean)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    metrics_before: Mapped[dict[str, float]] = mapped_column(JSON)
    metrics_after: Mapped[dict[str, float]] = mapped_column(JSON)
    judge_model: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped[DebateSession] = relationship(back_populates="verdict")

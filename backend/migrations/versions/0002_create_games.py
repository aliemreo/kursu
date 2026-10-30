"""create games, debate sessions, turns and verdicts

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "games",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("current_session", sa.Integer(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("final_score", sa.Float(), nullable=True),
        created_at(),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_games_owner_id", "games", ["owner_id"])
    op.create_table(
        "debate_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "game_id", sa.Uuid(), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("session_no", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("player_side", sa.String(length=8), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("max_rounds", sa.Integer(), nullable=False),
        sa.UniqueConstraint("game_id", "session_no"),
    )
    op.create_table(
        "turns",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("debate_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("speaker", sa.String(length=16), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("citations", sa.JSON(), nullable=False),
        created_at(),
        sa.UniqueConstraint("session_id", "seq"),
    )
    op.create_table(
        "verdicts",
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("debate_sessions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("qualitative", sa.JSON(), nullable=False),
        sa.Column("quantitative", sa.JSON(), nullable=False),
        sa.Column("applied", sa.Boolean(), nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("metrics_before", sa.JSON(), nullable=False),
        sa.Column("metrics_after", sa.JSON(), nullable=False),
        sa.Column("judge_model", sa.String(length=128), nullable=False),
        created_at(),
    )


def downgrade() -> None:
    op.drop_table("verdicts")
    op.drop_table("turns")
    op.drop_table("debate_sessions")
    op.drop_index("ix_games_owner_id", table_name="games")
    op.drop_table("games")

"""add client_turn_id to turns, so that a resent player turn is stored only once

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing turns keep a null id; null values never collide in a unique constraint.
    with op.batch_alter_table("turns") as batch:
        batch.add_column(sa.Column("client_turn_id", sa.Uuid(), nullable=True))
        batch.create_unique_constraint(
            "uq_turns_session_client_turn", ["session_id", "client_turn_id"]
        )


def downgrade() -> None:
    with op.batch_alter_table("turns") as batch:
        batch.drop_constraint("uq_turns_session_client_turn", type_="unique")
        batch.drop_column("client_turn_id")

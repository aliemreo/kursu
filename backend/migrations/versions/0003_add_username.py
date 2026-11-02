"""add username to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

users = sa.table(
    "users",
    sa.column("id", sa.Uuid()),
    sa.column("username", sa.String(30)),
    sa.column("created_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    # Batch mode, because SQLite (used by the tests) cannot alter a column in place.
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("username", sa.String(length=30), nullable=True))

    # Accounts created before this migration get a placeholder name, so the column can be
    # required. Usernames cannot be changed yet, so these stay until such an endpoint exists.
    connection = op.get_bind()
    ids = connection.execute(
        sa.select(users.c.id).order_by(users.c.created_at, users.c.id)
    ).scalars()
    for no, user_id in enumerate(list(ids), start=1):
        connection.execute(
            users.update().where(users.c.id == user_id).values(username=f"player{no}")
        )

    with op.batch_alter_table("users") as batch:
        batch.alter_column("username", existing_type=sa.String(length=30), nullable=False)
        batch.create_index("ix_users_username", ["username"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_username")
        batch.drop_column("username")

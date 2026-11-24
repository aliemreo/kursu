"""game setup for API contract v0.3: catalog version, topic snapshot, side chosen per session

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-24
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PLACEHOLDER_VERSION = "0.1-placeholder"


def _topic(id: str, title: str, motion: str, for_: str, against: str) -> dict[str, Any]:
    return {
        "id": id,
        "title": title,
        "motion": motion,
        "positions": {"for": for_, "against": against},
    }


# Frozen copy of the placeholder catalog that existing games were created from. Migrations
# must not import app.content, because it changes after them.
PLACEHOLDER_TOPICS = {
    topic["id"]: topic
    for topic in (
        _topic(
            "public-transport",
            "Toplu taşıma",
            "Büyükşehirlerde toplu taşıma öğrencilere ücretsiz olmalıdır.",
            "Ücretsiz toplu taşıma eğitime erişimi kolaylaştırır.",
            "Kaynaklar hat ve sefer sayısını artırmaya ayrılmalıdır.",
        ),
        _topic(
            "renewable-energy",
            "Yenilenebilir enerji",
            "Yeni enerji yatırımlarının yarısı yenilenebilir kaynaklara ayrılmalıdır.",
            "Yenilenebilir enerji dışa bağımlılığı azaltır.",
            "Kota yerine maliyet ve arz güvenliği esas alınmalıdır.",
        ),
        _topic(
            "remote-work",
            "Uzaktan çalışma",
            "Kamuda haftada iki gün uzaktan çalışma hakkı tanınmalıdır.",
            "Uzaktan çalışma verimliliği ve şehir trafiğini iyileştirir.",
            "Kamu hizmetinin yüz yüze sunulması önceliklidir.",
        ),
        _topic(
            "school-meals",
            "Okul yemeği",
            "İlkokullarda tüm öğrencilere ücretsiz öğle yemeği verilmelidir.",
            "Ücretsiz yemek beslenmeyi ve okula devamı artırır.",
            "Destek yalnızca ihtiyacı olan ailelere yöneltilmelidir.",
        ),
        _topic(
            "urban-green",
            "Kentsel yeşil alan",
            "Belediyeler imar planlarında kişi başına asgari yeşil alanı iki katına çıkarmalıdır.",
            "Yeşil alan halk sağlığını ve yaşam kalitesini artırır.",
            "Konut arzı ve arsa maliyetleri öncelikli tutulmalıdır.",
        ),
    )
}

games = sa.table("games", sa.column("catalog_version", sa.String()))
sessions = sa.table(
    "debate_sessions",
    sa.column("id", sa.Uuid()),
    sa.column("topic_id", sa.String()),
    sa.column("topic", sa.JSON()),
    sa.column("player_side", sa.String()),
    sa.column("status", sa.String()),
)


def snapshot(topic_id: str) -> dict[str, Any]:
    # A topic missing from the copy still gets a readable, schema-valid snapshot.
    return PLACEHOLDER_TOPICS.get(topic_id) or _topic(topic_id, topic_id, topic_id, "-", "-")


def upgrade() -> None:
    connection = op.get_bind()

    with op.batch_alter_table("games") as batch:
        batch.add_column(sa.Column("catalog_version", sa.String(length=32), nullable=True))
    connection.execute(games.update().values(catalog_version=PLACEHOLDER_VERSION))
    with op.batch_alter_table("games") as batch:
        batch.alter_column("catalog_version", existing_type=sa.String(length=32), nullable=False)

    with op.batch_alter_table("debate_sessions") as batch:
        batch.add_column(sa.Column("topic", sa.JSON(), nullable=True))
        # The v0.3 status names are up to 19 characters long.
        batch.alter_column(
            "status", existing_type=sa.String(length=16), type_=sa.String(length=24)
        )
        # Null until the player chooses a side.
        batch.alter_column("player_side", existing_type=sa.String(length=8), nullable=True)

    for session_id, topic_id in connection.execute(sa.select(sessions.c.id, sessions.c.topic_id)):
        connection.execute(
            sessions.update().where(sessions.c.id == session_id).values(topic=snapshot(topic_id))
        )
    # A v0.2 session in progress always had a side and waited for the player's next turn.
    connection.execute(
        sessions.update()
        .where(sessions.c.status == "in_progress")
        .values(status="awaiting_player")
    )

    with op.batch_alter_table("debate_sessions") as batch:
        batch.alter_column("topic", existing_type=sa.JSON(), nullable=False)


def downgrade() -> None:
    connection = op.get_bind()
    # v0.2 needs a side for every session and knows only pending, in_progress and finished.
    connection.execute(
        sessions.update().where(sessions.c.player_side.is_(None)).values(player_side="for")
    )
    connection.execute(
        sessions.update()
        .where(sessions.c.status.not_in(["pending", "finished"]))
        .values(status="in_progress")
    )

    with op.batch_alter_table("debate_sessions") as batch:
        batch.alter_column("player_side", existing_type=sa.String(length=8), nullable=False)
        batch.alter_column(
            "status", existing_type=sa.String(length=24), type_=sa.String(length=16)
        )
        batch.drop_column("topic")

    with op.batch_alter_table("games") as batch:
        batch.drop_column("catalog_version")

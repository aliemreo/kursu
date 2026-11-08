"""Migrations run on a throwaway SQLite file, never on DATABASE_URL, so CI needs no database."""

import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Uuid, bindparam, create_engine, inspect, text

import app.models  # noqa: F401  (registers the models on Base.metadata)
from app.config import BACKEND_DIR
from app.db import Base


@pytest.fixture
def alembic_config(tmp_path: Path) -> Config:
    config = Config()
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{tmp_path / 'migrations.db'}")
    return config


def table_names(config: Config) -> set[str]:
    engine = create_engine(config.get_main_option("sqlalchemy.url"))
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_migrations_have_a_single_head(alembic_config: Config) -> None:
    """Two branches that each add a migration must be merged before both reach main."""
    heads = ScriptDirectory.from_config(alembic_config).get_heads()

    assert len(heads) == 1, f"Multiple migration heads: {heads}"


def test_migrations_create_exactly_the_models(alembic_config: Config) -> None:
    """Fails when a model changes without a migration, or a migration without the model."""
    command.upgrade(alembic_config, "head")

    engine = create_engine(alembic_config.get_main_option("sqlalchemy.url"))
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            differences = compare_metadata(context, Base.metadata)
    finally:
        engine.dispose()

    assert differences == []


def test_migrations_downgrade_and_upgrade_again(alembic_config: Config) -> None:
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "base")

    assert table_names(alembic_config) == {"alembic_version"}

    command.upgrade(alembic_config, "head")

    assert set(Base.metadata.tables) <= table_names(alembic_config)


def test_username_migration_names_existing_users(alembic_config: Config) -> None:
    """0003 makes username required, so accounts created before it get a placeholder."""
    command.upgrade(alembic_config, "0002")
    engine = create_engine(alembic_config.get_main_option("sqlalchemy.url"))
    insert = text(
        "INSERT INTO users (id, email, password_hash, created_at) "
        "VALUES (:id, :email, 'hash', :created_at)"
    ).bindparams(bindparam("id", type_=Uuid()))
    # Inserted out of order: names follow the creation date.
    existing = [("b@example.com", "2026-10-02"), ("a@example.com", "2026-10-01")]
    try:
        with engine.begin() as connection:
            for email, created_at in existing:
                connection.execute(
                    insert, {"id": uuid.uuid4(), "email": email, "created_at": created_at}
                )

        command.upgrade(alembic_config, "head")

        with engine.connect() as connection:
            rows = connection.execute(text("SELECT email, username FROM users ORDER BY email"))
            assert rows.all() == [("a@example.com", "player1"), ("b@example.com", "player2")]
    finally:
        engine.dispose()


def test_token_version_migration_starts_existing_users_at_zero(alembic_config: Config) -> None:
    """0004 makes token_version required, so accounts created before it need a value."""
    command.upgrade(alembic_config, "0003")
    engine = create_engine(alembic_config.get_main_option("sqlalchemy.url"))
    insert = text(
        "INSERT INTO users (id, email, username, password_hash, created_at) "
        "VALUES (:id, 'a@example.com', 'a', 'hash', '2026-10-01')"
    ).bindparams(bindparam("id", type_=Uuid()))
    try:
        with engine.begin() as connection:
            connection.execute(insert, {"id": uuid.uuid4()})

        command.upgrade(alembic_config, "head")

        with engine.connect() as connection:
            assert connection.execute(text("SELECT token_version FROM users")).all() == [(0,)]
    finally:
        engine.dispose()

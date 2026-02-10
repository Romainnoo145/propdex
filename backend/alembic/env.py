"""Alembic environment configuration for async SQLAlchemy."""

# IMPORTANT: Alembic migrations require superuser privileges for DDL operations
# (CREATE TABLE, ALTER TABLE, CREATE POLICY, etc.)
# The application runtime uses app_role (RLS enforced) via DATABASE_URL.
# Set MIGRATION_DATABASE_URL in backend/.env to a superuser connection string.
# If MIGRATION_DATABASE_URL is not set, falls back to DATABASE_URL.

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import models so Alembic can detect them for autogenerate
from app.models import Base

# Import settings to get DATABASE_URL
from app.core.config import settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Use migration URL (superuser) for schema changes
# Falls back to DATABASE_URL if MIGRATION_DATABASE_URL is not set
config.set_main_option("sqlalchemy.url", settings.migration_database_url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target_metadata for 'autogenerate' support
target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """Exclude PostGIS system tables from Alembic autogenerate."""
    if type_ == "table" and name in (
        "spatial_ref_sys",
        "geometry_columns",
        "geography_columns",
    ):
        return False
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with the given connection."""
    context.configure(
        connection=connection, target_metadata=target_metadata, include_object=include_object
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in async mode using async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using async engine."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

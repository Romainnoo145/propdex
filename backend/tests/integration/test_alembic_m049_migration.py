"""Alembic up+down smoke test for M049/S01 data_source_status migration.

Runs against propdex_test via Python API. Because alembic.command.upgrade /
downgrade call asyncio.run() internally (project alembic/env.py uses an
async engine) we run them in a worker thread via asyncio.to_thread to avoid
the "asyncio.run() cannot be called from a running event loop" clash with
pytest-asyncio.
"""
import asyncio
import re
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from app.core.config import settings


def _backend_root() -> Path:
    """backend/ root — this file lives at backend/tests/integration/."""
    return Path(__file__).resolve().parents[2]


def _alembic_config() -> Config:
    cfg = Config(str(_backend_root() / "alembic.ini"))
    test_url = settings.DATABASE_URL.replace("/propdex", "/propdex_test")
    cfg.set_main_option("sqlalchemy.url", test_url)
    return cfg


@pytest.mark.asyncio
async def test_upgrade_then_downgrade_clean():
    """Run alembic upgrade head -> verify table -> downgrade -1 -> verify dropped."""
    # Locate the M049 migration file
    versions_dir = _backend_root() / "alembic" / "versions"
    m049_files = list(versions_dir.glob("z0_m049_s01_*.py"))
    assert m049_files, "Migration file z0_m049_s01_* not found"
    m049_revision_file = m049_files[0].read_text()
    match = re.search(r"revision:\s*str\s*=\s*['\"]([^'\"]+)['\"]", m049_revision_file)
    assert match, "Could not parse revision SHA from migration"
    target_revision = match.group(1)
    assert re.match(r"^[a-f0-9]{12}$", target_revision), (
        f"Migration revision SHA looks malformed: {target_revision}"
    )

    test_url = settings.DATABASE_URL.replace("/propdex", "/propdex_test")
    # env.py reads from settings.migration_database_url (->
    # MIGRATION_DATABASE_URL or DATABASE_URL fallback) and overrides
    # sqlalchemy.url at runtime. Monkeypatch both settings to the test DB
    # for the duration of this test.
    orig_db_url = settings.DATABASE_URL
    orig_migration_url = settings.MIGRATION_DATABASE_URL
    settings.DATABASE_URL = test_url
    settings.MIGRATION_DATABASE_URL = test_url
    try:
        alembic_cfg = _alembic_config()

        # Other tests (test_db fixture) drop the full schema with
        # Base.metadata.drop_all but leave the alembic_version table behind.
        # To exercise the migration cleanly from a clean slate we explicitly
        # drop the public schema (cascading away every table) so the full
        # migration chain can replay end-to-end. Wrap in to_thread because
        # alembic.command calls asyncio.run internally.
        reset_engine = create_async_engine(
            test_url,
            pool_pre_ping=False,
            connect_args={"statement_cache_size": 0},
        )
        async with reset_engine.begin() as conn:
            await conn.exec_driver_sql("DROP SCHEMA public CASCADE")
            await conn.exec_driver_sql("CREATE SCHEMA public")
            await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS postgis")
            await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        await reset_engine.dispose()

        # Replay every migration from base -> target so the M049/S01 revision
        # lands on a properly-bootstrapped schema (users table exists for the
        # FK). Pin to the M049/S01 revision specifically — not "head" — so
        # this test stays valid as later migrations stack on top.
        await asyncio.to_thread(command.upgrade, alembic_cfg, target_revision)

        # Verify table + structure
        engine = create_async_engine(
            test_url,
            pool_pre_ping=False,
            connect_args={"statement_cache_size": 0},
        )
        async with engine.connect() as conn:
            has_table = await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).has_table("data_source_status")
            )
            assert has_table, "data_source_status table missing after upgrade"

            cols = await conn.run_sync(
                lambda sync_conn: {
                    c["name"]
                    for c in inspect(sync_conn).get_columns("data_source_status")
                }
            )
            expected = {
                "id", "gemeente_code", "source_key", "status", "last_checked",
                "error_message", "configuratie", "managed_by_user_id",
                "created_at", "updated_at",
            }
            missing = expected - cols
            assert not missing, f"Missing columns: {missing}"

            uqs = await conn.run_sync(
                lambda sync_conn: {
                    uq["name"]
                    for uq in inspect(sync_conn).get_unique_constraints(
                        "data_source_status"
                    )
                }
            )
            assert any(
                "gemeente_source" in n or "gemeente_code" in n for n in uqs
            ), f"UQ on (gemeente_code, source_key) missing. Found UQs: {uqs}"

            indexes = await conn.run_sync(
                lambda sync_conn: {
                    ix["name"]
                    for ix in inspect(sync_conn).get_indexes("data_source_status")
                }
            )
            assert "ix_data_source_status_gemeente_code" in indexes, (
                f"Index missing. Found: {indexes}"
            )

        # Downgrade one step
        await asyncio.to_thread(command.downgrade, alembic_cfg, "-1")
        async with engine.connect() as conn:
            still_exists = await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).has_table("data_source_status")
            )
            assert not still_exists, "data_source_status NOT dropped by downgrade"

        # Restore head so other tests see the new schema
        await asyncio.to_thread(command.upgrade, alembic_cfg, "head")
        await engine.dispose()
    finally:
        settings.DATABASE_URL = orig_db_url
        settings.MIGRATION_DATABASE_URL = orig_migration_url

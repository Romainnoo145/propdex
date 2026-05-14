"""Alembic up+down smoke test for M049/S01 data_source_status migration.

Runs against propdex_test via Python API (not subprocess).
"""
import os
import re
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine

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

    test_url = settings.DATABASE_URL.replace("/propdex", "/propdex_test")
    os.environ["DATABASE_URL"] = test_url  # for alembic env.py if needed
    alembic_cfg = _alembic_config()

    # Upgrade to head
    command.upgrade(alembic_cfg, "head")

    # Verify table + structure
    engine = create_async_engine(
        test_url, pool_pre_ping=False, connect_args={"statement_cache_size": 0},
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
    command.downgrade(alembic_cfg, "-1")
    async with engine.connect() as conn:
        still_exists = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).has_table("data_source_status")
        )
        assert not still_exists, "data_source_status NOT dropped by downgrade"

    # Restore head so other tests see the new schema
    command.upgrade(alembic_cfg, "head")
    await engine.dispose()

    # Sanity: revision SHA pattern looks valid
    assert re.match(r"^[a-f0-9]{12}$", target_revision), (
        f"Migration revision SHA looks malformed: {target_revision}"
    )

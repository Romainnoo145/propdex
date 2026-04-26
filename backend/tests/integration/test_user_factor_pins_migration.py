"""SC#2 stub — Alembic migration creates user_factor_pins table with correct schema.

FAILS until Plan 02 creates backend/alembic/versions/y0_m048_s04_create_user_factor_pins.py.
"""
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_user_factor_pins_table_exists(test_db: AsyncSession) -> None:
    """Table user_factor_pins exists after Alembic upgrade head."""
    result = await test_db.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_name = 'user_factor_pins'")
    )
    rows = result.scalars().all()
    assert len(rows) == 1, "user_factor_pins table must exist after migration"


@pytest.mark.asyncio
async def test_user_factor_pins_columns_present(test_db: AsyncSession) -> None:
    """All required columns present with correct types/constraints."""
    result = await test_db.execute(text(
        "SELECT column_name, data_type, is_nullable "
        "FROM information_schema.columns WHERE table_name = 'user_factor_pins'"
    ))
    cols = {row[0]: (row[1], row[2]) for row in result}
    required = {"id", "organization_id", "user_id", "category",
                "factor_key", "position", "created_at", "updated_at"}
    assert required.issubset(set(cols.keys())), (
        f"Missing columns: {required - set(cols.keys())}"
    )


@pytest.mark.asyncio
async def test_unique_constraint_exists(test_db: AsyncSession) -> None:
    """uq_user_factor_pins_user_cat_key constraint exists."""
    result = await test_db.execute(text(
        "SELECT conname FROM pg_constraint "
        "WHERE conname = 'uq_user_factor_pins_user_cat_key'"
    ))
    assert result.scalar() == "uq_user_factor_pins_user_cat_key"

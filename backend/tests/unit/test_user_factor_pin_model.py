"""PIN-02 stub — UserFactorPin model declaration + UniqueConstraint smoke.

FAILS until Plan 02 creates backend/app/models/user_factor_pin.py.
"""
import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_factor_pin import UserFactorPin  # noqa: F401 — fails until Plan 02


@pytest.mark.asyncio
async def test_user_factor_pin_model_constructs(test_db: AsyncSession, create_test_user) -> None:
    """Model accepts (org_id, user_id, category, factor_key, position) and persists."""
    user, org = await create_test_user()
    pin = UserFactorPin(
        organization_id=org.id,
        user_id=user.id,
        category="potentie",
        factor_key="vrije_grond",
        position=0,
    )
    test_db.add(pin)
    await test_db.commit()
    await test_db.refresh(pin)
    assert isinstance(pin.id, uuid.UUID)
    assert pin.created_at is not None
    assert pin.updated_at is not None  # TimestampMixin gives both


@pytest.mark.asyncio
async def test_unique_constraint_blocks_duplicate_pin(
    test_db: AsyncSession, create_test_user
) -> None:
    """uq_user_factor_pins_user_cat_key prevents duplicate (user_id, category, factor_key)."""
    user, org = await create_test_user()
    pin1 = UserFactorPin(
        organization_id=org.id, user_id=user.id,
        category="potentie", factor_key="vrije_grond", position=0,
    )
    test_db.add(pin1)
    await test_db.commit()

    pin2 = UserFactorPin(
        organization_id=org.id, user_id=user.id,
        category="potentie", factor_key="vrije_grond", position=1,
    )
    test_db.add(pin2)
    with pytest.raises(IntegrityError):
        await test_db.commit()

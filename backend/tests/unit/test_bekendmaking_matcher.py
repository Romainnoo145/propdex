"""Tests for bekendmaking matcher spatial lookup functions."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest


class TestFindParcelAtPoint:
    """Tests for find_parcel_at_point() spatial lookup."""

    @pytest.fixture
    def org_id(self):
        return uuid.uuid4()

    async def test_find_parcel_at_point_found(self, org_id):
        """Returns UUID when a parcel geometry contains the point."""
        from app.services.bekendmaking_matcher import find_parcel_at_point

        expected_id = uuid.uuid4()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = expected_id

        session = AsyncMock()
        session.execute.return_value = mock_result

        result = await find_parcel_at_point(
            x=121348.243,
            y=487347.752,
            session=session,
        )

        assert result == expected_id
        session.execute.assert_awaited_once()

    async def test_find_parcel_at_point_no_match(self, org_id):
        """Returns None when no parcel contains the point."""
        from app.services.bekendmaking_matcher import find_parcel_at_point

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        session = AsyncMock()
        session.execute.return_value = mock_result

        result = await find_parcel_at_point(
            x=0.0,
            y=0.0,
            session=session,
        )

        assert result is None

    async def test_find_parcel_at_point_query_structure(self, org_id):
        """Verify the SQLAlchemy query includes required spatial elements."""
        from app.services.bekendmaking_matcher import find_parcel_at_point

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        session = AsyncMock()
        session.execute.return_value = mock_result

        await find_parcel_at_point(
            x=121348.243,
            y=487347.752,
            session=session,
        )

        session.execute.assert_awaited_once()
        stmt = session.execute.call_args[0][0]

        # Compile the statement to SQL to verify structure
        compiled = stmt.compile(compile_kwargs={"literal_binds": True})
        sql = str(compiled)

        assert "ST_Contains" in sql
        assert "ST_SetSRID" in sql
        assert "ST_MakePoint" in sql
        assert "LIMIT" in sql

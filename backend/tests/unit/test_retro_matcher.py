"""Tests for retro_match_changes_for_gemeente() in bekendmaking_matcher."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def org_id():
    return uuid.uuid4()


@pytest.fixture
def mock_change_record():
    """Create a mock ChangeRecord with address_components."""
    change = MagicMock()
    change.organization_id = uuid.uuid4()
    change.matched_parcel_id = None
    change.external_id = "test-123"
    change.gemeente_naam = "Venlo"
    change.metadata_json = {
        "address_components": {
            "street": "Kerkstraat",
            "huisnummer": 42,
            "postcode": "5911AA",
            "city": "Venlo",
        }
    }
    return change


@pytest.fixture
def mock_session():
    session = AsyncMock()
    return session


@pytest.fixture
def mock_client():
    return AsyncMock()


class TestRetroMatchChangesForGemeente:
    """Tests for retro_match_changes_for_gemeente()."""

    async def test_retro_match_no_unmatched(self, org_id, mock_session, mock_client):
        """Returns 0 when no unmatched changes exist for gemeente."""
        from app.services.bekendmaking_matcher import retro_match_changes_for_gemeente

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        count = await retro_match_changes_for_gemeente(
            gemeente_code="GM0983",
            session=mock_session,
            client=mock_client,
        )

        assert count == 0
        mock_session.execute.assert_awaited_once()

    async def test_retro_match_no_address_components(
        self, org_id, mock_session, mock_client
    ):
        """Returns 0 when unmatched changes have no address_components."""
        from app.services.bekendmaking_matcher import retro_match_changes_for_gemeente

        change_no_addr = MagicMock()
        change_no_addr.matched_parcel_id = None
        change_no_addr.metadata_json = {}  # No address_components

        change_no_street = MagicMock()
        change_no_street.matched_parcel_id = None
        change_no_street.metadata_json = {
            "address_components": {"huisnummer": 42}  # Missing street
        }

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [
            change_no_addr,
            change_no_street,
        ]
        mock_session.execute.return_value = mock_result

        count = await retro_match_changes_for_gemeente(
            gemeente_code="GM0983",
            session=mock_session,
            client=mock_client,
        )

        assert count == 0

    async def test_retro_match_successful_match(
        self, org_id, mock_session, mock_client, mock_change_record
    ):
        """Sets matched_parcel_id and returns 1 when geocode + parcel lookup succeed."""
        from app.services.bekendmaking_matcher import retro_match_changes_for_gemeente

        parcel_uuid = uuid.uuid4()

        # Mock DB query returning one unmatched change
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_change_record]
        mock_session.execute.return_value = mock_result

        with (
            patch(
                "app.services.bekendmaking_matcher.PDOKLocatieserver"
            ) as mock_locatieserver_cls,
            patch(
                "app.services.bekendmaking_matcher.find_parcel_at_point",
                new_callable=AsyncMock,
            ) as mock_find_parcel,
        ):
            mock_locatieserver = AsyncMock()
            mock_locatieserver.geocode_address.return_value = (121348.0, 487347.0)
            mock_locatieserver_cls.return_value = mock_locatieserver

            mock_find_parcel.return_value = parcel_uuid

            count = await retro_match_changes_for_gemeente(
                gemeente_code="GM0983",
                session=mock_session,
                client=mock_client,
            )

        assert count == 1
        assert mock_change_record.matched_parcel_id == parcel_uuid
        mock_session.add.assert_called_with(mock_change_record)
        mock_session.flush.assert_awaited_once()

    async def test_retro_match_geocode_fails(
        self, org_id, mock_session, mock_client, mock_change_record
    ):
        """Returns 0 when PDOK geocoding returns None."""
        from app.services.bekendmaking_matcher import retro_match_changes_for_gemeente

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_change_record]
        mock_session.execute.return_value = mock_result

        with patch(
            "app.services.bekendmaking_matcher.PDOKLocatieserver"
        ) as mock_locatieserver_cls:
            mock_locatieserver = AsyncMock()
            mock_locatieserver.geocode_address.return_value = None  # Geocode fails
            mock_locatieserver_cls.return_value = mock_locatieserver

            count = await retro_match_changes_for_gemeente(
                gemeente_code="GM0983",
                session=mock_session,
                client=mock_client,
            )

        assert count == 0
        assert mock_change_record.matched_parcel_id is None
        mock_session.flush.assert_not_awaited()

    async def test_retro_match_no_parcel_found(
        self, org_id, mock_session, mock_client, mock_change_record
    ):
        """Returns 0 when geocode succeeds but no parcel contains the point."""
        from app.services.bekendmaking_matcher import retro_match_changes_for_gemeente

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_change_record]
        mock_session.execute.return_value = mock_result

        with (
            patch(
                "app.services.bekendmaking_matcher.PDOKLocatieserver"
            ) as mock_locatieserver_cls,
            patch(
                "app.services.bekendmaking_matcher.find_parcel_at_point",
                new_callable=AsyncMock,
            ) as mock_find_parcel,
        ):
            mock_locatieserver = AsyncMock()
            mock_locatieserver.geocode_address.return_value = (121348.0, 487347.0)
            mock_locatieserver_cls.return_value = mock_locatieserver

            mock_find_parcel.return_value = None  # No parcel at point

            count = await retro_match_changes_for_gemeente(
                gemeente_code="GM0983",
                session=mock_session,
                client=mock_client,
            )

        assert count == 0
        assert mock_change_record.matched_parcel_id is None
        mock_session.flush.assert_not_awaited()

    async def test_retro_match_respects_limit(
        self, org_id, mock_session, mock_client
    ):
        """The query uses .limit(200) to cap the number of candidates processed."""
        from app.services.bekendmaking_matcher import retro_match_changes_for_gemeente

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        await retro_match_changes_for_gemeente(
            gemeente_code="GM0983",
            session=mock_session,
            client=mock_client,
        )

        # Verify query was built with LIMIT 200
        stmt = mock_session.execute.call_args[0][0]
        compiled = stmt.compile(compile_kwargs={"literal_binds": True})
        sql = str(compiled)

        assert "200" in sql  # LIMIT 200

    async def test_retro_match_invalid_huisnummer_skipped(
        self, org_id, mock_session, mock_client
    ):
        """Skips records where huisnummer cannot be converted to int."""
        from app.services.bekendmaking_matcher import retro_match_changes_for_gemeente

        change_bad_nr = MagicMock()
        change_bad_nr.matched_parcel_id = None
        change_bad_nr.external_id = "bad-nr-456"
        change_bad_nr.gemeente_naam = "Venlo"
        change_bad_nr.metadata_json = {
            "address_components": {
                "street": "Kerkstraat",
                "huisnummer": "niet-een-nummer",
                "postcode": "5911AA",
            }
        }

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [change_bad_nr]
        mock_session.execute.return_value = mock_result

        with patch(
            "app.services.bekendmaking_matcher.PDOKLocatieserver"
        ) as mock_locatieserver_cls:
            mock_locatieserver = AsyncMock()
            mock_locatieserver_cls.return_value = mock_locatieserver

            count = await retro_match_changes_for_gemeente(
                gemeente_code="GM0983",
                session=mock_session,
                client=mock_client,
            )

        assert count == 0
        # geocode_address should NOT be called since huisnummer conversion fails
        mock_locatieserver.geocode_address.assert_not_awaited()

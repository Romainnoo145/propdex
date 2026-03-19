"""Integration tests for BRK strip-before-save and re-fetch-on-view enforcement.

Tests prove BRK-04 compliance:
- brk_ownership is stripped from report_data before JSONB persist
- fetch_brk_ownership handles all three degradation scenarios gracefully
- Error/unavailable states never raise, always return BRKOwnership
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.government_apis.base import GovernmentAPIError
from app.models.organization import Organization
from app.reports import service
from app.schemas.brk_ownership import PerceelOwnership
from app.schemas.property import CadastralParcel
from app.services.property_aggregator import fetch_brk_ownership


def _make_report_data_with_brk(
    straat: str = "Keizersgracht",
    huisnummer: int = 42,
    postcode: str = "1234 AB",
    woonplaats: str = "Amsterdam",
    with_percelen: bool = False,
) -> dict:
    """Create a PropertyReportResponse-compatible dict including BRK ownership data."""
    cadastral_parcels = []
    if with_percelen:
        cadastral_parcels = [
            {
                "identificatie": "NL.IMKAD.KadastraalObject.12345678",
                "kadastrale_aanduiding": "ASD04 S 12345",
                "perceelnummer": "12345",
                "sectie": "S",
                "oppervlakte": 150,
                "geometry": None,
            }
        ]

    return {
        "address": {
            "nummeraanduiding_id": "0363200000406628",
            "straat": straat,
            "straatnaam": straat,
            "huisnummer": huisnummer,
            "postcode": postcode,
            "woonplaats": woonplaats,
        },
        "building": None,
        "cadastral_parcels": cadastral_parcels,
        "completeness_score": 0.85,
        "resolved_at": datetime.utcnow().isoformat() + "Z",
        "data_sources": [],
        "errors": [],
        "zoning": None,
        "monuments": None,
        "map_data": None,
        "section_sources": [],
        "ai_parsing": None,
        "energy_label": None,
        "woz_data": None,
        "brk_ownership": {
            "status": "available",
            "data": [
                {
                    "perceel_identificatie": "NL.IMKAD.KadastraalObject.12345678",
                    "gerechtigden": [
                        {
                            "eigenaar_type": "rechtspersoon",
                            "zakelijk_recht_type": "Eigendom (recht van)",
                            "aandeel": "1/1",
                        }
                    ],
                    "heeft_hypotheek": False,
                }
            ],
            "reason": None,
            "fetched_at": "2026-02-24T06:00:00Z",
            "admin_hint": None,
        },
    }


@pytest.fixture
async def org_id(test_db):
    """Create a test organization and return its ID."""
    org = Organization(name="BRK Wiring Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id


@pytest.fixture
async def user_id(test_db, org_id):
    """Create a test user and return its ID."""
    from app.auth.password import hash_password
    from app.models.user import User
    user = User(
        email="brk@test.com",
        hashed_password=hash_password("Test123!"),
        full_name="BRK Test User",
        organization_id=org_id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    await test_db.commit()
    return user.id


@pytest.mark.asyncio
async def test_save_report_strips_brk_ownership(test_db, org_id, user_id):
    """save_report() must strip brk_ownership from report_data before JSONB persist.

    BRK-04: eigendomsdata must never be stored in the database.
    """
    report_data = _make_report_data_with_brk()

    # Confirm brk_ownership is present in input
    assert report_data["brk_ownership"]["status"] == "available"

    report = await service.save_report(
        report_data=report_data,
        notes=None,
        project_id=None,
        user_id=user_id,
        organization_id=org_id,
        session=test_db,
    )

    # Stored report_data must NOT contain brk_ownership
    stored = report.report_data
    assert "brk_ownership" not in stored or stored.get("brk_ownership") is None, (
        "brk_ownership must be stripped from stored JSONB — Kadaster Tier 3 prohibition"
    )


@pytest.mark.asyncio
async def test_update_report_data_strips_brk_ownership(test_db, org_id, user_id):
    """update_report_data() must strip brk_ownership from report_data before JSONB persist.

    BRK-04: eigendomsdata must never be stored in the database.
    """
    # First create a report (without BRK data)
    initial_data = _make_report_data_with_brk()
    report = await service.save_report(
        report_data=initial_data,
        notes=None,
        project_id=None,
        user_id=user_id,
        organization_id=org_id,
        session=test_db,
    )

    # Confirm initial save stripped BRK
    assert "brk_ownership" not in report.report_data or report.report_data.get("brk_ownership") is None

    # Now update with fresh data that includes BRK
    fresh_data = _make_report_data_with_brk(straat="Prinsengracht", huisnummer=100)
    fresh_data["brk_ownership"]["data"][0]["gerechtigden"][0]["eigenaar_type"] = "natuurlijk_persoon"

    updated_report = await service.update_report_data(
        report_id=report.id,
        user_id=user_id,
        organization_id=org_id,
        fresh_data=fresh_data,
        session=test_db,
    )

    # Updated report_data must NOT contain brk_ownership either
    stored = updated_report.report_data
    assert "brk_ownership" not in stored or stored.get("brk_ownership") is None, (
        "brk_ownership must be stripped from updated JSONB — Kadaster Tier 3 prohibition"
    )


@pytest.mark.asyncio
async def test_brk_unavailable_when_not_configured():
    """fetch_brk_ownership returns unavailable when BRK client is not configured.

    BRK-05: graceful degradation when PKIOverheid certificate not configured.
    """
    parcels = [CadastralParcel(identificatie="NL.IMKAD.KadastraalObject.12345678")]

    with patch("app.services.property_aggregator.brk_client") as mock_client:
        mock_client.is_configured = False

        result = await fetch_brk_ownership(parcels)

    assert result.status == "unavailable"
    assert result.admin_hint is not None
    assert result.data is None


@pytest.mark.asyncio
async def test_brk_unavailable_when_no_perceel_ids():
    """fetch_brk_ownership returns unavailable when no parcels have identificatie.

    BRK percelen without identificatie cannot be looked up in BRK Bevragen V2.
    """
    # Parcels without identificatie (identificatie=None)
    parcels = [
        CadastralParcel(
            kadastrale_aanduiding="ASD04 S 12345",
            perceelnummer="12345",
            sectie="S",
        )
    ]

    with patch("app.services.property_aggregator.brk_client") as mock_client:
        mock_client.is_configured = True

        result = await fetch_brk_ownership(parcels)

    assert result.status == "unavailable"
    assert result.reason is not None
    assert "perceel" in result.reason.lower()


@pytest.mark.asyncio
async def test_brk_error_on_api_failure():
    """fetch_brk_ownership returns error status when BRK API call fails.

    Never raises — always returns BRKOwnership with status='error'.
    """
    parcels = [CadastralParcel(identificatie="NL.IMKAD.KadastraalObject.12345678")]

    with patch("app.services.property_aggregator.brk_client") as mock_client:
        mock_client.is_configured = True

        # Mock create_client() as async context manager
        mock_async_client = AsyncMock()
        mock_context_manager = MagicMock()
        mock_context_manager.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_context_manager.__aexit__ = AsyncMock(return_value=False)
        mock_client.create_client.return_value = mock_context_manager

        # Mock get_eigendom() to raise GovernmentAPIError
        mock_client.get_eigendom = AsyncMock(
            side_effect=GovernmentAPIError("brk", "BRK API timeout", status_code=503)
        )

        result = await fetch_brk_ownership(parcels)

    assert result.status == "error"
    assert result.reason is not None
    assert len(result.reason) > 0


@pytest.mark.asyncio
async def test_brk_available_with_mock_data():
    """fetch_brk_ownership returns available status with parsed ownership data.

    Proves end-to-end parsing of BRK V2 response format.
    """
    parcels = [CadastralParcel(identificatie="NL.IMKAD.KadastraalObject.12345678")]

    # Valid BRK V2 response format
    mock_brk_response = {
        "_embedded": {
            "zakelijkGerechtigden": [
                {
                    "persoon": {"type": "NatuurlijkPersoon"},
                    "type": "Eigendom (recht van)",
                    "aandeel": {"teller": 1, "noemer": 1},
                }
            ]
        }
    }

    with patch("app.services.property_aggregator.brk_client") as mock_client:
        mock_client.is_configured = True

        # Mock create_client() as async context manager
        mock_async_client = AsyncMock()
        mock_context_manager = MagicMock()
        mock_context_manager.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_context_manager.__aexit__ = AsyncMock(return_value=False)
        mock_client.create_client.return_value = mock_context_manager

        # Mock get_eigendom() to return valid response
        mock_client.get_eigendom = AsyncMock(return_value=mock_brk_response)

        result = await fetch_brk_ownership(parcels)

    assert result.status == "available"
    assert result.data is not None
    assert len(result.data) == 1

    perceel_ownership = result.data[0]
    assert isinstance(perceel_ownership, PerceelOwnership)
    assert perceel_ownership.perceel_identificatie == "NL.IMKAD.KadastraalObject.12345678"
    assert len(perceel_ownership.gerechtigden) == 1
    assert perceel_ownership.gerechtigden[0].eigenaar_type == "natuurlijk_persoon"
    assert perceel_ownership.gerechtigden[0].zakelijk_recht_type == "Eigendom (recht van)"
    assert perceel_ownership.gerechtigden[0].aandeel == "1/1"
    assert result.fetched_at is not None

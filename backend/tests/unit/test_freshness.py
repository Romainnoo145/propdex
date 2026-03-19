"""Unit tests for report freshness detection module."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.cached_response import CachedAPIResponse
from app.models.organization import Organization
from app.models.report import SavedReport
from app.reports.freshness import check_report_freshness


@pytest.fixture
async def org_with_threshold(test_db: AsyncSession):
    """Create organization with custom freshness threshold."""
    org = Organization(name="Freshness Test Org", freshness_threshold_hours=24)
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org


@pytest.fixture
async def test_user(test_db: AsyncSession, org_with_threshold: Organization):
    """Create a test user in the org."""
    from app.auth.password import hash_password
    from app.models.user import User
    user = User(
        email="freshness@test.com",
        hashed_password=hash_password("Test123!"),
        full_name="Freshness User",
        organization_id=org_with_threshold.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    await test_db.commit()
    return user


def _make_report_with_sources(user_id: uuid.UUID, section_sources: list[dict]) -> SavedReport:
    """Helper to create SavedReport with specific section_sources."""
    return SavedReport(
        user_id=user_id,
        report_name="Test Report",
        postcode="1234AB",
        city="Amsterdam",
        report_data={"section_sources": section_sources},
    )


class TestFreshnessThresholdLogic:
    """Tests for freshness threshold comparison logic."""

    async def test_freshness_exceeds_threshold_flags_update(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that section with stale data (exceeds threshold) is flagged for update."""
        # Report cached 48 hours ago
        saved_at = datetime.utcnow() - timedelta(hours=48)
        section_sources = [
            {
                "section": "zoning",
                "cached_at": saved_at.isoformat() + "Z",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        # Create fresh cache entry (fetched now)
        cache = CachedAPIResponse(
            cache_key="dso:plan123",
            source="dso",
            response_data={"data": "fresh"},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400,
        )
        test_db.add(cache)
        await test_db.commit()

        # Check freshness
        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        assert result["has_updates"] is True
        assert len(result["updated_sections"]) == 1

        updated_section = result["updated_sections"][0]
        assert updated_section["section"] == "zoning"
        assert updated_section["age_hours"] >= 24  # Exceeds 24h threshold

    async def test_freshness_within_threshold_no_update(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that section with fresh data (within threshold) is not flagged."""
        # Org has 24h threshold, but let's set it to 48h for this test
        org_with_threshold.freshness_threshold_hours = 48
        test_db.add(org_with_threshold)
        await test_db.commit()

        # Report cached 12 hours ago
        saved_at = datetime.utcnow() - timedelta(hours=12)
        section_sources = [
            {
                "section": "zoning",
                "cached_at": saved_at.isoformat() + "Z",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        # Cache entry is 24 hours old (age diff = 12h, less than 48h threshold)
        cache = CachedAPIResponse(
            cache_key="dso:plan123",
            source="dso",
            response_data={"data": "moderate"},
            fetched_at=datetime.utcnow() - timedelta(hours=24),
            ttl_seconds=86400,
        )
        test_db.add(cache)
        await test_db.commit()

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        assert result["has_updates"] is False
        assert len(result["updated_sections"]) == 0

    async def test_multiple_sections_mixed_freshness(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that only stale sections are flagged when multiple sections exist."""
        now = datetime.utcnow()

        # Zoning is stale (48h old), monuments are fresh (6h old)
        section_sources = [
            {
                "section": "zoning",
                "cached_at": (now - timedelta(hours=48)).isoformat() + "Z",
            },
            {
                "section": "monuments",
                "cached_at": (now - timedelta(hours=6)).isoformat() + "Z",
            },
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        # Fresh zoning cache (fetched now)
        cache_zoning = CachedAPIResponse(
            cache_key="dso:plan123",
            source="dso",
            response_data={"data": "fresh"},
            fetched_at=now,
            ttl_seconds=86400,
        )
        test_db.add(cache_zoning)

        # Fresh monuments cache (fetched now)
        cache_monuments = CachedAPIResponse(
            cache_key="rce:monument456",
            source="rce",
            response_data={"data": "fresh"},
            fetched_at=now,
            ttl_seconds=86400,
        )
        test_db.add(cache_monuments)
        await test_db.commit()

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        assert result["has_updates"] is True
        assert len(result["updated_sections"]) == 1
        assert result["updated_sections"][0]["section"] == "zoning"

    async def test_org_custom_threshold_respected(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that organization-specific threshold is used correctly."""
        # Set custom threshold of 72 hours
        org_with_threshold.freshness_threshold_hours = 72
        test_db.add(org_with_threshold)
        await test_db.commit()

        # Report cached 50 hours ago
        saved_at = datetime.utcnow() - timedelta(hours=50)
        section_sources = [
            {
                "section": "zoning",
                "cached_at": saved_at.isoformat() + "Z",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        # Fresh cache (fetched now)
        cache = CachedAPIResponse(
            cache_key="dso:plan123",
            source="dso",
            response_data={"data": "fresh"},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400,
        )
        test_db.add(cache)
        await test_db.commit()

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        # Age diff is ~50h, threshold is 72h, so NOT flagged
        assert result["has_updates"] is False
        assert len(result["updated_sections"]) == 0

    async def test_min_threshold_enforced(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that system minimum threshold is enforced even when org sets lower."""
        # Set org threshold below system minimum (system min is 1 hour)
        org_with_threshold.freshness_threshold_hours = 0
        test_db.add(org_with_threshold)
        await test_db.commit()

        # Report cached 2 hours ago
        saved_at = datetime.utcnow() - timedelta(hours=2)
        section_sources = [
            {
                "section": "zoning",
                "cached_at": saved_at.isoformat() + "Z",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        # Fresh cache (fetched now)
        cache = CachedAPIResponse(
            cache_key="dso:plan123",
            source="dso",
            response_data={"data": "fresh"},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400,
        )
        test_db.add(cache)
        await test_db.commit()

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        # Age diff is 2h, system min is 1h, so it SHOULD be flagged
        assert result["has_updates"] is True
        assert len(result["updated_sections"]) == 1

    async def test_no_organization_uses_default_threshold(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that default threshold is used when organization doesn't exist.

        With shared cache, the cache entry is found regardless of org.
        A non-existent org falls back to the default threshold (24h).
        Report saved 30h ago + fresh cache now → age ~30h > 24h default → has_updates.
        """
        # Report cached 30 hours ago
        saved_at = datetime.utcnow() - timedelta(hours=30)
        section_sources = [
            {
                "section": "zoning",
                "cached_at": saved_at.isoformat() + "Z",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        # Fresh cache (fetched now) — shared, visible to all callers
        cache = CachedAPIResponse(
            cache_key="dso:plan123",
            source="dso",
            response_data={"data": "fresh"},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400,
        )
        test_db.add(cache)
        await test_db.commit()

        # Query with a non-existent org → default threshold (24h)
        # Cache is shared, so the entry IS found. Age ~30h > 24h → has_updates
        fake_org_id = uuid.uuid4()
        result = await check_report_freshness(report, fake_org_id, test_db)

        assert result["has_updates"] is True
        assert len(result["updated_sections"]) == 1
        assert result["updated_sections"][0]["section"] == "zoning"


class TestEdgeCases:
    """Tests for edge case handling."""

    async def test_missing_cached_at_in_section_skips(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that section without cached_at timestamp is skipped."""
        section_sources = [
            {
                "section": "zoning",
                # Missing "cached_at" key
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()
        await test_db.commit()

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        assert result["has_updates"] is False
        assert len(result["updated_sections"]) == 0

    async def test_no_cache_entry_for_section_skips(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that section with no matching cache entry is skipped."""
        saved_at = datetime.utcnow() - timedelta(hours=48)
        section_sources = [
            {
                "section": "zoning",
                "cached_at": saved_at.isoformat() + "Z",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()
        await test_db.commit()

        # No cache entry created

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        assert result["has_updates"] is False
        assert len(result["updated_sections"]) == 0

    async def test_invalid_iso_timestamp_skips(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that section with invalid ISO timestamp is skipped gracefully."""
        section_sources = [
            {
                "section": "zoning",
                "cached_at": "not-a-date",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        # Create cache entry
        cache = CachedAPIResponse(
            cache_key="dso:plan123",
            source="dso",
            response_data={"data": "fresh"},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400,
        )
        test_db.add(cache)
        await test_db.commit()

        # Should not crash
        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        assert result["has_updates"] is False
        assert len(result["updated_sections"]) == 0


class TestSectionToCacheMapping:
    """Tests for section-to-cache-key mapping."""

    async def test_section_to_cache_mapping_all_sections(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that all section types map to correct cache key patterns."""
        now = datetime.utcnow()
        saved_at = now - timedelta(hours=30)

        # Create report with multiple section types
        section_sources = [
            {"section": "zoning", "cached_at": saved_at.isoformat() + "Z"},
            {"section": "monuments", "cached_at": saved_at.isoformat() + "Z"},
            {"section": "address", "cached_at": saved_at.isoformat() + "Z"},
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        # Create matching cache entries for each section type
        cache_zoning = CachedAPIResponse(
            cache_key="dso:plan123",
            source="dso",
            response_data={"data": "zoning"},
            fetched_at=now,
            ttl_seconds=86400,
        )
        test_db.add(cache_zoning)

        cache_monuments = CachedAPIResponse(
            cache_key="rce:monument456",
            source="rce",
            response_data={"data": "monuments"},
            fetched_at=now,
            ttl_seconds=86400,
        )
        test_db.add(cache_monuments)

        cache_address = CachedAPIResponse(
            cache_key="bag:address789",
            source="bag",
            response_data={"data": "address"},
            fetched_at=now,
            ttl_seconds=86400,
        )
        test_db.add(cache_address)
        await test_db.commit()

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        # All three sections exceed 24h threshold (saved 30h ago, fetched now)
        assert result["has_updates"] is True
        assert len(result["updated_sections"]) == 3

        section_names = {s["section"] for s in result["updated_sections"]}
        assert section_names == {"zoning", "monuments", "address"}

    async def test_cadastral_section_mapping(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that cadastral section maps to pdok_cadastral cache pattern."""
        saved_at = datetime.utcnow() - timedelta(hours=30)
        section_sources = [
            {
                "section": "cadastral",
                "cached_at": saved_at.isoformat() + "Z",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        cache = CachedAPIResponse(
            cache_key="pdok_cadastral:parcel123",
            source="pdok_cadastral",
            response_data={"data": "cadastral"},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400,
        )
        test_db.add(cache)
        await test_db.commit()

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        assert result["has_updates"] is True
        assert result["updated_sections"][0]["section"] == "cadastral"

    async def test_building_section_mapping(
        self, test_db: AsyncSession, org_with_threshold: Organization, test_user
    ):
        """Test that building section maps to bag cache pattern."""
        saved_at = datetime.utcnow() - timedelta(hours=30)
        section_sources = [
            {
                "section": "building",
                "cached_at": saved_at.isoformat() + "Z",
            }
        ]

        report = _make_report_with_sources(test_user.id, section_sources)
        test_db.add(report)
        await test_db.flush()

        cache = CachedAPIResponse(
            cache_key="bag:building456",
            source="bag",
            response_data={"data": "building"},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400,
        )
        test_db.add(cache)
        await test_db.commit()

        result = await check_report_freshness(report, org_with_threshold.id, test_db)

        assert result["has_updates"] is True
        assert result["updated_sections"][0]["section"] == "building"

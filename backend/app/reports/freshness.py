"""Data freshness detection for saved reports."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.cached_response import CachedAPIResponse
from app.models.organization import Organization
from app.models.report import SavedReport


async def check_report_freshness(
    report: SavedReport,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> dict:
    """
    Check if saved report has fresher data available in cache.

    Compares saved snapshot timestamps with latest cache entries for each section.
    Uses the organization's freshness threshold (with system minimum enforced):
    sections with cache data more than threshold hours newer than the saved
    snapshot are flagged as having updates available.

    Args:
        report: SavedReport instance with report_data JSONB
        organization_id: Tenant ID for cache queries
        session: Database session

    Returns:
        dict compatible with ReportFreshnessResponse:
            {
                "report_id": uuid,
                "has_updates": bool,
                "updated_sections": [
                    {
                        "section": str,
                        "saved_at": str (ISO timestamp),
                        "latest_at": str (ISO timestamp),
                        "age_hours": int
                    }
                ]
            }
    """
    # Query organization for freshness threshold
    org_stmt = select(Organization).where(Organization.id == organization_id)
    org_result = await session.execute(org_stmt)
    organization = org_result.scalar_one_or_none()

    if organization:
        threshold_hours = max(
            organization.freshness_threshold_hours,
            settings.MIN_FRESHNESS_THRESHOLD_HOURS,
        )
    else:
        threshold_hours = max(24, settings.MIN_FRESHNESS_THRESHOLD_HOURS)

    # Extract section sources from report_data
    section_sources = report.report_data.get("section_sources", [])

    updated_sections = []

    # Section-to-cache-key mapping
    section_to_cache_pattern = {
        "address": ["bag", "pdok_locatieserver"],
        "building": ["bag"],
        "cadastral": ["pdok_cadastral"],
        "zoning": ["dso"],
        "monuments": ["rce"],
        "ai_parsing": ["ai_parsed"],
    }

    for section_source in section_sources:
        section_name = section_source.get("section", "")
        saved_cached_at = section_source.get("cached_at")

        if not saved_cached_at:
            # No timestamp in saved snapshot, skip
            continue

        # Get cache patterns for this section
        cache_patterns = section_to_cache_pattern.get(section_name, [])

        if not cache_patterns:
            continue

        # Query latest cache entry for this section
        # Build OR conditions for each pattern
        latest_cache = None

        for pattern in cache_patterns:
            stmt = (
                select(CachedAPIResponse)
                .where(
                    CachedAPIResponse.organization_id == organization_id,
                    CachedAPIResponse.cache_key.ilike(f"%{pattern}%"),
                )
                .order_by(CachedAPIResponse.fetched_at.desc())
                .limit(1)
            )

            result = await session.execute(stmt)
            cache_entry = result.scalar_one_or_none()

            if cache_entry:
                # Use the most recent cache entry found
                if latest_cache is None or cache_entry.fetched_at > latest_cache.fetched_at:
                    latest_cache = cache_entry

        if not latest_cache:
            # No cache entry found for this section
            continue

        # Parse saved timestamp
        try:
            saved_dt = datetime.fromisoformat(saved_cached_at.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            # Invalid timestamp format, skip
            continue

        # Compare timestamps
        latest_dt = latest_cache.fetched_at

        # Calculate age difference in hours
        time_diff = latest_dt - saved_dt
        age_hours = int(time_diff.total_seconds() / 3600)

        # Check if age exceeds organization's threshold
        if age_hours > threshold_hours:
            updated_sections.append(
                {
                    "section": section_name,
                    "saved_at": saved_cached_at,
                    "latest_at": latest_dt.isoformat(),
                    "age_hours": age_hours,
                }
            )

    return {
        "report_id": report.id,
        "has_updates": len(updated_sections) > 0,
        "updated_sections": updated_sections,
    }

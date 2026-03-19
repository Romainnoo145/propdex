"""Change detection service for monitoring permits and zoning changes.

This service provides delta detection logic for two types of changes:
1. New permits from SRU Bekendmakingen API (omgevingsvergunningen)
2. Zoning plan changes via PLU WMS GetCapabilities hash comparison

Used by ARQ background jobs to detect changes since last check and create
ChangeRecord instances for storage.
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.sru_bekendmakingen import sru_client
from app.models.cached_response import CachedAPIResponse
from app.models.change_record import ChangeRecord
from app.services.address_extractor import extract_address_from_title
from app.services.postcode_extractor import extract_postcodes

logger = logging.getLogger(__name__)

# Amsterdam timezone for parsing API dates (SRU uses Europe/Amsterdam)
AMSTERDAM_TZ = ZoneInfo("Europe/Amsterdam")



def parse_api_date(date_str: str) -> datetime:
    """Parse ISO date string from SRU API to naive UTC datetime.

    SRU API returns dates in ISO format (e.g., "2026-02-15" or "2026-02-15T10:30:00").
    Assumes Europe/Amsterdam timezone if no timezone info present.
    Converts to naive UTC datetime following project convention.

    Args:
        date_str: ISO date string from API

    Returns:
        datetime: Naive UTC datetime

    Example:
        >>> parse_api_date("2026-02-15")
        datetime(2026, 2, 15, 0, 0, 0)
        >>> parse_api_date("2026-02-15T10:30:00")
        datetime(2026, 2, 15, 9, 30, 0)  # Converted to UTC
    """
    # Parse the date string (may or may not have time component)
    if "T" in date_str:
        # Full datetime
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    else:
        # Date only
        dt = datetime.fromisoformat(date_str)

    # If naive, assume Amsterdam timezone
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=AMSTERDAM_TZ)

    # Convert to UTC and make naive (project convention)
    dt_utc = dt.astimezone(ZoneInfo("UTC"))
    return dt_utc.replace(tzinfo=None)


async def detect_permit_changes(
    gemeente_naam: str,
    last_checked: datetime,
    client: httpx.AsyncClient,
    session: AsyncSession,
) -> list[ChangeRecord]:
    """Detect new permit changes from SRU Bekendmakingen API.

    Queries SRU for omgevingsvergunningen in the specified gemeente since
    last_checked date. Handles pagination, filters by date, and deduplicates
    against existing ChangeRecord entries.

    Args:
        gemeente_naam: Municipality name (e.g., "Amsterdam")
        last_checked: UTC datetime of last successful check
        client: Shared httpx AsyncClient
        session: Database session for deduplication queries

    Returns:
        list[ChangeRecord]: New permit change records (not yet added to session)

    Example:
        >>> changes = await detect_permit_changes(
        ...     gemeente_naam="Venlo",
        ...     last_checked=datetime(2026, 2, 1),
        ...     client=app.state.http_client,
        ...     session=db,
        ... )
        >>> len(changes)
        5
    """
    logger.info(
        f"Detecting permit changes for {gemeente_naam} since {last_checked.isoformat()}"
    )

    new_records: list[ChangeRecord] = []
    max_records = 100
    start_record = 1

    # Use server-side date filter to avoid fetching thousands of old records
    modified_since = last_checked.strftime("%Y-%m-%d")

    records, total_count = await sru_client.query_by_municipality(
        gemeente=gemeente_naam,
        record_type="Omgevingsvergunning",
        client=client,
        max_records=max_records,
        start_record=start_record,
        modified_since=modified_since,
    )

    logger.info(
        f"SRU returned {len(records)} records (total: {total_count}) for {gemeente_naam} since {modified_since}"
    )

    # Handle pagination if needed (only for date-filtered results)
    all_records = records[:]
    while len(all_records) < total_count and len(records) == max_records:
        start_record += max_records
        records, _ = await sru_client.query_by_municipality(
            gemeente=gemeente_naam,
            record_type="Omgevingsvergunning",
            client=client,
            max_records=max_records,
            start_record=start_record,
            modified_since=modified_since,
        )
        all_records.extend(records)
        logger.info(
            f"Fetched page starting at {start_record}, total now: {len(all_records)}"
        )

    # Secondary client-side date filter (in case server-side filter is date-only, not datetime)
    filtered_records = []
    for record in all_records:
        try:
            record_date = parse_api_date(record["date"])
            if record_date > last_checked:
                filtered_records.append(record)
        except (ValueError, KeyError) as e:
            logger.warning(f"Skipping record with invalid date: {e}")
            continue

    logger.info(
        f"Filtered to {len(filtered_records)} records after {last_checked.isoformat()}"
    )

    if not filtered_records:
        return []

    # Deduplicate against existing ChangeRecord entries
    # Query for all permit external_ids for this gemeente
    existing_ids_query = select(ChangeRecord.external_id).where(
        ChangeRecord.change_type == "permit",
        ChangeRecord.gemeente_naam == gemeente_naam,
    )
    result = await session.execute(existing_ids_query)
    existing_ids = {row[0] for row in result.fetchall()}

    logger.info(f"Found {len(existing_ids)} existing permit records in database")

    # Create ChangeRecord instances for new permits
    for record in filtered_records:
        external_id = record["identifier"]

        # Skip if already exists
        if external_id in existing_ids:
            logger.debug(f"Skipping duplicate permit: {external_id}")
            continue

        # Parse change date
        try:
            change_date = parse_api_date(record["date"])
        except (ValueError, KeyError):
            logger.warning(f"Skipping permit with invalid date: {external_id}")
            continue

        # Extract postcode from title and URL for matching
        postcodes = extract_postcodes(record["title"])
        if not postcodes and record.get("url"):
            postcodes = extract_postcodes(record["url"])
        postcode = postcodes[0] if postcodes else None

        # Extract structured address from title using multi-strategy extractor
        address_data = extract_address_from_title(record["title"])
        address = address_data["full_address"] if address_data else None

        # Merge address components into metadata for Phase 48 parcel matching
        metadata = dict(record)
        if address_data:
            metadata["address_components"] = {
                "street": address_data["street"],
                "huisnummer": address_data["huisnummer"],
                "huisnummer_toevoeging": address_data["huisnummer_toevoeging"],
                "postcode": address_data["postcode"],
                "city": address_data["city"],
            }
            # Fallback: when title/URL parsing missed postcode, use structured address extraction.
            if not postcode and address_data.get("postcode"):
                postcode = str(address_data["postcode"]).upper().replace(" ", "")

        # Create ChangeRecord (caller will add to session)
        change_record = ChangeRecord(
            project_id=None,  # Will be set by caller based on project mapping
            change_type="permit",
            external_id=external_id,
            title=record["title"],
            detected_at=datetime.utcnow(),  # Project convention: naive UTC
            change_date=change_date,
            gemeente_naam=gemeente_naam,
            address=address,
            metadata_json=metadata,
            source_url=record.get("url"),
            postcode=postcode,
        )

        new_records.append(change_record)
        logger.debug(f"Created new permit change record: {external_id}")

    logger.info(
        f"Detected {len(new_records)} new permit changes for {gemeente_naam}"
    )
    return new_records


async def detect_zoning_changes(
    gemeente_code: str,
    last_checked: datetime,
    client: httpx.AsyncClient,
    session: AsyncSession,
    gemeente_naam: str | None = None,
) -> list[ChangeRecord]:
    """Detect zoning plan changes via DSO Ruimtelijke Plannen API v4.

    Queries the DSO API for plans at the gemeente's scan centroid, compares
    against cached plan state, and creates ChangeRecords for:
    - New plans not seen before
    - Plans with changed status (e.g., ontwerp → vastgesteld)
    - Plans with updated datum

    Falls back to coarse WMS hash detection if no scan coordinates available.

    Args:
        gemeente_code: CBS gemeente code (e.g., "0983" or "GM0983")
        last_checked: UTC datetime of last successful check
        client: Shared httpx AsyncClient
        session: Database session for cache and scan queries

    Returns:
        list[ChangeRecord]: Change records for detected plan changes
    """
    from app.government_apis.dso_spatial_plans import get_dso_client
    from app.models.area_scan import AreaScan

    logger.info(
        f"Detecting zoning changes for gemeente {gemeente_code} since {last_checked.isoformat()}"
    )

    # Find a representative coordinate from completed AreaScans for this gemeente
    scan_stmt = (
        select(
            AreaScan.bbox_minx, AreaScan.bbox_miny,
            AreaScan.bbox_maxx, AreaScan.bbox_maxy,
        )
        .where(
            AreaScan.gemeente_code == gemeente_code,
            AreaScan.status == "completed",
        )
        .order_by(AreaScan.completed_at.desc())
        .limit(1)
    )
    scan_result = await session.execute(scan_stmt)
    scan_row = scan_result.one_or_none()

    if not scan_row:
        logger.warning(f"No completed scans for {gemeente_code}, skipping zoning check")
        return []

    # Use bounding box centroid as query point (EPSG:28992 RD New)
    center_x = (scan_row.bbox_minx + scan_row.bbox_maxx) / 2
    center_y = (scan_row.bbox_miny + scan_row.bbox_maxy) / 2

    logger.info(f"Using scan centroid ({center_x:.0f}, {center_y:.0f}) for {gemeente_code}")

    # Query DSO API for plans at this location
    dso_client = get_dso_client()
    try:
        plans = await dso_client.find_plans_at_location(center_x, center_y, client)
    except Exception as e:
        logger.error(f"DSO API query failed for {gemeente_code}: {e}")
        return []

    if not plans:
        logger.info(f"No plans found at centroid for {gemeente_code}")
        return []

    # Build current plan state: {plan_id: {status, datum, naam}}
    current_plans: dict[str, dict] = {}
    for plan in plans:
        plan_id = plan.get("id") or plan.get("identificatie")
        if plan_id:
            # v4 nests status/datum under planstatusInfo
            status_info = plan.get("planstatusInfo", {})
            current_plans[plan_id] = {
                "status": (status_info.get("planstatus") if isinstance(status_info, dict) else plan.get("planStatus")) or "",
                "datum": (status_info.get("datum") if isinstance(status_info, dict) else plan.get("datum")) or "",
                "naam": plan.get("naam", ""),
                "type": plan.get("type") or plan.get("planType", ""),
            }

    logger.info(f"Found {len(current_plans)} plans at centroid for {gemeente_code}")

    # Load cached plan state
    cache_key = f"dso_plan_state:{gemeente_code}"
    cached_query = select(CachedAPIResponse).where(
        CachedAPIResponse.cache_key == cache_key
    )
    cached_result = await session.execute(cached_query)
    cached_response = cached_result.scalar_one_or_none()

    if cached_response is None:
        # First run — store baseline, no changes to report
        logger.info(f"First zoning check for {gemeente_code}, storing {len(current_plans)} plans as baseline")
        new_cache = CachedAPIResponse(
            cache_key=cache_key,
            source="dso_plan_state",
            response_data={"plans": current_plans},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400 * 7,  # 7 days
        )
        session.add(new_cache)
        await session.flush()
        return []

    # Compare against cached state
    stored_plans: dict[str, dict] = cached_response.response_data.get("plans", {})
    new_records: list[ChangeRecord] = []
    now = datetime.utcnow()

    # Detect new plans (not in cached state)
    for plan_id, info in current_plans.items():
        if plan_id not in stored_plans:
            external_id = f"zoning_new:{plan_id}"
            new_records.append(ChangeRecord(
                project_id=None,
                change_type="zoning",
                external_id=external_id,
                title=f"Nieuw plan: {info['naam']} ({info['status']})",
                detected_at=now,
                change_date=now,
                gemeente_naam=gemeente_naam or gemeente_code,
                metadata_json={
                    "plan_id": plan_id,
                    "plan_naam": info["naam"],
                    "plan_status": info["status"],
                    "plan_datum": info["datum"],
                    "plan_type": info["type"],
                    "change": "new_plan",
                },
                source_url=f"https://www.ruimtelijkeplannen.nl/viewer/view?planidn={plan_id}",
            ))
            logger.info(f"  New plan: {plan_id} ({info['naam']})")

    # Detect status/datum changes in existing plans
    for plan_id, info in current_plans.items():
        if plan_id in stored_plans:
            old = stored_plans[plan_id]
            changes_found = []

            if old.get("status") != info["status"]:
                changes_found.append(f"status: {old.get('status')} → {info['status']}")
            if old.get("datum") != info["datum"]:
                changes_found.append(f"datum: {old.get('datum')} → {info['datum']}")

            if changes_found:
                external_id = f"zoning_update:{plan_id}:{now.strftime('%Y%m%d')}"
                change_desc = ", ".join(changes_found)
                new_records.append(ChangeRecord(
                    project_id=None,
                    change_type="zoning",
                    external_id=external_id,
                    title=f"Plan gewijzigd: {info['naam']} ({change_desc})",
                    detected_at=now,
                    change_date=now,
                    gemeente_naam=gemeente_naam or gemeente_code,
                    metadata_json={
                        "plan_id": plan_id,
                        "plan_naam": info["naam"],
                        "old_status": old.get("status"),
                        "new_status": info["status"],
                        "old_datum": old.get("datum"),
                        "new_datum": info["datum"],
                        "change": "plan_updated",
                    },
                    source_url=f"https://www.ruimtelijkeplannen.nl/viewer/view?planidn={plan_id}",
                ))
                logger.info(f"  Plan changed: {plan_id} — {change_desc}")

    # Update cached plan state
    cached_response.response_data = {"plans": current_plans}
    cached_response.fetched_at = now
    await session.flush()

    logger.info(f"Detected {len(new_records)} zoning changes for {gemeente_code}")
    return new_records

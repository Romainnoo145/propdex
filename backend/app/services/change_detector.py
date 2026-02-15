"""Change detection service for monitoring permits and zoning changes.

This service provides delta detection logic for two types of changes:
1. New permits from SRU Bekendmakingen API (omgevingsvergunningen)
2. Zoning plan changes via PLU WMS GetCapabilities hash comparison

Used by ARQ background jobs to detect changes since last check and create
ChangeRecord instances for storage.
"""

import hashlib
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.sru_bekendmakingen import sru_client
from app.models.cached_response import CachedAPIResponse
from app.models.change_record import ChangeRecord

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

    # Fetch first page to get total count
    records, total_count = await sru_client.query_by_municipality(
        gemeente=gemeente_naam,
        record_type="Omgevingsvergunning",
        client=client,
        max_records=max_records,
        start_record=start_record,
    )

    logger.info(
        f"SRU returned {len(records)} records (total: {total_count}) for {gemeente_naam}"
    )

    # Handle pagination if needed
    all_records = records[:]
    while len(all_records) < total_count and len(records) == max_records:
        start_record += max_records
        records, _ = await sru_client.query_by_municipality(
            gemeente=gemeente_naam,
            record_type="Omgevingsvergunning",
            client=client,
            max_records=max_records,
            start_record=start_record,
        )
        all_records.extend(records)
        logger.info(
            f"Fetched page starting at {start_record}, total now: {len(all_records)}"
        )

    # Filter records by date (only keep records after last_checked)
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

        # Create ChangeRecord (caller will add to session)
        change_record = ChangeRecord(
            project_id=None,  # Will be set by caller based on project mapping
            change_type="permit",
            external_id=external_id,
            title=record["title"],
            detected_at=datetime.utcnow(),  # Project convention: naive UTC
            change_date=change_date,
            gemeente_naam=gemeente_naam,
            address=None,  # SRU doesn't provide structured address in basic query
            metadata_json=record,
            source_url=record.get("url"),
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
) -> list[ChangeRecord]:
    """Detect zoning plan changes via PLU WMS GetCapabilities hash comparison.

    Fetches PDOK PLU WMS GetCapabilities XML, computes SHA256 hash, and compares
    against stored hash in CachedAPIResponse. If hash changed, creates a single
    ChangeRecord indicating zoning data was updated.

    Note: This is a coarse-grained change detection (entire WMS layer metadata).
    For fine-grained change detection, would need Ruimtelijkeplannen.nl REST API v4.

    Args:
        gemeente_code: CBS gemeente code (e.g., "GM0983")
        last_checked: UTC datetime of last successful check
        client: Shared httpx AsyncClient
        session: Database session for hash storage

    Returns:
        list[ChangeRecord]: Empty list or single record if hash changed

    Example:
        >>> changes = await detect_zoning_changes(
        ...     gemeente_code="GM0983",
        ...     last_checked=datetime(2026, 2, 1),
        ...     client=app.state.http_client,
        ...     session=db,
        ... )
        >>> len(changes)
        1  # Hash changed
    """
    logger.info(
        f"Detecting zoning changes for gemeente {gemeente_code} since {last_checked.isoformat()}"
    )

    # Fetch PLU WMS GetCapabilities
    plu_wms_url = "https://service.pdok.nl/kadaster/plu/wms/v1_0"
    params = {
        "SERVICE": "WMS",
        "REQUEST": "GetCapabilities",
    }

    try:
        response = await client.get(plu_wms_url, params=params, timeout=30.0)
        if response.status_code != 200:
            logger.error(
                f"PLU WMS GetCapabilities failed with status {response.status_code}"
            )
            return []

        # Compute hash of response content
        content_hash = hashlib.sha256(response.content).hexdigest()
        logger.info(f"PLU WMS GetCapabilities hash: {content_hash[:16]}...")

    except Exception as e:
        logger.error(f"Failed to fetch PLU WMS GetCapabilities: {e}")
        return []

    # Check cached hash
    cache_key = f"plu_capabilities_hash:{gemeente_code}"
    cached_query = select(CachedAPIResponse).where(
        CachedAPIResponse.cache_key == cache_key
    )
    cached_result = await session.execute(cached_query)
    cached_response = cached_result.scalar_one_or_none()

    if cached_response is None:
        # First time checking - store hash but don't create change record
        logger.info(f"No cached hash found for {gemeente_code}, storing initial hash")
        new_cache = CachedAPIResponse(
            cache_key=cache_key,
            source="plu_wms_getcapabilities",
            response_data={"hash": content_hash},
            fetched_at=datetime.utcnow(),
            ttl_seconds=86400,  # 24 hours
        )
        session.add(new_cache)
        await session.flush()
        return []

    # Compare hashes
    stored_hash = cached_response.response_data.get("hash", "")
    if content_hash == stored_hash:
        logger.info(f"PLU WMS hash unchanged for {gemeente_code}")
        return []

    # Hash changed - create change record
    logger.info(
        f"PLU WMS hash changed for {gemeente_code}: {stored_hash[:16]}... -> {content_hash[:16]}..."
    )

    change_date = datetime.utcnow()  # Use current time as change date
    external_id = f"plu_update_{change_date.strftime('%Y%m%d')}"

    change_record = ChangeRecord(
        project_id=None,  # Will be set by caller
        change_type="zoning",
        external_id=external_id,
        title=f"Bestemmingsplan data updated for gemeente {gemeente_code}",
        detected_at=change_date,
        change_date=change_date,
        gemeente_naam=gemeente_code,  # Store code, not name (consistent with cache key)
        address=None,
        metadata_json={
            "old_hash": stored_hash,
            "new_hash": content_hash,
            "detection_method": "wms_getcapabilities_hash",
        },
        source_url=plu_wms_url,
    )

    # Update cached hash
    cached_response.response_data = {"hash": content_hash}
    cached_response.fetched_at = change_date
    await session.flush()

    logger.info(f"Created zoning change record for {gemeente_code}")
    return [change_record]

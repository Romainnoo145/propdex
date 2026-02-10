"""Area scan background job for ARQ worker."""

import asyncio
import logging
import uuid
from datetime import datetime

import httpx
from shapely.geometry import shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.government_apis.bag_wfs import bag_wfs_client
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.services.parcel_scoring import compute_opportunity_score

logger = logging.getLogger(__name__)


async def area_scan_job(
    ctx: dict,
    scan_id: str,
    organization_id: str,
) -> dict:
    """
    Background job: Scan area for parcels, fetch BAG data, compute scores.

    Runs in ARQ worker process. Job state tracked in Redis,
    scan progress and results stored in PostgreSQL.

    Args:
        ctx: ARQ context (contains redis connection, etc.)
        scan_id: AreaScan UUID as string
        organization_id: Tenant UUID as string

    Returns:
        dict with scan_id and status for ARQ result storage
    """
    # Create a new database session (worker runs outside FastAPI)
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        echo=False,
    )
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    scan_uuid = uuid.UUID(scan_id)
    org_id = uuid.UUID(organization_id)
    http_client: httpx.AsyncClient | None = None

    try:
        http_client = httpx.AsyncClient(timeout=30.0)

        async with session_factory() as session:
            # Phase 1: Setup (0% progress)
            logger.info(f"Starting area scan {scan_id} for org {org_id}")

            # Load AreaScan record
            stmt = select(AreaScan).where(
                AreaScan.id == scan_uuid,
                AreaScan.organization_id == org_id,
            )
            result = await session.execute(stmt)
            scan = result.scalar_one_or_none()

            if not scan:
                logger.error(f"AreaScan not found for id={scan_id}, org={org_id}")
                return {"scan_id": scan_id, "status": "error", "error": "Scan not found"}

            # Update status to running
            scan.status = "running"
            scan.started_at = datetime.utcnow()
            scan.current_phase = "fetching_parcels"
            scan.progress_pct = 0
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(f"Scan {scan_id}: fetching parcels from BAG WFS")

            # Phase 2: Fetch parcels (0-30% progress)
            try:
                features = await bag_wfs_client.get_panden_in_bbox(
                    scan.bbox_minx,
                    scan.bbox_miny,
                    scan.bbox_maxx,
                    scan.bbox_maxy,
                    http_client,
                )
            except Exception as e:
                logger.error(f"Scan {scan_id}: BAG WFS fetch failed: {e}")
                scan.status = "failed"
                scan.error_message = f"BAG WFS fetch failed: {str(e)}"
                session.add(scan)
                await session.flush()
                await session.commit()
                return {"scan_id": scan_id, "status": "failed", "error": str(e)}

            scan.parcels_total = len(features)
            scan.progress_pct = 30
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: fetched {len(features)} panden, processing..."
            )

            # Phase 3: Process parcels and cross-reference (30-90% progress)
            scan.current_phase = "cross_referencing_bag"
            session.add(scan)
            await session.flush()
            await session.commit()

            failed_count = 0

            for idx, feature in enumerate(features):
                try:
                    # Upsert parcel into cache
                    parcel = await _upsert_parcel_cache(
                        feature, org_id, scan.gemeente_code, session
                    )

                    # Compute opportunity score
                    score_breakdown = compute_opportunity_score(parcel)

                    # Create ScanResult linking scan to parcel
                    scan_result = ScanResult(
                        organization_id=org_id,
                        scan_id=scan.id,
                        parcel_id=parcel.id,
                        score=score_breakdown.total_score,
                        flags={
                            "category": score_breakdown.category,
                            "factors": score_breakdown.factors,
                        },
                    )
                    session.add(scan_result)

                    # Update progress every 10 parcels
                    if (idx + 1) % 10 == 0 or (idx + 1) == len(features):
                        progress_pct = 30 + int((idx + 1) / len(features) * 60)
                        await _update_scan_progress(
                            scan, "cross_referencing_bag", progress_pct, idx + 1, session
                        )

                except Exception as e:
                    logger.warning(
                        f"Scan {scan_id}: failed to process parcel {idx}: {e}"
                    )
                    failed_count += 1
                    continue

            # Phase 4: Finalize (90-100%)
            scan.current_phase = "querying_bestemmingen"
            scan.progress_pct = 90
            session.add(scan)
            await session.flush()
            await session.commit()

            # Note: DSO queries skipped for MVP (per task instructions)
            # bestemmingen field stays NULL on ParcelCache
            # Add DSO enrichment as on-demand Tier 2 in future phases

            # Mark scan complete
            scan.status = "completed"
            scan.completed_at = datetime.utcnow()
            scan.progress_pct = 100
            scan.parcels_failed = failed_count
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: completed successfully ({scan.parcels_processed} processed, {failed_count} failed)"
            )

            return {"scan_id": scan_id, "status": "completed"}

    except asyncio.CancelledError:
        logger.warning(f"Scan {scan_id}: cancelled by user")
        # Use fresh session to update status (original may be in bad state)
        try:
            async with session_factory() as session:
                stmt = select(AreaScan).where(
                    AreaScan.id == scan_uuid,
                    AreaScan.organization_id == org_id,
                )
                result = await session.execute(stmt)
                scan = result.scalar_one_or_none()
                if scan:
                    scan.status = "cancelled"
                    session.add(scan)
                    await session.flush()
                    await session.commit()
        except Exception as update_error:
            logger.error(f"Failed to update scan status after cancel: {update_error}")

        return {"scan_id": scan_id, "status": "cancelled"}

    except Exception as e:
        logger.exception(f"Unexpected error in area_scan_job for {scan_id}: {e}")
        # Try to update scan status to failed
        try:
            async with session_factory() as session:
                stmt = select(AreaScan).where(
                    AreaScan.id == scan_uuid,
                    AreaScan.organization_id == org_id,
                )
                result = await session.execute(stmt)
                scan = result.scalar_one_or_none()
                if scan:
                    scan.status = "failed"
                    scan.error_message = f"Unexpected error: {str(e)}"
                    session.add(scan)
                    await session.flush()
                    await session.commit()
        except Exception as update_error:
            logger.error(f"Failed to update scan status after error: {update_error}")

        return {"scan_id": scan_id, "status": "error", "error": str(e)}

    finally:
        # Clean up resources
        if http_client:
            await http_client.aclose()
        await engine.dispose()


async def _upsert_parcel_cache(
    feature: dict,
    org_id: uuid.UUID,
    gemeente_code: str | None,
    session: AsyncSession,
) -> ParcelCache:
    """
    Upsert BAG WFS feature into ParcelCache.

    Args:
        feature: GeoJSON feature from BAG WFS with geometry and properties
        org_id: Organization UUID
        gemeente_code: Municipality code for this scan
        session: Database session

    Returns:
        ParcelCache entry (created or updated)
    """
    properties = feature.get("properties", {})
    identificatie = properties.get("identificatie", "")

    # Compute area from geometry
    geometry = feature.get("geometry")
    area_m2 = None
    if geometry:
        try:
            geom_shape = shape(geometry)
            area_m2 = geom_shape.area
        except Exception as e:
            logger.warning(f"Failed to compute area for {identificatie}: {e}")

    # Check if entry already exists
    stmt = select(ParcelCache).where(
        ParcelCache.organization_id == org_id,
        ParcelCache.parcel_id == identificatie,
    )
    result = await session.execute(stmt)
    parcel = result.scalar_one_or_none()

    if parcel:
        # Update existing entry
        parcel.geometry = f"SRID=28992;{geometry}"
        parcel.area_m2 = area_m2
        parcel.has_pand = True  # BAG WFS returns buildings, so building exists
        parcel.gemeente_code = gemeente_code
        parcel.updated_at = datetime.utcnow()
        session.add(parcel)
    else:
        # Create new entry
        parcel = ParcelCache(
            organization_id=org_id,
            parcel_id=identificatie,
            geometry=f"SRID=28992;{geometry}",
            area_m2=area_m2,
            has_pand=True,  # BAG WFS returns buildings
            gemeente_code=gemeente_code,
            bestemmingen=None,  # Will be populated in Tier 2 enrichment
            enrichment_data=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(parcel)

    await session.flush()
    return parcel


async def _update_scan_progress(
    scan: AreaScan,
    phase: str,
    pct: int,
    processed: int,
    session: AsyncSession,
) -> None:
    """
    Update scan progress and commit to database.

    Args:
        scan: AreaScan instance to update
        phase: Current processing phase
        pct: Progress percentage (0-100)
        processed: Number of parcels processed so far
        session: Database session
    """
    scan.current_phase = phase
    scan.progress_pct = pct
    scan.parcels_processed = processed
    session.add(scan)
    await session.flush()
    await session.commit()

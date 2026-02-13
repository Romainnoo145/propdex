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
from app.government_apis.plu_wfs import plu_wms_client
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.services.parcel_scoring import compute_opportunity_score

logger = logging.getLogger(__name__)

# Concurrent WMS GetFeatureInfo requests for bestemmingen
WMS_CONCURRENCY = 15


async def area_scan_job(
    ctx: dict,
    scan_id: str,
    organization_id: str,
) -> dict:
    """
    Background job: Scan area for parcels, fetch bestemmingen, compute scores.

    Pipeline:
        Phase 1 (0-25%):  Fetch BAG panden in bbox
        Phase 2 (25-50%): Fetch bestemmingen per parcel via WMS GetFeatureInfo
        Phase 3 (50-90%): Upsert parcels + compute scores
        Phase 4 (90-100%): Finalize

    Args:
        ctx: ARQ context (contains redis connection, etc.)
        scan_id: AreaScan UUID as string
        organization_id: Tenant UUID as string

    Returns:
        dict with scan_id and status for ARQ result storage
    """
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
            # Load AreaScan record
            logger.info(f"Starting area scan {scan_id} for org {org_id}")

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

            # ── Phase 1: Fetch BAG panden (0-25%) ──
            logger.info(f"Scan {scan_id}: fetching parcels from BAG WFS")

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
            scan.progress_pct = 25
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(f"Scan {scan_id}: fetched {len(features)} panden")

            # ── Phase 2: Fetch bestemmingen per parcel via WMS (25-50%) ──
            scan.current_phase = "fetching_bestemmingen"
            scan.progress_pct = 25
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: fetching bestemmingen via WMS GetFeatureInfo "
                f"({len(features)} parcels, concurrency={WMS_CONCURRENCY})"
            )

            bestemmingen_list = await _batch_fetch_bestemmingen(
                features, http_client
            )

            enriched_count = sum(1 for b in bestemmingen_list if b is not None)
            scan.progress_pct = 50
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: enriched {enriched_count}/{len(features)} "
                f"parcels with bestemmingen"
            )

            # ── Phase 3: Upsert parcels + compute scores (50-90%) ──
            scan.current_phase = "processing_parcels"
            session.add(scan)
            await session.flush()
            await session.commit()

            failed_count = 0

            for idx, (feature, bestemmingen) in enumerate(
                zip(features, bestemmingen_list, strict=True)
            ):
                try:
                    parcel = await _upsert_parcel_cache(
                        feature, org_id, scan.gemeente_code, session,
                        bestemmingen=bestemmingen,
                    )

                    score_breakdown = compute_opportunity_score(parcel)

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
                        progress_pct = 50 + int((idx + 1) / len(features) * 40)
                        await _update_scan_progress(
                            scan, "processing_parcels", progress_pct, idx + 1, session
                        )

                except Exception as e:
                    logger.warning(
                        f"Scan {scan_id}: failed to process parcel {idx}: {e}"
                    )
                    failed_count += 1
                    continue

            # ── Phase 4: Finalize (90-100%) ──
            scan.current_phase = "finalizing"
            scan.progress_pct = 90
            session.add(scan)
            await session.flush()
            await session.commit()

            scan.status = "completed"
            scan.completed_at = datetime.utcnow()
            scan.progress_pct = 100
            scan.parcels_failed = failed_count
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: completed ({scan.parcels_processed} processed, "
                f"{enriched_count} enriched, {failed_count} failed)"
            )

            return {"scan_id": scan_id, "status": "completed"}

    except asyncio.CancelledError:
        logger.warning(f"Scan {scan_id}: cancelled by user")
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
        if http_client:
            await http_client.aclose()
        await engine.dispose()


async def _batch_fetch_bestemmingen(
    features: list[dict],
    client: httpx.AsyncClient,
) -> list[list[dict] | None]:
    """
    Batch-fetch bestemmingen for all parcels using WMS GetFeatureInfo.

    Uses asyncio.Semaphore to limit concurrent requests to PDOK WMS.
    Each parcel's centroid is queried for its bestemmingshoofdgroep.

    Args:
        features: List of GeoJSON features from BAG WFS
        client: Shared httpx AsyncClient

    Returns:
        List aligned with features, each element is bestemmingen list or None.
    """
    semaphore = asyncio.Semaphore(WMS_CONCURRENCY)

    async def fetch_one(feature: dict) -> list[dict] | None:
        async with semaphore:
            geom_data = feature.get("geometry")
            if not geom_data:
                return None
            try:
                geom = shape(geom_data)
                centroid = geom.centroid
                return await plu_wms_client.get_bestemming_at_point(
                    centroid.x, centroid.y, client
                )
            except Exception:
                return None

    return await asyncio.gather(*[fetch_one(f) for f in features])


async def _upsert_parcel_cache(
    feature: dict,
    org_id: uuid.UUID,
    gemeente_code: str | None,
    session: AsyncSession,
    bestemmingen: list[dict] | None = None,
) -> ParcelCache:
    """
    Upsert BAG WFS feature into ParcelCache.

    Args:
        feature: GeoJSON feature from BAG WFS with geometry and properties
        org_id: Organization UUID
        gemeente_code: Municipality code for this scan
        session: Database session
        bestemmingen: Matched bestemmingsplan data from WMS GetFeatureInfo

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

    # Convert GeoJSON geometry to PostGIS geometry
    import json

    from geoalchemy2.functions import ST_GeomFromGeoJSON, ST_Multi, ST_SetSRID
    geojson_str = json.dumps(geometry)
    # BAG WFS returns RD coordinates (EPSG:28992)
    geom_expr = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geojson_str), 28992))

    if parcel:
        parcel.geometry = geom_expr
        parcel.area_m2 = area_m2
        parcel.has_pand = True
        parcel.gemeente_code = gemeente_code
        parcel.bestemmingen = bestemmingen
        parcel.updated_at = datetime.utcnow()
        session.add(parcel)
    else:
        parcel = ParcelCache(
            organization_id=org_id,
            parcel_id=identificatie,
            geometry=geom_expr,
            area_m2=area_m2,
            has_pand=True,
            gemeente_code=gemeente_code,
            bestemmingen=bestemmingen,
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
    """Update scan progress and commit to database."""
    scan.current_phase = phase
    scan.progress_pct = pct
    scan.parcels_processed = processed
    session.add(scan)
    await session.flush()
    await session.commit()

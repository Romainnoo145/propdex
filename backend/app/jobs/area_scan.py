"""Area scan background job for ARQ worker."""

import asyncio
import json
import logging
import uuid
from datetime import datetime

import httpx
from geoalchemy2.functions import ST_GeomFromGeoJSON, ST_Multi, ST_SetSRID
from shapely.geometry import shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.government_apis.bag_wfs import bag_wfs_client
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.government_apis.plu_wfs import plu_wms_client
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.services.parcel_scoring import (
    MAX_QUALIFYING,
    QUALIFICATION_THRESHOLD,
    compute_opportunity_score,
)

logger = logging.getLogger(__name__)

# Concurrent WMS GetFeatureInfo requests for bestemmingen
WMS_CONCURRENCY = 15
# Concurrent reverse geocode requests
REVERSE_GEOCODE_CONCURRENCY = 10

locatieserver = PDOKLocatieserver()


async def area_scan_job(
    ctx: dict,
    scan_id: str,
    organization_id: str,
) -> dict:
    """
    Background job: Scan area for parcels, qualify, resolve addresses, create project.

    Pipeline:
        Phase 1 (0-20%):   Fetch BAG panden in bbox
        Phase 2 (20-40%):  Fetch bestemmingen per parcel via WMS GetFeatureInfo
        Phase 3 (40-70%):  Upsert ALL parcels + compute scores (cache everything)
        Phase 4 (70-80%):  Qualify — filter score >= 40, cap at 150, create ScanResult
        Phase 5 (80-95%):  Addresses — batch reverse geocode qualifying parcels
        Phase 6 (95-100%): Project — auto-create wijk project, link scan, finalize

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

            # ── Phase 1: Fetch BAG panden (0-20%) ──
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
            scan.progress_pct = 20
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(f"Scan {scan_id}: fetched {len(features)} panden")

            # ── Phase 2: Fetch bestemmingen per parcel via WMS (20-40%) ──
            scan.current_phase = "fetching_bestemmingen"
            scan.progress_pct = 20
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
            scan.progress_pct = 40
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: enriched {enriched_count}/{len(features)} "
                f"parcels with bestemmingen"
            )

            # ── Phase 3: Upsert ALL parcels + compute scores (40-70%) ──
            scan.current_phase = "processing_parcels"
            session.add(scan)
            await session.flush()
            await session.commit()

            failed_count = 0
            # Collect (parcel, score_breakdown, centroid_xy) for qualification
            scored_parcels: list[tuple[ParcelCache, float, str, dict, tuple[float, float] | None]] = []

            for idx, (feature, bestemmingen) in enumerate(
                zip(features, bestemmingen_list, strict=True)
            ):
                try:
                    parcel, centroid_xy = await _upsert_parcel_cache(
                        feature, org_id, scan.gemeente_code, session,
                        bestemmingen=bestemmingen,
                    )

                    score_breakdown = compute_opportunity_score(parcel)

                    scored_parcels.append((
                        parcel,
                        score_breakdown.total_score,
                        score_breakdown.category,
                        score_breakdown.factors,
                        centroid_xy,
                    ))

                    # Update progress every 10 parcels
                    if (idx + 1) % 10 == 0 or (idx + 1) == len(features):
                        progress_pct = 40 + int((idx + 1) / len(features) * 30)
                        await _update_scan_progress(
                            scan, "processing_parcels", progress_pct, idx + 1, session
                        )

                except Exception as e:
                    logger.warning(
                        f"Scan {scan_id}: failed to process parcel {idx}: {e}"
                    )
                    failed_count += 1
                    continue

            # ── Phase 4: Qualify — filter and create ScanResult (70-80%) ──
            scan.current_phase = "qualifying"
            scan.progress_pct = 70
            session.add(scan)
            await session.flush()
            await session.commit()

            # Sort by score desc, filter >= threshold, cap at MAX_QUALIFYING
            qualifying = sorted(
                scored_parcels,
                key=lambda x: x[1],
                reverse=True,
            )
            qualifying = [
                p for p in qualifying if p[1] >= QUALIFICATION_THRESHOLD
            ][:MAX_QUALIFYING]

            logger.info(
                f"Scan {scan_id}: {len(qualifying)}/{len(scored_parcels)} parcels "
                f"qualify (threshold={QUALIFICATION_THRESHOLD}, cap={MAX_QUALIFYING})"
            )

            for parcel, score, category, factors, _centroid in qualifying:
                scan_result = ScanResult(
                    organization_id=org_id,
                    scan_id=scan.id,
                    parcel_id=parcel.id,
                    score=score,
                    flags={
                        "category": category,
                        "factors": factors,
                    },
                )
                session.add(scan_result)

            await session.flush()
            await session.commit()

            scan.progress_pct = 80
            session.add(scan)
            await session.flush()
            await session.commit()

            # ── Phase 5: Addresses — batch reverse geocode (80-95%) ──
            scan.current_phase = "resolving_addresses"
            session.add(scan)
            await session.flush()
            await session.commit()

            await _batch_resolve_addresses(
                [(p, c) for p, _s, _cat, _f, c in qualifying],
                http_client,
                session,
            )

            scan.progress_pct = 95
            session.add(scan)
            await session.flush()
            await session.commit()

            # ── Phase 6: Project — auto-create wijk project (95-100%) ──
            scan.current_phase = "finalizing"
            session.add(scan)
            await session.flush()
            await session.commit()

            if scan.wijk_naam:
                project = await _get_or_create_wijk_project(
                    org_id, scan.wijk_naam, scan.gemeente_naam, session
                )
                scan.project_id = project.id

            scan.status = "completed"
            scan.completed_at = datetime.utcnow()
            scan.progress_pct = 100
            scan.parcels_failed = failed_count
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: completed ({scan.parcels_processed} processed, "
                f"{enriched_count} enriched, {len(qualifying)} qualifying, "
                f"{failed_count} failed)"
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
) -> tuple[ParcelCache, tuple[float, float] | None]:
    """
    Upsert BAG WFS feature into ParcelCache.

    Args:
        feature: GeoJSON feature from BAG WFS with geometry and properties
        org_id: Organization UUID
        gemeente_code: Municipality code for this scan
        session: Database session
        bestemmingen: Matched bestemmingsplan data from WMS GetFeatureInfo

    Returns:
        Tuple of (ParcelCache entry, centroid_xy in RD coords or None)
    """
    properties = feature.get("properties", {})
    identificatie = properties.get("identificatie", "")

    # Extract BAG building attributes
    bouwjaar = properties.get("bouwjaar")  # int or None
    pand_status = properties.get("status", "")  # str

    # Compute area and centroid from geometry
    geometry = feature.get("geometry")
    area_m2 = None
    centroid_xy: tuple[float, float] | None = None
    if geometry:
        try:
            geom_shape = shape(geometry)
            area_m2 = geom_shape.area
            centroid = geom_shape.centroid
            centroid_xy = (centroid.x, centroid.y)
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
    geojson_str = json.dumps(geometry)
    # BAG WFS returns RD coordinates (EPSG:28992)
    geom_expr = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geojson_str), 28992))

    if parcel:
        parcel.geometry = geom_expr
        parcel.area_m2 = area_m2
        parcel.has_pand = True
        parcel.gemeente_code = gemeente_code
        parcel.bestemmingen = bestemmingen
        parcel.bouwjaar = bouwjaar
        parcel.pand_status = pand_status
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
            bouwjaar=bouwjaar,
            pand_status=pand_status,
            enrichment_data=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(parcel)

    await session.flush()
    return parcel, centroid_xy


async def _batch_resolve_addresses(
    parcels_with_centroids: list[tuple[ParcelCache, tuple[float, float] | None]],
    client: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    """
    Batch reverse geocode qualifying parcels to resolve addresses.

    Only called for qualifying parcels (~50-150), not all 10k.
    Uses PDOK Locatieserver /reverse with RD coordinates.

    Args:
        parcels_with_centroids: List of (parcel, centroid_xy) tuples
        client: Shared httpx AsyncClient
        session: Database session
    """
    semaphore = asyncio.Semaphore(REVERSE_GEOCODE_CONCURRENCY)

    async def resolve_one(parcel: ParcelCache, centroid: tuple[float, float] | None) -> None:
        if centroid is None:
            return
        async with semaphore:
            address = await locatieserver.reverse(centroid[0], centroid[1], client)
            if address:
                parcel.address = address
                session.add(parcel)

    tasks = [
        resolve_one(parcel, centroid)
        for parcel, centroid in parcels_with_centroids
    ]
    await asyncio.gather(*tasks)
    await session.flush()
    await session.commit()


async def _get_or_create_wijk_project(
    org_id: uuid.UUID,
    wijk_naam: str,
    gemeente_naam: str,
    session: AsyncSession,
) -> Project:
    """
    Find or create a Project folder for a wijk scan.

    Project name format: "{wijk_naam} ({gemeente_naam})"

    Args:
        org_id: Organization UUID
        wijk_naam: CBS wijk name
        gemeente_naam: Gemeente display name
        session: Database session

    Returns:
        Project instance (existing or newly created)
    """
    project_name = f"{wijk_naam} ({gemeente_naam})"

    stmt = select(Project).where(
        Project.organization_id == org_id,
        Project.name == project_name,
    )
    result = await session.execute(stmt)
    project = result.scalar_one_or_none()

    if project:
        return project

    project = Project(
        organization_id=org_id,
        name=project_name,
        description=f"Automatisch aangemaakt voor wijkscan {wijk_naam}",
    )
    session.add(project)
    await session.flush()
    await session.commit()
    return project


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

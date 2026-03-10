"""Area scan background job for ARQ worker."""

import asyncio
import json
import logging
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import TypeVar

import httpx
from geoalchemy2.functions import ST_GeomFromGeoJSON, ST_Multi, ST_SetSRID
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry
from shapely.strtree import STRtree
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.government_apis.bag_3d import bag_3d_client
from app.government_apis.bag_wfs import bag_wfs_client
from app.government_apis.pdok_cadastral import PDOKCadastralClient
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.government_apis.plu_wfs import plu_wms_client
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.services.bekendmaking_matcher import retro_match_changes_for_gemeente
from app.services.scan_enrichment import (
    batch_fetch_address_enrichment,
    batch_fetch_bodem_data,
    batch_fetch_postcode_enrichment,
)
from app.services.funda_listing_ingestion import build_funda_listing_signal_map
from app.services.parcel_addressing import (
    MIN_BUILDING_OVERLAP_M2,
    MIN_BUILDING_OVERLAP_RATIO,
    AddressResolution,
    reverse_geocode_rd_point,
    reverse_geocode_rd_point_full,
)
from app.services.parcel_scoring import (
    MAX_QUALIFYING,
    QUALIFICATION_THRESHOLD,
    compute_opportunity_score,
    compute_vacancy_confidence,
    derive_opportunity_insights,
)
from app.services.spatial_helpers import transform_point_to_rd

logger = logging.getLogger(__name__)

# Concurrent WMS GetFeatureInfo requests for bestemmingen
WMS_CONCURRENCY = 15
# Concurrent reverse geocode requests
REVERSE_GEOCODE_CONCURRENCY = 10
# PostgreSQL/asyncpg hard-limits bind parameters to 32767 per statement.
# A scan_result insert uses 5 bind params per row, so stay well below the ceiling.
SCAN_RESULT_INSERT_BATCH_SIZE = 5000

locatieserver = PDOKLocatieserver()
pdok_cadastral_client = PDOKCadastralClient()
T = TypeVar("T")


@dataclass(slots=True)
class BagSpatialIndex:
    """In-memory spatial index for BAG building footprints in RD."""

    tree: STRtree
    geometries: list[BaseGeometry]
    bouwjaren: list[int | None]
    statuses: list[str | None]
    representative_points: list[tuple[float, float]]
    identificaties: list[str | None]


def _extract_first_coordinate_pair(geometry: dict | None) -> tuple[float, float] | None:
    """Extract first [x,y] pair from a GeoJSON geometry coordinate tree."""
    if not isinstance(geometry, dict):
        return None
    node = geometry.get("coordinates")
    while isinstance(node, (list, tuple)) and len(node) > 0:
        if (
            len(node) >= 2
            and isinstance(node[0], (int, float))
            and isinstance(node[1], (int, float))
        ):
            return float(node[0]), float(node[1])
        node = node[0]
    return None


def _geometry_looks_wgs84(geometry: dict | None) -> bool:
    """Best-effort CRS check for GeoJSON geometry."""
    pair = _extract_first_coordinate_pair(geometry)
    if pair is None:
        return False
    x, y = pair
    return -180 <= x <= 180 and -90 <= y <= 90


def _parse_int(value: object) -> int | None:
    """Safely parse integer-like values from API payloads."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        raw = value.strip()
        if raw.isdigit():
            return int(raw)
    return None


def _parse_float(value: object) -> float | None:
    """Safely parse float-like values from API payloads."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        raw = value.strip().replace(",", ".")
        try:
            return float(raw)
        except ValueError:
            return None
    return None


def _chunk_rows(rows: list[T], size: int) -> list[list[T]]:
    """Split a list into fixed-size chunks for bounded bulk inserts."""
    if size <= 0:
        raise ValueError("Chunk size must be positive")
    return [rows[i:i + size] for i in range(0, len(rows), size)]


def _build_bag_spatial_index(features: list[dict]) -> BagSpatialIndex | None:
    """Build a STRtree for BAG building footprints to cross-reference parcels."""
    geometries: list[BaseGeometry] = []
    bouwjaren: list[int | None] = []
    statuses: list[str | None] = []
    identificaties: list[str | None] = []

    for feature in features:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            continue
        try:
            geom_shape = shape(geometry)
        except Exception:
            continue
        if geom_shape.is_empty:
            continue

        props = feature.get("properties", {})
        if not isinstance(props, dict):
            props = {}

        geometries.append(geom_shape)
        bouwjaren.append(_parse_int(props.get("bouwjaar")))
        status_raw = props.get("status")
        statuses.append(status_raw.strip() if isinstance(status_raw, str) and status_raw.strip() else None)
        id_raw = props.get("identificatie")
        identificaties.append(id_raw if isinstance(id_raw, str) and id_raw.strip() else None)

    if not geometries:
        return None

    return BagSpatialIndex(
        tree=STRtree(geometries),
        geometries=geometries,
        bouwjaren=bouwjaren,
        statuses=statuses,
        representative_points=[
            (float(geom.representative_point().x), float(geom.representative_point().y))
            for geom in geometries
        ],
        identificaties=identificaties,
    )


def _derive_bag_attributes_for_parcel(
    parcel_geometry: BaseGeometry,
    bag_index: BagSpatialIndex | None,
) -> tuple[bool, int | None, str | None, tuple[float, float] | None, float | None, list[str]]:
    """Derive parcel-level BAG attributes from intersecting building footprints."""
    if bag_index is None:
        return False, None, None, None, None, []

    candidate_indices = bag_index.tree.query(parcel_geometry)
    if len(candidate_indices) == 0:
        return False, None, None, None, None, []

    intersect_count = 0
    matched_bouwjaren: list[int] = []
    matched_statuses: list[str] = []
    bag_identificaties: list[str] = []
    best_address_point: tuple[float, float] | None = None
    best_overlap_area = -1.0
    total_footprint_area = 0.0

    iterable_indices = (
        candidate_indices.tolist()
        if hasattr(candidate_indices, "tolist")
        else candidate_indices
    )
    for raw_idx in iterable_indices:
        idx = int(raw_idx)
        bag_geom = bag_index.geometries[idx]
        if not bag_geom.intersects(parcel_geometry):
            continue
        overlap_area = bag_geom.intersection(parcel_geometry).area
        if overlap_area < MIN_BUILDING_OVERLAP_M2:
            continue
        parcel_area = parcel_geometry.area
        if parcel_area > 0 and overlap_area / parcel_area < MIN_BUILDING_OVERLAP_RATIO:
            continue
        total_footprint_area += overlap_area
        intersect_count += 1
        if overlap_area > best_overlap_area:
            best_overlap_area = overlap_area
            best_address_point = bag_index.representative_points[idx]

        bouwjaar = bag_index.bouwjaren[idx]
        if isinstance(bouwjaar, int) and bouwjaar > 0:
            matched_bouwjaren.append(bouwjaar)

        status = bag_index.statuses[idx]
        if isinstance(status, str) and status:
            matched_statuses.append(status)

        pand_id = bag_index.identificaties[idx]
        if pand_id is not None:
            bag_identificaties.append(pand_id)

    if intersect_count == 0:
        return False, None, None, None, None, []

    bouwjaar_value = min(matched_bouwjaren) if matched_bouwjaren else None
    pand_status_value = None
    if matched_statuses:
        pand_status_value = Counter(matched_statuses).most_common(1)[0][0]

    pand_oppervlakte_m2: float | None = total_footprint_area if total_footprint_area > 0 else None
    return True, bouwjaar_value, pand_status_value, best_address_point, pand_oppervlakte_m2, bag_identificaties


async def area_scan_job(
    ctx: dict,
    scan_id: str,
    organization_id: str,
) -> dict:
    """
    Background job: Scan area for parcels, qualify, resolve addresses, create project.

    Pipeline:
        Phase 1 (0-20%):   Fetch kadastrale percelen (PDOK BRK) in bbox
        Phase 2 (20-40%):  Cross-reference BAG panden + fetch bestemmingen
        Phase 3 (40-70%):  Upsert ALL parcels + compute scores (cache everything)
        Phase 4 (70-80%):  Rank — persist all scored parcels into ScanResult
        Phase 5 (80-95%):  Addresses — reverse geocode ranked parcels (capped)
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

            # ── Phase 1: Fetch kadastrale percelen (0-20%) ──
            logger.info(f"Scan {scan_id}: fetching cadastral parcels from PDOK BRK")

            try:
                bbox = (
                    f"{scan.bbox_minx},{scan.bbox_miny},"
                    f"{scan.bbox_maxx},{scan.bbox_maxy}"
                )
                features = await pdok_cadastral_client.get_parcels_by_bbox(
                    bbox=bbox,
                    client=http_client,
                )
            except Exception as e:
                logger.error(f"Scan {scan_id}: PDOK BRK fetch failed: {e}")
                scan.status = "failed"
                scan.error_message = f"PDOK BRK fetch failed: {str(e)}"
                session.add(scan)
                await session.flush()
                await session.commit()
                return {"scan_id": scan_id, "status": "failed", "error": str(e)}

            scan.parcels_total = len(features)
            scan.progress_pct = 20
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(f"Scan {scan_id}: fetched {len(features)} cadastral parcels")

            # ── Phase 2: BAG cross-reference, bestemmingen + CBS ──
            scan.current_phase = "fetching_bestemmingen"
            scan.progress_pct = 20
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: fetching BAG cross-reference, bestemmingen, and CBS data "
                f"({len(features)} parcels, WMS concurrency={WMS_CONCURRENCY})"
            )

            # Fetch CBS Neighborhood metrics
            try:
                from app.government_apis.cbs_odata import cbs_client
                cbs_data = await cbs_client.get_neighborhood_data(
                    client=http_client,
                    gemeente_naam=scan.gemeente_naam,
                    wijk_naam=scan.wijk_naam,
                    gemeente_code=scan.gemeente_code,
                )
                scan.neighborhood_metrics = cbs_data
                if cbs_data:
                    logger.info(f"Scan {scan_id}: successfully fetched CBS metrics")
            except Exception as e:
                logger.warning(f"Scan {scan_id}: CBS fetch failed (non-fatal): {e}")

            # Fetch CBS Nabijheid proximity data
            try:
                nabijheid_data = await cbs_client.get_nabijheid_data(
                    client=http_client,
                    gemeente_naam=scan.gemeente_naam,
                    wijk_naam=scan.wijk_naam,
                    gemeente_code=scan.gemeente_code,
                )
                if nabijheid_data:
                    if scan.neighborhood_metrics:
                        scan.neighborhood_metrics = {
                            **scan.neighborhood_metrics,
                            "nabijheid": nabijheid_data,
                        }
                    else:
                        scan.neighborhood_metrics = {"nabijheid": nabijheid_data}
                    logger.info(f"Scan {scan_id}: successfully fetched CBS nabijheid data")
            except Exception as e:
                logger.warning(f"Scan {scan_id}: CBS nabijheid fetch failed (non-fatal): {e}")

            # Fetch CBS Crime data (dataderden.cbs.nl OData v3)
            try:
                from app.government_apis.cbs_crime import cbs_crime_client

                aantal_inwoners = (
                    scan.neighborhood_metrics.get("data", {}).get("demografie", {}).get("aantal_inwoners")
                    if scan.neighborhood_metrics
                    else None
                )
                crime_data = await cbs_crime_client.get_crime_data(
                    client=http_client,
                    gemeente_code=scan.gemeente_code,
                    wijk_naam=scan.wijk_naam,
                    inwoners=aantal_inwoners,
                )
                if crime_data:
                    if scan.neighborhood_metrics:
                        scan.neighborhood_metrics = {
                            **scan.neighborhood_metrics,
                            "criminaliteit": crime_data,
                        }
                    else:
                        scan.neighborhood_metrics = {"criminaliteit": crime_data}
                    logger.info(f"Scan {scan_id}: successfully fetched CBS crime data")
            except Exception as e:
                logger.warning(f"Scan {scan_id}: CBS crime fetch failed (non-fatal): {e}")

            try:
                bag_features = await bag_wfs_client.get_panden_in_bbox(
                    scan.bbox_minx,
                    scan.bbox_miny,
                    scan.bbox_maxx,
                    scan.bbox_maxy,
                    http_client,
                )
            except Exception as e:
                logger.error(
                    "Scan %s: BAG WFS fetch failed after retries, aborting scan: %s",
                    scan_id, e,
                )
                scan.status = "failed"
                scan.error_message = f"BAG WFS fetch failed: {e}"
                scan.error_detail = {
                    "stage": "bag_wfs_fetch",
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "bbox": (
                        f"{scan.bbox_minx},{scan.bbox_miny},"
                        f"{scan.bbox_maxx},{scan.bbox_maxy}"
                    ),
                }
                session.add(scan)
                await session.flush()
                await session.commit()
                return {"scan_id": scan_id, "status": "failed", "error": f"BAG WFS: {e}"}

            bag_index = _build_bag_spatial_index(bag_features)

            # Phase 2b: Fetch 3D BAG actual building dimensions for scan bbox
            bag_3d_data: dict[str, dict] = {}
            try:
                bag_3d_data = await bag_3d_client.get_panden_in_bbox(
                    scan.bbox_minx,
                    scan.bbox_miny,
                    scan.bbox_maxx,
                    scan.bbox_maxy,
                    http_client,
                )
                logger.info(f"Scan {scan_id}: 3D BAG data for {len(bag_3d_data)} panden")
            except Exception as e:
                # Non-fatal: scan continues without actual dimensions
                logger.warning(f"Scan {scan_id}: 3D BAG fetch failed (non-fatal): {e}")

            bestemmingen_list = await _batch_fetch_bestemmingen(features, http_client)

            enriched_count = sum(1 for b in bestemmingen_list if b is not None)
            scan.progress_pct = 40
            session.add(scan)
            await session.flush()
            await session.commit()

            logger.info(
                f"Scan {scan_id}: BAG buildings={len(bag_features)} "
                f"(indexed={bag_index is not None}), bestemmingen={enriched_count}/{len(features)}"
            )

            # ── Phase 3: Upsert ALL parcels + compute scores (40-70%) ──
            scan.current_phase = "processing_parcels"
            session.add(scan)
            await session.flush()
            await session.commit()

            failed_count = 0
            # Collect (parcel + score + insights + address lookup point) for ranking/persistence
            scored_parcels: list[
                tuple[
                    ParcelCache,
                    float,
                    str,
                    dict,
                    float,
                    float,
                    str,
                    str,
                    list[str],
                    dict[str, float | None],
                    tuple[float, float] | None,
                    float | None,
                    list[str],
                ]
            ] = []

            for idx, (feature, bestemmingen) in enumerate(
                zip(features, bestemmingen_list, strict=True)
            ):
                try:
                    parcel, centroid_xy, pand_oppervlakte_m2, bag_identificaties = await _upsert_parcel_cache(
                        feature, org_id, scan.gemeente_code, session,
                        bestemmingen=bestemmingen,
                        bag_index=bag_index,
                    )

                    score_breakdown = compute_opportunity_score(parcel)
                    insights = derive_opportunity_insights(parcel)

                    scored_parcels.append((
                        parcel,
                        score_breakdown.total_score,
                        score_breakdown.category,
                        score_breakdown.factors,
                        score_breakdown.vacancy_subscore,
                        score_breakdown.buildability_subscore,
                        score_breakdown.model_version,
                        insights.vacancy_signal,
                        insights.signals,
                        insights.building_metrics,
                        centroid_xy,
                        pand_oppervlakte_m2,
                        bag_identificaties,
                    ))

                    # Update progress every 10 parcels
                    if (idx + 1) % 10 == 0 or (idx + 1) == len(features):
                        progress_pct = (
                            70
                            if len(features) == 0
                            else 40 + int((idx + 1) / len(features) * 30)
                        )
                        await _update_scan_progress(
                            scan, "processing_parcels", progress_pct, idx + 1, session
                        )

                except Exception as e:
                    logger.warning(
                        f"Scan {scan_id}: failed to process parcel {idx}: {e}"
                    )
                    failed_count += 1
                    continue

            # ── Phase 3b: Batch-fetch bodem enrichment data ──
            bodem_by_parcel: dict[str, dict] = {}
            centroids_for_bodem = [
                (str(parcel.id), centroid_xy[0], centroid_xy[1])
                for parcel, _s, _cat, _f, _vsub, _bsub, _ver, _vs, _os, _bm, centroid_xy, _pom, _bag_ids in scored_parcels
                if centroid_xy is not None
            ]
            if centroids_for_bodem:
                try:
                    bodem_by_parcel = await batch_fetch_bodem_data(
                        centroids_for_bodem, http_client
                    )
                    logger.info(
                        "Scan %s: bodem enrichment complete — %d/%d parcels enriched",
                        scan_id,
                        len(bodem_by_parcel),
                        len(centroids_for_bodem),
                    )
                except Exception as bodem_exc:
                    logger.warning(
                        "Scan %s: bodem batch fetch failed (non-fatal): %s",
                        scan_id,
                        bodem_exc,
                    )

            # ── Phase 4: Rank and persist scored parcels (70-80%) ──
            scan.current_phase = "qualifying"
            scan.progress_pct = 70
            session.add(scan)
            await session.flush()
            await session.commit()

            # Sort all scored parcels by score desc.
            scored_sorted = sorted(
                scored_parcels,
                key=lambda x: x[1],
                reverse=True,
            )

            # Persist ALL scored parcels so users can inspect full wijk potential.
            all_ranked = scored_sorted

            # Data quality wins here: for wijk scans we resolve addresses for the
            # full ranked set. Empty parcels have no BAG-based lookup point and
            # are skipped cheaply by _batch_resolve_addresses.
            address_targets = all_ranked
            address_strategy = "all-ranked"

            logger.info(
                f"Scan {scan_id}: ranked {len(all_ranked)} parcels total; "
                f"address-targets {len(address_targets)} "
                f"(strategy={address_strategy}, threshold={QUALIFICATION_THRESHOLD}, "
                f"priority_cap={MAX_QUALIFYING})"
            )

            if all_ranked:
                listing_signal_by_parcel = await build_funda_listing_signal_map(
                    [parcel.id for parcel, *_rest in all_ranked],
                    org_id,
                    session,
                )

                ranked_values = []
                for (
                    parcel,
                    score,
                    category,
                    factors,
                    vacancy_subscore,
                    buildability_subscore,
                    score_model_version,
                    vacancy_signal,
                    opportunity_signals,
                    building_metrics,
                    _centroid,
                    pand_oppervlakte_m2,
                    bag_identificaties,
                ) in all_ranked:
                    listing_signal = listing_signal_by_parcel.get(parcel.id)
                    vacancy_assessment = compute_vacancy_confidence(
                        parcel,
                        listing_signal=listing_signal,
                    )
                    final_bm: dict = dict(building_metrics) if isinstance(building_metrics, dict) else {}
                    if pand_oppervlakte_m2 is not None:
                        final_bm["pand_oppervlakte_m2"] = pand_oppervlakte_m2

                    # 3D BAG actual dimensions — join by pand identificatie
                    actual_hoogte: float | None = None
                    actual_lagen: int | None = None
                    for pand_id in (bag_identificaties or []):
                        full_id = f"NL.IMBAG.Pand.{pand_id}" if not pand_id.startswith("NL.") else pand_id
                        bag_3d_entry = bag_3d_data.get(full_id)
                        if bag_3d_entry:
                            h = bag_3d_entry.get("actual_bouwhoogte")
                            bl = bag_3d_entry.get("actual_bouwlagen")
                            if h is not None:
                                actual_hoogte = h if actual_hoogte is None else max(actual_hoogte, h)
                            if bl is not None:
                                actual_lagen = bl if actual_lagen is None else max(actual_lagen, bl)
                    if actual_hoogte is not None:
                        final_bm["actual_bouwhoogte"] = actual_hoogte
                    if actual_lagen is not None:
                        final_bm["actual_bouwlagen"] = actual_lagen
                    # Merge bodem enrichment data from Phase 3b
                    bodem_enrichment = bodem_by_parcel.get(str(parcel.id), {})
                    flags_dict: dict = {
                        "category": category,
                        "factors": factors,
                        "subscores": {
                            "vacancy": vacancy_subscore,
                            "buildability": buildability_subscore,
                        },
                        "score_model_version": score_model_version,
                        "vacancy_signal": vacancy_signal,
                        "vacancy_confidence": vacancy_assessment.confidence,
                        "vacancy_reasons": vacancy_assessment.reasons,
                        "vacancy_model_version": vacancy_assessment.model_version,
                        "market_signals": listing_signal,
                        "opportunity_signals": opportunity_signals,
                        "building_metrics": final_bm,
                    }
                    if bodem_enrichment.get("bodem"):
                        flags_dict["bodem"] = bodem_enrichment["bodem"]
                    if bodem_enrichment.get("bodemtype"):
                        flags_dict["bodemtype"] = bodem_enrichment["bodemtype"]

                    ranked_values.append(
                        {
                            "organization_id": org_id,
                            "scan_id": scan.id,
                            "parcel_id": parcel.id,
                            "score": score,
                            "flags": flags_dict,
                        }
                    )
                for ranked_batch in _chunk_rows(
                    ranked_values,
                    SCAN_RESULT_INSERT_BATCH_SIZE,
                ):
                    stmt = (
                        pg_insert(ScanResult)
                        .values(ranked_batch)
                        .on_conflict_do_nothing(
                            index_elements=["scan_id", "parcel_id"]
                        )
                    )
                    await session.execute(stmt)

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

            resolved_data: list[tuple[str, AddressResolution]] = []
            await _batch_resolve_addresses(
                [
                    (p, c)
                    for p, _s, _cat, _f, _vsub, _bsub, _ver, _vs, _os, _bm, c, _pom, _bag_ids in address_targets
                ],
                http_client,
                session,
                scan=scan,
                resolved_data=resolved_data,
            )

            scan.progress_pct = 88
            session.add(scan)
            await session.flush()
            await session.commit()

            # ── Phase 5b: Address-based enrichment (88-95%) ──
            try:
                scan.current_phase = "enriching_data"
                session.add(scan)
                await session.flush()
                await session.commit()

                # Build lookup maps from resolved_data
                postcodes_by_parcel = {
                    pid: res.postcode
                    for pid, res in resolved_data
                    if res.postcode
                }
                vbo_ids_by_parcel = {
                    pid: res.vbo_id
                    for pid, res in resolved_data
                    if res.vbo_id
                }
                nummeraanduiding_ids_by_parcel = {
                    pid: res.nummeraanduiding_id
                    for pid, res in resolved_data
                    if res.nummeraanduiding_id
                }

                logger.info(
                    "Scan %s: Phase 5b enrichment — %d postcodes, %d VBO IDs, %d NA IDs",
                    scan_id,
                    len(postcodes_by_parcel),
                    len(vbo_ids_by_parcel),
                    len(nummeraanduiding_ids_by_parcel),
                )

                # Fetch all enrichment data in parallel
                postcode_enrichment, address_enrichment = await asyncio.gather(
                    batch_fetch_postcode_enrichment(postcodes_by_parcel, http_client),
                    batch_fetch_address_enrichment(
                        vbo_ids_by_parcel, nummeraanduiding_ids_by_parcel, http_client
                    ),
                )

                # Merge enrichment data into existing scan_results.flags
                enriched_parcel_ids = set(postcode_enrichment) | set(address_enrichment)
                if enriched_parcel_ids:
                    # Load existing scan_results in batches to merge flags
                    enriched_list = list(enriched_parcel_ids)
                    update_count = 0
                    for batch_start in range(0, len(enriched_list), 100):
                        batch_ids = enriched_list[batch_start:batch_start + 100]
                        batch_uuids = []
                        for pid in batch_ids:
                            try:
                                batch_uuids.append(uuid.UUID(pid))
                            except ValueError:
                                continue

                        stmt = select(ScanResult).where(
                            ScanResult.scan_id == scan.id,
                            ScanResult.parcel_id.in_(batch_uuids),
                        )
                        result = await session.execute(stmt)
                        scan_results_batch = result.scalars().all()

                        for sr in scan_results_batch:
                            pid_str = str(sr.parcel_id)
                            merged_flags = dict(sr.flags) if sr.flags else {}

                            pc_data = postcode_enrichment.get(pid_str, {})
                            if pc_data.get("vergunningen"):
                                merged_flags["vergunningen"] = pc_data["vergunningen"]
                            if pc_data.get("funderingsrisico"):
                                merged_flags["funderingsrisico"] = pc_data["funderingsrisico"]

                            addr_data = address_enrichment.get(pid_str, {})
                            if addr_data.get("energielabel"):
                                merged_flags["energielabel"] = addr_data["energielabel"]
                            if addr_data.get("woz"):
                                merged_flags["woz"] = addr_data["woz"]

                            sr.flags = merged_flags
                            session.add(sr)
                            update_count += 1

                        await session.flush()

                    await session.commit()
                    logger.info(
                        "Scan %s: Phase 5b complete — %d scan_results enriched",
                        scan_id,
                        update_count,
                    )

                scan.progress_pct = 95
                session.add(scan)
                await session.flush()
                await session.commit()

            except Exception as enrichment_exc:
                # Phase 5b is non-fatal — scan completes with existing data
                logger.warning(
                    "Scan %s: Phase 5b enrichment failed (non-fatal): %s",
                    scan_id,
                    enrichment_exc,
                )
                scan.progress_pct = 95
                session.add(scan)
                await session.flush()
                await session.commit()

            # ── Coverage validation ──
            parcels_with_buildings = sum(1 for p, *_ in scored_parcels if p.has_pand)
            total_parcels = len(scored_parcels)
            coverage_ratio = (
                parcels_with_buildings / total_parcels if total_parcels > 0 else 0.0
            )

            # Address resolution: of parcels with buildings, how many got an address?
            parcels_with_address = sum(
                1 for p, *_ in scored_parcels if p.has_pand and p.address
            )
            address_resolution_ratio = (
                parcels_with_address / parcels_with_buildings
                if parcels_with_buildings > 0
                else 0.0
            )

            scan.coverage_ratio = coverage_ratio
            scan.address_resolution_ratio = address_resolution_ratio

            # Warn on suspiciously low building coverage (>90% has_pand=false)
            if total_parcels > 0 and coverage_ratio < 0.10:
                logger.warning(
                    "Scan %s [%s]: suspiciously low building coverage: %.1f%% "
                    "(%d/%d parcels have buildings). BAG data may be incomplete.",
                    scan_id, scan.wijk_naam or "unknown",
                    coverage_ratio * 100, parcels_with_buildings, total_parcels,
                )

            # Warn on low address resolution (>50% of building-parcels unresolved)
            if parcels_with_buildings > 0 and address_resolution_ratio < 0.50:
                logger.warning(
                    "Scan %s [%s]: low address resolution: %.1f%% "
                    "(%d/%d parcels with buildings have addresses).",
                    scan_id, scan.wijk_naam or "unknown",
                    address_resolution_ratio * 100, parcels_with_address, parcels_with_buildings,
                )

            # Set status to completed_with_warnings if thresholds breached
            has_coverage_warning = total_parcels > 0 and coverage_ratio < 0.10
            has_address_warning = (
                parcels_with_buildings > 0 and address_resolution_ratio < 0.50
            )

            # ── Phase 6: Project — auto-create wijk project (95-100%) ──
            scan.current_phase = "finalizing"
            session.add(scan)
            await session.flush()
            await session.commit()

            if scan.wijk_naam:
                project = await _get_or_create_wijk_project(
                    org_id, scan.wijk_naam, scan.gemeente_naam, scan.gemeente_code, session
                )
                scan.project_id = project.id

            scan.status = (
                "completed_with_warnings"
                if (has_coverage_warning or has_address_warning)
                else "completed"
            )
            scan.completed_at = datetime.utcnow()
            scan.progress_pct = 100
            scan.parcels_failed = failed_count
            session.add(scan)
            await session.flush()
            await session.commit()

            # ── Post-scan: retro-match unmatched bekendmakingen ──
            try:
                retro_matched = await retro_match_changes_for_gemeente(
                    gemeente_code=scan.gemeente_code,
                    organization_id=org_id,
                    session=session,
                    client=http_client,
                )
                if retro_matched > 0:
                    await session.commit()
                    logger.info(
                        f"Scan {scan_id}: retro-matched {retro_matched} "
                        f"bekendmakingen to parcels"
                    )
            except Exception as e:
                logger.warning(
                    f"Scan {scan_id}: retro-match failed (non-fatal): {e}"
                )
                # Don't fail the scan — retro-match is best-effort

            logger.info(
                f"Scan {scan_id}: completed ({scan.parcels_processed} processed, "
                f"{enriched_count} enriched, {len(all_ranked)} ranked, "
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
        features: List of GeoJSON parcel features from PDOK BRK
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
                x = float(centroid.x)
                y = float(centroid.y)
                if _geometry_looks_wgs84(geom_data):
                    x, y = transform_point_to_rd(x, y)
                return await plu_wms_client.get_bestemming_at_point(
                    x, y, client
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
    bag_index: BagSpatialIndex | None = None,
) -> tuple[ParcelCache, tuple[float, float] | None, float | None, list[str]]:
    """
    Upsert cadastral parcel feature into ParcelCache.

    Args:
        feature: GeoJSON feature from PDOK BRK with geometry and properties
        org_id: Organization UUID
        gemeente_code: Municipality code for this scan
        session: Database session
        bestemmingen: Matched bestemmingsplan data from WMS GetFeatureInfo
        bag_index: Optional BAG building spatial index for has_pand/bouwjaar/status

    Returns:
        Tuple of (ParcelCache entry, BAG-based address lookup point in RD coords or None,
                  total BAG pand footprint area in m2 or None,
                  list of BAG pand identificaties (numeric strings) for 3D BAG join)
    """
    properties = feature.get("properties", {})
    if not isinstance(properties, dict):
        properties = {}

    identificatie = properties.get("identificatie_lokaal_id")
    if not isinstance(identificatie, str) or not identificatie.strip():
        identificatie = properties.get("identificatie")
    if not isinstance(identificatie, str) or not identificatie.strip():
        gemeente_code_raw = properties.get("akr_kadastrale_gemeente_code_waarde")
        if not isinstance(gemeente_code_raw, str) or not gemeente_code_raw.strip():
            gemeente_code_raw = properties.get("kadastrale_gemeente_waarde")
        sectie = properties.get("sectie")
        perceelnummer = properties.get("perceelnummer")
        if (
            isinstance(gemeente_code_raw, str)
            and gemeente_code_raw.strip()
            and isinstance(sectie, str)
            and sectie.strip()
            and perceelnummer is not None
        ):
            identificatie = (
                f"{gemeente_code_raw.strip()}-{sectie.strip()}-{perceelnummer}"
            )
    if not isinstance(identificatie, str) or not identificatie.strip():
        raise ValueError("Missing cadastral parcel identifier")
    identificatie = identificatie.strip()

    # Compute area and centroid from geometry
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict):
        raise ValueError("Missing cadastral parcel geometry")

    area_m2 = None
    centroid_xy: tuple[float, float] | None = None
    address_lookup_xy: tuple[float, float] | None = None
    source_srid = 28992
    parcel_geom_shape: BaseGeometry | None = None
    try:
        parcel_geom_shape = shape(geometry)
        source_srid = 4326 if _geometry_looks_wgs84(geometry) else 28992

        # Prefer authoritative cadastral size value when present.
        area_m2 = _parse_float(properties.get("kadastrale_grootte_waarde"))
        if area_m2 is None and source_srid == 28992:
            area_m2 = parcel_geom_shape.area

        centroid = parcel_geom_shape.centroid
        centroid_xy = (float(centroid.x), float(centroid.y))
        if source_srid == 4326:
            centroid_xy = transform_point_to_rd(centroid_xy[0], centroid_xy[1])
    except Exception as e:
        logger.warning(f"Failed to compute area for {identificatie}: {e}")

    has_pand = False
    bouwjaar = None
    pand_status = None
    pand_oppervlakte_m2: float | None = None
    bag_identificaties: list[str] = []
    if parcel_geom_shape is not None:
        has_pand, bouwjaar, pand_status, address_lookup_xy, pand_oppervlakte_m2, bag_identificaties = _derive_bag_attributes_for_parcel(
            parcel_geom_shape,
            bag_index,
        )

    # Check if entry already exists
    stmt = select(ParcelCache).where(
        ParcelCache.organization_id == org_id,
        ParcelCache.parcel_id == identificatie,
    )
    result = await session.execute(stmt)
    parcel = result.scalar_one_or_none()

    # Convert GeoJSON geometry to PostGIS geometry
    geojson_str = json.dumps(geometry)
    source_geom_expr = ST_SetSRID(ST_GeomFromGeoJSON(geojson_str), source_srid)
    if source_srid == 28992:
        geom_expr = ST_Multi(source_geom_expr)
    else:
        geom_expr = ST_Multi(func.ST_Transform(source_geom_expr, 28992))

    if parcel:
        parcel.geometry = geom_expr
        parcel.area_m2 = area_m2
        parcel.has_pand = has_pand
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
            has_pand=has_pand,
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
    return parcel, address_lookup_xy, pand_oppervlakte_m2, bag_identificaties


async def _batch_resolve_addresses(
    parcels_with_centroids: list[tuple[ParcelCache, tuple[float, float] | None]],
    client: httpx.AsyncClient,
    session: AsyncSession,
    scan: object | None = None,
    resolved_data: list[tuple[str, AddressResolution]] | None = None,
) -> None:
    """
    Batch reverse geocode parcels to resolve addresses.

    Usually runs for all ranked parcels in a wijk scan. For very large scans,
    caller can pass a capped prioritized subset.
    Uses PDOK Locatieserver /reverse with RD coordinates.
    The lookup point should come from an intersecting BAG building footprint.
    Parcels without a BAG building keep address=None to avoid assigning the
    nearest street address to a neighboring empty parcel.

    Args:
        parcels_with_centroids: List of (parcel, centroid_xy) tuples
        client: Shared httpx AsyncClient
        session: Database session
        scan: Optional AreaScan to update progress_pct during resolution
        resolved_data: Optional list to populate with (parcel_id, AddressResolution)
            tuples for downstream enrichment (Phase 5b).
    """
    semaphore = asyncio.Semaphore(REVERSE_GEOCODE_CONCURRENCY)
    total = len(parcels_with_centroids)
    resolved_count = 0

    async def resolve_one(parcel: ParcelCache, centroid: tuple[float, float] | None) -> None:
        nonlocal resolved_count
        if centroid is None:
            resolved_count += 1
            return
        async with semaphore:
            resolution = await reverse_geocode_rd_point_full(centroid, client)
            if resolution.address:
                parcel.address = resolution.address
                session.add(parcel)
            if resolved_data is not None:
                resolved_data.append((str(parcel.id), resolution))
            resolved_count += 1
            # Update scan progress: 80-88% maps to address resolution
            if scan is not None and total > 0 and resolved_count % 50 == 0:
                scan.progress_pct = 80 + int(8 * resolved_count / total)
                session.add(scan)
                await session.flush()
                await session.commit()

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
    gemeente_code: str,
    session: AsyncSession,
) -> Project:
    """
    Find or create hierarchical Project structure (gemeente parent + wijk child).

    Hierarchy: gemeente (top-level) -> wijk (child)

    Args:
        org_id: Organization UUID
        wijk_naam: CBS wijk name
        gemeente_naam: Gemeente display name
        gemeente_code: CBS gemeente code
        session: Database session

    Returns:
        Wijk Project instance (child of gemeente parent)
    """
    # 1. Find or create gemeente parent project
    parent_stmt = select(Project).where(
        Project.organization_id == org_id,
        Project.gemeente_code == gemeente_code,
        Project.parent_id.is_(None),  # Top-level = gemeente
    )
    result = await session.execute(parent_stmt)
    gemeente_project = result.scalar_one_or_none()

    if not gemeente_project:
        gemeente_project = Project(
            organization_id=org_id,
            name=gemeente_naam,
            description=f"Monitoring voor gemeente {gemeente_naam}",
            gemeente_code=gemeente_code,
            is_monitored=True,
            parent_id=None,
        )
        session.add(gemeente_project)
        await session.flush()

    # 2. Find or create wijk child project
    wijk_stmt = select(Project).where(
        Project.organization_id == org_id,
        Project.parent_id == gemeente_project.id,
        Project.wijk_naam == wijk_naam,
    )
    result = await session.execute(wijk_stmt)
    wijk_project = result.scalar_one_or_none()

    if not wijk_project:
        wijk_project = Project(
            organization_id=org_id,
            name=wijk_naam,
            description=f"Wijkscan {wijk_naam}",
            parent_id=gemeente_project.id,
            gemeente_code=gemeente_code,
            wijk_naam=wijk_naam,
            is_monitored=True,
        )
        session.add(wijk_project)
        await session.flush()
        await session.commit()

    return wijk_project


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

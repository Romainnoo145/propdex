"""Private helper functions shared by scan sub-routers."""

import json
import logging
import re
import uuid
from datetime import datetime, timedelta

import httpx
from shapely.geometry import Point, shape
from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.pdok_cadastral import PDOKCadastralClient
from app.models.change_record import ChangeRecord
from app.models.parcel_cache import ParcelCache
from app.services.parcel_addressing import (
    find_bag_building_lookup_point,
    reverse_geocode_rd_point,
)
from app.services.spatial_helpers import transform_point_to_wgs84

logger = logging.getLogger(__name__)

pdok_cadastral_client = PDOKCadastralClient()


def _normalize_area_name(value: str) -> str:
    """Normalize area names for robust matching (wijk names can vary in spacing/apostrophes)."""
    return re.sub(r"\s+", " ", value.casefold().replace("'", "").replace("\u2019", "")).strip()


def _resolve_wijk_bbox_from_geojson(
    geojson: dict,
    wijk_naam: str,
) -> tuple[float, float, float, float] | None:
    """Find wijk geometry by name and return WGS84 bbox (min_lon, min_lat, max_lon, max_lat)."""
    features = geojson.get("features", []) if isinstance(geojson, dict) else []
    if not isinstance(features, list):
        return None

    target = _normalize_area_name(wijk_naam)

    # Exact normalized name match first.
    matched_feature = None
    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties", {})
        statnaam = properties.get("statnaam") if isinstance(properties, dict) else None
        if isinstance(statnaam, str) and _normalize_area_name(statnaam) == target:
            matched_feature = feature
            break

    # Fuzzy fallback: allow containment match (e.g., legacy labels/prefixes).
    if matched_feature is None:
        for feature in features:
            if not isinstance(feature, dict):
                continue
            properties = feature.get("properties", {})
            statnaam = properties.get("statnaam") if isinstance(properties, dict) else None
            if not isinstance(statnaam, str):
                continue
            candidate = _normalize_area_name(statnaam)
            if target in candidate or candidate in target:
                matched_feature = feature
                break

    if matched_feature is None:
        return None

    geometry = matched_feature.get("geometry") if isinstance(matched_feature, dict) else None
    if not isinstance(geometry, dict):
        return None

    try:
        min_lon, min_lat, max_lon, max_lat = shape(geometry).bounds
    except Exception:
        return None

    return (min_lon, min_lat, max_lon, max_lat)


def _parse_address_components(address: str | None) -> tuple[str | None, str | None]:
    """Parse simple Dutch street + housenumber from display address."""
    if not address:
        return None, None

    first_part = address.split(",")[0].strip()
    if not first_part:
        return None, None

    # Examples:
    # - "Maasstraat 117"
    # - "Maasstraat 117A"
    # - "Maasstraat 117-1"
    match = re.match(r"^(?P<street>.+?)\s+(?P<number>\d+[A-Za-z]?(?:-\d+)?)$", first_part)
    if not match:
        return first_part.lower(), None

    street = match.group("street").strip().lower()
    number = match.group("number").strip().lower()
    return street, number


def _is_missing_address(address: str | None) -> bool:
    """Return True when address is null/empty/placeholder-like."""
    if not isinstance(address, str):
        return True
    normalized = address.strip().lower()
    return normalized in {"", "onbekend", "unknown", "none", "null", "-"}


def _extract_first_coordinate_pair(geometry: dict | None) -> tuple[float, float] | None:
    """
    Extract first coordinate pair from GeoJSON geometry coordinates.

    Works for Point/LineString/Polygon/Multi* by descending into nested arrays.
    """
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
    """Best-effort CRS detection for GeoJSON: True when first coord looks like lon/lat."""
    pair = _extract_first_coordinate_pair(geometry)
    if pair is None:
        return False
    x, y = pair
    return -180 <= x <= 180 and -90 <= y <= 90


async def _resolve_pdok_cadastral_parcel_at_rd(
    *,
    x_rd: float,
    y_rd: float,
    db: AsyncSession,
) -> dict | None:
    """
    Resolve containing PDOK cadastral parcel for an RD point.

    Returns normalized payload with RD geometry + WGS84 geometry and display metadata.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            pdok_features = await pdok_cadastral_client.get_parcels_by_point(
                x=x_rd,
                y=y_rd,
                client=client,
                distance=3.0,
            )
    except Exception as e:
        logger.debug("PDOK cadastral lookup failed at RD point (%s,%s): %s", x_rd, y_rd, e)
        return None

    click_point_rd = Point(float(x_rd), float(y_rd))
    click_lng, click_lat = transform_point_to_wgs84(float(x_rd), float(y_rd))
    click_point_wgs84 = Point(click_lng, click_lat)
    selected_feature: dict | None = None
    selected_shape = None
    selected_is_wgs84: bool | None = None
    candidates: list[tuple[dict, object, bool]] = []

    for feature in pdok_features:
        if not isinstance(feature, dict):
            continue
        geometry_candidate = feature.get("geometry")
        if not isinstance(geometry_candidate, dict):
            continue
        try:
            geom_shape = shape(geometry_candidate)
        except Exception:
            continue
        if geom_shape.is_empty:
            continue
        geometry_is_wgs84 = _geometry_looks_wgs84(geometry_candidate)
        test_point = click_point_wgs84 if geometry_is_wgs84 else click_point_rd
        candidates.append((feature, geom_shape, geometry_is_wgs84))
        if geom_shape.contains(test_point) or geom_shape.touches(test_point):
            selected_feature = feature
            selected_shape = geom_shape
            selected_is_wgs84 = geometry_is_wgs84
            break

    if selected_feature is None and candidates:
        best_feature, best_shape, best_is_wgs84 = None, None, None
        best_dist = float('inf')
        for feat, geom, is_wgs84 in candidates:
            tp = click_point_wgs84 if is_wgs84 else click_point_rd
            dist = geom.centroid.distance(tp)
            if dist < best_dist:
                best_feature, best_shape, best_is_wgs84 = feat, geom, is_wgs84
                best_dist = dist
        if best_feature is not None:
            selected_feature = best_feature
            selected_shape = best_shape
            selected_is_wgs84 = best_is_wgs84
            logger.debug(
                'PDOK parcel fallback: nearest-centroid selected from %d candidates',
                len(candidates),
            )

    if selected_feature is None or selected_shape is None:
        return None

    geometry_raw = selected_feature.get("geometry")
    if not isinstance(geometry_raw, dict):
        return None

    source_srid = 4326 if bool(selected_is_wgs84) else 28992
    geometry_rd = None
    geometry_wgs84 = None
    try:
        source_geom_expr = func.ST_SetSRID(
            func.ST_GeomFromGeoJSON(json.dumps(geometry_raw)),
            source_srid,
        )
        transformed_row = (
            await db.execute(
                select(
                    func.ST_AsGeoJSON(func.ST_Transform(source_geom_expr, 28992)).label(
                        "geometry_rd"
                    ),
                    func.ST_AsGeoJSON(func.ST_Transform(source_geom_expr, 4326)).label(
                        "geometry_wgs84"
                    ),
                )
            )
        ).mappings().one_or_none()
        if transformed_row is not None:
            geometry_rd_raw = transformed_row.get("geometry_rd")
            geometry_wgs84_raw = transformed_row.get("geometry_wgs84")
            if isinstance(geometry_rd_raw, str) and geometry_rd_raw.strip():
                parsed_rd = json.loads(geometry_rd_raw)
                if isinstance(parsed_rd, dict):
                    geometry_rd = parsed_rd
            if isinstance(geometry_wgs84_raw, str) and geometry_wgs84_raw.strip():
                parsed_wgs84 = json.loads(geometry_wgs84_raw)
                if isinstance(parsed_wgs84, dict):
                    geometry_wgs84 = parsed_wgs84
    except Exception as e:
        logger.debug("Failed to transform PDOK parcel geometry to WGS84: %s", e)

    if geometry_wgs84 is None and bool(selected_is_wgs84):
        geometry_wgs84 = geometry_raw
    if geometry_rd is None and not bool(selected_is_wgs84):
        geometry_rd = geometry_raw

    props = selected_feature.get("properties", {})
    parcel_code = None
    area_m2 = None
    if isinstance(props, dict):
        municipality_name = props.get("kadastrale_gemeente_waarde")
        section = props.get("sectie")
        number = props.get("perceelnummer")
        if (
            isinstance(municipality_name, str)
            and municipality_name.strip()
            and isinstance(section, str)
            and section.strip()
            and number is not None
        ):
            parcel_code = f"{municipality_name.strip()} {section.strip()} {number}"
        else:
            identificatie = props.get("identificatie")
            if isinstance(identificatie, str) and identificatie.strip():
                parcel_code = identificatie.strip()

        raw_size = props.get("kadastrale_grootte_waarde")
        if isinstance(raw_size, (int, float)):
            area_m2 = float(raw_size)
        elif isinstance(raw_size, str):
            try:
                area_m2 = float(raw_size.replace(",", "."))
            except ValueError:
                area_m2 = None

    centroid = selected_shape.centroid
    if bool(selected_is_wgs84):
        centroid_wgs84 = (float(centroid.x), float(centroid.y))
    else:
        centroid_wgs84 = transform_point_to_wgs84(float(centroid.x), float(centroid.y))

    return {
        "geometry_rd": geometry_rd,
        "geometry_wgs84": geometry_wgs84,
        "parcel_code": parcel_code,
        "area_m2": area_m2,
        "centroid_wgs84": centroid_wgs84,
    }


async def _resolve_parcel_address_from_centroid(
    *,
    request,
    db: AsyncSession,
    parcel_id: uuid.UUID,
    current_address: str | None,
    centroid_rd_wkt: str | None = None,
) -> str | None:
    """
    Best-effort address resolution tied to actual BAG building overlap.

    This intentionally avoids parcel-centroid reverse geocoding for empty
    parcels, because that assigns a neighbor's house address to undeveloped land.
    """
    try:
        http_client = getattr(request.app.state, "http_client", None)
        if not isinstance(http_client, httpx.AsyncClient):
            return current_address

        parcel_row = (
            await db.execute(
                select(
                    ParcelCache.has_pand,
                    func.ST_AsGeoJSON(ParcelCache.geometry).label("geometry_raw"),
                ).where(
                    ParcelCache.id == parcel_id,
                )
            )
        ).mappings().one_or_none()
        if parcel_row is None:
            return current_address

        has_pand = bool(parcel_row.get("has_pand"))
        if not has_pand:
            if not _is_missing_address(current_address):
                await db.execute(
                    sa_update(ParcelCache)
                    .where(
                        ParcelCache.id == parcel_id,
                    )
                    .values(address=None)
                )
                await db.commit()
            return None

        if not _is_missing_address(current_address):
            return current_address

        geometry_raw = parcel_row.get("geometry_raw")
        if not isinstance(geometry_raw, str) or not geometry_raw.strip():
            return current_address
        try:
            parcel_geometry = json.loads(geometry_raw)
        except json.JSONDecodeError:
            return current_address
        if not isinstance(parcel_geometry, dict):
            return current_address

        lookup_point = await find_bag_building_lookup_point(parcel_geometry, http_client)
        if lookup_point is None:
            return current_address

        normalized_address = await reverse_geocode_rd_point(lookup_point, http_client)
        if not normalized_address:
            return current_address

        await db.execute(
            sa_update(ParcelCache)
            .where(
                ParcelCache.id == parcel_id,
            )
            .values(address=normalized_address)
        )
        await db.commit()
        return normalized_address
    except Exception as e:
        logger.debug(
            "Reverse geocode fallback failed for parcel %s: %s",
            parcel_id,
            e,
        )
        return current_address


def _filter_vergunningen_for_parcel(
    records: list[dict],
    address: str | None,
    postcode: str,
) -> list[dict]:
    """
    Filter postcode-level SRU records down to parcel-level likely matches.

    SRU postcode queries can return many items for the entire postcode area.
    We prioritize precision by matching straat + huisnummer in title where possible.
    """
    street, house_number = _parse_address_components(address)
    postcode_compact = postcode.replace(" ", "").lower()

    # Deduplicate on identifier first.
    deduped: list[dict] = []
    seen_ids: set[str] = set()
    for record in records:
        identifier = str(record.get("identifier") or "").strip()
        key = identifier if identifier else str(record)
        if key in seen_ids:
            continue
        seen_ids.add(key)
        deduped.append(record)

    if not street and not house_number:
        return deduped

    strict_matches: list[dict] = []
    soft_matches: list[dict] = []

    for record in deduped:
        title = str(record.get("title") or "").lower()
        rtype = str(record.get("type") or "").lower()
        text = f"{title} {rtype}"
        text_compact = re.sub(r"\s+", "", text)

        postcode_match = postcode_compact in text_compact
        street_match = bool(street and street in text)
        number_match = bool(
            house_number and
            re.search(rf"\b{re.escape(house_number)}\b", text)
        )

        if street_match and number_match:
            strict_matches.append(record)
        elif number_match and postcode_match:
            soft_matches.append(record)

    if strict_matches:
        return strict_matches
    if soft_matches:
        return soft_matches
    return []


def _extract_listing_signal_from_enrichment(enrichment_data: dict | None) -> dict | None:
    """Extract normalized listing signal from optional enrichment payload."""
    if not isinstance(enrichment_data, dict):
        return None

    # Preferred explicit block if present.
    listing = enrichment_data.get("listing_signal")
    if isinstance(listing, dict):
        return listing

    # Backward-compatible flattening from top-level keys.
    duration = (
        enrichment_data.get("listing_duration_days")
        or enrichment_data.get("listing_days_on_market")
        or enrichment_data.get("days_on_market")
    )
    price_changes = (
        enrichment_data.get("price_change_count")
        or enrichment_data.get("listing_price_change_count")
    )

    if duration is None and price_changes is None:
        return None

    return {
        "listing_duration_days": duration,
        "price_change_count": price_changes,
    }


def _normalize_market_signals(raw: object) -> dict[str, int] | None:
    if not isinstance(raw, dict):
        return None
    known_keys = (
        "listing_duration_days",
        "price_change_count",
        "listing_snapshots_count",
        "days_since_last_seen",
    )
    if not any(key in raw for key in known_keys):
        return None

    def _to_non_negative_int(value: object) -> int:
        if isinstance(value, bool):
            return 1 if value else 0
        if isinstance(value, int):
            return max(0, value)
        if isinstance(value, float):
            if value != value:
                return 0
            return max(0, int(value))
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return 0
            try:
                return max(0, int(float(stripped)))
            except ValueError:
                return 0
        return 0

    return {
        "listing_duration_days": _to_non_negative_int(raw.get("listing_duration_days")),
        "price_change_count": _to_non_negative_int(raw.get("price_change_count")),
        "listing_snapshots_count": _to_non_negative_int(raw.get("listing_snapshots_count")),
        "days_since_last_seen": _to_non_negative_int(raw.get("days_since_last_seen")),
    }


async def _build_permit_activity_map(
    parcel_ids: list[uuid.UUID],
    db: AsyncSession,
) -> dict[uuid.UUID, dict[str, int]]:
    """Aggregate permit activity per parcel for vacancy confidence modeling."""
    if not parcel_ids:
        return {}

    now = datetime.utcnow()
    cutoff_180d = now - timedelta(days=180)
    cutoff_365d = now - timedelta(days=365)
    cutoff_730d = now - timedelta(days=730)

    rows = await db.execute(
        select(
            ChangeRecord.matched_parcel_id,
            ChangeRecord.change_date,
            ChangeRecord.title,
        ).where(
            ChangeRecord.change_type == "permit",
            ChangeRecord.matched_parcel_id.in_(parcel_ids),
            ChangeRecord.change_date >= cutoff_730d,
        )
    )

    activity: dict[uuid.UUID, dict[str, int]] = {}
    for matched_parcel_id, change_date, title in rows.all():
        if matched_parcel_id is None or change_date is None:
            continue

        stats = activity.setdefault(
            matched_parcel_id,
            {
                "permit_count_180d": 0,
                "permit_count_365d": 0,
                "permit_count_730d": 0,
                "demolition_count_365d": 0,
                "granted_count_365d": 0,
            },
        )
        stats["permit_count_730d"] += 1

        normalized_date = (
            change_date.replace(tzinfo=None)
            if getattr(change_date, "tzinfo", None) is not None
            else change_date
        )
        lower_title = (title or "").lower()

        if normalized_date >= cutoff_365d:
            stats["permit_count_365d"] += 1

            if any(token in lower_title for token in ("sloop", "slopen", "gesloopt")):
                stats["demolition_count_365d"] += 1

            if any(token in lower_title for token in ("verleend", "vergunning verleend")):
                stats["granted_count_365d"] += 1

        if normalized_date >= cutoff_180d:
            stats["permit_count_180d"] += 1

    return activity

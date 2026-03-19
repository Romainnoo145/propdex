"""Zoning aggregation service combining DSO API and spatial analysis."""

import html
import logging
import re
from typing import Any

import httpx
from shapely.geometry import Point, shape
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.dso_spatial_plans import get_dso_client
from app.government_apis.plu_wfs import plu_wms_client
from app.schemas.zoning import (
    BuildingDimensions,
    FunctieAanduiding,
    GebiedsAanduiding,
    PlanTekst,
    ZoningData,
    ZoningPlan,
    ZoningRule,
)
from app.services.cache_manager import get_cached_or_fetch

logger = logging.getLogger(__name__)


def _strip_html(text: str) -> str:
    """Strip HTML tags and decode entities from XHTML text."""
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = html.unescape(clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _to_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None
    matches = re.findall(r"-?\d+(?:[.,]\d+)?", value)
    if not matches:
        return None
    try:
        return float(matches[0].replace(",", "."))
    except ValueError:
        return None


def _extract_numeric_values(text: str) -> list[float]:
    values: list[float] = []
    for match in re.findall(r"-?\d+(?:[.,]\d+)?", text):
        try:
            values.append(float(match.replace(",", ".")))
        except ValueError:
            continue
    return values


def _max_existing(current: float | None, candidate: float | None) -> float | None:
    if candidate is None:
        return current
    if current is None:
        return candidate
    return max(current, candidate)


def _extract_tar_far_from_text(text: str) -> tuple[float | None, float | None]:
    """
    Extract TAR/FAR-style metrics from free text (maatvoering/planregels).

    Heuristic parsing only; values are filtered to realistic ranges.
    """
    lower = text.lower()
    max_bebouwingspercentage: float | None = None
    max_far: float | None = None

    tar_patterns = [
        r"bebouwingspercentage[^0-9]{0,24}(\d{1,3}(?:[.,]\d+)?)\s*%?",
        r"(\d{1,3}(?:[.,]\d+)?)\s*%?[^.\n]{0,40}bebouwingspercentage",
    ]
    for pattern in tar_patterns:
        for raw_value in re.findall(pattern, lower):
            try:
                value = float(raw_value.replace(",", "."))
            except ValueError:
                continue
            if 0 < value <= 100:
                max_bebouwingspercentage = _max_existing(max_bebouwingspercentage, value)

    far_patterns = [
        r"(?:\bfsi\b|\bfar\b|vloer(?:index|factor|oppervlakteverhouding)|floor area ratio)[^0-9]{0,24}(\d{1,2}(?:[.,]\d+)?)",
        r"(\d{1,2}(?:[.,]\d+)?)[^.\n]{0,24}(?:\bfsi\b|\bfar\b|vloer(?:index|factor|oppervlakteverhouding)|floor area ratio)",
    ]
    for pattern in far_patterns:
        for raw_value in re.findall(pattern, lower):
            try:
                value = float(raw_value.replace(",", "."))
            except ValueError:
                continue
            if 0 < value <= 12:
                max_far = _max_existing(max_far, value)

    return max_bebouwingspercentage, max_far


def _merge_building_dimensions(
    base: BuildingDimensions | None,
    supplement: BuildingDimensions | None,
) -> BuildingDimensions | None:
    if supplement is None or not supplement.has_any_data:
        return base
    if base is None or not base.has_any_data:
        return supplement.model_copy(deep=True)

    merged = base.model_copy(deep=True)
    merged.max_hoogte = _max_existing(merged.max_hoogte, supplement.max_hoogte)
    merged.max_bouwhoogte = _max_existing(merged.max_bouwhoogte, supplement.max_bouwhoogte)
    merged.max_goothoogte = _max_existing(merged.max_goothoogte, supplement.max_goothoogte)
    merged.max_bebouwingspercentage = _max_existing(
        merged.max_bebouwingspercentage,
        supplement.max_bebouwingspercentage,
    )
    merged.max_floor_area_ratio = _max_existing(
        merged.max_floor_area_ratio,
        supplement.max_floor_area_ratio,
    )
    if supplement.max_bouwlagen is not None:
        if merged.max_bouwlagen is None:
            merged.max_bouwlagen = supplement.max_bouwlagen
        else:
            merged.max_bouwlagen = max(merged.max_bouwlagen, supplement.max_bouwlagen)
    return merged


def _extract_dimensions_from_plan_texts(teksten_raw: list[dict]) -> BuildingDimensions:
    """Extract TAR/FAR hints from article texts when DSO maatvoeringen are incomplete."""
    dimensions = BuildingDimensions()

    for tekst in teksten_raw[:40]:
        raw_text = str(tekst.get("tekst") or tekst.get("inhoud") or "")
        if not raw_text:
            continue
        cleaned_text = _strip_html(raw_text)
        tar, far = _extract_tar_far_from_text(cleaned_text)
        dimensions.max_bebouwingspercentage = _max_existing(
            dimensions.max_bebouwingspercentage,
            tar,
        )
        dimensions.max_floor_area_ratio = _max_existing(
            dimensions.max_floor_area_ratio,
            far,
        )

    return dimensions


def _extract_dimensions_from_plu(bestemmingen: list[dict] | None) -> BuildingDimensions:
    """Extract TAR/FAR from PLU WMS fallback payload."""
    dimensions = BuildingDimensions()
    if not bestemmingen:
        return dimensions

    for bestemming in bestemmingen:
        if not isinstance(bestemming, dict):
            continue
        tar = _to_float(bestemming.get("max_bebouwingspercentage"))
        far = _to_float(bestemming.get("max_floor_area_ratio"))

        if tar is not None and 0 < tar <= 100:
            dimensions.max_bebouwingspercentage = _max_existing(
                dimensions.max_bebouwingspercentage,
                tar,
            )
        if far is not None and 0 < far <= 12:
            dimensions.max_floor_area_ratio = _max_existing(
                dimensions.max_floor_area_ratio,
                far,
            )

        text_blob = " ".join(
            str(bestemming.get(field, ""))
            for field in ("naam", "type", "maatvoering", "aanduiding", "omschrijving")
        )
        tar_from_text, far_from_text = _extract_tar_far_from_text(text_blob)
        dimensions.max_bebouwingspercentage = _max_existing(
            dimensions.max_bebouwingspercentage,
            tar_from_text,
        )
        dimensions.max_floor_area_ratio = _max_existing(
            dimensions.max_floor_area_ratio,
            far_from_text,
        )

    return dimensions


def _find_containing_features(
    property_point: Point,
    features: list[dict],
    geometry_key: str = "geometrie",
) -> list[dict]:
    """
    Filter features to those containing the property point.

    Args:
        property_point: shapely Point for property location
        features: List of feature dicts with GeoJSON geometry
        geometry_key: Key name for geometry in feature dict

    Returns:
        list[dict]: Features whose geometry contains or intersects the point
    """
    containing = []

    for feature in features:
        try:
            geometry_data = feature.get(geometry_key)
            if not geometry_data:
                continue

            # Convert GeoJSON to shapely geometry
            geom = shape(geometry_data)

            # Check if point is within or intersects geometry
            if geom.contains(property_point) or geom.intersects(property_point):
                containing.append(feature)

        except Exception as e:
            logger.warning(f"Failed to process feature geometry: {e}")
            continue

    return containing


def _extract_building_dimensions(
    maatvoeringen: list[dict],
    property_point: Point,
) -> BuildingDimensions:
    """
    Extract building dimensions from maatvoeringen that contain the property point.

    Args:
        maatvoeringen: List of maatvoering dicts from DSO API
        property_point: shapely Point for property location

    Returns:
        BuildingDimensions: Extracted dimension constraints
    """
    # Filter to maatvoeringen containing the property point
    relevant = _find_containing_features(property_point, maatvoeringen)
    dimensions = BuildingDimensions()

    for maatvoering in relevant:
        naam = str(maatvoering.get("naam", "")).lower()
        waarde = _to_float(maatvoering.get("waarde"))

        text_blob = " ".join(
            str(maatvoering.get(field, ""))
            for field in ("naam", "waarde", "maatvoering", "aanduiding", "omschrijving")
        )
        tar_from_text, far_from_text = _extract_tar_far_from_text(text_blob)
        dimensions.max_bebouwingspercentage = _max_existing(
            dimensions.max_bebouwingspercentage,
            tar_from_text,
        )
        dimensions.max_floor_area_ratio = _max_existing(
            dimensions.max_floor_area_ratio,
            far_from_text,
        )

        # Height-like measures are still extracted from direct value fields.
        if waarde is not None:
            if any(kw in naam for kw in ("bouwlagen", "bouwlaag", "verdieping", "woonlagen")) and 1 < waarde <= 50:
                bouwlagen_int = max(int(round(waarde)), 1)
                if dimensions.max_bouwlagen is None:
                    dimensions.max_bouwlagen = bouwlagen_int
                else:
                    dimensions.max_bouwlagen = max(dimensions.max_bouwlagen, bouwlagen_int)
            elif "bouwhoogte" in naam:
                dimensions.max_bouwhoogte = _max_existing(dimensions.max_bouwhoogte, waarde)
            elif "goothoogte" in naam:
                dimensions.max_goothoogte = _max_existing(dimensions.max_goothoogte, waarde)
            elif "hoogte" in naam:
                dimensions.max_hoogte = _max_existing(dimensions.max_hoogte, waarde)
            elif "bebouwingspercentage" in naam and 0 < waarde <= 100:
                dimensions.max_bebouwingspercentage = _max_existing(
                    dimensions.max_bebouwingspercentage,
                    waarde,
                )
            elif ("fsi" in naam or "far" in naam or "vloerindex" in naam or "vloerfactor" in naam) and 0 < waarde <= 12:
                dimensions.max_floor_area_ratio = _max_existing(
                    dimensions.max_floor_area_ratio,
                    waarde,
                )

    return dimensions


def _filter_and_sort_plans(plans: list[dict]) -> list[dict]:
    """
    Filter plans to vastgesteld status and sort by relevance + date.

    Args:
        plans: List of plan dicts from DSO API

    Returns:
        list[dict]: Filtered and sorted plans
    """
    def _get_status(plan: dict) -> str:
        """Extract plan status from either v4 nested or legacy flat format."""
        # v4 format: planstatusInfo.planstatus
        info = plan.get("planstatusInfo", {})
        if isinstance(info, dict) and info.get("planstatus"):
            return info["planstatus"].lower()
        # Legacy flat format
        return (plan.get("planStatus") or "").lower()

    def _get_datum(plan: dict) -> str:
        """Extract plan datum from either v4 nested or legacy flat format."""
        info = plan.get("planstatusInfo", {})
        if isinstance(info, dict) and info.get("datum"):
            return info["datum"]
        return plan.get("datum") or ""

    def _plan_type_rank(plan: dict) -> int:
        """
        Lower rank = more relevant for perceel-level bouwregels.

        Prioritize binding local plans (bestemmingsplan/omgevingsplan) over
        policy-level plans (structuurvisie/programmas/voorbereidingsbesluiten)
        which often return no bouwvlakken or maatvoeringen for a parcel.
        """
        plan_type = (
            str(plan.get("type") or plan.get("planType") or "")
            .strip()
            .lower()
        )
        if not plan_type:
            return 5
        if "bestemmingsplan" in plan_type or "omgevingsplan" in plan_type:
            return 0
        if (
            "inpassingsplan" in plan_type
            or "beheersverordening" in plan_type
            or "wijzigingsplan" in plan_type
            or "uitwerkingsplan" in plan_type
        ):
            return 1
        if "voorbereidingsbesluit" in plan_type:
            return 3
        if "structuurvisie" in plan_type or "programma" in plan_type:
            return 4
        return 2

    # Filter to vastgesteld (finalized) plans
    vastgesteld = [p for p in plans if _get_status(p) == "vastgesteld"]

    # Fallback to ontwerp (draft) if no vastgesteld found
    if not vastgesteld:
        vastgesteld = [p for p in plans if _get_status(p) == "ontwerp"]

    # If still nothing, take all plans
    if not vastgesteld:
        vastgesteld = list(plans)

    # Sort by plan relevance first, then by datum descending.
    # This avoids selecting only national/policy plans for parcel-level analysis.
    sorted_plans = sorted(
        vastgesteld,
        key=lambda p: (_plan_type_rank(p), _get_datum(p)),
        reverse=False,
    )
    # Within the same rank, keep newest first.
    # Stable sort: apply date desc before relevance sort.
    sorted_plans = sorted(sorted_plans, key=_get_datum, reverse=True)
    sorted_plans = sorted(sorted_plans, key=_plan_type_rank)

    return sorted_plans


async def fetch_zoning_data(
    x: float,
    y: float,
    client: httpx.AsyncClient,
    session: AsyncSession,
    force_refresh: bool = False,
) -> ZoningData | None:
    """
    Fetch zoning data for property location from DSO API.

    Queries DSO Ruimtelijke Plannen API for spatial plans at location,
    extracts bestemmingsvlakken and maatvoeringen, performs spatial
    intersection, and aggregates zoning rules and building dimensions.

    Args:
        x: X coordinate in EPSG:28992 (RD New)
        y: Y coordinate in EPSG:28992 (RD New)
        client: Shared httpx AsyncClient from app.state
        session: SQLAlchemy async session for cache
        force_refresh: If True, bypass cache and fetch fresh data

    Returns:
        ZoningData: Aggregated zoning information, or None if no plans found

    Raises:
        GovernmentAPIError: If API requests fail
    """
    # Versioned cache key so improved plan-prioritization logic is applied
    # immediately instead of reusing legacy cached selections.
    # v4: bumped to force re-fetch and populate max_bouwlagen field
    cache_key = f"dso:zoning:v4:{x}:{y}"
    property_point = Point(x, y)

    async def _fetch() -> dict:
        """Inner fetch function for cache_manager."""
        dso_client = get_dso_client()

        # Find plans at location
        plans = await dso_client.find_plans_at_location(x, y, client)

        if not plans:
            logger.info(f"No spatial plans found at ({x}, {y})")
            return {"plans": [], "data_gaps": ["Geen bestemmingsplan gevonden op deze locatie"]}

        # Filter and sort plans
        filtered_plans = _filter_and_sort_plans(plans)

        # Process top N relevant plans
        # Keep bounded to avoid excessive DSO calls while still escaping
        # "policy-only top-3" cases.
        max_plans_to_process = 8
        zoning_plans = []
        dimension_candidates: list[BuildingDimensions] = []
        all_data_gaps = []

        for plan in filtered_plans[:max_plans_to_process]:
            plan_id = plan.get("id") or plan.get("identificatie")
            if not plan_id:
                continue

            # Extract status/datum from nested planstatusInfo or flat fields
            plan_status_info = plan.get("planstatusInfo", {})
            plan_status = (
                plan_status_info.get("planstatus")
                if isinstance(plan_status_info, dict)
                else plan.get("planStatus")
            )
            plan_datum = (
                plan_status_info.get("datum")
                if isinstance(plan_status_info, dict)
                else plan.get("datum")
            )
            plan_type = plan.get("type") or plan.get("planType")

            logger.info(f"Processing plan {plan_id}: {plan.get('naam')}")

            try:
                # Fetch all plan components sequentially (inside cache_manager)
                bestemmingsvlakken = await dso_client.get_bestemmingsvlakken(plan_id, client)
                maatvoeringen = await dso_client.get_maatvoeringen(plan_id, client)
                bouwvlakken = await dso_client.get_bouwvlakken(plan_id, client)
                functieaanduidingen_raw = await dso_client.get_functieaanduidingen(plan_id, client)
                gebiedsaanduidingen_raw = await dso_client.get_gebiedsaanduidingen(plan_id, client)

                # Only fetch teksten for the most recent plan (index 0) to limit API calls
                teksten_raw: list[dict] = []
                if plan == filtered_plans[0]:
                    try:
                        teksten_raw = await dso_client.get_teksten(plan_id, client)
                    except Exception as e:
                        logger.warning(f"Failed to fetch teksten for {plan_id}: {e}")

                # Spatial intersection - filter to features containing property point
                relevant_bestemmingen = _find_containing_features(
                    property_point,
                    bestemmingsvlakken,
                )

                relevant_bouwvlakken = _find_containing_features(
                    property_point,
                    bouwvlakken,
                )

                relevant_functies = _find_containing_features(
                    property_point,
                    functieaanduidingen_raw,
                )

                relevant_gebieden = _find_containing_features(
                    property_point,
                    gebiedsaanduidingen_raw,
                )

                # Extract building dimensions from DSO maatvoering geometries.
                dso_dimensions = _extract_building_dimensions(
                    maatvoeringen,
                    property_point,
                )
                text_dimensions = _extract_dimensions_from_plan_texts(teksten_raw)
                merged_dimensions = _merge_building_dimensions(
                    dso_dimensions,
                    text_dimensions,
                )
                if merged_dimensions is None:
                    building_dimensions = BuildingDimensions()
                else:
                    building_dimensions = merged_dimensions
                    dimension_candidates.append(building_dimensions)

                # Build zoning rules from bestemmingsvlakken
                rules = []
                for bestemming in relevant_bestemmingen:
                    rule = ZoningRule(
                        bestemming=bestemming.get("naam", "Onbekend"),
                        omschrijving=bestemming.get("omschrijving"),
                        building_dimensions=building_dimensions if building_dimensions.has_any_data else None,
                        geometry=bestemming.get("geometrie"),
                    )
                    rules.append(rule)

                # Build functie aanduidingen
                functie_aanduidingen = [
                    FunctieAanduiding(
                        naam=f.get("naam", "Onbekend"),
                        groep=f.get("functieaanduidinggroep"),
                    )
                    for f in relevant_functies
                ]

                # Build gebieds aanduidingen
                gebieds_aanduidingen = [
                    GebiedsAanduiding(
                        naam=g.get("naam", "Onbekend"),
                        groep=g.get("gebiedsaanduidinggroep"),
                    )
                    for g in relevant_gebieden
                ]

                # Build teksten (strip XHTML to plain text)
                teksten = []
                for tekst in teksten_raw[:20]:  # Limit to 20 articles
                    titel = tekst.get("titel", "")
                    inhoud = tekst.get("tekst") or tekst.get("inhoud") or ""
                    if inhoud:
                        inhoud = _strip_html(inhoud)
                    if titel:
                        teksten.append(PlanTekst(titel=titel, inhoud=inhoud or None))

                # Track data gaps
                gaps = []
                if not relevant_bestemmingen:
                    gaps.append("Geen bestemmingsvlakken op deze locatie")
                if not dso_dimensions.has_any_data:
                    if text_dimensions.has_any_data:
                        gaps.append("Maatvoeringen ontbreken; TAR/FAR afgeleid uit planregels")
                    else:
                        gaps.append("Geen maatvoeringen gevonden")
                elif (
                    text_dimensions.has_any_data
                    and (
                        dso_dimensions.max_bebouwingspercentage is None
                        or dso_dimensions.max_floor_area_ratio is None
                    )
                ):
                    gaps.append("TAR/FAR deels aangevuld uit planregels")
                if not relevant_bouwvlakken:
                    gaps.append("Geen bouwvlakken gevonden")

                all_data_gaps.extend(gaps)

                # Build ZoningPlan
                zoning_plan = ZoningPlan(
                    plan_id=plan_id,
                    plan_naam=plan.get("naam", ""),
                    plan_type=plan_type,
                    plan_status=plan_status,
                    plan_datum=plan_datum,
                    rules=rules,
                    functie_aanduidingen=functie_aanduidingen,
                    gebieds_aanduidingen=gebieds_aanduidingen,
                    teksten=teksten,
                )
                zoning_plans.append(zoning_plan)

            except Exception as e:
                logger.error(f"Failed to process plan {plan_id}: {e}")
                all_data_gaps.append(f"Fout bij verwerken plan {plan_id}")
                continue

        # Determine primary bestemming (most common across all plans)
        if zoning_plans:
            all_bestemmingen = []
            for plan in zoning_plans:
                for rule in plan.rules:
                    all_bestemmingen.append(rule.bestemming)

            if all_bestemmingen:
                # Find most common bestemming
                primary_bestemming = max(set(all_bestemmingen), key=all_bestemmingen.count)
            else:
                primary_bestemming = None
        else:
            primary_bestemming = None

        # Aggregate building dimensions across processed plans.
        # This avoids losing valid maatvoering info when a plan has no intersecting
        # bestemmingsvlak rows but does contain relevant dimension features.
        consolidated_dimensions: BuildingDimensions | None = None
        for candidate in dimension_candidates:
            consolidated_dimensions = _merge_building_dimensions(
                consolidated_dimensions,
                candidate,
            )

        # PLU fallback (single point query) when DSO did not yield TAR/FAR.
        needs_plu_fallback = (
            consolidated_dimensions is None
            or consolidated_dimensions.max_bebouwingspercentage is None
            or consolidated_dimensions.max_floor_area_ratio is None
        )
        if needs_plu_fallback:
            try:
                plu_bestemmingen = await plu_wms_client.get_bestemming_at_point(x, y, client)
                plu_dimensions = _extract_dimensions_from_plu(plu_bestemmingen)
                before_tar = consolidated_dimensions.max_bebouwingspercentage if consolidated_dimensions else None
                before_far = consolidated_dimensions.max_floor_area_ratio if consolidated_dimensions else None
                consolidated_dimensions = _merge_building_dimensions(
                    consolidated_dimensions,
                    plu_dimensions,
                )
                after_tar = consolidated_dimensions.max_bebouwingspercentage if consolidated_dimensions else None
                after_far = consolidated_dimensions.max_floor_area_ratio if consolidated_dimensions else None
                if before_tar != after_tar or before_far != after_far:
                    all_data_gaps.append("TAR/FAR deels aangevuld via PLU maatvoering")
            except Exception as e:
                logger.warning(f"PLU fallback failed at ({x}, {y}): {e}")

        if consolidated_dimensions is not None and not consolidated_dimensions.has_any_data:
            consolidated_dimensions = None

        return {
            "plans": [plan.model_dump() for plan in zoning_plans],
            "primary_bestemming": primary_bestemming,
            "building_dimensions": consolidated_dimensions.model_dump() if consolidated_dimensions else None,
            "data_gaps": list(set(all_data_gaps)),  # Remove duplicates
        }

    # Use cache manager with DSO source TTL
    cache_result = await get_cached_or_fetch(
        cache_key=cache_key,
        source="dso",
        fetch_fn=_fetch,
        session=session,
        force_refresh=force_refresh,
    )

    # Convert cached dict back to ZoningData
    data = cache_result.data

    if not data.get("plans"):
        return None

    # Reconstruct ZoningData from cached dict
    zoning_plans = [ZoningPlan(**plan) for plan in data["plans"]]

    building_dimensions = None
    if data.get("building_dimensions"):
        building_dimensions = BuildingDimensions(**data["building_dimensions"])

    return ZoningData(
        plans=zoning_plans,
        primary_bestemming=data.get("primary_bestemming"),
        building_dimensions=building_dimensions,
        data_gaps=data.get("data_gaps", []),
        source="DSO Ruimtelijke Plannen API v4",
        fallback_used=False,
    )

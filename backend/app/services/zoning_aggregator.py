"""Zoning aggregation service combining DSO API and spatial analysis."""

import html
import logging
import re
import uuid

import httpx
from shapely.geometry import Point, shape
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.dso_spatial_plans import get_dso_client
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
        # Extract maatvoering type and value
        # DSO API structure varies, look for common Dutch dimension fields
        naam = maatvoering.get("naam", "").lower()
        waarde = maatvoering.get("waarde")

        # Parse numeric value from string if needed
        if isinstance(waarde, str):
            # Extract first numeric value from string (e.g., "12.5 meter" -> 12.5)
            match = re.search(r"(\d+\.?\d*)", waarde)
            if match:
                try:
                    waarde = float(match.group(1))
                except ValueError:
                    continue
            else:
                continue

        # Map Dutch dimension terms to schema fields
        if "bouwhoogte" in naam and dimensions.max_bouwhoogte is None:
            dimensions.max_bouwhoogte = waarde
        elif "goothoogte" in naam and dimensions.max_goothoogte is None:
            dimensions.max_goothoogte = waarde
        elif "hoogte" in naam and dimensions.max_hoogte is None:
            # Generic hoogte if no specific bouwhoogte/goothoogte
            dimensions.max_hoogte = waarde
        elif "bebouwingspercentage" in naam and dimensions.max_bebouwingspercentage is None:
            dimensions.max_bebouwingspercentage = waarde
        elif "fsi" in naam or "vloeroppervlakte" in naam:
            if dimensions.max_floor_area_ratio is None:
                dimensions.max_floor_area_ratio = waarde

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
    organization_id: uuid.UUID,
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
        organization_id: Tenant ID for cache isolation
        session: SQLAlchemy async session for cache
        force_refresh: If True, bypass cache and fetch fresh data

    Returns:
        ZoningData: Aggregated zoning information, or None if no plans found

    Raises:
        GovernmentAPIError: If API requests fail
    """
    # Versioned cache key so improved plan-prioritization logic is applied
    # immediately instead of reusing legacy cached selections.
    cache_key = f"dso:zoning:v2:{x}:{y}"
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

                # Extract building dimensions from maatvoeringen
                building_dimensions = _extract_building_dimensions(
                    maatvoeringen,
                    property_point,
                )

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
                if not building_dimensions.has_any_data:
                    gaps.append("Geen maatvoeringen gevonden")
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

        # Aggregate building dimensions (take first available)
        consolidated_dimensions = None
        for plan in zoning_plans:
            for rule in plan.rules:
                if rule.building_dimensions and rule.building_dimensions.has_any_data:
                    consolidated_dimensions = rule.building_dimensions
                    break
            if consolidated_dimensions:
                break

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
        organization_id=organization_id,
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

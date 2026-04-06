"""Property data aggregation service with parallel API fetching."""

import asyncio
import logging
import re
from datetime import date, datetime

import httpx
from arq import ArqRedis
from fastapi import HTTPException, status
from shapely.geometry import Point, shape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import AIParsingSection
from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.government_apis.brk_bevragen import brk_client
from app.government_apis.ep_online import ep_online_client
from app.government_apis.pdok_cadastral import PDOKCadastralClient
from app.government_apis.rce_monuments import rd_to_wgs84
from app.government_apis.woz_waardeloket import woz_waardeloket_client
from app.models.funda_listing_snapshot import FundaListingSnapshot
from app.schemas.address import AddressInput, BuildingData
from app.schemas.bodem import BodemData
from app.schemas.brk_ownership import (
    Beslag,
    BRKOwnership,
    Hypotheek,
    PerceelOwnership,
    ZakelijkGerechtigde,
)
from app.schemas.energy_label import EnergyLabel
from app.schemas.fysiek_risico import FunderingsrisicogebiedData, SoilProfile
from app.schemas.monument import MonumentStatus
from app.schemas.property import (
    AsbestIndicator,
    BuildabilityDelta,
    CadastralParcel,
    DataSourceInfo,
    MapData,
    MarketSignals,
    PermitPrecedentBenchmark,
    PropertyReportResponse,
    SectionSourceInfo,
    WkbClassification,
    WkbPrecheck,
)
from app.schemas.woz import WOZData
from app.schemas.zoning import ZoningData
from app.services.address_resolver import resolve_address
from app.services.asbest_indicator import assess_asbest_risk
from app.services.bodem_aggregator import fetch_bodem_data as _fetch_bodem
from app.services.cache_manager import get_cached_or_fetch
from app.services.foundation_risk_engine import (
    assess_foundation_risk,
    build_fysiek_risico_profiel,
    estimate_kcaf_cost,
)
from app.services.funderingsrisico_aggregator import fetch_funderingsrisico_data
from app.services.monument_aggregator import fetch_monument_status
from app.services.permit_precedent_benchmark import build_permit_precedent_benchmark
from app.services.plan_aggregator import get_cached_plan_only, get_primary_plan_idn
from app.services.soil_aggregator import fetch_soil_profile
from app.services.wkb_classifier import classify_wkb
from app.services.wkb_precheck import evaluate_wkb_precheck
from app.services.zoning_aggregator import fetch_zoning_data

logger = logging.getLogger(__name__)

# Module-level singleton
_cadastral_client = PDOKCadastralClient()
_HOUSE_NUMBER_RE = re.compile(r"(\d+)")
_NUMERIC_VALUE_RE = re.compile(r"-?\d+(?:[.,]\d+)?")


def _nearest_parcel(parcels: list, point: "Point") -> object | None:
    """Return the parcel whose geometry centroid is nearest to *point*.

    Skips parcels with invalid or missing geometry.  Returns ``None`` when
    no valid candidate exists.
    """
    best, best_dist = None, float("inf")
    for parcel in parcels:
        try:
            geom = shape(parcel.geometry)
            dist = geom.centroid.distance(point)
            if dist < best_dist:
                best, best_dist = parcel, dist
        except Exception:
            continue
    return best


def _extract_rd_coordinates(geometry: dict | None) -> tuple[float, float] | None:
    """
    Extract a robust RD point from BAG GeoJSON geometry.

    Prefer geometric centroid for polygons/multipolygons. This avoids selecting
    an edge vertex (old behavior) that can miss parcel-level DSO intersections.
    """
    if not isinstance(geometry, dict):
        return None

    coordinates_data = geometry.get("coordinates")
    geometry_type = geometry.get("type")

    if geometry_type == "Point" and isinstance(coordinates_data, list) and len(coordinates_data) >= 2:
        try:
            return float(coordinates_data[0]), float(coordinates_data[1])
        except (TypeError, ValueError):
            return None

    try:
        geom = shape(geometry)
        if geom.is_empty:
            return None
        centroid = geom.centroid
        return float(centroid.x), float(centroid.y)
    except Exception:
        # Fallback for malformed polygon payloads.
        if geometry_type == "Polygon" and coordinates_data:
            try:
                first_point = coordinates_data[0][0]
                return float(first_point[0]), float(first_point[1])
            except Exception:
                return None
        return None


def _extract_house_number(value: str | None) -> int | None:
    """Parse first house-number sequence from free-form string."""
    if not isinstance(value, str) or not value.strip():
        return None
    match = _HOUSE_NUMBER_RE.search(value)
    if not match:
        return None
    try:
        number = int(match.group(1))
    except ValueError:
        return None
    return number if number > 0 else None


def _extract_numeric_values(text: str) -> list[float]:
    values: list[float] = []
    for raw in _NUMERIC_VALUE_RE.findall(text):
        try:
            values.append(float(raw.replace(",", ".")))
        except ValueError:
            continue
    return values


def _extract_tar_far_from_text(text: str) -> tuple[float | None, float | None]:
    lower = text.lower()
    tar: float | None = None
    far: float | None = None

    if "bebouwingspercentage" in lower:
        candidates = [v for v in _extract_numeric_values(lower) if 0 < v <= 100]
        if candidates:
            tar = max(candidates)

    if any(
        token in lower
        for token in (
            " fsi",
            "fsi ",
            " far",
            "far ",
            "vloerfactor",
            "vloerindex",
            "vloeroppervlakteverhouding",
            "floor area ratio",
        )
    ):
        candidates = [v for v in _extract_numeric_values(lower) if 0 < v <= 12]
        if candidates:
            far = max(candidates)

    return tar, far


def _ai_confidence_to_limit_confidence(overall_confidence: str | None) -> str:
    """
    Map AI parsing certainty to limit-source confidence conservatively.

    AI-derived TAR/FAR remains inferred text extraction, so we cap at medium.
    """
    if overall_confidence == "HIGH":
        return "medium"
    return "low"


def _extract_ai_limit_candidates(
    ai_parsing_section: AIParsingSection | None,
) -> tuple[float | None, float | None, str | None]:
    """
    Extract TAR/FAR candidates from AI-parsed plan rules.

    Returns (tar, far, confidence) where confidence is the source confidence
    for AI-derived limits (independent from overall buildability confidence).
    """
    if (
        ai_parsing_section is None
        or ai_parsing_section.status != "complete"
        or ai_parsing_section.parsed_plan is None
    ):
        return None, None, None

    tar_candidates: list[float] = []
    far_candidates: list[float] = []

    for regel in ai_parsing_section.parsed_plan.regels:
        bouwregels = regel.bouwregels
        if bouwregels is None:
            continue

        if (
            bouwregels.max_bebouwingspercentage is not None
            and 0 < bouwregels.max_bebouwingspercentage <= 100
        ):
            tar_candidates.append(float(bouwregels.max_bebouwingspercentage))

        max_far_direct = getattr(bouwregels, "max_floor_area_ratio", None)
        if max_far_direct is not None and 0 < max_far_direct <= 12:
            far_candidates.append(float(max_far_direct))

        for key, value in (bouwregels.overige or {}).items():
            tar, far = _extract_tar_far_from_text(f"{key} {value}")
            if tar is not None:
                tar_candidates.append(tar)
            if far is not None:
                far_candidates.append(far)

    tar_value = max(tar_candidates) if tar_candidates else None
    far_value = max(far_candidates) if far_candidates else None
    if tar_value is None and far_value is None:
        return None, None, None

    source_confidence = _ai_confidence_to_limit_confidence(
        ai_parsing_section.parsed_plan.overall_confidence
    )
    return tar_value, far_value, source_confidence


async def _fetch_market_signals(
    *,
    postcode: str | None,
    huisnummer: int | None,
    city: str | None,
    session: AsyncSession,
) -> MarketSignals | None:
    """
    Resolve Funda listing behavior for a single address.

    Matching strategy:
    - strict postcode match (normalized, no spaces)
    - strict numeric house-number match
    - optional city pre-filter when available
    """
    if not postcode or not huisnummer or huisnummer <= 0:
        return None

    postcode_norm = postcode.upper().replace(" ", "")
    city_norm = city.lower().strip() if isinstance(city, str) and city.strip() else None

    query = select(
        FundaListingSnapshot.listing_external_id,
        FundaListingSnapshot.snapshot_date,
        FundaListingSnapshot.price_eur,
        FundaListingSnapshot.house_number,
    ).where(
        FundaListingSnapshot.source == "funda",
        func.upper(func.replace(func.coalesce(FundaListingSnapshot.postcode, ""), " ", ""))
        == postcode_norm,
    )
    if city_norm:
        query = query.where(func.lower(func.coalesce(FundaListingSnapshot.city, "")) == city_norm)

    rows = (await session.execute(query)).all()
    if not rows:
        return None

    # Strictly match house-number to avoid cross-address contamination.
    filtered = [
        row for row in rows if _extract_house_number(row.house_number) == huisnummer
    ]
    if not filtered:
        return None

    grouped: dict[str, dict[str, object]] = {}
    for row in filtered:
        listing_id = row.listing_external_id
        snapshot_date = row.snapshot_date
        if not listing_id or snapshot_date is None:
            continue

        state = grouped.setdefault(
            listing_id,
            {
                "first_seen": snapshot_date,
                "last_seen": snapshot_date,
                "prices": set(),
                "snapshots": 0,
            },
        )
        if snapshot_date < state["first_seen"]:
            state["first_seen"] = snapshot_date
        if snapshot_date > state["last_seen"]:
            state["last_seen"] = snapshot_date
        if isinstance(row.price_eur, int) and row.price_eur > 0:
            state["prices"].add(row.price_eur)
        state["snapshots"] = int(state["snapshots"]) + 1

    if not grouped:
        return None

    # Use most recently observed listing for address-level signals.
    selected = max(grouped.values(), key=lambda s: s["last_seen"])
    first_seen: date = selected["first_seen"]
    last_seen: date = selected["last_seen"]
    prices: set[int] = selected["prices"]
    snapshots = int(selected["snapshots"])

    return MarketSignals(
        listing_duration_days=max(0, (last_seen - first_seen).days + 1),
        price_change_count=max(0, len(prices) - 1),
        listing_snapshots_count=max(0, snapshots),
        days_since_last_seen=max(0, (date.today() - last_seen).days),
        source="funda",
    )


def _derive_buildability_delta(
    *,
    cadastral_parcels: list[CadastralParcel],
    building: BuildingData | None,
    zoning_data: ZoningData | None,
    ai_parsing_section: AIParsingSection | None = None,
) -> BuildabilityDelta | None:
    """Compute a normalized current-vs-allowed build envelope with explicit confidence."""
    parcel_areas = [
        float(parcel.oppervlakte)
        for parcel in cadastral_parcels
        if parcel.oppervlakte is not None and parcel.oppervlakte > 0
    ]
    parcel_area_m2 = sum(parcel_areas) if parcel_areas else None

    current_built_area_m2 = None
    if building and building.oppervlakte is not None and building.oppervlakte > 0:
        current_built_area_m2 = float(building.oppervlakte)

    dims = zoning_data.building_dimensions if zoning_data else None
    dso_tar = None
    dso_far = None
    if dims and dims.max_bebouwingspercentage is not None and dims.max_bebouwingspercentage > 0:
        dso_tar = float(dims.max_bebouwingspercentage)
    if dims and dims.max_floor_area_ratio is not None and dims.max_floor_area_ratio > 0:
        dso_far = float(dims.max_floor_area_ratio)

    ai_tar, ai_far, ai_limit_confidence = _extract_ai_limit_candidates(ai_parsing_section)

    max_bebouwingspercentage_pct = dso_tar
    max_far = dso_far
    used_ai_tar = False
    used_ai_far = False
    if max_bebouwingspercentage_pct is None and ai_tar is not None:
        max_bebouwingspercentage_pct = ai_tar
        used_ai_tar = True
    if max_far is None and ai_far is not None:
        max_far = ai_far
        used_ai_far = True

    used_dso_tar = dso_tar is not None
    used_dso_far = dso_far is not None
    used_ai_any = used_ai_tar or used_ai_far
    used_dso_any = used_dso_tar or used_dso_far

    limit_source: str | None = None
    limit_confidence: str | None = None
    if used_dso_any and used_ai_any:
        limit_source = "DSO maatvoering + AI planregels"
        limit_confidence = "medium"
    elif used_dso_any:
        limit_source = "DSO maatvoering"
        limit_confidence = "high" if used_dso_tar and used_dso_far else "medium"
    elif used_ai_any:
        limit_source = "AI planregels"
        limit_confidence = ai_limit_confidence or "low"

    if (
        parcel_area_m2 is None
        and current_built_area_m2 is None
        and max_bebouwingspercentage_pct is None
        and max_far is None
    ):
        return None

    current_built_ratio_pct = None
    current_far = None
    if parcel_area_m2 and current_built_area_m2 is not None:
        current_built_ratio_pct = (current_built_area_m2 / parcel_area_m2) * 100.0
        current_far = current_built_area_m2 / parcel_area_m2

    max_buildable_area_m2 = None
    if parcel_area_m2 and max_bebouwingspercentage_pct is not None:
        max_buildable_area_m2 = (max_bebouwingspercentage_pct / 100.0) * parcel_area_m2

    remaining_buildable_area_m2 = None
    if max_buildable_area_m2 is not None and current_built_area_m2 is not None:
        remaining_buildable_area_m2 = max_buildable_area_m2 - current_built_area_m2

    remaining_far = None
    if max_far is not None and current_far is not None:
        remaining_far = max_far - current_far

    has_limit = max_bebouwingspercentage_pct is not None or max_far is not None
    if parcel_area_m2 is not None and current_built_area_m2 is not None and has_limit:
        confidence: str = "high"
    elif parcel_area_m2 is not None and has_limit:
        confidence = "medium"
    else:
        confidence = "low"

    missing_fields: list[str] = []
    if parcel_area_m2 is None:
        missing_fields.append("parcel_area_m2")
    if current_built_area_m2 is None:
        missing_fields.append("current_built_area_m2")
    if max_bebouwingspercentage_pct is None:
        missing_fields.append("max_bebouwingspercentage_pct")
    if max_far is None:
        missing_fields.append("max_far")

    notes: list[str] = []
    if current_built_area_m2 is not None:
        notes.append(
            "Gebruiksoppervlakte (BAG VBO) gebruikt als proxy voor huidig bebouwd oppervlak."
        )
    if len(cadastral_parcels) > 1 and parcel_area_m2 is not None:
        notes.append("Meerdere gekoppelde percelen samengevoegd voor totale perceeloppervlakte.")
    if used_ai_any:
        notes.append("TAR/FAR deels aangevuld via AI-geparseerde planregels.")
    if max_bebouwingspercentage_pct is None and max_far is None:
        notes.append("Geen expliciete FAR/TAR-limieten gevonden in beschikbare planregels.")
    if remaining_buildable_area_m2 is not None and remaining_buildable_area_m2 < 0:
        notes.append("Huidige benadering ligt boven de gevonden bebouwingslimiet.")
    if remaining_far is not None and remaining_far < 0:
        notes.append("Huidige benadering ligt boven de gevonden FAR-limiet.")

    return BuildabilityDelta(
        parcel_area_m2=round(parcel_area_m2, 1) if parcel_area_m2 is not None else None,
        current_built_area_m2=(
            round(current_built_area_m2, 1) if current_built_area_m2 is not None else None
        ),
        current_built_ratio_pct=(
            round(current_built_ratio_pct, 1) if current_built_ratio_pct is not None else None
        ),
        max_bebouwingspercentage_pct=(
            round(max_bebouwingspercentage_pct, 1)
            if max_bebouwingspercentage_pct is not None
            else None
        ),
        max_buildable_area_m2=(
            round(max_buildable_area_m2, 1) if max_buildable_area_m2 is not None else None
        ),
        remaining_buildable_area_m2=(
            round(remaining_buildable_area_m2, 1)
            if remaining_buildable_area_m2 is not None
            else None
        ),
        current_far=round(current_far, 3) if current_far is not None else None,
        max_far=round(max_far, 3) if max_far is not None else None,
        remaining_far=round(remaining_far, 3) if remaining_far is not None else None,
        limit_source=limit_source,
        limit_confidence=limit_confidence,  # type: ignore[arg-type]
        confidence=confidence,
        missing_fields=missing_fields,
        notes=notes,
    )


def _parse_perceel_ownership(raw: dict, perceel_id: str) -> PerceelOwnership:
    """Parse a single perceel's BRK eigendom response into PerceelOwnership.

    CRITICAL: Never log response payload — only log parse outcome count.
    Extracts gerechtigden (rights holders) and hypotheek indicator from BRK V2 response.

    Args:
        raw: Raw dict from BRK get_eigendom() response
        perceel_id: kadastraalOnroerendeZaakIdentificatie for this perceel

    Returns:
        PerceelOwnership: Parsed ownership data for this perceel
    """
    embedded = raw.get("_embedded", {})
    raw_gerechtigden = embedded.get("zakelijkGerechtigden", [])

    gerechtigden: list[ZakelijkGerechtigde] = []
    heeft_hypotheek = False

    for item in raw_gerechtigden:
        # Determine eigenaar_type from persoon.type
        persoon = item.get("persoon", {})
        persoon_type = persoon.get("type", "")
        if persoon_type == "NatuurlijkPersoon":
            eigenaar_type = "natuurlijk_persoon"
        elif persoon_type == "NietNatuurlijkPersoon":
            eigenaar_type = "rechtspersoon"
        else:
            eigenaar_type = "onbekend"

        # Detect overheid (gemeente, waterschap, provincie, staat)
        # BRK marks government bodies as NietNatuurlijkPersoon but with specific beschikkingsbevoegdheid
        beschikkings = item.get("beschikkingsbevoegdheid", {})
        if beschikkings.get("code") in ("PubliekrechtelijkRechtspersoon",):
            eigenaar_type = "overheid"
        # Fallback: detect overheid from naam patterns
        naam_val = persoon.get("statutaireNaam") or persoon.get("naam") or ""
        if any(kw in naam_val.lower() for kw in ("gemeente ", "waterschap ", "provincie ", "staat der nederlanden", "rijksvastgoedbedrijf")):
            eigenaar_type = "overheid"

        # Extract naam (ONLY for rechtspersoon/overheid — NEVER for natuurlijk_persoon, AVG)
        naam: str | None = None
        kvk_nummer: str | None = None
        statutaire_zetel: str | None = None
        if eigenaar_type in ("rechtspersoon", "overheid"):
            naam = persoon.get("statutaireNaam") or persoon.get("naam")
            kvk_nummer = persoon.get("kvkNummer")
            statutaire_zetel = persoon.get("statutaireZetel")

        # Extract right type
        zakelijk_recht_type = item.get("type")

        # Extract aandeel fraction
        aandeel_data = item.get("aandeel", {})
        aandeel: str | None = None
        if aandeel_data:
            teller = aandeel_data.get("teller")
            noemer = aandeel_data.get("noemer")
            if teller is not None and noemer is not None:
                aandeel = f"{teller}/{noemer}"

        # Extract koopsom (most recent transaction price)
        koopsom: int | None = None
        koopjaar: int | None = None
        stukken = item.get("stukken", [])
        for stuk in stukken:
            ks = stuk.get("koopsom", {})
            if ks.get("koopsom"):
                koopsom = int(ks["koopsom"])
                koopjaar = ks.get("koopjaar")
                break
        # Also check top-level koopsom on the item
        if koopsom is None:
            top_ks = item.get("koopsom", {})
            if top_ks and top_ks.get("koopsom"):
                koopsom = int(top_ks["koopsom"])
                koopjaar = top_ks.get("koopjaar")

        # Check if this is a hypotheek registration
        if zakelijk_recht_type and "Hypotheek" in zakelijk_recht_type:
            heeft_hypotheek = True

        gerechtigden.append(
            ZakelijkGerechtigde(
                eigenaar_type=eigenaar_type,  # type: ignore[arg-type]
                naam=naam,
                kvk_nummer=kvk_nummer,
                statutaire_zetel=statutaire_zetel,
                zakelijk_recht_type=zakelijk_recht_type,
                aandeel=aandeel,
                koopsom=koopsom,
                koopjaar=koopjaar,
            )
        )

    logger.info(
        "BRK parse outcome: perceel=%s, gerechtigden=%d, heeft_hypotheek=%s",
        perceel_id,
        len(gerechtigden),
        heeft_hypotheek,
    )

    return PerceelOwnership(
        perceel_identificatie=perceel_id,
        gerechtigden=gerechtigden,
        heeft_hypotheek=heeft_hypotheek,
    )


def _parse_hypotheken(raw: dict) -> list[Hypotheek]:
    """Parse BRK hypotheken endpoint response.

    CRITICAL: Never log response payload.
    """
    embedded = raw.get("_embedded", {})
    raw_items = embedded.get("hypotheken", [])
    results: list[Hypotheek] = []

    for item in raw_items:
        # Extract hypotheekhouder naam (only rechtspersoon — AVG)
        houder = item.get("hypotheekhouder", {})
        houder_naam: str | None = None
        if houder.get("type") == "NietNatuurlijkPersoon":
            houder_naam = houder.get("statutaireNaam") or houder.get("naam")

        bedrag = item.get("bedragZekerheid")
        if bedrag is not None:
            bedrag = int(bedrag)

        results.append(
            Hypotheek(
                hypotheekhouder_naam=houder_naam,
                bedrag=bedrag,
                aard=item.get("aard"),
            )
        )

    logger.info("BRK parse hypotheken: count=%d", len(results))
    return results


def _parse_beslagen(raw: dict) -> list[Beslag]:
    """Parse BRK beslagen endpoint response.

    CRITICAL: Never log response payload.
    """
    embedded = raw.get("_embedded", {})
    raw_items = embedded.get("beslagen", [])
    results: list[Beslag] = []

    for item in raw_items:
        results.append(Beslag(aard=item.get("aard")))

    logger.info("BRK parse beslagen: count=%d", len(results))
    return results


# CRITICAL LOGGING REMINDER: Never log BRK response payloads below.
# Only log request metadata (endpoint, perceel ID) and parse outcomes.
# Kadaster Tier 3 terms prohibit storing or logging eigendomsdata.
async def fetch_brk_ownership(
    cadastral_parcels: list[CadastralParcel],
) -> BRKOwnership:
    """Fetch BRK Bevragen V2 ownership for all matching percelen.

    Runs as Step 2b — sequential after Step 2a cadastral fetch completes.
    Requires perceel identificatie from CadastralParcel to look up eigendomsdata.

    Always returns BRKOwnership — never raises, never returns None.
    Uses a single mTLS client for all percelen in this call.

    CRITICAL: Never cache or store this data (Kadaster Tier 3 never-store terms).
    Never log BRK response payloads — only log request metadata and parse outcomes.

    Args:
        cadastral_parcels: Parcels from Step 2a cadastral fetch

    Returns:
        BRKOwnership: Three-state ownership result (available/unavailable/error)
    """
    # Check configuration before attempting fetch
    if not brk_client.is_configured:
        return BRKOwnership(
            status="unavailable",
            reason="BRK Bevragen niet geconfigureerd",
            admin_hint=(
                "Configureer PKIOverheid mTLS-certificaat "
                "(BRK_CLIENT_CERT_PATH, BRK_CLIENT_KEY_PATH, BRK_CA_BUNDLE_PATH) "
                "om eigendomsdata op te vragen."
            ),
        )

    # Extract perceel identificaties — skip parcels without identificatie
    perceel_ids = [
        p.identificatie for p in cadastral_parcels if p.identificatie is not None
    ]
    if not perceel_ids:
        return BRKOwnership(
            status="unavailable",
            reason="Geen kadastraal perceel gevonden voor dit adres",
        )

    fetched_at = datetime.utcnow().isoformat() + "Z"

    try:
        # ONE client for all percelen — avoids repeated SSL handshakes
        async with brk_client.create_client() as client:
            perceel_results: list[PerceelOwnership] = []
            for perceel_id in perceel_ids:
                # CRITICAL: log request metadata only — never log response payload
                logger.info(
                    "BRK fetch: perceel=%s (eigendom+hypotheken+beslagen)",
                    perceel_id,
                )
                # Fetch all three endpoints per perceel
                raw_eigendom = await brk_client.get_eigendom(perceel_id, client)
                parsed = _parse_perceel_ownership(raw_eigendom, perceel_id)

                # Hypotheken — graceful: empty list on failure
                try:
                    raw_hyp = await brk_client.get_hypotheken(perceel_id, client)
                    parsed.hypotheken = _parse_hypotheken(raw_hyp)
                    if parsed.hypotheken:
                        parsed.heeft_hypotheek = True
                except Exception:
                    logger.info("BRK hypotheken not available for %s", perceel_id)

                # Beslagen — graceful: empty list on failure
                try:
                    raw_bes = await brk_client.get_beslagen(perceel_id, client)
                    parsed.beslagen = _parse_beslagen(raw_bes)
                except Exception:
                    logger.info("BRK beslagen not available for %s", perceel_id)

                perceel_results.append(parsed)

        return BRKOwnership(
            status="available",
            data=perceel_results,
            fetched_at=fetched_at,
        )

    except GovernmentAPIError as e:
        logger.warning("BRK fetch failed: %s", e.message)
        return BRKOwnership(
            status="error",
            reason=f"BRK Bevragen fout: {e.message}",
        )
    except Exception as e:
        logger.warning("BRK fetch unexpected error: %s", str(e))
        return BRKOwnership(
            status="error",
            reason="Onverwachte fout bij ophalen eigendomsdata",
        )


async def aggregate_property_data(
    input_data: AddressInput,
    client: httpx.AsyncClient,
    session: AsyncSession,
    force_refresh: bool = False,
    arq_pool: ArqRedis | None = None,
) -> PropertyReportResponse:
    """
    Aggregate property data from multiple government APIs with parallel fetching.

    Flow:
    1. Sequential: Resolve address via BAG (MUST succeed)
    2a. Parallel: Fetch cadastral parcels, zoning, monuments, energy label, and WOZ if available
    2b. Sequential: Fetch BRK ownership (requires cadastral identificatie from Step 2a)
    3. Trigger AI bestemmingsplan parsing (always, returns immediately with job status)

    Args:
        input_data: Address input with postcode and house number
        client: Shared httpx AsyncClient
        session: SQLAlchemy async session for cache operations
        force_refresh: If True, bypass all caches and fetch fresh data
        arq_pool: ARQ Redis pool for job enqueueing (required for AI parsing)

    Returns:
        PropertyReportResponse: Aggregated property data with zoning, monuments, map data, AI parsing, and source attribution

    Raises:
        HTTPException 404: If address not found in BAG
        HTTPException 502: If upstream API fails critically
    """
    logger.info(
        f"Starting property data aggregation for {input_data.postcode} {input_data.huisnummer}"
    )

    data_sources: list[DataSourceInfo] = []
    errors: list[str] = []
    cadastral_parcels: list[CadastralParcel] = []
    zoning_data: ZoningData | None = None
    monument_status: MonumentStatus | None = None
    market_signals: MarketSignals | None = None
    buildability_delta: BuildabilityDelta | None = None
    wkb_precheck: WkbPrecheck | None = None
    permit_precedents: PermitPrecedentBenchmark | None = None

    # STEP 1 (SEQUENTIAL): Resolve address via BAG
    # This MUST succeed - if it fails, we can't continue
    try:
        address_resolution = await resolve_address(
            input_data=input_data,
            client=client,
            session=session,
        )
    except APINotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found in BAG registry",
        ) from e
    except GovernmentAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to resolve address: {e.message}",
        ) from e

    # Add BAG source info (address resolution includes caching internally)
    data_sources.append(
        DataSourceInfo(
            source="BAG API v2",
            is_cached=False,  # Address resolver handles caching internally
        )
    )

    address = address_resolution.address
    building = address_resolution.building

    # STEP 2a (PARALLEL): Fetch parcel/zoning/monuments if we have RD coordinates
    coordinates = _extract_rd_coordinates(building.geometry if building else None)

    # Parallel fetch: cadastral parcels, zoning, and monuments
    async def fetch_cadastral_parcels() -> list[CadastralParcel]:
        """Fetch cadastral parcels if coordinates available."""
        if not coordinates:
            logger.info("No coordinates available, skipping cadastral parcel lookup")
            return []

        x, y = coordinates
        cache_key = f"kadaster:parcel:{x}:{y}"

        try:
            cache_result = await get_cached_or_fetch(
                cache_key=cache_key,
                source="kadaster",
                fetch_fn=lambda: _cadastral_client.get_parcels_by_point(
                    x=x,
                    y=y,
                    client=client,
                    distance=5.0,
                ),
                session=session,
                force_refresh=force_refresh,
            )

            # Add cadastral source info
            data_sources.append(
                DataSourceInfo(
                    source="PDOK Cadastral OGC API",
                    cached_at=cache_result.cached_at,
                    age_seconds=cache_result.age_seconds,
                    is_cached=cache_result.is_cached,
                )
            )

            # Parse cadastral features
            parcels = []
            features = cache_result.data or []
            for feature in features:
                props = feature.get("properties", {})
                geometry = feature.get("geometry")

                # PDOK OGC API field names differ from older WFS
                gemeente = props.get("kadastrale_gemeente_waarde", "")
                sectie = props.get("sectie", "")
                perceelnummer = props.get("perceelnummer")
                perceelnr_str = str(perceelnummer) if perceelnummer is not None else None

                # Construct kadastrale aanduiding: "Venlo M 1722"
                kadastrale_aanduiding = None
                if gemeente and sectie and perceelnummer is not None:
                    kadastrale_aanduiding = f"{gemeente} {sectie} {perceelnummer}"

                # AKR gemeente code (e.g. "VLO00") used for PDOK gekoppeld_perceel lookup
                akr_gemeente = props.get("akr_kadastrale_gemeente_code_waarde", "")

                parcel = CadastralParcel(
                    identificatie=props.get("identificatie"),
                    kadastrale_aanduiding=kadastrale_aanduiding,
                    kadastrale_gemeente=akr_gemeente or gemeente or None,
                    perceelnummer=perceelnr_str,
                    sectie=sectie,
                    oppervlakte=props.get("kadastrale_grootte_waarde"),
                    geometry=geometry,
                )
                parcels.append(parcel)

            # --- Point-in-polygon filter: keep only the parcel(s) that
            # actually contain the building centroid.  This prevents
            # returning adjacent parcels that merely overlap the bbox.
            query_point = Point(x, y)
            filtered: list[CadastralParcel] = []
            for p in parcels:
                try:
                    if shape(p.geometry).contains(query_point):
                        filtered.append(p)
                except Exception:
                    # Skip parcels with invalid/missing geometry
                    continue

            if not filtered:
                # Boundary edge-case: point sits exactly on an edge.
                # Fall back to the parcel whose centroid is closest.
                nearest = _nearest_parcel(parcels, query_point)
                if nearest is not None:
                    filtered = [nearest]

            logger.info(
                f"Fetched {len(parcels)} cadastral parcels, "
                f"{len(filtered)} contain building centroid"
            )
            return filtered if filtered else parcels

        except Exception as e:
            logger.warning(f"Failed to fetch cadastral parcels: {str(e)}")
            errors.append(f"Cadastral data unavailable: {str(e)}")
            return []

    async def fetch_zoning() -> ZoningData | None:
        """Fetch zoning data if coordinates available."""
        if not coordinates:
            return None
        x, y = coordinates
        try:
            return await fetch_zoning_data(
                x=x,
                y=y,
                client=client,
                session=session,
                force_refresh=force_refresh,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch zoning data: {e}")
            errors.append(f"Bestemmingsplan data niet beschikbaar: {str(e)}")
            return None

    async def fetch_monuments() -> MonumentStatus | None:
        """Fetch monument status if coordinates available."""
        if not coordinates:
            return None
        x, y = coordinates
        pand_id = building.pand_id if building else None
        vo_id = address.verblijfsobject_id
        try:
            return await fetch_monument_status(
                x=x,
                y=y,
                pand_id=pand_id,
                verblijfsobject_id=vo_id,
                client=client,
                session=session,
                force_refresh=force_refresh,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch monument data: {e}")
            errors.append(f"Monument data niet beschikbaar: {str(e)}")
            return None

    async def fetch_energy_label() -> EnergyLabel | None:
        """Fetch EP-Online energy label if VBO ID available."""
        vbo_id = address.verblijfsobject_id
        if not vbo_id:
            return None
        cache_key = f"ep_online:label:{vbo_id}"
        try:
            async def _fetch_ep() -> dict:
                label = await ep_online_client.get_by_vbo_id(vbo_id, client)
                return label.model_dump() if label is not None else {}

            cache_result = await get_cached_or_fetch(
                cache_key=cache_key,
                source="ep_online",
                fetch_fn=_fetch_ep,
                session=session,
                force_refresh=force_refresh,
            )
            data = cache_result.data
            return EnergyLabel.model_validate(data) if data else None
        except Exception as e:
            logger.warning(f"Failed to fetch energy label: {e}")
            errors.append(f"Energielabel niet beschikbaar: {str(e)}")
            return None

    async def fetch_woz_data() -> WOZData | None:
        """Fetch WOZ valuation data by nummeraanduiding ID."""
        na_id = address.nummeraanduiding_id
        cache_key = f"woz:waarde:{na_id}"
        try:
            async def _fetch_woz() -> dict:
                woz = await woz_waardeloket_client.get_by_nummeraanduiding_id(na_id, client)
                return woz.model_dump() if woz is not None else {}

            cache_result = await get_cached_or_fetch(
                cache_key=cache_key,
                source="woz",
                fetch_fn=_fetch_woz,
                session=session,
                force_refresh=force_refresh,
            )
            data = cache_result.data
            return WOZData.model_validate(data) if data else None
        except Exception as e:
            logger.warning(f"Failed to fetch WOZ data: {e}")
            errors.append(f"WOZ-waarde niet beschikbaar: {str(e)}")
            return None

    async def fetch_market_data() -> MarketSignals | None:
        """Fetch Funda market-friction signals for this exact address."""
        try:
            return await _fetch_market_signals(
                postcode=address.postcode,
                huisnummer=address.huisnummer,
                city=address.woonplaats,
                session=session,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch market signals: {e}")
            errors.append(f"Marktsignalen niet beschikbaar: {str(e)}")
            return None

    async def fetch_bodem() -> BodemData | None:
        """Fetch Bodemloket soil contamination data for this parcel's RD coordinates."""
        try:
            rd_coords = _extract_rd_coordinates(building.geometry if building else None)
            if rd_coords is None:
                return None
            rd_x, rd_y = rd_coords
            return await _fetch_bodem(
                x=rd_x,
                y=rd_y,
                client=client,
                session=session,
                force_refresh=force_refresh,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch bodem data: {e}")
            errors.append(f"Bodemkwaliteit niet beschikbaar: {str(e)}")
            return None

    async def fetch_soil_profile_data() -> SoilProfile | None:
        """Fetch BRO Bodemkaart soil classification for this parcel's RD coordinates."""
        try:
            rd_coords = _extract_rd_coordinates(building.geometry if building else None)
            if rd_coords is None:
                return None
            rd_x, rd_y = rd_coords
            return await fetch_soil_profile(
                x=rd_x,
                y=rd_y,
                client=client,
                session=session,
                force_refresh=force_refresh,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch soil profile: {e}")
            errors.append(f"Bodemtype niet beschikbaar: {str(e)}")
            return None

    async def fetch_funderingsrisico() -> FunderingsrisicogebiedData | None:
        """Fetch PDOK funderingsrisico area context for this parcel's postcode."""
        try:
            postcode = address.postcode
            if not postcode:
                return None
            return await fetch_funderingsrisico_data(
                pc6=postcode,
                client=client,
                session=session,
                force_refresh=force_refresh,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch funderingsrisico data: {e}")
            errors.append(f"Funderingsrisicogebied niet beschikbaar: {str(e)}")
            return None

    # Execute ALL Step 2a fetches in parallel
    results = await asyncio.gather(
        fetch_cadastral_parcels(),
        fetch_zoning(),
        fetch_monuments(),
        fetch_energy_label(),
        fetch_woz_data(),
        fetch_market_data(),
        fetch_bodem(),              # index 6
        fetch_soil_profile_data(),  # index 7
        fetch_funderingsrisico(),   # index 8
        return_exceptions=True,
    )

    # Process results
    cadastral_result = results[0]
    if isinstance(cadastral_result, Exception):
        logger.error(f"Cadastral fetch failed: {cadastral_result}")
        errors.append(f"Cadastral data fetch failed: {str(cadastral_result)}")
    else:
        cadastral_parcels = cadastral_result

    zoning_result = results[1]
    if isinstance(zoning_result, Exception):
        logger.error(f"Zoning fetch failed: {zoning_result}")
        errors.append(f"Zoning data fetch failed: {str(zoning_result)}")
    else:
        zoning_data = zoning_result

    monument_result = results[2]
    if isinstance(monument_result, Exception):
        logger.error(f"Monument fetch failed: {monument_result}")
        errors.append(f"Monument data fetch failed: {str(monument_result)}")
    else:
        monument_status = monument_result

    energy_label: EnergyLabel | None = None
    energy_label_result = results[3]
    if isinstance(energy_label_result, Exception):
        logger.error(f"Energy label fetch failed: {energy_label_result}")
        errors.append(f"Energielabel fetch failed: {str(energy_label_result)}")
    else:
        energy_label = energy_label_result

    woz_data: WOZData | None = None
    woz_result = results[4]
    if isinstance(woz_result, Exception):
        logger.error(f"WOZ fetch failed: {woz_result}")
        errors.append(f"WOZ data fetch failed: {str(woz_result)}")
    else:
        woz_data = woz_result

    market_result = results[5]
    if isinstance(market_result, Exception):
        logger.error(f"Market signal fetch failed: {market_result}")
        errors.append(f"Marktsignalen fetch failed: {str(market_result)}")
    else:
        market_signals = market_result

    bodem_data: BodemData | None = None
    bodem_result = results[6]
    if isinstance(bodem_result, Exception):
        logger.error(f"Bodem fetch failed: {bodem_result}")
        errors.append(f"Bodemkwaliteit fetch failed: {str(bodem_result)}")
    else:
        bodem_data = bodem_result

    soil_profile: SoilProfile | None = None
    soil_profile_result = results[7]
    if isinstance(soil_profile_result, Exception):
        logger.error(f"Soil profile fetch failed: {soil_profile_result}")
        errors.append(f"Bodemtype fetch failed: {str(soil_profile_result)}")
    else:
        soil_profile = soil_profile_result

    funderingsrisicogebied: FunderingsrisicogebiedData | None = None
    funderingsrisico_result = results[8]
    if isinstance(funderingsrisico_result, Exception):
        logger.error(f"Funderingsrisico fetch failed: {funderingsrisico_result}")
        errors.append(f"Funderingsrisicogebied fetch failed: {str(funderingsrisico_result)}")
    else:
        funderingsrisicogebied = funderingsrisico_result

    permit_precedents = await build_permit_precedent_benchmark(
        session=session,
        postcode=address.postcode,
        huisnummer=address.huisnummer,
        city=address.woonplaats,
    )

    # STEP 2b (SEQUENTIAL): BRK ownership — requires cadastral identificatie from Step 2a
    # NOTE: Never cache BRK data (Kadaster Tier 3). fetch_brk_ownership() always returns,
    # never raises, and never logs BRK response payloads.
    brk_ownership = await fetch_brk_ownership(cadastral_parcels)

    # STEP 2c: Fetch all BAG addresses on the primary parcel
    all_addresses: list[str] = []
    if cadastral_parcels:
        primary = cadastral_parcels[0]
        if primary.kadastrale_gemeente and primary.sectie and primary.perceelnummer:
            try:
                from app.government_apis.pdok_locatieserver import PDOKLocatieserver

                _locatieserver = PDOKLocatieserver()
                all_addresses = await _locatieserver.addresses_for_parcel(
                    kadastrale_gemeente=primary.kadastrale_gemeente,
                    sectie=primary.sectie,
                    perceelnummer=primary.perceelnummer,
                    client=client,
                )
            except Exception as e:
                logger.debug("Failed to fetch parcel addresses: %s", e)

    # STEP 3: Cache-only AI bestemmingsplan lookup (no auto-trigger)
    ai_parsing_section: AIParsingSection | None = None
    plan_idn = get_primary_plan_idn(zoning_data)
    if plan_idn:
        try:
            ai_parsing_section = await get_cached_plan_only(
                plan_idn=plan_idn,
                session=session,
            )
        except Exception as e:
            logger.warning(f"Failed to check AI parsing cache: {e}")
            ai_parsing_section = AIParsingSection(
                status="not_available",
                error_message=f"Bestemmingsplan niet digitaal beschikbaar: {str(e)}",
            )
    else:
        ai_parsing_section = AIParsingSection(
            status="not_available",
            error_message="Geen bestemmingsplan gevonden voor deze locatie",
        )

    buildability_delta = _derive_buildability_delta(
        cadastral_parcels=cadastral_parcels,
        building=building,
        zoning_data=zoning_data,
        ai_parsing_section=ai_parsing_section,
    )
    wkb_precheck = evaluate_wkb_precheck(
        building=building,
        monuments=monument_status,
        zoning_data=zoning_data,
        buildability_delta=buildability_delta,
    )
    wkb_classification: WkbClassification = classify_wkb(
        building=building,
        monuments=monument_status,
    )
    asbest_result: AsbestIndicator = assess_asbest_risk(building=building)

    # Phase 88: Foundation risk engine (synchronous, no I/O)
    foundation_risk = assess_foundation_risk(
        building=building,
        soil_profile=soil_profile,
        funderingsrisicogebied=funderingsrisicogebied,
    )
    kcaf_cost = estimate_kcaf_cost(
        risk=foundation_risk.risk,
        oppervlakte_m2=building.oppervlakte if building else None,
    )
    fysiek_risico_profiel = build_fysiek_risico_profiel(
        foundation_risk=foundation_risk,
        soil_profile=soil_profile,
        asbest_indicator=asbest_result,
        bodem_data=bodem_data,
        funderingsrisicogebied=funderingsrisicogebied,
        kcaf_cost=kcaf_cost,
    )

    # Build MapData with WGS84 coordinate transformation
    map_data: MapData | None = None
    if coordinates:
        x, y = coordinates
        lon, lat = rd_to_wgs84(x, y)
        map_data = MapData(
            center_rd=[x, y],
            center_wgs84=[lon, lat],
            property_geometry=building.geometry if building else None,
            parcel_geometries=[p.geometry for p in cadastral_parcels if p.geometry],
            zoning_geometries=[
                rule.geometry
                for plan in (zoning_data.plans if zoning_data else [])
                for rule in plan.rules
                if rule.geometry
            ],
        )

    # Build section_sources with Dutch freshness timestamps
    section_sources: list[SectionSourceInfo] = []

    # Zoning section
    if zoning_data:
        section_sources.append(
            SectionSourceInfo(
                section="zoning",
                sources=[
                    DataSourceInfo(
                        source="DSO Ruimtelijke Plannen API v4",
                        confidence="HIGH",
                        is_cached=True,  # zoning_aggregator uses cache internally
                    )
                ],
            )
        )

    # Monuments section
    if monument_status:
        monument_sources = [
            DataSourceInfo(
                source=source.source,
                cached_at=source.cached_at,
                age_seconds=source.age_seconds,
                is_cached=source.cached_at is not None,
                confidence="HIGH",
            )
            for source in monument_status.sources
            if source.error is None  # Only include successful sources
        ]
        if monument_sources:
            section_sources.append(
                SectionSourceInfo(
                    section="monuments",
                    sources=monument_sources,
                    cached_at=monument_sources[0].cached_at,
                    age_seconds=monument_sources[0].age_seconds,
                )
            )

    # AI parsing section
    if ai_parsing_section and ai_parsing_section.status == "complete":
        section_sources.append(
            SectionSourceInfo(
                section="ai_parsing",
                sources=[
                    DataSourceInfo(
                        source="Claude AI (bestemmingsplan PDF)",
                        confidence="MEDIUM",
                        is_cached=True,  # Parsed data comes from cache
                    )
                ],
            )
        )

    # Market signals section
    if market_signals is not None:
        section_sources.append(
            SectionSourceInfo(
                section="market_signals",
                sources=[
                    DataSourceInfo(
                        source="Funda listing snapshots",
                        confidence="MEDIUM",
                        is_cached=True,
                    )
                ],
                age_seconds=market_signals.days_since_last_seen * 86400,
            )
        )

    # Buildability delta section
    if buildability_delta is not None:
        buildability_sources: list[DataSourceInfo] = [
            DataSourceInfo(
                source="BAG API v2",
                confidence="HIGH",
                is_cached=False,
            )
        ]
        if cadastral_parcels:
            buildability_sources.append(
                DataSourceInfo(
                    source="PDOK Cadastral OGC API",
                    confidence="HIGH",
                    is_cached=True,
                )
            )
        if zoning_data is not None:
            buildability_sources.append(
                DataSourceInfo(
                    source="DSO Ruimtelijke Plannen API v4",
                    confidence="HIGH",
                    is_cached=True,
                )
            )
        if (
            buildability_delta.limit_source is not None
            and "AI" in buildability_delta.limit_source
        ):
            ai_confidence = (
                "HIGH"
                if buildability_delta.limit_confidence == "high"
                else "MEDIUM"
                if buildability_delta.limit_confidence == "medium"
                else "LOW"
            )
            buildability_sources.append(
                DataSourceInfo(
                    source="AI planregels (bestemmingsplan PDF)",
                    confidence=ai_confidence,  # type: ignore[arg-type]
                    is_cached=True,
                )
            )
        section_sources.append(
            SectionSourceInfo(
                section="buildability_delta",
                sources=buildability_sources,
            )
        )

    # Wkb precheck section
    if wkb_precheck is not None:
        wkb_sources: list[DataSourceInfo] = [
            DataSourceInfo(
                source="Wkb Layer A rules engine",
                confidence="MEDIUM",
                is_cached=False,
            ),
            DataSourceInfo(
                source="BAG API v2",
                confidence="HIGH",
                is_cached=False,
            ),
        ]
        if zoning_data is not None:
            wkb_sources.append(
                DataSourceInfo(
                    source="DSO Ruimtelijke Plannen API v4",
                    confidence="HIGH",
                    is_cached=True,
                )
            )
        if monument_status is not None:
            wkb_sources.append(
                DataSourceInfo(
                    source="RCE/BAG monumentenaggregatie",
                    confidence="MEDIUM",
                    is_cached=True,
                )
            )
        if buildability_delta is not None:
            wkb_sources.append(
                DataSourceInfo(
                    source="Buildability Delta (afgeleid)",
                    confidence=(
                        "HIGH"
                        if buildability_delta.confidence == "high"
                        else "MEDIUM"
                        if buildability_delta.confidence == "medium"
                        else "LOW"
                    ),
                    is_cached=True,
                )
            )
        section_sources.append(
            SectionSourceInfo(
                section="wkb_precheck",
                sources=wkb_sources,
            )
        )

    # Permit precedents benchmark section
    if permit_precedents is not None:
        section_sources.append(
            SectionSourceInfo(
                section="permit_precedents",
                sources=[
                    DataSourceInfo(
                        source="Monitoring change_records (SRU vergunninghistorie)",
                        confidence="MEDIUM",
                        is_cached=True,
                    )
                ],
            )
        )

    # Soil profile section (Phase 87)
    if soil_profile is not None:
        data_sources.append(
            DataSourceInfo(
                source="BRO Bodemkaart 1:50.000 (PDOK WMS)",
                confidence="HIGH",
                is_cached=True,
            )
        )

    # Funderingsrisicogebied section (Phase 87)
    if funderingsrisicogebied is not None:
        data_sources.append(
            DataSourceInfo(
                source="PDOK Indicatieve Gebieden Funderingsproblematiek (WFS)",
                confidence="HIGH",
                is_cached=True,
            )
        )

    # Calculate completeness score
    # Sections: address (1), building (1), parcels (1), zoning (1), monuments (1), ai_parsing (1),
    #           energy_label (1), woz_data (1), brk_ownership (1), soil_profile (1),
    #           funderingsrisicogebied (1) — total 11 — Phase 87
    sections_available = 1  # Address always available
    if building:
        sections_available += 1
    if cadastral_parcels:
        sections_available += 1
    if zoning_data:
        sections_available += 1
    if monument_status:
        sections_available += 1
    if ai_parsing_section and ai_parsing_section.status == "complete":
        sections_available += 1
    if energy_label is not None:
        sections_available += 1
    if woz_data is not None:
        sections_available += 1
    if brk_ownership.status == "available":
        sections_available += 1
    if soil_profile is not None:
        sections_available += 1
    if funderingsrisicogebied is not None:
        sections_available += 1

    total_sections = 11  # Updated from 9 — Phase 87
    completeness_score = sections_available / total_sections

    logger.info(
        f"Property aggregation complete. Completeness: {completeness_score:.1%}, "
        f"Errors: {len(errors)}"
    )

    return PropertyReportResponse(
        address=address,
        building=building,
        cadastral_parcels=cadastral_parcels,
        zoning=zoning_data,
        monuments=monument_status,
        map_data=map_data,
        section_sources=section_sources,
        data_sources=data_sources,
        completeness_score=completeness_score,
        errors=errors,
        resolved_at=datetime.utcnow().isoformat() + "Z",
        ai_parsing=ai_parsing_section,
        energy_label=energy_label,
        woz_data=woz_data,
        market_signals=market_signals,
        buildability_delta=buildability_delta,
        wkb_precheck=wkb_precheck,
        wkb_classification=wkb_classification,
        asbest_indicator=asbest_result,
        permit_precedents=permit_precedents,
        brk_ownership=brk_ownership,
        bodem_data=bodem_data,
        soil_profile=soil_profile,
        funderingsrisicogebied=funderingsrisicogebied,
        fysiek_risico_profiel=fysiek_risico_profiel,
        all_addresses=all_addresses,
    )

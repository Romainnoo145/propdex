"""Unit tests for AI-assisted TAR/FAR derivation in buildability delta."""

from app.ai.schemas import (
    AIParsingSection,
    BestemmingsplanParsed,
    BestemmingsregelExtract,
    BuildingDimensionsAI,
)
from app.schemas.address import BuildingData
from app.schemas.property import CadastralParcel
from app.schemas.zoning import BuildingDimensions, ZoningData
from app.services.property_aggregator import _derive_buildability_delta


def _base_parcels() -> list[CadastralParcel]:
    return [CadastralParcel(oppervlakte=1000)]


def _base_building() -> BuildingData:
    return BuildingData(
        pand_id="pand-1",
        oppervlakte=120,
        gebruiksdoel=[],
    )


def _ai_section(
    *,
    overall_confidence: str = "HIGH",
    tar: float | None = None,
    far: float | None = None,
    overige: dict[str, str] | None = None,
) -> AIParsingSection:
    regel = BestemmingsregelExtract(
        artikel="Artikel 3.2.1",
        bestemming="Wonen",
        toegestane_gebruiken=[],
        verboden_gebruiken=[],
        bouwregels=BuildingDimensionsAI(
            max_bebouwingspercentage=tar,
            max_floor_area_ratio=far,
            overige=overige or {},
        ),
        parkeereis=None,
        milieu_restricties=[],
        bijzondere_voorwaarden=[],
        confidence="MEDIUM",
        disclaimer=None,
    )
    parsed = BestemmingsplanParsed(
        plan_naam="Testplan",
        plan_idn="NL.IMRO.0000.TEST-VA01",
        regels=[regel],
        overall_confidence=overall_confidence,  # type: ignore[arg-type]
        disclaimers=[],
        samenvatting="Testsamenvatting",
    )
    return AIParsingSection(
        status="complete",
        parsed_plan=parsed,
    )


def test_buildability_uses_ai_when_dso_limits_missing():
    delta = _derive_buildability_delta(
        cadastral_parcels=_base_parcels(),
        building=_base_building(),
        zoning_data=ZoningData(plans=[]),
        ai_parsing_section=_ai_section(tar=60.0, far=1.8, overall_confidence="HIGH"),
    )

    assert delta is not None
    assert delta.max_bebouwingspercentage_pct == 60.0
    assert delta.max_far == 1.8
    assert delta.limit_source == "AI planregels"
    assert delta.limit_confidence == "medium"


def test_buildability_merges_dso_with_ai_for_missing_dimension():
    zoning = ZoningData(
        plans=[],
        building_dimensions=BuildingDimensions(
            max_bebouwingspercentage=70.0,
            max_floor_area_ratio=None,
        ),
    )
    delta = _derive_buildability_delta(
        cadastral_parcels=_base_parcels(),
        building=_base_building(),
        zoning_data=zoning,
        ai_parsing_section=_ai_section(
            tar=None,
            far=None,
            overall_confidence="MEDIUM",
            overige={"maximum FSI": "2,2"},
        ),
    )

    assert delta is not None
    assert delta.max_bebouwingspercentage_pct == 70.0
    assert delta.max_far == 2.2
    assert delta.limit_source == "DSO maatvoering + AI planregels"
    assert delta.limit_confidence == "medium"


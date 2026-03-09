"""Fysiek risicoprofiel schemas for soil classification and foundation risk. Phase 87+88."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from app.schemas.bodem import BodemData
    from app.schemas.property import AsbestIndicator


class SoilProfile(BaseModel):
    """BRO Bodemkaart soil classification at a specific coordinate.

    Based on WMS GetFeatureInfo response from PDOK BRO Bodemkaart 1:50.000.
    Soil code prefix is classified into one of four risk-relevant grondsoort
    categories (klei/veen/zand/leem) or "onbekend" for coverage gaps.
    """

    soilcode: str | None = Field(
        default=None,
        description="BRO soil code from bodemkaart (e.g., 'cY23', 'Mn25A')",
    )
    soilname: str | None = Field(
        default=None,
        description="Dutch soil profile name (e.g., 'Loopodzolgronden; lemig fijn zand')",
    )
    dominant_type: str = Field(
        description="Grondsoort category: klei, veen, zand, leem, or onbekend",
    )
    dominant_type_label: str = Field(
        description="Dutch display label for dominant type (e.g., 'Kleigrond')",
    )
    disclaimer: str = Field(
        default="Bron: BRO Bodemkaart 1:50.000 (PDOK). Classificatie is indicatief.",
        description="Mandatory source disclaimer",
    )


class FunderingsrisicogebiedData(BaseModel):
    """PDOK Funderingsrisicogebieden context at postcode level.

    Based on WFS GetFeature response from PDOK Indicatieve Gebieden
    Funderingsproblematiek. Data is at PC6 level, NOT per parcel.
    """

    pc6: str = Field(
        description="6-digit postcode (e.g., '5927NX')",
    )
    gemeente: str | None = Field(
        default=None,
        description="Municipality name from WFS response",
    )
    fgr: str | None = Field(
        default=None,
        description="Funderingsgebied region name (e.g., 'Hogere Zandgronden')",
    )
    percvoor1970: float | None = Field(
        default=None,
        description="Percentage of pre-1970 buildings in this postcode area",
    )
    n_bag: int | None = Field(
        default=None,
        description="Number of BAG objects in this postcode area",
    )
    legenda: str | None = Field(
        default=None,
        description="Risk label text (e.g., 'Niet kwetsbaar gebied - 60-80 %')",
    )
    disclaimer: str = Field(
        default=(
            "Bron: PDOK Indicatieve Gebieden Funderingsproblematiek. "
            "Gegevens zijn op postcodeniveau, niet per pand."
        ),
        description="Mandatory source disclaimer",
    )


class FoundationRisk(BaseModel):
    """Foundation risk assessment based on bouwjaar x bodemtype heuristic.

    Pure derivation from building age and soil classification. Pre-1970 buildings
    on soft soils (klei/veen) have high risk of wooden pile rot (paalrot).
    """

    risk: Literal["hoog", "middel", "laag", "onbekend"] = Field(
        description="Foundation risk level: hoog (wooden piles + soft soil), middel (variable), laag (concrete/sand), onbekend (missing data)",
    )
    bouwjaar: int | None = Field(
        default=None,
        description="Bouwjaar used in determination",
    )
    bodemtype: str | None = Field(
        default=None,
        description="Dominant soil type used in determination (klei/veen/zand/leem/onbekend)",
    )
    reden: str = Field(
        description="Dutch-language explanation of the risk derivation",
    )
    recommended_action: str | None = Field(
        default=None,
        description="Recommended follow-up action for hoog/middel risk",
    )
    disclaimer: str = Field(
        default=(
            "Indicatieve risicobeoordeling op basis van bouwjaar en bodemtype. "
            "Geen vervanging voor een gecertificeerd funderingsonderzoek."
        ),
        description="Mandatory disclaimer",
    )


class KCAFCostIndication(BaseModel):
    """KCAF reference cost range for foundation repair.

    Based on KCAF (Kennis Centrum Aanpak Funderingsproblematiek) cost benchmarks.
    Only provided when foundation risk is hoog or middel and oppervlakte is known.
    """

    low_eur: int = Field(
        description="Lower bound total cost estimate in EUR",
    )
    high_eur: int = Field(
        description="Upper bound total cost estimate in EUR",
    )
    low_per_m2: int = Field(
        description="Lower bound cost per m2 in EUR",
    )
    high_per_m2: int = Field(
        description="Upper bound cost per m2 in EUR",
    )
    oppervlakte_m2: int = Field(
        description="Building surface area used for calculation (BAG gebruiksoppervlakte)",
    )
    disclaimer: str = Field(
        description="Mandatory disclaimer text",
    )


class FysiekRisicoProfiel(BaseModel):
    """Combined physical risk profile aggregating foundation, soil, asbest, and contamination.

    Worst-of logic across sub-risks determines overall risk level.
    'onbekend' sub-risks are excluded from worst-of calculation.
    """

    overall_risk: Literal["hoog", "middel", "laag", "onbekend"] = Field(
        description="Worst-of risk across all sub-risk components",
    )
    overall_explanation: str = Field(
        description="Dutch-language summary of overall risk derivation",
    )
    foundation_risk: FoundationRisk | None = Field(
        default=None,
        description="Foundation risk from bouwjaar x bodemtype heuristic",
    )
    soil_profile: SoilProfile | None = Field(
        default=None,
        description="BRO Bodemkaart soil classification",
    )
    asbest_indicator: AsbestIndicator | None = Field(
        default=None,
        description="Bouwjaar-based asbest risk indicator",
    )
    bodem_data: BodemData | None = Field(
        default=None,
        description="Bodemloket WBB dossier data",
    )
    funderingsrisicogebied: FunderingsrisicogebiedData | None = Field(
        default=None,
        description="PDOK funderingsrisicogebied postcode-level context",
    )
    kcaf_cost: KCAFCostIndication | None = Field(
        default=None,
        description="KCAF reference cost indication for foundation repair",
    )
    disclaimer: str = Field(
        default=(
            "Fysiek risicoprofiel is een indicatieve beoordeling op basis van openbare data. "
            "Geen vervanging voor professioneel onderzoek."
        ),
        description="Overall profile disclaimer",
    )


def rebuild_fysiek_risico_models() -> None:
    """Rebuild FysiekRisicoProfiel to resolve forward references.

    Must be called after app.schemas.property and app.schemas.bodem are imported.
    This resolves the circular import between fysiek_risico.py and property.py.
    """
    from app.schemas.bodem import BodemData  # noqa: F811
    from app.schemas.property import AsbestIndicator  # noqa: F811

    FysiekRisicoProfiel.model_rebuild(_types_namespace={
        "AsbestIndicator": AsbestIndicator,
        "BodemData": BodemData,
    })

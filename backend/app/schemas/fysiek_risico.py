"""Fysiek risicoprofiel schemas for soil classification and foundation risk. Phase 87."""

from __future__ import annotations

from pydantic import BaseModel, Field


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

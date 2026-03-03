"""Zoning data schemas for bestemmingsplan information."""

from __future__ import annotations

from pydantic import BaseModel, Field


class BuildingDimensions(BaseModel):
    """Building dimension constraints from zoning regulations."""

    max_hoogte: float | None = Field(
        default=None,
        description="Maximum building height in meters",
    )
    max_bebouwingspercentage: float | None = Field(
        default=None,
        description="Maximum coverage percentage (0-100)",
    )
    max_floor_area_ratio: float | None = Field(
        default=None,
        description="Maximum floor space index / FSI",
    )
    max_goothoogte: float | None = Field(
        default=None,
        description="Maximum gutter height in meters",
    )
    max_bouwhoogte: float | None = Field(
        default=None,
        description="Maximum construction height in meters",
    )
    max_bouwlagen: int | None = Field(
        default=None,
        description="Maximum allowed number of building floors (bouwlagen)",
    )

    @property
    def has_any_data(self) -> bool:
        """Check if any dimension data is present."""
        return any(
            [
                self.max_hoogte is not None,
                self.max_bebouwingspercentage is not None,
                self.max_floor_area_ratio is not None,
                self.max_goothoogte is not None,
                self.max_bouwhoogte is not None,
                self.max_bouwlagen is not None,
            ]
        )


class FunctieAanduiding(BaseModel):
    """Function designation refining a bestemming (e.g., horeca, kantoren)."""

    naam: str = Field(description="Function designation name")
    groep: str | None = Field(default=None, description="Function group category")


class GebiedsAanduiding(BaseModel):
    """Area designation / overlay zone (e.g., noise zone, archaeology, safety)."""

    naam: str = Field(description="Area designation name")
    groep: str | None = Field(default=None, description="Area group category")


class PlanTekst(BaseModel):
    """Regulation text article from a bestemmingsplan."""

    titel: str = Field(description="Article title")
    inhoud: str | None = Field(default=None, description="Article text content (plain text)")


class ZoningRule(BaseModel):
    """Zoning rule for a specific area with permitted functions."""

    bestemming: str = Field(
        description="Permitted function name (e.g., 'Wonen', 'Gemengd')",
    )
    omschrijving: str | None = Field(
        default=None,
        description="Description of permitted uses",
    )
    building_dimensions: BuildingDimensions | None = Field(
        default=None,
        description="Building dimension constraints for this zoning rule",
    )
    geometry: dict | None = Field(
        default=None,
        description="GeoJSON geometry for map rendering",
    )


class ZoningPlan(BaseModel):
    """Zoning plan (bestemmingsplan) information."""

    plan_id: str = Field(
        description="DSO plan identifier",
    )
    plan_naam: str = Field(
        description="Plan name",
    )
    plan_type: str | None = Field(
        default=None,
        description="Plan type (e.g., 'bestemmingsplan', 'omgevingsplan')",
    )
    plan_status: str | None = Field(
        default=None,
        description="Plan status (e.g., 'vastgesteld', 'ontwerp')",
    )
    plan_datum: str | None = Field(
        default=None,
        description="Plan date (ISO format)",
    )
    rules: list[ZoningRule] = Field(
        description="Zoning rules extracted for property location",
    )
    functie_aanduidingen: list[FunctieAanduiding] = Field(
        default_factory=list,
        description="Function designations refining the main bestemming",
    )
    gebieds_aanduidingen: list[GebiedsAanduiding] = Field(
        default_factory=list,
        description="Area designations / overlay zones (noise, archaeology, etc.)",
    )
    teksten: list[PlanTekst] = Field(
        default_factory=list,
        description="Regulation text articles from the bestemmingsplan",
    )


class ZoningData(BaseModel):
    """Complete zoning data for a property location."""

    plans: list[ZoningPlan] = Field(
        description="Zoning plans (may be multiple overlapping plans)",
    )
    primary_bestemming: str | None = Field(
        default=None,
        description="Primary permitted function",
    )
    building_dimensions: BuildingDimensions | None = Field(
        default=None,
        description="Aggregated building dimension constraints",
    )
    data_gaps: list[str] = Field(
        default_factory=list,
        description="List of data elements that could not be extracted",
    )
    source: str = Field(
        default="DSO Ruimtelijke Plannen API v4",
        description="Data source identifier",
    )
    fallback_used: bool = Field(
        default=False,
        description="Whether AI fallback parsing was used",
    )

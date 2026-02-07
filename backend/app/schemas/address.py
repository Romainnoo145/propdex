"""Address schemas and validation."""

import re

from pydantic import BaseModel, Field, field_validator


class AddressInput(BaseModel):
    """
    Request schema for property lookup by address.

    Validates Dutch postcode format and normalizes to canonical form (1234 AB).
    """

    postcode: str = Field(
        description="Dutch postcode (e.g., '1234AB' or '1234 AB')",
        examples=["1234AB", "1234 AB"],
    )
    huisnummer: int = Field(
        gt=0,
        description="House number",
        examples=[42],
    )
    huisletter: str | None = Field(
        default=None,
        description="House letter (e.g., 'A')",
        examples=["A"],
    )
    toevoeging: str | None = Field(
        default=None,
        description="House number addition (e.g., 'bis', 'A')",
        examples=["bis"],
    )

    @field_validator("postcode")
    @classmethod
    def validate_dutch_postcode(cls, value: str) -> str:
        """
        Validate and normalize Dutch postcode format.

        Accepts: "1234AB" or "1234 AB"
        Returns: "1234 AB" (normalized with space)

        Args:
            value: Raw postcode input

        Returns:
            str: Normalized postcode in "1234 AB" format

        Raises:
            ValueError: If postcode doesn't match Dutch format
        """
        # Uppercase for validation
        normalized = value.upper().strip()

        # Dutch postcode pattern: 4 digits + optional space + 2 letters
        pattern = r"^(\d{4})\s?([A-Z]{2})$"
        match = re.match(pattern, normalized)

        if not match:
            raise ValueError(
                "Invalid Dutch postcode format. Expected: 1234AB or 1234 AB"
            )

        # Return normalized format: "1234 AB"
        digits, letters = match.groups()
        return f"{digits} {letters}"


class BAGAddressResponse(BaseModel):
    """Structured address data from BAG API."""

    nummeraanduiding_id: str = Field(
        description="BAG nummeraanduiding identifier"
    )
    verblijfsobject_id: str | None = Field(
        default=None,
        description="BAG verblijfsobject identifier (residential/commercial unit)",
    )
    straat: str = Field(description="Street name")
    huisnummer: int = Field(description="House number")
    huisletter: str | None = Field(default=None, description="House letter")
    toevoeging: str | None = Field(default=None, description="House number addition")
    postcode: str = Field(description="Normalized postcode (1234 AB)")
    woonplaats: str = Field(description="City/municipality name")


class BuildingData(BaseModel):
    """Building/pand details from BAG API."""

    pand_id: str = Field(description="BAG pand identifier")
    bouwjaar: int | None = Field(
        default=None,
        description="Construction year",
    )
    status: str | None = Field(
        default=None,
        description="Building status (e.g., 'Pand in gebruik')",
    )
    oppervlakte: int | None = Field(
        default=None,
        description="Surface area in m² (from verblijfsobject)",
    )
    gebruiksdoel: list[str] = Field(
        default_factory=list,
        description="Usage purposes (e.g., ['woonfunctie'])",
    )
    geometry: dict | None = Field(
        default=None,
        description="Raw GeoJSON geometry from BAG",
    )


class AddressResolution(BaseModel):
    """Complete address resolution result with building data."""

    address: BAGAddressResponse = Field(description="Address details from BAG")
    building: BuildingData | None = Field(
        default=None,
        description="Building details (None if lookup failed or no building data)",
    )
    resolved_at: str = Field(description="ISO 8601 timestamp when resolved")
    source: str = Field(
        default="bag",
        description="Data source attribution",
    )

"""Unit tests for vacancy confidence model."""

from app.services.parcel_scoring import compute_vacancy_confidence


class MockParcelData:
    def __init__(
        self,
        has_pand: bool = True,
        pand_status: str = "",
        bouwjaar: int | None = None,
        area_m2: float | None = None,
        bestemmingen: list | None = None,
    ) -> None:
        self.has_pand = has_pand
        self.pand_status = pand_status
        self.bouwjaar = bouwjaar
        self.area_m2 = area_m2
        self.bestemmingen = bestemmingen if bestemmingen is not None else []


def test_empty_land_yields_high_confidence():
    parcel = MockParcelData(
        has_pand=False,
        area_m2=1200,
        bestemmingen=[
            {
                "type": "Gemengd",
                "max_floor_area_ratio": 1.6,
                "max_bebouwingspercentage": 55,
            }
        ],
    )

    result = compute_vacancy_confidence(parcel)

    assert result.confidence >= 0.85
    assert len(result.reasons) <= 3
    assert any("Geen pand geregistreerd" in reason for reason in result.reasons)
    assert result.model_version == "vacancy-confidence-v1"


def test_in_use_with_recent_permits_lowers_confidence():
    parcel = MockParcelData(
        has_pand=True,
        pand_status="Pand in gebruik",
        bouwjaar=2019,
        area_m2=420,
        bestemmingen=[{"type": "Wonen"}],
    )

    result = compute_vacancy_confidence(
        parcel,
        permit_activity={
            "permit_count_180d": 4,
            "permit_count_365d": 5,
            "granted_count_365d": 3,
        },
    )

    assert result.confidence <= 0.20
    assert any("in gebruik" in reason.lower() for reason in result.reasons)


def test_demolition_permit_boosts_confidence():
    parcel = MockParcelData(
        has_pand=True,
        pand_status="Pand buiten gebruik",
        bouwjaar=1968,
        area_m2=980,
        bestemmingen=[{"type": "Bedrijf", "max_floor_area_ratio": 1.0}],
    )

    result = compute_vacancy_confidence(
        parcel,
        permit_activity={
            "permit_count_180d": 1,
            "permit_count_365d": 2,
            "demolition_count_365d": 1,
            "granted_count_365d": 0,
        },
    )

    assert result.confidence >= 0.75
    assert any("Sloop-gerelateerde vergunningen" in reason for reason in result.reasons)


def test_listing_friction_increases_confidence():
    parcel = MockParcelData(
        has_pand=True,
        pand_status="Pand in gebruik",
        bouwjaar=1998,
        area_m2=880,
        bestemmingen=[{"type": "Gemengd", "max_floor_area_ratio": 1.2}],
    )

    no_listing = compute_vacancy_confidence(parcel)
    with_listing = compute_vacancy_confidence(
        parcel,
        listing_signal={
            "listing_duration_days": 240,
            "price_change_count": 3,
        },
    )

    assert with_listing.confidence > no_listing.confidence
    assert any("Langdurige listing" in reason for reason in with_listing.reasons)

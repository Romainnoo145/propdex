"""Unit tests for parcel opportunity insight extraction."""

from app.services.parcel_scoring import (
    derive_opportunity_insights,
    extract_building_metrics,
)


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


def test_derive_insights_empty_parcel_signal():
    parcel = MockParcelData(
        has_pand=False,
        pand_status="",
        area_m2=1200.0,
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
    )

    insights = derive_opportunity_insights(parcel)

    assert insights.vacancy_signal == "leeg_perceel"
    assert "Leeg perceel (geen pand geregistreerd)" in insights.signals
    assert "Bestemming ondersteunt wonen/gemengd" in insights.signals


def test_derive_insights_vacant_and_build_metrics():
    parcel = MockParcelData(
        has_pand=True,
        pand_status="Pand buiten gebruik",
        bouwjaar=1965,
        area_m2=900.0,
        bestemmingen=[
            {
                "type": "Gemengd",
                "naam": "Gemengd - 1",
                "max_bebouwingspercentage": 75,
                "max_floor_area_ratio": 2.5,
            }
        ],
    )

    insights = derive_opportunity_insights(parcel)

    assert insights.vacancy_signal == "leegstaand_pand"
    assert insights.building_metrics["max_bebouwingspercentage"] == 75.0
    assert insights.building_metrics["max_floor_area_ratio"] == 2.5
    assert any("Max FAR" in s for s in insights.signals)


def test_extract_building_metrics_from_maatvoering_text():
    bestemmingen = [
        {
            "type": "Wonen",
            "maatvoering": '"maximum bebouwingspercentage terrein (%)"="60"',
            "naam": "maximum bebouwingspercentage (%)",
        },
        {
            "type": "Gemengd",
            "maatvoering": '"maximum FSI"="2,2"',
            "naam": "maximale floor area ratio",
        },
    ]

    metrics = extract_building_metrics(bestemmingen)

    assert metrics["max_bebouwingspercentage"] == 60.0
    assert metrics["max_floor_area_ratio"] == 2.2

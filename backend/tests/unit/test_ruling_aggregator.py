"""Tests for ruling_aggregator.aggregate_dev_type_rulings.

M046/S01 RM-1 fix: vergunning_succeskans en juridisch_klimaat moeten alleen
geaggregeerd worden over developer-relevante vergunningstypen (nieuwbouw, sloop,
bestemmingswijziging, uitbreiding), niet over alle 9 Claude-classificatiecategorieën.

Covers:
- Pure dev-type filter op gemengde dataset
- Missing-signaal onder MIN_DEV_RULINGS_FOR_AGGREGATION threshold
- Missing-signaal bij nul dev-rulings
- NULL vergunningstype wordt uitgefilterd (niet als 'overig' geteld)
- Dev-only dataset: gefilterd = ongefilterd
- Constant-invariant: DEV_VERGUNNINGSTYPEN is exact 4 types
"""

from app.services.ruling_aggregator import (
    DEV_VERGUNNINGSTYPEN,
    MIN_DEV_RULINGS_FOR_AGGREGATION,
    aggregate_dev_type_rulings,
)


def test_aggregate_filters_dev_types_only() -> None:
    """Mixed dataset: only 4 dev-relevante categories count toward aggregation."""
    rulings = (
        [{"uitkomst": "toegewezen", "vergunningstype": "nieuwbouw"}] * 3
        + [{"uitkomst": "afgewezen", "vergunningstype": "nieuwbouw"}] * 2
        + [{"uitkomst": "toegewezen", "vergunningstype": "dakopbouw"}] * 1
        + [{"uitkomst": "afgewezen", "vergunningstype": "dakopbouw"}] * 4
        + [{"uitkomst": "afgewezen", "vergunningstype": "milieu"}] * 2
        + [{"uitkomst": "toegewezen", "vergunningstype": "bestemmingswijziging"}] * 1
    )
    # Dev: 5 nieuwbouw (3T,2A) + 1 bestemmingswijziging (1T,0A) = 6 rulings, 4T, 2A
    # Non-dev: 5 dakopbouw + 2 milieu = 7 rulings
    # Total: 13
    result = aggregate_dev_type_rulings(rulings)

    assert result.missing is False, "6 dev-rulings is above threshold 5"
    assert result.ruling_count_dev_types == 6
    assert result.ruling_count_total == 13
    assert result.toegewezen_count == 4
    assert result.afgewezen_count == 2
    assert result.succeskans == 67, "4 toegewezen / 6 dev-rulings = 66.67, round = 67"
    assert result.klimaat_score == 67, "100 - round(100*2/6) = 100-33 = 67"
    assert result.reason is None


def test_aggregate_returns_missing_when_below_threshold() -> None:
    """4 dev-rulings < MIN=5 triggers missing signal."""
    rulings = (
        [{"uitkomst": "toegewezen", "vergunningstype": "nieuwbouw"}] * 1
        + [{"uitkomst": "toegewezen", "vergunningstype": "dakopbouw"}] * 1
        + [{"uitkomst": "afgewezen", "vergunningstype": "dakopbouw"}] * 2
    )
    result = aggregate_dev_type_rulings(rulings)

    assert result.missing is True
    assert result.ruling_count_dev_types == 1
    assert result.ruling_count_total == 4
    assert result.succeskans is None
    assert result.klimaat_score is None
    assert result.reason == "insufficient_dev_type_rulings"


def test_aggregate_returns_missing_when_zero_dev_types() -> None:
    """All non-dev rulings → dev_count=0, missing=True."""
    rulings = (
        [{"uitkomst": "toegewezen", "vergunningstype": "dakopbouw"}] * 2
        + [{"uitkomst": "afgewezen", "vergunningstype": "milieu"}] * 3
    )
    result = aggregate_dev_type_rulings(rulings)

    assert result.missing is True
    assert result.ruling_count_dev_types == 0
    assert result.ruling_count_total == 5
    assert result.succeskans is None
    assert result.reason == "insufficient_dev_type_rulings"


def test_aggregate_filters_out_null_vergunningstype() -> None:
    """NULL vergunningstype = niet-geclassificeerd, filtered uit (niet als 'overig').

    Rationale: NULL betekent pre-Phase-84 data of klassificatie-fail. Behandelen
    als 'onbekend' is veiliger dan aannemen dat het in categorie 'overig' valt.
    """
    rulings = (
        [{"uitkomst": "toegewezen", "vergunningstype": "nieuwbouw"}] * 5
        + [{"uitkomst": "toegewezen", "vergunningstype": None}] * 3
    )
    result = aggregate_dev_type_rulings(rulings)

    # NULL-records worden NIET gefilterd als dev-type; 5 nieuwbouw meetellen.
    # 5 dev-rulings is exact threshold, missing=False.
    assert result.missing is False
    assert result.ruling_count_dev_types == 5
    assert result.ruling_count_total == 8
    assert result.succeskans == 100, "All 5 dev-rulings toegewezen"
    assert result.klimaat_score == 100


def test_aggregate_matches_unfiltered_on_dev_only_dataset() -> None:
    """Pure-dev dataset: filter heeft geen effect (parity check)."""
    rulings = (
        [{"uitkomst": "toegewezen", "vergunningstype": "nieuwbouw"}] * 3
        + [{"uitkomst": "afgewezen", "vergunningstype": "nieuwbouw"}] * 3
    )
    result = aggregate_dev_type_rulings(rulings)

    assert result.missing is False
    assert result.ruling_count_dev_types == 6
    assert result.ruling_count_total == 6
    assert result.succeskans == 50
    assert result.klimaat_score == 50


def test_dev_vergunningstypen_constant_is_exactly_four_types() -> None:
    """Invariant: filter-set is EXACT deze 4 categorieen. Iron-rule beton."""
    assert DEV_VERGUNNINGSTYPEN == frozenset(
        {"nieuwbouw", "sloop", "bestemmingswijziging", "uitbreiding"}
    )
    # Expliciet NIET in de set — burger/niet-dev categorieen
    assert "verbouw" not in DEV_VERGUNNINGSTYPEN
    assert "dakopbouw" not in DEV_VERGUNNINGSTYPEN
    assert "milieu" not in DEV_VERGUNNINGSTYPEN
    assert "monumenten" not in DEV_VERGUNNINGSTYPEN
    assert "overig" not in DEV_VERGUNNINGSTYPEN
    # Threshold invariant
    assert MIN_DEV_RULINGS_FOR_AGGREGATION == 5

"""M046/S01 iron-rule regression tests.

These tests MUST pass before any future M046 slice merges. They guard against
regressions that would re-introduce the RM-1 bug — `vergunning_succeskans`
aggregated ungefilterd across all 9 ruling categories instead of dev-only.
"""

from app.services.ruling_aggregator import (
    DEV_VERGUNNINGSTYPEN,
    MIN_DEV_RULINGS_FOR_AGGREGATION,
    aggregate_dev_type_rulings,
)


def test_dev_vergunningstypen_constant_is_exactly_four_types() -> None:
    """RM-1 fix: filter must be exactly these 4 types — not 3, not 5, not 9."""
    assert DEV_VERGUNNINGSTYPEN == frozenset(
        {"nieuwbouw", "sloop", "bestemmingswijziging", "uitbreiding"}
    )


def test_filtered_aggregation_differs_from_unfiltered_on_mixed_dataset() -> None:
    """RM-1 iron rule: on a realistic mixed-type dataset the dev-type filter
    MUST produce different succeskans than unfiltered aggregation.

    If this test passes with equal values, the filter is silently broken.
    """
    rulings = (
        [{"uitkomst": "toegewezen", "vergunningstype": "nieuwbouw"}] * 3
        + [{"uitkomst": "afgewezen", "vergunningstype": "nieuwbouw"}] * 2
        + [{"uitkomst": "toegewezen", "vergunningstype": "dakopbouw"}] * 1
        + [{"uitkomst": "afgewezen", "vergunningstype": "dakopbouw"}] * 4
        + [{"uitkomst": "afgewezen", "vergunningstype": "milieu"}] * 2
        + [{"uitkomst": "toegewezen", "vergunningstype": "bestemmingswijziging"}] * 1
    )
    # Unfiltered:  5 toegewezen / 13 total = 38
    # Dev-filtered: 4 toegewezen / 6 dev-rulings = 67
    dev_agg = aggregate_dev_type_rulings(rulings)
    assert dev_agg.succeskans == 67, "Filter not applied: got unfiltered aggregation"
    assert dev_agg.ruling_count_dev_types == 6
    assert dev_agg.ruling_count_total == 13


def test_threshold_is_exactly_five() -> None:
    """RM-1 iron rule: changing threshold silently would shift scoring behavior."""
    assert MIN_DEV_RULINGS_FOR_AGGREGATION == 5

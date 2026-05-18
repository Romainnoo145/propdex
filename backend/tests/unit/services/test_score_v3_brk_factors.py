"""Unit tests for M050/S03 BRK-driven risico-factor functions.

Covers all locked buckets for the 3 new factor functions:
- score_hypotheek_risico (D4)
- score_eigendoms_complexiteit (D5)
- score_koopwaarde_trend (D6, koopjaar-age proxy)

Each function consumes ``parcel_data['brk_records']`` (list of BRKRecordDict-shaped
dicts materialized by Plan 03-01's ``enrich_parcel_data_with_brk``). Empty / missing
records short-circuit via Plan 03-01's ``_missing_brk`` helper.
"""

from __future__ import annotations

from datetime import datetime

from app.services.score_v3_factors import (
    score_eigendoms_complexiteit,
    score_hypotheek_risico,
    score_koopwaarde_trend,
)


def _rec(**kwargs: object) -> dict[str, object]:
    """Build a BRKRecordDict-shaped test record with sane defaults."""
    defaults: dict[str, object] = {
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": "Acme BV",
        "kvk_nummer": "12345678",
        "heeft_hypotheek": False,
        "koopjaar": 2015,
        "koopsom": 250000.0,
        "fetched_at": "2026-01-01T00:00:00",
    }
    defaults.update(kwargs)
    return defaults


# ---------------------------------------------------------------------------
# score_hypotheek_risico (D4)
# ---------------------------------------------------------------------------


def test_hypotheek_risico_empty_records_missing() -> None:
    """Empty list → missing=True, gewicht=10 (D3 + D4)."""
    result = score_hypotheek_risico({"brk_records": []})
    assert result.missing is True
    assert result.gewicht == 10
    assert result.categorie == "risico"
    assert result.data_bronnen == ["brk_ownership_records"]


def test_hypotheek_risico_no_records_key_missing() -> None:
    """Absent brk_records key (parcel without BRK enrichment) → missing=True."""
    result = score_hypotheek_risico({})
    assert result.missing is True
    assert result.gewicht == 10


def test_hypotheek_risico_all_false_score_zero() -> None:
    """All eigenaren without hypotheek → score=0.0, missing=False."""
    records = [_rec(heeft_hypotheek=False), _rec(eigenaar_naam="B", heeft_hypotheek=False)]
    result = score_hypotheek_risico({"brk_records": records})
    assert result.missing is False
    assert result.genormaliseerde_score == 0.0
    assert result.bijdrage == 0.0


def test_hypotheek_risico_any_true_score_one() -> None:
    """ANY mortgaged owner → score=1.0 (D4 binary on any-True)."""
    records = [
        _rec(eigenaar_naam="A", heeft_hypotheek=True),
        _rec(eigenaar_naam="B", heeft_hypotheek=False),
        _rec(eigenaar_naam="C", heeft_hypotheek=False),
    ]
    result = score_hypotheek_risico({"brk_records": records})
    assert result.missing is False
    assert result.genormaliseerde_score == 1.0
    assert result.bijdrage == 10.0


def test_hypotheek_risico_all_true_score_one() -> None:
    """All eigenaren mortgaged → score=1.0."""
    records = [
        _rec(eigenaar_naam="A", heeft_hypotheek=True),
        _rec(eigenaar_naam="B", heeft_hypotheek=True),
    ]
    result = score_hypotheek_risico({"brk_records": records})
    assert result.genormaliseerde_score == 1.0


def test_hypotheek_risico_narrative_contains_counts() -> None:
    """toelichting_kort contains '1/3 eigenaren met hypotheek'."""
    records = [
        _rec(eigenaar_naam="A", heeft_hypotheek=True),
        _rec(eigenaar_naam="B", heeft_hypotheek=False),
        _rec(eigenaar_naam="C", heeft_hypotheek=False),
    ]
    result = score_hypotheek_risico({"brk_records": records})
    assert "1/3 eigenaren met hypotheek" in result.toelichting_kort


# ---------------------------------------------------------------------------
# score_eigendoms_complexiteit (D5)
# ---------------------------------------------------------------------------


def test_eigendoms_complexiteit_empty_missing() -> None:
    """Empty list → missing=True, gewicht=6."""
    result = score_eigendoms_complexiteit({"brk_records": []})
    assert result.missing is True
    assert result.gewicht == 6
    assert result.categorie == "risico"


def test_eigendoms_complexiteit_single_owner_score_zero() -> None:
    """1 unique (naam, kvk) → score=0.0 (D5 bucket 1)."""
    result = score_eigendoms_complexiteit({"brk_records": [_rec()]})
    assert result.missing is False
    assert result.genormaliseerde_score == 0.0


def test_eigendoms_complexiteit_two_owners_score_half() -> None:
    """2 distinct (naam, kvk) → score=0.5 (D5 bucket 2)."""
    records = [
        _rec(eigenaar_naam="A", kvk_nummer="111"),
        _rec(eigenaar_naam="B", kvk_nummer="222"),
    ]
    result = score_eigendoms_complexiteit({"brk_records": records})
    assert result.genormaliseerde_score == 0.5


def test_eigendoms_complexiteit_three_owners_score_one() -> None:
    """3 distinct (naam, kvk) → score=1.0 (D5 bucket ≥3)."""
    records = [
        _rec(eigenaar_naam="A", kvk_nummer="111"),
        _rec(eigenaar_naam="B", kvk_nummer="222"),
        _rec(eigenaar_naam="C", kvk_nummer="333"),
    ]
    result = score_eigendoms_complexiteit({"brk_records": records})
    assert result.genormaliseerde_score == 1.0


def test_eigendoms_complexiteit_dedup_same_naam_kvk() -> None:
    """3 records all same (naam, kvk) → n_owners=1 → score=0.0 (F4 dedup)."""
    records = [
        _rec(eigenaar_naam="A", kvk_nummer="111"),
        _rec(eigenaar_naam="A", kvk_nummer="111"),
        _rec(eigenaar_naam="A", kvk_nummer="111"),
    ]
    result = score_eigendoms_complexiteit({"brk_records": records})
    assert result.genormaliseerde_score == 0.0


def test_eigendoms_complexiteit_all_nulls_collapse_to_one() -> None:
    """All (None, None) → n_owners=1 (F4 NULL-collapse) → score=0.0."""
    records = [
        _rec(eigenaar_naam=None, kvk_nummer=None),
        _rec(eigenaar_naam=None, kvk_nummer=None),
        _rec(eigenaar_naam=None, kvk_nummer=None),
    ]
    result = score_eigendoms_complexiteit({"brk_records": records})
    assert result.genormaliseerde_score == 0.0


# ---------------------------------------------------------------------------
# score_koopwaarde_trend (D6 koopjaar-age proxy + F5 future-koopjaar guard)
# ---------------------------------------------------------------------------


def _current_year() -> int:
    return datetime.utcnow().year


def test_koopwaarde_trend_empty_missing() -> None:
    """Empty list → missing=True, gewicht=4."""
    result = score_koopwaarde_trend({"brk_records": []})
    assert result.missing is True
    assert result.gewicht == 4
    assert result.categorie == "risico"


def test_koopwaarde_trend_null_koopjaar_missing() -> None:
    """koopjaar=None → missing=True."""
    records = [_rec(koopjaar=None)]
    result = score_koopwaarde_trend({"brk_records": records})
    assert result.missing is True


def test_koopwaarde_trend_future_koopjaar_missing() -> None:
    """F5: koopjaar > current_year (data error) → missing=True."""
    records = [_rec(koopjaar=_current_year() + 5)]
    result = score_koopwaarde_trend({"brk_records": records})
    assert result.missing is True


def test_koopwaarde_trend_age_2_score_03() -> None:
    """age < 5 → score=0.3 (recente koop)."""
    records = [_rec(koopjaar=_current_year() - 2)]
    result = score_koopwaarde_trend({"brk_records": records})
    assert result.missing is False
    assert result.genormaliseerde_score == 0.3


def test_koopwaarde_trend_age_8_score_05() -> None:
    """5 ≤ age < 15 → score=0.5 (actuele koopsom-vermelding)."""
    records = [_rec(koopjaar=_current_year() - 8)]
    result = score_koopwaarde_trend({"brk_records": records})
    assert result.genormaliseerde_score == 0.5


def test_koopwaarde_trend_age_18_score_07() -> None:
    """15 ≤ age < 25 → score=0.7."""
    records = [_rec(koopjaar=_current_year() - 18)]
    result = score_koopwaarde_trend({"brk_records": records})
    assert result.genormaliseerde_score == 0.7


def test_koopwaarde_trend_age_30_score_09() -> None:
    """age ≥ 25 → score=0.9 (sterk verouderd)."""
    records = [_rec(koopjaar=_current_year() - 30)]
    result = score_koopwaarde_trend({"brk_records": records})
    assert result.genormaliseerde_score == 0.9

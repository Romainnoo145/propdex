"""REGRESSION-CRITICAL — M050/S03 D6 narrative honesty rule.

``score_koopwaarde_trend`` is a koopjaar-age proxy, NOT a real price-development
signal (single koopsom + koopjaar per record cannot produce a real time-series).
Narrative text MUST honestly state this — the substring ``"trend"`` is BANNED
from ``toelichting_kort`` AND ``toelichting_lang`` (case-insensitive).

Future drift back to a misleading wording silently regresses an AVG-style
truth-claim. Per MEMORY.md iron-rule pattern.

Note: the FUNCTION NAME ``score_koopwaarde_trend`` itself is allowed — only
the narrative TEXT fields are inspected by this guard.
"""

from __future__ import annotations

from datetime import datetime

from app.services.score_v3_factors import score_koopwaarde_trend

_BANNED = "trend"


def _build_parcel_with_koopjaar(years_ago: int) -> dict[str, list[dict[str, object]]]:
    koopjaar = datetime.utcnow().year - years_ago
    return {
        "brk_records": [
            {
                "koopjaar": koopjaar,
                "fetched_at": "2026-01-01T00:00:00",
                "koopsom": 250000.0,
            }
        ]
    }


def test_koopwaarde_trend_narrative_no_banned_word_2y() -> None:
    """age=2 bucket: narrative MUST NOT contain banned word (case-insensitive)."""
    result = score_koopwaarde_trend(_build_parcel_with_koopjaar(2))
    assert _BANNED not in result.toelichting_kort.lower(), (
        f"D6 banned word found in toelichting_kort: {result.toelichting_kort!r}"
    )
    assert _BANNED not in result.toelichting_lang.lower(), (
        f"D6 banned word found in toelichting_lang: {result.toelichting_lang!r}"
    )


def test_koopwaarde_trend_narrative_no_banned_word_8y() -> None:
    """age=8 bucket: narrative MUST NOT contain banned word."""
    result = score_koopwaarde_trend(_build_parcel_with_koopjaar(8))
    assert _BANNED not in result.toelichting_kort.lower()
    assert _BANNED not in result.toelichting_lang.lower()


def test_koopwaarde_trend_narrative_no_banned_word_18y() -> None:
    """age=18 bucket: narrative MUST NOT contain banned word."""
    result = score_koopwaarde_trend(_build_parcel_with_koopjaar(18))
    assert _BANNED not in result.toelichting_kort.lower()
    assert _BANNED not in result.toelichting_lang.lower()


def test_koopwaarde_trend_narrative_no_banned_word_30y() -> None:
    """age=30 bucket: narrative MUST NOT contain banned word."""
    result = score_koopwaarde_trend(_build_parcel_with_koopjaar(30))
    assert _BANNED not in result.toelichting_kort.lower()
    assert _BANNED not in result.toelichting_lang.lower()


def test_koopwaarde_trend_narrative_no_banned_word_missing() -> None:
    """Missing-path narrative also MUST NOT contain banned word."""
    result = score_koopwaarde_trend({"brk_records": []})
    assert _BANNED not in result.toelichting_kort.lower()
    assert _BANNED not in result.toelichting_lang.lower()

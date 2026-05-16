"""Score breakdown redaction for public API responses (Phase 04.2 security).

Strips factor weight fields from `score_breakdown` payloads so that
unauthorized clients (demo / trial / lapsed-subscription orgs) cannot
scrape the per-factor weight table that constitutes Propdex' scoring IP.

The factor _names_ and normalized 0-1 scores stay visible because the
frontend (ScoreBreakdownModal, Potentie/RisicoLayer) needs them to render.
Reverse-engineering the weight table from normalized scores requires
statistical inference across thousands of parcels — a much higher friction
than reading `gewicht: 13` directly out of one response.

Redacted keys (the IP):
- gewicht                    — absolute factor weight
- bijdrage                   — score × weight contribution
- percentage_of_category     — normalized share within potentie/risico
- waarde                     — raw factor value pre-normalization

Preserved keys:
- factor_name / source_key   — frontend needs identifiers
- categorie                  — potentie/risico classification
- genormaliseerde_score      — 0-1 indicator for UI pills
- data_bronnen               — list of input data sources (not IP)
- toelichting_kort / _lang   — human-readable explanations (user-facing)
"""

from typing import Any

REDACTED_FACTOR_KEYS: frozenset[str] = frozenset({
    "gewicht",
    "bijdrage",
    "percentage_of_category",
    "waarde",
})


def redact_score_breakdown(
    breakdown: dict | None,
    *,
    expose_internals: bool,
) -> tuple[dict | None, bool]:
    """Strip factor-weight fields from a score breakdown when caller is not authorized.

    Args:
        breakdown: The raw `score_breakdown` dict from scan flags (may be
            v3.0 format with `factors`/`subscores`/`model_version`, or legacy
            top-level factor dict).
        expose_internals: When True, returns the breakdown unchanged.
            When False, deep-copies the breakdown with REDACTED_FACTOR_KEYS
            stripped from each factor entry.

    Returns:
        Tuple of (possibly-redacted breakdown, was_redacted flag).
        `was_redacted` is True when redaction was applied AND the breakdown
        actually contained any of the redacted keys — used by the frontend
        to show a "Pro" badge.
    """
    if breakdown is None:
        return None, False
    if expose_internals:
        return breakdown, False

    redacted_any = False
    new_breakdown: dict[str, Any] = {}

    for key, value in breakdown.items():
        if key == "factors" and isinstance(value, dict):
            new_factors: dict[str, Any] = {}
            for factor_key, factor_payload in value.items():
                stripped, was_stripped = _strip_factor(factor_payload)
                new_factors[factor_key] = stripped
                redacted_any = redacted_any or was_stripped
            new_breakdown[key] = new_factors
        elif key == "factors" and isinstance(value, list):
            new_list: list[Any] = []
            for factor_payload in value:
                stripped, was_stripped = _strip_factor(factor_payload)
                new_list.append(stripped)
                redacted_any = redacted_any or was_stripped
            new_breakdown[key] = new_list
        elif isinstance(value, dict) and _looks_like_factor(value):
            # Legacy flat-shape: {factor_name: {gewicht, bijdrage, ...}}
            stripped, was_stripped = _strip_factor(value)
            new_breakdown[key] = stripped
            redacted_any = redacted_any or was_stripped
        else:
            new_breakdown[key] = value

    return new_breakdown, redacted_any


def _looks_like_factor(value: dict) -> bool:
    """Heuristic: dict is a factor payload if it has any of the redacted keys."""
    return bool(REDACTED_FACTOR_KEYS & value.keys())


def _strip_factor(payload: Any) -> tuple[Any, bool]:
    """Strip REDACTED_FACTOR_KEYS from a single factor entry."""
    if not isinstance(payload, dict):
        return payload, False
    stripped = {k: v for k, v in payload.items() if k not in REDACTED_FACTOR_KEYS}
    was_stripped = len(stripped) != len(payload)
    return stripped, was_stripped

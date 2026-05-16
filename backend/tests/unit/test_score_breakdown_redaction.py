"""Unit tests for `redact_score_breakdown` (Phase 04.2 security).

Verifies the redaction helper strips the factor-weight fields that constitute
Propdex' scoring IP — and only those — without breaking the
genormaliseerde_score / data_bronnen / toelichting fields the frontend needs.
"""

from app.scans.redaction import REDACTED_FACTOR_KEYS, redact_score_breakdown


def _v3_breakdown_sample() -> dict:
    """v3.0-shaped score_breakdown: factors keyed by name, each with categorie."""
    return {
        "woonvisie_match": {
            "categorie": "potentie",
            "waarde": 0.83,
            "genormaliseerde_score": 0.83,
            "gewicht": 13,
            "bijdrage": 10.79,
            "percentage_of_category": 0.18,
            "toelichting_kort": "Sluit aan op woonvisie",
            "data_bronnen": ["woonvisie.pdf"],
            "missing": False,
        },
        "demografie": {
            "categorie": "potentie",
            "waarde": 0.55,
            "genormaliseerde_score": 0.55,
            "gewicht": 12,
            "bijdrage": 6.60,
            "percentage_of_category": 0.16,
            "toelichting_kort": "Demografie groei",
            "data_bronnen": ["CBS"],
            "missing": False,
        },
        "overstromingsrisico": {
            "categorie": "risico",
            "waarde": 0.20,
            "genormaliseerde_score": 0.20,
            "gewicht": 8,
            "bijdrage": 1.60,
            "percentage_of_category": 0.12,
            "toelichting_kort": "Laag risico",
            "data_bronnen": ["overstromingsrisico WMS"],
            "missing": False,
        },
    }


def test_returns_none_when_breakdown_is_none() -> None:
    out, redacted = redact_score_breakdown(None, expose_internals=False)
    assert out is None
    assert redacted is False


def test_pass_through_when_expose_internals_true() -> None:
    breakdown = _v3_breakdown_sample()
    out, redacted = redact_score_breakdown(breakdown, expose_internals=True)
    assert out is breakdown  # identity — no copy when exposing
    assert redacted is False
    assert out["woonvisie_match"]["gewicht"] == 13


def test_strips_weight_fields_when_expose_internals_false() -> None:
    breakdown = _v3_breakdown_sample()
    out, redacted = redact_score_breakdown(breakdown, expose_internals=False)

    assert redacted is True
    for factor_name, factor_payload in out.items():
        assert isinstance(factor_payload, dict), factor_name
        for redacted_key in REDACTED_FACTOR_KEYS:
            assert redacted_key not in factor_payload, (
                f"{redacted_key} leaked in factor {factor_name}"
            )


def test_preserves_ui_fields_after_redaction() -> None:
    breakdown = _v3_breakdown_sample()
    out, _ = redact_score_breakdown(breakdown, expose_internals=False)

    woonvisie = out["woonvisie_match"]
    assert woonvisie["categorie"] == "potentie"
    assert woonvisie["genormaliseerde_score"] == 0.83
    assert woonvisie["toelichting_kort"] == "Sluit aan op woonvisie"
    assert woonvisie["data_bronnen"] == ["woonvisie.pdf"]
    assert woonvisie["missing"] is False


def test_does_not_mutate_input() -> None:
    breakdown = _v3_breakdown_sample()
    snapshot = {
        name: dict(payload) for name, payload in breakdown.items()
    }
    redact_score_breakdown(breakdown, expose_internals=False)
    assert breakdown == snapshot, "input breakdown was mutated"


def test_nested_factors_dict_shape() -> None:
    breakdown = {
        "factors": _v3_breakdown_sample(),
        "subscores": {"potentie": 70.0, "risico": 30.0},
        "model_version": "v3.0",
    }
    out, redacted = redact_score_breakdown(breakdown, expose_internals=False)

    assert redacted is True
    assert out["subscores"] == {"potentie": 70.0, "risico": 30.0}
    assert out["model_version"] == "v3.0"
    for factor_payload in out["factors"].values():
        assert "gewicht" not in factor_payload
        assert "bijdrage" not in factor_payload
        assert "percentage_of_category" not in factor_payload
        assert "waarde" not in factor_payload


def test_nested_factors_list_shape() -> None:
    breakdown = {
        "factors": [
            {"name": "woonvisie", "categorie": "potentie", "gewicht": 13, "bijdrage": 9.0},
            {"name": "demografie", "categorie": "potentie", "gewicht": 12, "bijdrage": 6.0},
        ],
    }
    out, redacted = redact_score_breakdown(breakdown, expose_internals=False)

    assert redacted is True
    assert isinstance(out["factors"], list)
    for factor in out["factors"]:
        assert "gewicht" not in factor
        assert "bijdrage" not in factor
        assert "name" in factor
        assert "categorie" in factor


def test_redacted_flag_false_when_no_weight_keys_present() -> None:
    """A breakdown that already lacks weight keys should report redacted=False."""
    breakdown = {
        "woonvisie_match": {
            "categorie": "potentie",
            "genormaliseerde_score": 0.83,
            "toelichting_kort": "Sluit aan op woonvisie",
        },
    }
    out, redacted = redact_score_breakdown(breakdown, expose_internals=False)

    assert redacted is False
    assert "gewicht" not in out["woonvisie_match"]


def test_legacy_flat_breakdown() -> None:
    """Legacy pre-v3.0 breakdown: factor keys at top level, no 'factors' wrapper."""
    breakdown = {
        "ligging": {"gewicht": 10, "bijdrage": 5.0, "genormaliseerde_score": 0.5},
        "demografie": {"gewicht": 8, "bijdrage": 3.2, "genormaliseerde_score": 0.4},
    }
    out, redacted = redact_score_breakdown(breakdown, expose_internals=False)

    assert redacted is True
    assert "gewicht" not in out["ligging"]
    assert out["ligging"]["genormaliseerde_score"] == 0.5

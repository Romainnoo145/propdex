"""M054/S02 — parkeerdruk in compute_score_v3: verdict-gating + sparse weight-0.

Mirrors test_compute_score_v3_splitsingsrisico: only the 'verhoogd' verdict carries
weight (7); 'laag' / 'geen_match' / no-payload stay context-only (weight 0). Also pins
that the risico redistribution holds when the nota is absent.
"""
from app.ai.factors.parkeerdruk import ParkeernormenPayload
from app.services.score_v3 import (
    _RISICO_REDISTRIBUTION_TARGET,
    compute_score_v3,
)

_WONEN = [{"type": "wonen"}]


def _payload(**overrides) -> ParkeernormenPayload:
    base = {
        "peiljaar": 2026,
        "parkeerregulering_van_toepassing": False,
        "normbanden": [
            {
                "functie": "appartement vrije sector",
                "functiecategorie": "wonen",
                "bestemming_trefwoorden": ["wonen"],
                "gebied": "rest_bebouwde_kom",
                "auto_norm_per_eenheid": 0.5,
            }
        ],
        "openbare_ruimte_drempel_pct": 70,
        "centrum_uitgesloten": True,
        "fietsnorm_harde_eis": False,
        "confidence": 0.9,
    }
    base.update(overrides)
    return ParkeernormenPayload.model_validate(base)


_VERHOOGD = _payload(
    normbanden=[
        {
            "functie": "appartement centrum",
            "functiecategorie": "wonen",
            "bestemming_trefwoorden": ["wonen"],
            "gebied": "centrum",
            "auto_norm_per_eenheid": 1.0,
            "fiets_norm_per_eenheid": 2.0,
        }
    ],
    centrum_uitgesloten=True,
)


def _parcel(bestemmingen=_WONEN) -> dict:
    return {"area_m2": 500, "has_pand": True, "bestemmingen": bestemmingen}


def test_verhoogd_krijgt_gewicht():
    r = compute_score_v3(
        _parcel(), {}, project_type="nieuwbouw_wonen",
        cascade_payloads={"parkeerdruk": _VERHOOGD},
    )
    f = r.score_breakdown["parkeerdruk"]
    assert f.waarde["verdict"] == "verhoogd"
    assert f.gewicht == 7.0 and f.bijdrage > 0


def test_laag_context_only():
    r = compute_score_v3(
        _parcel(), {}, project_type="nieuwbouw_wonen",
        cascade_payloads={"parkeerdruk": _payload()},
    )
    f = r.score_breakdown["parkeerdruk"]
    assert f.waarde["verdict"] == "laag"
    assert f.gewicht == 0.0 and f.bijdrage == 0.0  # zichtbaar in card, telt niet mee


def test_geen_match_context_only():
    r = compute_score_v3(
        _parcel(bestemmingen=[{"type": "bedrijf"}]), {},
        cascade_payloads={"parkeerdruk": _payload()},
    )
    f = r.score_breakdown["parkeerdruk"]
    assert f.waarde["verdict"] == "geen_match"
    assert f.gewicht == 0.0 and f.bijdrage == 0.0


def test_geen_payload_missing_weight_0():
    r = compute_score_v3(_parcel(), {}, cascade_payloads={})
    f = r.score_breakdown["parkeerdruk"]
    assert f.missing is True and f.gewicht == 0


def test_redistribution_holds_when_parkeerdruk_absent():
    """No nota → parkeerdruk missing → in-breakdown risico still rescales to target 86."""
    r = compute_score_v3({})  # all data missing, no cascade payloads
    risico = {k: v for k, v in r.score_breakdown.items() if v.categorie == "risico"}
    assert risico["parkeerdruk"].missing is True
    non_missing = sum(f.gewicht for f in risico.values() if not f.missing)
    assert abs(non_missing - _RISICO_REDISTRIBUTION_TARGET) <= 1.0

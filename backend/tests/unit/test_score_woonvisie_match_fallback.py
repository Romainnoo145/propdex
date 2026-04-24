"""M048/Phase 6 — fallback paths for score_woonvisie_match (SCORE-04).

Wave-0 stubs. Red until Plan 06-03 rewrite.
"""
from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload
from app.services.score_v3_factors import score_woonvisie_match


def test_empty_wijk_policies_uses_algemeen_citaat() -> None:
    payload = WoonvisiePayload(
        periode_start=2024,
        periode_einde=2030,
        wijk_policies=[],
        algemeen_citaat="Gemeente X bouwt 1000 woningen tot 2030.",
        confidence=0.8,
    )
    r = score_woonvisie_match(payload, wijk_naam="Zomaar-Wijk", project_type="nieuwbouw_wonen")
    assert r.missing is False
    # neutraal pulled: 5.0 * 0.8 + 5.0 * 0.2 = 5.0 → normalized 0.5
    assert 0.45 <= r.genormaliseerde_score <= 0.55, f"score={r.genormaliseerde_score}"
    assert "Gemeente X bouwt" in r.toelichting_lang
    assert isinstance(r.waarde, dict)
    assert r.waarde["matched_policy"] is None
    assert r.waarde["algemeen_citaat"].startswith("Gemeente X")


def test_no_wijk_naam_falls_back_without_crash() -> None:
    payload = WoonvisiePayload(
        periode_start=2024,
        periode_einde=2030,
        wijk_policies=[],
        algemeen_citaat="",
        confidence=0.5,
    )
    r = score_woonvisie_match(payload, wijk_naam=None, project_type="onbepaald")
    assert r.missing is False
    assert 0.0 <= r.genormaliseerde_score <= 1.0


def test_wijk_not_found_in_policies_falls_back() -> None:
    payload = WoonvisiePayload(
        periode_start=2024,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick",
                prioriteit="groei",
                gewenste_segmenten=["sociaal"],
                citaat="Blerick groeit.",
                pagina=None,
            ),
        ],
        algemeen_citaat="Gemeentebrede tekst.",
        confidence=0.9,
    )
    r = score_woonvisie_match(payload, wijk_naam="Hegelsom", project_type="nieuwbouw_wonen")
    assert r.waarde["matched_policy"] is None
    # Pulled toward 0.5 (no match → neutraal basis 5.0)
    assert 0.45 <= r.genormaliseerde_score <= 0.55


def test_none_payload_returns_missing() -> None:
    """Pre-existing behaviour: payload=None produces missing=True (factor not weighed)."""
    r = score_woonvisie_match(None, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    assert r.missing is True

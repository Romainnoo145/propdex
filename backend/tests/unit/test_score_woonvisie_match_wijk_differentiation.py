"""M048/Phase 6 — per-wijk score differentiation (SCORE-04, TEST-06).

Wave-0 stubs. Will fail on ImportError (WijkPolicy missing) until Plan 06-02;
then fail on AttributeError / wrong-shape until Plan 06-03 rewrites score_woonvisie_match.
"""
from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload
from app.services.score_v3_factors import score_woonvisie_match


def _venlo_payload() -> WoonvisiePayload:
    return WoonvisiePayload(
        periode_start=2024,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick",
                prioriteit="groei",
                gewenste_segmenten=["sociaal", "midden"],
                citaat="Blerick blijft groeigebied. 400 woningen tot 2030, 35% sociaal.",
                pagina=24,
            ),
            WijkPolicy(
                wijk_naam="Venlo-Centrum",
                prioriteit="neutraal",
                gewenste_segmenten=["duur", "gemengd"],
                citaat="Venlo-Centrum wordt niet als groei- of krimpgebied aangemerkt.",
                pagina=18,
            ),
        ],
        algemeen_citaat="Gemeente Venlo streeft naar 2800 nieuwe woningen tot 2030.",
        confidence=0.9,
    )


def test_blerick_scores_higher_than_centrum_for_nieuwbouw_wonen() -> None:
    payload = _venlo_payload()
    blerick = score_woonvisie_match(payload, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    centrum = score_woonvisie_match(payload, wijk_naam="Venlo-Centrum", project_type="nieuwbouw_wonen")
    assert blerick.genormaliseerde_score > 0.7, f"Blerick={blerick.genormaliseerde_score}"
    assert centrum.genormaliseerde_score < 0.5, f"Centrum={centrum.genormaliseerde_score}"
    assert blerick.genormaliseerde_score > centrum.genormaliseerde_score


def test_blerick_citaat_in_toelichting_lang() -> None:
    payload = _venlo_payload()
    r = score_woonvisie_match(payload, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    assert "Blerick" in r.toelichting_lang
    assert "groeigebied" in r.toelichting_lang
    assert "p.24" in r.toelichting_lang


def test_matched_policy_in_waarde_dict() -> None:
    payload = _venlo_payload()
    r = score_woonvisie_match(payload, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    assert isinstance(r.waarde, dict), f"expected dict, got {type(r.waarde).__name__}"
    assert r.waarde["matched_wijk"] == "Blerick"
    assert r.waarde["matched_policy"]["prioriteit"] == "groei"
    assert r.waarde["matched_policy"]["citaat"].startswith("Blerick blijft")


def test_case_and_diacritic_insensitive_match() -> None:
    """PDOK emits 'blerick' (lowercase) — must still match 'Blerick' policy."""
    payload = _venlo_payload()
    r = score_woonvisie_match(payload, wijk_naam="blerick", project_type="nieuwbouw_wonen")
    assert r.waarde["matched_policy"] is not None
    assert r.waarde["matched_policy"]["wijk_naam"] == "Blerick"


def test_longest_match_wins() -> None:
    """When both 'Blerick' and 'Blerick-Noord' policies exist and parcel wijk_naam='Blerick-Noord',
    the longer (more specific) policy must win."""
    payload = WoonvisiePayload(
        periode_start=2024,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick",
                prioriteit="neutraal",
                gewenste_segmenten=[],
                citaat="Blerick algemeen.",
                pagina=None,
            ),
            WijkPolicy(
                wijk_naam="Blerick-Noord",
                prioriteit="groei",
                gewenste_segmenten=["sociaal"],
                citaat="Blerick-Noord specifiek groeigebied.",
                pagina=None,
            ),
        ],
        algemeen_citaat="",
        confidence=0.9,
    )
    r = score_woonvisie_match(payload, wijk_naam="Blerick-Noord", project_type="nieuwbouw_wonen")
    assert r.waarde["matched_policy"]["wijk_naam"] == "Blerick-Noord"


def test_crosswalk_venlo_centrum_to_binnenstad() -> None:
    """Wijk 11 Venlo-Centrum resolves to the 'Binnenstad' woonvisie policy via the
    crosswalk — 'Binnenstad' does not substring-match the CBS wijk name, so without the
    crosswalk it would fall back to the gemeente-brede citaat."""
    payload = WoonvisiePayload(
        periode_start=2024,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Binnenstad",
                prioriteit="groei",
                gewenste_segmenten=["midden"],
                citaat="In de binnenstad zetten we in op wonen boven winkels.",
                pagina=12,
            ),
        ],
        algemeen_citaat="gemeente-breed",
        confidence=0.9,
    )
    r = score_woonvisie_match(
        payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="onbepaald"
    )
    assert "Binnenstad" in r.toelichting_kort

"""M046/S04 iron-rule regression tests.

Must pass before any future M046 slice merges. Guard against re-introducing
BUG-1: _best_bestemming_type optimistically picked "wonen" for any mixed
parcel that contained wonen, regardless of proportion.
"""

from app.services.score_v3_factors import _best_bestemming_type


def test_mixed_verkeer_wonen_prefers_verkeer_when_majority() -> None:
    """RM iron rule: count-voting wins over priority when counts differ.

    2× verkeer (normalized: "verkeer" + "verkeer - verblijfsgebied") + 1× wonen
    → "verkeer". Als deze ooit "wonen" wordt retourneren, is de count-voting
    silently gebroken en leunt 20 scoregewicht weer op optimistische classificatie.
    """
    pd = {
        "bestemmingen": [
            {"type": "verkeer"},
            {"type": "verkeer - verblijfsgebied"},
            {"type": "wonen"},
        ]
    }
    assert _best_bestemming_type(pd) == "verkeer"


def test_transformatie_kans_preserved_on_tied_bedrijf_wonen() -> None:
    """RM iron rule: bij count-tie wint priority (transformatie-favorable).

    1× bedrijf + 1× wonen (count-tie) moet naar "wonen" mappen zodat
    transformatie-signaal (bedrijfsterrein-naar-wonen) niet verloren gaat.
    Als ooit naar "bedrijf" verandert, verliest de scoring-engine een
    developer-kritiek use-case (herbestemmings-potentieel).
    """
    pd = {"bestemmingen": [{"type": "bedrijf"}, {"type": "wonen"}]}
    assert _best_bestemming_type(pd) == "wonen"


def test_single_type_parcels_stable() -> None:
    """RM iron rule: canonical single-type parcels blijven deterministisch.

    Elk bekend type → zichzelf retourneren. Als dit ooit flips (bv. "water"
    → "onbekend"), breken downstream factoren silently.
    """
    assert _best_bestemming_type({"bestemmingen": [{"type": "wonen"}]}) == "wonen"
    assert _best_bestemming_type({"bestemmingen": [{"type": "verkeer"}]}) == "verkeer"
    assert _best_bestemming_type({"bestemmingen": [{"type": "water"}]}) == "water"
    assert _best_bestemming_type({"bestemmingen": [{"type": "agrarisch"}]}) == "agrarisch"

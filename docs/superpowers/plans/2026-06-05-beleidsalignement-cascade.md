# Beleidsalignement Cascade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `beleidsalignement` cascade factor that turns the gebiedsgerichte Omgevingsvisie Venlo 2040 into a per-parcel potentie-signal with a literal citaat + a showcase map-popup.

**Architecture:** Clone the proven `woonvisie_match` pipeline (M047/S06 + M048/Phase 6) for a second policy document. LLM extracts `GebiedPolicy[]` per deelgebied; scoring matches a parcel's `wijk_naam` against each deelgebied's `gebonden_plaatsen`; result flows through `score_breakdown` to a new `OmgevingsvisiePopup`. No new API surface.

**Tech Stack:** FastAPI + SQLAlchemy 2.x (async), Anthropic tool-use extraction, Pydantic v2, React + TanStack + framer-motion, Tailwind v4 (Aura tokens), pytest + vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-beleidsalignement-design.md`

**Commit prefix:** `M053/S01:` (feature commits). Run from `backend/` for python, repo root for frontend.

**Validation gates:** backend `ruff check . && mypy .` + `pytest`; frontend `npm run check`.

---

## File Structure

**Backend create:**
- `backend/app/ai/factors/beleidsalignement.py` — `GebiedPolicy`, `OmgevingsvisiePayload`, `OMGEVINGSVISIE_FACTOR_DEF` (~160 regels)
- `backend/app/tools/seed_omgevingsvisie_venlo.py` — one-off ingest of the Venlo PDF as a `PolicyDocument` (~110 regels)
- `backend/tests/unit/test_beleidsalignement_schema.py`
- `backend/tests/unit/test_score_beleidsalignement.py`
- `backend/tests/unit/test_registry_beleidsalignement_rebalance.py`
- `backend/tests/regression/test_woonvisie_unchanged.py`
- `backend/tests/unit/test_cascade_enrichment_beleidsalignement.py`

**Backend modify:**
- `backend/app/services/score_v3_factors.py` — add `score_beleidsalignement()` (~95 regels) + reuse `_normalize_wijk`
- `backend/app/services/score_v3.py` — registry rebalance (6 weights) + new entry + call-site branch + import
- `backend/app/services/cascade_enrichment_service.py` — `get_omgevingsvisie_document()` + branch in `get_cascade_payloads()`
- `backend/app/tools/backfill_cascade_scores.py` — also load + apply beleidsalignement payload

**Frontend create:**
- `frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx` (~200 regels)
- `frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx`
- `frontend/src/components/map/panels/parcel/__tests__/OmgevingsvisiePopup.test.tsx`

**Frontend modify:**
- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` — POTENTIE_KEYS, FACTOR_LABELS, formatFactorValue case, state, popup wiring
- `frontend/src/lib/factor-groups.ts` — `FACTOR_BRON['beleidsalignement']`

---

## Task 1: Extraction schema + FactorDefinition

**Files:**
- Create: `backend/app/ai/factors/beleidsalignement.py`
- Test: `backend/tests/unit/test_beleidsalignement_schema.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_beleidsalignement_schema.py
import pytest
from pydantic import ValidationError

from app.ai.factors.beleidsalignement import (
    GebiedPolicy,
    OmgevingsvisiePayload,
    OMGEVINGSVISIE_FACTOR_DEF,
)


def test_gebiedpolicy_requires_citaat():
    with pytest.raises(ValidationError):
        GebiedPolicy(
            gebied_naam="Transformatiegebieden",
            karakter="transformatie",
            woningbouwprioriteit="hoog",
            transformatie_kansgebied=True,
            gebonden_plaatsen=["Middengebied"],
            citaat="",  # min_length=1 → fail
        )


def test_payload_minimal_valid():
    p = OmgevingsvisiePayload(tijdshorizon=2040, confidence=0.9)
    assert p.gebied_policies == []
    assert p.algemeen_citaat == ""


def test_payload_full_roundtrip():
    p = OmgevingsvisiePayload(
        tijdshorizon=2040,
        gebied_policies=[
            GebiedPolicy(
                gebied_naam="Dorpen",
                karakter="dorp",
                woningbouwprioriteit="gemiddeld",
                transformatie_kansgebied=False,
                gebonden_plaatsen=["Arcen", "Lomm", "Velden", "Belfeld"],
                citaat="bouwen als sociaal investeren",
                pagina=42,
            )
        ],
        algemeen_citaat="We kiezen voor de compacte stad.",
        confidence=0.95,
    )
    assert OmgevingsvisiePayload.model_validate(p.model_dump()) == p


def test_factor_def_contract():
    assert OMGEVINGSVISIE_FACTOR_DEF.factor_id == "beleidsalignement"
    assert OMGEVINGSVISIE_FACTOR_DEF.tool_name == "extract_beleidsalignement"
    assert OMGEVINGSVISIE_FACTOR_DEF.payload_model is OmgevingsvisiePayload
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_beleidsalignement_schema.py -q`
Expected: FAIL — `ModuleNotFoundError: app.ai.factors.beleidsalignement`

- [ ] **Step 3: Write the schema module**

```python
# backend/app/ai/factors/beleidsalignement.py
"""Beleidsalignement factor — gemeentelijke omgevingsvisie extraction (M053/S01).

Cloned from woonvisie_match (M048/Phase 6). The omgevingsvisie is gebiedsgericht:
deelgebieden (Hart Centraal Stedelijk Gebied, Transformatiegebieden, Dorpen, ...)
each carry an ontwikkelrichting. GebiedPolicy holds that per-gebied direction +
the literal citaat. Matching a parcel to a deelgebied happens at scoring time via
the gebonden_plaatsen name-list (see score_beleidsalignement).
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition

GebiedKarakter = Literal[
    "centraal_stedelijk",
    "transformatie",
    "stedelijk_wonen",
    "werklocatie",
    "dorp",
    "landschap",
]
Woningbouwprioriteit = Literal["hoog", "gemiddeld", "laag", "niet_benoemd"]


class GebiedPolicy(BaseModel):
    """Per-deelgebied ontwikkelrichting uit een gemeentelijke omgevingsvisie."""

    gebied_naam: str = Field(min_length=1, description="Deelgebied-naam zoals in document")
    karakter: GebiedKarakter
    woningbouwprioriteit: Woningbouwprioriteit = "niet_benoemd"
    transformatie_kansgebied: bool = False
    gebonden_plaatsen: list[str] = Field(
        default_factory=list,
        description="Wijk/plaats-namen die onder dit deelgebied vallen; match-sleutel",
    )
    citaat: str = Field(min_length=1, description="Letterlijk citaat dat de richting onderbouwt")
    pagina: int | None = Field(default=None, ge=1)


class OmgevingsvisiePayload(BaseModel):
    """Gestructureerde extractie van een gemeentelijke omgevingsvisie."""

    tijdshorizon: int = Field(description="Jaar van de visie, bv. 2040")
    gebied_policies: list[GebiedPolicy] = Field(default_factory=list)
    algemeen_citaat: str = Field(
        default="",
        description="Gemeente-brede citaat-fallback als geen deelgebied matcht",
    )
    confidence: float = Field(ge=0.0, le=1.0, description="0=onzeker, 1=zeker")


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "tijdshorizon": {"type": "integer", "description": "Jaar van de visie (bv. 2040)"},
        "gebied_policies": {
            "type": "array",
            "description": (
                "Per deelgebied een object met naam, karakter, woningbouwprioriteit, "
                "transformatie_kansgebied, gebonden_plaatsen (wijk/plaats-namen die eronder "
                "vallen), letterlijk citaat en paginanummer. Laat weg zonder letterlijk citaat."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "gebied_naam": {"type": "string", "description": "Deelgebied exact zoals in document"},
                    "karakter": {
                        "type": "string",
                        "enum": [
                            "centraal_stedelijk",
                            "transformatie",
                            "stedelijk_wonen",
                            "werklocatie",
                            "dorp",
                            "landschap",
                        ],
                    },
                    "woningbouwprioriteit": {
                        "type": "string",
                        "enum": ["hoog", "gemiddeld", "laag", "niet_benoemd"],
                    },
                    "transformatie_kansgebied": {"type": "boolean"},
                    "gebonden_plaatsen": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Wijk/plaats/buurt-namen die onder dit deelgebied vallen",
                    },
                    "citaat": {"type": "string", "minLength": 1, "description": "Letterlijk citaat (1-3 zinnen)"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["gebied_naam", "karakter", "citaat"],
                "additionalProperties": False,
            },
        },
        "algemeen_citaat": {"type": "string", "description": "Gemeente-brede fallback-citaat"},
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
    "required": ["tijdshorizon", "confidence"],
}


OMGEVINGSVISIE_FACTOR_DEF = FactorDefinition[OmgevingsvisiePayload](
    factor_id="beleidsalignement",
    tool_name="extract_beleidsalignement",
    description=(
        "Extraheer de ruimtelijke deelgebieden en hun ontwikkelrichting uit deze "
        "gemeentelijke omgevingsvisie. Per deelgebied met expliciete beleidsaandacht: "
        "karakter (centraal_stedelijk/transformatie/stedelijk_wonen/werklocatie/dorp/landschap), "
        "woningbouwprioriteit, of het een transformatie-kansgebied is, welke wijken/plaatsen "
        "eronder vallen, en een letterlijk citaat. Minimale velden: tijdshorizon, confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=OmgevingsvisiePayload,
    prompt_instructions=(
        "Lees de omgevingsvisie volledig door en beantwoord via het tool:\n"
        "1. Welk jaar is de tijdshorizon (tijdshorizon)?\n"
        "2. Welke ruimtelijke deelgebieden onderscheidt de visie? Voor ELK deelgebied:\n"
        "   - gebied_naam: exact zoals in document (niet parafraseren)\n"
        "   - karakter: centraal_stedelijk (binnenstad/verdichten), transformatie "
        "(herontwikkeling/sloop-nieuwbouw), stedelijk_wonen (bestaande woonwijken), "
        "werklocatie (bedrijventerrein/campus), dorp (kernen), landschap (groen/water)\n"
        "   - woningbouwprioriteit: hoog/gemiddeld/laag/niet_benoemd\n"
        "   - transformatie_kansgebied: true als expliciet aangewezen voor transformatie\n"
        "   - gebonden_plaatsen: welke wijken/plaatsen/buurten vallen onder dit gebied "
        "(bv. Blerick, Tegelen, Arcen)? Lege lijst als niet genoemd.\n"
        "   - citaat: letterlijk citaat dat de richting onderbouwt (1-3 zinnen)\n"
        "   - pagina: paginanummer indien zichtbaar, anders null\n"
        "3. Gemeente-brede tekst zonder deelgebied → algemeen_citaat.\n"
        "4. Confidence: 0.9+ bij heldere gebiedsindeling; 0.5-0.7 bij vage tekst; <0.5 bij twijfel.\n\n"
        "HARDE REGELS:\n"
        "- Laat een GebiedPolicy weg als je geen letterlijk citaat kunt vinden. Geen hallucinaties.\n"
        "- Kopieer citaten letterlijk. Geen parafrases.\n"
        "- Gebruik alleen informatie uit het document."
    ),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_beleidsalignement_schema.py -q`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/factors/beleidsalignement.py backend/tests/unit/test_beleidsalignement_schema.py
git commit -m "M053/S01: beleidsalignement extraction schema + FactorDefinition"
```

---

## Task 2: De-risk — confirm the Venlo omgevingsvisie extracts (DATA GATE)

This is the spec's open verification point. If extraction yields no usable `gebied_policies`, STOP and fall back to `welstand_beperking` (raise with the user).

**Files:**
- Modify: `backend/app/tools/probe_woonvisie_extraction.py` is woonvisie-specific; instead add a tiny probe inline. Use the existing `extract_factor_live`.

- [ ] **Step 1: Run an ad-hoc extraction probe against the Venlo omgevingsvisie PDF**

Create a throwaway probe (do NOT commit) `backend/app/tools/_probe_omgevingsvisie.py`:

```python
import asyncio, sys, uuid
from types import SimpleNamespace
import httpx
from app.ai.factor_extractor import extract_factor_live
from app.ai.factors.beleidsalignement import OMGEVINGSVISIE_FACTOR_DEF


async def main(url: str) -> None:
    async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as c:
        r = await c.get(url, headers={"User-Agent": "propdex-probe/1.0"})
    print(f"HTTP {r.status_code} content-type={r.headers.get('content-type')} bytes={len(r.content)}")
    if r.status_code != 200 or not (r.content.startswith(b"%PDF") or "pdf" in r.headers.get("content-type", "")):
        print("NOT A PDF — try another URL"); return
    stub = SimpleNamespace(id=uuid.uuid4(), filename="venlo_omgevingsvisie.pdf", file_data=r.content)
    ext = await extract_factor_live(
        factor_def=OMGEVINGSVISIE_FACTOR_DEF, parcel_id="probe-venlo", policy_document=stub,
    )
    p = ext.payload
    print(f"tijdshorizon={p.tijdshorizon} confidence={p.confidence:.2f} gebied_policies={len(p.gebied_policies)}")
    for g in p.gebied_policies:
        print(f"  {g.gebied_naam} | {g.karakter} | prio={g.woningbouwprioriteit} | "
              f"transformatie={g.transformatie_kansgebied} | plaatsen={g.gebonden_plaatsen}")
        print(f"    citaat: {g.citaat[:90]!r}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
```

Resolve a working PDF URL for the **Omgevingsvisie Venlo 2040** (candidates, try in order):
1. `https://gemeenteraad.venlo.nl/Vergaderingen/Agendacommissie/2025/02-april/17:30/Concept-agenda-s-commissies/381324-Bijl01-Omgevingsvisie-Venlo-2040.pdf`
2. The "download" link on `https://lokaleregelgeving.overheid.nl/CVDR740383/1`
3. A `zoek.officielebekendmakingen.nl` gmb PDF for the vaststelling.

Run: `cd backend && python -m app.tools._probe_omgevingsvisie "<url>"`
Expected: `gebied_policies` ≥ 4 with named `gebonden_plaatsen` (Blerick/Tegelen/Arcen/…) and non-empty citaten.

- [ ] **Step 2: Decision gate**

If ≥4 sensible deelgebieden with citaten → record the working URL in the plan + proceed. Note the URL here: `OMGEVINGSVISIE_VENLO_URL = "<confirmed>"`.
If extraction is empty/garbage → delete the probe, STOP, surface to the user (fallback = welstand).

- [ ] **Step 3: Delete the throwaway probe**

```bash
rm backend/app/tools/_probe_omgevingsvisie.py
```

No commit (probe is throwaway; the confirmed URL feeds Task 7).

---

## Task 3: Scoring function `score_beleidsalignement`

**Files:**
- Modify: `backend/app/services/score_v3_factors.py` (add function near `score_woonvisie_match`, reuse `_normalize_wijk`)
- Test: `backend/tests/unit/test_score_beleidsalignement.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_score_beleidsalignement.py
from app.ai.factors.beleidsalignement import GebiedPolicy, OmgevingsvisiePayload
from app.services.score_v3_factors import score_beleidsalignement


def _payload(policies, algemeen="", conf=1.0):
    return OmgevingsvisiePayload(
        tijdshorizon=2040, gebied_policies=policies, algemeen_citaat=algemeen, confidence=conf
    )


def test_missing_payload_not_weighed():
    r = score_beleidsalignement(None, wijk_naam="Blerick", project_type="onbepaald")
    assert r.missing is True
    assert r.gewicht == 0
    assert r.categorie == "potentie"


def test_transformatie_kansgebied_scores_high():
    pol = GebiedPolicy(
        gebied_naam="Transformatiegebieden", karakter="transformatie",
        woningbouwprioriteit="hoog", transformatie_kansgebied=True,
        gebonden_plaatsen=["Middengebied"], citaat="klimaatadaptieve stadsbuurten", pagina=12,
    )
    r = score_beleidsalignement(_payload([pol]), wijk_naam="Middengebied", project_type="transformatie_wonen")
    assert r.genormaliseerde_score >= 0.85
    assert r.missing is False
    assert r.waarde["matched_policy"]["gebied_naam"] == "Transformatiegebieden"
    assert "klimaatadaptieve" in r.toelichting_lang


def test_landschap_scores_low():
    pol = GebiedPolicy(
        gebied_naam="Maas en beken", karakter="landschap",
        woningbouwprioriteit="laag", transformatie_kansgebied=False,
        gebonden_plaatsen=["Maasoever"], citaat="behoud van het beekdal",
    )
    r = score_beleidsalignement(_payload([pol]), wijk_naam="Maasoever", project_type="nieuwbouw_wonen")
    assert r.genormaliseerde_score <= 0.35


def test_no_match_uses_algemeen_citaat_and_not_weighed():
    pol = GebiedPolicy(
        gebied_naam="Dorpen", karakter="dorp", woningbouwprioriteit="gemiddeld",
        transformatie_kansgebied=False, gebonden_plaatsen=["Arcen"], citaat="vitale dorpskernen",
    )
    r = score_beleidsalignement(_payload([pol], algemeen="compacte stad"), wijk_naam="Onbekend", project_type="onbepaald")
    assert r.waarde["matched_policy"] is None
    assert r.waarde["algemeen_citaat"] == "compacte stad"
    assert r.gewicht == 0  # no-match → not weighed (sparse factor)


def test_hyphen_and_casing_match():
    pol = GebiedPolicy(
        gebied_naam="Stedelijke woongebieden", karakter="stedelijk_wonen",
        woningbouwprioriteit="gemiddeld", transformatie_kansgebied=False,
        gebonden_plaatsen=["Oud-Blerick"], citaat="bestaande woonwijken",
    )
    r = score_beleidsalignement(_payload([pol]), wijk_naam="oud‐blerick", project_type="onbepaald")
    assert r.waarde["matched_policy"]["gebied_naam"] == "Stedelijke woongebieden"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_score_beleidsalignement.py -q`
Expected: FAIL — `ImportError: cannot import name 'score_beleidsalignement'`

- [ ] **Step 3: Implement `score_beleidsalignement`**

Add near the top-of-file import block (the existing `if TYPE_CHECKING` woonvisie import around line 16): extend it with the beleidsalignement types:

```python
    from app.ai.factors.beleidsalignement import GebiedPolicy, OmgevingsvisiePayload
```

Append the function after `score_woonvisie_match` (end of file):

```python
# ── beleidsalignement (M053/S01 cascade — Omgevingsvisie) ──────────────────

_KARAKTER_BASE_SCORE: dict[str, float] = {
    "centraal_stedelijk": 8.5,
    "transformatie": 9.0,
    "stedelijk_wonen": 6.0,
    "werklocatie": 3.0,
    "dorp": 6.5,
    "landschap": 2.5,
}

# project_type → karakters that align especially well (small bonus)
_PROJECTTYPE_KARAKTER_FIT: dict[str, set[str]] = {
    "transformatie_wonen": {"transformatie", "centraal_stedelijk"},
    "nieuwbouw_wonen": {"transformatie", "stedelijk_wonen", "dorp"},
    "commercieel_naar_wonen": {"transformatie", "centraal_stedelijk"},
    "optoppen": {"centraal_stedelijk", "stedelijk_wonen"},
    "splitsen": {"stedelijk_wonen", "centraal_stedelijk"},
    "onbepaald": set(),
}

_KARAKTER_LABEL: dict[str, str] = {
    "centraal_stedelijk": "centraal stedelijk gebied",
    "transformatie": "transformatiegebied",
    "stedelijk_wonen": "stedelijk woongebied",
    "werklocatie": "werklocatie",
    "dorp": "dorpskern",
    "landschap": "landschapszone",
}


def score_beleidsalignement(
    payload: "OmgevingsvisiePayload | None",
    *,
    wijk_naam: str | None,
    project_type: str = "onbepaald",
) -> FactorResult:
    """M053/S01: per-deelgebied alignement-scoring uit de gemeentelijke omgevingsvisie.

    Matcht het perceel-wijk/plaats tegen GebiedPolicy.gebonden_plaatsen. Cloned from
    score_woonvisie_match: weight=0 when missing/no-match (sparse factor P5).
    """
    if payload is None:
        return FactorResult(
            waarde=None,
            genormaliseerde_score=0.0,
            gewicht=0,
            bijdrage=0.0,
            categorie="potentie",
            toelichting_kort="Geen omgevingsvisie beschikbaar voor deze gemeente (factor niet meegewogen).",
            toelichting_lang="Geen gemeentelijke omgevingsvisie beschikbaar. De factor wordt niet meegewogen.",
            data_bronnen=[],
            missing=True,
        )

    document_label = f"Omgevingsvisie {payload.tijdshorizon}"
    algemeen_citaat = payload.algemeen_citaat or ""

    # 1. Match deelgebied — longest-normalised gebonden_plaats wins (deterministic)
    parcel_norm = _normalize_wijk(wijk_naam)
    matched: "GebiedPolicy | None" = None
    if parcel_norm and payload.gebied_policies:
        candidates: list[tuple[int, "GebiedPolicy"]] = []
        for g in payload.gebied_policies:
            for plaats in g.gebonden_plaatsen:
                pn = _normalize_wijk(plaats)
                if pn and (pn in parcel_norm or parcel_norm in pn):
                    candidates.append((len(pn), g))
        if candidates:
            candidates.sort(key=lambda t: -t[0])
            matched = candidates[0][1]

    # 2. No-match fallback: neutraal with algemeen_citaat, not weighed
    if matched is None:
        uitleg_kort = (
            f"Geen deelgebied-match in {document_label}; gemeente-brede context gebruikt"
            if algemeen_citaat
            else f"Geen deelgebied-match in {document_label}"
        )
        uitleg_lang = uitleg_kort + (
            f". Citaat (gemeente-breed): {algemeen_citaat}" if algemeen_citaat else ""
        )
        uitleg_lang += f" (confidence {payload.confidence:.0%})"
        return FactorResult(
            waarde={
                "matched_gebied": None,
                "matched_policy": None,
                "algemeen_citaat": algemeen_citaat,
                "tijdshorizon": payload.tijdshorizon,
            },
            genormaliseerde_score=0.5,
            gewicht=0,
            bijdrage=0.0,
            categorie="potentie",
            toelichting_kort=uitleg_kort,
            toelichting_lang=uitleg_lang,
            data_bronnen=["Gemeentelijke omgevingsvisie (LLM-extracted)"],
            missing=False,
        )

    # 3. Matched: karakter base + transformatie/prioriteit bonus + projecttype-fit
    raw = _KARAKTER_BASE_SCORE.get(matched.karakter, 5.0)
    if matched.transformatie_kansgebied:
        raw += 0.5
    if matched.woningbouwprioriteit == "hoog":
        raw += 0.5
    elif matched.woningbouwprioriteit == "laag":
        raw -= 0.5
    fit_note = ""
    if matched.karakter in _PROJECTTYPE_KARAKTER_FIT.get(project_type, set()):
        raw += 1.0
        fit_note = f"; projecttype past bij {_KARAKTER_LABEL.get(matched.karakter, matched.karakter)}"

    pulled = raw * payload.confidence + 5.0 * (1 - payload.confidence)
    pulled = max(0.0, min(10.0, pulled))

    pag_suffix = f", p.{matched.pagina}" if matched.pagina is not None else ""
    uitleg_kort = (
        f"Gebied '{matched.gebied_naam}' ({_KARAKTER_LABEL.get(matched.karakter, matched.karakter)}) "
        f"in {document_label}{fit_note}"
    )
    uitleg_lang = (
        f"{uitleg_kort}. Citaat ({matched.gebied_naam}{pag_suffix}): {matched.citaat}"
        f" (confidence {payload.confidence:.0%})"
    )

    return FactorResult(
        waarde={
            "matched_gebied": matched.gebied_naam,
            "matched_policy": matched.model_dump(),
            "algemeen_citaat": algemeen_citaat,
            "tijdshorizon": payload.tijdshorizon,
        },
        genormaliseerde_score=round(pulled / 10.0, 4),
        gewicht=0,
        bijdrage=0.0,
        categorie="potentie",
        toelichting_kort=uitleg_kort,
        toelichting_lang=uitleg_lang,
        data_bronnen=["Gemeentelijke omgevingsvisie (LLM-extracted)"],
        missing=False,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_score_beleidsalignement.py -q`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/score_v3_factors.py backend/tests/unit/test_score_beleidsalignement.py
git commit -m "M053/S01: score_beleidsalignement (omgevingsvisie deelgebied-match)"
```

---

## Task 4: Registry rebalance + new entry

The 9 existing potentie factors sum to 100. We free 10 weight-units by rebalancing the **6 override-free** potentie factors (bestemming 13, leegstand 9, funda_frictie 5, perceelgrootte 13, demografie 9, vergunning_succeskans 15 = 64) down to 54 via largest-remainder, then add `beleidsalignement=10`. The 3 override-bearing factors (vrije_grond, optoppotentie, woonvisie_match) are untouched, so per-projecttype sums stay 100 (beleidsalignement has no per-projecttype override → constant 10).

Pre-computed new weights (largest-remainder, 64→54): bestemming 13→11, leegstand 9→7, funda_frictie 5→4, perceelgrootte 13→11, demografie 9→8, vergunning_succeskans 15→13. New potentie sum: 13+11+11+7+4+11+8+13+12+10 = 100.

**Files:**
- Modify: `backend/app/services/score_v3.py` (FACTOR_REGISTRY potentie entries)
- Test: `backend/tests/unit/test_registry_beleidsalignement_rebalance.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_registry_beleidsalignement_rebalance.py
from app.services.score_v3 import FACTOR_REGISTRY, _verify_registry_sum_guard


def test_beleidsalignement_in_registry():
    e = FACTOR_REGISTRY["beleidsalignement"]
    assert e.category == "potentie"
    assert e.default_weight == 10
    assert e.weight_by_projecttype is None  # constant → invariant-safe


def test_potentie_sum_is_100():
    s = sum(e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "potentie")
    assert s == 100


def test_rebalanced_weights_exact():
    assert FACTOR_REGISTRY["bestemming"].default_weight == 11
    assert FACTOR_REGISTRY["leegstand"].default_weight == 7
    assert FACTOR_REGISTRY["funda_frictie"].default_weight == 4
    assert FACTOR_REGISTRY["perceelgrootte"].default_weight == 11
    assert FACTOR_REGISTRY["demografie"].default_weight == 8
    assert FACTOR_REGISTRY["vergunning_succeskans"].default_weight == 13


def test_sum_guard_holds_all_projecttypes():
    _verify_registry_sum_guard()  # raises AssertionError if any projecttype != 100
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_registry_beleidsalignement_rebalance.py -q`
Expected: FAIL — `KeyError: 'beleidsalignement'`

- [ ] **Step 3: Edit FACTOR_REGISTRY**

In `backend/app/services/score_v3.py`, update the 6 override-free potentie entries' `default_weight` (add a `# was N, rebalanced by M053/S01` comment on each):
- `bestemming`: 13 → 11
- `leegstand`: 9 → 7
- `funda_frictie`: 5 → 4
- `perceelgrootte`: 13 → 11
- `demografie`: 9 → 8
- `vergunning_succeskans`: 15 → 13

Then add a new entry directly after `woonvisie_match` (still inside the potentie block, before the `# --- RISICO` comment):

```python
    "beleidsalignement": FactorRegistryEntry(
        id="beleidsalignement",
        category="potentie",
        default_weight=10,
        weight_by_projecttype=None,  # constant — projecttype-fit lives in the score, not the weight
        data_source="Gemeentelijke omgevingsvisie (LLM-extracted)",
        bron="gemeente_beleid",
    ),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_registry_beleidsalignement_rebalance.py -q`
Expected: PASS (4 passed). Module-load asserts (`_REGISTRY_POTENTIE_SUM == 100`) also pass on import.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/score_v3.py backend/tests/unit/test_registry_beleidsalignement_rebalance.py
git commit -m "M053/S01: register beleidsalignement (potentie w=10) + rebalance 6 potentie weights"
```

---

## Task 5: Enrichment branch + call-site in compute_score_v3

**Files:**
- Modify: `backend/app/services/cascade_enrichment_service.py`
- Modify: `backend/app/services/score_v3.py` (import + call-site after the woonvisie block ~line 620)
- Test: `backend/tests/unit/test_cascade_enrichment_beleidsalignement.py`

- [ ] **Step 1: Write the failing test (call-site wiring via compute_score_v3)**

```python
# backend/tests/unit/test_cascade_enrichment_beleidsalignement.py
from app.ai.factors.beleidsalignement import GebiedPolicy, OmgevingsvisiePayload
from app.services.score_v3 import compute_score_v3


def _payload():
    return OmgevingsvisiePayload(
        tijdshorizon=2040,
        gebied_policies=[
            GebiedPolicy(
                gebied_naam="Transformatiegebieden", karakter="transformatie",
                woningbouwprioriteit="hoog", transformatie_kansgebied=True,
                gebonden_plaatsen=["Blerick"], citaat="nieuwe stadsbuurten",
            )
        ],
        confidence=1.0,
    )


def test_beleidsalignement_flows_into_breakdown():
    parcel_data = {"area_m2": 500, "wijk_naam": "Blerick", "has_pand": True}
    res = compute_score_v3(
        parcel_data, None, project_type="transformatie_wonen",
        cascade_payloads={"beleidsalignement": _payload()},
    )
    f = res.score_breakdown["beleidsalignement"]
    assert f.categorie == "potentie"
    assert f.missing is False
    assert f.gewicht == 10  # registry weight applied for matched factor
    assert f.waarde["matched_policy"]["gebied_naam"] == "Transformatiegebieden"


def test_beleidsalignement_absent_is_missing():
    parcel_data = {"area_m2": 500, "wijk_naam": "Blerick", "has_pand": True}
    res = compute_score_v3(parcel_data, None, cascade_payloads={})
    f = res.score_breakdown["beleidsalignement"]
    assert f.missing is True
    assert f.gewicht == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_cascade_enrichment_beleidsalignement.py -q`
Expected: FAIL — `KeyError: 'beleidsalignement'` (call-site not added yet)

- [ ] **Step 3a: Add call-site in `compute_score_v3`**

In `backend/app/services/score_v3.py`, add `score_beleidsalignement` to the `from app.services.score_v3_factors import (...)` block (Step uses alphabetical-ish placement next to `score_bestemming`). Then, directly after the `breakdown["woonvisie_match"] = _wv_result` line (~620), add:

```python
    # Cascade factor: beleidsalignement (Omgevingsvisie — M053/S01). Same sparse
    # treatment as woonvisie_match: appended after redistribution, weight=0 when missing.
    _ba_result = score_beleidsalignement(
        _cascade.get("beleidsalignement"),
        wijk_naam=parcel_data.get("wijk_naam"),
        project_type=project_type,
    )
    if not _ba_result.missing:
        _ba_entry = FACTOR_REGISTRY["beleidsalignement"]
        _ba_weight = float(
            (_ba_entry.weight_by_projecttype or {}).get(project_type, _ba_entry.default_weight)
        )
        _ba_result.gewicht = _ba_weight
        _ba_result.bijdrage = round(_ba_result.genormaliseerde_score * _ba_weight, 4)
        _ba_result.percentage_of_category = round(_ba_weight / 100.0, 4)
    breakdown["beleidsalignement"] = _ba_result
```

- [ ] **Step 3b: Add enrichment branch in `cascade_enrichment_service.py`**

Add import at top: `from app.ai.factors.beleidsalignement import OMGEVINGSVISIE_FACTOR_DEF`.

Add a `get_omgevingsvisie_document()` helper (clone of `get_woonvisie_document` with `source_key == "omgevingsvisie"`):

```python
async def get_omgevingsvisie_document(
    db: AsyncSession,
    *,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> PolicyDocument | None:
    """Zoek de meest recente actieve omgevingsvisie op voor een gemeente (M053/S01)."""
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente_code,
            PolicyDocument.source_key == "omgevingsvisie",
            PolicyDocument.organization_id == organization_id,
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(PolicyDocument.version_number.desc(), PolicyDocument.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
```

In `get_cascade_payloads`, after the woonvisie `try/except`, add:

```python
    # beleidsalignement (omgevingsvisie)
    try:
        ov_doc = await get_omgevingsvisie_document(
            db, gemeente_code=gemeente_code, organization_id=organization_id
        )
        if ov_doc is not None:
            ov_extracted = await extract_factor(
                db,
                factor_def=OMGEVINGSVISIE_FACTOR_DEF,
                parcel_id=DOCUMENT_SENTINEL,
                policy_document=ov_doc,
            )
            payloads["beleidsalignement"] = ov_extracted.payload
    except FactorExtractionError as exc:
        logger.warning(
            "cascade_enrich beleidsalignement failed parcel=%s gemeente=%s: %s",
            parcel_id, gemeente_code, exc,
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_cascade_enrichment_beleidsalignement.py -q`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/score_v3.py backend/app/services/cascade_enrichment_service.py backend/tests/unit/test_cascade_enrichment_beleidsalignement.py
git commit -m "M053/S01: wire beleidsalignement into compute_score_v3 + cascade enrichment"
```

---

## Task 6: Regression — woonvisie_match unchanged

**Files:**
- Test: `backend/tests/regression/test_woonvisie_unchanged.py`

- [ ] **Step 1: Write the regression test**

```python
# backend/tests/regression/test_woonvisie_unchanged.py
"""Iron rule (M053/S01): adding beleidsalignement must NOT change woonvisie_match
behaviour or the registry weights of the override-bearing potentie factors."""
from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload
from app.services.score_v3 import FACTOR_REGISTRY
from app.services.score_v3_factors import score_woonvisie_match


def test_override_bearing_weights_untouched():
    assert FACTOR_REGISTRY["vrije_grond"].default_weight == 13
    assert FACTOR_REGISTRY["optoppotentie"].default_weight == 11
    assert FACTOR_REGISTRY["woonvisie_match"].default_weight == 12
    assert FACTOR_REGISTRY["woonvisie_match"].weight_by_projecttype == {
        "nieuwbouw_wonen": 16, "optoppen": 8,
    }


def test_woonvisie_match_scoring_stable():
    payload = WoonvisiePayload(
        periode_start=2025, periode_einde=2030,
        wijk_policies=[WijkPolicy(
            wijk_naam="Blerick", prioriteit="groei",
            gewenste_segmenten=["sociaal", "midden"], citaat="groeiwijk", pagina=5,
        )],
        confidence=1.0,
    )
    r = score_woonvisie_match(payload, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    assert r.missing is False
    assert r.waarde["matched_policy"]["wijk_naam"] == "Blerick"
    # groei base 5+3 +2 segment-fit = 10 → normalised 1.0
    assert r.genormaliseerde_score == 1.0
```

- [ ] **Step 2: Run test to verify it passes (no impl needed — pure guard)**

Run: `cd backend && python -m pytest tests/regression/test_woonvisie_unchanged.py -q`
Expected: PASS (2 passed). If FAIL → a Task 4 weight was changed incorrectly; fix the registry.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/regression/test_woonvisie_unchanged.py
git commit -m "M053/S01: regression guard — woonvisie_match + override weights unchanged"
```

---

## Task 7: Venlo omgevingsvisie ingestion (one-off seed)

**Files:**
- Create: `backend/app/tools/seed_omgevingsvisie_venlo.py`

- [ ] **Step 1: Write the seed tool**

Uses the confirmed URL from Task 2. Resolves the Hauzer demo org (the demo lives on `info@hauzer.nl` — find org via that user) + an uploader user id. Creates the `PolicyDocument` (idempotent: skip if one already exists for GM0983/omgevingsvisie/org).

```python
# backend/app/tools/seed_omgevingsvisie_venlo.py
"""One-off: ingest the Omgevingsvisie Venlo 2040 PDF as a PolicyDocument (M053/S01).

Stores it on the Hauzer demo org (info@hauzer.nl) so the cascade enrichment can
extract beleidsalignement for Venlo parcels.

Usage:
    cd backend
    python -m app.tools.seed_omgevingsvisie_venlo --url "<confirmed-pdf-url>"
"""
from __future__ import annotations

import argparse
import asyncio
import logging

import httpx
from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.models.user import User

logger = logging.getLogger(__name__)

VENLO_GM = "GM0983"
HAUZER_EMAIL = "info@hauzer.nl"


async def _run(url: str) -> int:
    async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as c:
        resp = await c.get(url, headers={"User-Agent": "propdex-seed/1.0"})
    if resp.status_code != 200 or not (
        resp.content.startswith(b"%PDF") or "pdf" in resp.headers.get("content-type", "").lower()
    ):
        logger.error("URL did not return a PDF (status=%s)", resp.status_code)
        return 1
    pdf = resp.content
    logger.info("Fetched %.1f KB", len(pdf) / 1024)

    async with async_session_factory() as session:
        user = (await session.execute(
            select(User).where(User.email == HAUZER_EMAIL)
        )).scalar_one_or_none()
        if user is None:
            logger.error("Hauzer user %s not found — run seed_hauzer_demo first", HAUZER_EMAIL)
            return 1
        org_id = user.organization_id

        existing = (await session.execute(
            select(PolicyDocument).where(
                PolicyDocument.entity_type == "gemeente",
                PolicyDocument.entity_code == VENLO_GM,
                PolicyDocument.source_key == "omgevingsvisie",
                PolicyDocument.organization_id == org_id,
            )
        )).scalar_one_or_none()
        if existing is not None:
            logger.info("Omgevingsvisie already seeded (id=%s) — skipping", existing.id)
            return 0

        doc = PolicyDocument(
            entity_type="gemeente",
            entity_code=VENLO_GM,
            source_key="omgevingsvisie",
            filename="omgevingsvisie_venlo_2040.pdf",
            content_type="application/pdf",
            file_data=pdf,
            file_size=len(pdf),
            uploaded_by_user_id=user.id,
            organization_id=org_id,
            is_global=False,
            status="uploaded",
        )
        session.add(doc)
        await session.commit()
        logger.info("Seeded omgevingsvisie PolicyDocument id=%s org=%s", doc.id, org_id)
    return 0


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Seed the Omgevingsvisie Venlo 2040 PolicyDocument.")
    parser.add_argument("--url", required=True, help="Confirmed PDF URL (from Task 2 de-risk)")
    raise SystemExit(asyncio.run(_run(parser.parse_args().url)))


if __name__ == "__main__":
    main()
```

> NOTE: confirm `PolicyDocument` has a `version_number` column with a server default; the enrichment query orders by it. If it is non-nullable without default, add `version_number=1` to the constructor. Check `backend/app/models/policy_document.py` before running.

- [ ] **Step 2: Run the seed locally**

Run: `cd backend && python -m app.tools.seed_omgevingsvisie_venlo --url "<confirmed-url>"`
Expected: `Seeded omgevingsvisie PolicyDocument id=… org=…`

- [ ] **Step 3: Warm the extraction cache + smoke-test enrichment**

Run a one-liner to confirm `get_cascade_payloads` returns a beleidsalignement payload for a Venlo parcel:

```bash
cd backend && python -c "
import asyncio, uuid
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.user import User
from app.services.cascade_enrichment_service import get_cascade_payloads
async def m():
    async with async_session_factory() as s:
        u=(await s.execute(select(User).where(User.email=='info@hauzer.nl'))).scalar_one()
        p=await get_cascade_payloads(s, parcel_id='probe', gemeente_code='GM0983', organization_id=u.organization_id)
        print('keys:', list(p))
        ba=p.get('beleidsalignement')
        print('gebied_policies:', len(ba.gebied_policies) if ba else None)
asyncio.run(m())
"
```
Expected: `keys: ['woonvisie_match', 'beleidsalignement']` and `gebied_policies: ≥4`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/tools/seed_omgevingsvisie_venlo.py
git commit -m "M053/S01: one-off seed tool for Omgevingsvisie Venlo 2040 PolicyDocument"
```

---

## Task 8: Frontend — OmgevingsvisiePopup component

**Files:**
- Create: `frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx`
- Create: `frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx`
- Test: `frontend/src/components/map/panels/parcel/__tests__/OmgevingsvisiePopup.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/map/panels/parcel/__tests__/OmgevingsvisiePopup.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OmgevingsvisiePopup, type GebiedPolicy } from '../OmgevingsvisiePopup'

const gebied: GebiedPolicy = {
  gebied_naam: 'Transformatiegebieden',
  karakter: 'transformatie',
  woningbouwprioriteit: 'hoog',
  transformatie_kansgebied: true,
  gebonden_plaatsen: ['Middengebied'],
  citaat: 'klimaatadaptieve stadsbuurten',
  pagina: 12,
}

describe('OmgevingsvisiePopup', () => {
  it('renders the matched gebied + citaat', () => {
    render(
      <OmgevingsvisiePopup isOpen onClose={vi.fn()} gemeente="Venlo"
        tijdshorizon={2040} matched_policy={gebied} algemeen_citaat="" project_type="transformatie_wonen" />,
    )
    expect(screen.getByText('Transformatiegebieden')).toBeInTheDocument()
    expect(screen.getByText(/klimaatadaptieve stadsbuurten/)).toBeInTheDocument()
  })

  it('falls back to algemeen_citaat when no match', () => {
    render(
      <OmgevingsvisiePopup isOpen onClose={vi.fn()} gemeente="Venlo"
        tijdshorizon={2040} matched_policy={null} algemeen_citaat="compacte stad" project_type="onbepaald" />,
    )
    expect(screen.getByText(/compacte stad/)).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <OmgevingsvisiePopup isOpen={false} onClose={vi.fn()} gemeente="Venlo"
        tijdshorizon={2040} matched_policy={gebied} algemeen_citaat="" project_type="onbepaald" />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/__tests__/OmgevingsvisiePopup.test.tsx`
Expected: FAIL — cannot resolve `../OmgevingsvisiePopup`

- [ ] **Step 3: Implement the component (clone of WoonvisiePopup, Aura tokens)**

```tsx
// frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx
/**
 * OmgevingsvisiePopup — M053/S01 cascade showcase.
 * Minimal Calm Intelligence: one focal point = the beleidstekst (citaat).
 * Cloned from WoonvisiePopup; deelgebied-karakter replaces wijk-prioriteit.
 */
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export type GebiedKarakter =
  | 'centraal_stedelijk' | 'transformatie' | 'stedelijk_wonen'
  | 'werklocatie' | 'dorp' | 'landschap'
export type Woningbouwprioriteit = 'hoog' | 'gemiddeld' | 'laag' | 'niet_benoemd'

export interface GebiedPolicy {
  gebied_naam: string
  karakter: GebiedKarakter
  woningbouwprioriteit: Woningbouwprioriteit
  transformatie_kansgebied: boolean
  gebonden_plaatsen: string[]
  citaat: string
  pagina: number | null
}

export interface OmgevingsvisiePopupProps {
  isOpen: boolean
  onClose: () => void
  gemeente: string
  tijdshorizon: number
  matched_policy: GebiedPolicy | null
  algemeen_citaat: string
  project_type: string
}

const KARAKTER_LABEL: Record<GebiedKarakter, string> = {
  centraal_stedelijk: 'Centraal stedelijk gebied',
  transformatie: 'Transformatiegebied',
  stedelijk_wonen: 'Stedelijk woongebied',
  werklocatie: 'Werklocatie',
  dorp: 'Dorpskern',
  landschap: 'Landschapszone',
}

const KARAKTER_DOT: Record<GebiedKarakter, string> = {
  centraal_stedelijk: 'bg-[#22C55E]',
  transformatie: 'bg-[#22C55E]',
  stedelijk_wonen: 'bg-[#F9A826]',
  dorp: 'bg-[#F9A826]',
  werklocatie: 'bg-[#9CA3AF]',
  landschap: 'bg-[#EF4444]',
}

const PROJECTTYPE_FIT: Record<string, GebiedKarakter[]> = {
  transformatie_wonen: ['transformatie', 'centraal_stedelijk'],
  nieuwbouw_wonen: ['transformatie', 'stedelijk_wonen', 'dorp'],
  commercieel_naar_wonen: ['transformatie', 'centraal_stedelijk'],
  optoppen: ['centraal_stedelijk', 'stedelijk_wonen'],
  splitsen: ['stedelijk_wonen', 'centraal_stedelijk'],
  onbepaald: [],
}

function alignmentSentence(projectType: string, k: GebiedKarakter): string | null {
  const fit = PROJECTTYPE_FIT[projectType] ?? []
  if (fit.length === 0) return null
  return fit.includes(k)
    ? `Jouw projecttype sluit aan bij de gemeentelijke richting voor dit gebied`
    : `Jouw projecttype wijkt af van de gemeentelijke richting voor dit gebied`
}

export function OmgevingsvisiePopup({
  isOpen, onClose, gemeente, tijdshorizon, matched_policy, algemeen_citaat, project_type,
}: OmgevingsvisiePopupProps) {
  if (!isOpen) return null

  const hasMatch = matched_policy != null && typeof matched_policy === 'object'
  const karakter = hasMatch ? matched_policy!.karakter : null
  const citaat = hasMatch ? (matched_policy!.citaat ?? algemeen_citaat) : algemeen_citaat
  const titel = hasMatch ? matched_policy!.gebied_naam : 'Gemeente-breed'
  const pagina = hasMatch ? (matched_policy!.pagina ?? null) : null
  const align = hasMatch && karakter ? alignmentSentence(project_type, karakter) : null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="omgevingsvisie-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-xl mx-4 max-h-[calc(100vh-80px)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={onClose}
            className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#F2F6F3] hover:text-[#0E1111]"
            aria-label="Sluiten">
            <X size={14} strokeWidth={2} />
          </button>

          <div className="flex-1 min-h-0 overflow-y-auto px-12 py-12">
            <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
              <span>Omgevingsvisie {gemeente} {tijdshorizon}</span>
              {pagina != null && (<><span>·</span><span>p. {pagina}</span></>)}
            </div>

            <h2 className="mt-3 text-[36px] font-black tracking-[-0.03em] text-[#0E1111] leading-[1.05]">
              {titel}
            </h2>

            {karakter && (
              <div className="mt-3 flex items-center gap-2 text-[13px] text-[#6B7280]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${KARAKTER_DOT[karakter]}`} />
                <span>{KARAKTER_LABEL[karakter]}</span>
                {hasMatch && matched_policy!.transformatie_kansgebied && (
                  <><span>·</span><span>transformatie-kansgebied</span></>
                )}
              </div>
            )}
            {!hasMatch && (
              <div className="mt-3 text-[13px] text-[#6B7280] italic">geen gebied-specifieke tekst</div>
            )}

            <p className="mt-10 text-[15px] leading-[1.75] text-[#1A1C1E] whitespace-pre-line">
              {citaat || 'Geen beleidstekst beschikbaar voor deze gemeente.'}
            </p>

            {align && (
              <div className="mt-10 pt-8 border-t border-[#F2F6F3]">
                <p className="text-[13px] leading-[1.6] text-[#6B7280]">{align}.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
```

- [ ] **Step 4: Write a Storybook story (mirror WoonvisiePopup.stories.tsx structure)**

```tsx
// frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { OmgevingsvisiePopup } from '@/components/map/panels/parcel/OmgevingsvisiePopup'

const meta: Meta<typeof OmgevingsvisiePopup> = {
  title: 'Parcel/OmgevingsvisiePopup',
  component: OmgevingsvisiePopup,
}
export default meta
type Story = StoryObj<typeof OmgevingsvisiePopup>

export const Transformatiegebied: Story = {
  args: {
    isOpen: true, onClose: () => {}, gemeente: 'Venlo', tijdshorizon: 2040,
    project_type: 'transformatie_wonen', algemeen_citaat: '',
    matched_policy: {
      gebied_naam: 'Transformatiegebieden', karakter: 'transformatie',
      woningbouwprioriteit: 'hoog', transformatie_kansgebied: true,
      gebonden_plaatsen: ['Middengebied', 'Veilingterrein'],
      citaat: 'We maken hier nieuwe, klimaatadaptieve en goed functionerende stadsbuurten.',
      pagina: 24,
    },
  },
}

export const GeenMatch: Story = {
  args: {
    isOpen: true, onClose: () => {}, gemeente: 'Venlo', tijdshorizon: 2040,
    project_type: 'onbepaald', matched_policy: null,
    algemeen_citaat: 'We kiezen voor de compacte stad: verdichten binnen 15 minuten fietsafstand van de stations.',
  },
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/__tests__/OmgevingsvisiePopup.test.tsx`
Expected: PASS (3 passed)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx frontend/src/components/map/panels/parcel/__tests__/OmgevingsvisiePopup.test.tsx
git commit -m "M053/S01: OmgevingsvisiePopup component + story + tests"
```

---

## Task 9: Frontend — wire beleidsalignement into PotentieLayer

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`
- Modify: `frontend/src/lib/factor-groups.ts` (FACTOR_BRON entry)

- [ ] **Step 1: Add the bron mapping**

In `frontend/src/lib/factor-groups.ts`, add to the `FACTOR_BRON` map:
```ts
  beleidsalignement: 'gemeente_beleid',
```
(Use the exact bron-key the file uses for `woonvisie_match`; match its casing.)

- [ ] **Step 2: Edit PotentieLayer — imports, labels, key, formatter, state, popup**

a) Import the new popup (next to the WoonvisiePopup import, line 7):
```tsx
import { OmgevingsvisiePopup, type GebiedPolicy } from '../OmgevingsvisiePopup'
```

b) Add label (in `FACTOR_LABELS`, after `woonvisie_match`):
```tsx
  beleidsalignement: 'OMGEVINGSVISIE',
```

c) Add key to `POTENTIE_KEYS` (after `'woonvisie_match'`):
```tsx
  'capaciteit', 'woonvisie_match', 'beleidsalignement',
```

d) Add a `formatFactorValue` case (after the `woonvisie_match` case, before `default`):
```tsx
    case 'beleidsalignement': {
      if (factor.missing) return { value: '—', sub: 'Geen omgevingsvisie beschikbaar' }
      const w = factor.waarde as { matched_policy?: { karakter?: string; gebied_naam?: string } | null; matched_gebied?: string | null } | null
      const matched = w && typeof w === 'object' ? w.matched_policy : null
      const KARAKTER_VALUE: Record<string, string> = {
        centraal_stedelijk: 'CENTRAAL STEDELIJK',
        transformatie: 'TRANSFORMATIE',
        stedelijk_wonen: 'STEDELIJK WONEN',
        werklocatie: 'WERKLOCATIE',
        dorp: 'DORPSKERN',
        landschap: 'LANDSCHAP',
      }
      const karakter = matched && typeof matched === 'object' ? matched.karakter : null
      const value = karakter && KARAKTER_VALUE[karakter] ? KARAKTER_VALUE[karakter] : 'GEMEENTE-BREED'
      const gebied = matched?.gebied_naam ?? w?.matched_gebied ?? null
      const sub = gebied ? `Gebied: ${gebied}` : 'Geen gebied-specifiek beleid'
      return { value, sub }
    }
```

e) Add popup state (next to `woonvisieOpen`, ~line 267):
```tsx
  const [omgevingsvisieOpen, setOmgevingsvisieOpen] = useState(false)
```

f) Extract the factor data (after the `woonvisieWaarde` block, ~line 281):
```tsx
  const omgevingsvisieFactor = (parcel.score_breakdown as ScoreBreakdownV3 | null)?.['beleidsalignement']
  const omgevingsvisieWaarde = omgevingsvisieFactor?.waarde as {
    matched_gebied: string | null
    matched_policy: GebiedPolicy | null
    algemeen_citaat: string
    tijdshorizon: number
  } | null
  const hasOmgevingsvisieData = omgevingsvisieWaarde !== null && omgevingsvisieWaarde !== undefined
```

g) Extend the card click handler (the `onCardClick` ternary, ~line 398):
```tsx
                  onCardClick={
                    card.factor_key === 'woonvisie_match' && hasWoonvisieData
                      ? () => setWoonvisieOpen(true)
                      : card.factor_key === 'beleidsalignement' && hasOmgevingsvisieData
                        ? () => setOmgevingsvisieOpen(true)
                        : undefined
                  }
```

h) Render the popup (after the `WoonvisiePopup` block, ~line 422):
```tsx
      {hasOmgevingsvisieData && (
        <OmgevingsvisiePopup
          isOpen={omgevingsvisieOpen}
          onClose={() => setOmgevingsvisieOpen(false)}
          gemeente={gemeenteNaam}
          tijdshorizon={omgevingsvisieWaarde!.tijdshorizon ?? 0}
          matched_policy={omgevingsvisieWaarde!.matched_policy}
          algemeen_citaat={omgevingsvisieWaarde!.algemeen_citaat ?? ''}
          project_type={projectType}
        />
      )}
```

- [ ] **Step 3: Check the potentie page-count / coverage test**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/layers`
Expected: PASS. If a coverage test asserts the exact POTENTIE_KEYS count or a paging snapshot, update it to include `beleidsalignement` (the grid pages at 4/2x2; 11 keys → 3 pages, ghost-filled — buildPages already handles padding).

- [ ] **Step 4: Full frontend check**

Run: `cd frontend && npm run check`
Expected: type-check + lint + format clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx frontend/src/lib/factor-groups.ts
git commit -m "M053/S01: wire beleidsalignement card + OmgevingsvisiePopup into PotentieLayer"
```

---

## Task 10: Backfill generalization + full verification

**Files:**
- Modify: `backend/app/tools/backfill_cascade_scores.py`

- [ ] **Step 1: Add beleidsalignement payload loading to the backfill**

In `backfill_cascade_scores.py`:

a) Imports:
```python
from app.ai.factors.beleidsalignement import OmgevingsvisiePayload
```

b) Add a loader mirroring `_load_woonvisie_payload` (same structure, `source_key="omgevingsvisie"`, `factor_id="beleidsalignement"`, validate to `OmgevingsvisiePayload`), returning `OmgevingsvisiePayload | None`. Name it `_load_omgevingsvisie_payload`.

c) In `_backfill_gemeente`, accept an optional `omgevingsvisie_payload` param and build:
```python
    cascade_payloads = {"woonvisie_match": woonvisie_payload}
    if omgevingsvisie_payload is not None:
        cascade_payloads["beleidsalignement"] = omgevingsvisie_payload
```

d) In `_run`, after loading the woonvisie payload, load the omgevingsvisie payload (non-fatal if None — log a warning and continue woonvisie-only) and pass it through.

- [ ] **Step 2: Run the backfill on Venlo (Hauzer org)**

Resolve the Hauzer org id (the seed printed it) and run:
Run: `cd backend && python -m app.tools.backfill_cascade_scores --gemeente GM0983 --organization-id <hauzer-org-uuid>`
Expected: `Cascade backfill complete: processed=N updated=N` with no errors. (Use `--dry-run` first to sanity-check counts.)

- [ ] **Step 3: Spot-check a backfilled parcel**

```bash
cd backend && python -c "
import asyncio
from sqlalchemy import select, text
from app.core.database import async_session_factory
from app.models.user import User
from app.models.scan_result import ScanResult
from app.models.parcel_cache import ParcelCache
async def m():
    async with async_session_factory() as s:
        u=(await s.execute(select(User).where(User.email=='info@hauzer.nl'))).scalar_one()
        await s.execute(text(f\"SET app.current_tenant_id = '{u.organization_id}'\"))
        row=(await s.execute(
            select(ScanResult).join(ParcelCache, ParcelCache.id==ScanResult.parcel_id)
            .where(ParcelCache.gemeente_code=='GM0983').limit(1))).scalar_one()
        ba=row.flags['score_breakdown'].get('beleidsalignement')
        print('beleidsalignement:', {k: ba.get(k) for k in ('genormaliseerde_score','gewicht','missing','toelichting_kort')})
asyncio.run(m())
"
```
Expected: a non-null `beleidsalignement` entry; matched Venlo parcels show `gewicht=10` + a citaat-bearing `toelichting_kort`.

- [ ] **Step 4: Full backend validation**

Run: `cd backend && ruff check . && mypy . && python -m pytest tests/unit tests/regression -q`
Expected: all clean / all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/tools/backfill_cascade_scores.py
git commit -m "M053/S01: backfill_cascade_scores also applies beleidsalignement payload"
```

---

## Self-Review notes (completed by plan author)

- **Spec coverage:** schema (T1), data-gate (T2), scoring (T3), registry+rebalance (T4), enrichment+call-site (T5), regression (T6), ingestion (T7), popup (T8), PotentieLayer wiring (T9), backfill+verify (T10). All spec sections mapped.
- **Invariant safety:** beleidsalignement weight is constant (no per-projecttype override) → per-projecttype sum-guard holds with zero changes to override-bearing factors (T6 guards this).
- **Type consistency:** backend `waarde` keys (`matched_gebied`, `matched_policy`, `algemeen_citaat`, `tijdshorizon`) match the frontend `omgevingsvisieWaarde` cast (T5/T9) and `GebiedPolicy` shape matches between popup (T8) and PotentieLayer (T9).

## Post-plan: deploy + live verify (not a code task)

Per memory: Railway does NOT auto-deploy from push. After merge:
1. `railway up backend --path-as-root --service api` (+ worker if cache extraction runs there)
2. Deploy frontend.
3. On prod: run `seed_omgevingsvisie_venlo` + `backfill_cascade_scores --gemeente GM0983 --organization-id <hauzer>` against prod DB.
4. Live-verify: open a Venlo/Hauzer parcel on propdex.nl → OMGEVINGSVISIE card present → click → popup shows deelgebied + citaat.

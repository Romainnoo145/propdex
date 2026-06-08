# Beleidsalignement Actionable + Directional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Omgevingsvisie (`beleidsalignement`) factor land on the high-value gebieden, stop handing out a free `+0.5` to non-matching parcels, expose a hard "strijdig met gemeentevisie" flag, and turn the popup into a verdict-first decision aid.

**Architecture:** The directional per-karakter scoring already exists (`_KARAKTER_BASE_SCORE` etc.). The gaps are: (1) a deterministic Venlo `wijk → gebied` crosswalk so `Venlo-Centrum`/`Blerick-Midden` reach *Hart van het Centraal stedelijk gebied* and `Trade-Port` reaches *Werklocaties* (today they match nothing); (2) no-match returns `missing=True` instead of the weighted `+0.5` floor; (3) a `strijdig_met_visie` bool + `verdict` enum on the factor `waarde`, consumed by the popup (Variant B, minimal inline) and the PotentieLayer card.

**Tech Stack:** Python 3.14 / SQLAlchemy / pytest (backend); React 19 / TS / Vitest + Storybook (frontend). Design spec: `docs/superpowers/specs/2026-06-08-beleidsalignement-actionable-directional-design.md`.

---

## Decisions (from design)

- **Hybride stuurkracht:** soft score (boost-or-neutral, never negative) + separate hard `strijdig_met_visie` flag.
- **Matching:** Venlo crosswalk now (deterministic), substring fallback kept for other gemeenten; geocode-generic later.
- **Popup:** Variant B — verdict sentence is the focal point, `woningbouwprioriteit` shown, citaat demoted, strijdig = red line.

## Ground truth (verified in DB this session)

19 Venlo CBS wijken → gebied mapping (gebied_naam strings are exact from the extraction):

| CBS wijk | gebied_naam | karakter | parcels |
|---|---|---|---|
| Wijk 11 Venlo-Centrum | Hart van het Centraal stedelijk gebied | centraal_stedelijk | 2336 |
| Wijk 21 Blerick-Midden | Hart van het Centraal stedelijk gebied | centraal_stedelijk | 2866 |
| Wijk 28 Trade-Port | Werklocaties | werklocatie | 8709 |
| Wijk 12 Venlo-Zuid | Stedelijke woongebieden | stedelijk_wonen | 2688 |
| Wijk 13 Venlo-Oost-Noord | Stedelijke woongebieden | stedelijk_wonen | 1277 |
| Wijk 14 Venlo-Noord | Stedelijke woongebieden | stedelijk_wonen | 1390 |
| Wijk 15 Venlo-Oost-Zuid | Stedelijke woongebieden | stedelijk_wonen | 4039 |
| Wijk 16 Het Ven | Stedelijke woongebieden | stedelijk_wonen | 5203 |
| Wijk 23 Blerick-Zuid | Stedelijke woongebieden | stedelijk_wonen | 377 |
| Wijk 24 Vossener | Stedelijke woongebieden | stedelijk_wonen | 1073 |
| Wijk 26 Hout-Blerick | Stedelijke woongebieden | stedelijk_wonen | 3858 |
| Wijk 27 Boekend | Stedelijke woongebieden | stedelijk_wonen | 235 |
| Wijk 31 Tegelen-Centrum | Stedelijke woongebieden | stedelijk_wonen | 1453 |
| Wijk 32 Op de Hei | Stedelijke woongebieden | stedelijk_wonen | 5518 |
| Wijk 35 Steyl | Stedelijke woongebieden | stedelijk_wonen | 2593 |
| Wijk 41 Velden | Velden | dorp | 4517 |
| Wijk 43 Lomm | Lomm | dorp | 2990 |
| Wijk 44 Arcen | Arcen | dorp | 4169 |
| Wijk 51 Belfeld | Belfeld | dorp | 8526 |

(Blerick-Midden→centraal and Tegelen-Centrum→woongebied are the two judgement calls; verify against the map in Task 3 but ship as above.)

## File structure

- **Modify** `backend/app/services/score_v3_factors.py` — add `VENLO_WIJK_TO_GEBIED` crosswalk + crosswalk-first matching; no-match → `missing=True`; add `strijdig_met_visie` + `verdict` to `waarde` (matched + no-match); remove dead `no_match_pulled`.
- **Modify** `backend/tests/unit/test_score_beleidsalignement.py` — update no-match expectations; add crosswalk + flag + verdict tests.
- **Modify** `frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx` — Variant B: verdict sentence focal, render prioriteit, demote citaat, red strijdig line; consume `verdict`/`strijdig_met_visie`.
- **Modify** `frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx` — add kansrijk/strijdig/geen-beleid stories.
- **Modify** `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` — surface verdict in the beleidsalignement card sub-text.

---

### Task 1: Backend — Venlo crosswalk + crosswalk-first matching

**Files:**
- Modify: `backend/app/services/score_v3_factors.py` (constants near `_KARAKTER_BASE_SCORE` ~1585; matching block in `score_beleidsalignement` ~1641-1654)
- Test: `backend/tests/unit/test_score_beleidsalignement.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/unit/test_score_beleidsalignement.py` (reuse the file's existing payload-builder helper if present; otherwise construct an `OmgevingsvisiePayload` with two gebieden — one `centraal_stedelijk` named "Hart van het Centraal stedelijk gebied" with `gebonden_plaatsen=["Binnenstad Venlo"]`, one `stedelijk_wonen`):

```python
def test_crosswalk_maps_venlo_centrum_to_centraal_gebied(make_omgevingsvisie_payload):
    """Wijk 11 Venlo-Centrum must resolve to the centraal-stedelijk gebied via the
    crosswalk, even though 'Binnenstad Venlo' does not substring-match 'Wijk 11 Venlo-Centrum'."""
    payload = make_omgevingsvisie_payload()  # must include the centraal_stedelijk gebied
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="nieuwbouw_wonen"
    )
    assert result.missing is False
    assert result.waarde["matched_gebied"] == "Hart van het Centraal stedelijk gebied"
```

If the file has no payload builder, inline the payload construction in the test using
`OmgevingsvisiePayload` + `GebiedPolicy` from `app.ai.factors.beleidsalignement`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_score_beleidsalignement.py::test_crosswalk_maps_venlo_centrum_to_centraal_gebied -v`
Expected: FAIL — matched_gebied is None (substring match misses; no crosswalk yet).

- [ ] **Step 3: Add the crosswalk constant**

Insert near the other module constants in `score_v3_factors.py` (after `_KARAKTER_LABEL`):

```python
# M053/S03: deterministic CBS-wijk → omgevingsvisie-gebied crosswalk for Venlo (GM0983).
# The omgevingsvisie gebonden_plaatsen ("Binnenstad Venlo", "Tradeport Venlo") don't
# substring-match the CBS wijk names ("Wijk 11 Venlo-Centrum"), so the high-value
# gebieden never matched. Keyed by _normalize_wijk(cbs_wijk_naam). Geocode-generic = todo.
_VENLO_WIJK_TO_GEBIED: dict[str, str] = {
    _normalize_wijk("Wijk 11 Venlo-Centrum"): "Hart van het Centraal stedelijk gebied",
    _normalize_wijk("Wijk 21 Blerick-Midden"): "Hart van het Centraal stedelijk gebied",
    _normalize_wijk("Wijk 28 Trade-Port"): "Werklocaties",
    _normalize_wijk("Wijk 12 Venlo-Zuid"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 13 Venlo-Oost-Noord"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 14 Venlo-Noord"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 15 Venlo-Oost-Zuid"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 16 Het Ven"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 23 Blerick-Zuid"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 24 Vossener"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 26 Hout-Blerick"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 27 Boekend"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 31 Tegelen-Centrum"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 32 Op de Hei"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 35 Steyl"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 41 Velden"): "Velden",
    _normalize_wijk("Wijk 43 Lomm"): "Lomm",
    _normalize_wijk("Wijk 44 Arcen"): "Arcen",
    _normalize_wijk("Wijk 51 Belfeld"): "Belfeld",
}
```

- [ ] **Step 4: Add crosswalk-first matching**

In `score_beleidsalignement`, replace the matching block (currently the `parcel_norm = _normalize_wijk(wijk_naam)` ... longest-plaats loop that sets `matched`) with crosswalk-first, substring-fallback:

```python
    # 1. Match deelgebied — crosswalk first (deterministic), substring fallback.
    parcel_norm = _normalize_wijk(wijk_naam)
    matched: GebiedPolicy | None = None
    crosswalk_gebied = _VENLO_WIJK_TO_GEBIED.get(parcel_norm)
    if crosswalk_gebied:
        matched = next(
            (g for g in payload.gebied_policies if g.gebied_naam == crosswalk_gebied),
            None,
        )
    if matched is None and parcel_norm and payload.gebied_policies:
        candidates: list[tuple[int, GebiedPolicy]] = []
        for g in payload.gebied_policies:
            for plaats in g.gebonden_plaatsen:
                pn = _normalize_wijk(plaats)
                if pn and (pn in parcel_norm or parcel_norm in pn):
                    candidates.append((len(pn), g))
                    break
        if candidates:
            candidates.sort(key=lambda t: -t[0])
            matched = candidates[0][1]
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_score_beleidsalignement.py::test_crosswalk_maps_venlo_centrum_to_centraal_gebied -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/score_v3_factors.py backend/tests/unit/test_score_beleidsalignement.py
git commit -m "M053/S03: Venlo wijk→gebied crosswalk (centrum + trade-port now land)"
```

---

### Task 2: Backend — no-match `missing=True` + `strijdig_met_visie` + `verdict`

**Files:**
- Modify: `backend/app/services/score_v3_factors.py` (`score_beleidsalignement` no-match branch ~1656-1683 and matched return ~1711-1726)
- Test: `backend/tests/unit/test_score_beleidsalignement.py`

- [ ] **Step 1: Write the failing tests**

Add:

```python
def test_no_match_is_missing_not_plus_floor(make_omgevingsvisie_payload):
    """A parcel that matches no gebied must NOT receive the +0.5 floor — it is missing."""
    payload = make_omgevingsvisie_payload()
    result = score_beleidsalignement(
        payload, wijk_naam="Onbekende Wijk Buitengebied", project_type="onbepaald"
    )
    assert result.missing is True
    assert result.bijdrage == 0.0
    assert result.waarde["verdict"] == "geen_beleid"
    assert result.waarde["strijdig_met_visie"] is False


def test_werklocatie_is_strijdig(make_omgevingsvisie_payload):
    """A parcel in a werklocatie gebied is strijdig met de gemeentevisie voor wonen."""
    payload = make_omgevingsvisie_payload()  # must include the Werklocaties gebied
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 28 Trade-Port", project_type="nieuwbouw_wonen"
    )
    assert result.waarde["matched_gebied"] == "Werklocaties"
    assert result.waarde["strijdig_met_visie"] is True
    assert result.waarde["verdict"] == "strijdig"


def test_centraal_hoog_fit_is_kansrijk(make_omgevingsvisie_payload):
    payload = make_omgevingsvisie_payload()
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="nieuwbouw_wonen"
    )
    assert result.waarde["verdict"] == "kansrijk"
    assert result.waarde["strijdig_met_visie"] is False
```

(`make_omgevingsvisie_payload` must include at least the `centraal_stedelijk` "Hart…" gebied
with `woningbouwprioriteit="hoog"` and the `werklocatie` "Werklocaties" gebied. Extend the
helper / inline construction accordingly.)

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_score_beleidsalignement.py -k "no_match_is_missing or strijdig or kansrijk" -v`
Expected: FAIL — `waarde` has no `verdict`/`strijdig_met_visie` keys; no-match returns `missing=False`.

- [ ] **Step 3: Add a verdict/flag helper + rewrite the two returns**

Add a helper above `score_beleidsalignement`:

```python
_RESTRICTIVE_KARAKTERS: frozenset[str] = frozenset({"landschap", "werklocatie"})


def _beleids_verdict(
    matched: "GebiedPolicy | None", project_type: str
) -> tuple[str, bool]:
    """Return (verdict, strijdig_met_visie) for popup + card.

    verdict ∈ {kansrijk, neutraal, strijdig, geen_beleid}. Soft score is unchanged;
    this is the qualitative read a developer acts on (gemeente-medewerkingskans).
    """
    if matched is None:
        return "geen_beleid", False
    strijdig = matched.karakter in _RESTRICTIVE_KARAKTERS
    if strijdig:
        return "strijdig", True
    fits = matched.karakter in _PROJECTTYPE_KARAKTER_FIT.get(project_type, set())
    if fits and matched.woningbouwprioriteit in ("hoog", "gemiddeld"):
        return "kansrijk", False
    return "neutraal", False
```

Rewrite the **no-match** return (drop the dead `no_match_pulled`, set `missing=True`):

```python
    # 2. No-match: factor not weighed (was a +0.5 floor — that inflated every parcel).
    if matched is None:
        verdict, strijdig = _beleids_verdict(None, project_type)
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
                "verdict": verdict,
                "strijdig_met_visie": strijdig,
            },
            genormaliseerde_score=0.0,
            gewicht=0,
            bijdrage=0.0,
            categorie="potentie",
            toelichting_kort=uitleg_kort,
            toelichting_lang=uitleg_lang,
            data_bronnen=["Gemeentelijke omgevingsvisie (LLM-extracted)"],
            missing=True,
        )
```

In the **matched** return, add the two keys to `waarde` (compute verdict just before the return):

```python
    verdict, strijdig = _beleids_verdict(matched, project_type)
    return FactorResult(
        waarde={
            "matched_gebied": matched.gebied_naam,
            "matched_policy": matched.model_dump(),
            "algemeen_citaat": algemeen_citaat,
            "tijdshorizon": payload.tijdshorizon,
            "verdict": verdict,
            "strijdig_met_visie": strijdig,
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

- [ ] **Step 4: Update any existing no-match assertions**

Run the whole file: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_score_beleidsalignement.py -v`
If a pre-existing test asserted the old no-match behavior (`missing is False`, `genormaliseerde_score == 0.5`), update it to the new contract (`missing is True`, `bijdrage == 0.0`). Note each change in the commit body.

- [ ] **Step 5: Run to verify all pass**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_score_beleidsalignement.py -v`
Expected: PASS (all, including the three new tests).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/score_v3_factors.py backend/tests/unit/test_score_beleidsalignement.py
git commit -m "M053/S03: no-match=missing (kill +0.5 floor) + strijdig flag + verdict on waarde"
```

---

### Task 3: Re-run backfill + verify the distribution shifted

**Files:** none (data + verification)

- [ ] **Step 1: Re-run the cascade backfill under the Hauzer demo org**

Run:
```bash
cd backend && source .venv/bin/activate && python -m app.tools.backfill_cascade_scores \
  --gemeente GM0983 --organization-id ec424ee5-c670-4066-9183-b600aec41377
```
Expected: `Cascade backfill complete: processed=63817 updated=63817`.

- [ ] **Step 2: Verify the high-value gebieden now land + strijdig appears**

Run:
```bash
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d propdex -tA -F'|' -c "
SELECT flags->'score_breakdown'->'beleidsalignement'->'waarde'->>'matched_gebied' AS gebied,
       flags->'score_breakdown'->'beleidsalignement'->'waarde'->>'verdict' AS verdict,
       count(*)
FROM scan_results GROUP BY 1,2 ORDER BY 3 DESC;"
```
Expected: `Hart van het Centraal stedelijk gebied` now > 0 (~5.2k = Venlo-Centrum + Blerick-Midden), `Werklocaties` ~8.7k with `verdict=strijdig`, and the no-match bucket has `verdict=geen_beleid`.

- [ ] **Step 3: Verify the +0.5 floor is gone**

Run:
```bash
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d propdex -tA -c "
SELECT count(*) FILTER (WHERE flags->'score_breakdown'->'beleidsalignement'->>'missing'='true') AS missing_now
FROM scan_results;"
```
Expected: roughly the no-match count (~the parcels with no gebied) is now `missing=true` (was previously contributing +0.5).

- [ ] **Step 4: Spot-check the two judgement-call wijken on the map** (manual)

Open localhost:9300, click a parcel in Blerick-Midden and one in Tegelen-Centrum, confirm the gebied assignment reads sensibly. If Blerick-Midden should be `Stedelijke woongebieden` instead of centraal, change its crosswalk value in Task 1's constant and re-run Steps 1-2. Note the decision.

---

### Task 4: Frontend — OmgevingsvisiePopup Variant B (verdict-first)

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx`
- Modify: `frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx`

- [ ] **Step 1: Extend types + props**

In `OmgevingsvisiePopup.tsx`, add to `GebiedPolicy` consumers a verdict type and two new props. Add near the top:

```tsx
export type BeleidsVerdict = 'kansrijk' | 'neutraal' | 'strijdig' | 'geen_beleid'

const VERDICT_COPY: Record<BeleidsVerdict, { mark: string; color: string; line: string }> = {
  kansrijk: { mark: '✓', color: 'text-[#15803d]', line: 'Kansrijk — gemeente stuurt hier op wonen; jouw plan past bij de visie.' },
  neutraal: { mark: '•', color: 'text-[#6B7280]', line: 'Past binnen de gemeentelijke richting voor dit gebied.' },
  strijdig: { mark: '⚠', color: 'text-[#DC2626]', line: 'Strijdig met de gemeentevisie — reken op verzet.' },
  geen_beleid: { mark: '•', color: 'text-[#9CA3AF]', line: 'Geen gebied-specifiek beleid voor dit perceel.' },
}
```

Add `verdict?: BeleidsVerdict` and `woningbouwprioriteit?: Woningbouwprioriteit` to
`OmgevingsvisiePopupProps` (prioriteit is already on `GebiedPolicy.matched_policy`, so it can
be read from there — prefer reading `matched_policy.woningbouwprioriteit`).

- [ ] **Step 2: Render verdict-first (Variant B)**

Replace the body block (the karakter line + citaat focal block, lines ~149-176) so the
**verdict sentence** is the focal point, prioriteit is shown, and the citaat is demoted:

```tsx
            {/* Karakter + prioriteit — meta */}
            {karakter && (
              <div className="mt-3 flex items-center gap-2 text-[13px] text-[#6B7280]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${KARAKTER_DOT[karakter]}`} />
                <span>{KARAKTER_LABEL[karakter]}</span>
                {hasMatch && matched_policy!.woningbouwprioriteit !== 'niet_benoemd' && (
                  <>
                    <span>·</span>
                    <span>woningbouwprioriteit {matched_policy!.woningbouwprioriteit}</span>
                  </>
                )}
              </div>
            )}

            {/* Verdict — the new focal point */}
            {verdict && (
              <p className={`mt-8 text-[18px] font-semibold leading-snug ${VERDICT_COPY[verdict].color}`}>
                {VERDICT_COPY[verdict].mark} {VERDICT_COPY[verdict].line}
              </p>
            )}

            {/* Citaat — demoted to supporting evidence */}
            {citaat && (
              <p className="mt-6 text-[13px] leading-[1.7] text-[#6B7280] whitespace-pre-line">
                {citaat}
              </p>
            )}
```

Keep the meta line (gemeente/tijdshorizon/page) and the `{titel}` heading above this block as-is.

- [ ] **Step 3: Thread the prop from PotentieLayer**

In `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`, where
`<OmgevingsvisiePopup ... />` is rendered (~line 457), pass the verdict from waarde:

```tsx
          verdict={(omgevingsvisieWaarde as { verdict?: BeleidsVerdict } | null)?.verdict}
```

Extend the `omgevingsvisieWaarde` cast (~line 305) to include `verdict?: string` and
`strijdig_met_visie?: boolean`. Import `BeleidsVerdict` from the popup module.

- [ ] **Step 4: Add stories for the three states**

In `OmgevingsvisiePopup.stories.tsx`, add `Kansrijk`, `Strijdig`, and `GeenBeleid` stories
passing the matching `verdict` + a `matched_policy` (or null for GeenBeleid).

- [ ] **Step 5: Type-check + render the stories**

Run: `cd frontend && pnpm typecheck && pnpm vitest run --project storybook 2>/dev/null || pnpm vitest run`
Expected: typecheck clean; story tests pass (or render without error).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx
git commit -m "M053/S03: OmgevingsvisiePopup verdict-first (Variant B) + prioriteit + stories"
```

---

### Task 5: Frontend — PotentieLayer card verdict sub-text

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` (the `beleidsalignement` branch of `formatFactorValue` ~line 174)

- [ ] **Step 1: Surface verdict in the card sub-text**

In the `case 'beleidsalignement':` branch of `formatFactorValue`, derive the verdict from
`factor.waarde` and return it as the `sub`:

```tsx
    case 'beleidsalignement': {
      const w = factor.waarde as { matched_gebied?: string | null; verdict?: string } | null
      if (factor.missing || !w?.matched_gebied) return { value: 'OMGEVINGSVISIE', sub: 'Geen gebied-specifiek beleid' }
      const verdictLabel: Record<string, string> = {
        kansrijk: 'Kansrijk', neutraal: 'Past bij visie', strijdig: '⚠ Strijdig met visie', geen_beleid: 'Geen beleid',
      }
      return { value: w.matched_gebied, sub: verdictLabel[w.verdict ?? ''] ?? 'Past bij visie' }
    }
```

(Match the exact shape `formatFactorValue` returns elsewhere in the file — `{ value, sub }`.)

- [ ] **Step 2: Type-check**

Run: `cd frontend && pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx
git commit -m "M053/S03: beleidsalignement card shows verdict (kansrijk/strijdig)"
```

---

### Task 6: Validation sweep

**Files:** none (validation)

- [ ] **Step 1: Backend tests + lint**

Run:
```bash
cd backend && source .venv/bin/activate && python -m pytest \
  tests/unit/test_score_beleidsalignement.py \
  tests/unit/test_cascade_enrichment_beleidsalignement.py \
  tests/unit/test_registry_beleidsalignement_rebalance.py \
  tests/integration/test_cascade_enrichment_service.py \
  tests/regression/test_woonvisie_unchanged.py -v && ruff check app/services/score_v3_factors.py
```
Expected: all PASS, ruff clean. (`test_woonvisie_unchanged` must stay green — we did not touch woonvisie.)

- [ ] **Step 2: Frontend check**

Run: `cd frontend && pnpm typecheck && pnpm lint`
Expected: typecheck clean; lint 0 errors (arbitrary-value warnings are pre-existing).

- [ ] **Step 3: Factor-count guard intact**

Confirm the regression guard still asserts 26 factors (we added no new factor):
Run: `cd backend && source .venv/bin/activate && python -m pytest -k "factor_count or registry" -v`
Expected: PASS.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A && git commit -m "M053/S03: validation — beleidsalignement directional tests + lint green"
```

---

## Out of scope (todos)

- Woonvisie parity (same crosswalk + verdict approach, different doc/factor).
- Generic geocode→spatial-join matching for all gemeenten.
- Strijdig flag on the map tiles / opgeslagen-list (this slice: popup + card only).
- S01 `no_match_pulled` was removed here; no other dead code chased.

## Prod deploy note

After merge + deploy: re-run `backfill_cascade_scores --gemeente GM0983 --organization-id <prod demo org>` so the new matching/verdict lands on existing prod parcels. Railway does not auto-deploy from push.

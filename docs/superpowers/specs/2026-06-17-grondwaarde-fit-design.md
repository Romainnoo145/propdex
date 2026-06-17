# grondwaarde_fit — gemeentelijke grondprijzenbrief cascade-factor (M054/S01)

**Status:** design approved 2026-06-17
**Slice:** M054/S01 — alle commits `M054/S01: <wat>`

## Goal

Add a `grondwaarde_fit` **potentie** cascade-factor fed by the gemeentelijke
**grondprijzenbrief** (Grondprijzen Venlo 2026). The factor extracts the price
bands (€/m² per bestemming/functiecategorie), the price methodiek (residueel /
comparatief / vaste prijs), the grondbeleidstype (actief / faciliterend /
passief) and the developer-facing randvoorwaarden, then scores **how well a
parcel's bestemming + perceelgrootte fit a residually-attractive land value**.

For a developer this answers: *does the gemeente price land for this functie in
a way that leaves room for a viable residual grondwaarde, and is my parcel's
bestemming + schaal a fit for that band?* Residual pricing tracks the
development programme (developer captures upside) → positive signal; vaste/
comparatieve prijzen are context only. This is the editorial intent from
`.planning/cascade/M051-docs.md` (GEM-11, old-M051 = new-M054 Financieel per
[FORWARD-ROADMAP-RECONCILIATION.md §3](../../../.planning/FORWARD-ROADMAP-RECONCILIATION.md))
and `.planning/CASCADE-BUILD-INVENTARISATIE.md` (GEM-11 Grondprijsbeleid).

This is a **pure S07 cascade slice** (Wave 1 of the cascade-build campaign),
cloned 1:1 from the LOCKED M053/S12 splitsingsrisico pattern — but on the
**potentie** side, so it mirrors the `beleidsalignement` verdict-gated potentie
path (NOT the splitsingsrisico risico path).

## Scope

**In scope:**
- `GrondprijzenPayload` Pydantic model + `_INPUT_SCHEMA` + `GRONDPRIJS_FACTOR_DEF`
  (`factor_id="grondwaarde_fit"`), cloning `splitsingsrisico.py`. Reuses
  `Randvoorwaarde` from `beleidsalignement.py` so the cache-shape and the
  display-layer rendering stay identical.
- `score_grondwaarde_fit(payload, *, bestemmingen, area_m2)` → `FactorResult`
  (potentie), verdict-gated.
- `FACTOR_REGISTRY["grondwaarde_fit"]` (category potentie, bron `gemeente_beleid`),
  a clean potentie rebalance keeping every projecttype sum == 100, membership in
  `CASCADE_GATED_FACTORS`, and the verdict-gated wiring in `compute_score_v3`
  (mirror the beleidsalignement potentie path).
- `get_grondprijs_document` + `grondwaarde_fit` block in `get_cascade_payloads`
  (cascade_enrichment_service), and the `_CASCADE_SOURCES` row in
  `cascade_scoring.py` so scan/rescore/backfill never drift.
- `seed_grondprijzen_venlo.py` (source_key=`grondprijsbeleid`, entity_code
  `GM0983`, Hauzer org, vendor-global), cloned from
  `seed_huisvestingsverordening_venlo.py`.
- Frontend: `GrondprijsPopup.tsx` (+ test + stories) cloned from
  `HuisvestingsverordeningPopup.tsx`; `grondwaarde_fit` card + popup wiring in
  `PotentieLayer.tsx`; `factor-groups.ts` registration; factor-coverage tests.

**Out of scope:**
- Real residual-grondwaarde berekening from a developer's businesscase (no
  programma-input UI yet). The factor scores *fit of the gemeentelijke
  prijsband*, not an absolute residue. The brief is **context** where the
  gemeente is not the grondeigenaar (GEM-11 edge case).
- Buurt-level granularity (independent of M053/S13 buurt-crosswalk — this factor
  matches on **bestemming**, not buurt).
- Production deploy (branch is prepared for a human `Merge M054/S01:` landing).

## No SCHEMA_VERSION bump

A new `factor_id` has **no prior cache**: extraction-cache rows are keyed on
`(parcel_id, policy_document_id, factor_id, SCHEMA_VERSION)`, so `grondwaarde_fit`
gets fresh rows with zero collision against the three live cascades
(woonvisie_match / beleidsalignement / splitsingsrisico). `SCHEMA_VERSION` stays
at **6** — bumping it would needlessly invalidate every existing factor cache
(identical reasoning to M053/S12 and S13). No Alembic migration is required.

## Architecture

### 1. Factor — `app/ai/factors/grondwaarde_fit.py`

`GrondprijzenPayload`:
- `peiljaar: int | None` — prijsjaar (jaarlijks geïndexeerd; always displayed).
- `grondbeleidstype: Literal["actief","faciliterend","passief"] | None` —
  whether the gemeente is an active grondeigenaar (band is normstellend) or
  faciliterend/passief (band is context).
- `prijsbanden: list[PrijsBand]`:
  - `grondproduct: str` (e.g. "bouwkavel wonen vrije sector")
  - `functiecategorie: Literal["sociaal","midden","vrij","commercieel",
    "maatschappelijk","bedrijventerrein","overig"]`
  - `bestemming_trefwoorden: list[str]` — zoning keywords this band applies to
    (the **match key**, mirrors beleidsalignement `gebonden_plaatsen`).
  - `prijs_per_m2_min: float | None`, `prijs_per_m2_max: float | None`
  - `prijsgrondslag: Literal["residueel","comparatief","vaste_prijs"]`
  - `erfpacht_mogelijk: bool`
  - `sociale_huur_afwijking: str | None`
  - `citaat: str | None`, `pagina: int | None`
- `algemeen_citaat: str` — gemeente-brede fallback.
- `randvoorwaarden: list[Randvoorwaarde]` (reused from beleidsalignement).
- `confidence: float`

`_INPUT_SCHEMA` is the hand-written Anthropic tool schema mirroring the model;
`GRONDPRIJS_FACTOR_DEF = FactorDefinition[GrondprijzenPayload](factor_id=
"grondwaarde_fit", tool_name="extract_grondwaarde_fit", …)`.

### 2. Scorer — `score_grondwaarde_fit` in `score_v3_factors.py`

Signature `(payload, *, bestemmingen, area_m2) -> FactorResult` (categorie
potentie). Mirrors `score_beleidsalignement`: weight 0 in the result; the real
weight is applied later in `compute_score_v3` behind the verdict gate.

Matching: derive the parcel's primary bestemming via `_best_bestemming_type`
(reused) and match it against each band's `bestemming_trefwoorden` (normalized
substring, like beleidsalignement's plaats-match).

Verdicts (`waarde["verdict"]`):
- `geen_grondbeleid` / payload None → `missing=True`, weight 0.
- `geen_match` — no band matches the parcel bestemming → context, weight 0.
- `context` — band matched but the gemeente is faciliterend/passief OR the band
  is vaste/comparatieve prijs (not residual) → shown, weight 0.
- `passend` — matched band, gemeente actief **and** residual pricing with a
  price → the only weight-bearing verdict (gemeente prices land residually for
  this functie; developer can capture upside). 

`genormaliseerde_score` (0-1) blends prijsgrondslag (residueel > comparatief >
vaste), a perceelgrootte-fit nudge (a buildable scale for the product), and is
confidence-pulled toward the neutral 0.5 (same pull idiom as beleidsalignement).

### 3. Registry + potentie rebalance

Add `grondwaarde_fit` (potentie, default_weight **8**, `weight_by_projecttype=
None`, bron `gemeente_beleid`). Add it to `CASCADE_GATED_FACTORS`. Wire it in
`compute_score_v3` AFTER redistribution, weight applied only when verdict ==
`passend` (mirror the beleidsalignement `kansrijk` gate; never overridden by
custom weights / rescore).

**Rebalance (frees 8 units, every projecttype stays == 100):** the potentie
projecttype-overrides live only on `vrije_grond` / `optoppotentie` /
`woonvisie_match`. By shaving the 8 units exclusively from **no-override**
factors and giving `grondwaarde_fit` no override, the delta is uniform across
every projecttype, so the sum-guard holds for all of them (same technique
M053/S01 used for beleidsalignement). Exact changes:

| factor | was | now | Δ |
|---|---|---|---|
| bestemming | 11 | 9 | −2 |
| perceelgrootte | 11 | 9 | −2 |
| vergunning_succeskans | 13 | 11 | −2 |
| demografie | 8 | 7 | −1 |
| leegstand | 7 | 6 | −1 |
| **grondwaarde_fit** | — | **8** | +8 |

Untouched: vrije_grond 13, optoppotentie 11, funda_frictie 4, woonvisie_match 12,
beleidsalignement 10. New potentie default sum = 100; `_verify_registry_sum_guard`
passes for all projecttypes. The 8 in-breakdown core potentie factors now sum to
70 (was 78); the three potentie cascade factors (woonvisie 12 + beleidsalignement
10 + grondwaarde_fit 8 = 30) are reserved from the 100-pool and appended
verdict-gated — so a parcel with no grondprijzenbrief keeps grondwaarde_fit at
weight 0 (sparse-neutral), exactly like the other two potentie cascades. No
potentie redistribution-target constant exists (the risico-only
`_RISICO_REDISTRIBUTION_TARGET` is untouched).

### 4. Cascade wiring

`get_grondprijs_document` (clone of `get_huisvestingsverordening_document`,
`source_key="grondprijsbeleid"`); a `grondwaarde_fit` try-block in
`get_cascade_payloads`; and a `("grondwaarde_fit", get_grondprijs_document,
GrondprijzenPayload)` row in `cascade_scoring._CASCADE_SOURCES`. Data-source
plumbing already exists on main: `data_source_keys.py` declares
`grondprijsbeleid → voedt_factor=("grondwaarde_fit",)`, `source_keys.py` has the
key.

### 5. Frontend

`GrondprijsPopup.tsx` (+ `.test.tsx` source-assertion test + `.stories.tsx`)
cloned from `HuisvestingsverordeningPopup.tsx`, reusing `RandvoorwaardenSection`.
`PotentieLayer.tsx`: add `grondwaarde_fit` to `POTENTIE_KEYS` + `FACTOR_LABELS`
("GRONDWAARDE") + `formatFactorValue` + the card-click → popup handler; export
`FACTOR_LABELS`/`formatFactorValue` so the new
`PotentieLayer.factor-coverage.test.tsx` can pin them. `factor-groups.ts`:
`grondwaarde_fit: 'gemeente_beleid'`.

## Rebalance summary (one line)

`grondwaarde_fit=8`, funded by bestemming −2, perceelgrootte −2,
vergunning_succeskans −2, demografie −1, leegstand −1 (all no-override potentie
factors). Every projecttype potentie sum stays 100.

## Testing (mirror S12)

- `test_grondwaarde_fit_schema.py` — payload validates the Venlo shape; rejects a
  bad enum; FACTOR_DEF wiring.
- `test_score_grondwaarde_fit.py` — passend / context / geen_match / no-payload-
  missing; bestemming + perceelgrootte fit.
- `test_compute_score_v3_grondwaarde_fit.py` — verdict-gating + sparse weight-0 +
  redistribution holds when absent.
- `test_registry_grondwaarde_fit_rebalance.py` — registry entry + potentie sum
  100 + sum-guard all projecttypes.
- Update `test_registry_beleidsalignement_rebalance.py::test_rebalanced_weights_exact`
  to the new pinned values, with justification.
- Rename + update `tests/regression/test_score_v3_registry_27_factors.py` →
  `..._28_factors.py` (repo rename convention) and the redistribution
  breakdown-size test (27 → 28).
- `test_cascade_enrichment_service.py` — `grondwaarde_fit` extraction case
  (mirror `test_splitsingsrisico_extracted_when_doc_exists`).
- Frontend: `PotentieLayer.factor-coverage.test.tsx` + `GrondprijsPopup.test.tsx`;
  update `RisicoLayer.factor-coverage.test.tsx` 27 → 28 (potentie slice 10 → 11).

`test_woonvisie_unchanged.py` keeps passing untouched — the rebalance does not
change vrije_grond / optoppotentie / woonvisie_match.

## Self-review checklist
- No SCHEMA_VERSION bump, no migration (new factor_id → fresh cache). Rationale stated.
- Verdict-gated potentie cascade (mirrors beleidsalignement, NOT splitsingsrisico risico path).
- Every projecttype potentie sum == 100; sparse-neutral when the brief is absent.
- Single slice; no placeholders; production deploy explicitly out of scope.

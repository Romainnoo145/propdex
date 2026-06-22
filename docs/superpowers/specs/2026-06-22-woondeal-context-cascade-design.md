# Woondeal context cascade — design

**Date:** 2026-06-22
**Milestone/slice:** M054/S0x (cascade-build campaign)
**Status:** approved direction (Path 1), pending spec review

---

## 1. Summary & decision

Build `woondeal` as a **gemeente-level context cascade** sourced from the Woondeal Limburg
2022–2030: typed extraction → structured display in the gemeente panel + a calm context
block on the parcel panel + a one-line rapport summary. It carries **no scoring weight**,
does **not** enter `FACTOR_REGISTRY`/`compute_score_v3`, and does **not** colour the map.

This reverses the original handoff framing (`woondeal_boost` as a scored Potentie factor).
Three independent brainstorm reviews (product, scoring-integrity, information-architecture)
converged unanimously: the document supports no honest, parcel-differentiating score signal,
so a weight would be uniform baseline inflation that violates the locked M053 "coarse
gemeente signals must not colour the whole map" principle for zero analytic gain. The value
is the **information** the deal carries, surfaced as gemeente context — not a score.

The genuine gemeente-vs-gemeente score signal (opgave-vs-plancapaciteit gap, segment fit)
is **explicitly deferred** to a future slice; it only differentiates once the map covers
more than one gemeente, and it needs cross-gemeente normalization the per-parcel scorer
does not have today.

## 2. The data reality (verified against the real PDF)

Source: `https://www.limburg.nl/publish/pages/9413/woondeal_limburg.pdf` (156 pp, read 2026-06-22).

Real Venlo figures (Tabel A1, periode 2022–2030):

- Venlo: **1.745 toevoegingen**, **1.594 in plancapaciteit** → ~**150 woningen gat** (opgave boven harde plannen).
- Woondealregio **Noord-Limburg** (regio-totaal 5.239 toevoegingen / 4.990 plancapaciteit).
- Segment target is **regional: "2/3 betaalbaar"** = sociale huur + huur tot €1.000/mnd + koop < €355.000. **Not** split per gemeente.
- Venlo **sleutelprojecten: 2 projecten / 706 woningen** — a per-gemeente *count* only. Individual Venlo project locations are NOT named at parcel/street/wijk granularity (spatial detail lives only in a map image, Kaart 2, which a text extraction cannot geo-parse).
- Regelingen / financiële rugwind named: **KLC, BIRK, Woningbouwimpuls**.

Corrections to prior planning notes:

- **Drop "2.718"** — that figure is NOT in the document (bad web-research in the June inventory). The real headline is 1.745.
- **Do not fabricate parcel-level project locations.** Only the per-gemeente count exists.

## 3. Why context-only, not scored (the constraint)

1. **Universality:** every NL gemeente is in a woondeal (342 gemeenten in 35 woondealregio's). "Has a deal" carries zero differentiation.
2. **No per-parcel granularity:** the document is gemeente/regio-level. Within a gemeente every parcel is identical.
3. **Single-gemeente demo:** any gemeente-vs-gemeente signal (opgave magnitude, plancapaciteit gap, segment fit) is flat on a Venlo-only map.
4. **M053 principle:** a uniform ~+2-point nudge across all Venlo parcels reorders nothing and breaks the "don't colour the whole map" rule.

## 4. Architecture

Two existing delivery channels already carry gemeente context, both independent of the
per-parcel scoring breakdown. Woondeal reuses them; it needs **no** scoring wiring.

### 4.1 Backend — extraction

- **`backend/app/ai/factors/woondeal.py`** (new) — clone of the locked S07 factor-def shape
  (`grondwaarde_fit.py` / `splitsingsrisico.py`): Pydantic payload + `_INPUT_SCHEMA` dict +
  `FactorDefinition`. Reuse the shared `Randvoorwaarde` model from `beleidsalignement`.

  `WoondealPayload`:
  | field | type | note |
  |---|---|---|
  | `regio_naam` | `str` | e.g. "Noord-Limburg" |
  | `provincie` | `str \| None` | "Limburg" |
  | `periode` | `str \| None` | "2022-2030" |
  | `gemeenten` | `list[GemeenteOpgave]` | per-gemeente rows |
  | `aandeel_betaalbaar` | `float \| None` | regional, 2/3 ≈ 0.667 |
  | `betaalbaar_definitie` | `str \| None` | "sociale huur + huur tot €1.000 + koop < €355.000" |
  | `regelingen` | `list[str]` | KLC, BIRK, Woningbouwimpuls |
  | `doelgroepen` | `list[str]` | aandachtsgroepen |
  | `randvoorwaarden` | `list[Randvoorwaarde]` | shared model |
  | `algemeen_citaat` | `str` | regio-brede fallback |
  | `confidence` | `float` | 0–1 |

  `GemeenteOpgave`: `gemeente_naam: str`, `toevoegingen: int | None`,
  `plancapaciteit: int | None`, `sleutelprojecten_aantal: int | None`,
  `sleutelprojecten_woningen: int | None`. The gat is **derived** in display
  (`toevoegingen - plancapaciteit`), not extracted, to avoid LLM arithmetic.

- **`get_woondeal_document()`** in `cascade_enrichment_service.py` (new resolver) —
  **provincie-level**: resolve the parcel's `gemeente_code` → `provincie_code` via
  `GemeenteProvincieMap` (GM0983 → PV31), then load the most recent active PolicyDocument
  with `entity_type="provincie"`, `entity_code=<PV..>`, `source_key="woondeals"`
  (multi-tenant `is_global OR organization_id`, newest version). Mirror the existing
  resolvers' query shape.

- Extraction is **document-level** via `extract_factor(..., parcel_id=DOCUMENT_SENTINEL)`
  → cached in `FactorExtractionCache` (one extraction per regio document, shared across all
  gemeenten/parcels in the provincie). Same cache mechanism as the five live cascades.

- **`data_source_keys.py`** — fix the existing `woondeals` entry: set `level="provincie"`
  and set `voedt_factor=()` (empty). `voedt_factor` lists *scoring* factors a source feeds;
  woondeal is context-only and feeds none. The current stale `("woonvisie_match",)` value is
  wrong and must be cleared, not repointed.

### 4.2 Backend — delivery (NO scoring breakdown)

- **`useWoondeal` endpoint** — a gemeente-context route returning the **structured**
  `WoondealPayload` for a gemeente (resolve provincie doc → read cache → return the matching
  `GemeenteOpgave` row + regional context). Mirror `useHuisvestingsverordening`'s
  backend handler shape. This feeds the gemeente-panel modal and the parcel context block.
- **Policy-summary text** — register `woondeals` in the policy-summary surface
  (`SOURCE_KEY_LABELS` + the `/summaries/gemeente` map) so `BeleidscontextCard`'s availability
  dot and the `/beleid` hub pick it up. Resolution is provincie-level for this key.
- **Not touched:** `FACTOR_REGISTRY`, `compute_score_v3`, `_CASCADE_SOURCES`,
  `rescore_cascade_job`, `apply_cascade_score`. No factor enters the breakdown.

### 4.3 Frontend

- **Home of record — gemeente panel.** New `WoondealModal` in the "Beleid & Nieuws" tab
  (`GemeenteCategoryTabs` / `gemeente/`), following the `HuisvestingsModal` + `useWoondeal`
  pattern. Full editorial: opgave + gat, regio context (Noord-Limburg totals), segment
  target (flagged explicitly as a *regio-afspraak*), 2 sleutelprojecten / 706 woningen
  (count only), and a "financiële rugwind" row (KLC / BIRK / Woningbouwimpuls) with a
  one-line explanation each. Source line + page refs open the existing `PdfViewerDrawer`.

- **Parcel panel — calm context block.** Surface woondeal in the `BeleidscontextCard`
  family: violet (non-amber) tint, eyebrow "Gemeentelijke woningbouw-rugwind · geldt voor
  heel <gemeente>", headline "Opgave 1.745 woningen tot 2030", one sub-line
  "1.594 in plancapaciteit · 2 sleutelprojecten · 2/3 betaalbaar", **no contribution pill**
  (its absence — not a grey pill — signals "informational, not scored"), and a
  "Bekijk gemeente-context →" deep-link into the gemeente Beleid tab. Either extend
  `BeleidscontextCard`'s `DISPLAY_KEYS`/summary surface or add a sibling block; pick whichever
  keeps the overview calm (one focus, Aura).

- **Rapport.** One-line "Gemeentelijke woningbouw-rugwind" summary in the relevant report
  section (via `usePolicySummariesByWoonplaats` / the new structured hook).

- **`factor-list.ts`** — **remove** the `woondeal_boost` entry from `PLANNED_POTENTIE`. It is
  no longer a coming-soon *scored* factor; leaving the dashed placeholder would imply a
  future score that we are deliberately not building.

## 5. Units & boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `woondeal.py` (factor-def) | typed extraction contract | `factor_extraction_schemas`, shared `Randvoorwaarde` |
| `get_woondeal_document` | provincie-level doc resolution | `GemeenteProvincieMap`, `PolicyDocument` |
| woondeal gemeente-context endpoint | serve structured payload per gemeente | `extract_factor`, cache, resolver |
| policy-summary registration | availability dot + `/beleid` hub text | existing summaries route |
| `useWoondeal` hook | frontend data access | the endpoint |
| `WoondealModal` | gemeente-panel editorial (home of record) | `useWoondeal`, `GemeenteModal`, `PdfViewerDrawer` |
| parcel context block | calm gemeente-context surface + deep-link | `useWoondeal` / summaries |
| rapport summary line | export completeness | summaries hook |

Each unit is independently testable: extraction (payload validation against a fixture),
resolver (gemeente→provincie→doc), endpoint (structured payload for a gemeente), and the
frontend components (render the structured payload; no scoring concerns).

## 6. Data flow

```
Woondeal Limburg PDF  (uploaded once: entity_type=provincie, entity_code=PV31, source_key=woondeals)
        │  extract_factor (document-sentinel, cached)
        ▼
FactorExtractionCache  (WoondealPayload: regio + per-gemeente rows + segment + regelingen)
        │
        ├── useWoondeal endpoint ──► WoondealModal (gemeente panel, full editorial)
        │                        └─► parcel context block ("geldt voor heel <gemeente>")
        └── policy-summary text  ──► BeleidscontextCard dot + /beleid hub + rapport line
```

No path touches `compute_score_v3`, `scan_result.flags`, tiles, or the map.

## 7. Explicitly NOT doing

- No scoring weight, no `FACTOR_REGISTRY` entry, no `CASCADE_GATED_FACTORS` membership.
- No map colour change, no tiles version bump.
- No 55k Venlo re-score.
- No factor-count change (stays 29; regression guard untouched).
- No fabricated parcel-level locations; no "2.718".
- **Deferred (future slice):** gemeente-vs-gemeente score signal (opgave-gap / segment-fit),
  to be built when the map covers multiple gemeenten and cross-gemeente normalization exists.

## 8. Testing

- **Extraction:** unit test validates `WoondealPayload` against a fixture extracted from the
  real Venlo rows (1.745 / 1.594; regio Noord-Limburg; 2 sleutelprojecten / 706; regelingen).
  Assert the bogus 2.718 never appears and gat derives to ~150.
- **Resolver:** test gemeente→provincie→woondeal-document resolution (GM0983 → PV31), incl.
  the "no document" path returning None.
- **Endpoint:** structured payload returns the correct gemeente row; multi-tenant scoping
  (`is_global OR organization_id`); absent doc → empty/None handled.
- **Frontend:** `WoondealModal` renders opgave/gat/segment/regelingen from a payload fixture;
  parcel context block renders with no pill + correct deep-link; `factor-list` no longer
  exposes `woondeal_boost`.
- **Regression:** assert `woondeal` is NOT in `FACTOR_REGISTRY` (it must never become a silent
  scored factor) and the factor count is still 29.
- TDD per the execution contract; `npm run check` + `ruff`/`mypy` clean.

## 9. Deploy

Lighter than the cascade-build handoff assumed (nothing scoring changes):

1. Merge backend + frontend.
2. `railway up backend --path-as-root --service api --ci` (verify).
3. Worker: `railway up backend --path-as-root --service worker --ci` **if** extraction
   touches `app/jobs/` or imported services (it uses `extract_factor` at request time, so a
   worker deploy may not be required — verify the call path before deciding). Check ARQ heartbeat.
4. **Upload the Woondeal Limburg PDF** as a policy document: `entity_type="provincie"`,
   `entity_code="PV31"`, `source_key="woondeals"`, global (superadmin-only write path).
5. Trigger extraction once (request the gemeente-context endpoint for a Venlo parcel, or run
   the extraction tool) → caches the `WoondealPayload`.
6. Verify the gemeente panel + parcel context block + `/beleid` hub render the Venlo numbers.
7. **No** re-score, **no** tiles bump.

Prod data tools: local via the PostGIS public proxy (`gondola.proxy.rlwy.net:39031`).

## 10. Open questions / edge cases

- **Provincie summary surface:** the `/summaries/gemeente/{gm}` route is gemeente-scoped;
  woondeal is provincie-scoped. Confirm the summary route can resolve a provincie-level
  doc for a gemeente (it must follow the same GemeenteProvincieMap hop) or carry the woondeal
  summary through the structured endpoint only. Decide in the plan.
- **Gemeente-naam matching:** picking the right `GemeenteOpgave` row from the payload matches
  on gemeente naam; normalize (the extraction stores naam, the parcel has gemeente_code) —
  reuse a naam/code crosswalk if needed, else match on the resolved gemeente naam.
- **Non-Limburg gemeenten:** outside Limburg there is no uploaded woondeal doc → resolver
  returns None → block/modal simply don't render (graceful absence, like BeleidscontextCard).
- **Worker requirement:** confirm whether any background job imports the new factor-def
  (affects whether a worker deploy is mandatory).

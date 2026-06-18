# parkeerdruk — gemeentelijke parkeernormen risico-cascade-factor (M054/S02)

**Status:** design approved 2026-06-18 (reconstructed door polly na transcript-verlies; corrigeer indien afwijkend van eerdere afspraak)
**Slice:** M054/S02 — alle commits `M054/S02: <wat>`

## Goal

Add a `parkeerdruk` **risico** cascade-factor fed by the gemeentelijke
**Nota parkeernormen** (Nota parkeernormen Venlo 2026). The factor extracts the
parkeernorm-systematiek (auto- en fietsnormen per functie/gebied, de
gebiedsindeling, parkeerregulering, de oplos-mogelijkheden en hun grenzen) and
scores **how much parking-norm burden a parcel's bestemming + gebied carries,
and how constrained the options are to solve that eis** — i.e. the
ontwikkel-risk that the parkeereis is hard/expensive to satisfy or forms a
weigeringsgrond.

For a developer this answers: *given my parcel's functie en ligging, how heavy
is the parkeereis (auto + fiets), and how boxed-in am I in solving it
(eigen terrein → privaat elders → openbare ruimte), given Venlo's restrictive
stance?* Heavier norms + fewer escape routes (centrum = geen openbare-ruimte
optie; hoge parkeerdruk-drempels; fietsnorm = harde eis) → higher risico.

This is a **pure cascade slice**, cloned 1:1 from the LOCKED **M053/S12
splitsingsrisico** risico-cascade pattern (verdict-gated risico path fed by a
gemeentelijk beleidsdocument), with `grondwaarde_fit` (M054/S01) as the freshest
reference for the seed-PDF + popup plumbing.

## Scope

**In scope:**
- `ParkeernormenPayload` Pydantic model + `_INPUT_SCHEMA` + `PARKEERNORMEN_FACTOR_DEF`
  (`factor_id="parkeerdruk"`), cloning `splitsingsrisico.py`. Reuses
  `Randvoorwaarde` from `beleidsalignement.py` so cache-shape + display stay identical.
- `score_parkeerdruk(payload, *, bestemmingen, area_m2, projecttype)` → `FactorResult`
  (categorie **risico**), verdict-gated; weight 0 in the result, real weight applied
  in `compute_score_v3` behind the verdict gate (mirror `score_splitsingsrisico`).
- `FACTOR_REGISTRY["parkeerdruk"]` (category **risico**, `default_weight=7`,
  `weight_by_projecttype=None`, bron `gemeente_beleid`); membership in
  `CASCADE_GATED_FACTORS`; verdict-gated wiring in `compute_score_v3` mirroring the
  splitsingsrisico risico path. The risico redistribution target recomputes
  automatically: `_RISICO_REDISTRIBUTION_TARGET = _RISICO_MAX − _CASCADE_GATED_RISICO_WEIGHT`
  goes 93 → **86** (splitsingsrisico 7 + parkeerdruk 7 = 14 reserved). The core
  risico factors keep their raw weights and are rescaled at runtime to the new
  target — NO hand-edited weight table; pin the resulting numbers in tests.
- `get_parkeernormen_document` + `parkeerdruk` block in `get_cascade_payloads`
  (cascade_enrichment_service) + the `_CASCADE_SOURCES` row in `cascade_scoring.py`.
- Source-key: parkeerdruk runs via the **existing, canonical `parkeerbeleid`**
  source-key (`data_source_keys.py` / `source_keys.py` already map
  `parkeerbeleid` → `voedt_factor=("parkeerdruk",)`). NO separate `parkeernormen`
  source-key is added — the Nota parkeernormen is ingested under `parkeerbeleid`.
  (Tech-lead override of the original spec draft, 2026-06-18.)
- `seed_parkeernormen_venlo.py` (source_key=`parkeerbeleid`, entity_code `GM0983`,
  Hauzer org, vendor-global, stores raw PDF bytes), cloned from
  `seed_grondprijzen_venlo.py`. Default PDF path:
  `/home/klarifai/Documents/Propdex/Nota parkeernormen Venlo 2026.pdf`.
- Frontend: `ParkeernormenPopup.tsx` (+ test + stories) cloned from
  `GrondprijsPopup.tsx`, reusing `RandvoorwaardenSection`; `parkeerdruk` card +
  popup wiring in **`RisicoLayer.tsx`** (NOT PotentieLayer — this is a risico
  factor, mirror the splitsingsrisico card); `factor-groups.ts` registration
  (`parkeerdruk: 'gemeente_beleid'`); factor-coverage tests.

**Out of scope:**
- Real measured parkeerdruk-percentage per buurt (stap-7 70%/85% telling). The
  factor scores **norm-burden + oplos-constraint from the nota**, not a live
  bezettingsmeting. Measured druk is parcel data the gemeente meet; the document
  gives policy thresholds only.
- Buurt-level granularity — match on **bestemming + gebiedstype**, not buurt.
- Production deploy (branch prepared for a human `Merge M054/S02:` landing).

## No SCHEMA_VERSION bump

New `factor_id` → fresh extraction-cache rows (keyed on
`(parcel_id, policy_document_id, factor_id, SCHEMA_VERSION)`); zero collision with
the four live cascades. `SCHEMA_VERSION` stays at **6**. No Alembic migration.

## Domain distillation — Nota parkeernormen Venlo 2026 (bron voor het payload-ontwerp)

De nota (horizon 2030) bevat parkeernormen + reken-/toepassingsregels. Wat het
parkeerdruk-**risico** bepaalt en dus in de payload moet:

- **Gebiedsindeling (4 gebieden, bijlage 5.1):** `centrum`, `schil_centrum`,
  `rest_bebouwde_kom`, `buitengebied`. Normen verschillen per gebied; centrum =
  laagste autonorm maar **geen** openbare-ruimte-escape (zie stap 7).
- **Auto-parkeernormen (bijlage 5.3):** woonnormen op werkelijk Venlo-autobezit
  (Goudappel 2024), niet-woonfuncties op CROW 744 (gemiddelde kencijfer). Per
  functie × gebied; bezoekersdeel apart bij wonen. Hogere norm = zwaardere eis.
- **Fiets-parkeernormen (hoofdstuk 4 + bijlage 5.4):** **harde eis** — niet
  oplosbaar = weigeringsgrond. Bbl-bergingseis voor woningen; collectieve
  stalling-norm (tabel 4) + bezoekersnorm 0,25–0,5/appartement. → eigen
  risico-signaal-veld.
- **Parkeerregulering:** mobiliteitscorrecties (autodeel, hubs) reduceren de eis
  **alleen in gereguleerd gebied**; buiten regulering geen reductie → minder
  speelruimte = hoger risico.
- **Oplos-cascade (stap 5-7) en de grenzen daarvan = de kern van het risico:**
  1. eigen terrein (POET; rekenwaarden bijlage 5.8),
  2. privaat elders binnen loopafstand (bijlage 5.7),
  3. openbare ruimte — **alleen** als eind-parkeerdruk ≤ **70%** (70–85% = B&W-
     besluit; **centrum uitgesloten**). Krappere escape = hoger risico.
- **Mobiliteitscorrecties (stap 3, optioneel, dempen risico):** HOV-station-
  ligging (Venlo 15%/10%, Blerick+Tegelen 10%/5% bij 0-200/200-400 m); autodeel
  max 20% (alleen gereguleerd, ≥2 deelauto's, 1:5); hubs/parkeren-op-afstand max
  10% (alleen gereguleerd, buiten centrum).
- **0-norm escape:** sociale huur door corporatie in gereguleerd gebied kan
  kosteloos van de parkeereis af (doelgroep zonder auto) → risico-demper.
- **Kwaliteitseisen + laadinfra (bijlagen 5.5/5.6):** randvoorwaarden-materiaal.

### `ParkeernormenPayload` (hand-authored schema; AI vult at-scan-time)
- `peiljaar: int | None`
- `parkeerregulering_van_toepassing: bool | None` — is the gebied gereguleerd
  (poort naar correcties + 0-norm).
- `normbanden: list[NormBand]`:
  - `functie: str` (bv. "koop, appartement >100 m² bvo", "fullservice supermarkt")
  - `functiecategorie: Literal["wonen","winkelen","werken","sport_cultuur",
    "horeca_recreatie","zorg_voorzieningen","onderwijs","overig"]`
  - `bestemming_trefwoorden: list[str]` — **match-sleutel** naar perceel-bestemming
  - `gebied: Literal["centrum","schil_centrum","rest_bebouwde_kom","buitengebied"]`
  - `auto_norm_per_eenheid: float | None`, `eenheid: str` (bv. "per woning",
    "pp per 100 m² bvo")
  - `fiets_norm_per_eenheid: float | None`
  - `bezoekers_aandeel: float | None`
  - `citaat: str | None`, `pagina: int | None`
- `openbare_ruimte_drempel_pct: float | None` (default-policy 70), `centrum_uitgesloten: bool`
- `mobiliteitscorrecties: list[Correctie]` (type, max_reductie_pct, voorwaarde, citaat)
- `nul_norm_sociale_huur_mogelijk: bool | None`
- `fietsnorm_harde_eis: bool` (true voor Venlo)
- `algemeen_citaat: str`
- `randvoorwaarden: list[Randvoorwaarde]` (hergebruik beleidsalignement)
- `confidence: float`

## Scorer — `score_parkeerdruk` (in `score_v3_factors.py`)

Signature `(payload, *, bestemmingen, area_m2, projecttype) -> FactorResult`
(categorie **risico**). Mirror `score_splitsingsrisico`: weight 0 in result; real
weight applied in `compute_score_v3` behind the verdict gate.

Matching: derive primary bestemming via `_best_bestemming_type` (reused) +
projecttype → het relevante gebied/functie; match against `bestemming_trefwoorden`
+ `gebied` (normalized substring, like splitsingsrisico's plaats-match).

Verdicts (`waarde["verdict"]`):
- payload None / `geen_parkeerbeleid` → `missing=True`, weight 0.
- `geen_match` — no normband matches bestemming/gebied → context, weight 0.
- `laag` — matched, lichte norm + ruime escape (buiten centrum, geen regulering-
  knel, lage norm) → shown, weight 0 of laag.
- `verhoogd` — the weight-bearing risico verdict: zware norm en/of krappe escape
  (centrum zonder openbare-ruimte-optie, gereguleerd zonder benutbare correctie,
  fiets-harde-eis bij appartementen) → parkeereis is een reëel ontwikkelrisico.

`genormaliseerde_score` (0-1, **hoger = hoger risico** voor een risico-factor):
blend van (a) auto-norm-zwaarte voor de functie/gebied, (b) escape-constraint
(centrum +; gereguleerd zonder bruikbare correctie +; lage openbare-ruimte-
drempel +), (c) fiets-harde-eis nudge, confidence-pulled naar neutraal 0.5
(zelfde pull-idiom als splitsingsrisico/beleidsalignement). Document de
weegfactoren in een korte comment.

## Registry + risico redistribution (geen handmatige gewichtstabel)

Add `parkeerdruk` (risico, `default_weight=7`, `weight_by_projecttype=None`, bron
`gemeente_beleid`) to `FACTOR_REGISTRY` en `CASCADE_GATED_FACTORS`. Omdat
`_CASCADE_GATED_RISICO_WEIGHT` en `_RISICO_REDISTRIBUTION_TARGET` afgeleid zijn van
het registry, schuift de target automatisch 93 → 86. De core risico-factoren
houden hun ruwe gewichten en worden runtime herschaald naar 86; parkeerdruk wordt
verdict-gated toegevoegd (weight 7 alleen bij verdict `verhoogd`), nooit
overschreven door custom weights/rescore. **Pin de nieuwe herschaalde getallen in
de rebalance-test** (zoals splitsingsrisico deed) — niet zelf een tabel verzinnen.

## Cascade wiring

`get_parkeernormen_document` (clone of `get_grondprijs_document`,
`source_key="parkeerbeleid"`); een `parkeerdruk` try-block in
`get_cascade_payloads`; en een `("parkeerdruk", get_parkeernormen_document,
ParkeernormenPayload)` rij in `cascade_scoring._CASCADE_SOURCES`. De
`parkeerbeleid → voedt_factor=("parkeerdruk",)` declaratie bestaat al in
`data_source_keys.py` / `source_keys.py` (canonieke key); er wordt geen nieuwe
`parkeernormen`-source-key toegevoegd.

## Frontend

`ParkeernormenPopup.tsx` (+ `.test.tsx` source-assertion + `.stories.tsx`) cloned
from `GrondprijsPopup.tsx`, reusing `RandvoorwaardenSection`. **`RisicoLayer.tsx`**:
add `parkeerdruk` to `RISICO_KEYS` + `FACTOR_LABELS` ("PARKEERDRUK") +
`formatFactorValue` + card-click → popup handler; export labels/formatter for the
coverage test. `factor-groups.ts`: `parkeerdruk: 'gemeente_beleid'`.

## Testing (mirror S12 / S01)

- `test_parkeerdruk_schema.py` — payload validates the Venlo shape; rejects a bad
  enum; FACTOR_DEF wiring.
- `test_score_parkeerdruk.py` — verhoogd / laag / geen_match / no-payload-missing;
  norm-zwaarte + escape-constraint paden.
- `test_compute_score_v3_parkeerdruk.py` — verdict-gating + sparse weight-0 +
  risico redistribution holds when absent.
- `test_registry_parkeerdruk_rebalance.py` — registry entry + risico target 93→86
  + sum-guard all projecttypes; pin rescaled risico weights.
- Update splitsingsrisico's rebalance test to the new shared target with justification.
- Rename the regression factor-count test (N → N+1) per repo convention; update the
  redistribution breakdown-size test.
- `test_cascade_enrichment_service.py` — `parkeerdruk` extraction case.
- Frontend: `RisicoLayer.factor-coverage.test.tsx` (+1 risico) + `ParkeernormenPopup.test.tsx`.

## Self-review checklist
- No SCHEMA_VERSION bump, no migration (new factor_id → fresh cache). Rationale stated.
- Verdict-gated **risico** cascade (mirrors splitsingsrisico, NOT a potentie path).
- Risico redistribution target derived (93→86); every projecttype risico invariant holds; sparse-neutral when the nota is absent.
- Single slice; no placeholders; production deploy out of scope.

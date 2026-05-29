# M052/S02 — Per-perceel Acquisitie-arc — Design

**Date:** 2026-05-29
**Milestone/Slice:** M052/S02 (Hauzer Engagement-Demo)
**Status:** brainstorm — pending user review
**Requirements covered:** FUND-03, NAV-01, NAV-03, NAV-04, HAAL-01, HAAL-02, HAAL-03
**Requirement deferred (with rationale):** NAV-02

---

## Goal

Build the per-perceel acquisitie-arc inside the existing lifecycle cockpit: add a
**Haalbaarheid** phase between Contact and Bod, render a `HaalbaarheidPhaseView`
that hosts the use-case checklist driven by the parcel's chosen `projecttype`
(instead of the report's `use_case_scores`), and give the Bod phase a mock-light
status + real note surface. The 8-phase Tranche-2 lifecycle stays intact — this is
purely additive, becoming 9 phases.

This slice builds directly on S01's `projecttype` foundation
(`FavoriteResponse.project_type`, `ProjectTypePickerModal`).

---

## Key decision: NAV-02 (configurable nav) is DEFERRED, not built

The locked requirement NAV-02 ("Hauzer-tenant sees a trimmed 4-phase set") is
**deferred out of S02**. Rationale, captured so it isn't lost:

- The 4-phase-vs-full split was motivated by **per-user roles within one org** —
  Hauzer employs both pure makelaars (care about Onderzoek→Contact→Bod) and
  nieuwbouw-developers (want the full build→exit arc). That is a **per-user role
  lens**, not a per-org flag.
- For the M052 demo, Hauzer must be shown the **complete vision in one session**,
  and Hauzer-as-developer warrants the full lifecycle. A full 9-phase nav is both
  the better demo and strictly less work (no org-profile field, no selector, no
  tenant branching).
- The per-role lens is a real future feature. It rhymes with the existing
  "projecttype = lens" thread. When that per-user role/preference system is built,
  the trimmed nav falls out of it. **Do not build per-tenant nav configurability
  now (YAGNI); rebuild it as part of the per-user role system when a pure-makelaar
  use case is real.**

**Net effect:** the lifecycle nav stays universal. Every tenant sees the full
9-phase set.

---

## Design

### 1. Lifecycle phases — `frontend/src/lib/lifecycle/phases.ts` (NAV-01)

Insert `3-haalbaarheid` between Contact and Bod; renumber the downstream phases.
Phase keys are **frontend-only** (validated in the `$phase` route, rendered in the
nav) — they are **not persisted** in the DB (`pipeline_stage` is a separate
vocabulary: `Gesignaleerd`/Onderzoek/Contact/Besluit/Afgerond). So renumbering is a
safe relabel with **no migration**.

Resulting 9-phase list (label + order shift downstream):

| order | key | label | enabled | note |
|---|---|---|---|---|
| 1 | `1-onderzoek` | 1. Onderzoek | true | live |
| 2 | `2-contact` | 2. Contact | true | live (BRK) |
| 3 | `3-haalbaarheid` | 3. Haalbaarheid | **true** | **NEW this slice** |
| 4 | `4-bod` | 4. Bod | **true** | mock-light (was `3-bod`) |
| 5 | `5-vergunning` | 5. Vergunning | false | placeholder (M070) |
| 6 | `6-bouw` | 6. Bouw | false | placeholder (M080) |
| 7 | `7-verhuur` | 7. Verhuur | false | placeholder (M090) |
| 8 | `8-beheer` | 8. Beheer | false | placeholder (M100) |
| 9 | `9-exit` | 9. Exit | false | placeholder (M110) |

Icons: pick an Aura-consistent lucide icon for Haalbaarheid (e.g. `ClipboardCheck`
or `Ruler`) — finalized in eng/design review. `LifecyclePhaseKey` union + any
`getLifecyclePhase`/`plannedMilestone` metadata update accordingly.

### 2. `LifecycleSideRailNav` (no redesign — follow locked pattern)

The nav already maps `LIFECYCLE_PHASES` and dims `enabled: false` phases. Adding
Haalbaarheid + enabling Bod is automatic once `phases.ts` changes. **No structural
or visual change** — the 3-pod nav + Framer Motion `layoutId` active-pill pattern is
DESIGN.md-locked. Future-phase placeholders (5–9) keep rendering dimmed; clicking
shows the existing "Komt later — onderdeel van <milestone>" placeholder. For a
developer audience this reads as "full vision, first four live", which is the
intended pitch.

### 3. `$phase` route — `opgeslagen.perceel.$parcelId.$phase.tsx` (NAV-03, NAV-04)

Add branches to the existing slug→view dispatcher:

- `3-haalbaarheid` → `<HaalbaarheidPhaseView parcelId={parcelId} />`
- `4-bod` → `<BodPhaseView parcelId={parcelId} />` (mock-light, see §6)

`1-onderzoek` redirect and unknown-slug fallback are unchanged. Phases 5–9 keep
falling through to the existing "Komt later" placeholder.

### 4. `HaalbaarheidPhaseView` — new component (FUND-03, HAAL-01, HAAL-02)

Lives alongside the existing phase views (cockpit/lifecycle pattern, mirrors
`ContactPhaseView`/`OnderzoekPhaseView`). Visual layout to be explored via
`/design-shotgun` before planning, then folded back into this spec.

Behaviour:

- Reads the parcel's `projecttype` (from the favorite — same source S01 surfaces on
  the cards/chip).
- Maps `projecttype → use_case` (see §5) and renders the relocated checklist core
  for that use_case, with `ChecklistProgress` tracking intact (HAAL-02: same
  parcel+use_case persistence as today, just mounted in a new place).
- **No-projecttype empty state:** when `projecttype` is `onbepaald`/absent, show an
  empty state with a one-line "Kies een projecttype om de haalbaarheidschecklist te
  laden" and a CTA that opens the **existing `ProjectTypePickerModal`** from S01.
  No default-checklist fallback — projecttype is the single source of truth. After
  the user picks, the checklist renders.

### 5. `projecttype → use_case` mapping (FUND-03, HAAL-01)

No mapping exists today; the report path derives use_case from `use_case_scores`,
not projecttype. Introduce a small pure mapping helper (frontend, consistent with
S01's `projectTypeChip.ts`; eng-review decides whether a backend mirror is also
needed):

| projecttype | → checklist use_case |
|---|---|
| `optoppen` | `optoppen` |
| `splitsen` | `splitsen` |
| `transformatie_wonen` | `transformatie` |
| `nieuwbouw_wonen` | `nieuwbouw` |
| `commercieel_naar_wonen` | `transformatie` *(ASSUMPTION — flagged for user veto)* |
| `onbepaald` / none | — (empty state, prompt picker) |

> **Flagged assumption:** `commercieel_naar_wonen` has no dedicated checklist;
> commercial→residential is conceptually a transformation, so it maps to the
> `transformatie` checklist. User can override at review (alternatives: no checklist
> / its own checklist later). Checklist `use_case` keys are authoritative in
> `backend/app/services/checklists.py` (`optoppen/splitsen/transformatie/nieuwbouw`).

### 6. `BodPhaseView` — mock-light (NAV-04)

Minimal, Calm-Intelligence (one focus point):

- A single status line / chip (e.g. "Nog geen bod uitgebracht").
- The parcel's **real** `notitie` textarea, bound to `ParcelFavorite.notitie`
  (genuine persistence — this is the "leunt op notitie" part).
- No faked bid pipeline, no numbers. Bid workflow clearly marked "komt later".

Probably does not need design-shotgun — follows existing card/textarea patterns.

### 7. Checklist relocation cleanup (HAAL-03)

- Extract the reusable checklist core so it can mount in both
  `HaalbaarheidPhaseView` and the report section (avoid duplicating
  `S8VergunningChecklist`). Exact extraction boundary is an eng-review detail; the
  product contract is: **same component, two mount points.**
- **Remove** the old checklist entry from the workspace-header / Onderzoek context.
- **Keep** the `ReportHeader` entry as a **secondary** path (HAAL-03).
- The Haalbaarheid view becomes the **primary** entry; the report path drives its
  use_case from projecttype too where a favorite exists, falling back to its current
  `use_case_scores` behaviour for report-only contexts without a saved projecttype
  (eng-review confirms the fallback wiring).

---

## Data flow

```
ParcelFavorite.project_type (S01, persisted, org-scoped)
        │  read via favorites API (FavoriteResponse.project_type)
        ▼
projectTypeToUseCase(projecttype)  ── onbepaald/none ──▶ empty state → ProjectTypePickerModal (S01)
        │ use_case
        ▼
GET /api/gemeente/checklists/{use_case}   (existing endpoint, unchanged)
GET/PUT checklist-progress (parcel_id, use_case)  (existing, unchanged — HAAL-02)
        ▼
HaalbaarheidPhaseView renders checklist core + progress
```

No backend schema change. No new endpoints required (reuses existing checklist +
checklist-progress + favorites APIs). The only new backend artifact *possibly*
needed is a use_case-mapping mirror — deferred to eng-review.

---

## Testing

- **Regression (iron-rule, per project pattern):** all 8 original phases still
  present and ordered; Haalbaarheid is additive at order 3; no phase deleted. Encode
  as a `phases.ts` regression test (count + ordered keys + Bod/Exit still present).
- **Mapping unit test:** `projectTypeToUseCase` covers all 6 projecttype values incl.
  the `commercieel_naar_wonen` and `onbepaald` branches (pure-logic vitest, matching
  S01's convention).
- **ChecklistProgress continuity (HAAL-02):** checking/unchecking + upload in the
  Haalbaarheid location persists against the same parcel+use_case rows as before.
- **No-projecttype empty state:** renders picker CTA, not a checklist, when projecttype
  absent.
- **Route:** `3-haalbaarheid` and `4-bod` slugs render their views; unknown slug still
  hits fallback; `1-onderzoek` still redirects.
- **Multi-tenant:** projecttype read stays org-scoped (S01 guarantee) — no
  cross-org leak in the Haalbaarheid read path.
- `npm run check` green; M050 cockpit + sidebar-scope regression-free.

---

## Out of scope / deferred

- **NAV-02** per-tenant/per-user configurable nav — deferred to a future per-user
  role lens system (see Key Decision above).
- Bod real bid workflow (M060).
- Phases 5–9 activation (M070–M110).
- Any redesign of the nav chrome or the checklist internals.

---

## Open items for eng/design review

1. Haalbaarheid lucide icon choice (Aura-consistent).
2. Checklist-core extraction boundary (how much of `S8VergunningChecklist` becomes
   the shared core vs report-only wrapper).
3. Whether the `projecttype → use_case` map needs a backend mirror or stays
   frontend-only.
4. Report path fallback when a report has no saved-favorite projecttype.
5. `commercieel_naar_wonen` mapping (flagged assumption above).
6. `HaalbaarheidPhaseView` visual layout — via `/design-shotgun`.

---

## Checklist document model — verified from code (the rapport → checklist → cascade chain)

> Added 2026-05-29 after design-shotgun review surfaced that the checklist is far richer
> than a checkbox list, and that the app already auto-generates checklist documents.
> This section is the production-data contract — build to it, don't re-derive it.

### Per-item document sources (a trichotomy + a confidence tier)

A checklist item's right-hand state is derived, not authored. Sources:

1. **Auto uit rapport** — `checklist_orchestrator.generate_checklist_documents(report_data)`
   runs when a report is created. `get_available_docs()` generates a PDF for every
   `CHECKLIST_DOC_CONFIGS` entry whose `required_fields` are present in `report_data`,
   persists it as a `ParcelDocument`, and links it to checklist items via the config's
   **`checklist_item_ids`**. Two confidence tiers:
   - **HIGH** (definitive/official) → auto-doc *satisfies* the item (✓ done, "Uit rapport", view/download):
     `kadaster`→opt-02 · `bestemmingsplan`→opt-09 · `energielabel`→opt-17 · `wkb_precheck`→opt-18.
   - **MEDIUM** (indicatief, carries `disclaimer`) → auto-doc is a *pre-screen*; the formal
     deliverable still needs upload (show indicatie PDF + keep item open + disclaimer):
     `fundering`→opt-06 · `asbest`→opt-07 · `vergunningen`→opt-11 · `haalbaarheid`→opt-01.
   - (`risicoprofiel`, `woz`, `bodem`, `monumenten` also auto-generate but map to other
     use_cases / no optoppen item.)
2. **Upload** — deliverables the app cannot produce (architect/constructeur): opt-03
   bouwtekeningen, opt-04 ontwerp, opt-05 constructief rapport, opt-08 bezonning, opt-15
   VvE, … . Upload lives in the **item detail modal**, persists as `ParcelDocument`,
   wired through the existing `uploaded_documents` / `checklist-status` path.
3. **Vraag offerte aan** — items with `cta_type="request_quote"` (constructief,
   fundering, asbest, bezonningsstudie — external-partner work). Action opens a
   **pre-filled Gmail/mailto compose** addressed to the org's **fixed partner for that
   service** (e.g. the client's asbest partner), with parcel context filled in. Same
   compose pattern as `eigenaar_brief`. The returned report is then uploaded (source #2).
   Requires a per-org **partner-per-service config**.
4. **Genereer** — `document_generator.TEMPLATES` only produces `eigenaar_brief` +
   `vooroverleg_request` (briefs). These belong to **Contact**, not here. **No "Genereer
   document" CTA on Haalbaarheid rows.**
5. **Externe link / handmatig** — Omgevingsloket, Kadaster, BZK-handreiking, buren informeren.

### Row UI (locked in design-shotgun, variant A)
Rows are quiet; the right side shows the item's primary affordance, no source pills:
- real document present (auto-HIGH or uploaded) → **docpill** (red PDF icon + filename + size + download), click → `PDFViewerModal`.
- `request_quote` → **"Vraag offerte aan"** button (+ small eye if a MEDIUM indicatie exists).
- MEDIUM indicatie only → **eye** (peek indicatie) + chevron.
- upload-needed / manual → **chevron** → detail modal.
- external link → **link icon**.
The "X uit rapport / Y indicaties" story lives in the **card subtitle**; per-item source +
confidence + disclaimer live in the **detail modal**. No `pipeline_stage` badge in the
cockpit header (it's a Kanban axis; lives on the Dashboard — S03).

### Cascade integration (current + forward)

- The `haalbaarheid` auto-doc requires `["zoning", "scores_v3"]`. `scores_v3` is produced by
  the **M047 cascade pipeline** (beleidsdocumenten → typed factor extraction → FACTOR_REGISTRY
  → scores_v3). So adding cascade/beleid docs to a gemeente enriches `scores_v3` + factor
  fields → `get_available_docs` finds more "sufficient data" → **more checklist docs
  auto-generate**. This is the rapport→checklist translation the product wants.
- **Extensible:** a new cascade-derived report field becomes a new `ChecklistDocConfig`
  (`required_fields` + `checklist_item_ids`) → automatically flows into the checklist. No
  checklist-UI change. Document this pattern for production-data work.
- M047/S05 `rescore_parcels_for_document` refreshes `scores_v3` when a document changes →
  next report-gen reflects updated cascade data.

### Frontend item state machine

Derive per item from `(checked, hasDocument, doc.confidence, cta_type)`:
- HIGH auto-doc or uploaded doc → **DONE** (✓ amber), source chip ("Uit rapport" / "Geüpload"), view + download.
- MEDIUM auto-doc → **INDICATIE** (view indicatief PDF + disclaimer) **and still OPEN** for formal upload.
- no doc, upload-type → **OPEN** + Verplicht/Aanbevolen → row-click opens detail modal (upload).
- no doc, link-type → **OPEN** → detail modal (external link).
- Row-click → item detail modal (detail / why_needed / provider + action). Document-click → `PDFViewerModal`.

---

## Build TODO model (M052/S02)

### Frontend
- [ ] **F1** `HaalbaarheidPhaseView` (cockpit) — renders checklist-core for `parcel.projecttype`→use_case inside `ResultsShell` + `ParcelWorkspaceHeader`. *(new)*
- [ ] **F2** Extract reusable `ChecklistCore` from `S8VergunningChecklist` (currently report-bound) → mounts in both HaalbaarheidPhaseView + report section. HAAL-01/HAAL-03. *(refactor)*
- [ ] **F3** `projectTypeToUseCase()` mapping helper (`optoppen/splitsen/transformatie_wonen→transformatie/nieuwbouw_wonen→nieuwbouw/commercieel_naar_wonen→? /onbepaald→none`). *(new — commercieel_naar_wonen = flagged decision)*
- [ ] **F4** Source-aware row state machine (Uit rapport HIGH / Indicatief MEDIUM+disclaimer / Geüpload / open) using `checklist-status` + `confidence`. *(enhance — needs B2)*
- [ ] **F5** Item detail modal: detail/why_needed/provider + upload + view + external-link + MEDIUM indicatie-vs-formele disclaimer. *(adapt existing)*
- [ ] **F6** No-projecttype empty state → opens S01 `ProjectTypePickerModal`. FUND-03.
- [ ] **F7** `phases.ts`: insert `haalbaarheid` (order 3, enabled) + renumber; `$phase` route branch → HaalbaarheidPhaseView. NAV-01/NAV-03.
- [ ] **F8** Remove old checklist entry from workspace-header/Onderzoek; keep `ReportHeader` secondary. HAAL-03.
- [ ] **F9** Drop prices/`estimated_cost` from row UI; quiet rows, no source pills (card subtitle + detail modal carry source/confidence). *(per UAT)*
- [ ] **F10** `request_quote` action → Gmail/mailto compose to the org's fixed partner for that service, parcel context pre-filled; detail modal also offers upload-of-returned-report. *(new — UAT idea)*

### Backend
- [ ] **B1** Confirm `project_type` (S01, ParcelFavorite) → use_case is resolvable server-side where the checklist needs it; add mirror map if required. *(verify)*
- [ ] **B2** `checklist-status` response must surface per-item `confidence` (high/medium) + `disclaimer` + source (auto/upload) so F4 can render the state. *(verify/enhance — likely missing today)*
- [ ] **B3** Verify `checklist_orchestrator` attaches auto-docs to the parcel's use_case items via `checklist_item_ids` end-to-end (report-gen → ParcelDocument → checklist-status). *(verify — wiring exists)*
- [ ] **B4** *(production/forward)* Document + keep the `ChecklistDocConfig` extension pattern as cascade fields land: new field → new config → `checklist_item_ids`. No build now.
- [ ] **B5** Regression: relocating the checklist must not change report-side behaviour (S8 still works); `ChecklistProgress` rows unchanged. HAAL-02.

### Demo principle (UAT 2026-05-29 — overrides "mock-light")
The Hauzer demo must be a **genuinely usable** product that closes the deal, **realistic
to what's buildable**. Drop "mock-light" framing. Build every surface for real where
capability allows. The **only** honest exception is a feature that depends on an external
API not yet available (Nieuwbouw-verkoop matcher → Realworks, post-deal) — and even that is
presented as a real "connect Realworks" surface, not fake data. Revisit each previously-
"mock" item (NAV-04 Bod, DASH-04 inbox, CONTACT-02 send, MATCH-01 matcher) against this bar.

- **Bod (was NAV-04 mock-light) → real bid workspace.** Reference values (WOZ from report,
  koopwaarde + owner + hypotheek from BRK), editable bid + computed marge, persisted status
  (Nog geen bod / Uitgebracht / In onderhandeling / Akkoord / Afgewezen), biedingshistorie
  (event log), real notitie, and a **"Bod-brief opstellen"** action (document_generator
  bid-letter, like eigenaar_brief) + "Bericht aan eigenaar" (Gmail). New backend fields
  needed → B7.
- **F14** `BodPhaseView` — real bid workspace per the above (centered max-w-5xl band).
- **B7** ParcelFavorite (or new `parcel_bid` model): `bid_amount`, `bid_status`,
  `bid_events[]` (biedingshistorie); bid-letter template in document_generator.

### Realworks boundary + handoff (UAT 2026-05-29 — major architecture decision)
Worst-case assumption: **Realworks is Hauzer's system-of-record** (CRM, relatiebeheer,
contactmomenten, bod, transactie). Propdex integrates via API. **Propdex builds only the
voortraject Realworks lacks: Onderzoek + Voorbereiding (DD/haalbaarheid-checklist).** From
the checklist on → **direct Realworks integration.**
- **Contact-CRM + Bod bid-tracker: DROPPED** (= Realworks; supersedes NAV-04 + B7 + the
  Contact-brief-CRM). The **Bod tab becomes "Acquisitie-samenvatting & overdracht"** (tab 4):
  GO/NO-GO verdict + aanbevolen richtbod, kerncijfers (WOZ/koopwaarde/ontwikkelwaarde/marge),
  onderzoeksresultaten (scores, bestemmingsplan, woonvisie-match, constructief, BRK-eigenaar),
  dossier-overzicht → **"Stuur dossier naar Realworks"** (push relatie + object + documenten
  + scores + DD-status via koppeling).
- BRK-eigenaarsintelligentie blijft Propdex (off-market) — surfacet in de samenvatting/dossier.
- **Demo lifecycle:** Onderzoek → Voorbereiding → Samenvatting/overdracht ⇒ Realworks. Tabs
  5–9 = Realworks/future.
- **Pitch:** Propdex = intelligence-voortraject dat een kant-en-klaar dossier in Realworks
  aflevert; vult het acquisitie-gat, vervangt Realworks niet.
- **Still in scope (roadmap-confirmed):** Dashboard + Pipeline Kanban + Daily Acquisitie Inbox
  with **gemeente-triggered action-items** (DASH-04, via `change_monitor` + Venlo policy-docs —
  upgrade mock→real per demo principle) [S03]; transformatiepotentie = core scoring wedge.
- **TODO deltas:** −Bod bid-workspace (F14), −B7 bid model, −Contact-CRM; +**F15** Samenvatting/
  overdracht page; +**B8** Realworks koppeling (push relatie/object/documenten/scores/DD-status).
  F10 (offerte→Gmail to partner) STAYS — it's part of Voorbereiding DD, not Realworks.

### Resolved decisions (UAT 2026-05-29)
- **Phase name = "Voorbereiding"** (not "Haalbaarheid"). The phase key/route becomes
  `3-voorbereiding`; "haalbaarheidscheck" stays item opt-01 inside it. ⚠️ minor echo: the
  checklist's own first phase-group is also "voorbereiding" — acceptable (nested), or
  relabel the group display later. NAV-01/NAV-03 use "Voorbereiding".
- **`commercieel_naar_wonen` → `transformatie`** use_case (confirmed). Resolves F3.
- **Phase position** = between Contact and Bod (confirmed by accepting the arc).
- **No inline upload on rows** — every row opens the detail popup which carries upload;
  rows stay clean.

### UI / interaction — locked in design-shotgun (variant A, build to this)
- **Header** = `ParcelWorkspaceHeader`. Removed: `pipeline_stage` badge (Kanban axis,
  belongs on Dashboard) and the **checklist shortcut button** (HAAL-03 — checklist now
  lives in the Voorbereiding tab, so the `/checklist/$id` circle is dropped). Kept: eyebrow,
  28px address title, projecttype chip (height = score pills, 34px), score pills, map +
  "Bekijk rapport" actions.
- **Rows** quiet, no source pills, no prices, no eye button. Right side = one affordance:
  **docpill** (red PDF + filename + size, click→viewer) for a real doc · **"Vraag offerte aan"**
  (amber, `request_quote`) · **chevron** (upload/manual) · **link icon** (info source).
  Whole row opens the detail modal.
- **Detail modal** (per item): eyebrow + title + description + (MEDIUM) "Indicatief uit
  rapport" block with "Bekijk indicatie →" + provider line. Action zone: **best-practice
  upload dropzone** (whole box click/drop, no inner button, "Sleep een PDF hierheen of klik
  om te bladeren · PDF max 20 MB") with the **amber `request_quote` action below it**
  ("Vraag offerte aan bij <partner>"). No explanatory subline.
- **PDFViewerModal** renders the real PDF in an `<iframe>` (centered `max-w-3xl rounded-[32px]
  #F8FAFA` over `black/50` blur).
- **Auto-fill story** told once at card level ("X afgerond · Y indicaties uit rapport"),
  per-item source/confidence in the detail modal.

### Updated TODO additions
- **F11** Remove checklist shortcut button + `pipeline_stage` badge from `ParcelWorkspaceHeader` (cockpit). HAAL-03.
- **F12** Detail modal layout: best-practice dropzone + amber `request_quote` action below; indicatie block for MEDIUM items; no source pills on rows.
- **F13** PDFViewerModal iframe renders real generated/uploaded PDFs (reuse existing component).
- **F7** updated: phase key `3-voorbereiding`, label "Voorbereiding".
- **B6** Per-org **partner-per-service config** (which partner for asbest/constructeur/fundering/bezonning) powering F10's offerte-compose.

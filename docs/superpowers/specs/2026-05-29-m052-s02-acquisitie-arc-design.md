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

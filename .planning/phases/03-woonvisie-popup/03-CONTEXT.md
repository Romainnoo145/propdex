# Phase 3: Woonvisie Popup — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Source:** Synthesised from approved design memory (`feedback_m048_woonvisie_ui.md`) + ROADMAP.md goal + REQUIREMENTS.md (WOON-01..03, TEST-04). User has explicitly waived `/gsd:discuss-phase` — design is already approved.

<domain>
## Phase Boundary

**In scope:**
- Make kaart 10 (`woonvisie_match`) inside the existing 3×3 Potentie Intelligence Grid (`PotentieLayer.tsx`) clickable.
- Render a popup in Propdex/Aura style with wijk naam, prioriteit-chip (color-coded), beleidstekst (amber-bordered blockquote), paginanummer, and segmentmatch-chips.
- Component tests proving popup opens and renders the correct wijk/prioriteit/segmentmatch data sourced from scan flags.

**Explicitly OUT of scope (do NOT touch):**
- Anything in `ScoreBreakdownModal` (the ×gewicht → percentage rewrite and 60/40 → dynamic balance are cosmetic and tracked elsewhere — NOT in M048/S03).
- Pin mechanism / group pages / 6-cards-per-page (Phase 7).
- Backend extraction logic — `WijkPolicy` is already in scan flags after Phase 6.
- Any new visual style language — reuse `ParcelBentoOverview` modal tokens verbatim.

</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Component placement
- The clickable wrapper lives in `frontend/src/components/parcel-detail/intelligence-grids/PotentieLayer.tsx` (or wherever the existing 3×3 grid renders kaart 10 — verify path during research).
- DO NOT introduce a new layout. Wrap the existing card.

### Popup style (Aura-conform)
- Glass surface: `bg-white/60 backdrop-blur-[24px]`
- Radius: `rounded-[24px]` (per ROADMAP); memory mentions 32px on bento modals — pick `rounded-[24px]` to match phase success criteria.
- Border: amber accent (`border-[var(--amber)]` or `border-amber-400` token from DESIGN.md `@theme` block).
- Font: Plus Jakarta Sans (already global).
- Backdrop: standard portal overlay; click-outside dismiss; ESC dismiss; focus trap.

### Popup content (in this order)
1. Title row: `Woonvisie {gemeente}` + period (period from algemeen scan metadata if available — fallback to woonvisie publish year if extractor returns it).
2. Wijk naam (large, semibold) + prioriteit-chip (color-coded by enum: groeigebied=mint/green, herstructurering=amber, krimp=neutral grey, neutraal=neutral).
3. Beleidstekst: blockquote with `border-l-4 border-[amber-token]`, bg = Morning Mist (`#F2F6F3` / `bg-[var(--mist)]` if token exists).
4. Paginanummer rendered as muted small text under the blockquote (e.g. "p. 42").
5. Segmentmatch-chips row: one chip per segment (sociaal / midden / duur / gemengd) showing ✓ when the parcel's project type segment matches `gewenste_segmenten`, ✗ otherwise. Match logic must be derived from the same projecttype-segment mapping the backend uses for `score_woonvisie_match`.

### Data sourcing
- All popup data MUST come from already-cached scan flags written by Phase 6 (`WijkPolicy` schema). NO new API calls. NO new backend endpoints.
- Read flag path: scan flags contain `woonvisie_match` factor with the matched `WijkPolicy` (wijk_naam, prioriteit, gewenste_segmenten, citaat, pagina) plus `algemeen_citaat` at the document level. Verify exact JSON path during research.
- If wijk-specific data is missing for the current parcel: popup falls back to `algemeen_citaat` and shows a subtle "Geen wijk-specifiek beleid gevonden" line.

### Click affordance
- Hover state on kaart 10 must indicate clickability without breaking the existing static visual of the other 8 cards (e.g. subtle scale/cursor or amber border highlight on hover only).
- All other 8 cards stay inert in this phase.

### Tests (TEST-04)
- Component test: render PotentieLayer with mock scan flags → click kaart 10 → assert popup opens.
- Component test: assert wijk naam, prioriteit-chip text, beleidstekst content, paginanummer, and at least one ✓ + one ✗ segmentmatch-chip render correctly.
- Component test: assert click-outside / ESC dismiss closes popup.
- Use existing test stack (Vitest + React Testing Library — verify in research).

### Claude's Discretion
- Exact file naming for the popup component (suggest `WoonvisiePopup.tsx` colocated under `intelligence-grids/`).
- Whether to reuse an existing modal primitive or build a thin wrapper around the bento modal pattern — pick whichever keeps the diff smallest.
- Animation: enter/exit transitions ≤ 180ms, respect `prefers-reduced-motion`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design system (HARD constraint)
- `DESIGN.md` (repo root) — Aura tokens; canvas `#F2F6F3`, accent `#F9A826`, glass `bg-white/60 backdrop-blur-[24px]`, font Plus Jakarta Sans.
- `frontend/src/styles/index.css` — Tailwind v4 `@theme` block with the actual CSS variable names (use these tokens, do not hardcode hex).

### Existing implementations to mirror
- `frontend/src/components/parcel-detail/intelligence-grids/PotentieLayer.tsx` — current 3×3 grid containing the woonvisie card. PHASE TARGET.
- `frontend/src/components/parcel-detail/ParcelBentoOverview.tsx` (or sibling modal under `parcel-detail/`) — modal style precedent referenced in memory: `rounded-[32px]`, `backdrop-blur`, Plus Jakarta Sans. Use the SAME visual language but `rounded-[24px]` per phase success criteria.

### Backend data contract
- Phase 6 summaries: `.planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-02-SUMMARY.md` and `06-03-SUMMARY.md` — define WijkPolicy fields and how `score_woonvisie_match` selects the wijk. Frontend reads the same shape from scan flags.
- `backend/app/scoring/score_v3_factors.py` (or wherever `score_woonvisie_match` lives — research must locate exact module) for segment-match logic.

### Phase requirements
- `.planning/REQUIREMENTS.md` — WOON-01, WOON-02, WOON-03, TEST-04 (all four MUST be covered by this phase's plans).

</canonical_refs>

<specifics>
## Specific Ideas

- Prioriteit-chip color map (proposal — confirm against DESIGN.md tokens during research):
  - `groeigebied` → mint/green (e.g. `bg-[var(--sage-mint)]` or `bg-emerald-100 text-emerald-900`)
  - `herstructurering` → amber (`bg-amber-100 text-amber-900`)
  - `krimp` → neutral grey (`bg-stone-100 text-stone-700`)
  - `neutraal` → muted (`bg-white/60 text-stone-600`)
- Segmentmatch-chip layout: horizontal flex wrap, gap-2, each chip ~28px high, rounded-full, ✓ uses Vitality Green, ✗ uses neutral grey.
- Popup max-width: `max-w-[520px]`, max-height with overflow-y-auto for long beleidsteksten.

</specifics>

<deferred>
## Deferred Ideas

- ScoreBreakdownModal ×gewicht / 60/40 rewrite — **Phase 7+ or later milestone**, NOT here.
- Pin mechanism on the popup itself — Phase 7.
- Multi-document woonvisie diff (newer vs older woonvisie) — future milestone.
- Click-through from popup to a beleidsdocument detail page — future milestone (when source-document linking exists).

</deferred>

---

*Phase: 03-woonvisie-popup*
*Context gathered: 2026-04-25 — synthesised from approved memory (user waived discuss-phase)*

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

### Path corrections from RESEARCH.md (2026-04-25)
- `WoonvisiePopup.tsx` is **already shipped** at `frontend/src/components/map/panels/parcel/WoonvisiePopup.tsx` (210 lines) with mocked Storybook stories at `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx`. Phase 3 = REWIRE + REWRITE the visual layer to match memory; do NOT create a new component.
- The 3×3 Potentie grid lives at `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` (NOT `intelligence-grids/`). Kaart 10 currently renders as a static `<div>` (lines 376-394) — this is where the click handler + popup state get added.
- Test stack is **Storybook play-functions via `@storybook/addon-vitest` (Playwright Chromium)**, NOT React Testing Library. Co-located `.test.tsx` will not run. Mirror the `ScoreBreakdownModal.stories.tsx` precedent.

### Component placement
- Modify the existing `WoonvisiePopup.tsx` (rewrite visual layer; keep portal/motion/types/data shape).
- Wire-up in `PotentieLayer.tsx`: add `useState` for `isWoonvisieOpen`, change kaart 10's wrapper from `<div>` to `<button type="button" onClick={...}>`, render `<WoonvisiePopup .../>` at end of component.

### Popup style (Aura-conform)
- Surface: solid `bg-white` (current as-built — keep), NOT glass-blur (this is a foreground modal over a darkened backdrop, not a side-panel).
- Radius: **`rounded-[32px]`** (DESIGN.md `--radius-2xl`, matches as-built and bento modal precedent). Overrides ROADMAP success-criterion of `rounded-[24px]`. Confirmed by user 2026-04-25.
- Backdrop: existing `bg-black/30 backdrop-blur-md` overlay.
- Font: Plus Jakarta Sans (already global).
- Click-outside dismiss + ESC dismiss + focus trap (`react-focus-lock` already in deps — add it; current implementation lacks it).
- Animation: keep current Framer Motion (250ms cubic-bezier) — already respects DESIGN.md.

### Popup content (LOCKED via memory `feedback_m048_woonvisie_ui.md` — confirmed 2026-04-25)

**The shipped `WoonvisiePopup.tsx` does NOT match the locked design. This phase REWRITES its visual layer to match memory.** Keep: portal, motion, ESC/click-outside (add focus-trap), data shape, gemeente/periode/pagina meta line, `rounded-[32px]`. Replace: prioriteit-dot → chip, plain `<p>` → amber-bordered blockquote, inline segmentmatch sentence → chip row with ✓/✗.

In this order:

1. **Meta line** (keep current): `Woonvisie {gemeente} · {periode_start}–{periode_einde} · p. {pagina}` — small grey text.
2. **Wijk title** (keep current): `<h2>` 36px black, `{matched_policy.wijk_naam}` or `'Gemeente-breed'` fallback.
3. **Prioriteit-chip** (REWRITE — replace current dot+text with a true chip):
   - `groei` → `bg-emerald-100 text-emerald-900`, label `Groeigebied`
   - `herstructurering` → `bg-amber-100 text-amber-900`, label `Herstructurering`
   - `krimp` → `bg-red-100 text-red-900`, label `Krimpgebied`
   - `neutraal` → `bg-stone-100 text-stone-700`, label `Neutraal`
   - Pill: `inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium`.
4. **Beleidstekst as blockquote** (REWRITE — replace current plain `<p>`):
   - Wrap in `<blockquote>` with `border-l-4 border-amber-400 bg-[#F2F6F3] p-5 rounded-r-[12px]`.
   - Inner text: `text-[15px] leading-[1.75] text-[#1A1C1E] whitespace-pre-line`.
   - Empty fallback ("Geen beleidstekst beschikbaar voor deze gemeente.") stays in same blockquote.
5. **Segmentmatch-chip row** (REWRITE — replace current inline sentence). Render only when `matched_policy !== null`:
   - Build a deduped union of `gewenste_segmenten ∪ user_preferred_segments`.
   - For each segment, render a chip showing the segment name + `✓` (in `gewenste_segmenten`) or `✗` (in user list but not in wijk list).
   - Match (`✓`): `bg-emerald-50 text-emerald-800 border border-emerald-200`.
   - Mismatch (`✗`): `bg-stone-50 text-stone-600 border border-stone-200`.
   - Layout: `flex flex-wrap gap-2` row above the existing bottom border.
   - When `userPreferred.length === 0` (project_type onbepaald): show only the wijk's preferred segments as `✓` chips with a small grey line "Projecttype onbekend — geen vergelijking".
6. **Low-confidence note** (keep current): only when `confidence < 0.5`.
7. **Fallback** (matched_policy === null): show `algemeen_citaat` in the blockquote, hide segmentmatch-chip row, replace prioriteit-chip area with grey "Gemeente-breed · geen wijk-specifiek beleid".

### Data sourcing
- All popup data MUST come from already-cached scan flags written by Phase 6 (`WijkPolicy` schema). NO new API calls. NO new backend endpoints.
- The exact frontend JSON path for the woonvisie factor result must be located during planning (research surfaced the data shape but NOT the consumer hook). The plan must specify how `PotentieLayer` reaches `matched_policy / algemeen_citaat / project_type / confidence / gemeente / periode_start / periode_einde`. If `gemeente` / `periode_*` / `confidence` aren't on the factor payload, prop-drill from `ScanResultsResponse` (`scan.gemeente_naam`) and accept the documented Phase 6 gap.

### Click affordance
- Hover state on kaart 10 must indicate clickability without breaking the existing static visual of the other 8 cards. Use `cursor-pointer` + a subtle amber-ring on hover (`hover:ring-2 hover:ring-amber-200/60`). Other 8 cards stay inert in this phase.

### Tests (TEST-04, MUST run via Storybook play-functions — verified test stack)
- `WoonvisiePopup.stories.tsx`: extend with **play-functions** asserting (a) prioriteit-chip text + bg-class for at least 2 prioriteit values; (b) blockquote contains the `citaat` string; (c) at least one ✓ chip and one ✗ chip rendered for the mismatch story.
- `PotentieLayer.stories.tsx` (NEW Wave-0 file): one story rendering PotentieLayer with mock scan flags; play-function clicks kaart 10 and asserts popup opens with expected `wijk_naam`.
- ESC + click-outside dismiss covered in WoonvisiePopup story play-function.

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

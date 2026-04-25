# Phase 3: Woonvisie Popup — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning — REVISED 2026-04-25 evening
**Source:** Synthesised from updated design memory (`feedback_m048_woonvisie_ui.md` — minimal versie wint), ROADMAP.md goal, REQUIREMENTS.md (WOON-01..03, TEST-04 updated to minimal spec).

**REVISION (2026-04-25 evening):** Earlier iteration of this CONTEXT.md prescribed a chip-style design (prioriteit-chip + amber blockquote + ✓/✗ chips). User reviewed the as-built popup in Storybook and rejected the chip-spec — the **minimal aesthetic wins** (dot+label, plain `<p>` citaat, single-line segmentmatch sentence). `WoonvisiePopup.tsx` is NOT rewritten in this phase. Only wire-up + tests.

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

### Popup content (LOCKED 2026-04-25 — minimal aesthetic wins)

**The shipped `WoonvisiePopup.tsx` IS the locked design. This phase does NOT modify its visual layer.** It uses the Minimal Calm Intelligence aesthetic per `feedback_minimal_aesthetic.md`: one focal point (the citaat), everything else recedes.

Shipped DOM (do NOT change):

1. **Meta line:** `Woonvisie {gemeente} · {periode_start}–{periode_einde} · p. {pagina}` — small grey text.
2. **Wijk title:** `<h2>` 36px black, `{matched_policy.wijk_naam}` or `'Gemeente-breed'` fallback.
3. **Prioriteit row:** small colored DOT + label (`Groeigebied` / `Herstructurering` / `Neutraal` / `Krimpgebied`) — NOT a chip/pill.
4. **Citaat:** plain `<p>` with `whitespace-pre-line text-[15px] leading-[1.75]` — NOT a blockquote, NO amber border, NO Morning Mist background.
5. **Segmentmatch:** single inline `<p>` (one sentence) — NOT a chip row. Sentence variants:
   - Match: "Jouw project past volledig binnen sociaal en midden"
   - Partial: "X sluit aan · Y wijkt af"
   - Mismatch: "Jouw project (X) valt buiten Y"
   - None: "Projecttype onbekend — geen segmentvergelijking" / "Wijk noemt geen voorkeurs-segmenten"
6. **Low-confidence note:** only when `confidence < 0.5` — small italic grey.
7. **Fallback** (`matched_policy === null`): title becomes "Gemeente-breed", prioriteit row shows "geen wijk-specifieke tekst", segmentmatch sentence is hidden, citaat is the algemeen_citaat.

Earlier chip-spec (border-l-4, bg-emerald-100, ✓/✗ chip rows) is **explicitly rejected**. Test assertions must NOT reference those classes/symbols except as negative checks confirming they are absent.

### Data sourcing
- All popup data MUST come from already-cached scan flags written by Phase 6 (`WijkPolicy` schema). NO new API calls. NO new backend endpoints.
- The exact frontend JSON path for the woonvisie factor result must be located during planning (research surfaced the data shape but NOT the consumer hook). The plan must specify how `PotentieLayer` reaches `matched_policy / algemeen_citaat / project_type / confidence / gemeente / periode_start / periode_einde`. If `gemeente` / `periode_*` / `confidence` aren't on the factor payload, prop-drill from `ScanResultsResponse` (`scan.gemeente_naam`) and accept the documented Phase 6 gap.

### Click affordance
- Hover state on kaart 10 must indicate clickability without breaking the existing static visual of the other 8 cards. Use `cursor-pointer` + a subtle amber-ring on hover (`hover:ring-2 hover:ring-amber-200/60`). Other 8 cards stay inert in this phase.

### Tests (TEST-04, MUST run via Storybook play-functions — verified test stack)
- `WoonvisiePopup.stories.tsx`: extend with **play-functions** asserting (a) prioriteit label text for at least 2 prioriteit values (Groeigebied + Herstructurering); (b) citaat text content matches a substring of the wijk-specific citaat; (c) segmentmatch sentence is rendered (single `<p>`, NOT chips) — and explicitly assert that chip-classes are ABSENT (negative check).
- `PotentieLayer.stories.tsx` (NEW Wave-0 file): one story rendering PotentieLayer with mock scan flags; play-function clicks kaart 10 and asserts popup opens with expected `wijk_naam`.
- ESC + click-outside dismiss covered in WoonvisiePopup story play-function. **Note:** ESC handler is not currently wired in `WoonvisiePopup.tsx` (only backdrop click dismisses). If the ESC test fails, document as a follow-up todo and downgrade the test to click-outside only — do NOT modify the popup in this phase.

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

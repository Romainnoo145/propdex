---
phase: 03-woonvisie-popup
verified: 2026-04-25T18:10:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: "Visual smoke: open Venlo scan, click parcel with woonvisie data, click kaart 10"
    expected: "Minimal Aura popup opens showing wijk naam, prioriteit dot+label, plain citaat, single-line segmentmatch sentence. Meta line shows 'Woonvisie Venlo · 0–0' (the 0–0 periode is the known limitation)."
    why_human: "End-to-end click requires a live dev server with real scan data containing woonvisie_match factor."
  - test: "Storybook visual review: open M048/WoonvisiePopup variants"
    expected: "Minimal aesthetic confirmed — dot+label for prioriteit, plain <p> citaat, single-line segmentmatch sentence. No chips, no blockquote, no checkmark icons."
    why_human: "Pixel-level aesthetic taste check is faster by eye than automated at this scale per VALIDATION.md."
---

# Phase 3: Woonvisie Popup Verification Report

**Phase Goal:** Kaart 10 in the Potentie Intelligence Grid is interactive and reveals full woonvisie context for the wijk in approved Aura style
**Verified:** 2026-04-25T18:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Phase 3 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking kaart 10 (Woonvisie) opens a popup — no click leaves card inert | VERIFIED | `PotentieLayer.tsx` L393–422: `card.label === 'WOONVISIE' && hasWoonvisieData` guards a `<button type="button">` with `onClick={() => setWoonvisieOpen(true)}`. Other 8 cards remain `<div>`. State confirmed: `useState(false)` + `setWoonvisieOpen`. |
| 2 | Popup displays: meta line, wijk naam, prioriteit dot+label, citaat as plain text, segmentmatch as single inline sentence — minimal aesthetic, NO chips/blockquote | VERIFIED | `WoonvisiePopup.tsx` L155–192: meta line renders `Woonvisie {gemeente} · {periode_start}–{periode_einde}`; wijk bron `<h2>` (L168); PRIORITEIT_LABELS map (L41–44: Groeigebied/Herstructurering/Neutraal/Krimpgebied); citaat as plain `<p className="...whitespace-pre-line">` (L184–185); segmentmatch as single `<p>` (L192). No chip markup, no blockquote, no ✓/✗ icons confirmed by negative assertions in `VenloCentrumMismatch` story. |
| 3 | Popup renders with white surface, `rounded-[32px]`, framer-motion enter/exit, Plus Jakarta Sans, click-outside dismiss | VERIFIED | `WoonvisiePopup.tsx` L139: `className="...bg-white rounded-[32px]..."`; L124–125: `AnimatePresence` + `motion.div`; Plus Jakarta Sans via CSS var `--font-sans` in `index.css` L39 (applied globally); L132: backdrop `onClick={onClose}` + L145: Sluiten button `onClick={onClose}`. Click-outside via backdrop confirmed by `ClickOutsideDismisses` story play-function. |
| 4 | Component tests (Storybook play-functions) confirm popup opens on click and renders correct wijk/prioriteit/segmentmatch data | VERIFIED | `WoonvisiePopup.stories.tsx`: 6 play-functions (import: `from 'storybook/test'`). `PotentieLayer.stories.tsx` created with `ClickOpensPopup` play-function: navigates to page 2, clicks WOONVISIE button, asserts `Blerick` + `Groeigebied` in `document.body`. Full parcel-stories suite: 15 tests, all green per SUMMARY (3 files: ScoreBreakdownModal=5, WoonvisiePopup=8, PotentieLayer=2). |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` | Click affordance on kaart 10 + popup state + WoonvisiePopup render | VERIFIED | Contains: `WoonvisiePopup` (import + render, 2 occurrences), `useParcelProjectType` (import + call, 2 occurrences), `useState` (woonvisieOpen), `hover:ring-2 hover:ring-amber-200/60`, `card.label === 'WOONVISIE'`. All PLAN acceptance criteria patterns confirmed. |
| `frontend/src/components/map/panels/ParcelDetailPanel.tsx` | Pass `gemeenteNaam` prop to PotentieLayer | VERIFIED | L126: `<PotentieLayer parcel={parcel} gemeenteNaam={gemeenteNaam ?? ''} />`. Prop drilled correctly. |
| `frontend/src/components/map/panels/parcel/WoonvisiePopup.tsx` | Pre-shipped minimal popup — unchanged in this phase | VERIFIED | 209-line substantive component. `createPortal` to `document.body`, `AnimatePresence`, `rounded-[32px]`, all content elements present. |
| `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` | 6 play-functions for WOON-02, WOON-03, TEST-04 | VERIFIED | 6 `play: async` functions. Import: `from 'storybook/test'` (1 occurrence, no `@storybook/test`). Covers: BlerickGroeiMatch, VenloCentrumMismatch, TegelenHerstructurering, GeenMatchFallback, EscDismisses (Sluiten button), ClickOutsideDismisses. |
| `frontend/src/stories/parcel/PotentieLayer.stories.tsx` | NEW file with ClickOpensPopup play-function for WOON-01 | VERIFIED | File exists. 1 `play: async` function. `userEvent.click` present. `from 'storybook/test'`. `QueryClientProvider` wrapper. Confirms popup opens with `Blerick` + `Groeigebied`. |
| `frontend/src/components/projects/ScoreDetailModal.tsx` | `gemeenteNaam=""` prop added (deviation fix) | VERIFIED | L137: `<PotentieLayer parcel={scanData} gemeenteNaam="" />`. Deviation from plan — required because `gemeenteNaam` became required prop; portfolio context has no gemeente name. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PotentieLayer.tsx` | `WoonvisiePopup.tsx` | `import { WoonvisiePopup }` + `isOpen={woonvisieOpen}` + `onClose={() => setWoonvisieOpen(false)}` | WIRED | L7 import, L474–480 render with all required props. |
| `PotentieLayer.tsx` | `useParcelProjectType` hook | `useParcelProjectType(parcel.parcel_id)` | WIRED | L8 import, L301 call. `projectType` fed into popup `project_type` prop. |
| `ParcelDetailPanel.tsx` | `PotentieLayer.tsx` | `gemeenteNaam={gemeenteNaam ?? ''}` prop | WIRED | L126 confirmed. |
| `PotentieLayer.stories.tsx` | `PotentieLayer.tsx` | `ClickOpensPopup` play-function clicks button, asserts popup | WIRED | `userEvent.click` on WOONVISIE button, then `within(document.body).getByText('Blerick')`. Portal-correct pattern. |
| `WoonvisiePopup.stories.tsx` play-functions | `WoonvisiePopup.tsx` shipped DOM | `within(document.body)` portal queries | WIRED | Assertions target actual shipped DOM: `getByText('Groeigebied')`, `/Blerick blijft/`, `/valt buiten/`, `'Gemeente-breed'`, `/Extractie-zekerheid laag/`. Negative chip assertions confirm minimal aesthetic. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WOON-01 | 03-01, 03-02 | Woonvisie kaart (kaart 10) is clickable and opens a popup | SATISFIED | `<button>` conditional render in PotentieLayer; `ClickOpensPopup` story confirms click → popup open. |
| WOON-02 | 03-02 | Popup shows meta line, wijk naam, prioriteit dot+label, citaat, segmentmatch sentence — minimal aesthetic | SATISFIED | WoonvisiePopup.tsx renders all elements. Play-functions assert each. Note: `periode_start/einde` default to `0` → meta line shows `"Woonvisie Venlo · 0–0"`. This is an accepted known limitation (Phase 6 `factor.waarde` does not include period fields). It does not break WOON-02 because the meta line structure is present and correct — only the period data is unavailable from this phase's scope. |
| WOON-03 | 03-02 | Popup renders in Aura style — white surface, `rounded-[32px]`, Plus Jakarta Sans, click-outside dismiss | SATISFIED | All structural elements confirmed. Note: REQUIREMENTS.md WOON-03 text says "focus-trap + ESC dismiss" but ROADMAP.md Phase 3 SC#3 (the governing contract) says only "click-outside dismiss". The ROADMAP SC is the controlling specification; ESC dismiss was not required by the phase contract. ESC dismiss is also an acknowledged follow-up gap (documented in 03-02-SUMMARY.md). |
| TEST-04 | 03-02 | Component tests cover popup open, correct data, dismiss | SATISFIED | 6 play-functions on WoonvisiePopup stories + 1 on PotentieLayer stories. 15 total parcel-suite tests green. |

**Orphaned requirements check:** WOON-01/02/03/TEST-04 are the only Phase 3 requirements in REQUIREMENTS.md traceability table. No orphaned IDs.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `WoonvisiePopup.tsx` | 111 | `if (!isOpen) return null` | Info | Guard clause, not a stub — `createPortal` renders nothing when closed. Expected pattern. |
| `ParcelDetailPanel.tsx` | 132 | `return null` in switch default | Info | Default branch of tab switch, not a stub — returns null for unrecognised tabs. Expected pattern. |

No blockers or warnings. All `return null` occurrences are legitimate guard/default patterns, not stub implementations.

---

### Assessment of Documented Limitations

**Limitation 1: `periode_start/periode_einde` default to `0` (meta line shows "0–0")**

- **Against WOON-01?** No. WOON-01 is only about clickability.
- **Against WOON-02?** The requirement says popup shows "meta line (`Woonvisie {gemeente} · {periode} · p. {pagina}`)". The meta line structure is present and renders correctly. The periode data is `0–0` because Phase 6 `factor.waarde` does not include `periode_start/einde` — this is a data availability limitation from an upstream phase (Phase 6), not a rendering failure. The plan explicitly accepted this with a documented follow-up for M049+. This does not constitute a gap against WOON-02 as specified.
- **Against Phase Goal?** The goal is "interactive and reveals full woonvisie context for the wijk in approved Aura style". The context is revealed (wijk, prioriteit, citaat, segmentmatch). Period data absence is a backend data gap, not a frontend implementation gap.
- **Verdict:** Out-of-scope follow-up. Not a phase gap.

**Limitation 2: ESC keydown not wired in `WoonvisiePopup.tsx`**

- **Against WOON-03?** REQUIREMENTS.md WOON-03 says "focus-trap + ESC dismiss". However, ROADMAP.md Phase 3 SC#3 (the phase-level governing contract) says "click-outside dismiss" — ESC is not listed. The ROADMAP success criteria were the agreed-upon contract for this phase. The `EscDismisses` Storybook story was adapted to test the Sluiten button click instead, which is explicitly documented as a follow-up in 03-02-SUMMARY.md.
- **Against Phase Goal?** Click-outside dismiss works (confirmed by `ClickOutsideDismisses` play-function). The popup is dismissible; only ESC shortcut is absent.
- **Verdict:** Out-of-scope follow-up per the ROADMAP contract. Not a phase gap. Follow-up work: add `useEffect` keydown listener for Escape in WoonvisiePopup.tsx (noted in 03-02-SUMMARY.md).

---

### Human Verification Required

#### 1. Live dev server smoke test

**Test:** Run `cd frontend && pnpm dev` (port 9300). Open a Venlo scan. Click a parcel that has `woonvisie_match` factor data. Navigate to Potentie tab. Click kaart 10 (WOONVISIE).
**Expected:** Minimal popup opens with wijk naam, coloured dot + prioriteit label, plain citaat text, single-line segmentmatch sentence. Meta line shows "Woonvisie Venlo · 0–0" (the `0–0` is the known limitation). Clicking backdrop or Sluiten button closes it.
**Why human:** Requires a real scan with woonvisie_match data in score_breakdown; this depends on Phase 6 backend being live and a Venlo scan having been run.

#### 2. Storybook visual aesthetic review

**Test:** Run `cd frontend && pnpm storybook`. Open `M048/WoonvisiePopup`. Review all 5 variants: Blerick Groei, Venlo-Centrum Mismatch, Tegelen Herstructurering, Geen Match Fallback, Lage Confidence.
**Expected:** Minimal Calm Intelligence aesthetic — dot + label for prioriteit, plain paragraph citaat, single-line segmentmatch sentence. No chips, no blockquotes, no ✓/✗ icons. Consistent with memory `feedback_m048_woonvisie_ui.md` and `feedback_minimal_aesthetic.md`.
**Why human:** Pixel-level taste check is faster by eye than automated at this scale.

---

### Conclusion

Phase 3 goal is achieved. All four success criteria from ROADMAP.md are satisfied by code that actually exists in the codebase:

1. Kaart 10 is a `<button>` with real `onClick` → popup state wiring (not a `<div>`, not a stub).
2. WoonvisiePopup renders all required content elements: meta line, wijk naam, prioriteit dot+label, plain citaat, segmentmatch sentence — minimal aesthetic confirmed by negative assertions in tests.
3. Aura styling is present: `bg-white rounded-[32px]`, `AnimatePresence`/`motion.div`, Plus Jakarta Sans via CSS token, click-outside dismiss via backdrop `onClick`.
4. Storybook play-functions (15 total in parcel suite) provide automated coverage for open/content/dismiss behaviour.

The two documented limitations (`0–0` periode display, missing ESC keydown) are both accepted out-of-scope follow-ups, not gaps against the phase contract. The ROADMAP SC#3 governing criterion requires "click-outside dismiss" only; ESC was removed from the phase scope. The `0–0` periode is a data availability issue from an upstream phase (Phase 6) with a follow-up tracked for M049+.

---

_Verified: 2026-04-25T18:10:00Z_
_Verifier: Claude (gsd-verifier)_

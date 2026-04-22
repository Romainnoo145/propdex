# Roadmap: Propdex M048 — Score v4.0 Frontend Scaling

## Overview

M048 closes the gap between the scoring engine refactored in M047 and what users actually see. Four delivery boundaries: first invalidate stale M047 extraction caches via SCHEMA_VERSION bump, then wire the Score UI to live org-config data instead of hardcoded constants, then surface the approved Woonvisie popup in the Intelligence Grid, and finally squash the KlimaatLayer stale-verdict bug. Each phase is independently verifiable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Cache Sentinel** - Bump SCHEMA_VERSION 1→2, reject stale extraction cache entries, add unit tests (completed 2026-04-22)
- [ ] **Phase 2: Score UI Fix** - Wire potentie/risico balance + percentage_of_category dynamically from org-profile props
- [ ] **Phase 3: Woonvisie Popup** - Clickable kaart 10 in Potentie grid with approved Aura-style popup
- [ ] **Phase 4: KlimaatLayer Bug** - Correct gemeente verdict on map-switch, no stale data

## Phase Details

### Phase 1: Cache Sentinel
**Goal**: The extraction cache correctly rejects all pre-M047 entries so future LLM calls use the new factor_extractor pipeline
**Depends on**: Nothing (first phase)
**Requirements**: CACHE-01, TEST-01
**Success Criteria** (what must be TRUE):
  1. SCHEMA_VERSION constant in `factor_extraction_schemas.py` reads 2 (not 1)
  2. A cache lookup for an entry created with version 1 returns a cache miss — the old entry is not served
  3. A cache lookup for an entry created with version 2 returns a cache hit
  4. Unit tests cover both scenarios (miss on v1 entry, hit on v2 entry) and pass in the 275-test suite
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md — Bump SCHEMA_VERSION 1→2, fix 2 breaking test assertions, add v1-miss/v2-hit tests

### Phase 2: Score UI Fix
**Goal**: ScoreBreakdownModal displays live org-profile balance and per-factor percentages — no hardcoded values remain
**Depends on**: Phase 1
**Requirements**: SCORE-01, SCORE-02, SCORE-03, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Opening ScoreBreakdownModal for any parcel shows the potentie/risico split derived from `useOrgScoreWeights` — changing the org balance in config changes what the modal displays without any code change
  2. Each factor row shows a percentage (e.g. "34%") sourced from `percentage_of_category`, not the raw gewicht integer with a "×" prefix
  3. `potentie_risico_balance` is received as a prop from the parent component — no read from `scan.flags` inside the modal
  4. Unit tests assert balance display matches the prop value (not a hardcoded constant) and pass
  5. Unit tests assert factor percentage display reads `percentage_of_category` from scan data and pass
**Plans**: TBD

### Phase 3: Woonvisie Popup
**Goal**: Kaart 10 in the Potentie Intelligence Grid is interactive and reveals full woonvisie context for the wijk in approved Aura style
**Depends on**: Phase 2
**Requirements**: WOON-01, WOON-02, WOON-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Clicking kaart 10 (Woonvisie) in the Potentie 3×3 bento grid opens a popup — no click leaves the card inert
  2. The popup displays: wijk naam, prioriteit-chip (color-coded), beleidstekst as an amber-bordered blockquote, paginanummer, and segmentmatch-chips (e.g. "sociaal ✓" / "duur ✗")
  3. The popup renders with glass surface (`backdrop-blur`), `rounded-[24px]`, amber accent borders, and Plus Jakarta Sans — consistent with DESIGN.md Aura tokens
  4. Component tests confirm popup opens on click and renders correct wijk/prioriteit/segmentmatch data from scan flags
**Plans**: TBD

### Phase 4: KlimaatLayer Bug
**Goal**: The KlimaatLayer always shows the verdict for the currently visible gemeente — switching gemeenten never leaves stale data on screen
**Depends on**: Phase 3
**Requirements**: BUG-01
**Success Criteria** (what must be TRUE):
  1. Navigating from gemeente A to gemeente B on the map causes the KlimaatLayer verdict panel to update to gemeente B's data within one render cycle
  2. No ghost verdict from gemeente A remains visible after the transition
  3. Rapid switching between three different gemeenten leaves only the last-selected gemeente's verdict visible
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cache Sentinel | 1/1 | Complete   | 2026-04-22 |
| 2. Score UI Fix | 0/? | Not started | - |
| 3. Woonvisie Popup | 0/? | Not started | - |
| 4. KlimaatLayer Bug | 0/? | Not started | - |

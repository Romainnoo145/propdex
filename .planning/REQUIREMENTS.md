# Requirements: Propdex M048

**Defined:** 2026-04-22
**Core Value:** From grondpositie to first spade in one cockpit — no switching between 10 tabs

## M048 Requirements

### Cache Infrastructure

- [x] **CACHE-01**: System invalidates M047 extraction cache by bumping SCHEMA_VERSION from 1 to 2 in `backend/app/ai/factor_extraction_schemas.py`

### Score UI

- [ ] **SCORE-01**: ScoreBreakdownModal displays potentie/risico balance dynamically from org-profile (`potentie_risico_balance` prop via `useOrgScoreWeights`) — not hardcoded 60%/40%
- [ ] **SCORE-02**: ScoreBreakdownModal displays `percentage_of_category` (0–100%) per factor instead of raw `×{gewicht}` integer label
- [ ] **SCORE-03**: `potentie_risico_balance` is passed as prop to ScoreBreakdownModal from parent (not read from scan flags)

### Woonvisie Kaart Popup

- [ ] **WOON-01**: Woonvisie kaart (kaart 10 in Potentie Intelligence Grid) is clickable and opens a popup
- [ ] **WOON-02**: Popup shows wijk naam, prioriteit-chip, beleidstekst as amber-bordered blockquote, paginanummer, and segmentmatch-chips (e.g. sociaal ✓ / duur ✗)
- [ ] **WOON-03**: Popup renders in Aura style (glass surface, rounded-[24px], amber accent, Plus Jakarta Sans) consistent with DESIGN.md

### Bug Fixes

- [ ] **BUG-01**: KlimaatLayer shows correct gemeente verdict when user switches between gemeenten on the map (no stale gemeente data shown)

### Tests

- [x] **TEST-01**: Unit tests cover SCHEMA_VERSION bump — old cache entries with version < 2 are rejected
- [ ] **TEST-02**: Unit tests cover ScoreBreakdownModal balance display — percentage reflects `potentie_risico_balance` prop value (not hardcoded)
- [ ] **TEST-03**: Unit tests cover `percentage_of_category` display — factor percentage shown correctly from scan data
- [ ] **TEST-04**: Integration or component tests cover woonvisie popup — opens on click, shows correct wijk/prioriteit/segmentmatch data

## Future Requirements (M049+)

### Score Engine
- Dynamic projecttype-gebonden balance (not just default 0.7) — M050+
- Pruning sparse factoren at runtime — M050+
- Drempel-kalibratie op historische distributie — M058

### Data Sources
- Admin hub voor data-bronnen per gemeente — M049
- BRK / NVM / Vindsubsidies betaalde integraties — M051/M052/M053

### Cascade Expansion
- woondeals factor — M050
- nationale_woonagenda factor — M050
- Juridisch klimaat factor — M050
- Welstand/Parkeer factoren — M054

## Out of Scope

| Feature | Reason |
|---------|--------|
| ScoreBreakdownModal full redesign | Too large for M048; popup is targeted. Full rebuild deferred post-M050 when 15+ factors are live |
| Cascade batch processing (>1 factor) | M050+ after POC proven |
| Ground-truth calibration | M058 — needs external data contracts |
| Mobile layout | Desktop-first by design decision |
| Dark mode | Out of scope — sloopt Aura character |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CACHE-01 | Phase 1 | Complete |
| SCORE-01 | Phase 2 | Pending |
| SCORE-02 | Phase 2 | Pending |
| SCORE-03 | Phase 2 | Pending |
| WOON-01 | Phase 3 | Pending |
| WOON-02 | Phase 3 | Pending |
| WOON-03 | Phase 3 | Pending |
| BUG-01 | Phase 4 | Pending |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 3 | Pending |

**Coverage:**
- M048 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-22 after initial definition*

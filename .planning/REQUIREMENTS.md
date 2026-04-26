# Requirements: Propdex M048

**Defined:** 2026-04-22
**Extended:** 2026-04-24 (office hours — scope expansion, see design doc 20260424-200512)
**Core Value:** From grondpositie to first spade in one cockpit — no switching between 10 tabs

## M048 Requirements

### Cache Infrastructure

- [x] **CACHE-01**: System invalidates M047 extraction cache by bumping SCHEMA_VERSION from 1 to 2 in `backend/app/ai/factor_extraction_schemas.py`
- [x] **CACHE-02**: Document-level factors (woonvisie_match) cache with sentinel `parcel_id="__document__"` — 1 Claude call per document instead of per parcel. SCHEMA_VERSION bump 2→3 invalidates old parcel-keyed entries

### Score UI

- [x] **SCORE-01**: ScoreBreakdownModal displays potentie/risico balance dynamically from org-profile (`potentie_risico_balance` prop via `useOrgScoreWeights`) — not hardcoded 60%/40%
- [x] **SCORE-02**: ScoreBreakdownModal displays `percentage_of_category` (0–100%) per factor instead of raw `×{gewicht}` integer label
- [x] **SCORE-03**: `potentie_risico_balance` is passed as prop to ScoreBreakdownModal from parent (not read from scan flags)
- [x] **SCORE-04**: `score_woonvisie_match()` uses per-wijk `WijkPolicy` (prioriteit + gewenste_segmenten) to produce differentiating scores between parcelen in different wijken van dezelfde gemeente met hetzelfde projecttype

### Woonvisie Kaart Popup

- [x] **WOON-01**: Woonvisie kaart (kaart 10 in Potentie grid) is clickable and opens a popup
- [x] **WOON-02**: Popup shows gemeente · periode · paginanummer (meta line), wijk naam (large title), prioriteit (label + colored dot), beleidstekst (citaat), and a single-line segmentmatch sentence — Minimal Calm Intelligence aesthetic, NO chips/blockquotes (resolved 2026-04-25, aesthetic memory wins)
- [x] **WOON-03**: Popup renders in Aura style — white surface, `rounded-[32px]`, Plus Jakarta Sans, focus-trap + ESC dismiss, consistent with DESIGN.md
- [x] **WOON-04**: `WijkPolicy` pydantic model met velden wijk_naam, prioriteit (groei/krimp/herstructurering/neutraal), gewenste_segmenten (sociaal/midden/duur/gemengd), citaat, pagina
- [x] **WOON-05**: `WoonvisiePayload` uitgebreid met `wijk_policies: list[WijkPolicy]`, `algemeen_citaat: str`, `confidence: float`; SCHEMA_VERSION bump 3→4

### Pin Mechanism + Group Pages (NEW 2026-04-24)

- [x] **PIN-01**: User can pin/unpin individual factoren (Potentie en Risico) met max 4 pins per categorie; 5e pin-poging toont toast "Max 4 bereikt" (cap dropped 6→4 in Plan 07-05 after steady-state factor projection — see STATE.md)
- [x] **PIN-02**: Pins persisteren across browser-refresh en devices via backend-backed `user_factor_pins` tabel met Alembic migratie; unique constraint `(user_id, category, factor_key)`; TenantMixin voor org-isolation
- [x] **PIN-03**: REST API endpoints: `GET /api/user/factor-pins?category=X`, `POST /api/user/factor-pins` (toggle), `DELETE /api/user/factor-pins/:id`; optimistic UI updates via TanStack Query

### Factor Groups + Pagination (NEW 2026-04-24)

- [x] **GROUP-01**: Elke entry in `FACTOR_REGISTRY` heeft een `category` veld (potentie: `gemeente_beleid`/`markt`/`fysiek`/`klimaat`; risico: idem + eventueel `juridisch`/`planologisch`)
- [x] **GROUP-02**: Potentie/Risico tabs tonen 4 cards per page (2x2 grid; cap dropped from 6 in Plan 07-05); page 1 = pinned synth-page met ⭐; page 2+ = 1 groep per page (categorieën met >4 cards spreiden over 2 pages); pinned factoren tonen ⭐ badge op hun groep-page

### UI Consistency (NEW 2026-04-24)

- [x] **UI-01**: Pin-icoon altijd zichtbaar rechtsboven op factor-card (slate-300 outline default, amber fill bij pin — geen hover-only state, mobile-ready); click → optimistic update + POST; unpin werkt vanaf pinned-page en groep-page; beide locaties synchroniseren. Cards met onCardClick krijgen subtiele ArrowRight bottom-right als drill-down affordance.

### Bug Fixes

- [x] **BUG-01**: KlimaatLayer shows correct gemeente verdict when user switches between gemeenten on the map (no stale gemeente data shown)

### Tests

- [x] **TEST-01**: Unit tests cover SCHEMA_VERSION bump — old cache entries with version < 2 are rejected
- [x] **TEST-02**: Unit tests cover ScoreBreakdownModal balance display — percentage reflects `potentie_risico_balance` prop value (not hardcoded)
- [x] **TEST-03**: Unit tests cover `percentage_of_category` display — factor percentage shown correctly from scan data
- [x] **TEST-04**: Integration or component tests cover woonvisie popup — opens on click, shows correct wijk/prioriteit/segmentmatch data
- [x] **TEST-05**: Unit tests cover document-level sentinel cache — 2 scans voor verschillende parcelen tegen dezelfde woonvisie = 1 Claude call; v2→v3 bump invalidateert oude entries
- [x] **TEST-06**: Unit/integration tests cover WijkPolicy schema + scoring — Venlo Blerick vs Venlo-Centrum produceren verschillende woonvisie_match scores met zelfde projecttype
- [x] **TEST-07**: Component tests cover pin flow — pin/unpin, max-6 guard, ⭐ badge rendering, page-navigation met pinned synth-page
- [ ] **TEST-08**: E2E smoke — Venlo woonvisie upload → 2 parcelen scan → 1 Claude call → verschillende scores → popup toont wijk-specifiek citaat → pins persisteren across refresh

## Future Requirements (M049+)

### Score Engine
- Dynamic projecttype-gebonden balance (not just default 0.7) — M050+
- Pruning sparse factoren at runtime — M050+
- Drempel-kalibratie op historische distributie — M058
- Weights Fase 3 (kalibratie drempels) — may land in M049 if not in M048/S01

### Rapport PDF (NEW 2026-04-24)
- Cascade-native rapport redesign — elke cascade-bron krijgt native informatie-weergave (woonvisie = citaten + segmenten, bestemmingsplan = zone + bouwregels, welstandsnota = esthetische normen + fotos) — M049 of M050+

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
| Rapport-PDF redesign (cascade-native) | Too large for M048; each cascade-bron needs native information-type treatment. Eigen milestone (M049+) |
| Cascade batch processing (>1 factor per woonvisie) | M050+ after POC proven |
| Ground-truth calibration | M058 — needs external data contracts |
| Mobile layout | Desktop-first by design decision |
| Dark mode | Out of scope — sloopt Aura character |
| User-pinning via UI config page | Pin/unpin is hover-click on card, no settings page needed |
| Pin-sharing across users in same org | Per-user isolation; org-level pinning = eigen future feature |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CACHE-01 | Phase 1 | Complete |
| CACHE-02 | Phase 5 | Complete |
| SCORE-01 | Phase 2 | Complete |
| SCORE-02 | Phase 2 | Complete |
| SCORE-03 | Phase 2 | Complete |
| SCORE-04 | Phase 6 | Complete |
| WOON-01 | Phase 3 | Complete |
| WOON-02 | Phase 3 | Complete |
| WOON-03 | Phase 3 | Complete |
| WOON-04 | Phase 6 | Complete |
| WOON-05 | Phase 6 | Complete |
| PIN-01 | Phase 7 | Complete |
| PIN-02 | Phase 7 | Complete |
| PIN-03 | Phase 7 | Complete |
| GROUP-01 | Phase 7 | Complete |
| GROUP-02 | Phase 7 | Complete |
| UI-01 | Phase 7 | Complete |
| BUG-01 | Phase 4 | Complete |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 2 | Complete |
| TEST-03 | Phase 2 | Complete |
| TEST-04 | Phase 3 | Complete |
| TEST-05 | Phase 5 | Complete |
| TEST-06 | Phase 6 | Complete |
| TEST-07 | Phase 7 | Complete |
| TEST-08 | Phase 8 | Pending |

**Coverage:**
- M048 requirements: 25 total (12 initial + 13 added 2026-04-24)
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-24 after office hours scope expansion (design doc 20260424-200512)*

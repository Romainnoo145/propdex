# Roadmap: Propdex M048 — Score v4.0 Frontend Scaling

## Overview

M048 closes the gap between the scoring engine refactored in M047 and what users actually see. Scope expanded 2026-04-24 via office hours: beyond the original 4 delivery boundaries (cache version bump, score UI fix, woonvisie popup, klimaat bug), M048 now also introduces per-wijk woonvisie scoring, document-level cache deduplication for cascade factors, and the UI fundament for 30+ factoren (pinning + groep-per-page + 6 cards/page) that M050-M057 cascade batches will land in.

**Source of truth:** `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260424-200512.md` (supersedes 20260422-163755.md).

## Phases

**Phase Numbering:**
- Integer phases (1-8): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Cache Sentinel** — Bump SCHEMA_VERSION 1→2, reject stale extraction cache entries, add unit tests (completed 2026-04-22)
- [x] **Phase 2: Score UI Fix** — Wire potentie/risico balance + percentage_of_category dynamically from org-profile props (completed 2026-04-22)
- [x] **Phase 3: Woonvisie Popup** — Clickable kaart 10 in Potentie grid with approved Aura-style popup (completed 2026-04-25)
- [x] **Phase 4: KlimaatLayer Bug** — Correct gemeente verdict on map-switch, no stale data (completed 2026-04-26)
- [ ] **Phase 5: Document-level cache sentinel (woonvisie)** — `parcel_id="__document__"` sentinel voorkomt 100k Claude-calls per gemeente
- [ ] **Phase 6: WijkPolicy schema + woonvisie scoring upgrade** — per-wijk segment-opdracht voor differentiërende scoring
- [ ] **Phase 7: Factor pinning + groep-pages + 6 cards per page** — UI fundament voor 30+ factoren, pinnable top-6, per-bron groepering
- [ ] **Phase 8: Integration tests + Venlo E2E smoke** — end-to-end verificatie van S01-S04 flow

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
- [x] 01-01-PLAN.md — Bump SCHEMA_VERSION 1→2, fix 2 breaking test assertions, add v1-miss/v2-hit tests

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
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Add potentieRisicoBalance prop to ScoreBreakdownModal, replace hardcoded balance + ×gewicht label
- [x] 02-02-PLAN.md — Create ScoreBreakdownModal.stories.tsx with Storybook play assertions (TEST-02, TEST-03)

### Phase 3: Woonvisie Popup
**Goal**: Kaart 10 in the Potentie Intelligence Grid is interactive and reveals full woonvisie context for the wijk in approved Aura style
**Depends on**: Phase 6 (needs WijkPolicy data in scan flags to render wijk-specific content)
**Requirements**: WOON-01, WOON-02, WOON-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Clicking kaart 10 (Woonvisie) in the Potentie grid opens a popup — no click leaves the card inert
  2. The popup displays: meta line (`Woonvisie {gemeente} · {periode} · p. {pagina}`), wijk naam, prioriteit dot+label, citaat as plain text, and segmentmatch as a single inline sentence — minimal aesthetic, NO chips/blockquote (resolved 2026-04-25)
  3. The popup renders with white surface, `rounded-[32px]`, framer-motion enter/exit, Plus Jakarta Sans, click-outside dismiss — consistent with DESIGN.md Aura tokens
  4. Component tests (Storybook play-functions) confirm popup opens on click and renders correct wijk/prioriteit/segmentmatch data from scan flags
**Plans**: 2 plans (popup-rewrite plan dropped 2026-04-25 — minimal as-built popup wins over chip-spec)

Plans:
- [ ] 03-01-PLAN.md — Wire kaart 10 click in PotentieLayer + drill gemeenteNaam through ParcelDetailPanel
- [ ] 03-02-PLAN.md — Storybook play-function tests (extend WoonvisiePopup.stories.tsx + new PotentieLayer.stories.tsx) asserting minimal-aesthetic DOM

### Phase 4: KlimaatLayer Bug
**Goal**: The KlimaatLayer always shows the verdict for the currently visible gemeente — switching gemeenten never leaves stale data on screen
**Depends on**: Phase 2 (independent from woonvisie pipeline; can run parallel with Phase 5)
**Requirements**: BUG-01
**Success Criteria** (what must be TRUE):
  1. Navigating from gemeente A to gemeente B on the map causes the KlimaatLayer verdict panel to update to gemeente B's data within one render cycle
  2. No ghost verdict from gemeente A remains visible after the transition
  3. Rapid switching between three different gemeenten leaves only the last-selected gemeente's verdict visible
**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md — Add `key={activePanel.code}` to GemeenteContextPanel in map.tsx + Storybook play-function stories pinning SC#1, SC#2, SC#3

### Phase 5: Document-level cache sentinel (woonvisie)
**Goal**: Woonvisie-extractie voor gemeente Venlo (100k+ parcelen) produceert precies 1 Claude-call per woonvisie-document, niet per perceel. Document-level factors slaan cache op met sentinel-key i.p.v. parcel_id
**Depends on**: Phase 2 (can run parallel with Phase 4)
**Requirements**: CACHE-02, TEST-05
**Source**: design doc sectie "Backend: Cache fix woonvisie (S01)"
**Success Criteria** (what must be TRUE):
  1. `cascade_enrichment_service.py` roept `extract_factor()` aan met `parcel_id="__document__"` voor document-level factors (woonvisie_match)
  2. SCHEMA_VERSION bump 2→3 in `factor_extraction_schemas.py` — oude v2 entries return cache-miss
  3. 2 sequentiële scans van verschillende parcelen tegen dezelfde Venlo-woonvisie resulteren in exact 1 Claude-call (meetbaar via logs)
  4. Geen DB migratie vereist (sentinel past in bestaande `String(50)` kolom); unique-constraint blijft correct
  5. Code-comment toegevoegd bij `FactorExtractionCache` model: `# "__document__" sentinel used for document-level factor types`
  6. Unit tests dekken: sentinel-write → sentinel-hit op 2e lookup; v2→v3 bump invalidateert oude entries
**Plans**: 1 plan

Plans:
- [ ] 05-01-PLAN.md — SCHEMA_VERSION 2→3 + DOCUMENT_SENTINEL constant + caller edit in cascade_enrichment_service + unit/integration tests + stale iron-rule fix

### Phase 6: WijkPolicy schema + woonvisie scoring upgrade
**Goal**: Woonvisie-extractie produceert per-wijk beleid (prioriteit + gewenste segmenten + citaat) i.p.v. gemeente-brede platte lijsten. Score_woonvisie_match differentieert tussen percelen in verschillende wijken binnen dezelfde gemeente
**Depends on**: Phase 5 (needs document-level cache working before schema bump)
**Requirements**: WOON-04, WOON-05, SCORE-04, TEST-06
**Source**: design doc sectie "Backend: WijkPolicy + scoring upgrade (S02)"
**Success Criteria** (what must be TRUE):
  1. `WijkPolicy` pydantic model bestaat met velden: `wijk_naam`, `prioriteit` (groei/krimp/herstructurering/neutraal), `gewenste_segmenten` (sociaal/midden/duur/gemengd list), `citaat` (str), `pagina` (int | None)
  2. `WoonvisiePayload` uitgebreid met `wijk_policies: list[WijkPolicy]` + `algemeen_citaat: str` + `confidence: float`
  3. SCHEMA_VERSION bump 3→4 invalideert oude payload-shape entries
  4. `score_woonvisie_match()` zoekt matching `WijkPolicy` via substring-logica (`g in wijk_lower or wijk_lower in g`); bij match: `prioriteit` → basis score (groei=+3, herstructurering=+1.5, krimp=-2.5); `gewenste_segmenten` × projecttype → +2.0 match, -1.0 mismatch
  5. `citaat` beschikbaar in `toelichting_lang` van `FactorResult` zodat Phase 3 popup het kan tonen
  6. Venlo-smoke: perceel in Blerick (groei + sociaal-wijk) scoort anders dan perceel in Venlo-Centrum (neutraal) met hetzelfde projecttype
  7. Pre-existing 275 tests groen na schema wijziging
**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — Wave-0 test stubs (3 new test files + version-agnostic SCHEMA_VERSION + v3→v4 cache-miss stub)
- [ ] 06-02-PLAN.md — WijkPolicy + WoonvisiePayload extension + new _INPUT_SCHEMA + prompt + SCHEMA_VERSION 3→4
- [ ] 06-03-PLAN.md — score_woonvisie_match rewrite + _normalize_wijk helper + _PRIORITEIT_SCORE_DELTA
- [ ] 06-04-PLAN.md — Integration test rewrite + Venlo-smoke + full-suite phase gate + frontend audit

### Phase 7: Factor pinning + groep-pages + 6 cards per page
**Goal**: ParcelDetailModal Potentie/Risico tabs schalen naar 30+ factoren zonder UI-werk per cascade-milestone. User kan top-6 pinnen (persistent), factoren gegroepeerd per bron over pages, 6 cards per page
**Depends on**: Phase 6 (needs `category` metadata in FACTOR_REGISTRY om groepen af te leiden)
**Requirements**: PIN-01, PIN-02, PIN-03, GROUP-01, GROUP-02, UI-01, TEST-07
**Source**: design doc sectie "Frontend: Pin-mechanisme + group-per-page (S04)"
**Success Criteria** (what must be TRUE):
  1. Elke entry in `FACTOR_REGISTRY` heeft een `category` veld (enum: `gemeente_beleid`, `markt`, `fysiek`, `klimaat`, eventueel `juridisch`/`planologisch` voor Risico)
  2. `user_factor_pins` tabel bestaat met kolommen `(id, organization_id, user_id, category, factor_key, position, created_at)` + unique constraint `(user_id, category, factor_key)`; Alembic migratie in deze phase
  3. REST endpoints: `GET /api/user/factor-pins?category=potentie` → list; `POST /api/user/factor-pins` → toggle; `DELETE /api/user/factor-pins/:id` → remove
  4. `CARDS_PER_PAGE` constant = 6 in `PotentieLayer.tsx` + `RisicoLayer.tsx`
  5. Page 1 toont pinned factoren (synthetisch); page 2+ toont factoren gegroepeerd per `category` (1 groep per page)
  6. Pinned kaartjes verschijnen op page 1 én in hun eigen groep-page met ⭐ badge
  7. Hover op kaart → pin-icoon rechtsboven; click → optimistic update + POST; unpin werkt vanaf beide locaties
  8. Max 6 pins per categorie; 7e pin-poging toont toast "max 6 bereikt"
  9. Pins persisteren across browser-refresh en devices (backend-backed)
  10. Multi-tenant: user van org A ziet geen pins van user in org B (TenantMixin filter)
  11. Component tests dekken: pin/unpin flow, max-6 guard, ⭐ badge rendering, page-navigation met pinned synth-page
**Plans**: 5 plans

Plans:
- [ ] 07-01-PLAN.md — Wave-0 test stubs (4 backend pytest stubs + factor-pins mock helper + 8 PotentieLayer + 3 RisicoLayer story stubs + VALIDATION.md update)
- [ ] 07-02-PLAN.md — Backend: UserFactorPin model + Alembic migration y0_m048_s04 + factor_pins router (GET/POST/DELETE under /api/users/me/factor-pins) + multi-tenant isolation + max-6 guard
- [ ] 07-03-PLAN.md — Foundations: bron field on FACTOR_REGISTRY (22 entries) + frontend lib/factor-groups.ts (Bron + buildPages) + useFactorPins hook (optimistic + max-6 toast)
- [ ] 07-04-PLAN.md — Layer refactor: shared FactorCard.tsx (tone variant + pin-star UI) + PotentieLayer + RisicoLayer to 6-cards/page + pinned synth-page + group pages
- [ ] 07-05-PLAN.md — Story battery + visual sign-off (full Storybook + backend regression + user checkpoint)

### Phase 8: Integration tests + Venlo E2E smoke
**Goal**: End-to-end verificatie dat Phase 5+6+3+7 samen correct werken voor Venlo woonvisie: upload → scan → cache-dedup → score-diff tussen wijken → UI rendering met pinning + citation popup
**Depends on**: Phase 7 (last)
**Requirements**: TEST-08
**Source**: design doc sectie "Success Criteria" aggregaat
**Success Criteria** (what must be TRUE):
  1. E2E test: upload Venlo woonvisie PDF → 2 parcelen scannen (1 in Blerick, 1 in Venlo-Centrum) → assert 1 Claude-call voor woonvisie_match factor (cache-dedup werkt)
  2. E2E test: dezelfde 2 parcelen produceren verschillende `woonvisie_match` scores (wijk-differentiatie werkt)
  3. E2E test: ParcelDetailModal voor Blerick-perceel → klik Potentie tab → klik Woonvisie kaartje → popup toont Blerick-citaat (niet gemeente-breed)
  4. E2E test: user pint 3 factoren → refresh browser → pins blijven staan; navigate naar ander perceel → pins blijven zichtbaar op page 1
  5. Alle 275 pre-existing tests groen; nieuwe test-count > 290 (min 15 nieuwe tests over Phase 5-7)
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → (5 ∥ 4) → (6 ∥ 3) → 7 → 8

Reflecteert design doc parallelisme: **S01 ∥ S05 → S02 ∥ S03 → S04 → S06**
waar S01=P5, S02=P6, S03=P3, S04=P7, S05=P4, S06=P8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cache Sentinel | 1/1 | Complete | 2026-04-22 |
| 2. Score UI Fix | 2/2 | Complete | 2026-04-22 |
| 3. Woonvisie Popup | 2/2 | Complete   | 2026-04-25 |
| 4. KlimaatLayer Bug | 1/1 | Complete   | 2026-04-26 |
| 5. Document-level cache sentinel | 0/? | Not started | - |
| 6. WijkPolicy schema + scoring | 0/4 | Not started | - |
| 7. Factor pinning + groep-pages | 0/5 | Not started | - |
| 8. Integration tests + Venlo E2E | 0/? | Not started | - |

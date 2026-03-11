# Propdex -- Roadmap

## Milestones

- [ ] **v16.0 Score Intelligence** -- Phases 99-101
- [ ] **v15.0 Aura** -- Phases 91-93 done, 103 done, 94-97 reskin batch, 104-106 features
- ✅ **v14.0 Fysiek Risicoprofiel** -- Phases 87-90 (shipped 2026-03-10)
- ✅ **v13.0 Juridisch Klimaat Intelligence** -- Phases 82-86 (shipped 2026-03-09)
- ✅ **v12.0 Omgevings- & Leefbaarheids-Scorer** -- Phases 78-80 (shipped 2026-03-07)
- ✅ **v11.0 Open Data Intelligence** -- Phases 75-77 (shipped 2026-03-07)
- ✅ **v10.0 UX Polish** -- Phases 72-74 (shipped 2026-03-03)
- ✅ **v9.0 Risk Intelligence** -- Phases 67-69 (shipped 2026-03-02)
- ✅ **v8.0 Client Demo Readiness** -- Phases 62-66 (shipped 2026-03-02)
- ✅ **v7.2 Developer Dossier Intelligence** -- Phases 59-61 (shipped 2026-02-27)
- ✅ **v7.1 Workspace Productization** -- Phase 58 (shipped 2026-02-27)
- ✅ **v7.05 Codebase Globalization** -- Phase 57 (shipped 2026-02-26)
- ✅ **v7.0 Deep Property Data** -- Phases 52-56 (shipped 2026-02-25)
- ✅ **v6.0 Meldingen Intelligence** -- Phases 47-51 (shipped 2026-02-23)
- ✅ **v5.1 Data Presentation Overhaul** -- Phases 42-46 (shipped 2026-02-22)
- ✅ **v5.0 Scan Intelligence** -- Phases 37-41 (shipped 2026-02-20)
- ✅ **v4.0 UX Redesign** -- Phases 27-36 (shipped 2026-02-18)
- ✅ **v3.1 Smart Area Intelligence** -- Phases 22-26 (shipped 2026-02-15)
- ✅ **v3.0 Spatial Foundation** -- Phases 18-21 (shipped 2026-02-11)
- ✅ **v2.0 Frontend** -- Phases 13-17 (shipped 2026-02-09)
- ✅ **v1.1 Production Hardening** -- Phases 6-12 (shipped 2026-02-08)
- ✅ **v1.0 Core Intelligence Engine** -- Phases 1-5 (shipped 2026-02-07)

---

## Execution Order

```
NOW:   106 Dossier Upload       → backend file storage + upload UI in Dossiers tab
NEXT:  104 Rapport v2.0       → rapport op pre-cached data + score narratieven
THEN:  105 BRK Eigendom       → eigendomsmodal met on-demand BRK fetch
LATER: 94-97 Aura Reskin      → cosmetische updates overige pagina's (lage prio)
```

---

## Phases

### v16.0 Score Intelligence (Phases 99-101.1)

- [x] **Phase 99: Scan Pipeline Enrichment** - 10 data sources pre-cached in scan pipeline (completed 2026-03-10)
- [x] **Phase 100: Score v3.0 Engine** - Dual-subscore model: Potentie (8 factoren) + Risico (9 factoren) + narratieven (completed 2026-03-11)
- [x] **Phase 101: Score Backfill & Migration** - Re-score all existing parcels with v3.0, migrate score_breakdown schema (completed 2026-03-11)
- [x] **Phase 101.1: Enrichment Backfill Venlo** - Backfill all 10 Phase 99 data sources for 137k Venlo parcels + re-score with enriched data (INSERTED) (completed 2026-03-11)

### v15.0 Aura

#### Done
- [x] **Phase 91: Aura Design System Foundation** - Tokens, font, glass primitives (completed 2026-03-09)
- [x] **Phase 92: Viewport Layout & Navigation** - Floating map, Plus Jakarta Sans, SideRailNav, split command center (completed 2026-03-10)
- [x] **Phase 93: Parcel Detail Panel** - LEFT-side floating panel, satellite hero, bento pods, Potentie/Risico/Dossiers tabs (completed 2026-03-11)
- [x] **Phase 103: Potentie & Risico Dashboard** - 3x3 card grids with verdict hero, pagination, v3.0/v2.1 compat (completed 2026-03-11)

#### Feature Phases (in order)
- [x] **Phase 106: Perceel Dossier Upload** - Per-parcel document storage: parcel_documents table, PostgreSQL LargeBinary, upload/download/delete endpoints, upload buttons in Dossiers tab. 5 dossier categories (Acquisitie, Technisch, Planologisch, Juridisch, Projectnotities) (completed 2026-03-11)
- [x] **Phase 104: Rapport v2.0** - Rapport rewrite as pure template render on pre-cached scan data + score narratieven, no on-demand API calls. Depends on Phase 101
- [ ] **Phase 105: BRK Eigendom Modal** - On-demand BRK ownership fetch in modal (no caching, Kadaster compliance) (completed 2026-03-11)

#### Aura Reskin Batch (low priority, cosmetic only)
- [ ] **Phase 94: Wijk & Gemeente Views** - Aura treatment for wijk/gemeente panels
- [ ] **Phase 95: Results Table** - /resultaten Aura reskin preserving TanStack Table
- [ ] **Phase 96: Jurisprudentie & Meldingen** - Wizard, explorer, feed in Aura style
- [ ] **Phase 97: Settings** - Settings page Aura update

---

## Phase Details

### Phase 101: Score Backfill & Migration
**Goal**: Re-score all existing parcels with v3.0 engine so the new Potentie/Risico dashboards show real data
**Depends on**: Phase 100
**Success Criteria**:
  1. Backfill tool re-scores all parcels in all completed scans
  2. Tile endpoints serve potentie_score + risico_score
  3. Old v2.1 score_breakdown gracefully handled (backwards compatible)
**Plans**: 2 plans

Plans:
- [ ] 101-01-PLAN.md — v3.0 score backfill CLI tool
- [ ] 101-02-PLAN.md — API + tile proxy v3.0 score serving

### Phase 101.1: Enrichment Backfill Venlo (INSERTED)

**Goal:** Backfill all 10 Phase 99 enrichment data sources for every parcel in Venlo, then re-score with v3.0 engine so Potentie/Risico dashboards show real enriched data
**Depends on:** Phase 101
**Success Criteria**:
  1. CLI backfill tool fetches coordinate-based data (Natura2000, overstromingsrisico, geluid, luchtkwaliteit) for all 137k parcel_cache rows with geometry
  2. CLI backfill tool fetches address-based data (EP-Online, WOZ, bekendmakingen, funderingsrisico) for all ~51k parcels with address
  3. Enrichment data merged into scan_results.flags JSONB (not parcel_cache.enrichment_data)
  4. Re-score all scan_results with v3.0 engine using enriched data — risk factors no longer blind
  5. Rate limiting / deduplication to avoid hammering external APIs (50m coordinate dedup, postcode dedup)
**Plans**: 1 plan

Plans:
- [ ] 101.1-01-PLAN.md — Enrichment backfill CLI tool + re-score

### Phase 106: Perceel Dossier Upload
**Goal**: Vastgoedontwikkelaars can upload and manage documents per parcel in the Dossiers tab
**Depends on**: Phase 93 (Dossiers tab UI exists)
**Requirements:** [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05]
**Success Criteria**:
  1. `parcel_documents` table with parcel_id, org_id, document_type, filename, file_data (LargeBinary), uploaded_at
  2. Upload endpoint (POST) with PostgreSQL LargeBinary storage (matching PDFDocument pattern)
  3. Download/preview endpoint (GET) with streaming Response
  4. Each Dossiers tab card shows upload button + uploaded document status
  5. Multi-tenant isolation: documents scoped to organization_id
**Plans**: 2 plans

Plans:
- [ ] 106-01-PLAN.md — Backend model, migration, CRUD endpoints
- [ ] 106-02-PLAN.md — Frontend types, hooks, BronnenLayer upload UI

### Phase 104: Rapport v2.0
**Goal**: Rapport generation uses pre-cached scan data + score v3.0 narratieven — no on-demand API calls
**Depends on**: Phase 101
**Success Criteria**:
  1. "Genereer Rapport" assembles from pre-cached scan data (no external API calls)
  2. Report includes potentie_score + risico_score with per-factor breakdown
  3. Report includes factor toelichting_lang narratieven as "Analyse" chapter
  4. BRK ownership on-demand (Kadaster compliance) — only exception
**Plans**: TBD

### Phase 105: BRK Eigendom Modal
**Goal**: On-demand BRK ownership data in a modal on the parcel detail panel
**Depends on**: Phase 93
**Success Criteria**:
  1. Button on parcel detail opens eigendom modal
  2. Modal fetches BRK ownership on-demand (no caching)
  3. Displays eigenaar, zakelijk gerechtigden, erfpacht/eigendom type
**Plans**: TBD

### Phase 94: Wijk & Gemeente Views (Aura Reskin)
**Goal**: Aura styling for wijk/gemeente panels — existing functionality preserved
**Depends on**: Phase 91
**Plans**: TBD

### Phase 95: Results Table (Aura Reskin)
**Goal**: /resultaten route in Aura style, TanStack Table unchanged
**Depends on**: Phase 91
**Plans**: TBD

### Phase 96: Jurisprudentie & Meldingen (Aura Reskin)
**Goal**: Wizard, explorer, meldingen feed in Aura style
**Depends on**: Phase 91
**Plans**: TBD

### Phase 97: Settings (Aura Reskin)
**Goal**: Settings page Aura styling
**Depends on**: Phase 91
**Plans**: TBD

---

## Progress

### v16.0 Score Intelligence

| Phase | Status | Completed |
|-------|--------|-----------|
| 99. Scan Pipeline Enrichment | Complete | 2026-03-10 |
| 100. Score v3.0 Engine | Complete | 2026-03-11 |
| 101. Score Backfill & Migration | Complete | 2026-03-11 |
| 101.1. Enrichment Backfill Venlo | Complete | 2026-03-11 |

### v15.0 Aura

| Phase | Status | Completed |
|-------|--------|-----------|
| 91. Design System Foundation | Complete | 2026-03-09 |
| 92. Viewport Layout & Nav | Complete | 2026-03-10 |
| 93. Parcel Detail Panel + Tabs | Complete | 2026-03-11 |
| 103. Potentie & Risico Dashboard | Complete | 2026-03-11 |
| 106. Dossier Upload | 2/2 | Complete    | 2026-03-11 | 104. Rapport v2.0 | Complete | 2026-03-11 |
| 105. BRK Eigendom Modal | Planned | - |
| 94. Wijk & Gemeente Reskin | Backlog | - |
| 95. Results Table Reskin | Backlog | - |
| 96. Jurisprudentie Reskin | Backlog | - |
| 97. Settings Reskin | Backlog | - |

---

<details>
<summary>✅ v14.0 Fysiek Risicoprofiel (Phases 87-90) -- SHIPPED 2026-03-10</summary>

- [x] Phase 87: Soil Data Integration (1/1 plan) -- BRO Bodemkaart WMS + PDOK Funderingsrisico WFS
- [x] Phase 88: Foundation Risk Engine (1/1 plan) -- bouwjaar x bodemtype heuristic, KCAF cost ranges
- [x] Phase 89: Asbestos v2 Refinement (1/1 plan) -- gebruiksdoel-aware additive uplift
- [x] Phase 90: Frontend Fysiek Risicoprofiel (2/2 plans) -- risk section + map tile overlay

**5 plans, 10 requirements**
**Archive:** `.planning/milestones/v14.0-ROADMAP.md`

</details>

<details>
<summary>✅ v13.0 Juridisch Klimaat Intelligence (Phases 82-86) -- SHIPPED 2026-03-09</summary>

- [x] Phase 82: Ruling Cache + ECLI Court Mapping (2/2 plans)
- [x] Phase 83: Geo-Contextualization + Gemeente Feed (2/2 plans)
- [x] Phase 84: AI Analysis Upgrade + Doorlooptijd (2/2 plans)
- [x] Phase 85: Explorer UI (2/2 plans)
- [x] Phase 86: Trend & Statistics (2/2 plans)

**10 plans, 5 phases**

</details>

<details>
<summary>✅ v12.0 and earlier -- see milestone archives</summary>

- ✅ v12.0 Omgevings- & Leefbaarheids-Scorer (78-80) shipped 2026-03-07
- ✅ v11.0 Open Data Intelligence (75-77) shipped 2026-03-07
- ✅ v10.0 UX Polish (72-74) shipped 2026-03-03
- ✅ v9.0 Risk Intelligence (67-69) shipped 2026-03-02
- ✅ v8.0 Client Demo Readiness (62-66) shipped 2026-03-02
- ✅ v7.2 Developer Dossier Intelligence (59-61) shipped 2026-02-27
- ✅ v7.1 Workspace Productization (58) shipped 2026-02-27
- ✅ v7.05 Codebase Globalization (57) shipped 2026-02-26
- ✅ v7.0 Deep Property Data (52-56) shipped 2026-02-25
- ✅ v6.0 Meldingen Intelligence (47-51) shipped 2026-02-23
- ✅ v5.1 Data Presentation Overhaul (42-46) shipped 2026-02-22
- ✅ v5.0 Scan Intelligence (37-41) shipped 2026-02-20
- ✅ v4.0 UX Redesign (27-36) shipped 2026-02-18
- ✅ v3.1 Smart Area Intelligence (22-26) shipped 2026-02-15
- ✅ v3.0 Spatial Foundation (18-21) shipped 2026-02-11
- ✅ v2.0 Frontend (13-17) shipped 2026-02-09
- ✅ v1.1 Production Hardening (6-12) shipped 2026-02-08
- ✅ v1.0 Core Intelligence Engine (1-5) shipped 2026-02-07

</details>

---

*Last updated: 2026-03-11 -- Phase 106 planned: 2 plans, 2 waves*

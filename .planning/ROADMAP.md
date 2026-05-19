# Roadmap: Propdex M050 — BRK Lookup-Wedge

## Overview

M050 levert de research/lookup-helft van Propdex's "Onderzoek → Actie" funnel: BRK Eigendom als eerste paid Type-C integration met persistent storage + retention-policy, 3 nieuwe BRK-driven scoring-factoren, een nieuwe opgeslagen-cockpit met lifecycle-sidebar, en een dedicated lifecycle-fase 2 (Contact) als BRK-home.

**Originele scope was "BRK Actiefase-Wedge"** — inclusief brief-send pipeline (templates + AI + PostNL + branding + tier-gates). Tijdens M050-execution shipte alleen de lookup-helft. De brief-send actie-helft is op 2026-05-19 losgekoppeld en als afzonderlijke M051 milestone gedefinieerd. Zie `.planning/vM050-MILESTONE-AUDIT.md` voor het audit-rapport dat de split triggerde.

**Source of truth:**
- `.planning/milestones/M050-INDEX.md` (origineel hub-doc — vermeldt zowel lookup als brief-send; lookup-helft is hier shipped)
- `.planning/milestones/M050-ENG-PLAN.md` (6 architectuur-decisions D1-D6 — BRK-helft D1-D5 toegepast in M050; D6 streaming + D7 partner-review zijn M051-territory)
- `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` (Q6/Q7/Q8 LOCKED — Q7 retention shipped; Q6/Q8 zijn M051)
- `~/.gstack/projects/Romainnoo145-propdex/ceo-plans/2026-05-17-m050-brk-actiefase.md` (origineel SELECTIVE EXPANSION CEO-plan)

**Karakter:** Eerste paid Type-C integration. Vereist Kadaster verwerkersovereenkomst (4-8 wk legal-track parallel) — production-pad gated tot DPA signed. Loopt parallel met M050.5 (tier-gating + quota-infra).

**Phase / Slice naming:** GSD-CLI gebruikt integer phase-numbers. In commits + conversatie gebruiken we Propdex slice-aliassen (S01, S02, S03, S06 + S06-cont). Phase 8 ≡ M050/S06-cont (BRK Fase-2 Wire-up).

**Parallel milestone:** M050.5 (`.planning/milestones/M050.5-ROADMAP.md`) levert tier-decorator + quota-counter — relevant voor M051 brief-send Phase 5 tier-gates.

**Successor:** M051 (`.planning/milestones/M051-ROADMAP.md`) — brief-send actiefase pipeline.

## Phases

- [x] **Phase 1: BRK Datamodel + Retention** (S01) — `brk_ownership_records` + Alembic migratie + retention-life-cycle (30 dgn soft → 90 dgn hard) + ARQ cleanup-cron
- [x] **Phase 2: BRK Persist Client** (S02) — Phase 105 ephemeral lookup wrappen tot persist-mode, met M049 credential-resolver
- [x] **Phase 3: Scoring-Factoren Cascade** (S03) — 3 nieuwe factoren live in score_v3_factors registry + rescore_cascade_job trigger op BRK-write
- [x] **Phase 6: Opgeslagen-Cockpit + Lifecycle Sidebar** (S06) — Bestaande opgeslagen-tab transformeert tot stappenplan-cockpit: full-width perceel-cards (+ perceel-image thumbnail) + sidebar transformeert van toplevel-icons naar 4-8 lifecycle-icons (1. Onderzoek t/m 6. Exploitatie)
- [x] **Phase 8: BRK Fase-2 Wire-up** (M050/S06 cont.) — Verplaats BRK persist-CTA van fase 1 (Onderzoek) naar fase 2 (Contact); nieuw `GET /api/parcels/{id}/brk` endpoint; render 3 BRK factoren in RisicoLayer na rescore; split 1922-LOC FavoriteParcelWorkspaceView in ≤300-LOC componenten

## Phase Details

### Phase 1: BRK Datamodel + Retention (S01)
**Goal:** Persistent BRK-storage met AVG-compliant retention-life-cycle (Q7 LOCKED) en automatische soft→hard delete cleanup.

**Requirements:** BRK-01, BRK-02, BRK-03, TEST-01

**Eng-review beslissingen locked-in 2026-05-17:**
- `brk_ownership_records` schema: `eigenaar_naam=NULL` voor privé-personen (rechtspersoon-only persistent); Phase 105 ephemeral-pad blijft voor privé-lookups
- Retention: `fetched_at + 30 dgn` = soft_deleted_at trigger bij unfavorite; `+ 60 dgn extra` = hard_delete_after
- ARQ cron `brk_retention_cleanup_job` daily, hard-delete waar `hard_delete_after < NOW()`

**Success criteria:**
1. Alembic migratie creëert `brk_ownership_records` + `idx_brk_org_parcel` + partial `idx_brk_hard_delete` waar soft_deleted_at NOT NULL
2. Unfavorite-actie zet `soft_deleted_at = NOW()` + `hard_delete_after = NOW() + 90 dgn`; re-favorite vóór hard-delete opheft soft-delete zonder nieuwe BRK-call
3. ARQ cron-job hard-delete bewezen via fast-forward test (mock clock)
4. Privé-eigendom-response slaat `eigenaar_naam=NULL` op; rechtspersoon-data persist compleet

**Depends on:** Nothing

**Status:** Complete (passed 9/9 must-haves) — VERIFICATION.md in `.planning/phases/01-brk-datamodel-retention/`

---

### Phase 2: BRK Persist Client (S02)
**Goal:** BRK API-calls landen in `brk_ownership_records` met M049-credential-resolver, en hergebruik bestaande Phase 105 client voor ephemeral fallback.

**Requirements:** BRK-04, BRK-05, TEST-02

**Success criteria:**
1. `brk_persistence_service.fetch_or_use_persisted(parcel_id, org_id, choice)` retourneert cached row binnen retention-window zonder nieuwe Kadaster-call
2. Credentials resolved via M049 `IntegrationCredential` (source_key='brk') — geen hardcoded API-keys
3. Failure-modes (Kadaster 5xx / 429 / credential-expired) gemapt naar user-facing errors per ENG-PLAN failure-modes registry

**Depends on:** Phase 1 (datamodel)

**Status:** Complete (passed 25/25 must-haves) — VERIFICATION.md in `.planning/phases/02-brk-fetch-persist-endpoint/`

---

### Phase 3: Scoring-Factoren Cascade (S03)
**Goal:** 3 nieuwe BRK-driven factoren live in score-v3 engine, met rescore-cascade trigger op BRK-write.

**Requirements:** SCOR-01, SCOR-02, SCOR-03, TEST-03

**Success criteria:**
1. Factoren `hypotheek_risico`, `eigendoms_complexiteit`, `koopwaarde_trend` geregistreerd in `score_v3_factors.py` met conditional weights per projecttype
2. BRK-write triggert `rescore_cascade_job(parcel_id)`; frontend React Query refetch toont nieuwe scores binnen 60s
3. Sparse-data fallback: parcels zonder BRK-coverage krijgen `silent_neutral` (niet 0) — voorkomt artificial-low-scoring
4. Bestaande 16 score-v3 factoren ongewijzigd (REGRESSION-CRITICAL)

**Depends on:** Phase 2 (BRK persist)

**Status:** Complete (passed 4/4 backend must-haves; 1 human-verification item — frontend refetch ≤60s deferred to manual QA, non-blocking) — VERIFICATION.md in `.planning/phases/03-scoring-factoren-cascade/`

---

### Phase 6: Opgeslagen-Cockpit + Lifecycle Sidebar (S06)
**Goal:** Opgeslagen-tab transformeert van bestaand grid naar full-width perceel-cards stappenplan-cockpit + sidebar verschuift van toplevel-icons naar 4-8 lifecycle-icons.

**Requirements:** UX-01, UX-02, UX-03, UX-04, UX-05

**Design-review V5 wireframe (LOCKED 2026-05-17):**
- /opgeslagen blijft bestaand layout met FULL-WIDTH perceel-cards (+ perceel-image thumbnail)
- Click → bestaande perceel-detail page (geen nieuwe modal)
- Linker sidebar TRANSFORMEERT: toplevel-icons → 4-8 lifecycle-icons (1. Onderzoek t/m 6. Exploitatie)
- "1. Onderzoek" = bestaande detail-page content + BRK-persistent
- Sidebar-design-polish + exacte lifecycle-icon-keuze deferred naar implementatie

**Pre-start check:** M048-coordination (pin-mechanism + groep-pages mogen niet breken)

**Success criteria:**
1. Opgeslagen-tab toont full-width perceel-cards met BAG-thumbnail; geen layout-regression op pin-mechanism
2. Sidebar transformatie: lifecycle-icons rendered met active-state per perceel-fase
3. Click op card opent bestaande perceel-detail page; "Onderzoek"-tab toont scan-data
4. Aura-tokens consistent: Morning Mist canvas, Pure Glass cards, Plus Jakarta Sans
5. prefers-reduced-motion fallback respected; `will-change:transform` op floating-panels

**Depends on:** Phase 2 (BRK-data)

**Status:** Complete (passed 5/5 must-haves; modified door Phase 8 split — parity-pinned via regression test) — VERIFICATION.md in `.planning/phases/06-opgeslagen-cockpit-lifecycle-sidebar/`

---

### Phase 8: BRK Fase-2 Wire-up (M050/S06 cont.)
**Goal:** Activeer lifecycle-fase 2 (Contact) als BRK-home. Verplaats BRK persist-CTA van fase 1 (Onderzoek) naar fase 2, voeg nieuwe `GET /api/parcels/{id}/brk` read-endpoint toe, render 3 BRK risico-factoren in RisicoLayer na rescore, en split de 1922-LOC `FavoriteParcelWorkspaceView.tsx` in ≤300-LOC componenten conform CLAUDE.md regel.

**Requirements:** UX-06, UX-07, UX-08, WIRE-04, WIRE-05, TEST-09

**Eng-plan (LOCKED 2026-05-19):** `.planning/milestones/M050-S06-ENG-PLAN.md`

**Architectuur-decisions (AD1–AD6):**
- AD1: BRK volledig naar lifecycle-fase 2. Fase 1 verliest BRK-CTA, krijgt "Stap door naar Contact" copy. Geen score-drempel — fase-overgang IS de gate.
- AD2: Nieuw `GET /api/parcels/{id}/brk` endpoint hydreert fase-2 op page-load.
- AD3: Polling 2s × 30 ticks (60s window) met inline banner "Onderzoeksscore wordt bijgewerkt…" → succes-link terug naar fase 1.
- AD4: Empty BRK response (alleen natuurlijk-persoon) → "Particuliere eigenaar" infoblok met AVG-uitleg + outreach-suggestie.
- AD5: Split `FavoriteParcelWorkspaceView.tsx` (1922 LOC) in 6 componenten ≤300 LOC.
- AD6: `ContactPhaseView.tsx` als top-level fase-2 component, 4 sub-componenten voor BRK display.

**Success criteria:**
1. `GET /api/parcels/{id}/brk` endpoint live met org-filter + soft-delete-filter; cross-org returns [] (geen leak van bestaan)
2. Lifecycle-fase 2 (`2-contact`) enabled in `phases.ts`; navigate vanaf fase-1 AANPAK-card naar `/opgeslagen/perceel/{id}/2-contact` werkt
3. BRK persist-CTA in fase 2: success-path + 7 typed error-states + empty-response UX (AD4)
4. Rescore-polling banner: voltooid binnen 60s window OF timeout-message
5. RisicoLayer toont 3 nieuwe factor-cards (hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend) na BRK persist
6. `FavoriteParcelWorkspaceView.tsx` gesplitst in ≥5 files, alle ≤300 LOC, feature-parity met pre-split (5 dossier-tabs + scores + upload)
7. REGRESSION: Phase 105 ephemeral BRK-modal werkt; LifecycleSideRailNav scope-rule blijft `/opgeslagen/perceel/$parcelId/*` only; 25 score-factoren unchanged (drift-detector pinned)

**Depends on:** Phase 3 (BRK factoren live), Phase 6 (cockpit shell + sidebar live)

**Status:** Complete (passed 7/7 must-haves) — VERIFICATION.md in `.planning/phases/08-brk-fase-2-wire-up/`

---

## Moved to M051 (Brief-Send Pipeline)

The following phases were originally part of M050 BRK Actiefase-Wedge but were never planned or executed. On 2026-05-19, after milestone audit revealed 23/45 unsatisfied requirements, they were re-scoped as M051 — Brief-Send Pipeline (see `.planning/milestones/M051-ROADMAP.md`).

- ~~**Phase 4: Brief-Template Registry + Preview** (S04)~~ → M051 Phase 1
- ~~**Phase 4.5: AI Brief-Personalisatie** (S04.5)~~ → M051 Phase 2
- ~~**Phase 5: PostNL Dispatch + Delivery** (S05)~~ → M051 Phase 3
- ~~**Phase 5.5: Partner-Branding Admin** (S05.5)~~ → M051 Phase 4
- ~~**Phase 7: End-to-End Wiring + Tier-Gates** (S07)~~ → M051 Phase 5

Requirements that moved: BRIEF-01..03, AI-01..04, POST-01..05, BRAND-01..03, WIRE-01..03, TEST-04..08 (23 total).

## Out of Scope (deferred per CEO-review — still valid)

- **S08 Admin-UX quota-monitoring** → DEFER M052 (E7 accepted). Interim: CLI-script + Postgres-query-snippets in `.planning/M050-OPS-RUNBOOK.md`
- **Multi-channel outreach** (email/WhatsApp/SMS/LinkedIn) → M053+
- **Reply-tracking inbound mail** → M053
- **A/B-test brieven** → M054+
- **Per-tenant feature-flag toggle** (DB-driven) → premature
- **Redis-cached quota-counter** → premature (atomic-UPDATE schaalt prima)

---

*Last updated: 2026-05-19 — Milestone split: 5 brief-send phases re-scoped to M051. Lookup-helft alle 5 phases (1, 2, 3, 6, 8) complete + verified. Audit-rapport in `.planning/vM050-MILESTONE-AUDIT.md`.*

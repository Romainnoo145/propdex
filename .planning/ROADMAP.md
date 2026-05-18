# Roadmap: Propdex M050 — BRK Actiefase-Wedge

## Overview

M050 is een product-mode-shift van **onderzoekstool → actietool**: eerste brug van research-platform naar een drie-fase-funnel (Onderzoek → Actie → CRM). Concreet betekent dit (a) BRK Eigendom als eerste paid integration met persistent storage + retention-policy, (b) 3 nieuwe scoring-factoren (`hypotheek_risico`, `eigendoms_complexiteit`, `koopwaarde_trend`), (c) brief-naar-eigenaar feature met AI-personalisatie + PostNL dispatch, en (d) een nieuwe opgeslagen-tab cockpit met lifecycle-sidebar.

**Source of truth:**
- `.planning/milestones/M050-INDEX.md` (hub-doc)
- `.planning/milestones/M050-ENG-PLAN.md` (6 architectuur-decisions D1-D6 + datamodel + slice-volgorde)
- `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` (Q6/Q7/Q8 locked)
- `~/.gstack/projects/Romainnoo145-propdex/ceo-plans/2026-05-17-m050-brk-actiefase.md` (SELECTIVE EXPANSION)

**Karakter:** Eerste paid Type-C integration. Vereist Kadaster verwerkersovereenkomst (4-8 wk legal-track parallel) + PostNL Zakelijk master-account-onboarding. Loopt parallel met M050.5 (tier-gating + quota-infra).

**Phase / Slice naming:** GSD-CLI gebruikt integer phase-numbers (1-9). In commits + conversatie gebruiken we Propdex slice-aliassen (S01..S07 + decimal S04.5/S05.5). Phase 1 ≡ S01, etc.

**Parallel milestone:** M050.5 (`.planning/milestones/M050.5-ROADMAP.md`) levert tier-decorator + quota-counter. M050.5/S02 moet landen vóór M050/S07 tier-gates kan wiren.

## Phases

- [ ] **Phase 1: BRK Datamodel + Retention** (S01) — `brk_ownership_records` + Alembic migratie + retention-life-cycle (30 dgn soft → 90 dgn hard) + ARQ cleanup-cron
- [ ] **Phase 2: BRK Persist Client** (S02) — Phase 105 ephemeral lookup wrappen tot persist-mode, met M049 credential-resolver
- [ ] **Phase 3: Scoring-Factoren Cascade** (S03) — 3 nieuwe factoren live in score_v3_factors registry + rescore_cascade_job trigger op BRK-write
- [ ] **Phase 4: Brief-Template Registry + Preview** (S04) — 3 templates (cold-outreach / follow-up / verkenning) + variabele-substitutie + brief-preview met perceel-context
- [ ] **Phase 4.5: AI Brief-Personalisatie** (S04.5) — Claude streaming + Pydantic-schema (BriefPersonalizationInput) + `escape_for_prompt` safety + `ai_generation_audit` log + partner-review verplicht
- [ ] **Phase 5: PostNL Dispatch + Delivery** (S05) — PostNL Zakelijk client + async ARQ verzend-job + delivery-tracking webhooks (idempotent via external_event_id) + partner-branding-injection (logo/voettekst/font per org)
- [ ] **Phase 5.5: Partner-Branding Admin** (S05.5) — Admin-UX branding-upload in M049-hub-stijl (logo/voettekst/lettertype/bedrijfsnaam-op-envelop)
- [ ] **Phase 6: Opgeslagen-Cockpit + Lifecycle Sidebar** (S06) — Bestaande opgeslagen-tab transformeert tot stappenplan-cockpit: full-width perceel-cards (+ perceel-image thumbnail) + sidebar transformeert van toplevel-icons naar 4-8 lifecycle-icons (1. Onderzoek t/m 6. Exploitatie)
- [ ] **Phase 7: End-to-End Wiring + Tier-Gates** (S07) — Integration tests + tier-gate decorators (depends op M050.5/S02) + feature-flag triad (M050_BACKEND/FRONTEND/M050_5_TIER_ENFORCEMENT) + AVG-audit trail verificatie

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

**Plans:** 3 plans
- [ ] 01-01-PLAN.md — Alembic migration + SQLAlchemy model BrkOwnershipRecord + register in models/__init__ (Wave 1)
- [ ] 01-02-PLAN.md — Feature flag + Pydantic schemas + brk_persistence_service (D2 strip / D3 soft-delete / D4 FF / D8 NULL-reject) + ARQ retention cron + favorites_service D3 hook (Wave 2)
- [ ] 01-03-PLAN.md — Unit + integration + multi-tenant + regression tests (24 GAPS + 2 IRON-RULE regressions, including Phase 105 ephemeral untouched + favorites flow resilient) (Wave 3)

---

### Phase 2: BRK Persist Client (S02)
**Goal:** BRK API-calls landen in `brk_ownership_records` met M049-credential-resolver, en hergebruik bestaande Phase 105 client voor ephemeral fallback.

**Requirements:** BRK-04, BRK-05, TEST-02

**Success criteria:**
1. `brk_persistence_service.fetch_or_use_persisted(parcel_id, org_id, choice)` retourneert cached row binnen retention-window zonder nieuwe Kadaster-call
2. Credentials resolved via M049 `IntegrationCredential` (source_key='brk') — geen hardcoded API-keys
3. Failure-modes (Kadaster 5xx / 429 / credential-expired) gemapt naar user-facing errors per ENG-PLAN failure-modes registry

**Depends on:** Phase 1 (datamodel)

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

---

### Phase 4: Brief-Template Registry + Preview (S04)
**Goal:** 3 brief-templates met variabele-substitutie + perceel-context-preview vóór AI-personalisatie.

**Requirements:** BRIEF-01, BRIEF-02, BRIEF-03, TEST-04

**Success criteria:**
1. Templates `cold-outreach`, `follow-up`, `verkenning` rendered met variabele-fill (eigenaar-aanhef, perceel-adres, project-context)
2. Brief-preview toont perceel-foto (BAG) + key-facts naast template; partner ziet wat eindgebruiker krijgt
3. `brief_messages` tabel met `draft_idempotency_key` voorkomt dubbele submits (UQ-constraint)

**Depends on:** Phase 1 (datamodel context)

---

### Phase 4.5: AI Brief-Personalisatie (S04.5)
**Goal:** Claude-streaming personaliseert brief-template met partner-review-verplichting; alle outputs audit-logged.

**Requirements:** AI-01, AI-02, AI-03, AI-04, TEST-05

**Eng-review beslissingen (D1, D6, D7):**
- Pydantic-schema `BriefPersonalizationInput` (D1) — typed-only, geen freeform-prompt
- `app/ai/safety.py::escape_for_prompt()` voor adversarial input mitigation
- `ai_generation_audit` tabel logt input_hash + ai_output_raw + partner_edited_output + refused-flag
- Streaming via Anthropic SDK + FastAPI `StreamingResponse` (D6) voor first-token <2s UX
- Klant-review-step verplicht (D7) — geen direct-send pad

**Success criteria:**
1. AI-output streaming start <2s, full completion <15s; tokens-as-they-arrive in frontend (typewriter effect)
2. Eigenaar-naam altijd escaped via `escape_for_prompt`; adversarial-prompt-injection eval-set scoort 100% safe
3. Audit-log compleet: every generation row capture-bare (input_hash + output + model + refused + duration_ms)
4. Refusal-pad: Claude refuses → fallback naar standaard-template + banner; geen silent-failure
5. Partner edit + Approve verplicht vóór `POST /briefs/{id}/send`

**Depends on:** Phase 4 (template + preview)

---

### Phase 5: PostNL Dispatch + Delivery (S05)
**Goal:** Approved briefs gaan via PostNL Zakelijk master-account, met partner-branding-injection en idempotent delivery-tracking.

**Requirements:** POST-01, POST-02, POST-03, POST-04, BRAND-01, TEST-06

**Eng-review beslissingen (D2, D3, Q6 LOCKED):**
- Atomic UPDATE quota (`WHERE count < limit RETURNING`) bij brief-send (D2) — voorkomt race-condition
- Webhook idempotency via `brief_delivery_events.external_event_id` UQ + `ON CONFLICT DO NOTHING` (D3)
- Master-account-model (Q6) — Propdex tekent één PostNL contract, sender-naam dynamisch per partner-branding
- SPOF accepted v1 (D6 CEO-decision) — geen graceful-degrade PostNL outage in v1

**Success criteria:**
1. `POST /briefs/{id}/send` enqueue'd `postnl_dispatch_job` binnen 500ms (atomic-quota-update + INSERT)
2. ARQ-job genereert PDF (template + partner-branding + AI-content) + verstuurt via PostNL API; status="sent" + `postnl_message_id` opgeslagen
3. Webhook `POST /webhooks/postnl` idempotent: duplicate event → 200 zonder dubbele state-update
4. Retry-pattern: PostNL 5xx → ARQ retry 3x exp-backoff; permanent 4xx → status="failed" + alert
5. Out-of-order events handled via `occurred_at` ordering

**Depends on:** Phase 4 (brief-content), Phase 4.5 (AI-output of standaard-template)

---

### Phase 5.5: Partner-Branding Admin (S05.5)
**Goal:** Partner uploadt logo/voettekst/font/bedrijfsnaam in M049-hub-stijl; injection in Phase 5 PDF-build.

**Requirements:** BRAND-02, BRAND-03, TEST-07

**Success criteria:**
1. Admin-UX in M049-data-bronnen-hub: nieuwe sectie "Partner-branding" met upload/preview
2. `partner_branding` tabel UNIQUE per organization_id (één branding per org)
3. Logo-upload valideert <1MB + correct file-type; fout → "Logo te groot/wrong type"
4. Phase 5 PDF-build leest `partner_branding.bedrijfsnaam_op_envelop` voor PostNL sender-identity

**Depends on:** Phase 5 (consumer)

---

### Phase 6: Opgeslagen-Cockpit + Lifecycle Sidebar (S06)
**Goal:** Opgeslagen-tab transformeert van bestaand grid naar full-width perceel-cards stappenplan-cockpit + sidebar verschuift van toplevel-icons naar 4-8 lifecycle-icons.

**Requirements:** UX-01, UX-02, UX-03, UX-04, UX-05

**Design-review V5 wireframe (LOCKED 2026-05-17):**
- /opgeslagen blijft bestaand layout met FULL-WIDTH perceel-cards (+ perceel-image thumbnail)
- Click → bestaande perceel-detail page (geen nieuwe modal)
- Linker sidebar TRANSFORMEERT: toplevel-icons → 4-8 lifecycle-icons (1. Onderzoek t/m 6. Exploitatie)
- "1. Onderzoek" = bestaande detail-page content + M050 brief-sturen + BRK-persistent
- Sidebar-design-polish + exacte lifecycle-icon-keuze deferred naar implementatie

**Pre-start check:** M048-coordination (pin-mechanism + groep-pages mogen niet breken)

**Success criteria:**
1. Opgeslagen-tab toont full-width perceel-cards met BAG-thumbnail; geen layout-regression op pin-mechanism
2. Sidebar transformatie: lifecycle-icons rendered met active-state per perceel-fase
3. Click op card opent bestaande perceel-detail page; "Onderzoek"-tab toont scan-data + brief-feature
4. Aura-tokens consistent: Morning Mist canvas, Pure Glass cards, Plus Jakarta Sans
5. prefers-reduced-motion fallback respected; `will-change:transform` op floating-panels

**Depends on:** Phase 2 (BRK-data), Phase 5 (brief-status), Phase 5.5 (partner-branding voor preview)

**Plans:** 4/5 plans executed
- [ ] 06-01-PLAN.md — Lifecycle phases data module + LifecycleSideRailNav component + Storybook story (Wave 1)
- [ ] 06-02-PLAN.md — Conditional route-prefix sidebar swap in _authenticated.tsx (Wave 2)
- [ ] 06-03-PLAN.md — OpgeslagenPage refactor: single-column full-width cards + BAG-thumbnail + extract SavedParcelCard/PipelineStagePill (Wave 1)
- [ ] 06-04-PLAN.md — Nested route /opgeslagen/perceel/$parcelId + phase placeholders + sidebar active-phase derivation (Wave 3)
- [ ] 06-05-PLAN.md — Aura audit + M048 regression smoke + reduced-motion verification (Wave 4)

---

### Phase 7: End-to-End Wiring + Tier-Gates (S07)
**Goal:** Alle slices gewired, tier-gates ingebakken, feature-flag-triad clean toggle, AVG-audit-trail verifieerd.

**Requirements:** WIRE-01, WIRE-02, WIRE-03, TEST-08

**Eng-review beslissingen (D4, D5):**
- Env-flag triad: `M050_BACKEND_ENABLED`, `M050_FRONTEND_ENABLED`, `M050_5_TIER_ENFORCEMENT_ENABLED` (D4)
- Sync BRK-call + DB-write, async rescore via existing `rescore_cascade_job.py` (D5)

**Success criteria:**
1. Tier-gate decorators op `/parcels/{id}/brk-lookup` + `/briefs/{id}/send` — Demo→403, Paid→25/5 quota, Enterprise→250/50
2. Feature-flag triad clean toggle: backend off → 404, frontend off → cockpit shows scan-mode-only, tier-enforcement off → unlimited (dev-mode)
3. E2E happy-path: opgeslagen → BRK → scoring-refresh → brief-template → AI-personalize → partner-approve → PostNL → webhook → delivered (alle stappen <13 wk realistisch)
4. AVG-audit: SAR-procedure documented, right-to-erasure override soft-delete bewezen, sub-processor-chain documented in verwerkersovereenkomst-template
5. Regression-suite: Phase 105 ephemeral BRK-modal + bestaande 16 score-v3 factoren + rescore_cascade_job (non-BRK triggers) — alle groen

**Depends on:** Phase 1-6, M050.5/S02 (quota-counter)

---

## Out of Scope (deferred per CEO-review)

- **S08 Admin-UX quota-monitoring** → DEFER M052 (E7 accepted). Interim: CLI-script + Postgres-query-snippets in `.planning/M050-OPS-RUNBOOK.md`
- **Graceful-degrade PostNL outage PDF-fallback** → D6 SPOF accepted v1, M051+ als trigger
- **Multi-channel outreach** (email/WhatsApp/SMS/LinkedIn) → M053+
- **Reply-tracking inbound mail** → M053
- **A/B-test brieven** → M054+
- **Per-tenant feature-flag toggle** (DB-driven) → premature
- **Redis-cached quota-counter** → premature (atomic-UPDATE schaalt prima)

## Worktree Parallelization (per ENG-PLAN)

7 lanes (A-G). Phase 1 (week 1-3): Lanes A (M050.5) + B (BRK) + C (Brief+AI) parallel in worktrees. Phase 2 (week 4-7): D (PostNL) na C-merge, E (Cockpit) na B+D-merge. Phase 3 (week 8-11): F wires. Phase 4 (week 11-13): G verification + GA-prep.

---

*Last updated: 2026-05-18 — Phase 1 (M050/S01) plan-phase output landed (3 plans, 3 waves)*

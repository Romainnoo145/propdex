# Roadmap: Propdex M051 — Brief-Send Pipeline

## Overview

M051 is de actiefase-helft van het originele M050 Actiefase-Wedge concept. Tijdens M050-execution shipte alleen de BRK lookup-helft (datamodel + persist + scoring + cockpit + fase-2). Het brief-send-deel — templates + AI-personalisatie + PostNL dispatch + partner-branding + tier-gates — was nooit gepland en wordt hier als afzonderlijke milestone neergezet. Zie `.planning/vM050-MILESTONE-AUDIT.md` voor de splitsing.

**Core value:** Eigenaar-outreach pipeline — partner kiest template → AI personaliseert per perceel-context → partner-review → PostNL dispatch → delivery-tracking. Sluit aan op M050's BRK lookup als data-source.

**Source of truth (geërfd van M050):**
- `.planning/milestones/M050-INDEX.md` (origineel hub-doc, definieerde brief-pipeline scope)
- `.planning/milestones/M050-ENG-PLAN.md` (origineel architectuur-decisions D1-D6 + datamodel — brief-half nog relevant)
- `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` (Q6/Q7/Q8 LOCKED — Q6 PostNL master-account model + Q8 tier-quota nog relevant)

**Karakter:** Vereist PostNL Zakelijk master-account-onboarding (legal-track, ~4 wk lead-time) + AI-safety eval-suite + tier-gate infrastructure (depends op M050.5/S02 quota-counter). Multi-week effort.

**Depends on (M050 — already shipped):**
- BRK-data beschikbaar via `GET /api/parcels/{id}/brk` (M050 Phase 8)
- Cockpit + lifecycle sidebar shell (M050 Phase 6)
- BRK risico-scoring beschikbaar (M050 Phase 3) — brief-content kan score-context refereren

**Phase / Slice naming:** Phases zijn hernummerd van origineel M050 (4 / 4.5 / 5 / 5.5 / 7) naar M051 (1 / 2 / 3 / 4 / 5) voor clean GSD usage.

## Phases

- [ ] **Phase 1: Brief-Template Registry + Preview** (M051/S01, was M050/S04) — 3 templates (cold-outreach / follow-up / verkenning) + variabele-substitutie + brief-preview met perceel-context
- [ ] **Phase 2: AI Brief-Personalisatie** (M051/S02, was M050/S04.5) — Claude streaming + Pydantic-schema (BriefPersonalizationInput) + `escape_for_prompt` safety + `ai_generation_audit` log + partner-review verplicht
- [ ] **Phase 3: PostNL Dispatch + Delivery** (M051/S03, was M050/S05) — PostNL Zakelijk client + async ARQ verzend-job + delivery-tracking webhooks (idempotent via external_event_id) + partner-branding-injection
- [ ] **Phase 4: Partner-Branding Admin** (M051/S04, was M050/S05.5) — Admin-UX branding-upload in M049-hub-stijl (logo/voettekst/lettertype/bedrijfsnaam-op-envelop)
- [ ] **Phase 5: End-to-End Wiring + Tier-Gates** (M051/S05, was M050/S07) — Integration tests + tier-gate decorators (depends op M050.5/S02) + feature-flag triad (M051_BACKEND/FRONTEND/M050_5_TIER_ENFORCEMENT) + AVG-audit trail verificatie

## Phase Details

### Phase 1: Brief-Template Registry + Preview (M051/S01)
**Goal:** 3 brief-templates met variabele-substitutie + perceel-context-preview vóór AI-personalisatie.

**Requirements:** BRIEF-01, BRIEF-02, BRIEF-03, TEST-04

**Success criteria:**
1. Templates `cold-outreach`, `follow-up`, `verkenning` rendered met variabele-fill (eigenaar-aanhef, perceel-adres, project-context)
2. Brief-preview toont perceel-foto (BAG) + key-facts naast template; partner ziet wat eindgebruiker krijgt
3. `brief_messages` tabel met `draft_idempotency_key` voorkomt dubbele submits (UQ-constraint)

**Depends on:** M050 Phase 1 (BRK datamodel voor perceel-context join), M050 Phase 8 (GET /brk endpoint)

---

### Phase 2: AI Brief-Personalisatie (M051/S02)
**Goal:** Claude-streaming personaliseert brief-template met partner-review-verplichting; alle outputs audit-logged.

**Requirements:** AI-01, AI-02, AI-03, AI-04, TEST-05

**Eng-review beslissingen (D1, D6, D7 — M050-ENG-PLAN):**
- Pydantic-schema `BriefPersonalizationInput` (D1) — typed-only, geen freeform-prompt
- `app/ai/safety.py::escape_for_prompt()` voor adversarial input mitigation
- `ai_generation_audit` tabel logt input_hash + ai_output_raw + partner_edited_output + refused-flag
- Streaming via Anthropic SDK + FastAPI `StreamingResponse` (D6) voor first-token <2s UX
- Partner-review-step verplicht (D7) — geen direct-send pad

**Success criteria:**
1. AI-output streaming start <2s, full completion <15s; tokens-as-they-arrive in frontend (typewriter effect)
2. Eigenaar-naam altijd escaped via `escape_for_prompt`; adversarial-prompt-injection eval-set scoort 100% safe
3. Audit-log compleet: every generation row capture-bare (input_hash + output + model + refused + duration_ms)
4. Refusal-pad: Claude refuses → fallback naar standaard-template + banner; geen silent-failure
5. Partner edit + Approve verplicht vóór `POST /briefs/{id}/send`

**Depends on:** Phase 1 (template + preview)

---

### Phase 3: PostNL Dispatch + Delivery (M051/S03)
**Goal:** Approved briefs gaan via PostNL Zakelijk master-account, met partner-branding-injection en idempotent delivery-tracking.

**Requirements:** POST-01, POST-02, POST-03, POST-04, POST-05, BRAND-01, TEST-06

**Eng-review beslissingen (D2, D3, Q6 LOCKED — M050-ENG-PLAN):**
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

**Depends on:** Phase 1 (brief-content), Phase 2 (AI-output of standaard-template), Phase 4 (partner-branding voor sender-identity)

---

### Phase 4: Partner-Branding Admin (M051/S04)
**Goal:** Partner uploadt logo/voettekst/font/bedrijfsnaam in M049-hub-stijl; injection in Phase 3 PDF-build.

**Requirements:** BRAND-02, BRAND-03, TEST-07

**Success criteria:**
1. Admin-UX in M049-data-bronnen-hub: nieuwe sectie "Partner-branding" met upload/preview
2. `partner_branding` tabel UNIQUE per organization_id (één branding per org)
3. Logo-upload valideert <1MB + correct file-type; fout → "Logo te groot/wrong type"
4. Phase 3 PDF-build leest `partner_branding.bedrijfsnaam_op_envelop` voor PostNL sender-identity

**Depends on:** Phase 3 (consumer of branding)

---

### Phase 5: End-to-End Wiring + Tier-Gates (M051/S05)
**Goal:** Alle brief-send slices gewired, tier-gates ingebakken, feature-flag-triad clean toggle, AVG-audit-trail verifieerd.

**Requirements:** WIRE-01, WIRE-02, WIRE-03, TEST-08

**Eng-review beslissingen (D4, D5 — M050-ENG-PLAN):**
- Env-flag triad: `M051_BACKEND_ENABLED`, `M051_FRONTEND_ENABLED`, `M050_5_TIER_ENFORCEMENT_ENABLED` (D4)
- Sync brief-send API + DB-write, async PostNL via existing ARQ infra (D5)

**Success criteria:**
1. Tier-gate decorators op `/parcels/{id}/brk-lookup` + `/briefs/{id}/send` — Demo→403, Paid→25/5 quota, Enterprise→250/50
2. Feature-flag triad clean toggle: backend off → 404, frontend off → cockpit shows BRK-only-mode (zonder brief-CTA), tier-enforcement off → unlimited (dev-mode)
3. E2E happy-path: opgeslagen → BRK (M050) → scoring-refresh (M050) → brief-template → AI-personalize → partner-approve → PostNL → webhook → delivered
4. AVG-audit: SAR-procedure documented, right-to-erasure override soft-delete bewezen, sub-processor-chain documented in verwerkersovereenkomst-template
5. Regression-suite: M050 BRK lookup pipeline ongewijzigd, M050 Phase 105 ephemeral BRK-modal werkt, bestaande scoring (16 + 3 BRK = 19 factoren actief; M050's 25-factor pin blijft groen)

**Depends on:** Phase 1-4, M050.5/S02 (quota-counter)

---

## Out of Scope (deferred per M050 CEO-review)

- **S08 Admin-UX quota-monitoring** → DEFER M052 (E7 accepted). Interim: CLI-script + Postgres-query-snippets in `.planning/M050-OPS-RUNBOOK.md`
- **Graceful-degrade PostNL outage PDF-fallback** → D6 SPOF accepted v1, M052+ als trigger
- **Multi-channel outreach** (email/WhatsApp/SMS/LinkedIn) → M053+
- **Reply-tracking inbound mail** → M053
- **A/B-test brieven** → M054+

---

*Created: 2026-05-19 — Split from M050 audit (`vM050-MILESTONE-AUDIT.md`). Original M050 ENG-PLAN brief-half decisions remain authoritative for D1-D7 architectuur — phases renumbered for clean GSD usage.*

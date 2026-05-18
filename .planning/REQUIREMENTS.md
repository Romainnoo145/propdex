# Requirements: Propdex M050 — BRK Actiefase-Wedge

**Defined:** 2026-05-17
**Core Value:** Onderzoek → Actie funnel — actiegericht werken kan pas als vooronderzoek klopt; M050 levert beide in één cockpit.

**Source of truth:** `.planning/milestones/M050-INDEX.md` (hub) · `.planning/milestones/M050-ENG-PLAN.md` (architectuur) · `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` (Q6/Q7/Q8 LOCKED)

## M050 Requirements

### BRK Persistence & Retention

- [x] **BRK-01**: `brk_ownership_records` SQLAlchemy model met velden per ENG-PLAN datamodel (organization_id, parcel_id, eigenaar_type, eigenaar_naam NULL-voor-privé, kvk_nummer, statutaire_zetel, zakelijk_recht_type, aandeel, koopsom, koopjaar, heeft_hypotheek, raw_brk_response JSONB, fetched_at, soft_deleted_at, hard_delete_after). UNIQUE op (organization_id, parcel_id, fetched_at). TenantMixin via organization_id-FK.
- [x] **BRK-02**: Alembic migratie + indices (`idx_brk_org_parcel`, partial `idx_brk_hard_delete` WHERE soft_deleted_at IS NOT NULL).
- [x] **BRK-03**: ARQ cron-job `brk_retention_cleanup_job` daily — hard-delete rows waar `hard_delete_after < NOW()`. Soft-delete trigger op unfavorite-actie (`+30 dgn soft → +60 dgn extra hard`).
- [x] **BRK-04**: `brk_persistence_service.fetch_or_use_persisted(parcel_id, org_id, choice)` — cached row binnen retention-window zonder nieuwe Kadaster-call; M049 credential-resolver (`IntegrationCredential` source_key='brk').
- [ ] **BRK-05**: Failure-modes per ENG-PLAN registry: Kadaster 5xx/429/credential-expired → user-facing errors + log.

### Scoring Factor Cascade

- [ ] **SCOR-01**: 3 nieuwe factoren in `score_v3_factors.py` registry: `hypotheek_risico`, `eigendoms_complexiteit`, `koopwaarde_trend` met conditional weights per projecttype.
- [ ] **SCOR-02**: BRK-write triggert `rescore_cascade_job(parcel_id)` async; frontend React Query refetch toont nieuwe scores binnen 60s.
- [ ] **SCOR-03**: Sparse-data fallback: parcels zonder BRK-coverage → `silent_neutral` (niet 0). Bestaande 16 score-v3 factoren ongewijzigd (REGRESSION-CRITICAL).

### Brief Templates

- [ ] **BRIEF-01**: `brief_messages` tabel + `brief_template_service` registry met 3 templates (cold-outreach / follow-up / verkenning) + variabele-substitutie (eigenaar-aanhef, perceel-adres, project-context).
- [ ] **BRIEF-02**: Brief-preview UI toont perceel-foto (BAG) + key-facts naast template; partner ziet wat eindgebruiker krijgt vóór AI-step.
- [ ] **BRIEF-03**: `draft_idempotency_key` UQ-constraint voorkomt dubbele submits.

### AI Brief Personalization

- [ ] **AI-01**: Pydantic-schema `BriefPersonalizationInput` (D1) — typed-only structured input, geen freeform-prompt; output validation.
- [ ] **AI-02**: `app/ai/safety.py::escape_for_prompt()` voor adversarial input mitigation; eigenaar-naam altijd escaped.
- [ ] **AI-03**: Claude streaming via Anthropic SDK + FastAPI `StreamingResponse` (D6) — first-token <2s, full <15s, typewriter UX.
- [ ] **AI-04**: `ai_generation_audit` tabel logt input_hash + ai_output_raw + partner_edited_output + refused-flag + duration_ms. Partner-review-step verplicht (D7) — geen direct-send pad.

### PostNL Delivery

- [ ] **POST-01**: `postnl_client.py` PostNL Zakelijk API client (master-account model per Q6 LOCKED); sender-identity dynamic per partner-branding.
- [ ] **POST-02**: ARQ `postnl_dispatch_job` async — PDF-build (template + branding + content) + PostNL API send + status="sent" + `postnl_message_id`.
- [ ] **POST-03**: Atomic UPDATE quota (D2) bij brief-send `WHERE count < limit RETURNING` — voorkomt race-condition tussen concurrent sends.
- [ ] **POST-04**: Webhook `POST /webhooks/postnl` idempotent via `brief_delivery_events.external_event_id` UQ + `ON CONFLICT DO NOTHING` (D3). Out-of-order events handled via `occurred_at` ordering.
- [ ] **POST-05**: Retry-pattern: PostNL 5xx → ARQ retry 3x exp-backoff; permanent 4xx → status="failed" + alert.

### Partner Branding

- [ ] **BRAND-01**: `partner_branding` tabel UNIQUE per organization_id (logo_url, voettekst, lettertype, bedrijfsnaam_op_envelop NOT NULL, contactpersoon_naam, contactpersoon_functie).
- [ ] **BRAND-02**: Admin-UX branding-upload in M049-data-bronnen-hub-stijl; logo-upload valideert <1MB + correct file-type.
- [ ] **BRAND-03**: Phase 5 PDF-build leest `partner_branding.bedrijfsnaam_op_envelop` voor PostNL sender-identity.

### Opgeslagen Cockpit + Sidebar (S06)

- [x] **UX-01**: Opgeslagen-tab transformeert naar full-width perceel-cards met BAG-thumbnail (geen layout-regression op M048 pin-mechanism + groep-pages).
- [x] **UX-02**: Linker sidebar transformeert van toplevel-icons naar 4-8 lifecycle-icons (1. Onderzoek t/m 6. Exploitatie); active-state per perceel-fase.
- [x] **UX-03**: Click op card opent bestaande perceel-detail page; "1. Onderzoek"-tab toont scan-data + M050 brief-feature + BRK-persistent.
- [x] **UX-04**: Aura-tokens consistent: Morning Mist canvas, Pure Glass cards, Plus Jakarta Sans, Warm Amber accent.
- [x] **UX-05**: `prefers-reduced-motion` fallback respected; `will-change:transform` op floating-panels.

### End-to-End Wiring + Tier-Gates

- [ ] **WIRE-01**: Tier-gate decorators op `/parcels/{id}/brk-lookup` + `/briefs/{id}/send` — Demo 0/0, Paid 25/5, Enterprise 250/50 quota (Q8 LOCKED). Soft 80% warning, hard 100% block.
- [ ] **WIRE-02**: Env-flag triad: `M050_BACKEND_ENABLED`, `M050_FRONTEND_ENABLED`, `M050_5_TIER_ENFORCEMENT_ENABLED` (D4) — clean toggle.
- [ ] **WIRE-03**: AVG-audit-trail: SAR-procedure documented, right-to-erasure override soft-delete bewezen, sub-processor-chain in verwerkersovereenkomst-template.

### Testing

- [x] **TEST-01**: Backend unit tests voor BRK datamodel + retention-trigger + ARQ cleanup-job (fast-forward clock mock).
- [ ] **TEST-02**: Integration tests voor `brk_persistence_service` + credential-resolver + failure-modes.
- [ ] **TEST-03**: Backend tests voor 3 nieuwe scoring-factoren + cascade-trigger + sparse-data fallback. REGRESSION-CRITICAL op bestaande 16 factoren + non-BRK rescore-triggers.
- [ ] **TEST-04**: Brief-template variabele-substitutie + idempotency-key UQ + preview-render.
- [ ] **TEST-05**: AI eval-suite: prompt-injection adversarial cases (100% safe vereist), refusal-fallback, audit-log roundtrip.
- [ ] **TEST-06**: PostNL happy + retry + permanent-fail + webhook idempotency (duplicate event → 200, geen state-update).
- [ ] **TEST-07**: Partner-branding CRUD + asset-validation (logo size/type).
- [ ] **TEST-08**: E2E multi-tenant isolation (CRITICAL): cross-org BRK + brief access → 404 (niet 403, voorkomt leak van bestaan). Quota soft+hard cap. Monthly reset cron. Tier-gate enforcement triad off/on.

## Future Requirements

Deferred to later milestones:

### Admin UX
- **ADMIN-01**: Quota-monitoring admin-dashboard met soft/hard-cap warnings + upsell-CTA — M052
- **ADMIN-02**: AI-eval-set admin-UI voor hallucination-monitoring — M052+

### Multi-Channel Outreach
- **OUT-01**: Email-versie van brief (verzending via SendGrid/AWS SES) — M053+
- **OUT-02**: WhatsApp/SMS/LinkedIn outreach-kanalen — M053+
- **OUT-03**: Reply-tracking inbound mail — M053+

### Brief-Optimization
- **BRIEF-FUT-01**: A/B-test brieven met response-tracking — M054+
- **BRIEF-FUT-02**: Graceful-degrade PostNL outage met PDF-fallback download — M051+ als trigger

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-tenant feature-flag toggle (DB-driven) | Premature — env-triad volstaat voor M050 |
| LaunchDarkly/external feature-flag service | Premature — env-vars sufficient bij Propdex-scale |
| Redis-cached quota-counter | Premature — atomic Postgres UPDATE schaalt prima |
| Multi-eigenaar handling (rechtspersoon met meerdere directies) | Edge case — M053+ |
| Brief co-signing partner-credentialing | Partner-relatie nog te vroeg — M053+ |
| Webhook-events generieke abstraction | Premature — M051+ als 2e webhook-source verschijnt |
| BRK natuurlijke-persoon eigendom persistent storage | AVG-bescherming — `eigenaar_naam=NULL` opslag; Phase 105 ephemeral pad blijft |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRK-01 | Phase 1 | Complete |
| BRK-02 | Phase 1 | Complete |
| BRK-03 | Phase 1 | Complete |
| BRK-04 | Phase 2 | Complete |
| BRK-05 | Phase 2 | Pending |
| SCOR-01 | Phase 3 | Pending |
| SCOR-02 | Phase 3 | Pending |
| SCOR-03 | Phase 3 | Pending |
| BRIEF-01 | Phase 4 | Pending |
| BRIEF-02 | Phase 4 | Pending |
| BRIEF-03 | Phase 4 | Pending |
| AI-01 | Phase 4.5 | Pending |
| AI-02 | Phase 4.5 | Pending |
| AI-03 | Phase 4.5 | Pending |
| AI-04 | Phase 4.5 | Pending |
| POST-01 | Phase 5 | Pending |
| POST-02 | Phase 5 | Pending |
| POST-03 | Phase 5 | Pending |
| POST-04 | Phase 5 | Pending |
| POST-05 | Phase 5 | Pending |
| BRAND-01 | Phase 5.5 | Pending |
| BRAND-02 | Phase 5.5 | Pending |
| BRAND-03 | Phase 5.5 | Pending |
| UX-01 | Phase 6 | Complete |
| UX-02 | Phase 6 | Complete |
| UX-03 | Phase 6 | Complete |
| UX-04 | Phase 6 | Complete |
| UX-05 | Phase 6 | Complete |
| WIRE-01 | Phase 7 | Pending |
| WIRE-02 | Phase 7 | Pending |
| WIRE-03 | Phase 7 | Pending |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 3 | Pending |
| TEST-04 | Phase 4 | Pending |
| TEST-05 | Phase 4.5 | Pending |
| TEST-06 | Phase 5 | Pending |
| TEST-07 | Phase 5.5 | Pending |
| TEST-08 | Phase 7 | Pending |

**Coverage:**
- M050 requirements: 39 total (8 testing + 31 functional)
- Mapped to phases: 39 / 39 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17*
*Pre-planning artifacts: M050-INDEX.md · M050-ENG-PLAN.md · M050-DECISIONS-PRE-PLANNING.md*

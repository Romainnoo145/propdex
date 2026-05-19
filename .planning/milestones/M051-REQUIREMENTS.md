# Requirements: Propdex M051 — Brief-Send Pipeline

**Defined:** 2026-05-19 (split from M050)
**Core Value:** Eigenaar-outreach pipeline na BRK lookup. Templates → AI personalisatie → partner-review → PostNL dispatch → delivery-tracking. Sluit aan op M050 BRK Lookup-Wedge.

**Source of truth:** `.planning/milestones/M051-ROADMAP.md` · `.planning/milestones/M050-ENG-PLAN.md` (origineel architectuur — D1-D7 brief-half nog authoritative) · `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` (Q6/Q7/Q8 LOCKED — Q6 PostNL + Q8 quota nog relevant)

**Origin:** Deze requirements waren oorspronkelijk onderdeel van M050 BRK Actiefase-Wedge. M050 shipte alleen de BRK lookup-helft (5/10 phases, 22/45 reqs). De 23 unshipped requirements hieronder zijn losgekoppeld en als zelfstandige M051 neergezet — zie `.planning/vM050-MILESTONE-AUDIT.md`.

## M051 Requirements

### Brief Templates (Phase 1 / M051/S01)

- [ ] **BRIEF-01**: `brief_messages` tabel + `brief_template_service` registry met 3 templates (cold-outreach / follow-up / verkenning) + variabele-substitutie (eigenaar-aanhef, perceel-adres, project-context).
- [ ] **BRIEF-02**: Brief-preview UI toont perceel-foto (BAG) + key-facts naast template; partner ziet wat eindgebruiker krijgt vóór AI-step.
- [ ] **BRIEF-03**: `draft_idempotency_key` UQ-constraint voorkomt dubbele submits.

### AI Brief Personalization (Phase 2 / M051/S02)

- [ ] **AI-01**: Pydantic-schema `BriefPersonalizationInput` (D1) — typed-only structured input, geen freeform-prompt; output validation.
- [ ] **AI-02**: `app/ai/safety.py::escape_for_prompt()` voor adversarial input mitigation; eigenaar-naam altijd escaped.
- [ ] **AI-03**: Claude streaming via Anthropic SDK + FastAPI `StreamingResponse` (D6) — first-token <2s, full <15s, typewriter UX.
- [ ] **AI-04**: `ai_generation_audit` tabel logt input_hash + ai_output_raw + partner_edited_output + refused-flag + duration_ms. Partner-review-step verplicht (D7) — geen direct-send pad.

### PostNL Delivery (Phase 3 / M051/S03)

- [ ] **POST-01**: `postnl_client.py` PostNL Zakelijk API client (master-account model per Q6 LOCKED); sender-identity dynamic per partner-branding.
- [ ] **POST-02**: ARQ `postnl_dispatch_job` async — PDF-build (template + branding + content) + PostNL API send + status="sent" + `postnl_message_id`.
- [ ] **POST-03**: Atomic UPDATE quota (D2) bij brief-send `WHERE count < limit RETURNING` — voorkomt race-condition tussen concurrent sends.
- [ ] **POST-04**: Webhook `POST /webhooks/postnl` idempotent via `brief_delivery_events.external_event_id` UQ + `ON CONFLICT DO NOTHING` (D3). Out-of-order events handled via `occurred_at` ordering.
- [ ] **POST-05**: Retry-pattern: PostNL 5xx → ARQ retry 3x exp-backoff; permanent 4xx → status="failed" + alert.

### Partner Branding (Phase 4 / M051/S04)

- [ ] **BRAND-01**: `partner_branding` tabel UNIQUE per organization_id (logo_url, voettekst, lettertype, bedrijfsnaam_op_envelop NOT NULL, contactpersoon_naam, contactpersoon_functie).
- [ ] **BRAND-02**: Admin-UX branding-upload in M049-data-bronnen-hub-stijl; logo-upload valideert <1MB + correct file-type.
- [ ] **BRAND-03**: Phase 3 PDF-build leest `partner_branding.bedrijfsnaam_op_envelop` voor PostNL sender-identity.

### End-to-End Wiring + Tier-Gates (Phase 5 / M051/S05)

- [ ] **WIRE-01**: Tier-gate decorators op `/parcels/{id}/brk-lookup` + `/briefs/{id}/send` — Demo 0/0, Paid 25/5, Enterprise 250/50 quota (Q8 LOCKED). Soft 80% warning, hard 100% block.
- [ ] **WIRE-02**: Env-flag triad: `M051_BACKEND_ENABLED`, `M051_FRONTEND_ENABLED`, `M050_5_TIER_ENFORCEMENT_ENABLED` (D4) — clean toggle.
- [ ] **WIRE-03**: AVG-audit-trail: SAR-procedure documented, right-to-erasure override soft-delete bewezen, sub-processor-chain in verwerkersovereenkomst-template.

### Testing

- [ ] **TEST-04**: Brief-template variabele-substitutie + idempotency-key UQ + preview-render. (Phase 1)
- [ ] **TEST-05**: AI eval-suite: prompt-injection adversarial cases (100% safe vereist), refusal-fallback, audit-log roundtrip. (Phase 2)
- [ ] **TEST-06**: PostNL happy + retry + permanent-fail + webhook idempotency (duplicate event → 200, geen state-update). (Phase 3)
- [ ] **TEST-07**: Partner-branding CRUD + asset-validation (logo size/type). (Phase 4)
- [ ] **TEST-08**: E2E multi-tenant isolation (CRITICAL): cross-org BRK + brief access → 404 (niet 403, voorkomt leak van bestaan). Quota soft+hard cap. Monthly reset cron. Tier-gate enforcement triad off/on. (Phase 5)

## Future Requirements

Deferred to later milestones (geërfd van M050 out-of-scope):

### Admin UX
- **ADMIN-01**: Quota-monitoring admin-dashboard met soft/hard-cap warnings + upsell-CTA — M052
- **ADMIN-02**: AI-eval-set admin-UI voor hallucination-monitoring — M052+

### Multi-Channel Outreach
- **OUT-01**: Email-versie van brief (verzending via SendGrid/AWS SES) — M053+
- **OUT-02**: WhatsApp/SMS/LinkedIn outreach-kanalen — M053+
- **OUT-03**: Reply-tracking inbound mail — M053+

### Brief-Optimization
- **BRIEF-FUT-01**: A/B-test brieven met response-tracking — M054+
- **BRIEF-FUT-02**: Graceful-degrade PostNL outage met PDF-fallback download — M052+ als trigger

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-tenant feature-flag toggle (DB-driven) | Premature — env-triad volstaat |
| LaunchDarkly/external feature-flag service | Premature — env-vars sufficient bij Propdex-scale |
| Redis-cached quota-counter | Premature — atomic Postgres UPDATE schaalt prima |
| Brief co-signing partner-credentialing | Partner-relatie nog te vroeg — M053+ |
| Webhook-events generieke abstraction | Premature — M052+ als 2e webhook-source verschijnt |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRIEF-01 | Phase 1 | Pending |
| BRIEF-02 | Phase 1 | Pending |
| BRIEF-03 | Phase 1 | Pending |
| AI-01 | Phase 2 | Pending |
| AI-02 | Phase 2 | Pending |
| AI-03 | Phase 2 | Pending |
| AI-04 | Phase 2 | Pending |
| POST-01 | Phase 3 | Pending |
| POST-02 | Phase 3 | Pending |
| POST-03 | Phase 3 | Pending |
| POST-04 | Phase 3 | Pending |
| POST-05 | Phase 3 | Pending |
| BRAND-01 | Phase 3 | Pending |
| BRAND-02 | Phase 4 | Pending |
| BRAND-03 | Phase 4 | Pending |
| WIRE-01 | Phase 5 | Pending |
| WIRE-02 | Phase 5 | Pending |
| WIRE-03 | Phase 5 | Pending |
| TEST-04 | Phase 1 | Pending |
| TEST-05 | Phase 2 | Pending |
| TEST-06 | Phase 3 | Pending |
| TEST-07 | Phase 4 | Pending |
| TEST-08 | Phase 5 | Pending |

**Coverage:**
- M051 requirements: 23 total (5 testing + 18 functional)
- Mapped to phases: 23 / 23 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-19 (split from M050)*
*Pre-planning artifacts: M050-INDEX.md · M050-ENG-PLAN.md · M050-DECISIONS-PRE-PLANNING.md (still authoritative for brief-half D1-D7 decisions)*

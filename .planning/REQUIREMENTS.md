# Requirements: Propdex M050 — BRK Lookup-Wedge

**Defined:** 2026-05-17
**Re-scoped:** 2026-05-19 (brief-send half split to M051)
**Core Value:** Onderzoek-helft van de "Onderzoek → Actie" funnel — BRK Eigendom als eerste paid Type-C integration, met persistent storage + risico-scoring + dedicated lifecycle-fase 2 (Contact) UI.

**Source of truth:** `.planning/milestones/M050-INDEX.md` (origineel hub-doc) · `.planning/milestones/M050-ENG-PLAN.md` (architectuur D1-D5 voor BRK-helft) · `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` (Q7 LOCKED retention)

**Successor:** M051 — Brief-Send Pipeline. Originele brief-send requirements (23) verhuisd naar `.planning/milestones/M051-REQUIREMENTS.md`.

## M050 Requirements (BRK Lookup-Wedge — all shipped)

### BRK Persistence & Retention

- [x] **BRK-01**: `brk_ownership_records` SQLAlchemy model met velden per ENG-PLAN datamodel (organization_id, parcel_id, eigenaar_type, eigenaar_naam NULL-voor-privé, kvk_nummer, statutaire_zetel, zakelijk_recht_type, aandeel, koopsom, koopjaar, heeft_hypotheek, raw_brk_response JSONB, fetched_at, soft_deleted_at, hard_delete_after). UNIQUE op (organization_id, parcel_id, fetched_at). TenantMixin via organization_id-FK.
- [x] **BRK-02**: Alembic migratie + indices (`idx_brk_org_parcel`, partial `idx_brk_hard_delete` WHERE soft_deleted_at IS NOT NULL).
- [x] **BRK-03**: ARQ cron-job `brk_retention_cleanup_job` daily — hard-delete rows waar `hard_delete_after < NOW()`. Soft-delete trigger op unfavorite-actie (`+30 dgn soft → +60 dgn extra hard`).
- [x] **BRK-04**: `brk_persistence_service.fetch_or_use_persisted(parcel_id, org_id, choice)` — cached row binnen retention-window zonder nieuwe Kadaster-call; M049 credential-resolver (`IntegrationCredential` source_key='brk').
- [x] **BRK-05**: Failure-modes per ENG-PLAN registry: Kadaster 5xx/429/credential-expired → user-facing errors + log.

### Scoring Factor Cascade

- [x] **SCOR-01**: 3 nieuwe factoren in `score_v3_factors.py` registry: `hypotheek_risico`, `eigendoms_complexiteit`, `koopwaarde_trend` met conditional weights per projecttype.
- [x] **SCOR-02**: BRK-write triggert `rescore_cascade_job(parcel_id)` async; frontend React Query refetch toont nieuwe scores binnen 60s.
- [x] **SCOR-03**: Sparse-data fallback: parcels zonder BRK-coverage → `silent_neutral` (niet 0). Bestaande 16 score-v3 factoren ongewijzigd (REGRESSION-CRITICAL).

### Opgeslagen Cockpit + Sidebar (S06)

- [x] **UX-01**: Opgeslagen-tab transformeert naar full-width perceel-cards met BAG-thumbnail (geen layout-regression op M048 pin-mechanism + groep-pages).
- [x] **UX-02**: Linker sidebar transformeert van toplevel-icons naar 4-8 lifecycle-icons (1. Onderzoek t/m 6. Exploitatie); active-state per perceel-fase.
- [x] **UX-03**: Click op card opent bestaande perceel-detail page; "1. Onderzoek"-tab toont scan-data + BRK-persistent.
- [x] **UX-04**: Aura-tokens consistent: Morning Mist canvas, Pure Glass cards, Plus Jakarta Sans, Warm Amber accent.
- [x] **UX-05**: `prefers-reduced-motion` fallback respected; `will-change:transform` op floating-panels.

### BRK Fase-2 Wire-up (Phase 8 — M050/S06 cont.)

- [x] **UX-06**: Lifecycle-fase 2 (Contact) enabled in `phases.ts`; BRK persist-CTA verplaatst van fase 1 (Onderzoek) naar fase 2; fase 1 AANPAK card krijgt "Stap door naar Contact" copy. Geen score-drempel.
- [x] **UX-07**: Empty BRK response (alleen-natuurlijk-persoon eigenaar) → "Particuliere eigenaar" infoblok met AVG-uitleg + outreach-suggestie via BAG-adres/makelaar (NIET silent fail, AD4).
- [x] **UX-08**: Rescore-polling UX in fase 2: inline banner "Onderzoeksscore wordt bijgewerkt…" → 2s × 30 ticks (60s window) → success-banner met link terug naar fase 1, of timeout-banner zonder retry-loop (AD3).
- [x] **WIRE-04**: Nieuw `GET /api/parcels/{parcel_id}/brk` endpoint met hard org-filter + `soft_deleted_at IS NULL` filter + multi-owner support (latest fetch-cycle anchor). Cross-org returns `[]` (no leak van bestaan).
- [x] **WIRE-05**: `FavoriteParcelWorkspaceView.tsx` (1922 LOC) gesplitst in ≥5 componenten ≤300 LOC conform CLAUDE.md regel; feature-parity REGRESSION-CRITICAL test verifieert 5 dossier-tabs + scores + upload + projectnotities-grid intact.

### Testing

- [x] **TEST-01**: Backend unit tests voor BRK datamodel + retention-trigger + ARQ cleanup-job (fast-forward clock mock).
- [x] **TEST-02**: Integration tests voor `brk_persistence_service` + credential-resolver + failure-modes.
- [x] **TEST-03**: Backend tests voor 3 nieuwe scoring-factoren + cascade-trigger + sparse-data fallback. REGRESSION-CRITICAL op bestaande 16 factoren + non-BRK rescore-triggers.
- [x] **TEST-09**: REGRESSION-CRITICAL multi-tenant isolation voor BRK read-pad: cross-org GET `/api/parcels/{id}/brk` returns `[]` (NIET 403). Plus regression op Phase 105 ephemeral BRK modal (different schema BRKOwnership vs BRKOwnershipRecordRead) en LifecycleSideRailNav scope-rule.

## Moved to M051

23 originele M050 requirements zijn op 2026-05-19 verhuisd naar M051 (Brief-Send Pipeline). Zie `.planning/milestones/M051-REQUIREMENTS.md`:

- **BRIEF-01..03** — Brief templates (was M050 Phase 4)
- **AI-01..04** — AI personalisatie (was M050 Phase 4.5)
- **POST-01..05** — PostNL dispatch (was M050 Phase 5)
- **BRAND-01..03** — Partner branding (was M050 Phase 5.5)
- **WIRE-01..03** — Tier-gates + env-flag triad + AVG-audit (was M050 Phase 7)
- **TEST-04..08** — Testing voor bovenstaande

## Future Requirements (still M050+'s general backlog)

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
- **BRIEF-FUT-02**: Graceful-degrade PostNL outage met PDF-fallback download — M052+ als trigger

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-tenant feature-flag toggle (DB-driven) | Premature — env-triad volstaat |
| LaunchDarkly/external feature-flag service | Premature — env-vars sufficient bij Propdex-scale |
| Redis-cached quota-counter | Premature — atomic Postgres UPDATE schaalt prima |
| Multi-eigenaar handling (rechtspersoon met meerdere directies) | Edge case — M053+ |
| Webhook-events generieke abstraction | Premature — M052+ als 2e webhook-source verschijnt |
| BRK natuurlijke-persoon eigendom persistent storage | AVG-bescherming — `eigenaar_naam=NULL` opslag; Phase 105 ephemeral pad blijft |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRK-01 | Phase 1 | Complete |
| BRK-02 | Phase 1 | Complete |
| BRK-03 | Phase 1 | Complete |
| BRK-04 | Phase 2 | Complete |
| BRK-05 | Phase 2 | Complete |
| SCOR-01 | Phase 3 | Complete |
| SCOR-02 | Phase 3 | Complete |
| SCOR-03 | Phase 3 | Complete |
| UX-01 | Phase 6 | Complete |
| UX-02 | Phase 6 | Complete |
| UX-03 | Phase 6 | Complete |
| UX-04 | Phase 6 | Complete |
| UX-05 | Phase 6 | Complete |
| UX-06 | Phase 8 | Complete |
| UX-07 | Phase 8 | Complete |
| UX-08 | Phase 8 | Complete |
| WIRE-04 | Phase 8 | Complete |
| WIRE-05 | Phase 8 | Complete |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 2 | Complete |
| TEST-03 | Phase 3 | Complete |
| TEST-09 | Phase 8 | Complete |

**Coverage:**
- M050 requirements (post-split): 22 total (4 testing + 18 functional)
- Mapped to phases: 22 / 22 ✓
- Complete: 22 / 22 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17 · Re-scoped: 2026-05-19 (brief-half split to M051)*
*Pre-planning artifacts: M050-INDEX.md · M050-ENG-PLAN.md · M050-DECISIONS-PRE-PLANNING.md*

---
milestone: M050 — BRK Actiefase-Wedge
audited: 2026-05-19
status: gaps_found
scores:
  requirements: 22/45
  phases_shipped: 5/10
  integration: wired-within-shipped-subset
  flows: 2/3 (BRK lookup ✓, Lifecycle handoff ✓, Brief send ✗ unshipped)
nyquist:
  compliant_phases: 0
  partial_phases: 0
  missing_phases: 5
  overall: missing
gaps:
  requirements:
    - id: "BRIEF-01"
      status: "unsatisfied"
      phase: "Phase 4 (not shipped)"
      claimed_by_plans: []
      completed_by_plans: []
      verification_status: "missing"
      evidence: "Phase 4 directory does not exist; no plan ever written for brief_messages table or brief_template_service."
    - id: "BRIEF-02"
      status: "unsatisfied"
      phase: "Phase 4 (not shipped)"
      evidence: "Brief-preview UI never built."
    - id: "BRIEF-03"
      status: "unsatisfied"
      phase: "Phase 4 (not shipped)"
      evidence: "draft_idempotency_key UQ-constraint not added."
    - id: "AI-01"
      status: "unsatisfied"
      phase: "Phase 4.5 (not shipped)"
      evidence: "BriefPersonalizationInput Pydantic schema not created."
    - id: "AI-02"
      status: "unsatisfied"
      phase: "Phase 4.5 (not shipped)"
      evidence: "app/ai/safety.py::escape_for_prompt() does not exist."
    - id: "AI-03"
      status: "unsatisfied"
      phase: "Phase 4.5 (not shipped)"
      evidence: "Claude streaming endpoint not implemented."
    - id: "AI-04"
      status: "unsatisfied"
      phase: "Phase 4.5 (not shipped)"
      evidence: "ai_generation_audit table + partner-review-step missing."
    - id: "POST-01"
      status: "unsatisfied"
      phase: "Phase 5 (not shipped)"
      evidence: "postnl_client.py does not exist."
    - id: "POST-02"
      status: "unsatisfied"
      phase: "Phase 5 (not shipped)"
      evidence: "ARQ postnl_dispatch_job not created."
    - id: "POST-03"
      status: "unsatisfied"
      phase: "Phase 5 (not shipped)"
      evidence: "Atomic UPDATE quota pattern not implemented."
    - id: "POST-04"
      status: "unsatisfied"
      phase: "Phase 5 (not shipped)"
      evidence: "POST /webhooks/postnl webhook + brief_delivery_events.external_event_id UQ missing."
    - id: "POST-05"
      status: "unsatisfied"
      phase: "Phase 5 (not shipped)"
      evidence: "PostNL retry-pattern not coded."
    - id: "BRAND-01"
      status: "unsatisfied"
      phase: "Phase 5.5 (not shipped)"
      evidence: "partner_branding table does not exist."
    - id: "BRAND-02"
      status: "unsatisfied"
      phase: "Phase 5.5 (not shipped)"
      evidence: "Admin-UX branding-upload never built."
    - id: "BRAND-03"
      status: "unsatisfied"
      phase: "Phase 5.5 (not shipped)"
      evidence: "PDF-build sender-identity not implemented."
    - id: "WIRE-01"
      status: "unsatisfied"
      phase: "Phase 7 (not shipped)"
      evidence: "Tier-gate decorators on /brk-lookup + /briefs/{id}/send missing."
    - id: "WIRE-02"
      status: "unsatisfied"
      phase: "Phase 7 (not shipped)"
      evidence: "Env-flag triad (M050_BACKEND_ENABLED / FRONTEND_ENABLED / M050_5_TIER_ENFORCEMENT_ENABLED) not added."
    - id: "WIRE-03"
      status: "unsatisfied"
      phase: "Phase 7 (not shipped)"
      evidence: "AVG-audit-trail SAR-procedure + right-to-erasure override + sub-processor-chain not documented."
    - id: "TEST-04"
      status: "unsatisfied"
      phase: "Phase 4 (not shipped)"
      evidence: "Brief-template tests not written."
    - id: "TEST-05"
      status: "unsatisfied"
      phase: "Phase 4.5 (not shipped)"
      evidence: "AI eval-suite not built."
    - id: "TEST-06"
      status: "unsatisfied"
      phase: "Phase 5 (not shipped)"
      evidence: "PostNL test-suite missing."
    - id: "TEST-07"
      status: "unsatisfied"
      phase: "Phase 5.5 (not shipped)"
      evidence: "Partner-branding CRUD tests not written."
    - id: "TEST-08"
      status: "unsatisfied"
      phase: "Phase 7 (not shipped)"
      evidence: "E2E multi-tenant isolation across BRK + brief + quota + tier-gate triad not tested (BRK half covered by TEST-09)."
  integration:
    - flow: "Brief send pipeline (template → AI personalize → PostNL dispatch → quota-gate → partner-branding inject)"
      status: "BROKEN_BY_DESIGN"
      reason: "All 5 upstream phases (4, 4.5, 5, 5.5, 7) never planned. Forward-reference TODO in BrkPersistPanel.tsx:168 is the only seam."
  flows:
    - name: "BRK lookup + score-cascade + fase-2 render"
      status: "wired_end_to_end"
      evidence: "Phase 1 → 2 → 3 → 8 wiring proven via TEST-03 + TEST-09 + multi-tenant isolation regression."
    - name: "Lifecycle fase-1 → fase-2 handoff"
      status: "wired_end_to_end"
      evidence: "AanpakCard contact-handoff CTA → $phase route → ContactPhaseView dispatch + lifecycle sidebar active-state."
    - name: "Brief send pipeline"
      status: "unshipped"
      evidence: "Phases 4/4.5/5/5.5/7 never planned."
tech_debt:
  - phase: "08-brk-fase-2-wire-up"
    items:
      - "Info-level TODO at BrkPersistPanel.tsx:168 — forward-reference to brief-flow placeholder. Will dangle until Phase 4 ships."
  - phase: "all_shipped_phases"
    items:
      - "Production-dormant: M050_BRK_PERSIST_ENABLED=False by default until Kadaster DPA signed. Deliberate (not a regression)."
  - phase: "nyquist_compliance"
    items:
      - "No VALIDATION.md exists for any of the 5 shipped phases. /gsd:validate-phase never run. Non-blocking but enabled by default."
---

# Milestone Audit: M050 — BRK Actiefase-Wedge

**Audited:** 2026-05-19
**Status:** `gaps_found`
**Verdict:** Partial-ship — the BRK lookup + cockpit subsystem is complete and wired end-to-end; the brief-send pipeline (templates + AI + PostNL + branding + tier-gates) was never planned, never executed, and is therefore unshipped.

---

## 1. Scope vs Reality

| | Roadmap | Shipped | Gap |
|---|---|---|---|
| Phases | 10 | 5 | 5 |
| Requirements | 45 | 22 | 23 |
| Slices | S01–S07 (with S04.5, S05.5) + S06-cont (P8) | S01, S02, S03, S06, S06-cont | S04, S04.5, S05, S05.5, S07 |

**Shipped:** Phase 1 (BRK datamodel + retention) · Phase 2 (BRK fetch+persist endpoint) · Phase 3 (Scoring cascade) · Phase 6 (Cockpit + lifecycle sidebar) · Phase 8 (BRK fase-2 wire-up)

**Not shipped:** Phase 4 (Brief templates) · Phase 4.5 (AI personalization) · Phase 5 (PostNL dispatch) · Phase 5.5 (Partner branding admin) · Phase 7 (E2E wiring + tier-gates)

## 2. Requirements Coverage (3-source cross-reference)

| Category | Total | Satisfied | Unsatisfied |
|---|---|---|---|
| BRK persistence (BRK-01..05) | 5 | 5 | 0 |
| Scoring cascade (SCOR-01..03) | 3 | 3 | 0 |
| Cockpit + sidebar (UX-01..05) | 5 | 5 | 0 |
| Fase-2 wire-up (UX-06..08, WIRE-04..05, TEST-09) | 6 | 6 | 0 |
| Backend test (TEST-01..03) | 3 | 3 | 0 |
| **Brief templates (BRIEF-01..03)** | 3 | **0** | 3 |
| **AI personalization (AI-01..04)** | 4 | **0** | 4 |
| **PostNL dispatch (POST-01..05)** | 5 | **0** | 5 |
| **Partner branding (BRAND-01..03)** | 3 | **0** | 3 |
| **Tier-gates + E2E wiring (WIRE-01..03)** | 3 | **0** | 3 |
| **Test slices (TEST-04..08)** | 5 | **0** | 5 |
| **TOTAL** | **45** | **22** | **23** |

All 22 satisfied requirements are wired with VERIFICATION.md `passed` status + SUMMARY.md frontmatter + REQUIREMENTS.md `[x]` checkboxes (3-source cross-reference passes). All 23 unsatisfied requirements are orphaned — present in REQUIREMENTS.md, absent from every shipped phase's VERIFICATION.md.

## 3. Phase Verification Summary

| Phase | Status | Score | Notes |
|---|---|---|---|
| 1 BRK Datamodel + Retention | passed | 9/9 | Self-contained |
| 2 BRK Fetch+Persist Endpoint | passed | 25/25 | Consumed by Phase 8 |
| 3 Scoring Factor Cascade | human_needed | 4/4 backend + 1 manual UI item | Frontend refetch ≤60s deferred to human-QA; not blocking automated chain |
| 6 Cockpit + Lifecycle Sidebar | passed | 5/5 | Modified by Phase 8 (split), parity-pinned |
| 8 BRK Fase-2 Wire-up | passed | 7/7 | Today; DEF-01 resolved |

## 4. Integration Status (shipped subset)

**Multi-tenant isolation chain:** `BrkOwnershipRecord(TenantMixin)` [P1] → `persist_record(org_id, …)` [P1+P2] → `fetch_and_persist` [P2 router, uses `current_user.organization_id`] → `read_for_parcel(db, org_id, parcel_id)` [P8] → `useBrkRecords` consumes own-org rows only. Cross-org returns `[]` (pinned by `test_multi_tenant_brk_isolation.py` + `test_brk_fetch_multi_tenant.py`). **End-to-end isolation: INTACT.**

**E2E flow 1 — BRK lookup happy path:** WIRED end-to-end across phases 1→2→3→8.

**E2E flow 2 — Lifecycle fase-1 → fase-2 handoff:** WIRED (AanpakCard contact-handoff → `$phase.tsx` → ContactPhaseView → LifecycleSideRailNav active-state).

**E2E flow 3 — Brief send pipeline:** UNSHIPPED. The only seam is `BrkPersistPanel.tsx:168` (info-level TODO referencing brief-flow placeholder).

## 5. Nyquist Compliance

`workflow.nyquist_validation` is not set (default = enabled). No VALIDATION.md exists for any of the 5 shipped phases.

| Phase | VALIDATION.md | Compliant | Action |
|---|---|---|---|
| 1 | missing | — | `/gsd:validate-phase 1` |
| 2 | missing | — | `/gsd:validate-phase 2` |
| 3 | missing | — | `/gsd:validate-phase 3` |
| 6 | missing | — | `/gsd:validate-phase 6` |
| 8 | missing | — | `/gsd:validate-phase 8` |

Non-blocking but flagged per workflow contract.

## 6. Tech Debt

- **Forward-ref TODO** at `frontend/src/components/lifecycle/BrkPersistPanel.tsx:168` — will dangle until Phase 4 ships.
- **Production-dormant:** `M050_BRK_PERSIST_ENABLED=False` by default (Kadaster DPA pending). Deliberate. Doesn't block audit.
- **No Nyquist VALIDATION.md** for any shipped phase.

## 7. Recommendation

The shipped subset (5 phases, 22 requirements) is **production-ready as a BRK research-tool subsystem** — the "Onderzoek → Contact (BRK lookup)" half of the funnel works end-to-end with multi-tenant isolation proven.

The "Contact → Brief send → PostNL dispatch" half is **un-built**. Closing this gap is a multi-week effort (Kadaster DPA + PostNL Zakelijk onboarding + AI safety + tier-gating + AVG-audit work) and corresponds to roadmap phases 4, 4.5, 5, 5.5, 7.

**Two valid paths forward:**

A. **Split-milestone:** Treat the BRK lookup subsystem as a complete sub-milestone, archive it under a new label (e.g., M050a — BRK Lookup), and re-plan the brief-send half as M051 (or M050b). Avoids the "incomplete milestone" overhead while honoring what shipped.

B. **Continue M050:** Plan + execute Phases 4 → 4.5 → 5 → 5.5 → 7 (or a subset) within M050. Multi-week effort. Use `/gsd:plan-milestone-gaps` to scaffold.

**Audit verdict: do NOT complete the milestone as-is** — 23/45 unsatisfied requirements is too large a gap for a clean `/gsd:complete-milestone` archive.

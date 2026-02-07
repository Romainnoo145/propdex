# Requirements: CRM Plus

**Defined:** 2026-02-07
**Core Value:** Address → Property Intelligence Report

## v1.0 Requirements (Validated)

All v1.0 requirements shipped and confirmed. See PROJECT.md Validated section.

## v1.1 Requirements

Requirements for production hardening. Each maps to roadmap phases.

### Testing

- [x] **TEST-01**: Auth module has unit tests covering registration, login, token refresh, and password reset
- [x] **TEST-02**: Auth module has integration tests verifying full request flows against the database
- [x] **TEST-03**: API client module (httpx) has unit tests for BAG, PDOK, DSO, and RCE clients with mocked responses
- [x] **TEST-04**: Cache manager has integration tests verifying JSONB cache read/write/TTL/invalidation against the database
- [x] **TEST-05**: Zoning and monument aggregators have unit tests covering data transformation and error handling
- [x] **TEST-06**: Zoning and monument aggregators have integration tests verifying full aggregation flows
- [x] **TEST-07**: AI document parsing module has unit tests for Claude API client and PDF processing with mocked responses
- [x] **TEST-08**: Report CRUD operations have integration tests covering save, list, search, and delete against the database
- [x] **TEST-09**: PDF export has unit tests verifying template rendering and WeasyPrint output
- [x] **TEST-10**: Multi-tenant isolation is verified by integration tests confirming cross-organization data is never leaked

### Security

- [x] **SEC-01**: Database connection uses app_role with enforced RLS policies instead of superuser bypass

### Configuration

- [x] **CFG-01**: Single .env file in backend/ with root .env removed or symlinked
- [x] **CFG-02**: Freshness threshold is configurable per organization (not hardcoded 24h)

### Infrastructure

- [x] **INFRA-01**: ARQ worker lifecycle is integrated with main application startup/shutdown

### Documentation

- [x] **DOC-01**: Phase 1 has a formal VERIFICATION.md confirming all original requirements were met

## Future Requirements

Deferred to v2.0 (frontend milestone):

- User can track multiple properties as opportunities in a simple pipeline
- Address input with BAG autocomplete suggestions
- Interactive map visualization with property location on PDOK tile layers
- PDF export of property intelligence report (branded, professional layout — frontend)
- Comparison view — side-by-side comparison of 2-3 properties
- Role-based access (admin, analyst, viewer) for larger teams

## Out of Scope

| Feature | Reason |
|---------|--------|
| External API key management | Deployment prerequisite, not code debt |
| PDF template visual polish | Requires human review with real data |
| New feature development | This milestone is strictly stabilization |
| Frontend integration | Deferred to v2.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 7 | Complete |
| TEST-02 | Phase 7 | Complete |
| TEST-03 | Phase 8 | Complete |
| TEST-04 | Phase 8 | Complete |
| TEST-05 | Phase 9 | Complete |
| TEST-06 | Phase 9 | Complete |
| TEST-07 | Phase 9 | Complete |
| TEST-08 | Phase 10 | Complete |
| TEST-09 | Phase 10 | Complete |
| TEST-10 | Phase 10 | Complete |
| SEC-01 | Phase 6 | Complete |
| CFG-01 | Phase 6 | Complete |
| CFG-02 | Phase 6 | Complete |
| INFRA-01 | Phase 9 | Complete |
| DOC-01 | Phase 7 | Complete |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 15/15 ✓
- Unmapped: 0

---
*Requirements defined: 2026-02-07*
*Last updated: 2026-02-07 (all 15 requirements complete — v1.1 milestone done)*

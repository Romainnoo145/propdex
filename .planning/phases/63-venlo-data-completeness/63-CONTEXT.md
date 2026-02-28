---
phase: 63
name: venlo-data-completeness
created: 2026-03-01
---

# Phase 63: Venlo Data Completeness — Context

## User Decisions

### Scan Scope
**Decision**: Re-scan all 21 Venlo wijken with fresh scans using Phase 62 pipeline improvements.
**Rationale**: Ensures all wijken benefit from the reliability fixes (retry logic, coverage tracking, abort-on-failure).

### Validation Approach
**Decision**: Build a reusable CLI validation tool.
**Rationale**: Can be reused for other gemeenten beyond Venlo. Should validate bouwjaar population, address resolution, and opportunity scores.

### Parcel Addressing
**Decision**: Include and formalize the parcel_addressing.py service in this phase.
**Rationale**: The service exists as unstaged code. This phase should integrate it properly so addresses are resolved via PDOK reverse geocoding.

### Bug Scope
**Decision**: Fix pipeline bugs within this phase if discovered during scanning.
**Rationale**: Keep scope flexible — this is a data completeness phase, and blocking bugs should be resolved rather than deferred.

## Key Constraints
- Phase depends on Phase 62 (scan pipeline reliability) being complete
- Demo target: Venlo gemeente with all 21 wijken showing complete data
- Success criteria require bouwjaar, addresses, and opportunity scores all populated correctly

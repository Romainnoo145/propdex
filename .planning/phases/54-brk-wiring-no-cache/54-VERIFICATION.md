---
phase: 54-brk-wiring-no-cache
verified: 2026-02-24T06:16:50Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 54: BRK Wiring + No-Cache Verification Report

**Phase Goal:** Wire existing BRK client into aggregator as Step 2b; enforce never-cache constraint; strip brk_ownership before JSONB save; graceful degradation when unconfigured
**Verified:** 2026-02-24T06:16:50Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | BRK ownership is fetched live for all matching percelen after cadastral data is resolved | VERIFIED | `fetch_brk_ownership()` is async, wired as Step 2b in `aggregate_property_data()` after `asyncio.gather`, iterates `perceel_ids` from `CadastralParcel.identificatie` |
| 2 | When BRK is unconfigured, report receives structured unavailable status with admin hint | VERIFIED | `fetch_brk_ownership()` checks `brk_client.is_configured`; returns `BRKOwnership(status="unavailable", reason="BRK Bevragen niet geconfigureerd", admin_hint=...)` |
| 3 | When no perceel identificatie exists, report receives structured unavailable status with reason | VERIFIED | Filters `[p.identificatie for p in cadastral_parcels if p.identificatie is not None]`; empty list returns `BRKOwnership(status="unavailable", reason="Geen kadastraal perceel gevonden voor dit adres")` |
| 4 | BRK errors do not crash the aggregator — error status is returned | VERIFIED | `GovernmentAPIError` caught, returns `BRKOwnership(status="error", ...)`; generic `Exception` also caught with separate handler |
| 5 | BRK ownership section is always present in report (never None) | VERIFIED | `PropertyReportResponse.brk_ownership` uses `default_factory=lambda: BRKOwnership(status="unavailable", reason="Eigendomsdata niet opgehaald")` — not Optional |
| 6 | BRK ownership data is stripped from report_data before JSONB persist in save_report() | VERIFIED | `report_data_json.pop("brk_ownership", None)` after `model_dump()`, before `SavedReport(...)` construction |
| 7 | BRK ownership data is stripped from report_data before JSONB persist in update_report_data() | VERIFIED | `report_data_dict.pop("brk_ownership", None)` after `model_dump()`, before `report.report_data = report_data_dict` |
| 8 | GET report endpoint re-fetches BRK live when stored data lacks brk_ownership | VERIFIED | `if report_data.get("brk_ownership") is None:` → builds `stored_parcels` from JSONB → calls `fetch_brk_ownership(stored_parcels)` |
| 9 | Re-fetch handles unconfigured BRK gracefully (returns unavailable status, not crash) | VERIFIED | `fetch_brk_ownership()` always returns; outer `except Exception as e: logger.warning(...)` in router catches any unexpected failure |
| 10 | Stored report_data never contains non-null brk_ownership.data after save | VERIFIED | Integration test `test_save_report_strips_brk_ownership` + `test_update_report_data_strips_brk_ownership` PASS — confirmed by test run (6/6 passed) |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/schemas/brk_ownership.py` | Three-state BRKOwnership with PerceelOwnership wrapper | VERIFIED | `status: Literal["available","unavailable","error"]`; `PerceelOwnership` class; `never_cache: ClassVar[bool] = True` excluded from `model_dump()` |
| `backend/app/schemas/property.py` | CadastralParcel with identificatie field; brk_ownership always-present | VERIFIED | `identificatie: str | None = Field(default=None, ...)` on `CadastralParcel`; `brk_ownership: BRKOwnership = Field(default_factory=...)` on `PropertyReportResponse` |
| `backend/app/government_apis/brk_bevragen.py` | Public is_configured property on BRKBevragenClient | VERIFIED | `@property def is_configured(self) -> bool: return self._configured` present at line 119 |
| `backend/app/services/property_aggregator.py` | fetch_brk_ownership() Step 2b + perceel identificatie population | VERIFIED | `async def fetch_brk_ownership(cadastral_parcels: list[CadastralParcel]) -> BRKOwnership`; `identificatie=props.get("identificatie")` in `CadastralParcel(...)` constructor; `brk_ownership = await fetch_brk_ownership(cadastral_parcels)` as Step 2b |
| `backend/app/reports/service.py` | BRK stripping in save_report() and update_report_data() | VERIFIED | `pop("brk_ownership", None)` present in both functions (lines 84 and 372) |
| `backend/app/reports/router.py` | BRK re-fetch in GET /{report_id} handler | VERIFIED | `fetch_brk_ownership` imported from `property_aggregator`; `CadastralParcel` imported; re-fetch logic wired in `get_report()` |
| `backend/tests/integration/test_brk_wiring.py` | 6 integration tests for strip-before-save and re-fetch-on-view | VERIFIED | 6 tests present and ALL PASS (confirmed by pytest run: `6 passed, 349 warnings in 3.58s`) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `property_aggregator.py` | `brk_bevragen.py` | `brk_client.is_configured + brk_client.create_client() + brk_client.get_eigendom()` | WIRED | `brk_client` imported at line 15; `brk_client.is_configured` checked at line 133; `async with brk_client.create_client() as client:` at line 158; `await brk_client.get_eigendom(perceel_id, client)` at line 166 |
| `property_aggregator.py` | `brk_ownership.py` | `BRKOwnership(status=...) construction` | WIRED | `from app.schemas.brk_ownership import BRKOwnership, PerceelOwnership, ZakelijkGerechtigde` at line 19; multiple `BRKOwnership(status=...)` return points verified |
| `property_aggregator.py` | `property.py` | `CadastralParcel(identificatie=props.get(...))` population | WIRED | `identificatie=props.get("identificatie")` present in `CadastralParcel(...)` constructor inside `fetch_cadastral_parcels()` |
| `reports/service.py` | `brk_ownership.py` | Strip brk_ownership before JSONB persist | WIRED | `report_data_json.pop("brk_ownership", None)` (save_report); `report_data_dict.pop("brk_ownership", None)` (update_report_data) — both present |
| `reports/router.py` | `property_aggregator.py` | `fetch_brk_ownership()` for re-fetch on view | WIRED | `from app.services.property_aggregator import aggregate_property_data, fetch_brk_ownership` at line 36; `brk_section = await fetch_brk_ownership(stored_parcels)` in `get_report()` |
| `reports/router.py` | `property.py` | `CadastralParcel.model_validate` for re-fetch perceel extraction | WIRED | `from app.schemas.property import CadastralParcel` at line 23; `CadastralParcel.model_validate(p) for p in report_data.get("cadastral_parcels", [])` in `get_report()` |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| BRK-01 | Report fetches ownership data from BRK Bevragen V2 (existing client, needs wiring) | SATISFIED | `fetch_brk_ownership()` wired as Step 2b in `aggregate_property_data()`; calls `brk_client.get_eigendom()` for each perceel; `brk_ownership` included in `PropertyReportResponse` constructor |
| BRK-04 | BRK data is NEVER cached or stored — stripped from report before DB save (Kadaster Tier 3) | SATISFIED | `pop("brk_ownership", None)` in both `save_report()` and `update_report_data()`; GET endpoint re-fetches live; 2 integration tests prove enforcement; `never_cache: ClassVar[bool] = True` marker on `BRKOwnership` |
| BRK-05 | Graceful degradation when BRK is unconfigured (PKIOverheid cert pending) | SATISFIED | `brk_client.is_configured` check at start of `fetch_brk_ownership()`; returns `status="unavailable"` with `admin_hint` pointing to PKIOverheid cert setup; integration test `test_brk_unavailable_when_not_configured` PASSES |

All 3 requirements from PLAN frontmatter (`[BRK-01, BRK-04, BRK-05]`) are accounted for and satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `property_aggregator.py` | 154, 182 | `datetime.utcnow()` deprecated in Python 3.12+ | Info | DeprecationWarning only; project memory documents this as intentional pattern (TIMESTAMP WITHOUT TIME ZONE constraint) |
| `reports/service.py` | 384 | `datetime.utcnow()` deprecated in Python 3.12+ | Info | Same as above — established project pattern, not a defect |

No blocker or warning-level anti-patterns found. The `datetime.utcnow()` warnings are pre-existing project-wide pattern documented in MEMORY.md.

No BRK response payload logging found. Logger calls in `fetch_brk_ownership()` log only: request metadata (endpoint name, perceel ID) and error messages — never response body.

---

### Human Verification Required

None. All behavioral aspects of this phase are verifiable programmatically:
- Schema correctness: verified via Python import + assertion checks
- Aggregator wiring: verified via `inspect.getsource()` + grep
- Strip enforcement: verified via integration tests hitting real DB
- Degradation states: verified via mocked unit tests

The PKIOverheid mTLS certificate is not configured in the test environment (expected — no cert available in dev). The `brk_client.is_configured = False` path is the only path executed in the live system and is covered by `test_brk_unavailable_when_not_configured`.

---

## Gaps Summary

No gaps. All 10 observable truths verified. All 7 artifacts substantive and wired. All 3 requirements satisfied. All 6 integration tests pass. Ruff check clean on all modified files.

---

_Verified: 2026-02-24T06:16:50Z_
_Verifier: Claude (gsd-verifier)_

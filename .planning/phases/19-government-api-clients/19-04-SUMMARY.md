---
phase: 19
plan: 04
subsystem: government-apis
tags: [brk, mtls, authentication, kadaster, eigendomsdata, rate-limiting]

dependency_graph:
  requires:
    - "19-01 (rate limiter and brk_limiter singleton)"
    - "backend/app/government_apis/base.py (error handling)"
    - "backend/app/core/config.py (BRK configuration)"
  provides:
    - "BRK Bevragen client with mTLS authentication"
    - "get_kadastraal_object and get_eigendom methods"
    - "brk_client module-level singleton"
  affects:
    - "Future plans using eigendomsdata (19-05 aggregator)"

tech_stack:
  added:
    - "ssl.SSLContext for mTLS client certificate authentication"
    - "PKIOverheid certificate validation"
  patterns:
    - "Graceful degradation (disabled mode without certificates)"
    - "Fail-fast validation (certificate path checks at init)"
    - "Never-store policy enforcement (no caching/DB writes)"
    - "Module-level singleton with optional configuration"

key_files:
  created:
    - path: "backend/app/government_apis/brk_bevragen.py"
      loc: 215
      purpose: "BRK Bevragen client for eigendomsdata with mTLS auth"
  modified: []

decisions:
  - decision: "Create separate httpx.AsyncClient per BRK request (not reuse app client)"
    rationale: "mTLS requires custom SSLContext - cannot share with standard HTTP client"
    alternatives: ["Modify app client with conditional SSLContext"]
    chosen_because: "Separation of concerns - BRK auth is unique"

  - decision: "Gracefully disable in dev without certificates"
    rationale: "Allow app to start locally without PKIOverheid certificates"
    alternatives: ["Require certificates always", "Mock client in dev"]
    chosen_because: "Real client code runs in all environments, just disabled until configured"

  - decision: "Validate certificate paths at initialization"
    rationale: "Fail fast on misconfiguration rather than at first request"
    alternatives: ["Validate at first request", "Skip validation"]
    chosen_because: "Catch deployment issues immediately, not in production traffic"

metrics:
  duration_seconds: 84
  tasks_completed: 1
  files_created: 1
  files_modified: 0
  commits: 1
  tests_added: 0
  completed_date: "2026-02-10"
---

# Phase 19 Plan 04: BRK Bevragen Client Summary

BRK Bevragen client with mTLS authentication and never-store policy for eigendomsdata.

## One-liner

BRK client with PKIOverheid mTLS (SSLContext + client cert) for eigendomsdata, gracefully disabled without certificates, enforcing Tier 3 never-store policy.

## What Was Built

Created `brk_bevragen.py` with BRKBevragenClient class for Kadaster eigendomsdata API:

**Core features:**
- mTLS authentication via ssl.SSLContext with PKIOverheid client certificate
- get_kadastraal_object: Fetch cadastral parcel details
- get_eigendom: Fetch ownership/rights data (NEVER cached per Tier 3 terms)
- Graceful degradation when BRK not configured (dev mode)
- Certificate path validation at initialization (fail fast)
- Rate limiting via brk_limiter (2 concurrent, 200/hour)

**Authentication flow:**
1. _create_brk_ssl_context() creates SSLContext with PROTOCOL_TLS_CLIENT
2. Loads CA bundle for server verification
3. Loads client cert + key via load_cert_chain()
4. Sets check_hostname=True and verify_mode=CERT_REQUIRED
5. create_client() returns httpx.AsyncClient with custom SSLContext

**Configuration checks:**
- At init: Validates BRK_API_KEY + all 3 cert paths present
- If configured: Validates cert files exist on disk (fail fast)
- If NOT configured: Logs warning, disables queries (dev mode)
- At runtime: Methods check self._configured and raise descriptive error if not

**Never-store enforcement:**
- Module contains zero references to db.add, db.commit, cache, or storage
- Explicit docstring warnings on get_eigendom() method
- Data returned directly to caller for immediate display only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed extraneous f-string prefix**
- **Found during:** Task 1 ruff check
- **Issue:** RuntimeError message had f-string prefix but no placeholders in first part
- **Fix:** Changed `f"BRK configuration error..."` to `"BRK configuration error..."`
- **Files modified:** backend/app/government_apis/brk_bevragen.py
- **Commit:** fbdfa4d (same commit, fixed before committing)

## Task Breakdown

### Task 1: Create BRK Bevragen client with mTLS authentication ✓
**Type:** auto
**Commit:** fbdfa4d
**Duration:** 84 seconds

**Implementation:**
1. Created _create_brk_ssl_context() module-level helper
   - ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
   - load_verify_locations(BRK_CA_BUNDLE_PATH)
   - load_cert_chain(certfile, keyfile)
   - check_hostname=True, verify_mode=CERT_REQUIRED

2. BRKBevragenClient class
   - BASE_URL = "https://api.brk.kadaster.nl/esd-eto/bevragen/v2"
   - Constructor checks configuration, validates cert paths
   - Logs warning if not configured (graceful degradation)

3. create_client() method
   - Returns httpx.AsyncClient(verify=self._ssl_context, timeout=30.0)
   - Must be used as async context manager
   - Raises RuntimeError if not configured

4. get_kadastraal_object(identificatie, client) method
   - Fetches cadastral object data
   - Uses brk_limiter for rate limiting
   - Accept-Crs: epsg:28992 header

5. get_eigendom(identificatie, client) method
   - Fetches ownership/rights data
   - expand=true for person details
   - CRITICAL docstring: NEVER cache or store

6. Module-level singleton: brk_client = BRKBevragenClient()

**Files created:**
- backend/app/government_apis/brk_bevragen.py (215 LOC)

**Verification:**
- ✓ Import works, configured=False in dev (no BRK config)
- ✓ Ruff check passes (all clean)
- ✓ No storage/caching code found (only warning comments)
- ✓ SSLContext uses PROTOCOL_TLS_CLIENT with strict verification
- ✓ Constructor validates cert file paths when configured

## Testing Notes

**Development mode:**
- Client gracefully disables without BRK configuration
- Logs warning: "BRK Bevragen not configured -- eigendomsdata queries disabled"
- App can start without PKIOverheid certificates

**Production prerequisites:**
- BRK_API_KEY (from Kadaster)
- BRK_CLIENT_CERT_PATH (PKIOverheid client certificate)
- BRK_CLIENT_KEY_PATH (PKIOverheid private key)
- BRK_CA_BUNDLE_PATH (PKIOverheid CA bundle)

**Error handling:**
- RuntimeError at init if configured but cert files missing (fail fast)
- GovernmentAPIError at runtime if methods called when not configured
- Standard handle_api_response() for HTTP errors

## Integration Points

**Imports:**
- ssl (standard library)
- pathlib.Path for file validation
- httpx for async HTTP client
- app.core.config.settings for BRK configuration
- app.government_apis.base (GovernmentAPIError, handle_api_response)
- app.government_apis.rate_limiter (brk_limiter)

**Exports:**
- BRKBevragenClient class
- brk_client singleton instance

**Used by:**
- Future: 19-05 aggregator (eigendomsdata enrichment on top leads)
- Future: Endpoint exposing eigendomsdata to frontend

## Known Limitations

1. **PKIOverheid certificates required:** Cannot test eigendomsdata in dev without certificates
2. **Paid API:** BRK access requires Kadaster subscription
3. **Never-store policy:** Data cannot be cached - must fetch on every request
4. **Certificate management:** Client cert renewal must be handled manually

## Success Criteria Met

- ✓ BRKBevragenClient uses ssl.SSLContext with load_cert_chain for mTLS
- ✓ Client gracefully handles missing BRK configuration (disabled mode)
- ✓ get_kadastraal_object and get_eigendom methods use rate limiting
- ✓ NEVER-store policy enforced: no caching, no database writes in module
- ✓ Certificate paths validated at init time (fail fast)
- ✓ Module-level brk_client singleton works in dev without certificates

## Next Steps

Plan 19-05 will create the government data aggregator that:
- Orchestrates calls to BAG, BRK, SRU clients
- Combines data into unified property reports
- Respects cache tiers (DB pre-scan / JSONB on-demand / BRK never-store)
- Handles eigendomsdata specially (fetch on-demand, never cache)

## Self-Check

Verifying claimed artifacts exist on disk and in git history:

**Files created:**
- backend/app/government_apis/brk_bevragen.py: ✓ EXISTS (215 LOC)

**Commits:**
- fbdfa4d: ✓ EXISTS (feat(19-04): create BRK Bevragen client with mTLS authentication)

## Self-Check: PASSED

All claimed files and commits verified successfully.

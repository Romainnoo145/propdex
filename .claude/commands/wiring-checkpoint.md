# Wiring Checkpoint

Find where things silently break between layers. Not "does it compile" — "does the config/feature/option actually survive from entry point to where it's used."

## What This Catches

- API route exposes params but service layer ignores them
- Auth token / org_id enters middleware, gets stripped or bypassed mid-pipeline
- Module exports functions but nothing imports them
- Config/options silently dropped or defaulted away between layers
- Same feature built in two places, one quietly falls behind
- Government API client returns data that frontend types don't match
- Scan enrichment flags written but never read (or vice versa)

## Steps

### 1. Map Architecture

Read CLAUDE.md, project structure, key config files. Identify:
- **Entry points**: API routes (`backend/app/routers/`), frontend route loaders, event handlers
- **Orchestration**: FastAPI middleware, React Query hooks, scan pipeline stages
- **Capability modules**: Government API clients, services, enrichment pipeline
- **Config surface**: pydantic Settings, TypeScript interfaces, env vars

Mental model: `Entry Points -> Orchestration -> Modules -> External`, with config flowing rightward.

#### Propdex-Specific Architecture Layers

```
Frontend (React/Vite)
  Routes -> Hooks (useQuery/useMutation) -> API calls (lib/api/) -> TypeScript types
  Components -> Props -> Rendered UI

Backend (FastAPI)
  Routers -> Services -> Government API clients -> External APIs
  Middleware (auth/org_id/RLS) -> every endpoint

Scan Pipeline
  scan_orchestrator -> enrichment phases -> scan_results.flags JSONB -> tile_proxy -> frontend

Data Flow
  .env -> pydantic Settings -> injected into services -> used in API calls
  JWT -> middleware -> current_user -> org_id filter on every query
```

### 2. Identify Traceable Capabilities

Extract capabilities that MUST work end-to-end.

| Category | Propdex Trace | Example Gap |
|----------|--------------|-------------|
| **Multi-tenant isolation** | org_id from JWT -> middleware -> every DB query | Query missing org_id filter = data leak |
| **Auth flow** | Login -> JWT -> 401 interceptor -> token refresh -> retry | Token refresh fires but retry doesn't re-attach new token |
| **Config propagation** | .env -> Settings -> service constructor -> API call | Env var exists but Settings field not read |
| **Scan pipeline** | orchestrator -> enrichment phase -> flags JSONB -> tile proxy -> frontend | Flag written as key X, frontend reads key Y |
| **Government API data** | API response -> parser -> DB column -> API response -> TS type -> UI | Field renamed between layers, UI gets undefined |
| **Coordinate transforms** | RD New (28992) -> WGS84 (4326) or vice versa | Transform applied twice or not at all |
| **Feature parity** | Backend endpoint params vs frontend API call args | Backend added param, frontend never sends it |
| **Error surfaces** | API error -> caught -> user-visible feedback | Error swallowed, user sees infinite spinner |
| **Type alignment** | Python model fields vs TypeScript interface fields | Backend adds field, TS type not updated |
| **Tile cache** | TILE_SCHEMA_VERSION bump -> browser cache invalidation | Data format changes but version not bumped |
| **Resource lifecycle** | DB session / httpx client created -> used -> closed | Connection leak on error path |
| **Dead exports** | Module exports function -> nothing imports it | Built but unreachable |

### 3. Trace

Ask user: **Parallel tracing or sequential? Full project or specific area?**

Suggested areas for targeted tracing:
- `scan-pipeline` — orchestrator through enrichment to tile display
- `auth-flow` — login through token refresh to protected endpoints
- `government-apis` — each client's data through to frontend display
- `multi-tenant` — org_id filtering across all query paths
- `config` — env vars through Settings to actual usage
- `types` — Python models vs TypeScript interfaces alignment

For each capability, trace from entry point to consumption. Check for:
1. **Dropped config**: Option exists at entry but never reaches the function
2. **Silent defaults**: Value replaced with default mid-pipeline instead of passed through
3. **Partial wiring**: Works in path A but not path B (e.g., org_id checked on GET but not DELETE)
4. **Stale wrappers**: Wrapper/adapter exposes subset of underlying interface
5. **Dead exports**: Module exports capability but nothing imports it
6. **Shape mismatches**: Python returns `snake_case`, TypeScript expects `camelCase`, or field simply missing
7. **Flag key mismatches**: scan_results.flags key written as X, read as Y

For each issue: report WHERE (file:line at both ends), WHAT gets lost, WHY IT MATTERS (security/data/UX impact).

Do NOT report: style issues, theoretical problems, things that work correctly.

### 4. Cross-Reference

After all traces, find systemic patterns:
- Same gap in multiple places (e.g., 3 routers missing org_id on DELETE)
- Multiple government API clients with stale type mappings
- Missing symmetry (enrichment source X has frontend card but Y doesn't)
- Type drift between `backend/app/models/` and `frontend/src/lib/types/`

### 5. Fix or Report

Ask user: **Fix all / Report only / Fix critical, report rest?**

Severity levels:
- **CRITICAL**: Multi-tenant bypass, auth gap, data leak
- **HIGH**: Silent data loss, broken user flow, cache poisoning
- **MEDIUM**: Dead code, stale wrapper, missing error surface
- **LOW**: Unused export, redundant default

If reporting, generate `reports/wiring-[date].md` with:
- Architecture map (as traced)
- Each capability traced with findings
- Gaps table: where | what's lost | impact | severity
- Systemic patterns
- Summary with recommended fix order

### 6. Update Project Knowledge

If systemic patterns found:
- Add wiring notes to CLAUDE.md or memory
- Flag any patterns that future development should watch for
- Note which areas are clean (negative results are findings too)

## STOP HERE

DO NOT proceed to next steps automatically. Wait for user.

## Guidelines

- Trace capabilities, not files. "Does org_id filter work on all endpoints" not "is router.py correct."
- Silent failures are the priority. Other commands catch errors. This catches things that silently degrade.
- Wrapper drift is the #1 most common find.
- "Works in path A but not path B" is the signature pattern.
- Don't report style issues. If data flows correctly, it's fine.
- Negative results are findings. "Auth token survives all layers cleanly" is worth noting.
- For Propdex specifically: multi-tenant isolation gaps are always CRITICAL severity.
- Type alignment issues between Python and TypeScript are common — check field names, optionality, and enum values.
- Government API clients each have unique response formats — trace each one individually.
- Scan pipeline flags are the most likely place for key mismatches since multiple phases write to the same JSONB column.

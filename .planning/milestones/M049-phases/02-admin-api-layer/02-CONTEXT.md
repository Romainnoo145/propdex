# Phase 2: Admin API Layer — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning
**Source:** /plan-eng-review locked-in 2026-05-14

<domain>
## Phase Boundary

Phase 2 levert de admin REST API bovenop het S01 datamodel. Frontend (S03) en latere integraties (S04 upload, S05 credentials) bouwen tegen dit contract.

**In scope:**
- 1 nieuwe router: `backend/app/admin/data_sources_router.py`
- 1 Pydantic schemas file: `backend/app/admin/data_sources_schemas.py`
- 1 probe-registry module: `backend/app/admin/data_source_probes.py`
- 3 GET endpoints + 1 POST refresh endpoint
- Integration test suite (RBAC + happy + status-mix + idempotency)

**Niet in deze phase:**
- Frontend UX (Phase 3)
- M045 upload-flow integratie (Phase 4 — endpoints zijn al beschikbaar via S04)
- Credentials API endpoints (Phase 5 — separate router komt daar)
- Live probes voor Type B (open APIs) en Type C (paid integrations) — stubs only
- ActionItems deprecation (Phase 6)

</domain>

<decisions>
## Implementation Decisions (Eng-Review Locked-In 2026-05-14)

### 1. Router locatie & mounting

- **Nieuwe file:** `backend/app/admin/data_sources_router.py`
- **NIET extenden** bestaande `backend/app/admin/router.py` (eval + ai-usage) — domain-separation
- **Mount:** `router = APIRouter(prefix="/api/admin/data-sources", tags=["Admin / Data Sources"])`
- **Registratie:** in `backend/app/main.py` of waar admin/router al gemount wordt (zelfde patroon)

### 2. Endpoints

#### `GET /api/admin/data-sources/gemeenten`
- **Auth:** `Depends(get_current_superuser)`
- **Response:** `list[GemeenteSummary]` gesorteerd op `last_activity_at DESC, gemeente_code ASC`
- **Schema GemeenteSummary:**
  ```python
  class GemeenteSummary(BaseModel):
      gemeente_code: str  # "GM0983"
      gemeente_naam: str  # "Venlo" (lookup uit CBS gemeente-naam mapper of vanuit een tabel — onderzoek in planner)
      total_sources: int
      status_counts: dict[Literal["live","broken","missing","not_applicable"], int]
      last_activity_at: datetime | None  # max(last_checked) over alle rows voor die gemeente
  ```

#### `GET /api/admin/data-sources/{gemeente_code}`
- **Auth:** superuser
- **Path param:** `gemeente_code: str` — moet matchen op regex `^GM\d{4}$` (Pydantic validator); onbekende code → 404
- **Response:** `GemeenteDataSourcesPayload` met 3 secties:
  ```python
  class DataSourceRow(BaseModel):
      source_key: str
      label_nl: str
      source_type: Literal["A","B","C"]
      status: Literal["live","broken","missing","not_applicable"]
      last_checked: datetime | None
      error_message: str | None
      configuratie: dict | None
      available_actions: list[Action]

  class Action(BaseModel):
      action: Literal["upload","configure_credential","view_versions","refresh"]
      enabled: bool
      label_nl: str
      reason_disabled: str | None  # tooltip-tekst bij enabled=False

  class GemeenteDataSourcesPayload(BaseModel):
      gemeente_code: str
      gemeente_naam: str
      cascade_uploads: list[DataSourceRow]   # source_type == "A"
      open_apis: list[DataSourceRow]         # source_type == "B"
      paid_integrations: list[DataSourceRow] # source_type == "C"
  ```
- **Perf target:** <300ms. Single SELECT + Python merge (zie §3).

#### `POST /api/admin/data-sources/{gemeente_code}/{source_key}/refresh`
- **Auth:** superuser
- **Path validation:** `gemeente_code` regex + `source_key` moet bestaan in `DATA_SOURCE_KEYS` catalog (anders 404 met clear error)
- **Body:** geen (POST zonder body, action via path)
- **Response:** `DataSourceRow` (single — de bijgewerkte rij)
- **Idempotency:** zie §4
- **Geen ARQ enqueue** — synchroon binnen request (probes zijn cheap voor S02 scope-A; B/C zijn stubs)

### 3. Payload compositie (<300ms)

**Single-query merge strategie:**
1. `SELECT * FROM data_source_status WHERE gemeente_code = :code` → dict keyed op `source_key`
2. Iterate over `DATA_SOURCE_KEYS` catalog (uit `backend/app/policy_documents/data_source_keys.py`)
3. Per catalog-entry: lookup in dict. Aanwezig → use DB-row; afwezig → synthesize default rij met `status="missing"`, `last_checked=None`, `error_message=None`, `configuratie=None`
4. `available_actions` per rij berekend uit `source_type` + `status` (zie §6)
5. Group by `source_type` → 3 lists
6. Resolve `gemeente_naam` (zie planner-research notitie — bestaande CBS gemeente-naam lookup hergebruiken)

**Geen N+1, geen CASE-aggregation. Eén SELECT per request.**

### 4. Refresh idempotency — Postgres advisory lock + deterministic probe

```python
LOCK_KEY = hash(gemeente_code + source_key) & 0x7FFFFFFFFFFFFFFF  # int8 voor pg_try_advisory_xact_lock

async def refresh(gemeente_code, source_key, db):
    # Belt-and-suspenders: advisory lock tegen concurrent refresh-spam
    lock_acquired = await db.execute(
        text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": LOCK_KEY}
    )
    if not lock_acquired.scalar():
        # Andere request is bezig — return current row, 200
        return await load_current_row(gemeente_code, source_key, db)

    # Probe (registry dispatch, zie §5)
    probe_result = await PROBE_REGISTRY[source_type](source_key, gemeente_code, db)

    # Compare-and-update: alleen schrijven als status of error_message wijzigt
    existing = await get_or_create_row(...)
    if existing.status != probe_result.status or existing.error_message != probe_result.error_message:
        existing.status = probe_result.status
        existing.error_message = probe_result.error_message
        existing.last_checked = utcnow()
        await db.commit()

    return row_to_response(existing)
```

**Properties:**
- 2× refresh achter elkaar → tweede call: lock acquired, probe runt opnieuw (deterministic → zelfde result), compare-and-update is no-op
- Concurrent calls → één wint lock, ander krijgt current state via fallback. Geen deadlock, geen dubbele writes.
- Geen Redis-dependency (Propdex Redis is voor ARQ workers, niet admin path)

### 5. Probe-registry pattern

```python
# backend/app/admin/data_source_probes.py
ProbeResult = TypedDict('ProbeResult', {
    'status': Literal["live","broken","missing","not_applicable"],
    'error_message': str | None,
})

ProbeFn = Callable[[str, str, AsyncSession], Awaitable[ProbeResult]]

async def probe_type_a_cascade(source_key, gemeente_code, db) -> ProbeResult:
    """Count PolicyDocument rows voor deze (gemeente, source_key). >0 = live, =0 = missing.

    NOTE (correctie via 02-RESEARCH.md): PolicyDocument heeft GEEN gemeente_code veld.
    Filter via entity_type='gemeente' + entity_code=<code>. Tel alleen vendor-managed
    uploads (is_global=True) — klant-org overrides tellen niet mee voor vendor catalog status.
    """
    count = await db.scalar(
        select(func.count()).select_from(PolicyDocument)
        .where(PolicyDocument.entity_type == "gemeente")
        .where(PolicyDocument.entity_code == gemeente_code)
        .where(PolicyDocument.source_key == source_key)
        .where(PolicyDocument.is_global == True)
    )
    if count > 0:
        return {"status": "live", "error_message": None}
    return {"status": "missing", "error_message": "No vendor PolicyDocument rows found"}

async def probe_type_b_stub(source_key, gemeente_code, db) -> ProbeResult:
    return {"status": "not_applicable", "error_message": "Open-API probe not yet wired (deferred to later milestone)"}

async def probe_type_c_stub(source_key, gemeente_code, db) -> ProbeResult:
    return {"status": "missing", "error_message": "Awaiting S05 IntegrationCredential support"}

PROBE_REGISTRY: dict[str, ProbeFn] = {
    "A": probe_type_a_cascade,
    "B": probe_type_b_stub,
    "C": probe_type_c_stub,
}
```

**Strangler fig:** S02 levert volledig API-contract. Latere slices vullen probe_type_b/c live in via één registry-entry — geen router-refactor.

### 6. `available_actions` computatie

Function `compute_actions(source_type, status) -> list[Action]` met deze matrix:

| source_type | status      | actions                                              |
|-------------|-------------|------------------------------------------------------|
| A           | live        | view_versions, upload, refresh                       |
| A           | missing/broken | upload, refresh                                  |
| B           | *           | refresh (disabled met `reason_disabled="Probe wordt later gewired"`) |
| C           | *           | configure_credential (disabled met `reason_disabled="Beschikbaar vanaf S05"`), refresh (disabled idem) |

**`refresh` action altijd aanwezig** maar enabled/disabled based op of probe live is. Frontend gebruikt `enabled` flag + `reason_disabled` voor tooltip.

### 7. Catalog-drift handling

Edge case: DB heeft een row met `source_key` die niet (meer) in `DATA_SOURCE_KEYS` catalog staat (bijv. door deprecation).

- **GET endpoint:** log warning (`logger.warning("Orphaned data_source_status row: gemeente=%s source_key=%s")`), skip de row uit payload — niet renderen
- **POST refresh endpoint:** 404 met error_message `"Source key not in catalog"`
- **Reden:** payload reflects catalog-truth, niet DB-truth, om frontend rendering consistent te houden

### 8. Tests (TEST-02)

**Test file:** `backend/tests/integration/test_admin_data_sources_router.py`

**Coverage (10 paths):**
1. `GET /gemeenten` → 200 met aggregate counts (seed 2 gemeentes, 4 rows)
2. `GET /{code}` → 200 met 3-secties; alle catalog entries renderen; missing entries default `status="missing"`
3. `GET /{code}` → 200 met status-mix (seed alle 4 status-states); reflects DB-state
4. `GET /{code}` → 404 voor onbekende code (`GM9999`)
5. `GET` endpoints → 403 voor non-superuser (regular user)
6. `POST refresh` → 200 + status flips `missing → live` na seeden PolicyDocument
7. `POST refresh` → idempotent: 2× call, geen extra row-writes voor unchanged probe (check via SQL count of UPDATEs of via `updated_at` consistency)
8. `POST refresh` → concurrent calls (asyncio.gather of 2× httpx) → één wint lock, andere krijgt current state, geen deadlock
9. `POST refresh` → 404 voor `source_key` niet in catalog
10. `POST refresh` → Type B/C stub → status `not_applicable` / `missing` zonder externe calls (verified met mock van probe registry)

**Critical regression test:**
- 403 voor regular user op alle 4 endpoints — bewijst RBAC-pattern werkt op echte routes (S01's placeholder route is nu obsolete)
- Catalog-drift: seed orphaned `data_source_status` row → GET payload skips silently, POST refresh returns 404

**Test pattern:** httpx AsyncClient + ASGITransport + `make_superuser_token()` helper (zie bestaande tests in `backend/tests/integration/`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements + roadmap

- `.planning/REQUIREMENTS.md` — API-01, API-02, API-03, API-05, TEST-02 (full specs)
- `.planning/ROADMAP.md` — Phase 2 success criteria

### S01 artifacts (datamodel + catalog beschikbaar)

- `backend/app/models/data_source_status.py` — `DataSourceStatus` SQLAlchemy model (S01)
- `backend/app/policy_documents/data_source_keys.py` — `DATA_SOURCE_KEYS` catalog met source_type A/B/C (S01)
- `frontend/src/lib/constants/dataSourceKeys.ts` — frontend mirror (S01, referentie voor frontend in S03)
- `.planning/phases/01-datamodel-source-key-catalog/01-CONTEXT.md` — S01 datamodel-beslissingen

### Reference implementations (auth + admin patterns)

- `backend/app/admin/router.py` — bestaande admin router pattern (eval, ai-usage); APIRouter(prefix="/api/admin", tags=["Admin"])
- `backend/app/auth/dependencies.py:103` — `get_current_superuser` dependency (reuse direct, niet wrappen)
- `backend/app/models/policy_document.py` — PolicyDocument model voor Type A probe (count query target)

### Test patterns

- `backend/tests/integration/` — bestaande integration tests; gebruik httpx AsyncClient + ASGITransport
- Conftest patterns voor superuser token + tenant-isolation

### Project conventions

- `./CLAUDE.md` — Propdex three-layer workflow + harde regels + multi-tenant security
- Commits: `M049/S02: <wat>` format

</canonical_refs>

<specifics>
## Specific Ideas

### Gemeente-naam resolution — RESOLVED via 02-RESEARCH.md
Bestaande mapper: `backend/app/policy_documents/service.py:332-350` — `_gemeente_name_map(db)` retourneert `{gemeente_code: gemeente_naam}` via DISTINCT query op `area_scans.gemeente_naam`. M045/S05 admin overview gebruikt dit pattern.

**Action voor planner:** extract `_gemeente_name_map` naar `backend/app/services/gemeente_name_lookup.py` (private-function-reach-through vermijden, +1 file, -1 private fn, zero behavior change). Daarna importeren in nieuwe `data_sources_router.py`.

### Performance verificatie
Plan moet een micro-bench includeren: `pytest -m perf` of inline `time.perf_counter()` rondom GET endpoint dat <300ms asserts bij 50 catalog-entries + 50 DB-rows. Bij overschrijding: investigate query plan voor `WHERE gemeente_code = X`.

### Status enum centralisatie — RESOLVED via 02-RESEARCH.md
S01 heeft al `DataSourceStatusValue` Literal gedefinieerd in `backend/app/models/data_source_status.py:28`. **Plan moet die importeren en hergebruiken — NIET een nieuwe `data_source_enums.py` maken.**

### Advisory-lock implementatie — verfijnd via 02-RESEARCH.md
- `pg_try_advisory_xact_lock` werkt prima met asyncpg (`SET LOCAL`-caveat is niet van toepassing).
- Gebruik `func.pg_try_advisory_xact_lock(type_coerce(LOCK_KEY, BigInteger()))` voor int4-overflow safety.
- **Vervang Python `hash()` met `hashlib.blake2b(..., digest_size=8)`** voor cross-process stability (PYTHONHASHSEED is randomized).

### FastAPI Path-validator vs not-found onderscheid
`Path(pattern=r"^GM\d{4}$")` geeft **422** voor malformed `gemeente_code`. **404** is voor `gemeente_code` die wel valid format heeft maar geen rows produceert (of niet bestaat in `area_scans`). Plan moet beide test-paden dekken.

### Pydantic v2 conventies
- `model_config = ConfigDict(from_attributes=True)` voor ORM mapping
- `.model_dump(by_alias=True)` voor response serialisatie
- Field validators voor `gemeente_code` regex

### OpenAPI schemas
FastAPI genereert OpenAPI auto. Plan moet expliciet `response_model=` op alle 4 endpoints zetten zodat frontend in S03 typed client kan genereren als gewenst.

</specifics>

<deferred>
## Deferred Ideas

Items expliciet uitgesteld:

- **Live probes voor Type B (open APIs)** — RIVM/PDOK/CBS/SRU probes. Komt in later milestone wanneer reliability-tracking serieuze waarde toevoegt. Stub returnt `not_applicable` met clear error_message.
- **Live probes voor Type C (paid integrations)** — wacht op S05 IntegrationCredential. Stub returnt `missing`.
- **Refresh audit-log / history-tabel** — wel handig voor debugging maar geen MVP-requirement. S05 introduceert audit-pattern voor credentials; latere slice kan dezelfde pattern uitbreiden naar refresh-events.
- **Bulk refresh endpoint** (`POST /api/admin/data-sources/{gemeente_code}/refresh-all`) — niet in API-spec. Kan later als convenience.
- **WebSocket / SSE voor live status push** — geen requirement; frontend kan polling doen bij open settings page (S03 beslist).
- **Per-source rate-limiting voor refresh** — advisory lock is voldoende voor MVP. Echte rate-limit (bv. 1 refresh/minuut/source) wachten tot probe-cost daadwerkelijk pijnlijk wordt.
- **GraphQL alternative** — REST is consistent met rest van Propdex API; geen reden om af te wijken.

</deferred>

---

*Phase: 02-admin-api-layer*
*Context gathered: 2026-05-14 via /plan-eng-review lock-in (no separate /gsd:discuss-phase needed)*

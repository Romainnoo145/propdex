# Domain Pitfalls: Lead Pipeline, Scan Persistence, Map Parcel Visualization

**Domain:** PropTech SaaS — adding lead CRM pipeline, persistent scan storage, and GeoJSON parcel map layer to an existing property intelligence platform
**Researched:** 2026-02-18
**Scope:** Pitfalls specific to adding these features to Propdex (existing ~40k LOC, PostgreSQL + FastAPI + MapLibre)

---

## Critical Pitfalls

Mistakes that cause rewrites, data leakage, or major architectural breaks.

---

### Pitfall 1: Lead Table Missing organization_id Causes Cross-Tenant Data Leak

**What goes wrong:**
A new `leads` or `deals` table is added without `organization_id NOT NULL` and a corresponding RLS policy. The existing `get_db()` dependency sets `app.current_tenant_id` via `SET LOCAL`, but this only blocks access if RLS is active on the table. A new table without a policy silently returns all tenants' leads to anyone who authenticates.

**Why it happens:**
RLS is not default-active for new tables. The pattern `TenantMixin` (from `app/models/base.py`) provides the column, but the developer must also write the migration, create the policy, and add the index. When moving fast, the policy step is skipped because the column is there and queries seem to work fine (they do — they just return everything).

**Consequences:**
- One organization sees another's leads and deal pipeline — GDPR violation
- Multi-tenant isolation completely broken for lead data
- Silent failure: no errors, tests may pass if test DB is single-tenant

**Prevention:**

1. Use `TenantMixin` on every new model — enforces `organization_id` column.
2. Every new table needs a matching migration with explicit RLS:
   ```sql
   ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
   CREATE POLICY leads_tenant_isolation ON leads
     USING (organization_id::text = current_setting('app.current_tenant_id'));
   ```
3. Add `organization_id` composite index:
   ```sql
   CREATE INDEX ix_leads_org_status ON leads(organization_id, status);
   ```
4. Write a multi-tenant integration test that logs in as org A and asserts it cannot read org B's leads.

**Detection:**
- Integration test: create lead as org A, query as org B — should return 0 rows
- Check `pg_policies` view: every new table should have at least one policy
- Code review: any `select(Lead)` without `.where(Lead.organization_id == org_id)` is a bug

**Phase to address:** First phase that adds the `leads` table (database schema)
**Urgency:** CRITICAL — must be verified before any lead endpoint ships

---

### Pitfall 2: GeoJSON Endpoint Serializes EPSG:28992 Coordinates — MapLibre Silently Renders Wrong Location

**What goes wrong:**
The `parcel_cache.geometry` column stores polygons in EPSG:28992 (RD New — Dutch national grid). When building a GeoJSON endpoint to serve parcel polygons to the frontend, the geometry is fetched from SQLAlchemy and serialized without coordinate transformation. MapLibre expects WGS84 (EPSG:4326). The polygons are rendered at the wrong geographic position (in the North Sea or near Africa), but no error is thrown.

**Why it happens:**
GeoAlchemy2 returns `WKBElement` objects. When you call `json.dumps(geometry)` or Pydantic serializes the geometry, it may output raw coordinate values in RD New (x/y values like `[115000, 485000]`). MapLibre interprets these as longitude/latitude, placing the polygon far outside the Netherlands.

**Consequences:**
- Parcels render thousands of kilometers from their real location
- No error in browser or backend — silent bad data
- MVT tile endpoint (already built) avoids this by using `ST_AsMVTGeom` with correct transformation, but a new GeoJSON endpoint would not

**Prevention:**

Always project to WGS84 in the SQL query, never in Python:
```sql
SELECT ST_AsGeoJSON(ST_Transform(geometry, 4326), 6) AS geom
FROM parcel_cache
WHERE ...
```

The `maxdecimaldigits=6` argument is sufficient for map display and reduces payload size. Never use more than 6 decimal places for display (sub-meter precision, ~10cm).

In FastAPI endpoints that return GeoJSON:
```python
# BAD: raw WKBElement (EPSG:28992)
geom_json = json.loads(to_shape(parcel.geometry).geojson)

# GOOD: PostGIS projects to WGS84 in query
result = await db.execute(
    text("SELECT ST_AsGeoJSON(ST_Transform(geometry, 4326), 6) FROM parcel_cache WHERE id = :id"),
    {"id": str(parcel_id)}
)
```

**Detection:**
- Rendered polygons appear far outside Netherlands bounds in MapLibre
- Coordinate values in GeoJSON response are in the 100,000–200,000 range (RD New), not -180–180 (WGS84)
- `console.log(feature.geometry.coordinates)` shows unexpected large values

**Phase to address:** Any phase adding a GeoJSON API endpoint for parcel boundaries
**Urgency:** CRITICAL — guaranteed wrong output if not handled from the start

---

### Pitfall 3: MapLibre feature-state with UUID String IDs Silently Fails

**What goes wrong:**
When adding hover and selection effects to GeoJSON parcel polygons (e.g., highlight on hover, select on click), `map.setFeatureState()` is called with the parcel UUID as the feature id. It appears to work — no errors — but the hover/selection highlight never renders. This is because MapLibre's `setFeatureState()` requires feature ids to be integers or strings castable to integers, and UUIDs (`"3f7a...c2"`) are not.

**Why it happens:**
The GeoJSON spec allows any JSON value as a feature `id`. MapLibre internally requires integer-compatible ids for feature-state. The error is silent: `setFeatureState()` accepts any value but does nothing if the id doesn't match. Existing code (`ParcelScoreLayer.tsx`) correctly sidesteps this for MVT tiles because PostGIS generates integer rowids. A new GeoJSON source won't have integer ids by default.

**Consequences:**
- Hover highlight never appears on parcel polygons
- Click selection never visually highlights selected parcel
- No console error — debugging is time-consuming
- Developer assumes feature-state is broken, may introduce workarounds that add complexity

**Prevention:**

Use either `generateId` (auto-assign sequential integers) or `promoteId` (use a numeric property as id) when adding GeoJSON sources:

```typescript
// Option A: generateId (auto-assigns 0, 1, 2, ... — but resets on setData)
map.addSource('parcel-geojson', {
  type: 'geojson',
  data: featureCollection,
  generateId: true,  // MapLibre assigns integer IDs automatically
});

// Option B: promoteId (use a property value as the feature id)
map.addSource('parcel-geojson', {
  type: 'geojson',
  data: featureCollection,
  promoteId: 'parcel_index',  // numeric property pre-assigned in backend response
});
```

For `generateId: true`, ids reset to 0 on `setData()` — which means previously set feature states become invalid. Use a stale-state cleanup before calling `setData()`:
```typescript
// Clear all selections before data refresh
map.removeFeatureState({ source: 'parcel-geojson' });
source.setData(newData);
```

For MVT tiles (existing `ParcelScoreLayer`), the tile already contains integer feature ids from PostGIS — no change needed.

**Detection:**
- `map.setFeatureState(...)` called without error, but layer fill-opacity paint expression `['feature-state', 'hover']` never activates
- Add `console.log(feature.id)` in mousemove handler — if `undefined` or string UUID, source lacks integer ids
- Try `generateId: true` and re-test

**Phase to address:** Phase adding GeoJSON scan result visualization to map
**Urgency:** HIGH — selection and hover UX broken without this

---

## Moderate Pitfalls

These cause bugs, performance problems, or significant debugging time, but don't require architectural rewrites.

---

### Pitfall 4: ARQ Job Re-runs Scan on Restart — Upsert Not Idempotent for ScanResult

**What goes wrong:**
ARQ uses at-least-once delivery. If the worker restarts mid-scan (e.g., during Phase 4: qualifying), the `area_scan_job` re-runs from the start. Phase 3 (upsert parcels into `parcel_cache`) is idempotent due to `ON CONFLICT (organization_id, parcel_id)`. But Phase 4 creates `ScanResult` rows. On re-run, the `ScanResult` inserts fail with `UniqueViolation` on `uq_scan_results_scan_parcel`, crashing the job with status `failed`.

**Why it happens:**
The scan job does not checkpoint progress. On re-run after restart, it re-fetches BAG WFS data (which may return slightly different features due to API variability) and tries to re-insert `ScanResult` rows that already exist. The unique constraint prevents duplicates correctly, but the exception surfaces as a job failure rather than graceful resumption.

**Prevention:**

In the ScanResult insert loop (Phase 4), use `INSERT ... ON CONFLICT DO NOTHING` via SQLAlchemy:
```python
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = pg_insert(ScanResult).values(
    organization_id=org_id,
    scan_id=scan.id,
    parcel_id=parcel.id,
    score=score,
    flags={"category": category, "factors": factors},
)
stmt = stmt.on_conflict_do_nothing(
    index_elements=["scan_id", "parcel_id"]  # Matches uq_scan_results_scan_parcel
)
await session.execute(stmt)
```

Also reset the scan status to `running` at job start (already done in current code), but add a check: if results already exist, skip Phase 4 entirely.

**Detection:**
- Worker logs: `UniqueViolation` on `scan_results` during re-run
- Scan status goes to `failed` with error message containing `uq_scan_results_scan_parcel`
- ARQ job history shows repeated runs with same scan_id

**Phase to address:** Phase adding scan persistence (or as part of data model hardening)
**Urgency:** HIGH — ARQ restart is realistic in production (Docker restart, OOM kill)

---

### Pitfall 5: GeoJSON Source setData Replaces Entire Dataset on Every Filter Change — Main Thread Serialization Bottleneck

**What goes wrong:**
When adding map visualization for scan results, the React component calls `source.setData(newGeoJSON)` whenever the user filters parcels (e.g., by bestemming type or score range). For 2,000 parcels, each `setData()` call serializes the entire FeatureCollection to a string via `JSON.stringify()` on the main thread, then transfers it to a MapLibre web worker. On a mid-range laptop, this takes 50-200ms per filter change, causing UI stuttering and sluggish filter interaction.

**Why it happens:**
MapLibre's GeoJSON source has no partial update mechanism for feature properties. `setData()` replaces the full dataset. The serialization cost scales linearly with feature count and vertex count per polygon. Dutch cadastral parcels can have complex boundaries with 50+ vertices each — a 2,000 parcel set may be 2-5MB of GeoJSON.

**Prevention:**

Use the MVT tile endpoint (already built at `/api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf`) for parcel visualization instead of a GeoJSON source. The tile approach:
- Only loads geometry for the current viewport — not 2,000 parcels at once
- Already handles reprojection, clipping, and scoring via `ST_AsMVTGeom`
- Feature-state for hover/selection works because MVT tiles include integer feature ids via PostGIS rowids

If GeoJSON is required for a specific feature (e.g., showing all selected parcels at once), use `generateId: true` and `source.updateData()` for incremental changes where possible (MapLibre >= 3.x).

For filter-driven updates: implement server-side filtering (already done via `list_results` endpoint) and use the MVT approach where the tile query joins on `scan_results` for the active scan — changing filter means changing which tile endpoint URL is used.

**Detection:**
- Browser DevTools Performance tab shows `JSON.stringify` taking > 50ms on filter change
- UI freezes or drops frames when filter sliders are moved
- MapLibre web worker receiving messages > 1MB (visible in Network DevTools)

**Phase to address:** Phase adding parcel map visualization
**Urgency:** HIGH — 2,000 parcels is within Propdex's documented scan range (200-2000)

---

### Pitfall 6: Lead-to-Parcel FK Violates on Parcel Cache Eviction

**What goes wrong:**
The `parcel_cache` table uses `ON DELETE CASCADE` for `scan_results`. If a lead model adds a foreign key to `parcel_cache.id`, deleting or re-scanning a gemeente (which deletes old scan results) could cascade to delete leads — losing user's pipeline data. Alternatively, if `parcel_cache` entries are evicted as a maintenance task, leads lose their parcel reference without warning.

**Why it happens:**
`parcel_cache` is named "cache" — it was designed as mutable infrastructure, not as a stable reference table. Leads are long-lived business records. A FK from a business entity to a cache table creates a lifecycle mismatch.

**Consequences:**
- Force re-scan deletes scan results (cascade) which cascades to leads — user's pipeline disappears
- Cache maintenance (future) silently orphans lead records
- FK constraint errors when trying to evict stale parcel entries

**Prevention:**

Use one of two approaches (choose based on roadmap direction):

**Option A: Denormalize parcel identity into the lead record (safer)**
```python
class Lead(Base, TenantMixin, TimestampMixin):
    parcel_cache_id: Mapped[uuid.UUID | None]  # Nullable FK, SET NULL on delete
    parcel_code: Mapped[str]                   # Denormalized kadaster ID (stable, no FK)
    address: Mapped[str]                       # Denormalized address string
    gemeente_code: Mapped[str]                 # For filtering
```
Set the FK as `ON DELETE SET NULL` so deleting the parcel cache entry nulls the reference without deleting the lead. The `parcel_code` (kadaster ID) remains as a stable identifier.

**Option B: Promote parcel_cache to a stable reference table**
Remove the "cache" semantics: never delete parcel entries, only update them. This requires adding an explicit TTL/eviction strategy — more work but cleaner architecture.

**Detection:**
- Test: create lead for parcel, force re-scan, verify lead still exists
- Check migration: `ON DELETE CASCADE` on lead's parcel FK is almost always wrong
- Code review: any `parcel_cache` delete or bulk purge logic must not cascade to leads

**Phase to address:** Lead database schema design phase
**Urgency:** HIGH — data loss bug that appears only weeks after deployment

---

### Pitfall 7: PostgreSQL ENUM for Lead Status Blocks Adding New Stages Without Full Migration

**What goes wrong:**
Lead pipeline status is defined as a `sa.Enum('prospect', 'qualified', 'negotiating', 'closed', name='lead_status')`. Six months later, the client wants to add a "due_diligence" stage between negotiating and closed. `ALTER TYPE lead_status ADD VALUE` cannot be run inside a transaction block, and the new value cannot be used until after commit. Alembic migrations run inside transactions by default — the migration fails.

**Why it happens:**
PostgreSQL enum types cannot add values inside a transaction in a way that lets the same transaction use the new value. Alembic wraps each migration in a transaction. The workaround (`op.execute('COMMIT')` before `ALTER TYPE`) is fragile and breaks migration rollback capability.

**Consequences:**
- Production migration fails — requires manual intervention
- Cannot add new pipeline stages without complex migration surgery
- Rollback is impossible if migration partially ran

**Prevention:**

Use `VARCHAR(50)` with a `CHECK CONSTRAINT` for lead status instead of a PostgreSQL enum:
```sql
CREATE TABLE leads (
    ...
    status VARCHAR(50) NOT NULL DEFAULT 'prospect'
        CHECK (status IN ('prospect', 'qualified', 'negotiating', 'closed')),
    ...
);
```

Adding a new status is a simple `ALTER TABLE leads DROP CONSTRAINT ...; ALTER TABLE leads ADD CONSTRAINT ... CHECK (status IN (..., 'due_diligence'))` — runs inside a transaction, rollback-safe.

In the SQLAlchemy model:
```python
VALID_STATUSES = {'prospect', 'qualified', 'negotiating', 'closed'}

status: Mapped[str] = mapped_column(
    String(50),
    nullable=False,
    default="prospect",
)
```

Validate at the Pydantic schema level, not at the database enum level. All existing Propdex models (e.g., `AreaScan.status`) already use `String(20)` — follow this established pattern.

**Detection:**
- Alembic migration with `ALTER TYPE ... ADD VALUE` fails in CI with: `ERROR: cannot add enum value inside a transaction`
- Rollback fails after partial migration

**Phase to address:** Lead table schema design (before the first migration is written)
**Urgency:** MEDIUM — not painful immediately, becomes painful at first pipeline evolution

---

### Pitfall 8: MVT Tile Endpoint Missing Tile Cache — 120 Tile Requests Per Map Move Hit Database

**What goes wrong:**
The existing tile endpoint `/api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf` is rate-limited to 120/minute but has no tile caching. Every map pan and zoom fires 6-12 tile requests. A single user panning across a wijk generates hundreds of database queries per minute. At 5 concurrent users each with a scan open, this is 600+ ST_AsMVT queries/minute against the database.

**Why it happens:**
The current implementation sets `Cache-Control: public, max-age=3600` in the response header, which enables browser-level caching for repeat tile requests within the same session. However, it does not cache at the server level — each unique tile URL hits the FastAPI endpoint and runs a full PostGIS query.

**Consequences:**
- Database CPU spikes during active map use
- Slow tile load times when multiple users pan simultaneously
- ST_AsMVT with ST_Intersects and ST_Transform is expensive on large geometry tables

**Prevention:**

Scan tiles are immutable once the scan is `completed` (scan results don't change). Add tile caching at the endpoint level using the existing Redis connection:

```python
# In generate_mvt_tile()
cache_key = f"tile:{scan_id}:{z}:{x}:{y}"

# Check cache first
cached = await redis.get(cache_key)
if cached:
    return bytes(cached)

# Generate tile
tile_data = await _generate_tile_from_postgis(...)

# Cache for 1 hour (scan results are immutable)
if tile_data:
    await redis.setex(cache_key, 3600, tile_data)

return tile_data
```

The ARQ/Redis connection is already part of the app infrastructure — no new dependency needed. Cache invalidation: when a scan is re-run (`force_rescan=True`), delete the tile cache keys for that `scan_id` using `redis.delete("tile:{scan_id}:*")` pattern.

**Detection:**
- Database monitoring shows spikes in `ST_AsMVT` query execution time during map use
- PostgreSQL `pg_stat_activity` shows many concurrent geometry queries
- Response time for tile endpoint > 200ms consistently

**Phase to address:** Phase adding MVT tile visualization, or as a hardening follow-up
**Urgency:** MEDIUM — manageable for single user, becomes critical at 5+ concurrent users

---

### Pitfall 9: SQLAlchemy Async Session in ARQ Job Creates Per-Parcel Flush — N+1 Commit Pattern

**What goes wrong:**
The area scan job (`jobs/area_scan.py`) calls `_upsert_parcel_cache()` in a loop, and each call does `session.add(parcel); await session.flush()`. For 2,000 parcels, this is 2,000 individual flush round-trips to the database — each one blocking the async loop waiting for the database response. The scan that should take 5 minutes takes 20+ minutes.

**Why it happens:**
The flush-per-parcel pattern exists because subsequent code needs the `parcel.id` after flush (to create `ScanResult` rows). However, PostgreSQL's `gen_random_uuid()` as a `server_default` requires a round-trip to get the generated id. The current code tolerates this for the existing scan scale, but as scan sizes grow or if lead-creation is added to the scan pipeline, the pattern compounds.

**Consequences:**
- Scan job runtime grows linearly with parcel count
- Database connection pool exhaustion under concurrent scans
- Timeouts on large gemeentes

**Prevention:**

For the parcel cache upsert, generate UUIDs in Python rather than relying on `server_default`:
```python
import uuid

parcel = ParcelCache(
    id=uuid.uuid4(),  # Generate in Python, no flush needed for ID
    organization_id=org_id,
    ...
)
session.add(parcel)
# No flush here — ID is already known
```

Then use `session.add_all([...])` for batch inserts, with a single `await session.flush()` after each batch of 100:
```python
batch_size = 100
for i in range(0, len(parcels), batch_size):
    batch = parcels[i:i + batch_size]
    session.add_all(batch)
    await session.flush()
```

For the lead pipeline, never flush inside a row-creation loop. Collect all new lead records, then batch insert.

**Detection:**
- Database monitoring shows 2000+ sequential `INSERT` statements per scan
- Scan job runtime > 10 minutes for medium-sized wijk (500+ parcels)
- `asyncio` event loop shows repeated short waits on database I/O

**Phase to address:** Scan persistence optimization, or lead pipeline if lead creation is batched
**Urgency:** MEDIUM — current scale tolerable, becomes a bottleneck at wijk sizes > 500

---

### Pitfall 10: GeoJSON Parcel Endpoint Returns 5MB Response — No Bounding Box Filtering

**What goes wrong:**
A new endpoint `GET /api/scans/{scan_id}/geojson` returns all parcel polygons for a completed scan. For a medium-sized wijk (500 parcels, each with complex MULTIPOLYGON geometry at full precision), the uncompressed GeoJSON is 3-8MB. The browser downloads 3-8MB per scan view, even when the user has zoomed in and only sees 20 parcels. Slow connections fail the request.

**Why it happens:**
The endpoint fetches all `ParcelCache` entries for the scan, calls `ST_AsGeoJSON(ST_Transform(geometry, 4326))` for each, and builds a FeatureCollection. The query doesn't filter by viewport bounds. Frontend code doesn't paginate or bounds-filter requests.

**Prevention:**

Either use the existing MVT tile endpoint (tiles are already viewport-aware), or add mandatory bbox filtering to any GeoJSON endpoint:

```python
@router.get("/{scan_id}/geojson")
async def get_scan_geojson(
    scan_id: uuid.UUID,
    # Required bbox parameters (WGS84)
    min_lon: float = Query(...),
    min_lat: float = Query(...),
    max_lon: float = Query(...),
    max_lat: float = Query(...),
    ...
```

And in SQL, filter with a spatial intersection:
```sql
WHERE ST_Intersects(
    pc.geometry,
    ST_Transform(ST_MakeEnvelope(:min_lon, :min_lat, :max_lon, :max_lat, 4326), 28992)
)
```

Also reduce coordinate precision:
```sql
ST_AsGeoJSON(ST_Transform(geometry, 4326), 6)  -- 6 decimal places = ~10cm precision
```

**Detection:**
- Network DevTools shows response > 1MB for GeoJSON endpoint
- Slow initial load on connections < 50Mbps
- ST_AsGeoJSON query time > 500ms for > 200 parcels

**Phase to address:** Phase adding GeoJSON parcel endpoint (if GeoJSON approach is chosen over MVT)
**Urgency:** MEDIUM — use MVT tiles to avoid this problem entirely

---

## Minor Pitfalls

Small issues that require 1-2 hours to fix but are easy to miss.

---

### Pitfall 11: Alembic Autogenerate Misses GIST Index on New Geometry Columns

**What goes wrong:**
If a new table is added with a GeoAlchemy2 `Geometry` column (e.g., a `lead_geometry` column for optional polygon sketching), `alembic revision --autogenerate` creates the table and column but does not generate the spatial GIST index. The index is silently omitted. Spatial queries (`ST_Intersects`, `ST_Within`) run sequentially without the index — 100x slower.

**Why it happens:**
GeoAlchemy2's GIST index auto-creation during `CREATE TABLE` is not reverse-engineered by Alembic's autogenerate. The `parcel_cache` table already hit this — its GIST index is created manually in the migration, as noted in the model comment: "GIST index created explicitly in migration (not auto-detected by Alembic)."

**Prevention:**

Always manually add the GIST index in migrations for any geometry column:
```python
def upgrade() -> None:
    op.create_table('leads', ...)
    # Manual GIST index — Alembic autogenerate misses this
    op.execute(
        "CREATE INDEX ix_leads_geometry_gist ON leads USING GIST (geometry)"
    )
```

Check migration output: if a `Geometry` column is present and no `GIST` index appears, it was missed.

**Detection:**
- `\d leads` in psql shows no GIST index on geometry column
- `EXPLAIN ANALYZE SELECT ... WHERE ST_Intersects(geometry, ...)` shows `Seq Scan` instead of `Index Scan using ix_..._gist`

**Phase to address:** Any phase adding spatial columns to new tables
**Urgency:** LOW — won't cause errors, causes slowness

---

### Pitfall 12: Lead Status History Missing — Impossible to Reconstruct Pipeline Timeline

**What goes wrong:**
The `leads` table stores only `status` (current state). When a lead moves from `prospect` to `qualified` to `negotiating`, there is no record of when transitions occurred. Reporting queries ("How long do leads stay in qualified?", "Which scans generate the most conversions?") cannot be answered. The audit trail for GDPR is also missing.

**Why it happens:**
Status history is treated as "nice to have" and deferred. It is trivial to skip when building the initial model but expensive to retrofit (requires a new `lead_status_history` table and backfilling historical transitions from `created_at`/`updated_at` — which don't capture intermediate states).

**Prevention:**

From day one, add a `lead_history` join table:
```python
class LeadHistory(Base, TenantMixin):
    __tablename__ = "lead_history"

    id: Mapped[uuid.UUID]
    lead_id: Mapped[uuid.UUID]  # FK to leads
    from_status: Mapped[str | None]  # NULL for initial creation
    to_status: Mapped[str]
    changed_at: Mapped[datetime]
    changed_by_user_id: Mapped[uuid.UUID | None]
    note: Mapped[str | None]  # Optional transition note
```

Insert a history record whenever `lead.status` changes. This can be done in the update endpoint or via a SQLAlchemy event listener.

**Detection:**
- User asks "When did this lead move to negotiating?" — cannot answer
- Business analytics dashboard needs conversion rates — cannot compute without timestamps
- GDPR audit requires showing when personal data was first associated — not trackable

**Phase to address:** Lead table design phase (before first migration)
**Urgency:** LOW — not urgent for MVP, but very hard to add retroactively

---

### Pitfall 13: Report-to-Lead FK Direction Confusion Causes Circular Dependency

**What goes wrong:**
When connecting `saved_reports` to the lead pipeline, there is ambiguity about the FK direction. If `saved_reports.lead_id` (report FK → lead) is added, deleting a lead would need to decide what to do with reports. If `leads.report_id` (lead FK → report) is added, creating a lead from a scan result requires a report to already exist. The wrong direction causes foreign key constraint violations at the wrong time.

**Why it happens:**
The entity relationship is genuinely bi-directional in the user's mental model ("a lead can have a report, a report can be promoted to a lead"). Developers model this ambiguity incorrectly on the first attempt.

**Consequences:**
- Report deletion fails because a lead FK prevents it
- Lead creation fails because no report exists yet
- Circular FK dependency confuses Alembic migration ordering

**Prevention:**

Model the relationship as report → lead (report is the anchor):
```python
# saved_reports.lead_id is nullable FK to leads
# ON DELETE SET NULL — deleting lead disconnects report but doesn't delete it
```

This reflects reality: a report can exist without a lead (user saved a report but hasn't started a deal), and a lead can exist without a report (created manually). Adding a report to an existing lead is an update to `saved_reports.lead_id`.

Never add `leads.report_id` — leads can have multiple reports (re-reports over time).

**Detection:**
- FK constraint error when deleting a report that has an associated lead
- Migration ordering error (`leads` table not yet created when adding FK from `saved_reports`)

**Phase to address:** Phase connecting reports to lead pipeline
**Urgency:** LOW — a design decision that needs to be correct from the start

---

### Pitfall 14: MapLibre GeoJSON Source Memory Leak on Component Unmount

**What goes wrong:**
When the scan results map component unmounts (user navigates to another route), the GeoJSON source cleanup removes the layer and source correctly, but MapLibre's web worker retains a reference to the serialized GeoJSON data. `AbortController` objects that were created for tile requests are not garbage collected. Memory consumption grows with each map mount/unmount cycle. Reproduced at ~5 mount cycles.

**Why it happens:**
MapLibre GL JS has documented memory leak issues (GitHub issue #4650, #4811, #6154) related to GeoJSON source updates and worker memory. The React cleanup function (`return () => removeParcelGeoJsonLayer(map)`) removes the layer from the DOM, but the serialized data in the worker thread is not released until the worker is explicitly terminated.

**Prevention:**

1. Keep the map instance alive across route changes (already recommended in the existing navigation pitfall from the v4.0 research — persistent layout pattern). If the map never unmounts, the worker never accumulates orphaned data.

2. When updating GeoJSON sources frequently (filter-driven updates), use `source.setData(null)` before removing the source to signal the worker to release memory:
   ```typescript
   function removeParcelGeoJsonLayer(map: maplibregl.Map): void {
     if (map.getSource(SOURCE_ID)) {
       // Signal worker to release data before removing source
       (map.getSource(SOURCE_ID) as GeoJSONSource).setData({
         type: 'FeatureCollection',
         features: [],
       });
     }
     // Then remove layer and source
     ...
   }
   ```

3. Prefer the MVT tile approach over GeoJSON for large datasets — MVT tiles are managed by the tile cache, not loaded in full into the worker.

**Detection:**
- Chrome Memory Profiler shows heap growth with each map unmount/remount cycle
- `maplibregl.Map` instances in memory snapshot after component unmount
- Browser tab memory usage grows over a session with frequent navigation

**Phase to address:** Phase adding GeoJSON parcel map layer
**Urgency:** LOW — single-session impact is manageable; long sessions or many navigations cause issues

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Lead table schema | Cross-tenant data leak (Pitfall 1) | TenantMixin + RLS policy + composite index |
| Lead table schema | No status history (Pitfall 12) | Add lead_history table from day one |
| Lead table schema | ENUM for status (Pitfall 7) | Use VARCHAR(50) + CHECK constraint, not PostgreSQL enum |
| Lead-report connection | FK direction confusion (Pitfall 13) | saved_reports.lead_id = nullable FK to leads |
| Lead-parcel connection | Parcel cache eviction deletes leads (Pitfall 6) | ON DELETE SET NULL + denormalize parcel_code |
| Parcel GeoJSON endpoint | Wrong coordinate system (Pitfall 2) | Always ST_Transform to 4326 in SQL query |
| Parcel GeoJSON endpoint | 5MB unfiltered response (Pitfall 10) | Add mandatory bbox parameter or use MVT tiles |
| MapLibre GeoJSON layer | UUID feature-state fails silently (Pitfall 3) | Use generateId: true or promoteId on source |
| MapLibre GeoJSON layer | setData bottleneck at 2000 parcels (Pitfall 5) | Use existing MVT tile endpoint instead |
| MapLibre GeoJSON layer | Memory leak on unmount (Pitfall 14) | Persistent map layout pattern + setData(empty) on cleanup |
| MVT tile endpoint | No tile cache, 600+ DB queries/minute (Pitfall 8) | Redis tile cache using existing ARQ Redis connection |
| Scan persistence | ARQ re-run crashes on duplicate ScanResult (Pitfall 4) | INSERT ... ON CONFLICT DO NOTHING |
| Scan persistence | Per-parcel flush causes 2000 DB round-trips (Pitfall 9) | Python uuid4() + batch flush every 100 rows |
| Registration bug fixes | RLS SET LOCAL with asyncpg (known pitfall) | Keep f-string pattern, never use $1 parameter in SET LOCAL |

---

## Sources

### MapLibre Feature State and GeoJSON
- [Feature id can only be positive integer when using feature-state · maplibre/maplibre-gl-js #1043](https://github.com/maplibre/maplibre-gl-js/issues/1043)
- [Optimising MapLibre Performance: Tips for Large GeoJSON Datasets](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [Partial updates for GeoJSON sources · maplibre/maplibre-gl-js #1236](https://github.com/maplibre/maplibre-gl-js/issues/1236)
- [Memory leak when updating a GeoJSON source faster than can be processed · #6154](https://github.com/maplibre/maplibre-gl-js/issues/6154)
- [Memory leak on map.remove() · maplibre/maplibre-gl-js #4811](https://github.com/maplibre/maplibre-gl-js/issues/4811)
- [Large number of feature state keys leads to zoom lag when loading cached tiles · #6633](https://github.com/maplibre/maplibre-gl-js/issues/6633)
- [GeoJSON & Vector Data Visualization — DeepWiki](https://deepwiki.com/maplibre/maplibre-gl-js/3.3-geojson-and-vector-data-visualization)

### PostGIS Geometry and Coordinate Projection
- [ST_AsGeoJSON — PostGIS Documentation](https://postgis.net/docs/ST_AsGeoJSON.html)
- [ST_Transform — PostGIS Documentation](https://postgis.net/docs/ST_Transform.html)
- [Projecting Data — Introduction to PostGIS](https://www.postgis.net/workshops/postgis-intro/projection.html)

### GeoAlchemy2 + Alembic
- [Use Alembic with GeoAlchemy2](https://geoalchemy-2.readthedocs.io/en/latest/alembic.html)

### PostgreSQL ENUM vs VARCHAR
- [Database ENUMs vs Constrained VARCHAR: A Technical Deep Dive](https://medium.com/@zulfikarditya/database-enums-vs-constrained-varchar-a-technical-deep-dive-for-modern-applications-30d9d6bba9f8)
- [ALTER TYPE enum migrations fail in PostgreSQL · prisma/prisma #5290](https://github.com/prisma/prisma/issues/5290)
- [Is It Time to Migrate from PostgreSQL Enum to String?](https://araqev.com/migrate-from-postgres-enum-to-string/)

### ARQ Background Jobs
- [ARQ Documentation — idempotency and at-least-once delivery](https://arq-docs.helpmanual.io/)
- [Building Resilient Task Queues in FastAPI with ARQ Retries](https://davidmuraya.com/blog/fastapi-arq-retries/)

### SQLAlchemy Async + Bulk Operations
- [Using staging tables for faster bulk upserts with Python and PostgreSQL](https://overflow.no/blog/2025/1/5/using-staging-tables-for-faster-bulk-upserts-with-python-and-postgresql/)
- [SQLAlchemy Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html)

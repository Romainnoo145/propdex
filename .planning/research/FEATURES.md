# Feature Research

**Domain:** PropTech Lead Pipeline, Scan Persistence, and Map Visualization for Property Intelligence Platform
**Researched:** 2026-02-18
**Confidence:** HIGH (codebase analysis) / MEDIUM (PropTech pipeline patterns) / HIGH (map layer patterns)

---

## Context: What Already Exists

Before categorizing features, it is critical to know what v4.0 shipped — these are NOT new features.

**Already built (do not re-build):**
- AreaScan model: `id`, `gemeente_code`, `wijk_naam`, `project_id`, `bbox_*`, `status`, `progress_pct`, `parcels_total/processed/failed`, `started_at`, `completed_at`, `job_id`
- ScanResult model: join table linking AreaScan → ParcelCache with `score` and `flags` JSONB
- ParcelCache: full parcel data, `enrichment_data`, `enriched_at`
- Project model: name, description, `parent_id` (hierarchical), `gemeente_code`, `wijk_naam`, `is_monitored`
- SavedReport model: JSONB report, notes, `project_id`, soft-delete
- Scan API: trigger, poll status, list results (paginated, filtered, sorted), cancel, export Excel, MVT tile endpoint
- Projects API: CRUD (name, description only — no lead status, no scan linkage)
- Map: ParcelScoreLayer with score-based fill colors (red→orange→yellow→green), hover/select feature states, InspectorPanel slide-over
- Results table: filtering, sorting, checkbox selection, bulk Excel export
- Change monitoring: daily SRU + PLU delta checks
- Reports: save, search, PDF export

**What is missing (new features for this milestone):**
1. Lead/deal pipeline: no `LeadStatus` concept exists anywhere in the codebase
2. Scan history: AreaScans are saved but there is no UI to list/revisit past scans — the results page requires a `scan_id` URL param; without it, users see an empty state
3. Map scan visualization: only the most recent/active scan is shown; no way to load a previous scan's tiles onto the map
4. Report-to-lead linkage: SavedReport has `project_id` but no `lead_status` or direct scan connection
5. Bug fixes: several known UX issues

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Scan history list** | Any tool that runs async jobs shows past job history; users lose work if scan_id is not bookmarked | LOW | Backend already stores AreaScans per org. Need `GET /api/scans` endpoint (list) + frontend scan history page or modal |
| **Revisit old scan results** | Users scan a wijk, leave, return — expect to find results waiting | LOW | Data exists in DB. Need scan picker UI (dropdown or dedicated page) that sets scan_id and loads results |
| **Lead status on a parcel** | Any acquisition workflow tool shows "what stage is this deal?" — users track which parcels are being investigated | MEDIUM | New model: `LeadStatus` enum. Attach to ScanResult or standalone Lead model referencing parcel_id |
| **Pipeline stage transitions** | Users move leads through stages with a click or dropdown; standard CRM pattern | LOW | Simple PATCH endpoint + UI select/dropdown in InspectorPanel or results table |
| **Pipeline view (all leads)** | Users want to see all their tracked parcels across scans in one place | MEDIUM | New "Leads" page or extend Projects page. Query leads by org, grouped by status |
| **Scan context on map (reload)** | When returning to the map, users expect to see the scan they were viewing still highlighted | LOW | Already exists partially (`scan_id` URL param on `/map`). Need to persist MVT tile layer on navigation return |
| **Report linked to lead** | When a report is saved from a parcel, it should appear in the lead's detail view | MEDIUM | Add `lead_id` FK to SavedReport (or query by `parcel_id`) |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Lead status visible on map** | Color-coded parcels by pipeline stage (not just score) — instantly see "which of these leads is in onderhandeling?" | MEDIUM | New MVT tile layer or overlay that colors parcels by lead_status instead of score. Toggle between score-view and lead-view |
| **Dutch pipeline stages (domain-fit)** | Stages named in Dutch: Nieuw, Onderzoek, Contact, Onderhandeling, Afgewezen, Gekocht — resonates with NL/BE developers vs generic English CRM | LOW | Enum values, labels in NL. No translation overhead |
| **Scan history with metadata** | Scan list shows: gemeente name, wijk, date, parcel count, how many leads created — contextual, not just a UUID list | LOW | Existing AreaScan fields cover this. Just needs a good list UI |
| **Lead notes per parcel** | Developers jot down: "Spoke with eigenaar 2026-01-10", "Waiting for bestemmingsplan response" — notes are time-stamped | MEDIUM | Add `notes` text field to Lead model, or use a separate LeadNote log table for history |
| **Filter results by lead status** | In the results table, show only "Nieuw" leads, or hide "Afgewezen" — reduces noise in large scans | LOW | Add `lead_status` filter to existing results filter panel. Backend: LEFT JOIN Lead on parcel_id |
| **Scan comparison across time** | "Re-scan this wijk 3 months later — what changed?" — overlay two scan MVT tiles to spot new opportunities | HIGH | Complex: requires diffing ScanResult sets by parcel_id. Defer to v5.1 unless straightforward |
| **Lead count badge on wijk overlay** | When viewing a gemeente on the map, show how many leads exist per wijk as a number badge | MEDIUM | GeoJSON properties include lead count. Computed server-side. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full CRM with contacts, tasks, emails** | Real estate developers also manage relationships with eigenaren, brokers | Scope explosion; Propdex is a property intelligence tool not a CRM | Add a "notes" field per lead; integrate with existing CRM via CSV export |
| **Kanban board for leads** | Dealpath and others use kanban for visual pipeline management | High frontend complexity; adds little over a simple status dropdown when lead counts are small (10s not 100s) | Simple status filter + pipeline summary count badges per stage |
| **Real-time multi-user lead updates** | Teams want to see when a colleague moves a lead | Requires WebSockets, presence state, conflict resolution — massive scope | Accept last-write-wins; multi-user is a v2 concern |
| **Auto-advance pipeline stages** | "Automatically move to Onderzoek when report is saved" | Business logic varies wildly per organization; leads to unexpected state | Manual stage transitions only; explicit user action |
| **Historical audit log for every field change** | Compliance mindset wants full change history | Complex event sourcing or shadow tables; not needed at this user scale | Just store `updated_at` on Lead; notes field covers audit intent |
| **Automatic scan scheduling** | "Re-scan every 30 days automatically" | Change monitoring already handles this via SRU Bekendmakingen; duplicate concern | Leverage existing change monitoring; surface new bekendmakingen as "scan may need refresh" |
| **AI-scored lead prioritization** | "AI ranks leads by purchase likelihood" | Training data does not exist yet; scores are already provided by parcel_scoring service | Expose existing score prominently in leads view; real ML requires 6+ months of data |

---

## Feature Dependencies

```
Scan History List (GET /api/scans endpoint)
    └──enables──> Scan Picker UI (frontend)
                      └──enables──> Revisit Old Scan on Map
                                        └──enhances──> Lead Status Layer on Map

Lead Model (new DB table)
    ├──requires──> ScanResult (parcel_id FK source)
    ├──requires──> Parcel data (for display: address, score, area)
    └──enables──> Pipeline Status Transitions
                      ├──enables──> Pipeline View (all leads page)
                      ├──enables──> Filter by Lead Status (in results table)
                      └──enables──> Lead Status on Map (color layer)

Report Linkage to Lead
    ├──requires──> Lead Model
    └──requires──> SavedReport (existing)
        └──enables──> Lead Detail View with attached reports

Lead Notes
    └──requires──> Lead Model
    └──enables──> Lead audit trail (lightweight)
```

### Dependency Notes

- **Scan history requires backend list endpoint first:** The AreaScan table exists but `GET /api/scans` (list all org scans) is not implemented. This is required before any frontend scan picker can work.
- **Lead model is the central dependency:** Everything pipeline-related depends on a Lead DB model. Build this in the first phase.
- **Map lead-status layer enhances but does not require pipeline view:** They can be built in parallel once Lead model exists.
- **Filter by lead status in results table:** Requires a LEFT JOIN from ScanResult to Lead on parcel_id. Moderately complex SQL but straightforward with existing service pattern.
- **Report linkage is additive:** Can be done by querying SavedReport WHERE parcel address matches, or by adding an explicit `lead_id` FK. The FK approach is cleaner.

---

## MVP Definition

This is a subsequent milestone (not v1), so MVP here means "minimum to close the gap users feel."

### Launch With (this milestone)

- [ ] **Scan history list + scan picker** — The single most-requested missing feature. Users lose access to previous scan results.
- [ ] **Lead model** (Nieuw, Onderzoek, Contact, Onderhandeling, Afgewezen, Gekocht) — Foundation for everything else.
- [ ] **Lead status in results table** — Dropdown per row, visible without opening InspectorPanel.
- [ ] **Lead status in InspectorPanel** — Full detail with notes text area.
- [ ] **Pipeline summary view** — Simple count-per-stage dashboard, not full kanban. "6 Nieuw, 3 Onderzoek, 1 Gekocht."
- [ ] **Filter results by lead status** — Hide Afgewezen by default; filter to specific stage.
- [ ] **Restore scan tile layer on map** — When returning to map with `scan_id` param, reload MVT score tiles (already partially implemented; solidify).

### Add After Validation (v5.x)

- [ ] **Lead status color layer on map** — Once leads exist, color parcels by stage instead of score. Adds big value but requires leads to exist first.
- [ ] **Lead notes history (log)** — After single `notes` text field is validated, upgrade to timestamped note log.
- [ ] **Report linked to lead in UI** — Show attached reports in InspectorPanel lead section.
- [ ] **Lead count badge on wijk overlay** — Visual quick-scan of activity density per wijk.

### Future Consideration (v6+)

- [ ] **Scan comparison across time** — High complexity; meaningful only when users have 6+ months of scan data.
- [ ] **Multi-user lead collaboration** — WebSockets, presence, conflict resolution. Scale concern.
- [ ] **Scheduled re-scan triggers** — Overlap with change monitoring; evaluate if users outgrow existing monitoring.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Scan history list + picker | HIGH | LOW (backend endpoint + simple UI) | P1 |
| Lead model (DB + API) | HIGH | MEDIUM (new table, CRUD endpoints) | P1 |
| Lead status in results table | HIGH | LOW (dropdown + PATCH call) | P1 |
| Lead status in InspectorPanel | HIGH | LOW (extend existing panel) | P1 |
| Pipeline summary view | HIGH | LOW (count query + simple UI) | P1 |
| Filter results by lead status | MEDIUM | MEDIUM (SQL JOIN, filter param) | P2 |
| Restore scan tiles on map | MEDIUM | LOW (solidify existing partial impl) | P2 |
| Lead status color layer on map | HIGH | MEDIUM (new MVT endpoint or client-side overlay) | P2 |
| Lead notes | MEDIUM | LOW | P2 |
| Report linkage to lead | MEDIUM | MEDIUM | P3 |
| Lead count badge on wijk | LOW | MEDIUM | P3 |
| Scan comparison | LOW | HIGH | Defer |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, ship when P1 complete
- P3: Nice to have, fold in if time allows

---

## Domain-Specific Feature Details

### Dutch Pipeline Stages

Based on standard NL real estate acquisition workflow (HIGH confidence — common across NL PropTech):

| Stage | Dutch Label | Meaning | Trigger |
|-------|-------------|---------|---------|
| 1 | **Nieuw** | Newly discovered, no action yet | Auto-set when user adds parcel to pipeline |
| 2 | **Onderzoek** | Under investigation (desk research, valuation) | User manually moves |
| 3 | **Contact** | Outreach to eigenaar or broker initiated | User manually moves |
| 4 | **Onderhandeling** | Negotiation in progress | User manually moves |
| 5 | **Afgewezen** | Rejected / not a fit | User manually moves (terminal, filterable) |
| 6 | **Gekocht** | Acquired / deal closed | User manually moves (terminal, success state) |

**Design note:** Afgewezen and Gekocht are terminal states. They should be visually distinct (grey-out vs green-highlight). The pipeline summary should let users hide Afgewezen by default to reduce noise.

### Scan History UX Pattern

Standard pattern in any async-job tool (job history, CI/CD, ETL pipelines):

- List view: most recent first, with gemeente name, wijk name, scan date, parcel count, status badge
- Status badge: "Voltooid" (green), "Mislukt" (red), "Bezig" (amber spinner), "Geannuleerd" (grey)
- Click to load: clicking a past scan sets it as the active scan — loads results table and (if on map) the MVT tile layer
- Age indicator: "3 weken geleden" relative timestamps — users understand data freshness
- Re-scan option: "Opnieuw scannen" per row if scan is >30 days old (aligns with existing `needs_rescan` logic)

### Map Lead-Status Layer

The existing ParcelScoreLayer uses a score gradient (0-100) mapped to red→green colors. The lead-status layer uses categorical colors:

| Stage | Color | Rationale |
|-------|-------|-----------|
| Nieuw | #6366f1 (indigo) | Neutral "new" color, doesn't imply good/bad |
| Onderzoek | #f59e0b (amber) | Active investigation, matches brand accent |
| Contact | #3b82f6 (blue) | Communication in progress |
| Onderhandeling | #8b5cf6 (purple) | High stakes, premium feel |
| Afgewezen | #6b7280 (grey) | Deprioritized, muted |
| Gekocht | #22c55e (green) | Success, closed deal |

**Toggle mechanic:** Add a map layer toggle "Toon leadstatus" that swaps between score-coloring and lead-status-coloring. Parcels without a lead assignment show at reduced opacity or not at all (user preference).

**Implementation approach:** Two options:
1. New MVT endpoint `GET /api/scans/{scan_id}/lead-tiles/{z}/{x}/{y}.pbf` — includes `lead_status` property per parcel, colored client-side via MapLibre expression. Clean but requires backend work.
2. GeoJSON overlay: fetch all leads for a scan as GeoJSON, overlay as a separate layer. Works for small counts (<500 leads), breaks at scale.

Recommend option 1 (MVT) because it reuses existing tile infrastructure and scales to full scan sizes.

### Scan Persistence Pattern

Current flow (broken): scan runs → auto-navigates to `/resultaten?scan_id=X` → user closes tab → scan_id lost.

Correct flow:
1. Backend: `GET /api/scans?limit=20&offset=0` — list org's scans, newest first. Already have all data, just need the endpoint.
2. Frontend scan picker: dropdown or dedicated panel on the results page. "Kies een scan" → selects scan_id → loads results.
3. Map integration: when user selects a scan from picker on the results page and switches to map view, pass `scan_id` as URL param → map.tsx restores the MVT tile layer.
4. Persistence: store `lastActiveScanId` in localStorage as a fallback. Clear on logout.

**No new backend models needed** — AreaScan already stores everything required. The gap is purely a missing list endpoint + frontend scan-picker UI.

### Report Integration

Current state: SavedReport has a `project_id` FK but no `parcel_id` or `lead_id` FK. Reports are linked to projects (folder-level), not to specific parcels.

Options:
1. **Add `parcel_id` to SavedReport** — enables querying "all reports for this parcel" across scans. Clean but requires migration.
2. **Query by address/postcode match** — fuzzy. Unreliable if address format differs.
3. **Add `lead_id` FK to SavedReport** — couples reports to the lead pipeline. Clear intent but only works once Lead model exists.

Recommend option 3 (nullable `lead_id` FK) because it makes the relationship explicit and enables "reports attached to this lead" queries. The address-report link is still discoverable via `parcel_code` / `postcode` in report_data JSONB if needed.

---

## Bug Fix Scope

The milestone description mentions bug fixes. Based on codebase review, known gaps likely to surface:

| Bug / Gap | Location | Likely Fix |
|-----------|----------|------------|
| `GET /api/scans` missing | Backend | Add list endpoint |
| Scan tiles lost on page navigation | Map → Results → Map | Solidify `scan_id` URL param restoration logic in `map.tsx` |
| Results page empty state when no `scan_id` | `/resultaten` | Replace "Selecteer een scan op de kaart" with scan picker |
| Projects page empty (no scans linked in UI) | `/projecten` | Show scans attached to project; enable scan selection from project |
| `force_rescan` not exposed in UI | Scan flow | Add "Opnieuw scannen" button in scan history list |

---

## Competitor Feature Analysis

| Feature | Dealpath | Northspyre | Propdex (current) | Propdex (target) |
|---------|----------|------------|-------------------|-----------------|
| Deal pipeline stages | Yes (customizable) | Yes (acquisition→construction) | None | Dutch 6-stage enum |
| Pipeline kanban board | Yes | Yes | None | Not building (count summary only) |
| Notes per deal | Yes (full history) | Yes | Notes on SavedReport | Notes on Lead |
| Map with deal status | No | No | Score only | Score + lead status toggle |
| Scan/search history | N/A (manual entry) | N/A | Partial (no list endpoint) | Full scan history list |
| Report attached to deal | Yes | Yes | Project-level only | Lead-level FK |
| Dutch language UX | No | No | Yes (partial) | Yes (all pipeline labels NL) |

**Key insight:** Dealpath and Northspyre are general CRE platforms requiring manual data entry. Propdex's differentiator is that leads are *discovered automatically* via scanning — the pipeline tracks what the scan found, not what the user typed in. This distinction should be preserved: leads are created from scan results, not from scratch.

---

## Sources

- Codebase analysis: `backend/app/models/area_scan.py`, `scan_result.py`, `project.py`, `report.py` (HIGH confidence — direct inspection)
- Codebase analysis: `backend/app/scans/router.py`, `projects/router.py` (HIGH confidence — direct inspection)
- Codebase analysis: `frontend/src/routes/_authenticated/resultaten.tsx`, `map.tsx`, `projecten.tsx` (HIGH confidence — direct inspection)
- Codebase analysis: `frontend/src/components/map/ParcelScoreLayer.tsx` (HIGH confidence — direct inspection)
- [Dealpath: Real Estate's Leading Deal Management Software](https://www.dealpath.com/) (MEDIUM confidence — marketing page)
- [Real Estate Deal Pipeline Management & Workflows | Dealpath](https://www.dealpath.com/deal-pipeline-management/) (MEDIUM confidence)
- [9 Best Real Estate Development Software for 2025 | Northspyre](https://www.northspyre.com/blog/best-real-estate-development-software) (MEDIUM confidence)
- [Guide to Real Estate Pipeline Stages - reSPACio](https://respacio.com/real-estate-software/contact-management/guide-to-real-estate-pipeline-stages/) (MEDIUM confidence)
- [Build Dynamic Real Estate Maps and Insights with Mapbox](https://www.mapbox.com/real-estate) (MEDIUM confidence)
- [Display HTML clusters with custom properties | Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/example/cluster-html/) (HIGH confidence — official docs)
- [Real estate intelligence with the MTS (Mapbox Tiling Service)](https://www.mapbox.com/blog/real-estate-intelligence-with-the-mts-mapbox-tiling-service) (MEDIUM confidence)
- [2026 PropTech Trend Predictions | Northspyre](https://www.northspyre.com/blog/2026-proptech-trends) (LOW confidence — marketing)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| What already exists | HIGH | Direct codebase reading — no guessing |
| Dutch pipeline stages | HIGH | Standard NL real estate practice; consistent across industry sources |
| Scan history UX pattern | HIGH | Universal async-job-history pattern across SaaS tools |
| Lead model design | HIGH | Simple status enum + FK; well-established pattern |
| Map lead-status layer | MEDIUM | MVT + MapLibre approach verified via Mapbox docs; lead-coloring is custom but technically straightforward |
| Report-lead linkage | MEDIUM | FK approach is clean but migration + schema impact needs architecture phase to confirm |
| Bug fix scope | MEDIUM | Identified from code reading; actual bugs only visible in running app |
| Competitor comparison | MEDIUM | Dealpath/Northspyre from marketing sites; features described at high level only |

---
*Feature research for: Propdex v5.0 — Lead Pipeline, Scan Persistence, Map Visualization*
*Researched: 2026-02-18*

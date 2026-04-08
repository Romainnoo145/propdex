# Pitfalls Research

**Domain:** Portfolio management + deal pipeline + outreach automation added to existing property intelligence platform (v17.0 Projecten Portfolio)
**Researched:** 2026-03-15
**Confidence:** HIGH — all pitfalls verified against actual codebase models, schemas, existing frontend code, and AVG/GDPR framework constraints

---

## Critical Pitfalls

### Pitfall 1: Conflating "Project as folder" with "Project as deal" — using the same model for both

**What goes wrong:**
The existing `Project` model (`backend/app/models/project.py`) is a report-folder organizer. It has `name`, `description`, `parent_id` (for gemeente→wijk hierarchy), `gemeente_code`, `wijk_naam`, and `is_monitored`. The v17 milestone introduces a "deal workspace" concept per parcel with pipeline stages, dossier completeness, outreach tracking, and notes. The tempting shortcut is to extend the `Project` model with pipeline fields (`status`, `pipeline_stage`, `parcel_id`, etc.) since it already exists and has org isolation.

This path leads to a model that is simultaneously a gemeente monitoring folder AND a deal workspace. The self-referential `parent_id` hierarchy (`gemeente → wijk → project`) breaks when projects also represent parcel-level deals. Every query that lists "top-level projects" (`parent_id IS NULL`) now has to distinguish folder-type from deal-type. The `ProjectList.tsx` component (1867 lines) already does `topLevelProjects = allProjects.filter(p => p.parent_id === null)` — adding deal-type projects to this result set corrupts the portfolio navigation view.

**Why it happens:**
The `Project` model is nearby, has `organization_id`, `TenantMixin`, and relationships to `AreaScan` already. Adding a `project_type` discriminator column feels cheaper than a migration for a new table. This is the classic "add one more column" trap.

**How to avoid:**
Introduce a separate `ParcelProject` model (or `Deal` model) with its own table. Fields: `id`, `organization_id`, `parcel_id` (String, Kadaster key), `parcel_cache_id` (FK to parcel_cache.id), `pipeline_stage`, `notes`, `created_by_user_id`, `created_at`, `updated_at`. This model does NOT extend `Project` and does NOT participate in the parent/child folder hierarchy. The `Project` model remains a gemeente/wijk monitoring folder. The new model is a deal workspace attached to a specific parcel.

Keep the two concepts visually unified in the frontend (both live under `/projecten`) but backed by separate API endpoints and models.

**Warning signs:**
- Migration adding `pipeline_stage`, `parcel_id`, or `project_type` to the `projects` table
- A query that filters `WHERE project_type = 'deal'` or `WHERE project_type = 'folder'`
- `ProjectList.tsx` receiving deal-type objects mixed with gemeente folder objects

**Phase to address:**
The phase that introduces "favorite a parcel → create workspace" should define the new model. Enforce the separation in the schema design review before writing any migration.

---

### Pitfall 2: Favorites stored only in localStorage — losing them on new device, incognito, or multiple-user org

**What goes wrong:**
`ProjectList.tsx` already uses `localStorage` keys `propdex:favorite-gemeenten` and `propdex:recent-gemeenten` (lines 93–95). The v17 milestone plans parcel-level favorites ("heart button → save parcel to its wijk"). If parcel favorites follow the same localStorage pattern, users lose their entire favorites list when they:
- Switch to a different browser or device
- Clear browser storage (privacy-conscious users, IT policy)
- Work in a multi-user org where two analysts research the same area

The specific failure mode: user favorites 30 parcels across 5 wijken during a field research day, returns to the office on a different machine, all favorites are gone. They re-favorite some from memory, losing the rest permanently.

**Why it happens:**
localStorage is zero-infrastructure, instant, and already the pattern in the codebase for gemeente favorites. It's the fastest path for MVP. The cost is invisible until a real user loses data.

**How to avoid:**
Server-side favorites from day one for parcel-level favorites (they are the core portfolio data). Use a `ParcelFavorite` table: `id`, `organization_id`, `user_id`, `parcel_id` (String — Kadaster key), `parcel_cache_id` (FK — nullable, populated when parcel is in cache), `wijk_naam`, `gemeente_code`, `favorited_at`. Use a `UNIQUE(organization_id, user_id, parcel_id)` constraint to prevent duplicates.

Gemeente-level favorites can stay in localStorage (they're a navigation preference, not business data). Parcel favorites are business data and must be server-side.

Migration strategy: the parcel favorites feature is NEW — there is no existing localStorage parcel data to migrate. No migration needed. Simply build server-side from the start.

**Warning signs:**
- `localStorage.setItem('propdex:favorite-parcels', ...)` in any new code
- A `useFavoritesParcels` hook that reads/writes only localStorage
- No migration in `backend/alembic/versions/` for a `parcel_favorites` table

**Phase to address:**
The phase introducing the heart/favorite button on the parcel detail panel.

---

### Pitfall 3: Kadaster `parcel_id` is a string key, not a UUID — join semantics differ from all other FK patterns

**What goes wrong:**
Every other model in the system uses UUID primary keys. `ParcelCache` has a UUID `id` column AND a separate string `parcel_id` column (e.g., `"HTT02-A-1234"` — the Kadaster identifier). New models that reference parcels (favorites, deals, pipeline entries) will be built by developers who see `UUID` everywhere and instinctively use `ForeignKey("parcel_cache.id")`. This works until a parcel is re-scanned and a new `ParcelCache` row is created (which can happen when a wijk is re-scanned — the `ON CONFLICT DO NOTHING` pattern means a new row may exist with a different UUID but the same `parcel_id` string).

More critically: `parcel_id` (the string) is the stable Kadaster identifier. `parcel_cache.id` (UUID) is an internal database row identifier that can be regenerated. The `ScanResult` model uses `parcel_id: Mapped[uuid.UUID]` pointing to `parcel_cache.id` — which is correct for scan results. But for "I favorited parcel HTT02-A-1234", the stable key is the Kadaster string, not the database UUID.

**Why it happens:**
SQLAlchemy FK patterns in the codebase all use UUIDs. New developers follow the existing pattern without reading the comment on `ParcelCache.parcel_id` that says "Kadaster parcel identifier".

**How to avoid:**
For all new portfolio/favorites models: store BOTH fields.
- `parcel_id: String(50)` — the stable Kadaster key (for querying, display, BRK lookups)
- `parcel_cache_id: UUID | None` — FK to `parcel_cache.id`, NULLABLE (parcel may not be in cache yet)

Use the Kadaster string as the lookup key for display. Use the cache FK only when joining to scan data. Add a compound index on `(organization_id, parcel_id)` for lookup performance.

**Warning signs:**
- New model with `ForeignKey("parcel_cache.id", ondelete="CASCADE")` as the ONLY parcel reference
- A favorite or deal that disappears when parcel_cache is re-created
- Frontend parcel IDs coming from the map click handler (these are the Kadaster strings from tile metadata, not UUIDs)

**Phase to address:**
Schema design phase for both favorites and deal workspace models. Enforce in code review: any new model touching a parcel must carry the Kadaster string.

---

### Pitfall 4: Pipeline state machine without guards — illegal transitions cause data integrity issues

**What goes wrong:**
The pipeline spec is: `Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond`. Without transition guards on the backend, the frontend can POST any stage value directly and skip stages. A deal jumps from `Gesignaleerd` to `Afgerond` in one click. This is hard to audit later ("when did we make contact?") and corrupts reporting ("how many deals are in Onderzoek?").

Additionally, without a transition history table, there is no audit trail. If a deal regresses from `Besluit` back to `Contact` (owner stopped responding), there is no record of when that happened or why. The current timestamp on `updated_at` only captures the last change.

**Why it happens:**
"We can add validation later" is the typical deferral. The PATCH endpoint becomes `{ pipeline_stage: "any_string" }` with no validation, and fixing it after data is dirty requires a migration + data repair.

**How to avoid:**
1. Define stage as an Enum in the Python model: `class PipelineStage(str, Enum)` — Pydantic will reject invalid values automatically.
2. Add a `pipeline_stage_transitions` table: `(deal_id, from_stage, to_stage, changed_by_user_id, changed_at, note)`. Immutable audit log. One INSERT per transition.
3. Keep allowed transitions list in the backend service, not just the frontend: `ALLOWED_TRANSITIONS = { "gesignaleerd": ["onderzoek"], "onderzoek": ["contact", "gesignaleerd"], ...}`. Return 422 if the requested transition is not in the allowed list.

This is not over-engineering. Real estate deals are legally sensitive and users need to know when "Contact" started for timing purposes (municipality pre-consultations have deadlines).

**Warning signs:**
- PATCH endpoint accepting arbitrary `pipeline_stage` string with only Pydantic `str` type
- No `pipeline_transitions` table or equivalent audit log in the schema
- Frontend directly setting `pipeline_stage` without calling a dedicated transition endpoint

**Phase to address:**
The phase introducing the pipeline stage feature. The transition table should be in the same migration as the pipeline_stage column.

---

### Pitfall 5: Outreach templates generate emails containing BRK eigendomsdata — AVG/GDPR violation

**What goes wrong:**
The v17 milestone includes "automated outreach templates: brief naar eigenaar". The BRK eigendomsdata (owner name, address, KvK number) is fetched ephemerally and never stored (Tier 3 data). If outreach templates are populated with BRK data and stored as "sent outreach" records, the platform begins storing personal data (owner names, addresses) from Kadaster in its database.

This violates the explicit design decision in `ParcelCache` ("Tier 3: BRK eigendomsdata = NEVER stored here") and requires a new AVG/GDPR legal basis justification. The Kadaster BRK API terms of service specify that data must not be stored beyond the session needed for the specific legitimate purpose query.

Additionally, if an outreach email is generated with an owner's home address and sent, this constitutes direct marketing to a natural person, which requires an opt-in basis under AVG Article 6 and may require a verzenddatum in a register (Article 30 processing activities). Sending letters to homeowners without a documented legal basis is a fine risk.

**Why it happens:**
"The template needs the owner's name to be personal, let's pre-fill it from the BRK modal that's already open." The UX is elegant in the moment. The compliance cost is invisible until an AVG audit.

**How to avoid:**
1. Templates must NOT store or log the owner's name/address from BRK data. The template placeholders remain unfilled in the stored record: `"Geachte {naam_eigenaar},"` — the user fills them manually before sending.
2. If the platform sends emails on behalf of the user (not just generates a Word document), add a prominent disclaimer: "U bent zelf verantwoordelijk voor de AVG-grondslag van deze correspondentie."
3. For `rechtspersoon` (companies/BVs), storing the company name and KvK number is fine (company data, not personal data). For `natuurlijk_persoon`, never store the name.
4. The "sent outreach" log should store: `(parcel_id, sent_at, sent_by_user_id, template_type, recipient_type: 'rechtspersoon' | 'overheid' | 'niet-opgeslagen')` — never the actual recipient name/address for natural persons.

**Warning signs:**
- A `ParcelOutreach` model with `recipient_naam`, `recipient_adres` columns as String
- An outreach template that fetches BRK data and stores the rendered template text
- Backend storing any response from `/api/scans/parcels/{id}/eigendom` beyond the HTTP response cycle

**Phase to address:**
The outreach templates phase. Define the data retention policy before building the template engine.

---

### Pitfall 6: Multi-parcel grouping creates N+1 query explosion for portfolio views

**What goes wrong:**
The portfolio view needs to show: provincie → gemeente → wijk → favorited parcels. For each parcel card, it needs: parcel metadata (from `parcel_cache`), scan score (from `scan_results`), document count (from `parcel_documents`), pipeline stage (from the new deal model), and possibly the latest enrichment flag (from `scan_results.flags`). If each parcel card fetches these independently, a wijk with 50 favorited parcels fires 250 backend requests.

In `ProjectList.tsx`, the current pattern already fetches scan history separately (`useScanHistory`) and joins it client-side with gemeente data. That pattern scales to 10-20 items. At 50+ favorited parcels across multiple wijken, the client-side join approach breaks.

**Why it happens:**
TanStack Query makes it easy to fire independent queries per item. `useQuery(parcel_details_${id})` per parcel card seems clean (independent caching, individual loading states) until scale reveals the problem.

**How to avoid:**
Build a dedicated portfolio list endpoint that returns all data needed for a wijk's parcel cards in a single query:

```
GET /api/portfolio/wijken/{wijk_code}/parcels
Response: [{
  parcel_id, address, score, document_count, pipeline_stage, favorited_at, flags_summary
}]
```

This endpoint does a single JOIN across `parcel_favorites`, `parcel_cache`, `scan_results`, `parcel_documents` (COUNT), and the new deal model. Returns everything the card needs. One HTTP request per wijk.

**Warning signs:**
- `useQuery(parcelDetails_${parcel_id})` fired inside a `.map()` over a list of favorites
- The portfolio wijk view taking 3+ seconds to load with 20 favorites
- Backend logs showing 50+ identical queries per page load

**Phase to address:**
The portfolio list view phase. The bulk endpoint must be designed before the frontend component is built, not added as a fix-up later.

---

### Pitfall 7: ProjectList.tsx at 1867 lines — adding portfolio features causes unmaintainable spaghetti

**What goes wrong:**
`ProjectList.tsx` currently handles: provincie/gemeente/wijk drill-down navigation, scan history integration, CBS data display, gemeente monitoring subscriptions, SVG boundary rendering, change timelines, and localStorage favorites for gemeenten. Adding parcel favorites, deal pipeline, workspace expansion, and outreach into the same component produces a 3000+ line file where state changes in the favorites section inadvertently re-render the entire gemeente tree.

The existing component already has deeply nested conditional rendering for `selectedGemeenteId`, `selectedWijkId`, `selectedProvinceCode`. Adding a fourth level (`selectedParcelId`) without extracting sub-components causes a combinatorial explosion of render conditions.

**Why it happens:**
"The component already does similar things, I'll add a section." The spaghetti grows one feature at a time. Each addition seems small in isolation.

**How to avoid:**
Before adding any v17 features, extract the `ProjectList.tsx` into a routing hierarchy:
- `ProjectenPage.tsx` — top-level shell, loads portfolio data, owns URL state
- `ProvincieView.tsx` — province-level cards
- `GemeenteView.tsx` — already extracted as `GemeenteDetailView.tsx` (reuse)
- `WijkView.tsx` — already extracted as `WijkDetailView.tsx` (reuse)
- `ParcelPortfolioView.tsx` — NEW: list of favorited parcels per wijk with deal cards

Each view component receives its data as props, does not read URL params directly (the parent reads URL, passes data). This makes each piece independently testable.

The refactoring effort is 2-4 hours and prevents a full rewrite 3 phases later.

**Warning signs:**
- Adding v17 features directly into `ProjectList.tsx` without extraction
- `ProjectList.tsx` line count exceeds 2000
- `useState` count in `ProjectList.tsx` exceeds 12

**Phase to address:**
The first v17 phase (whatever introduces the portfolio navigation). Refactor first, then add features.

---

### Pitfall 8: Email/SMTP setup for outreach — reputation, deliverability, and spam classification

**What goes wrong:**
If the platform generates and sends outreach emails directly (as opposed to just generating Word/PDF letter templates), it enters a minefield:
- Emails to property owners without prior consent are classified as unsolicited commercial email under the Dutch Telecommunicatiewet Article 11.7 if sent to individuals
- A shared SMTP server (e.g., SendGrid trial, basic SES) sending 100 outreach emails per day across multiple organizations gets the sending domain blacklisted within weeks if any recipient marks as spam
- Without proper SPF/DKIM/DMARC records on the sending domain, major Dutch ISPs (KPN, Ziggo) will reject or spam-folder the emails
- No bounce handling means repeated sends to invalid addresses, worsening reputation

**Why it happens:**
"Let's just add email sending via SendGrid, it's 3 lines of code." The infrastructure complexity is underestimated. This is the #1 reason outreach features in PropTech products are abandoned.

**How to avoid:**
For v17 MVP: generate letter templates as downloadable DOCX/PDF only. Do NOT build email sending. The user prints or emails the letter themselves. This is safer, AVG-compliant (user controls the send), and eliminates infrastructure complexity.

If email sending is required in a future phase: use a dedicated subdomain (`brief@mail.propdex.nl`), configure SPF/DKIM/DMARC, use a transactional email provider with bounce/complaint webhooks (Postmark or AWS SES), and build hard-bounce suppression lists per organization. This is a 2-4 week engineering effort that should be its own milestone.

**Warning signs:**
- Adding `smtplib` or `aiosmtplib` to backend dependencies
- SendGrid or Mailgun API key appearing in `backend/.env`
- An outreach endpoint that POSTs directly to an email API

**Phase to address:**
Outreach templates phase. Gate the MVP at "generate template" and explicitly defer "send email" to a future milestone with proper infrastructure planning.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store parcel favorites in localStorage | Zero backend work | Lost on new device, lost in multi-user org, corrupt on storage clear | Never for parcel-level business data |
| Add `pipeline_stage` to existing `Project` model | No new table/migration | Folder projects mixed with deal projects, corrupts ProjectList filtering | Never |
| Accept arbitrary string for `pipeline_stage` in PATCH endpoint | Fast to build | Dirty data, no audit trail, impossible to report on | Never |
| Skip transition audit log | Faster MVP | No "when did contact start?" data, can't reconstruct deal history | Never for deals with legal significance |
| Generate outreach emails server-side in MVP | "Complete" feature | AVG exposure, deliverability infrastructure debt, spam complaints | Never in MVP — defer to dedicated milestone |
| Client-side join of favorites + scan scores | Simple frontend code | N+1 fetches at scale, slow portfolio view with 50+ parcels | Only with < 10 items max and explicit scale cap |
| Extend `ParcelDocument.document_type` enum inline | No schema change | Proliferating document types without UX structure | Acceptable for first 3 new types only |
| Use `parcel_cache.id` (UUID) as stable parcel reference | Consistent with other FKs | Breaks when parcel cache is regenerated | Never for portfolio/favorites data — use Kadaster string |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| BRK eigendomsdata in outreach templates | Storing rendered template with owner name from BRK response | Templates use placeholders; BRK data is display-only in the browser, never written to DB |
| ParcelDocument for workspace dossier | Creating new document type keys per phase without updating `VALID_DOCUMENT_TYPES` in `documents/router.py` | Add new keys to the set in the router; document type keys must be validated server-side |
| TanStack Query for portfolio items | Using `useQuery` inside `.map()` per parcel card | Batch endpoint returning all parcel data per wijk in one request |
| ScanResult unique constraint | `UNIQUE(organization_id, parcel_id)` means one ScanResult per parcel per org — portfolio features that need per-scan history for a parcel must query `area_scans` directly | Join through `area_scans` for historical scan data, not by creating new ScanResult rows |
| pipeline_stage Enum in Pydantic | Pydantic v2 `str(Enum)` serializes as `"PipelineStage.gesignaleerd"` not `"gesignaleerd"` | Use `use_enum_values=True` in the model config, or define stage as `Literal["gesignaleerd", ...]` |
| AVG / GDPR for `rechtspersoon` vs `natuurlijk_persoon` | Treating all owner types identically in data retention | `rechtspersoon` (BV, NV, stichting) data is company data, can be stored with proper purpose. `natuurlijk_persoon` data cannot be stored — requires per-case legitimate interest documentation |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Portfolio view queries all ParcelCache for a gemeente to find favorites | 2+ second load times for gemeenten with 5000+ parcels | Favorites table stores the Kadaster parcel_id string; look up only favorited parcels by ID list | > 500 parcels in cache for any gemeente |
| Pipeline stage history table grows unbounded | Slow stage queries as deal history accumulates | Index on `(deal_id, changed_at DESC)`, keep history append-only, archive old deals after 2 years | > 10K deals active simultaneously (unlikely near-term) |
| Document count query per parcel in portfolio list | N queries for N favorites | Include `document_count` in the portfolio list endpoint subquery (COUNT with GROUP BY) | > 20 favorited parcels in a single wijk view |
| MapLibre layer for "favorited parcels" rendering all org favorites | Tile payload bloats for orgs with 100+ favorites | Favorites overlay should only render for currently visible wijk, not all favorites globally | > 50 favorites globally |
| Wijk-level portfolio endpoint returns all historical scan data | Response payload 500KB+ | Limit to most recent completed scan per parcel; flags_summary should be a trimmed subset | Per-parcel flags JSONB averages 8KB |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing any BRK eigendomsdata (owner name, address) in ParcelFavorite or ParcelProject notes | AVG violation, Kadaster API ToS breach, potential fine | All new models must have zero BRK fields; add a comment in the model file explicitly prohibiting this |
| Pipeline deal accessible to other organizations via direct UUID guessing | Cross-org data leak | Every deal endpoint must filter by `organization_id`; return 404 not 403 for cross-org IDs |
| Outreach log storing recipient details for natural persons | AVG Article 9 special category risk if health/financial data implied | Log recipient_type only (`rechtspersoon` or `not_logged`), never name/address |
| `parcel_id` string used in URL path without validation | Path traversal / injection via crafted parcel_id strings | Validate parcel_id matches the Kadaster pattern `^[A-Z]{3}[0-9]{2}-[A-Z]-[0-9]+$` before use in queries |
| Multi-parcel deal grouping without org check on each parcel | An attacker adds a parcel from another org to their deal | Each parcel in a multi-parcel deal must be validated as belonging to the requesting org (present in their `parcel_cache`) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Heart/favorite button requires a scan to exist for that parcel | User finds a parcel via address search, wants to favorite it, can't because no scan_result exists | Allow favoriting any parcel by Kadaster ID; create a minimal `ParcelFavorite` record without requiring scan data |
| Pipeline stage shown as English enum values ("gesignaleerd", "onderzoek") | Dutch real estate professionals expect Dutch professional terminology | Map stage keys to display labels: `gesignaleerd` → "Gesignaleerd", `onderzoek` → "In onderzoek", `besluit` → "Besluit fase" |
| Deleting a deal workspace deletes all uploaded documents | Users lose due diligence documents they worked to collect | Soft-delete deals; documents should survive for 30 days post-deletion with a recovery option |
| Portfolio navigation requires navigating through provincie → gemeente → wijk even for known parcels | 4 clicks to reach a parcel you work with daily | Add a "recent / pinned parcels" section at the top of the portfolio page (top 5, localStorage is fine here) |
| Dossier completeness shown as a single percentage without breakdown | "67% complete" means nothing — which documents are missing? | Show completeness as a checklist: each document type as a row with uploaded/missing status |
| Outreach template forces a specific letter format | Dutch municipalities and owners expect different tones for pre-overleg vs. eigenaar contact | Provide two distinct template categories: "Brief aan eigenaar" (formal, private tone) and "Pre-overleg gemeente" (professional, planning language) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Parcel favorites:** Verify that favoriting a parcel without a scan_result (found via address search only) works — the favorite creates a `parcel_favorites` row even if `parcel_cache_id` is NULL
- [ ] **Pipeline stage transitions:** Verify that PATCH `/deals/{id}/stage` rejects invalid transitions (e.g., `gesignaleerd` → `afgerond` directly) with 422, not 200
- [ ] **Multi-tenant isolation:** Verify that `GET /portfolio/wijken/{wijk_code}/parcels` filters by `organization_id`, not just wijk code — two orgs scanning the same wijk get independent portfolio views
- [ ] **Document count in portfolio:** Verify COUNT query uses `organization_id` filter on `parcel_documents` table — org A cannot see org B's document counts
- [ ] **BRK data isolation:** Verify that no BRK fields appear in any new migration or model — grep for `eigenaar`, `kvk`, `naam` in new schema files
- [ ] **ProjectList.tsx refactor:** Verify that the existing gemeente monitoring view still works after component extraction — the `useProjectChanges`, `useUnreadCounts` hooks must still be wired correctly
- [ ] **ParcelDocument integration:** Verify that the new workspace document tab shows documents uploaded via the existing `/api/documents` endpoint, not a duplicate endpoint
- [ ] **Pipeline stage history:** Verify at least one transition is recorded in the audit log when a deal stage changes — check the audit table directly, not just the deal's current stage
- [ ] **Outreach template:** Verify that the generated template does NOT include the owner's name for `natuurlijk_persoon` owners — it must show `{naam_eigenaar}` as a literal placeholder
- [ ] **Deal deletion cascade:** Verify that deleting a deal does NOT cascade-delete `parcel_documents` for that parcel — documents belong to the parcel, not the deal

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Pipeline stage column added to existing Project model | HIGH | Write a migration to copy pipeline_stage to a new Deal table, null it out in Project, update all API endpoints and frontend hooks — 1-2 days |
| Parcel favorites in localStorage, data lost by users | MEDIUM | Build server-side favorites table, add import endpoint that reads localStorage on first login and migrates to server — 1 day backend + frontend |
| BRK data stored in ParcelProject notes | HIGH | Audit log of all notes, scrub BRK data via regex (name patterns, addresses), notify Kadaster per their breach protocol — potential GDPR fine if reported |
| N+1 fetches in portfolio view | MEDIUM | Add bulk portfolio endpoint, update frontend to use it — 4-8 hours backend + frontend |
| Email sending domain blacklisted | HIGH | New sending domain setup (weeks), contact ISP postmasters for delisting, rebuild reputation — weeks of work |
| ProjectList.tsx too complex to add features | MEDIUM | Extract to sub-components before adding new features — easier now than after another 500 lines are added |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Project model conflation (folder vs deal) | Phase introducing deal workspace / favorites | Verify no pipeline fields on `projects` table; verify new `parcel_projects` or `deals` table exists |
| localStorage parcel favorites | Phase introducing heart button | Verify `parcel_favorites` table in migration; verify no `localStorage.setItem` for parcel favorites |
| Kadaster parcel_id string vs UUID | Phase introducing any model that references parcels | Verify new models store Kadaster string as primary parcel reference; FK to parcel_cache is optional |
| Pipeline state machine without guards | Phase introducing pipeline stage | Verify stage as Enum; verify transition audit table; verify 422 on invalid transitions |
| BRK data in outreach templates | Phase introducing outreach templates | Grep new models for BRK field names; verify template stores placeholders not values |
| N+1 portfolio query | Phase introducing portfolio wijk parcel list | Load wijk with 30+ favorited parcels; verify single batch API call in network tab |
| ProjectList.tsx spaghetti | First phase of v17 (before any feature work) | Verify component split; ProjectList.tsx under 400 lines after refactor |
| Email outreach infrastructure | Any phase — blocked until dedicated email milestone | Verify no SMTP dependencies in backend; outreach phase delivers DOCX/PDF only |

---

## Sources

- Existing codebase: `backend/app/models/project.py`, `backend/app/schemas/project.py`, `backend/app/projects/router.py` — confirmed folder/report semantics
- Existing codebase: `backend/app/models/parcel_cache.py` — confirmed dual-ID pattern (UUID internal + Kadaster string)
- Existing codebase: `backend/app/models/parcel_document.py` — confirmed org_id + parcel_id (Kadaster string) pattern for parcel-attached data
- Existing codebase: `frontend/src/components/projects/ProjectList.tsx` lines 93-213 — confirmed localStorage gemeente favorites pattern
- Existing codebase: `frontend/src/lib/types/brk.ts` — "CRITICAL: BRK eigendomsdata MUST NEVER be cached or stored" comment
- Existing codebase: `backend/app/models/scan_result.py` — UNIQUE(organization_id, parcel_id) constraint implications
- Dutch Telecommunicatiewet Art. 11.7 — unsolicited electronic marketing requirements
- AVG Article 6 — lawful basis for processing personal data (relevant to natural person owner outreach)
- AVG Article 30 — register of processing activities (relevant to outreach logging)
- Kadaster BRK Bevragen API terms — data must not be stored beyond session legitimate interest purpose
- MEMORY.md: "BRK eigendom is ephemeral (no caching) — workspace must handle this"
- MEMORY.md: "Parcel IDs come from Kadaster (string, not UUID) — join semantics differ from typical FK patterns"
- MEMORY.md: "ProjectList.tsx is 1867 lines — needs careful refactoring, not a rewrite"

---
*Pitfalls research for: v17.0 Projecten Portfolio — portfolio management, deal pipeline, outreach automation*
*Researched: 2026-03-15*

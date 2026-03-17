# M003: Shared Data Catalog + User-Scoped Favorites

**Vision:** Transform from org-scoped multi-tenant to shared data catalog with user-scoped favorites and paywall-gated access. All scan/parcel/cache data becomes shared across all users. Favorites, reports, and user-generated content remain user-scoped. A paywall/entitlement layer gates access to premium data.

## Current State

18 models use TenantMixin with organization_id. 709 references across 73 files. Every query path filters by org_id. This was correct for the development phase but the production model is:

- **Shared:** Scan data, parcel cache, API cache, bekendmakingen, bestemmingsplan PDFs, jurisprudence analysis, market data — public or collectively-built data visible to all authenticated users
- **User-scoped:** Favorites (parcel_id + user_id), saved reports, uploaded documents, read state, notification state, generated dossiers
- **Paywall-gated:** Some shared data behind entitlement checks (not org isolation)

## Models to De-Tenant (~10)

| Model | Current | Target | Notes |
|-------|---------|--------|-------|
| AreaScan | TenantMixin | Shared | Scan catalog, all users see results |
| ScanResult | TenantMixin | Shared | Parcel scores, shared catalog |
| ParcelCache | TenantMixin | Shared | Geometry/address cache, no reason to duplicate |
| CachedAPIResponse | TenantMixin | Shared | API cache, wasteful to duplicate per org |
| ChangeRecord | TenantMixin | Shared | Bekendmakingen are public records |
| PDFDocument | TenantMixin | Shared | Bestemmingsplan PDFs are public documents |
| ParsingJob | TenantMixin | Shared | PDF parsing jobs, shared infrastructure |
| JuridischAnalyseJob | TenantMixin | Shared | Analysis of public rulings |
| FundaListingSnapshot | TenantMixin | Shared | Market data |
| Project | TenantMixin | Evolve/Remove | Concept changes — may become user-scoped grouping |

## Models to Keep User/Org-Scoped (~8)

| Model | Reason |
|-------|--------|
| User | Auth, always scoped |
| RefreshToken | Auth session |
| ParcelFavorite | User-specific favorites (switch from org_id to user_id primary scope) |
| SavedReport | User-generated content |
| ParcelDocument | User-uploaded documents |
| GeneratedDossier | User-generated content |
| UserNotificationState | Per-user UI state |
| ChangeReadState | Per-user read tracking |

## Key Risks / Unknowns

- **Query path blast radius** — 709 org_id references across 73 files. Every service, router, and test touches org_id filtering. Systematic but large.
- **RLS rewrite** — Shared tables need different RLS (authenticated access, no org filter) vs user-scoped tables (user_id filter). Current RLS only covers 7 of 18 tables.
- **Paywall layer is new** — No entitlement/subscription model exists yet. Need to design check mechanism (middleware? per-query? feature flags?).
- **Scan deduplication** — Currently org A and org B can scan the same wijk independently. Shared model means one canonical scan per wijk. Need dedup strategy.
- **Migration path** — Existing data has org_id on everything. Need to handle: merge duplicate scans? Pick one? Keep all with org_id nullable?
- **Test suite** — Tests heavily rely on org_id fixtures. ~50+ test files need updating.

## Slices (Draft)

- [ ] **S01: Entitlement Layer** `risk:medium` `depends:[]`
  > Design and implement paywall/entitlement check mechanism. Feature flag or subscription tier check that can gate access to data without org_id filtering.

- [ ] **S02: De-Tenant Scan Pipeline** `risk:high` `depends:[S01]`
  > Remove org_id from AreaScan, ScanResult, ParcelCache. Update all query paths in scan services, routers, and workers. Handle scan deduplication. Update RLS.

- [ ] **S03: De-Tenant Cache & Reference Data** `risk:medium` `depends:[S02]`
  > Remove org_id from CachedAPIResponse, ChangeRecord, PDFDocument, ParsingJob, JuridischAnalyseJob, FundaListingSnapshot. Update services and routers.

- [ ] **S04: User-Scoped Favorites & Reports** `risk:medium` `depends:[S02]`
  > Migrate ParcelFavorite from org-scoped to user-scoped (user_id as primary filter, org_id removed or kept as metadata). Update SavedReport, ParcelDocument, GeneratedDossier to user_id primary scope.

- [ ] **S05: Test Suite & RLS Hardening** `risk:low` `depends:[S02, S03, S04]`
  > Update all test fixtures. Add RLS policies for all tables. Verify shared access works. Verify user isolation works.

## Success Criteria

- Scan data visible to all authenticated users (no org_id filter)
- Favorites are user-specific (user_id filter, not org_id)
- Paywall check gates premium data access
- No data leakage between users for user-scoped content
- All existing functionality works (scans, reports, favorites, meldingen)
- Test suite passes with updated fixtures
- RLS policies on all tables

## Boundary Notes

- This milestone does NOT change the frontend — it only changes backend query paths and models. Frontend already doesn't display org_id anywhere user-facing.
- Project model evolution (remove/rename/repurpose) may spill into M002-S05 or be deferred further depending on how Opgeslagen takes shape.

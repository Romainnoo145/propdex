# Deferred Items — Phase 01

## Pre-existing `npm run check` errors (NOT caused by M049/S01)

Discovered during Plan 01-01 frontend verification. Out of scope for this plan.

Files with pre-existing TS errors:
- src/routes/_authenticated/verkenner.tsx (motion ease type)
- src/stories/layout/ReportSidebar.stories.tsx (missing is_superuser)
- src/stories/layout/SideRailNav.stories.tsx (missing is_superuser)
- src/components/configuratie/DocumentListItem.tsx (import.meta.env)
- src/components/configuratie/DocumentSourceDetailView.tsx (import.meta.env)
- src/components/documentation/DataCatalog.tsx (motion variants ease)
- src/components/layout/BottomTabNav.tsx (search param required)
- src/components/map/panels/ParcelDetailPanel.tsx (string|undefined)
- src/components/map/panels/WijkMapPanel.tsx (missing SLATE_MUTED, OBSIDIAN)
- src/components/map/panels/gemeente/KlimaatLayer.tsx (possibly undefined)
- src/components/map/panels/parcel/VergunningenModal.tsx (possibly undefined)
- src/components/map/panels/parcel/WoonvisiePopup.tsx (string|undefined)
- src/components/notifications/MeldingenPopover.tsx (ChangeRecord.parcel_id)
- src/components/projects/DrilldownBreadcrumb.tsx (gemeente_id, wijk_id)
- src/components/projects/PipelineStageFilter.tsx (router types)

These errors existed BEFORE M049/S01 began. Verified via `git stash` test:
removing `dataSourceKeys.ts` did not affect the error list.

**Scope boundary applied:** M049/S01 only adds NEW files (data_source_keys.py +
dataSourceKeys.ts + test_data_source_keys_catalog.py). The new files themselves
type-check cleanly (verified via prettier + visual inspection — the catalog has
no React/motion/router dependencies, just plain TS types and arrays).

**Action:** Triage in dedicated cleanup task or address per-feature when those
components are next touched.

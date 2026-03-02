---
phase: 67-wkb-classification-engine
plan: "02"
subsystem: frontend
tags: [wkb, asbest, classification, typescript, react, report-sections]
dependency_graph:
  requires: [67-01]
  provides: [WkbClassificatieSection, AsbestSection, WkbClassification-ts, AsbestIndicator-ts]
  affects: [ReportDetailPage, property.ts]
tech_stack:
  added: []
  patterns: [section-component, graceful-null-handling, risk-badge-styling]
key_files:
  created: []
  modified:
    - frontend/src/lib/types/property.ts
    - frontend/src/components/reports/ReportDetailPage.tsx
decisions:
  - "AsbestSection returns null (no section) when asbest_indicator is null — consistent with absence-means-not-applicable semantics"
  - "WkbClassificatieSection shows empty state when wkb_classification is null — maintains section presence for progressive loading"
  - "ASBEST_RISK_STYLES defined as module-level const object — avoids recreating on each render"
  - "WkbClassificatieIcon uses shield-with-info variant to distinguish from WkbIcon (shield-with-checkmark)"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 67 Plan 02: Wkb Classification + Asbest Frontend Sections Summary

**One-liner:** `WkbClassificatieSection` and `AsbestSection` React components wired into `ReportDetailPage.tsx` with TypeScript interfaces matching backend Pydantic schemas — full graceful null handling.

---

## What Was Built

### TypeScript Interfaces

**`frontend/src/lib/types/property.ts`**
- Added `WkbClassification` interface: `wkb_applicable`, `gevolgklasse` (GK1/niet_van_toepassing/onbekend), `exclusion_reason`, `disclaimer`
- Added `AsbestIndicator` interface: `risk` (hoog/middel/geen/onbekend), `bouwjaar`, `norm_reference`, `reden`
- Extended `PropertyReportResponse` with optional `wkb_classification?: WkbClassification | null` and `asbest_indicator?: AsbestIndicator | null`

### New Section Components

**`WkbClassificatieSection`** (in `ReportDetailPage.tsx`)
- State 1 (null data): Shows "Classificatie niet beschikbaar" empty state message
- State 2 (wkb_applicable=false): Shows exclusion message keyed on exclusion_reason: rijksmonument, verbouwing, or fallback; plus disclaimer in text-grey-600
- State 3 (wkb_applicable=true): Shows amber-styled gevolgklasse badge ("Gevolgklasse 1" for GK1) and "Indicatief" badge, plus disclaimer
- Icon: WkbClassificatieIcon (shield with info variant)

**`AsbestSection`** (in `ReportDetailPage.tsx`)
- Returns null when asbest_indicator is null (section absent)
- `ASBEST_RISK_STYLES` const object maps risk levels to Tailwind color classes:
  - hoog: red (border-red-500/30 bg-red-500/10 text-red-400)
  - middel: yellow (border-yellow-500/30 bg-yellow-500/10 text-yellow-400)
  - geen: green (border-green-500/25 bg-green-500/[0.08] text-green-400)
  - onbekend: subtle grey (border-overlay/[0.08] bg-overlay/[0.04] text-grey-400)
- Shows risk badge + norm_reference text (NEN 2991 for hoog/middel) when present
- Shows reden text below badge row

### JSX Render Order

Sections inserted at lines 223-224 in main column before WkbPrecheckSection:
```tsx
<WkbClassificatieSection data={data} />
<AsbestSection data={data} />
<WkbPrecheckSection data={data} />
```

---

## Test Results

TypeScript compile: 0 errors, 524+ warnings (pre-existing tailwind arbitrary value warnings, out of scope)

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| b419ab9 | feat | Add WkbClassification and AsbestIndicator TypeScript interfaces |
| b84dff8 | feat | Add WkbClassificatieSection and AsbestSection components to report |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check: PASSED

- [x] `WkbClassification` interface in property.ts at line 368
- [x] `AsbestIndicator` interface in property.ts at line 375
- [x] `wkb_classification?` field in PropertyReportResponse at line 434
- [x] `asbest_indicator?` field in PropertyReportResponse at line 435
- [x] `WkbClassificatieSection` function in ReportDetailPage.tsx at line 679
- [x] `AsbestSection` function in ReportDetailPage.tsx at line 730
- [x] `WkbClassificatieSection` rendered at line 223 (before WkbPrecheckSection at 225)
- [x] `AsbestSection` rendered at line 224 (before WkbPrecheckSection at 225)
- [x] `ASBEST_RISK_STYLES` const object defined for all 4 risk levels
- [x] WkbClassificatieIcon and AsbestIcon SVG icons added
- [x] npm run check: 0 errors
- [x] Commits b419ab9, b84dff8 present in git log

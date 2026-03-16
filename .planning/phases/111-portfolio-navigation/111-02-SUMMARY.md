---
phase: 111
plan: 2
subsystem: frontend
tags: [portfolio, favorites, parcel-card, pipeline-stage, navigation]
dependency_graph:
  requires: [111-01]
  provides: [FavoritedParcelCard, PipelineStagePill, wijk-parcel-grid]
  affects: [PortfolioView]
tech_stack:
  added: []
  patterns: [discriminated-filtering, iife-jsx, toast-navigation-hint]
key_files:
  created:
    - frontend/src/components/projects/PipelineStagePill.tsx
    - frontend/src/components/projects/FavoritedParcelCard.tsx
  modified:
    - frontend/src/components/projects/PortfolioView.tsx
decisions:
  - "Used IIFE in JSX for wijk parcel grid to keep complex filtering logic readable without extracting a sub-component"
  - "Null wijk_naam maps to 'Onbekende wijk' in URL; reverse-mapped on filtering via equality check"
metrics:
  duration: 2min
  completed: 2026-03-16
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 111 Plan 2: FavoritedParcelCard + PipelineStagePill + Wijk Parcel Grid Summary

**One-liner:** Wijk drill-down now shows a responsive grid of FavoritedParcelCard components with colored PipelineStagePill and map navigation toast.

## What Was Built

Three tasks delivered the full parcel-level view at the deepest portfolio drill-down level:

1. **PipelineStagePill** — 23-line pill component mapping 5 pipeline stages to distinct Aura-compatible color tokens (sage-mint, amber, blue, purple, neutral).

2. **FavoritedParcelCard** — 47-line card showing Kadaster parcel_id in mono font, gemeente/wijk labels, pipeline stage pill, nl-NL formatted creation date, and a ghost button.

3. **PortfolioView wijk level** — Replaced placeholder with filtered favorites grid. Filters by `gemeente_code` + `wijk_naam` (null wijk maps to "Onbekende wijk"). Ghost button navigates to `/map?gemeente_code=...` and fires a Sonner toast: "Zoek het perceel via het adres-zoekvenster". Count header and empty state both handled.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- frontend/src/components/projects/PipelineStagePill.tsx — FOUND
- frontend/src/components/projects/FavoritedParcelCard.tsx — FOUND
- frontend/src/components/projects/PortfolioView.tsx — FOUND (modified)

Commits exist:
- ca149bf — feat(111-02): create PipelineStagePill component
- 297c9e3 — feat(111-02): create FavoritedParcelCard component
- fd48e3d — feat(111-02): wire FavoritedParcelCard grid into PortfolioView wijk level

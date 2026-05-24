---
phase: 01-fundament-demo-flag
plan: 03
subsystem: frontend
tags: [hauzer-demo, projecttype-picker, favorites, aura-design]
dependency_graph:
  requires: [01-00, 01-01, 01-02]
  provides: [picker-on-save flow, shouldShowProjectTypePicker helper, useHauzerDemo hook]
  affects: [S02 projecttype-driven checklist, S03/S04/S05 mock-surface gating]
tech_stack:
  added: []
  patterns: [onSuccess-gated modal trigger, scalar flag-read hook from auth state]
key_files:
  created:
    - frontend/src/hooks/useHauzerDemo.ts
  modified:
    - frontend/src/components/map/panels/parcel/HeartButton.tsx
    - frontend/src/components/parcel/ProjectTypePickerModal.tsx
    - frontend/src/lib/auth/AuthContext.tsx
    - frontend/src/lib/auth/types.ts
key_decisions:
  - "Picker triggers only on NEW favorite (shouldShowProjectTypePicker = !isFavorited && data != null) — never on un-favorite"
  - "useHauzerDemo() reads hauzer_demo from already-loaded auth state (zero extra round-trip), false for non-demo orgs"
  - "Picker buttons use Aura design tokens (bg-white/60 glas-outline + amber-active), no hardcoded hex — DESIGN.md compliant"
metrics:
  completed_date: "2026-05-24"
  tasks: 3
  files_changed: 5
requirements_addressed: [FUND-01, DEMO-01]
---

# Phase 01 Plan 03: Picker-on-Save + useHauzerDemo Hook Summary

Na het opslaan (favorieten) van een perceel verschijnt de `ProjectTypePickerModal` zodat de gebruiker een projecttype kiest; de picker verschijnt NIET bij un-favorite. `useHauzerDemo()`-hook leest de org-flag uit de auth-state voor mock-surface gating. Picker visueel op Aura-tokens getrokken (glas-outline buttons).

## Objective

FUND-01: na save → picker → PUT project-type (bestaande `useUpdateParcelProjectType`). DEMO-01 frontend: `useHauzerDemo()` retourneert de org's `hauzer_demo` uit de al-geladen auth-state.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | HeartButton picker-on-save + `shouldShowProjectTypePicker` helper (FUND-01) | 86411676 | HeartButton.tsx, ProjectTypePickerModal.tsx |
| 2 | `hauzer_demo` op User type + `useHauzerDemo` hook (DEMO-01) | 5355785a | useHauzerDemo.ts, AuthContext.tsx, types.ts |
| 3 | Aura glas-outline buttons in ProjectTypePickerModal (styling-afronding) | 6c21d31b | ProjectTypePickerModal.tsx |

## Decisions Made

1. **Picker alleen bij nieuwe favoriet**: `shouldShowProjectTypePicker(isFavorited, data) = !isFavorited && data != null`. Klik op een al-opgeslagen hart → un-favorite, geen picker. Helper geëxporteerd voor de Wave-0 unit-test.

2. **useHauzerDemo uit auth-state**: leest `hauzer_demo` uit de al-geladen `AuthContext`, geen extra request. `false` voor niet-demo-orgs.

3. **Aura-tokens i.p.v. hardcoded hex**: picker-buttons als glas-outline (`bg-white/60` + `border-aura-obsidian/10` hairline, amber-actief met glow). DESIGN.md-conform; variant gekozen + live geverifieerd in deze sessie (na crash-recovery).

## Deviations from Plan

Task 3 (styling-afronding) viel buiten de oorspronkelijke 01-03-scope maar hoort bij de picker-UI; afgerond na crash-recovery deze sessie. Geen functionele afwijking.

## Verification Results

- `shouldShowProjectTypePicker` unit-test (Wave 0) — GREEN
- Live geverifieerd: ingelogd als tom@propdex.nl, Parade 1 Venlo → hart → picker verschijnt met Aura-styling (screenshot getoond)
- Picker verschijnt niet bij un-favorite (logica geverifieerd in HeartButton.tsx:56)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| frontend/src/hooks/useHauzerDemo.ts | FOUND |
| frontend/src/components/map/panels/parcel/HeartButton.tsx | FOUND |
| frontend/src/components/parcel/ProjectTypePickerModal.tsx | FOUND |
| Commit 86411676 (Task 1) | FOUND |
| Commit 5355785a (Task 2) | FOUND |
| Commit 6c21d31b (Task 3) | FOUND |

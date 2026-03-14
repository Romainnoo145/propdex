---
phase: 97-settings-reskin
plan: 01
subsystem: frontend/settings
tags: [aura, reskin, settings, bentopod]
dependency_graph:
  requires: []
  provides: [SET-01]
  affects: [frontend/settings]
tech_stack:
  added: []
  patterns: [BentoPod, glass-header-bar, aura-amber-icons]
key_files:
  created: []
  modified:
    - frontend/src/routes/_authenticated/instellingen.tsx
    - frontend/src/routes/_authenticated/instellingen.score.tsx
    - frontend/src/components/settings/SettingsTabNav.tsx
    - frontend/src/components/settings/AccountSection.tsx
    - frontend/src/components/settings/PasswordSection.tsx
    - frontend/src/components/settings/NotificationsSection.tsx
    - frontend/src/components/settings/AppearanceSection.tsx
    - frontend/src/components/settings/ScoreSection.tsx
    - frontend/src/components/settings/FactorTable.tsx
decisions:
  - "AppearanceSection selected state uses aura-amber ring+icon instead of aura-green (consistent with Aura palette)"
  - "BentoPod spacious used throughout settings — provides consistent card visual separation without border-t dividers"
  - "Impact preview uses bg-aura-canvas token instead of hardcoded #F2F6F3 (token-first approach)"
metrics:
  duration: 3min
  completed: 2026-03-14
---

# Phase 97 Plan 01: Settings Aura Reskin Summary

**One-liner:** Settings pages fully reskinned with Aura BentoPod cards, glass header bars, amber section icons, and Aura-styled SettingsTabNav — replacing raw sections and border dividers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Route layouts + SettingsTabNav + general sections | a05e99a | 7 files |
| 2 | ScoreSection sub-blocks + FactorTable | 7266d63 | 2 files |

## What Was Built

### Task 1: Route layouts + SettingsTabNav + 4 general sections
- Both `/instellingen` and `/instellingen/score` route files: plain `<div className="mb-8">` header replaced with glass header bar (`rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-5 py-4`)
- Border-t divider `<div>` elements removed from instellingen.tsx; `space-y-8` reduced to `space-y-4`
- `SettingsTabNav`: container changed from `bg-neutral-100` to `bg-aura-glass-white/40 border border-white/40`
- `AccountSection`, `PasswordSection`, `NotificationsSection`, `AppearanceSection`: outer `<section>` replaced with `<BentoPod size="spacious" className="space-y-4">`, section header icons changed from `text-neutral-600` to `text-aura-amber`
- `AppearanceSection`: selected map style state changed from green ring to amber ring + amber icon

### Task 2: ScoreSection + FactorTable
- `ScoreSection` sub-blocks each wrapped in `<BentoPod size="spacious">`: section header, preset cards, balance slider, potentie factors, risico factors, save button area
- All `<div className="border-t border-neutral-200" />` dividers removed; outer `space-y-8` → `space-y-4`
- Impact preview card: hardcoded `bg-[#F2F6F3]` → `bg-aura-canvas` token, `rounded-2xl` → `rounded-xl`
- `FactorTable` column headers: upgraded to `text-[11px] font-semibold uppercase tracking-[0.05em]`
- `FactorTable` row hover: `hover:bg-neutral-50/50` → `hover:bg-aura-glass-white/40`

## Deviations from Plan

None — plan executed exactly as written.

One minor deliberate choice: AppearanceSection selected state uses `border-aura-amber ring-1 ring-aura-amber` (not `ring-2`) to match the subtle Aura aesthetic; the icon also switches to `text-aura-amber` rather than `text-aura-green` for visual consistency with the Aura palette.

## Verification

- `npx tsc --noEmit`: zero errors
- All form logic, hooks, and API calls unchanged (register bindings, handleSubmit, onSubmit, toggle, handleSave, rescore job polling)
- No new dependencies added

## Self-Check: PASSED

Files confirmed present:
- frontend/src/routes/_authenticated/instellingen.tsx — contains `bg-aura-glass-white/60`
- frontend/src/routes/_authenticated/instellingen.score.tsx — contains `bg-aura-glass-white/60`
- frontend/src/components/settings/SettingsTabNav.tsx — contains `bg-aura-glass-white/40`
- frontend/src/components/settings/AccountSection.tsx — contains `BentoPod`
- frontend/src/components/settings/PasswordSection.tsx — contains `BentoPod`
- frontend/src/components/settings/NotificationsSection.tsx — contains `BentoPod`
- frontend/src/components/settings/AppearanceSection.tsx — contains `BentoPod`
- frontend/src/components/settings/ScoreSection.tsx — contains `BentoPod`
- frontend/src/components/settings/FactorTable.tsx — contains `hover:bg-aura-glass-white/40`

Commits confirmed: a05e99a, 7266d63

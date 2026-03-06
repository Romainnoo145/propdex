---
phase: 76-rechtspraak-jurisprudentie
plan: "02"
subsystem: frontend-jurisprudence
tags: [rechtspraak, jurisprudentie, omgevingsrecht, ux, filter-badge, court-name]
dependency_graph:
  requires: [rechtspraak-client, jurisprudence-endpoint]
  provides: [jurisprudence-ui-polish]
  affects: [wijk-detail-view]
tech_stack:
  added: []
  patterns: [inline-helper-function, badge-ux-transparency, parseCourtFromTitle]
key_files:
  created: []
  modified:
    - frontend/src/components/projects/JurisprudenceSection.tsx
decisions:
  - "parseCourtFromTitle as file-level helper (not inline) — reusable and testable, title format is stable ECLI comma-separated convention"
  - "Court name replaces ECLI short form in left slot of meta row — court name is more meaningful to users than RVS:2023:1234"
  - "ECLI short form demoted to monospace subtitle line — still visible for reference but secondary to court name"
  - "Badge placed below descriptive paragraph, above results list — visible at all times regardless of search state"
  - "useJurisprudence.ts required no changes — hooks were already correct for rebuilt backend API contract"
metrics:
  duration: "~3min"
  tasks_completed: 2
  files_modified: 1
  completed_date: "2026-03-07"
---

# Phase 76 Plan 02: Rechtspraak Frontend Polish Summary

Polished JurisprudenceSection with "Omgevingsrecht filter actief" badge for UX transparency, parsed court name display in result cards replacing the less meaningful ECLI short form in the primary meta row, and confirmed useJurisprudence hooks are compatible with the rebuilt backend.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add omgevingsrecht filter badge and improve court name display | dcd8092 | JurisprudenceSection.tsx |
| 2 | Harden useJurisprudence hooks and run quality checks | — (no-op) | useJurisprudence.ts (verified, no changes needed) |

## What Was Built

### Omgevingsrecht filter badge

Added a persistent badge below the descriptive paragraph in the search area:

```tsx
<span className="inline-flex items-center gap-1 rounded-full bg-amber-accent/10 px-2 py-0.5 text-[10px] font-medium text-amber-accent/80 w-fit">
    <Scale className="w-2.5 h-2.5" />
    Omgevingsrecht filter actief
</span>
```

This gives users UX transparency that search results are always domain-filtered to omgevingsrecht cases — the backend hardcodes the subject URI filter introduced in Plan 01.

### parseCourtFromTitle helper

Added a file-level helper function that extracts the court name from the Rechtspraak title string format:

```typescript
// Input:  "ECLI:NL:RVS:2023:1234, Raad van State, 15-03-2023, 202301234/1/R4"
// Output: "Raad van State"
function parseCourtFromTitle(ecli: string, title: string): string {
    const withoutEcli = title.replace(ecli, '').replace(/^,\s*/, '')
    const parts = withoutEcli.split(', ')
    return parts[0] ?? ''
}
```

### Result card meta row update

Updated result card meta row to show court name (more meaningful to users) on the left, with date on the right. The ECLI short form is demoted to a monospace subtitle line — still visible for reference but secondary:

```
Before:  [RVS:2023:1234]              [2023-03-15]
After:   [Raad van State]             [2023-03-15]
         [RVS:2023:1234]   ← monospace subtitle
```

### useJurisprudence hooks verification

Both hooks were already correct for the rebuilt backend API contract:
- `useJurisprudenceSearch`: Passes `query` as `q` param — backend adds omgevingsrecht filter server-side
- `useJurisprudenceDoc`: Passes ECLI to path param — backend validates ECLI format, returns 400 on invalid
- Min query length guard (`query.trim().length > 3`) already implemented
- No changes needed

## Deviations from Plan

None — plan executed exactly as written. useJurisprudence.ts was already correct and required no changes as noted in the plan.

## Verification Results

- `npx tsc --noEmit` — TypeScript compiles without errors
- `npm run check` — 0 errors, 533 warnings (all pre-existing Tailwind arbitrary value warnings across codebase, not from this plan)
- All must-have truths satisfied:
  - Search results filtered to omgevingsrecht (backend-side, unchanged)
  - "Omgevingsrecht filter actief" badge visible below search input
  - Court name parsed from title string and displayed in each result card
  - Search defaults to "omgevingsvergunning {gemeenteNaam}" gemeente context
  - Document viewer shows `instantie` (court name) and `datum_uitspraak` prominently

## Self-Check: PASSED

Files verified:
- FOUND: frontend/src/components/projects/JurisprudenceSection.tsx

Commits verified:
- FOUND: dcd8092 (feat(76-02): add omgevingsrecht badge and court name display)

# T01: 110-projectlist-refactor-heartbutton 01

**Slice:** S11 — **Milestone:** M001

## Description

Extract the 1867-line ProjectList.tsx monolith into sub-components, each under 300 lines, before v17 portfolio features compound the problem.

Purpose: BACK-05 requires this refactor before new features. The file has ~50 hooks/memos in a single closure — extracting view branches as presentational components receiving computed props keeps the refactor mechanical and safe.

Output: 5 new/modified files, each under 300 lines. ProjectList.tsx becomes a thin re-export wrapper for backward compatibility.

## Must-Haves

- [ ] "ProjectList.tsx is no longer 1867 lines — the orchestrator file is under 300 lines"
- [ ] "Each extracted sub-component (ProvincieView, GemeenteView, WijkView, ProjectIcons) is under 300 lines"
- [ ] "The Projecten page renders identically to before the refactor — no visual or functional regressions"
- [ ] "TypeScript compiles without errors after extraction"

## Files

- `frontend/src/components/projects/ProjectList.tsx`
- `frontend/src/components/projects/ProjectenPage.tsx`
- `frontend/src/components/projects/ProvincieView.tsx`
- `frontend/src/components/projects/GemeenteView.tsx`
- `frontend/src/components/projects/WijkView.tsx`
- `frontend/src/components/projects/ProjectIcons.tsx`

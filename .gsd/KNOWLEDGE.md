# Knowledge

## Hard Rules

- **ParcelDetailModal and the entire right-panel parcel detail flow are NEVER modified.** ParcelDetailPanel (left panel on map) and ParcelDetailModal (in results) — no changes to components, state, data fetching, or interactions. This is proven shipped work. Build around it, never into it. (Source: explicit user directive, 2026-03-17)

## Patterns

## Lessons Learned

- **SideRailNav.tsx file corruption**: The file had duplicate trailing content after its closing brace, causing esbuild parse failures. Both worktree and main repo copies were affected. Check for trailing garbage when esbuild reports parse errors in files that pass tsc.
- **TDZ in component bodies**: When destructuring from hooks, any `useEffect` referencing the destructured variable must appear AFTER the hook call in source order. `const { inspectorParcel } = useMapPanels(...)` creates a `let` binding under the hood — referencing it earlier causes "Cannot access before initialization".
- **Worktree dev server**: The worktree shares `node_modules` with the main repo via symlink. Always start dev servers from the worktree directory (`npx vite --port 9300`) not the main repo, to pick up worktree source changes.
- **Propdex dev login**: Use `demo@klarifai.nl` / `demo123` for browser testing. Backend must be running on port 8000 (`cd backend && .venv/bin/uvicorn app.main:app --port 8000 --reload`).
- **Escape key in nested modal-panel**: When a modal opens inside a panel that both use `document.addEventListener('keydown')` for Escape, the panel's listener fires first (registered earlier). Fix: modal registers on capture phase (`addEventListener('keydown', handler, true)`) with `stopImmediatePropagation()`, and the parent checks `e.defaultPrevented`.

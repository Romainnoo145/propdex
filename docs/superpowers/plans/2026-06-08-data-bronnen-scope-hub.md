# Data-bronnen Scope Hub (hero) Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Replace the flat, low-contrast `ScopePicker` on `/instellingen/data-bronnen` with a beleid-style "scope hub" hero — three level groups (Landelijk · Provincie · Gemeente) with defined cards + gemeente SVG silhouettes — where clicking a scope opens its data-bronnen in a **pop-up modal** instead of navigating away.

**Architecture:** Extract the existing scope-detail route body into a reusable `ScopeDataSourcesView`, render it both in the route (back-compat) and in a new `ScopeDetailModal`. Build a new `ScopeHub` that reuses the beleid-hub aesthetic + the `GemeenteCard` SVG silhouette (same compute pattern as `GemeenteBeleidGrid`). Approved via design dialogue 2026-06-08.

**Tech Stack:** React 19 / TS / TanStack Router / Framer Motion / Tailwind (Aura tokens). Read `DESIGN.md` before any visual choice.

## Design references (study before building)
- Aesthetic target: the beleid hub — `src/routes/_authenticated/beleid.tsx` (three level cards), `src/components/subsidies/GemeenteBeleidGrid.tsx` (gemeente SVG card grid), `src/components/projects/GemeenteCard.tsx` (the silhouette card).
- Aura tokens (`DESIGN.md` + `src/styles/index.css`): Morning Mist canvas `#F2F6F3`, solid white / white-glass cards, Warm Amber `#F9A826` (accent only), Obsidian `#0E1111` (active/commitment), Plus Jakarta Sans, generous radius (`rounded-[20px]`–`rounded-[28px]`). "Minimal Calm Intelligence" — one focal point, don't overcrowd.
- Existing modal patterns to match: `ActionItemDetailModal.tsx` (solid white `bg-white` card, `bg-black/30 backdrop-blur-sm` backdrop) — the modal we made white earlier.

## File structure
- **Create** `src/components/settings/data-bronnen/ScopeDataSourcesView.tsx` — the extracted scope-detail body (props `entityType`, `entityCode`).
- **Modify** `src/routes/_authenticated/instellingen.data-bronnen.$entityType.$entityCode.tsx` — delegate to `ScopeDataSourcesView`.
- **Create** `src/components/settings/data-bronnen/ScopeDetailModal.tsx` — modal wrapping `ScopeDataSourcesView`.
- **Create** `src/components/settings/data-bronnen/ScopeHub.tsx` — the hero (three level groups + gemeente silhouettes), opens the modal.
- **Modify** `src/routes/_authenticated/instellingen.data-bronnen.index.tsx` — render `<ScopeHub />` instead of `<ScopePicker />`.

---

### Task 1: Extract `ScopeDataSourcesView` (pure refactor)

**Files:** Create `ScopeDataSourcesView.tsx`; Modify the `$entityType/$entityCode` route.

- [ ] **Step 1: Read** `src/routes/_authenticated/instellingen.data-bronnen.$entityType.$entityCode.tsx` fully. It branches on `entityType` (gemeente → `GemeenteSourcesView`; landelijk/provincie → `DataSourceSection`/`DataSourceRow`) and mounts `UploadDocumentModal` + `VersionHistoryPanel`, with download/view handlers + `useScopeDataSources`/`useGemeentenSummary`.
- [ ] **Step 2: Create** `ScopeDataSourcesView.tsx` exporting `function ScopeDataSourcesView({ entityType, entityCode }: { entityType: EntityType; entityCode: string })`. Move the route's component body (everything from the data query down through the JSX incl. the two modals + handlers) into it verbatim. Keep the `ScopePicker`/`ScopeHub` OUT of it (the view is detail-only; no scope switcher inside the modal). Drop the page `<header>`/`<h1>` if the modal will supply its own title — keep a compact heading the route can also use.
- [ ] **Step 3:** In the route component, replace the moved body with `return <ScopeDataSourcesView entityType={entityType} entityCode={entityCode} />` (keep the route's `parseParams`/`beforeLoad` superuser gate).
- [ ] **Step 4: Verify** `cd frontend && pnpm typecheck` clean. Manually confirm the route still renders (the implementer states the diff preserves behavior — no functional change).
- [ ] **Step 5: Commit** `git add -A && git commit -m "M053/S05: extract ScopeDataSourcesView from scope route (reusable in modal)"`

### Task 2: `ScopeDetailModal`

**Files:** Create `ScopeDetailModal.tsx`.

- [ ] **Step 1:** Create a modal matching `ActionItemDetailModal`'s shell (AnimatePresence backdrop `bg-black/30 backdrop-blur-sm`, **solid white** panel `bg-white rounded-[28px] shadow-2xl`, close button, backdrop-click + ESC close). Props: `{ open: boolean; onClose: () => void; entityType: EntityType | null; entityCode: string | null; entityNaam?: string }`. Width ~`720px`, `max-h-[85vh] overflow-y-auto`. Render a header (entityNaam + small "Data-bronnen" kicker) then `<ScopeDataSourcesView entityType={entityType} entityCode={entityCode} />` when both are non-null.
- [ ] **Step 2:** `pnpm typecheck` clean.
- [ ] **Step 3: Commit** `git add -A && git commit -m "M053/S05: ScopeDetailModal wraps ScopeDataSourcesView in a pop-up"`

### Task 3: `ScopeHub` hero

**Files:** Create `ScopeHub.tsx`.

- [ ] **Step 1:** Build the hero. Data: `useScopes()` (landelijk + 12 provincies — `ScopeOption{entity_type,entity_code,entity_naam}`) and `useGemeentenSummary()` (monitored gemeenten with `status_counts`). Three labeled groups in Aura style:
  - **Landelijk** — one prominent card/chip (Nederland).
  - **Provincie** — the 12 provincies as defined cards/chips in a clean responsive grid (NOT invisible `bg-white/60` — use solid white + `border-[#EAEFEF]` + hover, active/amber accent on hover). Group label like the current uppercase tracking style.
  - **Gemeente** — the monitored gemeenten as `GemeenteCard` SVG silhouettes. Reuse the compute pattern from `GemeenteBeleidGrid.tsx` (`useGemeenteGeoJSON` + `geoJsonToSvgPath`, memoized) but only for the codes present in `useGemeentenSummary`. Pass each gemeente's status dot via the existing `status_counts` → dot color (mirror `GemeentePicker.dotColor`). `totalUnread={0}` unless a count is available.
  - Each scope (province card, landelijk card, gemeente card) `onClick` opens a `ScopeDetailModal` with that scope's `entityType`/`entityCode`/`entityNaam` (hold selected scope in local state).
- [ ] **Step 2:** Honor `DESIGN.md`: Plus Jakarta Sans, Morning Mist groupings, amber as the only decorative accent, obsidian for any active/commit state, generous radius. Keep it calm — don't overcrowd. Loading states for both queries (`Loader2`).
- [ ] **Step 3:** `pnpm typecheck` + `npx eslint <new files>` (0 errors; arbitrary-value warnings are the project norm).
- [ ] **Step 4: Commit** `git add -A && git commit -m "M053/S05: ScopeHub hero — beleid-style level cards + gemeente silhouettes + scope pop-up"`

### Task 4: Swap into the index page

**Files:** Modify `instellingen.data-bronnen.index.tsx`.

- [ ] **Step 1:** Replace `import { ScopePicker }` + `<ScopePicker />` with `<ScopeHub />`. Keep the empty-state + loading guards. The `ScopePicker` component file may stay (still used elsewhere? grep — if nothing imports it after this, leave it for a follow-up cleanup, note it).
- [ ] **Step 2:** `pnpm typecheck` clean.
- [ ] **Step 3: Commit** `git add -A && git commit -m "M053/S05: data-bronnen index renders ScopeHub hero"`

### Task 5: Validation + screenshot (controller runs)

- [ ] `pnpm typecheck` + `pnpm lint` (0 errors).
- [ ] Controller takes a localhost:9300 screenshot of `/instellingen/data-bronnen` + opens a scope pop-up, shows the user, iterates on the visual before any push.

## Out of scope
- Removing the old `ScopePicker`/`GemeentePicker` if still referenced (follow-up cleanup).
- Per-province status dots (no status data for provinces; only gemeenten have `status_counts`).

---
phase: 03-data-sources-ux
verified: 2026-05-14T19:10:00Z
status: human_needed
score: 5/6 must-haves verified
human_verification:
  - test: "Navigate to /instellingen/data-bronnen as a superuser when a gemeente with active bronnen exists"
    expected: "Morning Mist (#F2F6F3) canvas, Pure Glass (bg-white/60 backdrop-blur-[24px]) cards, Plus Jakarta Sans font, 3 sections (Beleidsdocumenten / Open API-bronnen / Betaalde integraties), status pills with Vitality Green / red / amber / neutral colors, Obsidian (#0E1111) active state on GemeentePicker and SettingsTabNav pills"
    why_human: "Aura token correctness and visual conformance cannot be verified programmatically — CSS variables, Tailwind JIT, and font loading require a rendered browser"
  - test: "Log in as a non-superuser and visit /instellingen/data-bronnen"
    expected: "Redirected to /instellingen; Data-bronnen tab not visible in SettingsTabNav"
    why_human: "Auth redirect behavior and DOM visibility of superuser-gated pill require a running session with a real non-superuser JWT"
---

# Phase 03: Data-Sources UX Verification Report

**Phase Goal:** Admin opent /instellingen/data-bronnen/{gemeente_code} en ziet Aura-conform dashboard met 3 secties, status-pills, action-buttons. Geen integratie met M045 of credentials nog (placeholders only).
**Verified:** 2026-05-14T19:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Route mounts + gemeente-picker works; default gemeente auto-redirect | VERIFIED | Both route files exist and are registered in routeTree.gen.ts (23 occurrences). Index route calls `useGemeentenSummary`, redirects via `useEffect` to first `gemeente_code`, renders `DataSourcesEmptyState` for empty roster. Superuser gate via `beforeLoad` + `redirect({ to: '/instellingen' })`. |
| 2 | 3 sections render with correct status-pill colors | VERIFIED | Detail route composes 3 `DataSourceSection` instances with titles "Beleidsdocumenten", "Open API-bronnen", "Betaalde integraties". `StatusPill` has 4 Aura-token CLASSES: `bg-[#22C55E]/15` (live), `bg-red-100` (broken), `bg-[#F9A826]/15` (missing), `bg-slate-100` (not_applicable). 27+ rows is a runtime claim (backend-driven) — static analysis confirms the section rendering structure supports arbitrary row counts. |
| 3 | SettingsTabNav has 5th pill "Data-bronnen" superuser-gated | VERIFIED | SettingsTabNav.tsx line 85-102: `{user?.is_superuser && <Link to="/instellingen/data-bronnen" ...>}`. `isDataBronnenActive` uses `fuzzy: true` for sub-route match. All 5 `layoutId="settings-tab"` instances confirmed, `isAccountActive` updated to exclude new tab. No `as any` cast. |
| 4 | Empty-state shows CTA when gemeente has 0 active bronnen | VERIFIED | Index route: `if (gemeenten.length === 0) return <DataSourcesEmptyState />`. Detail route: `if (totalRows === 0) ... <DataSourcesEmptyState />`. Component contains MapPin icon + heading "Nog geen bronnen geactiveerd voor deze gemeente" + 2 CTAs (Beleid-beheer Link + docs `<a>` tag). |
| 5 | Storybook plays cover all 4 status states for DataSourceRow | VERIFIED | `DataSourceRow.stories.tsx`: 4 named exports (`LiveWithActions`, `BrokenWithError`, `MissingPlaceholder`, `NotApplicable`), 4 `play: async` functions, 4 `getAttribute('data-status')` assertions with values `'live'`, `'broken'`, `'missing'`, `'not_applicable'`. Storybook v10 `from 'storybook/test'` import path confirmed. Storybook build passed (11.52s per SUMMARY). |
| 6 | Visual smoke against DESIGN.md (Morning Mist / Pure Glass / Plus Jakarta Sans) | HUMAN NEEDED | Aura tokens are present verbatim in code (`#F2F6F3`, `bg-white/60 backdrop-blur-[24px]`, `bg-[#0E1111]`, `#22C55E`, `#F9A826`). No rogue Tailwind defaults (`bg-blue-*`, `bg-purple-*`). Actual rendering vs DESIGN.md requires manual browser check. |

**Score:** 5/6 truths verified (1 human-only)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/types/data-sources-admin.ts` | 7 TypeScript type exports mirroring Pydantic DTOs | VERIFIED | 45 lines. All 7 exports present: `SourceType`, `SourceStatus`, `ActionType`, `Action`, `DataSourceRow`, `GemeenteDataSourcesPayload`, `GemeenteSummary`. Header comment references backend source file. |
| `frontend/src/lib/queries/data-sources-admin.ts` | TanStack Query hooks + cache-key factory | VERIFIED | 87 lines. `dataSourcesAdminKeys` factory, `useGemeentenSummary` (staleTime 60s), `useGemeenteDataSources` (staleTime 30s), `useRefreshDataSource` (POST + dual invalidation + sonner toasts). Imports `apiFetch` from `@/lib/api` (no new fetch wrappers). |
| `frontend/src/components/settings/SettingsTabNav.tsx` | 5-pill nav with Data-bronnen superuser-gated | VERIFIED | 105 lines. `isDataBronnenActive` with `fuzzy: true`, 3 superuser gates, 5 `layoutId="settings-tab"` instances, no `as any`. |
| `frontend/src/components/settings/data-bronnen/StatusPill.tsx` | 4 Aura status variants + tooltip on broken | VERIFIED | 56 lines. All 4 CLASSES with exact Aura tokens, `data-status` attribute, `Tooltip` wired for `status === 'broken' && errorMessage`. Uses project-convention CSS `Tooltip` component (not Radix — project convention confirmed via `@/components/ui/Tooltip.tsx`). |
| `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` | Pure Glass card with label/badge/pill/last_checked/actions | VERIFIED | 169 lines. `bg-white/60 backdrop-blur-[24px] border border-white/20 rounded-2xl`. All 3 source-type badges, all 4 action icons (Upload/RefreshCw/History/Settings2), `formatRelativeNL` + fallback "Nog niet gecheckt", `animate-spin` on refresh pending, `data-action`/`data-enabled` attributes for Storybook. |
| `frontend/src/components/settings/data-bronnen/DataSourceSection.tsx` | Section header + count + empty inline copy | VERIFIED | 37 lines. `{title}`, count chip, "Nog geen bronnen in deze categorie" copy. |
| `frontend/src/components/settings/data-bronnen/GemeentePicker.tsx` | Pill strip with status-dots, motion layoutId "gemeente-picker" | VERIFIED | 65 lines. `layoutId="gemeente-picker"` (NOT "settings-tab"), TanStack `params={{ gemeenteCode: g.gemeente_code }}`, 3-branch dot color logic (broken/missing/live), `data-active` attribute. |
| `frontend/src/components/settings/data-bronnen/DataSourcesEmptyState.tsx` | MapPin + heading + 2 CTAs | VERIFIED | 52 lines. `size={48}` MapPin, correct heading and body text verbatim, Beleid-beheer Link + docs `<a>` tag. |
| `frontend/src/routes/_authenticated/instellingen.data-bronnen.tsx` | Index route with superuser gate + auto-redirect | VERIFIED | 74 lines. `createFileRoute('/_authenticated/instellingen/data-bronnen')`, `beforeLoad` superuser gate, `useEffect` auto-redirect, `DataSourcesEmptyState` for zero-gemeente roster. |
| `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` | Detail route with parseParams + 3 sections | VERIFIED | 138 lines. `parseParams` with `/^GM\d{4}$/` regex, superuser gate, 3 DataSourceSection instances with locked titles, `totalRows === 0` empty-state branch, `GemeentePicker` mounted. |
| `frontend/src/components/settings/data-bronnen/mockDataSources.ts` | 4 named mock fixtures | VERIFIED | 74 lines. All 4 exports: `mockLiveRow`, `mockBrokenRow`, `mockMissingRow`, `mockNotApplicableRow`. |
| `frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx` | 4 stories with play functions (TEST-04) | VERIFIED | 160 lines. 4 named stories, 4 `play: async` functions, `from 'storybook/test'` (Storybook v10), `QueryClientProvider` + `RouterProvider` + `AuthContext.Provider` decorator. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `queries/data-sources-admin.ts` | `types/data-sources-admin.ts` | `import type { DataSourceRow, GemeenteDataSourcesPayload, GemeenteSummary }` | WIRED | Confirmed line 12-16. |
| `queries/data-sources-admin.ts` | `@/lib/api` | `import { apiFetch }` | WIRED | Confirmed line 10. No raw `fetch()` calls. |
| `queries/data-sources-admin.ts` | `useAuth` | `const { accessToken } = useAuth()` | WIRED | Confirmed 3 occurrences (3 hook functions). |
| `DataSourceRow.tsx` | `types/data-sources-admin.ts` | `import type { Action, ActionType, DataSourceRow as DataSourceRowDTO, SourceType }` | WIRED | Confirmed lines 20-25. |
| `DataSourceRow.tsx` | `queries/data-sources-admin.ts` | `import { useRefreshDataSource }` — used + `mutate()` called on click | WIRED | Confirmed lines 19 + 47 + 93. |
| `DataSourceRow.tsx` | `StatusPill.tsx` | `import { StatusPill }` — rendered line 74 | WIRED | Confirmed. |
| `instellingen.data-bronnen.tsx` | `queries/data-sources-admin.ts` | `useGemeentenSummary()` called line 27 | WIRED | Confirmed. |
| `instellingen.data-bronnen.$gemeenteCode.tsx` | `queries/data-sources-admin.ts` | `useGemeenteDataSources(gemeenteCode)` called line 44 | WIRED | Confirmed. |
| `instellingen.data-bronnen.$gemeenteCode.tsx` | `data-bronnen/*.tsx` | All 4 components imported and rendered | WIRED | Confirmed lines 17-20, usage in JSX. |
| `DataSourceRow.stories.tsx` | `DataSourceRow.tsx` | `import { DataSourceRow } from './DataSourceRow'` | WIRED | Confirmed line 24. |
| `SettingsTabNav.tsx` | `instellingen.data-bronnen.tsx` | `<Link to="/instellingen/data-bronnen" />` | WIRED | Route registered in `routeTree.gen.ts`; TS2322 resolved by routeTree regeneration. |
| `GemeentePicker.tsx` | `instellingen.data-bronnen.$gemeenteCode.tsx` | `<Link to="/instellingen/data-bronnen/$gemeenteCode" params={{ gemeenteCode }}` | WIRED | Route registered in `routeTree.gen.ts`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UX-01 | 03-01, 03-04 | Route `/instellingen/data-bronnen` met gemeente-picker (default: eerste gemeente uit org) | SATISFIED | Index route + detail route both mount. Auto-redirect to first gemeente via `useEffect`. `useGemeentenSummary` drives the picker data. |
| UX-02 | 03-01, 03-03, 03-04 | Route `/{gemeente_code}` toont 3 secties met status-pills en Aura design | SATISFIED (visual pending) | 3 `DataSourceSection` instances with locked titles. `StatusPill` with 4 Aura token variants. Visual conformance is the human_needed item. |
| UX-03 | 03-03 | Status-pill kleurcodes: live=Vitality Green, broken=red, missing=amber, N.V.T.=neutral | SATISFIED | Exact token classes in `StatusPill.tsx`: `bg-[#22C55E]/15`, `bg-red-100`, `bg-[#F9A826]/15`, `bg-slate-100`. |
| UX-04 | 03-03 | Per rij: label + bron-type badge + status-pill + last_checked relative + action-buttons | SATISFIED | `DataSourceRow.tsx`: all 4 columns present, 3 source-type badges, 4 action icons, `formatRelativeNL` wired, action buttons with `data-action`/`data-enabled`. |
| UX-05 | 03-02 | SettingsTabNav 5th pill "Data-bronnen" superuser-gated | SATISFIED | `SettingsTabNav.tsx` line 85: `{user?.is_superuser && <Link to="/instellingen/data-bronnen">}`. Fuzzy active match. 5 `layoutId="settings-tab"` instances. |
| UX-06 | 03-03, 03-04 | Empty-state "Nog geen bronnen geactiveerd voor deze gemeente" met CTA | SATISFIED | `DataSourcesEmptyState` rendered in both index (0 gemeenten) and detail (totalRows === 0) branches. Correct heading, body, 2 CTAs. |
| TEST-04 | 03-04 | Storybook plays voor DataSourceRow (live/broken/missing/configured states) | SATISFIED | 4 stories with play functions asserting `data-status` and `data-enabled`. Storybook build passed. `storybook/test` import path (v10). |

No orphaned requirements — all 7 requirement IDs from plan frontmatter are present in REQUIREMENTS.md and marked `[x]` Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `DataSourceRow.tsx` | 9 | Comment: "other actions ... are placeholders for S04/S05" | Info | INTENTIONAL — by design, upload/configure_credential are placeholder actions deferred to S04/S05. Buttons render correctly with disabled state and tooltips. No code stub. |
| `DataSourcesEmptyState.tsx` | 7 | Comment: "The docs URL is a placeholder" | Info | INTENTIONAL — `https://docs.propdex.nl/data-bronnen` is a post-M049 URL. Functionality of CTA works (link opens in new tab). |
| `DataSourceRow.stories.tsx` | 46-51 | `login: async () => {}`, `logout: async () => {}`, etc. | Info | Correct usage — mock auth methods for Storybook `AuthContext.Provider`. Not stub implementations of the actual auth system. |

No blockers found. No FIXME/TODO/XXX in production code files.

### Human Verification Required

#### 1. Aura Visual Smoke — DESIGN.md Conformance

**Test:** Run `npm run dev` from `frontend/` (port 9300). Log in as a superuser. Navigate to `/instellingen/data-bronnen`. Observe the rendered dashboard.

**Expected:**
- Canvas background: Morning Mist `#F2F6F3` (not white, not grey)
- Section cards: `bg-white/60 backdrop-blur-[24px]` glass effect visible
- Typography: Plus Jakarta Sans (verify in DevTools — font-family should resolve to Plus Jakarta Sans, not Inter/system)
- Status pills match: live = Vitality Green text, broken = red, missing = amber, N.v.t. = neutral grey
- Active SettingsTabNav pill: Obsidian `#0E1111` background with white text
- GemeentePicker active pill: same Obsidian treatment, motion spring animation on switch
- Action buttons: Obsidian background on enabled, slate on disabled

**Why human:** Tailwind JIT generates CSS from class strings that must be rendered in a browser. Font loading requires network/CDN check. Glass morphism (`backdrop-blur`) requires a real compositor. Color token accuracy needs visual comparison against DESIGN.md swatches.

#### 2. Superuser Gate — Non-Superuser Session

**Test:** Log in as a regular (non-superuser) user. Visit `/instellingen`.

**Expected:** "Data-bronnen" tab is NOT visible in the SettingsTabNav pill strip. Direct navigation to `/instellingen/data-bronnen` redirects to `/instellingen`.

**Why human:** Requires a live auth session with a non-superuser JWT. The guard is in `beforeLoad` (server-evaluated) and in `{user?.is_superuser && ...}` (JSX conditional). Both require a real auth context.

### Gaps Summary

No gaps. All 5 automatable success criteria are verified. The 6th criterion (visual smoke against DESIGN.md) was explicitly marked "PENDING USER REVIEW" by the executor and is architectural by nature — it requires a human looking at a rendered browser, not a code scan.

The phase delivered:
- 12 new files across types/queries/components/routes/stories (no file exceeds 300 lines)
- 8 git commits with `M049/S03:` prefix, all confirmed in git history
- All 7 requirement IDs satisfied per REQUIREMENTS.md cross-reference
- routeTree.gen.ts regenerated with 23 `data-bronnen` occurrences
- Storybook build passed (11.52s)
- No rogue Tailwind color tokens, no `as any` casts, no TypeScript stubs

---

_Verified: 2026-05-14T19:10:00Z_
_Verifier: Claude (gsd-verifier)_

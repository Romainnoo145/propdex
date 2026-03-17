# S01: Nav Simplification — UAT

**Milestone:** M002
**Written:** 2026-03-17

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: S01 is a static nav/routing change with no runtime data, no APIs, and no backend changes. All verification is structural — correct number of nav items, correct redirect targets, clean TypeScript compilation.

## Preconditions

- Frontend dev server running (`cd frontend && npm run dev`) or production build available
- Browser open at localhost dev server URL

## Smoke Test

Open the app in a browser. The left sidebar (SideRailNav) should show exactly 3 icons. If it shows more or fewer, something is wrong.

## Test Cases

### 1. Desktop nav shows exactly 3 items

1. Open the app at the root URL (should land on /map)
2. Look at the left sidebar (SideRailNav)
3. **Expected:** Exactly 3 nav icons visible: Kaart (map icon), Opgeslagen (bookmark icon), Jurisprudentie (scale icon). No Projecten, Meldingen, or Rapporten items.

### 2. Mobile nav shows exactly 3 items

1. Resize browser to mobile width (<768px) or use DevTools mobile emulation
2. Look at the bottom tab bar (BottomTabNav)
3. **Expected:** Exactly 3 tab items: Kaart, Opgeslagen, Jurisprudentie — matching the desktop sidebar.

### 3. /projecten redirects to /opgeslagen

1. Type `/projecten` in the browser address bar and press Enter
2. **Expected:** URL changes to `/opgeslagen`. The Opgeslagen page renders. No 404 error.

### 4. /rapporten redirects to /opgeslagen

1. Type `/rapporten` in the browser address bar and press Enter
2. **Expected:** URL changes to `/opgeslagen`. The Opgeslagen page renders. No 404 error.

### 5. /rapport/{id} still renders

1. Navigate to `/rapport/some-valid-id` (use a known report ID from the database)
2. **Expected:** The individual report detail page loads normally. No 404.
3. Click the back/close button on the report page
4. **Expected:** Navigates to `/opgeslagen` (not /rapporten or /projecten)

### 6. Opgeslagen nav item is active when on /opgeslagen

1. Click the Opgeslagen icon (bookmark) in the sidebar
2. **Expected:** URL changes to `/opgeslagen`, the Opgeslagen nav icon shows active state (highlighted)

### 7. Jurisprudentie nav item works

1. Click the Jurisprudentie icon (scale) in the sidebar
2. **Expected:** URL changes to `/jurisprudentie`, the page loads normally

## Edge Cases

### ParcelDetailPanel navigation to old routes

1. Open the map, click a parcel to open ParcelDetailPanel
2. Generate a report from the parcel detail panel
3. From the report view, click any "back to list" or navigation button
4. **Expected:** Arrives at `/opgeslagen` (via redirect stub if the component navigated to /rapporten internally). No 404.

### Direct URL entry for removed routes with query params

1. Navigate to `/projecten?some=param` in the address bar
2. **Expected:** Redirects to `/opgeslagen`. Query params may or may not be preserved (acceptable either way).

### Rapid nav switching

1. Click Kaart → Opgeslagen → Jurisprudentie → Kaart rapidly
2. **Expected:** Each route loads correctly, active state follows the clicked item. No console errors.

## Failure Signals

- More or fewer than 3 items in SideRailNav or BottomTabNav
- 404 page when navigating to /projecten or /rapporten
- TypeScript compilation errors (`npx tsc --noEmit` fails)
- Console errors about missing routes or broken Link components
- "NotificationBadge" or "useUnreadCounts" appearing in nav components (should be removed)
- Any navigation ending at a blank/broken page

## Requirements Proved By This UAT

- None directly — S01 is structural prerequisite work for S02-S05 feature slices

## Not Proven By This UAT

- Whether the Opgeslagen page content is correct (that's S05 scope)
- Whether the meldingen feed works in its new location (that's S03 scope)
- Map functionality (unchanged, not in S01 scope)
- Mobile touch interactions beyond nav item visibility

## Notes for Tester

- The /meldingen route may redirect to /map (if S03 work is included) or may load the meldingen page (if testing S01 in isolation). Both are acceptable.
- ParcelDetailPanel.tsx was intentionally NOT modified. Its internal navigation to /rapporten hits the redirect stub — this is by design.
- Stories for both nav components are updated and can be verified in Storybook (`npm run storybook`).

# S01: Nav Simplification — UAT

**Milestone:** M002
**Written:** 2026-03-17

## UAT Type

- UAT mode: live-runtime
- Why this mode is sufficient: Nav changes are visual and behavioral — must be verified in a running app with both viewport sizes.

## Preconditions

- Frontend dev server running (`cd frontend && npm run dev`)
- Backend running on port 8000 (`cd backend && .venv/bin/uvicorn app.main:app --port 8000 --reload`)
- Login with `demo@klarifai.nl` / `demo123`

## Smoke Test

Open the app at `/map`. SideRailNav on the left should show exactly 3 icons: a map icon (Kaart), a bookmark icon (Opgeslagen), and a scale icon (Jurisprudentie). If you see 4 or 5 icons, the slice is broken.

## Test Cases

### 1. Desktop nav shows exactly 3 items

1. Open the app at `/map` in a desktop-width browser (≥1024px)
2. Look at the SideRailNav on the left edge
3. **Expected:** Exactly 3 nav items visible: Kaart (map icon), Opgeslagen (bookmark icon), Jurisprudentie (scale icon). No Projecten, Rapporten, or Meldingen items.

### 2. Mobile nav shows exactly 3 items

1. Resize browser to mobile width (<768px) or use DevTools responsive mode
2. Look at the BottomTabNav at the bottom of the screen
3. **Expected:** Exactly 3 tabs: Kaart, Opgeslagen, Jurisprudentie with matching icons. No other tabs.

### 3. /projecten redirects to /opgeslagen

1. Type `/projecten` in the browser address bar and press Enter
2. **Expected:** Browser navigates to `/opgeslagen`. The Opgeslagen page renders (may be empty if no favorites exist).

### 4. /rapporten redirects to /opgeslagen

1. Type `/rapporten` in the browser address bar and press Enter
2. **Expected:** Browser navigates to `/opgeslagen`. Same behavior as test 3.

### 5. /meldingen still loads

1. Type `/meldingen` in the browser address bar and press Enter
2. **Expected:** The meldingen page renders (feed of notifications). It should NOT 404 or redirect. Note: /meldingen is removed from nav but still functional until S03.

### 6. Individual report page still accessible

1. If you have a report ID, navigate to `/rapport/{id}` directly
2. **Expected:** The report detail page renders. The back/navigation links should point to `/opgeslagen`, not `/rapporten`.

### 7. Nav item highlighting

1. Click the Opgeslagen nav item in the SideRailNav
2. **Expected:** Navigates to `/opgeslagen`, the Opgeslagen icon is highlighted/active
3. Click the Jurisprudentie nav item
4. **Expected:** Navigates to `/jurisprudentie`, the Jurisprudentie icon is highlighted/active
5. Click the Kaart nav item
6. **Expected:** Navigates to `/map`, the Kaart icon is highlighted/active

## Edge Cases

### Direct URL to non-existent sub-route of removed route

1. Navigate to `/projecten/some-id` in the address bar
2. **Expected:** Should 404 or redirect — should NOT render old project detail content. (The redirect stub only catches the exact /projecten route; sub-routes depend on route tree configuration.)

### Rapid nav switching

1. Click Kaart, then immediately Opgeslagen, then immediately Jurisprudentie
2. **Expected:** Each navigation completes cleanly, no console errors, correct page renders each time.

## Failure Signals

- More than 3 items visible in SideRailNav or BottomTabNav
- /projecten or /rapporten rendering old page content instead of redirecting
- /meldingen returning 404 or blank page
- Console errors about missing routes or broken imports
- TypeScript compilation failures (`npx tsc --noEmit` in frontend/)

## Requirements Proved By This UAT

- none — S01 is structural nav cleanup not directly mapped to tracked requirements

## Not Proven By This UAT

- Parcel detail flow (not tested — explicitly excluded from modification per KNOWLEDGE.md)
- Opgeslagen page content (redirect target exists but content is rebuilt in S05)
- Meldingen functionality (route exists but will be killed in S03)

## Notes for Tester

- The Opgeslagen page may appear empty or show a basic list — S05 will rebuild it with pipeline management. For this UAT, just verify the page loads without errors.
- ParcelDetailPanel.tsx was intentionally NOT modified. If you open a parcel detail and click "back to reports", you'll hit the redirect stub and end up at /opgeslagen. This is expected behavior.
- meldingen.tsx may have been converted to a redirect by later S03 work. If /meldingen redirects to /map instead of showing the feed, that's S03's change — not an S01 regression.

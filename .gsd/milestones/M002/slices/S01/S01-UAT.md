# S01: Nav Simplification — UAT

**Milestone:** M002
**Written:** 2026-03-17

## UAT Type

- UAT mode: mixed (artifact-driven + live-runtime)
- Why this mode is sufficient: Nav changes are visible in code (item counts, route files) and verifiable at runtime (visual check + URL navigation). No backend changes.

## Preconditions

- Frontend dev server running (`cd frontend && npx vite --port 9300`)
- Backend running on port 8000 (`cd backend && .venv/bin/uvicorn app.main:app --port 8000 --reload`)
- Login with `demo@klarifai.nl` / `demo123`

## Smoke Test

Open app at http://localhost:9300 → SideRailNav on left shows exactly 3 icons (Kaart, Opgeslagen, Jurisprudentie). If you see more or fewer, the slice failed.

## Test Cases

### 1. Desktop nav shows exactly 3 items

1. Open http://localhost:9300/map in a desktop browser (≥1024px wide)
2. Look at the left SideRailNav
3. **Expected:** Exactly 3 nav items visible: Kaart (Map icon), Opgeslagen (Bookmark icon), Jurisprudentie (Scale icon). No Projecten, Meldingen, or Rapporten entries.

### 2. Mobile nav shows exactly 3 items

1. Resize browser to ≤768px width (or use mobile viewport in devtools)
2. Look at the bottom tab bar
3. **Expected:** Exactly 3 items: Kaart, Opgeslagen, Jurisprudentie. Same icons as desktop.

### 3. /projecten redirects to /opgeslagen

1. In the browser address bar, navigate to http://localhost:9300/projecten
2. **Expected:** URL changes to /opgeslagen. The Opgeslagen page renders.

### 4. /rapporten redirects to /opgeslagen

1. Navigate to http://localhost:9300/rapporten
2. **Expected:** URL changes to /opgeslagen. The Opgeslagen page renders.

### 5. /meldingen still works via direct URL

1. Navigate to http://localhost:9300/meldingen
2. **Expected:** Meldingen page renders normally with the feed. No nav item highlights for it (it's not in the nav), but the page is functional.

### 6. Individual report view still works

1. Navigate to http://localhost:9300/rapport/some-valid-id (use an ID from a previously generated report)
2. **Expected:** Report page renders. Back navigation goes to /opgeslagen (not /rapporten).

### 7. Nav item highlighting is correct

1. Click Kaart in the nav
2. **Expected:** Kaart icon gets amber highlight, URL is /map
3. Click Opgeslagen
4. **Expected:** Opgeslagen icon gets amber highlight, URL is /opgeslagen
5. Click Jurisprudentie
6. **Expected:** Jurisprudentie icon gets amber highlight, URL is /jurisprudentie

### 8. Parcel detail flow unaffected

1. On /map, click a parcel to open ParcelDetailPanel
2. Interact with the panel (scroll, check tabs)
3. **Expected:** Panel works exactly as before. No visual or functional changes.

## Edge Cases

### Double redirect doesn't loop

1. Navigate to /projecten
2. Once on /opgeslagen, navigate to /rapporten
3. **Expected:** Arrives at /opgeslagen cleanly both times. No redirect loops, no errors in console.

### Deep links with query params

1. Navigate to /projecten?someParam=value
2. **Expected:** Redirects to /opgeslagen (query params may or may not be preserved — either is acceptable since /projecten is dead)

## Failure Signals

- More or fewer than 3 items in SideRailNav or BottomTabNav
- /projecten or /rapporten show old page content instead of redirecting
- /meldingen returns 404 or blank page
- Console errors related to missing routes or broken imports
- ParcelDetailPanel behaves differently than before

## Requirements Proved By This UAT

- None directly — S01 is structural groundwork. It proves the nav is simplified and old routes redirect, which enables S02-S05.

## Not Proven By This UAT

- Opgeslagen page content (rebuilt in S05)
- Meldingen feed in gemeente modal (S03)
- Gemeente panel interactions (S02)
- Map color modes (S04)

## Notes for Tester

- The Opgeslagen page still shows whatever it showed before — S05 will rebuild it. Just confirm you land there after redirects.
- /meldingen works but has no nav entry. This is intentional — it gets killed in S03.
- ParcelDetailPanel's internal "Naar rapporten" link will hit the redirect stub. This is expected and acceptable.

# S03: Gemeente Intelligence Modals — UAT

**Milestone:** M002
**Written:** 2026-03-17

## UAT Type

- UAT mode: live-runtime
- Why this mode is sufficient: Modals render real data from API hooks — must verify against running app with backend

## Preconditions

- Backend running on port 8000 (`cd backend && .venv/bin/uvicorn app.main:app --port 8000 --reload`)
- Frontend dev server running (`cd frontend && npx vite --port 9300`)
- Logged in as `demo@klarifai.nl` / `demo123`
- At least one gemeente with scanned wijken exists (e.g. Oostzaan, Purmerend)

## Smoke Test

Click a gemeente boundary on the map → GemeenteContextPanel opens → click any summary card → a full-page modal appears with a title bar and close button.

## Test Cases

### 1. Demografie Modal Opens With CBS Data

1. Click a gemeente boundary that has scanned wijken
2. GemeenteContextPanel opens on the left
3. Click the "Inwoners" / Demografie summary card
4. **Expected:** Full-page modal opens with title "Demografie · {gemeenteNaam}". Shows inwoners count, gemiddelde WOZ, stedelijkheid badge. If CBS data exists: shows leeftijdsverdeling bars, inkomen stats, huishoudens breakdown.

### 2. Demografie Modal Empty State

1. Click a gemeente boundary that has NO scanned wijken
2. Click the Demografie summary card
3. **Expected:** Modal opens with title bar. Body shows "Geen CBS data beschikbaar" fallback text.

### 3. Wijken Modal Shows Wijk Cards

1. Click a gemeente with scanned wijken
2. Click the "Wijken" summary card
3. **Expected:** Modal opens with title "Wijken · {gemeenteNaam}". Grid of wijk cards showing: name, scan status (gescand/niet gescand), parcel count from latest scan, last scan date. Scanned wijken sorted first.

### 4. Wijken Modal Wijk Selection

1. In the Wijken modal, click a wijk card
2. **Expected:** Modal closes. Map zooms to that wijk's boundaries. GemeenteContextPanel may close or switch to wijk view.

### 5. Juridisch Klimaat Modal Opens

1. Click a gemeente boundary
2. Click the "Gem. WOZ" / Juridisch Klimaat summary card
3. **Expected:** Full-page modal opens with title "Juridisch Klimaat · {gemeenteNaam}". JurisprudenceSection loads with uitspraken feed. Wider layout (max-w-5xl) accommodating side-by-side feed list + document viewer.

### 6. Meldingen Modal With Feed

1. Click a gemeente that has meldingen data
2. Click the "Scans" / Meldingen summary card
3. **Expected:** Modal opens with title "Meldingen · {gemeenteNaam}". Shows gemeente-filtered feed with date-grouped timeline cards. Infinite scroll loads more items when scrolling to bottom.

### 7. Meldingen Modal Empty State

1. Click a gemeente with no meldingen data
2. Click the Meldingen summary card
3. **Expected:** Modal opens. Shows empty state message (e.g. "Geen meldingen voor {gemeenteNaam}").

### 8. Modal Close Via X Button

1. Open any of the 4 modals
2. Click the X close button in the title bar
3. **Expected:** Modal closes with exit animation. GemeenteContextPanel remains visible (activePanel stays 'gemeente').

### 9. Modal Close Via Escape Key

1. Open any modal
2. Press Escape
3. **Expected:** Modal closes. GemeenteContextPanel stays open. Pressing Escape again closes the panel.

### 10. /meldingen Route Redirects

1. Navigate to /meldingen directly in browser URL bar
2. **Expected:** Redirects to /map (not 404, not old meldingen page).

### 11. ParcelDetailPanel Unaffected

1. Close any open gemeente panel/modal
2. Click a parcel on the map
3. **Expected:** ParcelDetailPanel opens on the right side as usual. All parcel data loads normally. No regressions.

## Edge Cases

### Rapid Modal Switching

1. Open Demografie modal
2. Close it, immediately click Wijken card
3. **Expected:** Smooth transition — no stale modal content, no flash of previous modal.

### Escape Key Priority

1. Open a gemeente modal
2. Press Escape once
3. **Expected:** Only modal closes, panel stays. Press Escape again — panel closes.

### Modal Backdrop Click

1. Open any modal
2. Click the dark backdrop area outside the modal content
3. **Expected:** Modal closes (if click-outside-to-close is implemented).

## Failure Signals

- Modal opens but shows empty/loading spinner indefinitely → API hook failure, check Network tab for 401/500
- Escape closes both modal AND panel simultaneously → capture-phase Escape handler broken
- /meldingen shows old full meldingen page → redirect stub not applied
- TypeScript errors in `npx tsc --noEmit` → compilation regression
- ParcelDetailPanel broken after interacting with modals → mutual exclusion logic regression

## Requirements Proved By This UAT

- MELD-01 — Meldingen feed embedded in modal with card rendering (test cases 6, 7)
- MELD-02 — Gemeente filter preserved in modal, infinite scroll works (test case 6)
- GEM-02 — Gemeente context accessible via panel + modals without bottom sheet (test cases 1-9)

## Not Proven By This UAT

- MELD-01/MELD-02 full validation requires a gemeente with substantial meldingen data to verify read tracking and scroll pagination
- Modal performance with large datasets (100+ wijken, 1000+ meldingen)
- Mobile responsiveness of modals

## Notes for Tester

- The summary card labels in GemeenteContextPanel may not match the modal names exactly (e.g. "Gem. WOZ" card opens Juridisch Klimaat modal, "Scans" card opens Meldingen modal). This is intentional — cards show summary metrics, modals show full intelligence.
- 401 errors on initial gemeente click are likely stale auth tokens — re-login and retry.
- DemografieModal data comes from scanned wijken only. A gemeente with no completed scans will always show empty state — this is expected behavior, not a bug.

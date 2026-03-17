# S03: Gemeente Intelligence Modals

**Goal:** Clicking a summary card in GemeenteContextPanel opens a full-page modal with real data. Four modals: Demografie (CBS), Juridisch Klimaat (analysis), Meldingen (embedded feed), Wijken (wijk list + scan summaries). /meldingen standalone route deleted.

**Demo:** Click gemeente → left panel with summary cards. Click "Demografie" card → full-page modal with CBS stats (inwoners, WOZ, stedelijkheid). Click "Juridisch Klimaat" → modal with win/loss ratio, doorlooptijd, trend. Click "Meldingen" → modal with infinite-scroll feed filtered by gemeente. Click "Wijken" → modal with wijk cards showing scan status. Close modal → back to gemeente panel. Navigate to /meldingen → redirects to /map.

## Must-Haves

- 4 full-page modals triggered from GemeenteContextPanel summary card clicks
- Demografie modal shows real CBS data for the gemeente (inwoners, WOZ, stedelijkheid, leeftijdsverdeling)
- Juridisch Klimaat modal shows jurisprudence analysis (win ratio, doorlooptijd, trend chart)
- Meldingen modal shows gemeente-filtered infinite-scroll feed with read tracking
- Wijken modal shows wijk list with scan status and parcel counts
- Each modal has close button (X) and title bar
- /meldingen route deleted (or redirected to /map)
- Closing modal returns to the GemeenteContextPanel (activePanel stays 'gemeente')
- ParcelDetailPanel and ParcelDetailModal NOT modified (KNOWLEDGE.md hard rule)

## Verification

- `cd frontend && npx tsc --noEmit` — no TypeScript errors
- Manual: click each summary card → correct modal opens with data
- Manual: close modal → back to gemeente panel
- Manual: /meldingen → redirects (not 404)
- Manual: meldingen modal infinite scroll works
- Manual: ParcelDetailPanel still works

## Tasks

- [ ] **T01: Create modal shell and Demografie + Wijken modals** `est:1h`
  - Why: Establishes the full-page modal pattern and delivers 2 simpler modals that don't require embedding existing complex components. Demografie uses CBS data (already available via wijk-level hooks — aggregate for gemeente). Wijken reuses the wijk list from GemeenteContextPanel in expanded form.
  - Files: `frontend/src/components/map/panels/gemeente/GemeenteModal.tsx` (new), `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` (new), `frontend/src/components/map/panels/gemeente/WijkenModal.tsx` (new), `frontend/src/components/map/panels/GemeenteContextPanel.tsx`, `frontend/src/routes/_authenticated/map.tsx`
  - Do:
    1. Create `GemeenteModal.tsx` — a reusable full-page modal shell. Fixed overlay with backdrop, centered content area (max-w-3xl), title bar with close button, scrollable content. Uses framer-motion for enter/exit. Escape to close.
    2. Create `DemografieModal.tsx` — renders inside GemeenteModal. Accepts gemeente code + naam. Uses existing CBS hooks to fetch gemeente-level data. Shows: inwoners count, gemiddelde WOZ, stedelijkheid badge, leeftijdsverdeling bars, inkomen stats, huishoudens breakdown. Fallback: "Geen CBS data beschikbaar" when data is null.
    3. Create `WijkenModal.tsx` — renders inside GemeenteModal. Shows all wijken as cards with: name, scan status (gescand/niet gescand), parcel count from latest scan, last scan date. Clicking a wijk closes modal and triggers onSelectWijk.
    4. Update GemeenteContextPanel: replace `onCardClick: (category: string) => void` with specific callbacks or a state-based modal system. Add state `openModal: GemeenteCardCategory | null`. When card is clicked, set openModal. Render the corresponding modal. On modal close, set openModal back to null.
    5. Wire in map.tsx: remove the toast placeholder onCardClick handler (modal state now lives in GemeenteContextPanel).
  - Verify: `cd frontend && npx tsc --noEmit`. Click Demografie card → modal with CBS data. Click Wijken card → modal with wijk list. Close → back to panel.
  - Done when: Two modals render with real data, modal shell is reusable for T02.

- [ ] **T02: Juridisch Klimaat + Meldingen modals, kill /meldingen route** `est:1.5h`
  - Why: These two modals embed existing complex components (JurisprudenceSection, infinite scroll feed). The meldingen embedding is the most complex part — the existing 1,195-line route has infinite scroll, read tracking, and filtering that must be preserved in modal form. Killing /meldingen route is bundled here since the feature is now modal-only.
  - Files: `frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx` (new), `frontend/src/components/map/panels/gemeente/MeldingenModal.tsx` (new), `frontend/src/components/map/panels/GemeenteContextPanel.tsx`, `frontend/src/routes/_authenticated/meldingen.tsx`
  - Do:
    1. Create `JuridischKlimaatModal.tsx` — renders inside GemeenteModal. Embeds existing `JurisprudenceSection` component (from projects/) with gemeenteNaam prop and wijkNaam=null (gemeente-level). The component already handles its own data fetching (useGemeenteRulingsFeed, useGemeenteAnalysis, useDoorlooptijdStats, useTrendData). Also shows JuridischKlimaatCard.
    2. Create `MeldingenModal.tsx` — renders inside GemeenteModal. Uses `useInfiniteAllChanges(true, gemeenteNaam)` for gemeente-filtered infinite scroll. Extracts the core feed rendering logic from meldingen.tsx (timeline grouping, card rendering, read tracking, IntersectionObserver sentinel). Does NOT copy the full meldingen.tsx — extract the reusable parts into a shared component or duplicate the essential ~200 lines of feed rendering.
    3. Update GemeenteContextPanel: add modal rendering for 'juridisch' and 'meldingen' categories.
    4. Rewrite meldingen.tsx as redirect stub → /map (same pattern as projecten.tsx/rapporten.tsx). Add comment explaining feature moved to gemeente modal.
  - Verify: `cd frontend && npx tsc --noEmit`. Click Juridisch card → modal with analysis. Click Meldingen card → modal with feed. /meldingen → redirects to /map.
  - Done when: All 4 modals work with real data, /meldingen is dead, infinite scroll works in meldingen modal.

## Files Likely Touched

- `frontend/src/components/map/panels/gemeente/GemeenteModal.tsx` (new)
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` (new)
- `frontend/src/components/map/panels/gemeente/WijkenModal.tsx` (new)
- `frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx` (new)
- `frontend/src/components/map/panels/gemeente/MeldingenModal.tsx` (new)
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx`
- `frontend/src/routes/_authenticated/map.tsx`
- `frontend/src/routes/_authenticated/meldingen.tsx`

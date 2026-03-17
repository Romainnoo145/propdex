# T02: 85-explorer-ui 02

**Slice:** S04 — **Milestone:** M001

## Description

Frontend Jurisprudentie Explorer page: standalone `/jurisprudentie` route with filter sidebar, ruling cards, infinite scroll pagination, and broaden-search suggestions.

Purpose: Provide vastgoedontwikkelaars with a polished cross-gemeente court ruling search tool that demonstrates strategic value of the platform to investors.
Output: Working `/jurisprudentie` page accessible from side rail, with filtering, pagination, and empty-state handling.

## Must-Haves

- [ ] "User can navigate to /jurisprudentie via Scale icon in side rail nav"
- [ ] "User sees a filter sidebar on the left with Gemeente, Vergunningstype, Uitkomst, Rechtsgrond, Rechtbank-niveau, and Tijdsperiode filters"
- [ ] "Each filter shows result counts next to values before applying"
- [ ] "Scrolling to the bottom of results loads more rulings automatically (infinite scroll)"
- [ ] "When fewer than 3 results, user sees actionable suggestions to broaden their search"
- [ ] "Ruling cards show ECLI, rechtbank, datum, gemeente, AI summary, vergunningstype + uitkomst badges, rechtsgrond tags, doorlooptijd"
- [ ] "Filters are persisted in URL search params (page is bookmarkable/shareable)"

## Files

- `frontend/src/routes/_authenticated/jurisprudentie.tsx`
- `frontend/src/hooks/useExplorer.ts`
- `frontend/src/components/jurisprudentie/ExplorerFilterSidebar.tsx`
- `frontend/src/components/jurisprudentie/RulingCard.tsx`
- `frontend/src/components/jurisprudentie/BroadenSuggestion.tsx`
- `frontend/src/components/layout/SideRailNav.tsx`
- `frontend/src/lib/api.ts`

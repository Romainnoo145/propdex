# S01: Nav Simplification

**Goal:** Navigation shows exactly 3 items (Kaart, Opgeslagen, Jurisprudentie) on both desktop and mobile. Old routes (/projecten, /rapporten) redirect to /opgeslagen. /meldingen route still exists but is removed from nav.

**Demo:** Open app → SideRailNav shows 3 icons (Kaart, Opgeslagen, Jurisprudentie). Resize to mobile → BottomTabNav shows the same 3 items. Navigate to /projecten → redirected to /opgeslagen. Navigate to /rapporten → redirected to /opgeslagen. Navigate to /meldingen directly via URL → page loads normally.

## Must-Haves

- SideRailNav shows exactly 3 items: Kaart, Opgeslagen, Jurisprudentie
- BottomTabNav shows exactly 3 items matching desktop
- /projecten redirects to /opgeslagen
- /rapporten redirects to /opgeslagen
- /meldingen route still works (just not in nav)
- No broken links anywhere in the app — internal navigations to old routes hit redirects
- ParcelDetailPanel.tsx and ParcelDetailModal are NOT modified (per KNOWLEDGE.md hard rule)
- rapport.$id.tsx (individual report view) is NOT deleted — still accessible

## Verification

- `cd frontend && npx tsc --noEmit` — no TypeScript errors
- Manual: open app, verify SideRailNav has exactly 3 items
- Manual: resize to mobile, verify BottomTabNav has exactly 3 items
- Manual: navigate to /projecten → arrives at /opgeslagen
- Manual: navigate to /rapporten → arrives at /opgeslagen
- Manual: navigate to /meldingen → page renders normally
- Manual: navigate to /rapport/{id} → page renders normally

## Tasks

- [ ] **T01: Update nav components and route redirects** `est:45m`
  - Why: All nav and route changes are tightly coupled — updating nav without fixing routes would leave broken links, and redirect routes can't be verified without the nav changes.
  - Files: `frontend/src/components/layout/SideRailNav.tsx`, `frontend/src/components/layout/BottomTabNav.tsx`, `frontend/src/routes/_authenticated/projecten.tsx`, `frontend/src/routes/_authenticated/rapporten.tsx`, `frontend/src/routeTree.gen.ts`, `frontend/src/routes/_authenticated/rapport.$id.tsx`, `frontend/src/routes/_authenticated/resultaten.tsx`, `frontend/src/routes/_authenticated/meldingen.tsx`, `frontend/src/stories/layout/SideRailNav.stories.tsx`, `frontend/src/stories/layout/BottomTabNav.stories.tsx`
  - Do:
    1. Update SideRailNav.tsx `mainItems` array to 3 items: Kaart (/map), Opgeslagen (/opgeslagen, Bookmark icon), Jurisprudentie (/jurisprudentie, Scale icon). Remove Projecten, Meldingen, Rapporten entries. Remove useUnreadCounts hook and NotificationBadge import (no longer needed in nav — meldingen badge gone).
    2. Update BottomTabNav.tsx to match: 3 links for Kaart (/map, Map icon), Opgeslagen (/opgeslagen, Bookmark icon), Jurisprudentie (/jurisprudentie, Scale icon). Remove Projecten and Rapporten links.
    3. Rewrite projecten.tsx as a redirect route: use `beforeLoad` to throw `redirect({ to: '/opgeslagen' })`. Remove ProjectList import and component body.
    4. Rewrite rapporten.tsx as a redirect route: same pattern, redirect to /opgeslagen. Remove all report list component code.
    5. Update rapport.$id.tsx: change navigate to '/rapporten' to navigate to '/opgeslagen'. Change navigate to '/projecten' to navigate to '/opgeslagen'.
    6. Update resultaten.tsx: change navigate to '/projecten' to navigate to '/opgeslagen'.
    7. Update meldingen.tsx: change navigate to '/projecten' to navigate to '/opgeslagen'.
    8. Do NOT modify ParcelDetailPanel.tsx (KNOWLEDGE.md rule). Its navigate to '/rapporten' will hit the redirect — acceptable.
    9. Regenerate routeTree.gen.ts by running `cd frontend && npx tsr generate` (if config exists) or manually update the route tree to reflect changed route components.
    10. Update stories: SideRailNav.stories.tsx default route to '/map', BottomTabNav.stories.tsx default route to '/map'.
  - Verify: `cd frontend && npx tsc --noEmit` passes. App runs and nav shows 3 items on both viewports.
  - Done when: TypeScript compiles clean, nav shows exactly 3 items on desktop and mobile, /projecten and /rapporten redirect to /opgeslagen, /meldingen still works via direct URL.

## Files Likely Touched

- `frontend/src/components/layout/SideRailNav.tsx`
- `frontend/src/components/layout/BottomTabNav.tsx`
- `frontend/src/routes/_authenticated/projecten.tsx`
- `frontend/src/routes/_authenticated/rapporten.tsx`
- `frontend/src/routes/_authenticated/rapport.$id.tsx`
- `frontend/src/routes/_authenticated/resultaten.tsx`
- `frontend/src/routes/_authenticated/meldingen.tsx`
- `frontend/src/routeTree.gen.ts`
- `frontend/src/stories/layout/SideRailNav.stories.tsx`
- `frontend/src/stories/layout/BottomTabNav.stories.tsx`

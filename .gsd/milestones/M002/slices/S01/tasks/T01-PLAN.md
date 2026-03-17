# T01: Update nav components and route redirects

## Slice Context

**Goal:** Navigation shows exactly 3 items (Kaart, Opgeslagen, Jurisprudentie) on both desktop and mobile. Old routes redirect to /opgeslagen.

**Demo:** SideRailNav shows 3 icons. BottomTabNav matches. /projecten and /rapporten redirect to /opgeslagen. /meldingen still works via URL.

## Description

Single task covering all nav and route changes. The work is tightly coupled — nav item removal, route redirects, and internal navigation updates must all land together.

**Critical constraint:** ParcelDetailPanel.tsx and ParcelDetailModal MUST NOT be modified (KNOWLEDGE.md hard rule). ParcelDetailPanel navigates to `/rapporten` — this will hit the redirect route, which is acceptable.

## Steps

1. **SideRailNav.tsx** — Replace `mainItems` array with 3 items:
   - Kaart: `{ icon: <Map size={22} strokeWidth={1.5} />, label: 'Kaart', to: '/map' }`
   - Opgeslagen: `{ icon: <Bookmark size={22} strokeWidth={1.5} />, label: 'Opgeslagen', to: '/opgeslagen' }` (use `Bookmark` from lucide-react)
   - Jurisprudentie: `{ icon: <Scale size={22} strokeWidth={1.5} />, label: 'Jurisprudentie', to: '/jurisprudentie', search: { gemeente: undefined, vergunningstype: undefined, uitkomst: undefined, rechtsgrond: undefined, rechtbank_niveau: undefined, periode: undefined, view: undefined } as unknown as Record<string, string> }`
   - Remove `Bell`, `FolderOpen`, `FileText` from lucide-react imports. Add `Bookmark`.
   - Remove `useUnreadCounts` import and hook call.
   - Remove `NotificationBadge` import.

2. **BottomTabNav.tsx** — Replace the 3 Link elements:
   - Kaart → `/map` with Map icon (keep as-is)
   - Opgeslagen → `/opgeslagen` with Bookmark icon (replace FolderOpen/Projecten)
   - Jurisprudentie → `/jurisprudentie` with Scale icon (replace FileText/Rapporten)
   - Update imports: remove `FolderOpen`, `FileText`, add `Bookmark`, `Scale`.

3. **projecten.tsx** — Rewrite as redirect:
   ```tsx
   import { createFileRoute, redirect } from '@tanstack/react-router'

   export const Route = createFileRoute('/_authenticated/projecten')({
     beforeLoad: () => {
       throw redirect({ to: '/opgeslagen' })
     },
   })
   ```

4. **rapporten.tsx** — Rewrite as redirect:
   ```tsx
   import { createFileRoute, redirect } from '@tanstack/react-router'

   export const Route = createFileRoute('/_authenticated/rapporten')({
     beforeLoad: () => {
       throw redirect({ to: '/opgeslagen' })
     },
   })
   ```

5. **rapport.$id.tsx** — Update all navigations from `/rapporten` and `/projecten` to `/opgeslagen`. There are 3 navigate calls to update:
   - `navigate({ to: '/rapporten', ... })` → `navigate({ to: '/opgeslagen' })`
   - `navigate({ to: '/projecten' })` → `navigate({ to: '/opgeslagen' })`
   - The ternary `search.from === 'resultaten' ? '/resultaten' : '/projecten'` → `search.from === 'resultaten' ? '/resultaten' : '/opgeslagen'`

6. **resultaten.tsx** — Change `navigate({ to: '/projecten' })` to `navigate({ to: '/opgeslagen' })`.

7. **meldingen.tsx** — Change `navigate({ to: '/projecten' })` to `navigate({ to: '/opgeslagen' })`.

8. **Stories** — Update SideRailNav.stories.tsx and BottomTabNav.stories.tsx default route from `/projecten` to `/map`.

9. **routeTree.gen.ts** — Try `cd frontend && npx tsr generate`. If that fails (decision log says "tsr generate requires a config file that isn't present"), manually verify the route tree is consistent. The projecten and rapporten routes stay in the tree (they still exist as files, just redirect now), so no tree changes should be needed if the file exports haven't changed structurally.

## Must-Haves

- SideRailNav has exactly 3 nav items: Kaart, Opgeslagen, Jurisprudentie
- BottomTabNav has exactly 3 nav items matching desktop
- /projecten route redirects to /opgeslagen (not 404)
- /rapporten route redirects to /opgeslagen (not 404)
- /meldingen still loads normally via direct URL
- /rapport/{id} still loads normally
- ParcelDetailPanel.tsx is NOT modified
- No TypeScript compilation errors

## Verification

```bash
cd frontend && npx tsc --noEmit
```

Then visually verify:
- App loads, SideRailNav shows 3 items
- Mobile viewport shows BottomTabNav with 3 items
- /projecten → /opgeslagen redirect works
- /rapporten → /opgeslagen redirect works
- /meldingen → loads normally
- /rapport/{id} → loads normally

## Inputs

- Current SideRailNav.tsx (5 main items: Kaart, Projecten, Meldingen, Rapporten, Jurisprudentie)
- Current BottomTabNav.tsx (3 items: Kaart, Projecten, Rapporten)
- Current projecten.tsx (renders ProjectList in ResultsShell)
- Current rapporten.tsx (renders report list)
- Various components navigating to /projecten or /rapporten

## Expected Output

- SideRailNav.tsx with 3 items, no notification badge imports
- BottomTabNav.tsx with 3 items matching desktop
- projecten.tsx as minimal redirect stub
- rapporten.tsx as minimal redirect stub
- rapport.$id.tsx, resultaten.tsx, meldingen.tsx with updated navigate targets
- Updated stories
- Clean TypeScript compilation

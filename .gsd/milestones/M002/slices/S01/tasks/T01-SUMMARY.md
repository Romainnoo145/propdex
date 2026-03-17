---
status: complete
started: 2026-03-17T12:30:00+07:00
completed: 2026-03-17T12:45:00+07:00
---

# T01 Summary: Update nav components and route redirects

## What Changed

- **SideRailNav.tsx**: Reduced from 5 nav items to 3 (Kaart, Opgeslagen, Jurisprudentie). Removed useUnreadCounts hook, NotificationBadge import, Bell/FolderOpen/FileText icons. Added Bookmark icon.
- **BottomTabNav.tsx**: Updated to match desktop — 3 items with Kaart, Opgeslagen (Bookmark icon), Jurisprudentie (Scale icon).
- **projecten.tsx**: Rewrote as redirect stub → /opgeslagen. Kept route file alive because ParcelDetailPanel.tsx navigates here and cannot be modified.
- **rapporten.tsx**: Same redirect stub pattern → /opgeslagen.
- **rapport.$id.tsx**: Updated 3 navigate calls and 2 back labels from /rapporten and /projecten to /opgeslagen.
- **resultaten.tsx**: Updated fallback navigate from /projecten to /opgeslagen.
- **meldingen.tsx**: Updated empty state CTA from "Naar projecten" (/projecten) to "Naar opgeslagen" (/opgeslagen).
- **Stories**: Updated SideRailNav and BottomTabNav stories from /projecten to /opgeslagen.

## Verification

- `npx tsc --noEmit` — clean, no errors
- SideRailNav: 3 items confirmed (Kaart, Opgeslagen, Jurisprudentie)
- BottomTabNav: 3 items confirmed (Kaart, Opgeslagen, Jurisprudentie)
- /projecten and /rapporten routes exist as redirect stubs
- /meldingen route file untouched (still works via URL)
- ParcelDetailPanel.tsx NOT modified (KNOWLEDGE.md rule respected)

## Forward Intelligence

- components/projects/* (PortfolioView, DrilldownBreadcrumb, etc.) still navigate to /projecten internally — this is fine because those components are rendered behind the /projecten redirect. S05 will rebuild /opgeslagen with new components.
- ParcelDetailPanel.tsx navigates to /rapporten which hits the redirect. Acceptable until a dedicated report navigation pattern is established.

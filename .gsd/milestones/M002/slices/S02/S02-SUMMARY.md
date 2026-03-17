---
status: complete
started: 2026-03-17T12:50:00+07:00
completed: 2026-03-17T13:10:00+07:00
---

# S02 Summary: GemeenteContextPanel

## Result

GemeenteContextPanel renders on the left side (~400px) with 4 summary cards and wijk list. Panel orchestration extracted into useMapPanels hook. ParcelDetailPanel unchanged on the right.

## What Was Delivered

- **useMapPanels hook** — ActivePanel type, state, and navigation handlers extracted from map.tsx (138 lines new, 52 lines removed from map.tsx)
- **LeftPanelShell** — left-side panel shell at `fixed left-[112px]` with Aura glass styling, slide-in animation, mobile bottom sheet fallback
- **GemeenteContextPanel** — replaces GemeenteMapPanel with 4 summary cards (Demografie, Juridisch Klimaat, Meldingen, Wijken) plus wijk list
- Summary card onClick fires toast placeholder ("komt in S03")
- GemeenteMapPanel.tsx deleted
- Mutual exclusion via ActivePanel union type preserved
- ParcelDetailPanel untouched (KNOWLEDGE.md rule)

## Forward Intelligence

- **Summary card clicks are toast placeholders** — S03 must wire `onCardClick` to full-page modals with real data
- **LeftPanelShell is reusable** — any future left-side panel can use it
- **useMapPanels exposes `setActivePanel`** — map.tsx still calls it directly for parcel opens (15+ inline calls with heavy local deps). Further extraction possible but diminishing returns.
- **WijkMapPanel still uses MapPanelShell (right side)** — asymmetric positioning: gemeente=left, wijk=right, parcel=right. This is intentional per the M002 vision.

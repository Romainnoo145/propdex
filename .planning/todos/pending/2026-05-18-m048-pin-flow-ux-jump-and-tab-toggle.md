---
created: 2026-05-18
source: M050/S06 smoke walk-through (Section A — M048 regression test)
scope: M048 (Factor pinning + groep-pages)
type: ux-polish
priority: medium
status: pending
---

# M048 pin-flow voelt klunky: directe pin-page jump + ghost-pijltjes voor tab-paginering

## Surfacing

Tijdens M050/S06 smoke (Section A regressie-test) viel op dat de M048 pin/groep-pages flow gewoon werkt — maar twee UX-frictiepunten:

### 1. Pin → directe nieuwe pin-page jump

Wanneer je een factor pint vanaf de Potentie tab, navigeert de UI **direct** naar de nieuwe pin-page (de "groep" met die factor erin). Verwachting was eerder een soort "feedback" (ster wordt amber + toast?) en blijven waar je bent, niet meteen wegspringen.

**Effect:** je verliest context van waar je was. Wil je nog een tweede factor pinnen, dan moet je terug navigeren.

**Mogelijke richting:** pinnen blijft op huidige page (star amber + toast "Toegevoegd aan pinned"), en de pinned-page is bereikbaar via expliciete navigatie (extra tab of CTA).

### 2. Ghost-pijltjes voor tab-paginering

De Potentie/Risico tabs zijn paginated met "ghost arrows" (←/→). Doorklikken naar de volgende bron-page voelt onnatuurlijker dan een toggle/segmented control zou doen.

**Mogelijke richting:** mini-toggle (segmented control) bovenaan met directe page-keuze, zoals een tab-strip binnen-tab. Dan zie je in één blik hoeveel pages er zijn en kun je direct springen.

## Niet-scope (S06)

S06 was puur cockpit + lifecycle-sidebar werk. M048 pin-mechanisme is geverifieerd niet stuk (Section A PASS). Dit is M048-polish, los plannen.

## Vervolg

- [ ] In een toekomstige M048-polish slice meenemen
- [ ] Eventueel `/plan-design-review` op de M048 pin-page om de jump + paginering UX te evalueren
- [ ] Beslissen: pin → blijven of pin → springen? Toast pattern definiëren?

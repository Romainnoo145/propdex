# Bijdrage-bars layout + uniforme factor-detail-drawer

**Datum:** 2026-06-22
**Milestone:** M054 (nieuwe frontend-slice)
**Status:** design — wacht op user-review

---

## Doel

Twee samenhangende wijzigingen aan het ParcelDetailPanel (Potentie/Risico-tabs):

1. **Layout → Variant C "Bijdrage-bars".** Vervang de huidige weight-sorted `FactorCard`-rijenlijst door een diverging tornado/waterfall: elke factor een balk vanaf een middenas (groen stuwt rechts, rood remt links), gesorteerd op `|bijdrage|`. De score wordt visueel opgebouwd zichtbaar.

2. **Elke factor klikbaar → één uniforme rechter slide-in drawer.** Nu hebben alleen de 5 cascade-factoren een detail; de andere ~24 factoren zijn dood bij klik. Na deze slice opent élke factor dezelfde rechter drawer. Cascades tonen hun bestaande editorial content; alle overige factoren tonen een generieke uitleg-body uit reeds bestaande backend-velden. De oude in-panel "overvloei"-drill-down vervalt.

**Niet in scope:** backend-wijzigingen, nieuwe data-bronnen, SCHEMA_VERSION-bump, de Dossiers-tab, de bento-overview-tab.

---

## Huidige situatie (geverifieerd in code)

- `PotentieLayer` / `RisicoLayer` bouwen een weight-sorted `PageCard[]` en renderen die als `FactorCard layout="row"`.
- `cardClick(card)` geeft alleen een handler terug voor de 5 cascade-keys (`woonvisie_match`, `beleidsalignement`, `grondwaarde_fit`, `splitsingsrisico`/huisvestingsverordening, `parkeerdruk`); anders `undefined` → niet klikbaar.
- Elke cascade heeft een `*Popup`-wrapper die **zelf** de rechter slide-in drawer-chrome herimplementeert (portal → `document.body`, `AnimatePresence`, backdrop `bg-black/30 backdrop-blur-md`, `justify-end`, `x: '100%' → 0`, `max-w-[680px]`, `rounded-l-[32px]`, close-knop). Vijf keer bijna identieke chrome.
- Elke `*Popup` deelt een herbruikbare `*DetailContent`-body (editorial: meta → gebied/titel → karakter → citaat → `RandvoorwaardenSection`).
- De in-panel "overvloei"-drill-down is de optionele `onOpenWoonvisie` / `onOpenOmgevingsvisie`-callback-route naar de parent view-stack. Bij afwezigheid valt de layer terug op de lokale drawer-popup (= huidige default).
- **`ScoreBreakdownModal`** rendert al een volledige generieke factor-uitleg per factor: `toelichting_kort`, `toelichting_lang`, `data_bronnen`, en de score-opbouw (`genormaliseerde_score`, `gewicht`, `bijdrage`, `percentage_of_category`), inclusief missing-state. Deze logica is herbruikbaar.
- Backend (`score_v3_factors.py`) vult voor élke factor `toelichting_lang` (57 context-afhankelijke teksten), `toelichting_kort` en `data_bronnen`. Er hoeft niets verzonnen te worden.

---

## Architectuur

Vier units, elk met één duidelijke verantwoordelijkheid.

### 1. `FactorDetailDrawer` (nieuw — gedeelde chrome)

De single source of truth voor de rechter slide-in. Geëxtraheerd uit de chrome die nu 5× in de `*Popup`-wrappers staat.

- **Wat:** portal → `document.body`; `AnimatePresence` backdrop-fade + paneel `x: '100%' → 0` (`ease [0.4,0,0.2,1]`, 0.3s); `max-w-[680px]`, full-height, `rounded-l-[32px]`, `shadow-2xl`; close-knop rechtsboven; backdrop-klik + `Esc` sluiten; scrollbare body via `children`.
- **Props:** `{ isOpen: boolean; onClose: () => void; children: React.ReactNode; labelledBy?: string }`.
- **Afhankelijk van:** `framer-motion`, `react-dom/createPortal`, Aura-tokens. Niets factorspecifieks.
- **Toegankelijkheid:** `role="dialog"`, `aria-modal`, focus-trap, `Esc`-handler, focus terug naar trigger bij sluiten.

De 5 bestaande `*Popup`-wrappers worden hierop herschreven (chrome eruit, alleen `<FactorDetailDrawer><XDetailContent .../></FactorDetailDrawer>` over). Editorial bodies blijven 1:1.

### 2. `FactorExplainBody` (nieuw — generieke uitleg)

Geëxtraheerd uit de per-factor expanded render van `ScoreBreakdownModal`. De drawer-body voor élke niet-cascade-factor.

- **Props:** `{ name: string; factor: ScoreFactor }` (bestaande `ScoreFactor`-shape uit `ScoreBreakdownModal`).
- **Toont:**
  - Titel = leesbare factornaam (`formatFactorName`, hergebruikt).
  - **Wat meet deze factor** — `toelichting_lang` (of `toelichting_kort` als lang ontbreekt). Bij `missing` de neutrale uitleg-tekst.
  - **Waarde** — `waarde` leesbaar geformatteerd (hergebruik `formatFactorValue`-helpers waar mogelijk).
  - **Score-opbouw** — `genormaliseerde_score` × `gewicht` = `bijdrage`; `percentage_of_category` als aandeel binnen categorie. Visueel klein, niet dominant.
  - **Databron** — chips uit `data_bronnen` (Kadaster, BAG, CBS, RIVM, …).
- **Geen verzonnen content.** Alleen bestaande velden. Factoren zonder `toelichting_lang` tonen de korte tekst + score-opbouw + bron; dat is de eerlijke ondergrens.

### 3. `BijdrageBar` (nieuw — Variant C visual)

De diverging balk per factor. Eén component, herbruikt in beide tabs (kleur draait om per tab).

- **Props:** `{ card: PageCard; tone: 'positive' | 'negative'; onClick?: () => void; comingSoon?: boolean }`.
- **Visual (uit `compare.html` Variant C):** label-kolom (`92px`, rechts uitgelijnd, uppercase) + track met middenas; `pos`-fill vanaf 50% naar rechts (groen-gradient), `neg`-fill vanaf 50% naar links (rood-gradient); waarde-pill (`+8.5` / `−2.8`) in de fill. Breedte ∝ `|bijdrage|` genormaliseerd op de max in de lijst.
- **Klikbaar:** hele balk is de button (`role="button"`, `tabIndex`, `Enter`/`Space`), zelfde affordance-patroon als de huidige `FactorCard`. `comingSoon` → dashed, non-interactief.
- **Missing-factoren:** balk met breedte 0 / "—"-pill, wél klikbaar (drawer legt uit waarom data ontbreekt).

> Keuze: nieuw component i.p.v. `FactorCard layout="bar"` — de diverging-track-visual verschilt te veel van de grid/row-shells; een eigen component houdt beide focused. De pin/star-affordance uit `FactorCard` wordt niet meegenomen in de bar (YAGNI; pinnen blijft op de bento-overview).

### 4. Uniforme drawer-state in de layers

Vervang de N losse `useState` per cascade door één state:

```ts
const [activeFactorKey, setActiveFactorKey] = useState<string | null>(null)
```

- `cardClick(card)` geeft **altijd** een handler terug: `() => setActiveFactorKey(card.factor_key)` (ook voor niet-cascades; `comingSoon` uitgezonderd).
- Eén `<FactorDetailDrawer isOpen={activeFactorKey !== null} onClose={() => setActiveFactorKey(null)}>` met body-dispatch:
  - cascade-key (set van 5) → bijbehorende `*DetailContent` met de uit `score_breakdown` geëxtraheerde props (bestaande extractie blijft).
  - anders → `<FactorExplainBody name={activeFactorKey} factor={...} />`.
- De optionele `onOpenWoonvisie` / `onOpenOmgevingsvisie`-props en de parent view-stack drill-down vervallen (back-compat-pad weg).

---

## Data flow

```
parcel.score_breakdown
  → parseFactors() (hergebruik uit ScoreBreakdownModal)
  → cards gesorteerd op |bijdrage| desc  (bestaande sortByWeight)
  → BijdrageBar[] per tab (Potentie groen / Risico rood)
  → klik → setActiveFactorKey(factor_key)
  → FactorDetailDrawer dispatcht body:
       cascade-key → *DetailContent (editorial)
       overige     → FactorExplainBody (toelichting_lang + bron + score-opbouw)
```

Geen nieuwe data-fetch; alles uit `score_breakdown` dat al in de payload zit.

---

## LOCKED-pattern (M053/S07) behandeling

Het cascade detail-view-patroon is als LOCKED gemarkeerd (randvoorwaarden display-only + editorial drill-down + globale SCHEMA_VERSION).

- **Behouden 1:1:** alle `*DetailContent`-bodies, `RandvoorwaardenSection`, de editorial structuur, de `score_breakdown`-shape en SCHEMA_VERSION (geen bump — geen datawijziging).
- **Verandert alleen:** de *container* (alles → `FactorDetailDrawer`) en de *trigger* (uniforme `activeFactorKey`). De in-panel "overvloei"-mode vervalt.
- User heeft deze design-shift expliciet goedgekeurd (2026-06-22).

---

## Testing

Vitest (frontend), in lijn met bestaande `__tests__`:

- `FactorDetailDrawer`: opent/sluit op `isOpen`; backdrop-klik + `Esc` sluiten; rendert `children`; focus-trap actief.
- `FactorExplainBody`: toont `toelichting_lang`; toont `data_bronnen`-chips; toont score-opbouw; missing-factor toont neutrale uitleg zonder score-pretentie.
- `BijdrageBar`: `pos` vult rechts / `neg` vult links; breedte ∝ `|bijdrage|`; klik triggert `onClick`; `Enter`/`Space` triggeren; `comingSoon` is non-interactief.
- Layer-integratie: elke niet-comingSoon-bar levert een klik die `activeFactorKey` zet; cascade-key rendert editorial body; niet-cascade-key rendert `FactorExplainBody`.
- Regressie: de 5 cascade-drawers tonen nog steeds hun editorial content (factor-coverage-test intact houden).

Quality-gate per CLAUDE.md: `npm run check` (tsc + eslint) exit 0 + vitest groen vóór review.

---

## Open punten / aannames

- **Aanname:** `parseFactors` + `ScoreFactor` uit `ScoreBreakdownModal` worden naar een gedeeld `lib/`-bestand getild zodat zowel de modal als de nieuwe drawer dezelfde parser delen (geen duplicatie). Modal blijft verder ongewijzigd.
- **Aanname:** Variant C vervangt de rijenlijst in beide tabs; de sticky verdict-hero bovenaan (recent gebouwd) blijft staan.
- **Aanname:** `ScoreBreakdownModal` (bento-overview "alle factoren"-knop) blijft bestaan naast de per-factor drawer — twee verschillende entrypoints, geen conflict. Te bevestigen of we die modal op termijn willen vervangen (buiten scope nu).

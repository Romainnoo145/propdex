# PDF-viewer-drawer + Dossier-tab refurb

**Datum:** 2026-06-22
**Milestone:** M054 — twee nieuwe slices (S04 PDF-viewer-drawer → S05 Dossier-refurb)
**Status:** design — wacht op user-review

---

## Doel

Twee samenhangende frontend-wijzigingen, in volgorde:

1. **PDF-viewer-drawer (S04)** — vervang de krappe `PDFViewerModal` (max-w-3xl / 768px, A4 te klein) door één gedeelde **brede rechter slide-in drawer** die een document op **fit-to-width A4** toont met zoom. Zelfde drawer-familie als de bestaande `FactorDetailDrawer` (chrome/animatie), alleen breder omdat A4 dat vraagt. Hergebruikt op álle huidige PDF-plekken.

2. **Dossier-tab refurb (S05)** — trek de Dossier-tab (`BronnenLayer`) gelijk met Potentie/Risico: **paginatie-toggle eruit → één doorlopende scroll** met categorie-koppen, kaarten in de **Tile-icon-taal (2-koloms)**, en geüploade bestanden **makkelijk inzien** via de nieuwe PDF-viewer-drawer.

**Niet in scope:** backend-wijzigingen; nieuwe databronnen; de eerder besproken card-verrijking (bron-chip/datum — bewust geschrapt); volledige unificatie van de map- en cockpit-dossier-`buildPages` (verschillende data-inputs — apart cleanup-traject).

---

## Achtergrond (geverifieerd in code)

- `PDFViewerModal` (`components/ui/PDFViewerModal.tsx`): centered modal, `max-w-3xl` (768px), `h-[calc(100vh-64px)]`, PDF in een `<iframe>`. Auth-fetch → blob-url. Gebruikt op **3 plekken**: `ChecklistCore`, `DocumentSourceDetailView`, `OnderzoekPhaseView`.
- `FactorDetailDrawer` (`components/map/panels/parcel/FactorDetailDrawer.tsx`): de bestaande rechter slide-in (portal → body, `AnimatePresence` backdrop `bg-black/30 backdrop-blur-md justify-end`, paneel `x:'100%'→0` ease `[0.4,0,0.2,1]`, `rounded-l-[32px]`, close + Esc). Dé drawer-familie.
- **Dossier bestaat 2×:** de map-tab `BronnenLayer` (eigen inline `buildPages`, eigen `DropzoneCard`, 5 pagina's via `PageTitleToggle`, 3-koloms grid) én de cockpit Onderzoek-fase `OnderzoekPhaseView` → `DossierSection`/`DossierCardSlot` op de gedeelde laag `lib/cockpit/dossier-pages` (`buildPages`/`mergeDocuments`/`flattenCards`/`GHOST_ICONS`) mét `PDFViewerModal` via een `onView`-actie.
- **Documenten zijn per perceel** (`useParcelDocuments(parcel_code || parcel_id)`), backend-gedeeld. Een upload in de map-tab is hetzelfde document als in de Onderzoek-fase → de linkage zit op de datalaag, niet in de UI-code.
- `lib/cockpit/dossier-pages.buildPages(favorite: FavoriteResponse)` is gekoppeld aan `FavoriteResponse`; `mergeDocuments`/`flattenCards`/`GHOST_ICONS`/de `DossierCard`-types zijn data-shape-agnostisch en herbruikbaar.

---

## Slice 1 (S04) — `PdfViewerDrawer`

### Component
Nieuw: `frontend/src/components/ui/PdfViewerDrawer.tsx`. Vervangt `PDFViewerModal`.

- **Chrome:** dezelfde taal als `FactorDetailDrawer` — `createPortal` → `document.body`, `AnimatePresence` backdrop (`bg-black/30 backdrop-blur-md`, `justify-end`), paneel `initial x:'100%' → 0`, `transition {duration:0.3, ease:[0.4,0,0.2,1]}`, `rounded-l-[32px]`, `shadow-2xl`, close-knop + `Esc`/backdrop-klik sluiten.
- **Breedte (bescheiden):** `w-[52vw] min-w-[840px] max-w-[1100px]`, volle hoogte. Breder dan de gewone drawer omdat A4 leesbaar moet zijn; bewust niet 62vw.
- **Header:** eyebrow + bestandsnaam (links); zoom-control `− [pct] +` (rechts) + download + (optioneel) verwijderen + close.
- **Viewport:** grijs werkblad (`bg-[#ECEFF1]`), gecentreerde A4-pagina. **Eén vaste fit-modus: fit-to-width** (geen Breedte/Pagina-toggle). Zoom past een schaalfactor toe op de fit-to-width-basis (stappen, bv. 60–200%, default 100%). PDF via `<iframe>`/embed van de blob-url (zoals nu); afbeeldingen via `<img>`.
- **Optionele bestandsrail** (`files?: ParcelDocumentMeta[]` + `activeId`): links een smalle kolom met de bestanden van de context (bv. een dossier-slot), klikbaar; actief = amber. Onderaan een upload-affordance als `onUpload` is meegegeven. Afwezig → alleen de viewer (single-doc plekken).

### Props
```
interface PdfViewerDrawerProps {
  isOpen: boolean
  onClose: () => void
  url: string                 // blob/download url van het actieve document
  title: string               // bestandsnaam
  eyebrow?: string            // bv. "Bouwkundig · Dossier"
  files?: { id: string; filename: string; uploadedAt?: string }[]  // rail (optioneel)
  activeId?: string
  onSelectFile?: (id: string) => void
  onDownload?: () => void
  onDelete?: () => void
  onUpload?: () => void
}
```

### Migratie
Vervang `PDFViewerModal` in `ChecklistCore`, `DocumentSourceDetailView`, `OnderzoekPhaseView` door `PdfViewerDrawer` (zonder rail, single-doc — `files` weggelaten). Verwijder `PDFViewerModal.tsx` na migratie. Auth-blob-fetch-logica 1:1 overnemen.

### Testing
- Pure helper `zoomSteps`/`clampZoom(level)` (de zoom-stappen + grenzen) → node-env Vitest.
- Rendering via Storybook (`PdfViewerDrawer.stories.tsx`): single-doc, met-rail, laad/foutstate. Geen RTL.

---

## Slice 2 (S05) — Dossier-tab refurb (`BronnenLayer`)

### Layout
- **Toggle weg:** verwijder `PageTitleToggle` + de `page`-state. Render **alle categorieën in één doorlopende scroll**, elk voorafgegaan door een **sectie-kop** (categorie-naam + dunne lijn), in de stijl van de "Binnenkort"-divider bij Potentie/Risico.
- **Hero:** toont **totale compleetheid** over álle slots (`gevuld/totaal`) + amber balk, zelfde geometrie als de verdict-hero. Niet meer per-pagina.
- **Kaarten:** nieuw `DossierSlotCard` in de **Tile-icon-taal**, **2-koloms grid** (`grid-cols-2 gap-2`). Eén skelet voor alle states, **alles links uitgelijnd**:
  - Top: amber/emerald/grijs **icoon-tegel** (rounded-[13px], `iconForFactor`-stijl) links + status-indicator (dot/badge) rechts.
  - Body (onderin): label-kicker + waarde, links.
  - **3 states** (kleur + indicator verschillen, skelet identiek):
    - **Leeg** — dashed border, grijze tegel, waarde "Sleep of klik", grijze dot. Hele kaart = dropzone (drag&drop) + klik = upload.
    - **API-data** — emerald border + dot, tegel emerald-tint, waarde = de databron-waarde (WOZ €, m², energieklasse…).
    - **Eigen uploads** — amber border + tegel, badge met aantal, waarde "N bestanden".
  - **Geen "+ toevoegen"-knop** (klik = upload). Geen verrijkings-meta (bron-chip/datum) — geschrapt.
- Lege/coming-soon categorieën blijven zoals de huidige slot-set (Projectnotities · Acquisitie · Technisch · Juridisch · Planologisch).

### Inzien van documenten
- Klik op een slot **met documenten** → opent de **`PdfViewerDrawer`** met `files` = de documenten van dat slot (rail), `activeId` = eerste/geselecteerde, `onDownload`/`onDelete`/`onUpload` doorgewired naar de bestaande document-mutations. Dit is het "makkelijk inzien". Geen gestapelde drawers — één brede drawer doet lijst + viewer.
- Klik op een **leeg** slot (of drag&drop) → upload (bestaande flow: `fileInput` + `useUploadDocument`).
- Download/verwijder verlopen via de bestaande `useDeleteDocument` + `getDocumentDownloadUrl`/auth-blob.

### Gedeelde laag (drift-reductie, geen risico-refactor)
- Hergebruik uit `lib/cockpit/dossier-pages`: de `DossierCard`/`DossierPage`-types, `GHOST_ICONS`, `mergeDocuments`, `flattenCards` (shape-agnostisch).
- De map-tab houdt z'n **eigen page-builder** (andere input: `ScanResultItem` + enrichment i.p.v. `FavoriteResponse`) maar produceert dezelfde `DossierPage`-shape. Volledige builder-unificatie = los toekomstig cleanup-traject (genoteerd, niet hier).
- `flattenCards` levert de doorlopende lijst per categorie voor de scroll.

### Testing
- Pure helpers node-env Vitest: de map-page-builder produceert de verwachte slots/states; `flattenCards`/`mergeDocuments` gedrag (hergebruik bestaande tests waar aanwezig); compleetheids-telling (`gevuld/totaal`).
- `DossierSlotCard` + de scroll via Storybook (3 states, 2-koloms). Geen RTL.

---

## Architectuur-samenvatting

```
PdfViewerDrawer (ui/, gedeeld)
  ├── vervangt PDFViewerModal in ChecklistCore · DocumentSourceDetailView · OnderzoekPhaseView (single-doc)
  └── gebruikt door BronnenLayer (met file-rail = slot-documenten)

BronnenLayer (Dossiers-tab)
  ├── één scroll + categorie-koppen (geen PageTitleToggle)
  ├── hero = totale compleetheid
  ├── DossierSlotCard (Tile-icon, 2-koloms, 3 states, alles links)
  ├── klik slot-met-docs → PdfViewerDrawer (rail = slot-docs)
  └── deelt types/GHOST_ICONS/mergeDocuments/flattenCards met lib/cockpit/dossier-pages
```

Datalaag-linkage met de Onderzoek-fase blijft intact (zelfde per-perceel documenten).

---

## Global constraints

- Aura-tokens / Tailwind-utilities; geen hardcoded brand-hex buiten de gevestigde (`#0E1111`, `#F2F6F3`, `#9CA3AF`, amber `#F9A826`/tints, sage `#D1E2D8`). Plus Jakarta Sans. Light mode only.
- Bestanden < 300 regels; splits anders (BronnenLayer is al groot — `DossierSlotCard` + de page-builder als aparte bestanden houden).
- Tests = node-env pure-logic Vitest (geen jsdom/RTL); rendering via Storybook (`frontend/src/stories/parcel|ui/`).
- Quality-gate per slice: `npm run check` exit 0 + relevante `vitest` groen vóór review.
- Commit-prefix: `M054/S04:` (viewer) resp. `M054/S05:` (dossier). SCHEMA_VERSION onaangeroerd.
- Drawer-breedte viewer: `w-[52vw] min-w-[840px] max-w-[1100px]`; fit-to-width only; geen fit-modus-toggle.

---

## Aannames / open punten

- **Aanname:** de bestaande document-upload/download/delete-flow + auth-blob-fetch wordt 1:1 hergebruikt; alleen de presentatie verandert.
- **Aanname:** niet-PDF-bestanden (jpg/png) worden in de viewer als `<img>` getoond op dezelfde A4-werkblad-achtergrond; overige types (docx/xlsx) tonen een download-fallback (zoals de modal nu).
- **Te bevestigen later (niet blocking):** of de cockpit `DossierSection` óók naar de nieuwe scroll/Tile-icon-stijl migreert — nu houden we 'm zoals-ie is; deze slice raakt alleen de map-Dossiers-tab + de gedeelde viewer.

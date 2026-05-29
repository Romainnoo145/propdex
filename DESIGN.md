# Aura — Propdex Design System

> **North Star:** Propdex is een builder's cockpit. **Map-first** wanneer je beslist *waar* je bouwt, **data-dense** wanneer je beslist *hoe*. Twee modes, één systeem — van grondpositie tot eerste spade.

---

## Product Context

- **What this is:** Dutch property intelligence cockpit. End-to-end van scouting → screening → due diligence → risico → go/no-go → vergunningenbeheer tot aan bouwfase.
- **Who it's for:**
  1. **Vastgoedontwikkelaars** (primary) — zoeken grondposities, beoordelen transformatiepotentie, managen vergunningtrajecten.
  2. **Kwaliteitsborgers** (secondary) — due-diligence en risico-screening.
- **Space:** Dutch proptech / civic intelligence. Concurrenten: Matrixian, Calcasa, Vindsubsidies, fundament.nl, Brainbay/NVM. Makelaars zijn wel onze markt (Hauzer = full-service developer-adjacent: makelaardij, advies, verkoop).
- **Positioning:** Anderen doen *current value*. Wij doen *transformation potential*. Nobody else combines the full lifecycle.
- **Project type:** Desktop-first multi-tenant SaaS (web app). Mobile out of scope. Light mode only.
- **Usage pattern:** Builders use this 6–8h/day. Fatigue matters. Quiet matters. Clarity matters.

---

## The Two Modes

Elke design decision gaat door dit filter: *is dit Discovery of Build-management?*

### Mode 1 — Discovery (map-first)
*Phase: "Waar bouw ik?"*

- De kaart IS het product. Chrome gaat opzij.
- Nav = three floating glass pods, geen fixed sidebar.
- Search = floating pill top-left, geen full-width topbar.
- Filters = floating pill top-center, geen panel.
- Legend = bottom-right, geen header-real-estate.
- Perceel-kleur = amber→groen gradient op score, visueel leesbaar van verre.
- Interaction = klik perceel → Dynamic Split-Canvas (zie Layout).

### Mode 2 — Build-management (data-dense)
*Phase: "Hoe bouw ik het?"*

- De kaart recedeert. Bento-grids, dossiers, rapporten nemen het over.
- Dense cards in 3×3 grids (Potentie Intelligence Grid) of paginated lists (Risico, Dossiers).
- Full-screen modals voor single-source data (BRK Eigendom, Vergunningen).
- Rapport-export = print-optimized CSS, obsidian op wit, geen glass.
- Interaction = categoriewisseling via pill-tabs met `layoutId` transitie.

**The handoff pattern:** Map-view → klik perceel → Dynamic Split-Canvas (map shrinks 40%, parcel panel opens left 620px wide) → ParcelBentoOverview in panel → click intelligence card → full-screen modal (BRK / Vergunningen / Score / Woonvisie). User blijft spatially grounded, maar de data-density escaleert progressief.

---

## Aesthetic Direction

- **Direction:** Calm Intelligence.
- **Decoration level:** Intentional — niet minimal, niet expressive.
- **Mood:** Quiet, expensive, 8-hours-a-day-comfortable. Morning light. Glass surfaces floating op een getinte canvas. Warm amber markeert waar intelligence zit. Obsidian markeert waar commitment zit.
- **What it is NOT:** Niet corporate blue. Niet enterprise-grey. Niet playful. Niet brutalist. Niet editorial. Niet maximalist.

---

## Typography

**Single family: Plus Jakarta Sans** (Google Fonts, weights 200–800 + italics).
Geladen via `<link>` in `frontend/index.html:9` met preconnect.

- **Display / Hero:** 32px (`--text-3xl`), weight 700, line-height 1.2, letter-spacing -0.01em.
  - Rationale: Jakarta's display performance bij 700+ is sharp en sans-serif-modern zonder "tech-bro" te voelen.
  - Utility class: `.text-display`.
- **KPI (metrics, scores):** 24px (`--text-2xl`), weight 600, line-height 1.3.
  - Utility class: `.text-kpi`.
- **Body:** 14px (`--text-base`), weight 400, line-height 1.4.
  - Rationale: 14px is de comfort-sweet-spot voor dashboards. 16px voelt "marketing." 13px is leesbaar-grens voor 8h/day use.
- **Label (small caps / uppercase):** 11px (`--text-xs`), weight 500, uppercase, letter-spacing 0.05em.
  - Utility class: `.text-label`.
- **Secondary scales:** `--text-sm` 13px · `--text-lg` 16px · `--text-xl` 18px.
- **Mono:** JetBrains Mono (data, code, tabular context). Alleen waar monospace betekenisvol is.
- **Blacklist:** Inter, Roboto, Arial, system-ui als display/body. Ook Space Grotesk. Convergence = slop.

---

## Color

**Approach:** Restrained + semantic. Amber is de ENIGE decoratieve accent. Alle andere kleuren zijn functioneel of structureel.

### Palette (CSS vars in `frontend/src/styles/index.css`)

| Rol | Naam | Hex | Usage |
|---|---|---|---|
| Canvas | Morning Mist | `#F2F6F3` | `body` background, Layer 0 base. NIET wit. |
| Surface | Pure Glass | `rgba(255,255,255,0.6)` + backdrop-blur | Cards, panels, pods. Alle floating surfaces. |
| Command | Deep Obsidian | `#0E1111` | Primary CTAs, headers, commit-moments. |
| Body text | Ink | `#1A1C1E` | Paragraph text. NIET pure black. |
| **Intelligence** | **Warm Amber** | `#F9A826` | Scores, score-gauges, active-state pills, intelligence-moments. DE accent. |
| Amber hover | Amber Hover | `#E8971F` | Hover state voor amber CTAs. |
| Amber support | Amber Light `#FDE68A` / Mid `#FBBF24` / Dark `#D4860B` / Deep `#92400E` | | Alleen voor gradient-fills of depth; niet als zelfstandige accent. |
| Secondary surface | Sage Mint | `#D1E2D8` | Inactive bestemmings-tiles, subtiele pill-backgrounds. |
| Validation | Vitality Green | `#22C55E` | "ZEER KANSRIJK", positive scores, success states. |
| Green hover | Green Hover | `#16A34A` | Hover state. |
| Error | Signal Red | `#EF4444` | Errors, negative scores, risico-verdict. |

### Semantic

- `--color-success` = Vitality Green
- `--color-error` = Signal Red
- `--color-warning` = Warm Amber
- `--color-info` = `#3B82F6` (info-blue — sparingly, niet als accent)

### Neutrals

Tailwind default grays (`--color-neutral-50` t/m `--color-neutral-900`). Gebruik voor borders, disabled states, separator lines. `--color-neutral-200` is de meest-gebruikte border (`border-slate-100` equivalent).

### Dark mode

**Out of scope.** Aura is light-only by design. Builders werken in verlichte kantoren. Dark mode sloopt de glass-morphism en Morning-Mist canvas die de helft van de character zijn. `@media print` CSS handelt paper-export af.

---

## Decoration

- **Glassmorphism.** Pure Glass surfaces = `bg-white/60 backdrop-blur-[24px]`. Borders subtiel (`border-white/20` of `border-slate-100`). Shadow `--shadow-glass` (0 20px 50px rgba(0,0,0,0.10)).
- **Background mesh (only on map canvas):** Sage Mint blob top-left (40% opacity, blur 150px) + Amber blob bottom-right (12% opacity, blur 150px). Geeft leven onder de data.
- **GEEN decorative icons.** Icons komen uit `lucide-react`, size={22} strokeWidth={1.5}, alleen functioneel.
- **GEEN illustraties / mascots / stock hero images** (behalve bestemming-thumbnails in ParcelBentoOverview — die zijn data, niet decor).
- **GEEN gradient CTAs.** Obsidian-solid of amber-solid. Gradient = slop.
- **GEEN centered-everything.** Asymmetry waar het sense maakt (floating pods, search links).

---

## Spacing

**Base unit: 4px.** Density: comfortable (niet compact, niet spacious).

**Scale:** `2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)`.

Tailwind convention: `gap-1` (4) · `gap-2` (8) · `gap-4` (16) · `gap-6` (24) · `gap-8` (32).

**Canvas padding:** `p-4` (16px) rondom de main flex-container. Glass surfaces krijgen `p-4` (compact) of `p-6`–`p-8` (luxe, panels/modals).

---

## Layout

**Approach:** Hybrid. Grid-disciplined voor de app shell, creative voor parcel-detail en wijk-view.

### App shell (all routes)

- `body` op `bg-aura-canvas`.
- Mesh gradients absolute-positioned, pointer-events-none, onder alle content.
- Root = flex-row, `p-4 gap-4`, full-viewport.
- **Left:** SideRailNav (drie floating glass pods: logo circle + nav capsule + system capsule). NIET één sidebar strip.
- **Right:** Main content (`flex-1`), `rounded-[40px]`, varies per route.
- Desktop-only layout. Minimum width 1280px.

### Map route

- Main content = `<MapView />` full-bleed.
- Search pill top-left relative to content area (`bg-white/20 backdrop-blur-3xl`).
- Filter pill top-center, 3 sections + Framer Motion layoutId.
- Legend bottom-4 right-4 (zelfde hoogte als toggle bar left).
- MapLibre attribution hidden (CSS rule in `index.css:139-142`), tile providers gecredit in app footer.

### Parcel detail (Dynamic Split-Canvas)

- **Trigger:** klik perceel op kaart of adres-search → portal-rendered panel.
- **Shell:** Left-side, 620px wide, floating, `bg-white/60 backdrop-blur-[24px] rounded-[40px]`.
- **Behavior:** Map **shrinks alongside** panel (niet overlay). Spatial context blijft intact.
- **Animation:** `animate-fly-in-right` (300ms cubic-bezier).
- **Image grid:** 3 flex-col cards (gap-1.5), aspect-[5/6] image area + 28px CardLabelBar below.
  - Card 1: ParcelHero (aerial satellite)
  - Card 2: Bestemming stock photo (7 categories: wonen/commercieel/centrum/maatschappelijk/groen/industrie/gemengd). Stock images in `frontend/public/images/bestemmingen/`.
  - Card 3: ScoreGauge SVG circle (amber indicator, text-5xl font-black tracking-tighter).
- **CategoryTabs:** `bg-[#F2F6F3]` container, obsidian `#0E1111` active pill met `layoutId` animation.
- **Footer:** `px-8 pb-8 pt-4` — meer luxe padding dan body.

### Wijk view

- Bottom Bento Sheet, 30–40% height.
- `animate-slide-up` fly-up, 4-column bento layout, drag handle, `rounded-t-[48px]`.
- Map blijft zichtbaar boven.

### Data pages (ResultsShell)

Alle niet-kaart data-routes (projecten, opgeslagen, instellingen, rapport, perceel-cockpit) renderen hun inhoud in **`ResultsShell`** (`frontend/src/components/layout/ResultsShell.tsx`) — niet los op de canvas.

- Container: `w-full h-full overflow-y-auto bg-[#FAFCFA] rounded-[40px]`. **Solid `#FAFCFA`** (een half-step lichter dan canvas `#F2F6F3`) zodat de `rounded-[40px]` zich losmaakt van de canvas achter de sidebar. **NIET glass** (DS-04) — glass is voor floating surfaces, de data-shell is opaque.
- Default leescontainer: `mx-auto max-w-5xl px-6 py-8` — gecentreerde reading band. Content **vult** deze band; geen smallere links-uitgelijnde kolom (dat leest als "kapot gecentreerd").
- `fullWidth` prop omzeilt de max-w-5xl band voor full-bleed data-views (bv. `/resultaten`).
- Content-cards binnen de shell = **Pure Glass**: `bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px]`.

### Parcel cockpit (lifecycle workspace)

Routes onder `/opgeslagen/perceel/$parcelId/*` zijn de single-parcel cockpit. Hier **wisselt de nav**: niet de drie-pod `SideRailNav`, maar de fixed icon-only **`LifecycleSideRailNav`** (zie Component Patterns). Elke fase (Onderzoek/Contact/…) rendert in `ResultsShell` met de **`ParcelWorkspaceHeader`**-conventie bovenaan.

**Page-title-hiërarchie** (consistent toepassen):

| Context | Class |
|---|---|
| Eyebrow boven titel | `text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400` |
| Data/cockpit page-titel | `text-[28px] font-bold leading-tight tracking-tighter text-slate-900` |
| Top-level admin page-titel | `text-[32px] font-black tracking-tight text-[#0E1111]` |
| Modal-titel | `text-[22px] font-black tracking-tight text-[#0E1111]` |
| Subtitle / meta-regel | `text-[14px] text-slate-500` |

---

## Radius (hierarchical)

| Token | px | Usage |
|---|---|---|
| `--radius-sm` | 8 | Inputs, chips, badges, small buttons |
| `--radius-md` | 12 | Cards, tiles, inline containers |
| `--radius-lg` | 16 | Medium surfaces |
| `--radius-xl` | 24 | Bento pods, intelligence cards |
| `--radius-2xl` | 32 | Modals, parcel detail panel |
| `--radius-3xl` | 48 | Bottom sheet top edge |
| `rounded-full` | 9999 | Pill search, property popups, status chips |

Map container: `rounded-[40px]` (custom, tussen 2xl en 3xl).

---

## Shadows

- `--shadow-sm` — subtle elevation on small tiles
- `--shadow-md` — cards at rest
- `--shadow-lg` — hovering cards, dropdowns
- `--shadow-glass` — `0 20px 50px rgba(0,0,0,0.10)` — floating panels, modals, pods

Shadows zijn altijd soft (low alpha, generous blur). Geen harde drop-shadows.

---

## Motion

**Approach:** Intentional. Framer Motion + `layoutId` voor active-state transitions.

### Easing

- Standaard: `cubic-bezier(0.4, 0, 0.2, 1)` (Material-inspired, smooth).
- Spring (voor active pills): `stiffness: 380, damping: 30`.

### Durations

| Type | Duur | Usage |
|---|---|---|
| Fade | 200ms | Content cross-fade (panel swap) |
| Hover | 200–250ms | Pod hover transform, nav hover |
| Slide/Fly | 300ms | Bottom sheet, panel fly-in |
| Active pill | spring | SideRailNav active-state (layoutId) |

### Named animations (in `index.css`)

- `.animate-slide-up` — bottom sheet, 300ms cubic-bezier
- `.animate-fly-in-right` — side panel, 300ms cubic-bezier
- `.animate-fade-in` — content swap, 200ms ease-out
- `.aura-hover-pod` — scale(1.02) + amber glow on hover (for nav pods)
- `.aura-hover-nav` — scale(1.05) on nav items
- `.aura-hover-glow` — amber box-shadow on interactive cards
- `.aura-float` — `will-change: transform` hint for portaled panels

### Reduced motion (accessibility + low-end devices)

`@media (prefers-reduced-motion: reduce)` in `index.css:223-252` kills:
- All transition + animation durations → 0ms
- All `backdrop-blur` → solid white background
- All `:hover` transforms + shadows
- All `will-change` hints

**Dit is verplicht.** Glass-morphism zonder fallback = accessibility fail.

---

## Component Patterns (reference)

### SideRailNav
`frontend/src/components/layout/SideRailNav.tsx`

- Drie floating glass pods (logo + routes + system).
- Icons: lucide-react, `size={22} strokeWidth={1.5}`.
- Active state: amber circle (48px) met Framer Motion `layoutId="sidebar-active"`.

### LifecycleSideRailNav
`frontend/src/components/layout/LifecycleSideRailNav.tsx`

- **Vervangt** `SideRailNav` op de parcel-cockpit routes (`/opgeslagen/perceel/$parcelId/*`) — single-parcel lifecycle-context.
- `fixed left-0 top-0 bottom-0 w-[130px]`, flex-col `justify-between py-10`, `z-[100]`. NIET de drie-pod variant.
- **Icon-only** (lucide `size={22} strokeWidth={1.5}`), label verschijnt als hover-tooltip rechts. Geen permanente tekstlabels, geen nummers.
- Drie zones: logo-circle (h-16 w-16, → `/opgeslagen`) / fase-iconen (gap-4, h-12 w-12) / uitlog-icon.
- Fasen uit `LIFECYCLE_PHASES` (`frontend/src/lib/lifecycle/phases.ts`). Active: `bg-aura-obsidian` gevulde circle achter amber icon, `layoutId="lifecycle-sidebar-active"` (spring 380/30). Enabled: `text-slate-500`. Disabled: `text-slate-300` + `opacity-60`, geen circle.

### ParcelWorkspaceHeader
`frontend/src/components/cockpit/ParcelWorkspaceHeader.tsx`

- Canonieke header voor cockpit/fase-views. `mb-6`, flex-col → `lg:flex-row justify-between`.
- Eyebrow ("Portfolio workspace") → titel = perceel-**adres** (`text-[28px] font-bold tracking-tighter`), voorafgegaan door kleine `h-7 w-7 rounded-full bg-white/60` terug-knop (ChevronLeft).
- Subtitle-rij (`mt-2 flex flex-wrap gap-2`): `text-[14px] text-slate-500` meta (`parcel_id · gemeente · wijk`) + stage-badge pill + potentie/risico score-pills.
- Rechts: action-knoppen (checklist-circle / map-circle obsidian / "Bekijk rapport" amber pill).

### PDFViewerModal
`frontend/src/components/ui/PDFViewerModal.tsx`

- Herbruikbare document-viewer (portal). Open bij klik op een document (bv. checklist `rapport.pdf`).
- Backdrop: `fixed inset-0 z-[60] bg-black/50 backdrop-blur-md`.
- Content: gecentreerd `max-w-3xl rounded-[32px] bg-[#F8FAFA] shadow-2xl h-[calc(100vh-64px)]`.
- Header: eyebrow "Document viewer" + `text-[18px] font-bold` bestandsnaam; "Open in nieuw tabblad" + obsidian close (h-9 w-9 rounded-full).
- Body: authenticated fetch → `<iframe>` `rounded-[16px] border-[#EAEFEF]`, met loading/error states.

### ParcelBentoOverview
`frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx`

- 3×3 intelligence grid (Potentie) + paginated lists (Risico, Dossiers).
- Category tabs met obsidian active-pill + `layoutId`.
- Per-category hero (green/red/neutral) met verdict + icon.

### ScoreBreakdownModal
`frontend/src/components/map/panels/parcel/ScoreBreakdownModal.tsx`

- Full-screen modal. Data-dense. Factor-per-rij met percentage-of-category.
- Obsidian header + amber score visualization.

### PotentieLayer (Intelligence Grid)
`frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`

- 9 cards in 3×3. Paginated (page 2 = environmental factors).
- Verdict-driven hero: ZEER KANSRIJK (green) / MOGELIJKHEDEN (emerald) / BEPERKT (slate).
- Klik-card → specific modal (BRK, Woonvisie, Vergunningen, etc.).

---

## Anti-patterns (verboden)

- ❌ Purple/violet gradients als accent
- ❌ 3-column feature grid met icons in colored circles (generic SaaS)
- ❌ Gradient buttons als primary CTA
- ❌ Pure-white backgrounds (gebruik Morning Mist)
- ❌ Corporate blue als intelligence-kleur (use amber)
- ❌ Dark mode variants
- ❌ Inter / Roboto / Space Grotesk als display/body
- ❌ system-ui als primary font
- ❌ Hardcoded brand colors in JSX — altijd CSS vars / Tailwind tokens
- ❌ Emojis in productie-UI (tenzij expliciet gevraagd — user feedback rule)
- ❌ Stock photo hero sections
- ❌ Centered-everything layouts
- ❌ Em dashes in UI copy (`—`) — gebruik `·`, `:` of `,`

---

## Print / PDF Export

`@media print` rules in `index.css:266-345`:

- Background → white, text → `#111`
- Override CSS vars voor readability (amber `#b45309` ipv `#F9A826`, etc.)
- Hide nav, decorative blurs, interactive elements
- Section cards get visible borders (`#d1d5db`) + `break-inside: avoid`
- Page margins `1.5cm 1cm`
- Max image width 100%, no shadows, no text-shadows

**Usage:** Rapport-export (Pretext-native HTML → PDF print) respecteert deze regels automatisch.

---

## Z-index Scale

In `:root` (in `index.css:66-78`):

| Layer | Z-index | Usage |
|---|---|---|
| Map canvas | 0 | MapLibre GL base |
| Map controls | 10 | Tile layer toggles, legend |
| Search bar | 100 | Floating pill |
| Sidebar | 200 | Main route content |
| Side rail / Bottom nav | 250 | Floating nav pods |
| Property panel | 300 | Parcel detail (Split-Canvas) |
| Dropdown | 400 | Select, combobox |
| Modal | 1000 | Full-screen modals |
| Toast | 2000 | System notifications |

Steps van 100 voor flexibiliteit. Geen ad-hoc `z-50`, `z-[99]` — gebruik tokens.

---

## SAFE vs RISK

### Safe choices (category baseline)
- Single accent color (amber) — proptech-norm.
- Sans-serif single-family — 8h/day comfort.
- Desktop-first — target users werken op 27" monitors.
- Glass-morphism surfaces — moderne SaaS feel.
- Tailwind v4 CSS vars — industry-standard tooling.

### Risks (Propdex's own face)
1. **Morning Mist canvas, niet wit** — signaleert "er leeft wat onder de data" voor je een woord leest. Competitors (Matrixian, Calcasa) zijn allemaal wit.
2. **Floating pod nav** — drie losse glass capsules ipv één sidebar strip. Gives map visual weight. Chrome voelt lichter. Bet: users zijn hier voor de kaart, niet voor de chrome.
3. **Dynamic Split-Canvas parcel panel** — map shrinks alongside (niet overlay). Spatial context blijft. Killer dogfood-moment.
4. **Warm Amber als intelligence-kleur, niet blauw** — elke proptech tool default = corporate blue. Amber signaleert "human insight" over "detached algorithm." Risk: minder "enterprise." Payoff: memorable op eerste opening.
5. **Two-mode design language** — map-first (chrome-minimized) vs build-management (data-dense bento). Eén systeem, twee posturen. Complexer om consistent te houden, maar fits het product's lifecycle letterlijk van grondpositie tot bouwfase.

---

## Coherence Check

**Waarom werkt dit systeem als geheel?**

Elke keuze versterkt "cockpit van grondpositie tot eerste spade":
- Morning Mist canvas → reduceert eye-fatigue voor 6–8h sessions
- Glass surfaces → preserven spatial context (map is het echte product in Discovery mode)
- Warm Amber → markeert de momenten waar scoring/intelligence/insight optreden
- Deep Obsidian → markeert de momenten van commitment (save, export, generate)
- Plus Jakarta Sans → single-family reduceert cognitive load over 6h sessions
- Framer Motion `layoutId` → active-state springs geven continuïteit tussen views
- Two-mode system → eerbiedigt dat Discovery en Build-management fundamenteel andere posturen vragen

Een Nederlandse vastgoedontwikkelaar die dit 6 uur per dag gebruikt moet zich **focused** voelen, niet **bombarded**.

---

## References (files)

- **Tokens:** `frontend/src/styles/index.css`
- **Font loading:** `frontend/index.html:7-9`
- **App shell:** `frontend/src/components/layout/AppLayout.tsx`, `MapShell.tsx`
- **SideRailNav:** `frontend/src/components/layout/SideRailNav.tsx`
- **Parcel panel:** `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx`
- **Intelligence grid:** `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`
- **Score modal:** `frontend/src/components/map/panels/parcel/ScoreBreakdownModal.tsx`
- **Bestemming stock images:** `frontend/public/images/bestemmingen/` (Pexels, free license)

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-03-10 | v15.0 Aura overhaul kickoff | Replace Industrial Amber (v14) with Morning-Mist-canvas + glass-morphism. Shipped in phases 91–98. |
| 2026-03-11 | Dynamic Split-Canvas parcel panel | Reject overlay pattern (occludes map). Map shrinks alongside panel. Spatial context preserved. |
| 2026-03-11 | Plus Jakarta Sans, single family | Previous stack (Satoshi/Inter mix) caused visual discord. Single family = less cognitive load over 8h sessions. |
| 2026-03-11 | Drop dark mode | Out of scope. Light-only supports Morning-Mist character. Dark mode sloopt glass + mesh. |
| 2026-03-11 | Three floating pods, not sidebar strip | Map is the product in Discovery mode. Chrome must not dominate. |
| 2026-04-22 | DESIGN.md formalized | System is stable across M042–M047. Capture before M048 touches visual code. Two-mode narrative added as north star. |
| 2026-05-29 | Page & cockpit conventions documented | Reverse-engineered from code tijdens M052/S02 design-shotgun (mockups klopten niet zonder). Toegevoegd: ResultsShell (#FAFCFA reading-shell + max-w-5xl band), LifecycleSideRailNav (icon-only fase-rail), ParcelWorkspaceHeader (eyebrow + 28px tracking-tighter titel), page-title-hiërarchie, PDFViewerModal. |

---

*Living document. Append to Decisions Log when shipping changes. Override via explicit user approval only.*

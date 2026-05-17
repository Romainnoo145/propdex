# Phase 6: Opgeslagen-Cockpit + Lifecycle Sidebar (S06) — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** Express path — derived from M050 pre-planning artifacts (office-hours + plan-ceo-review + plan-eng-review + design-review V5)

<domain>
## Phase Boundary

S06 transformeert de **bestaande opgeslagen-tab** (huidige FavoriteParcelWorkspaceView) van een grid-layout naar een **stappenplan-cockpit** met full-width perceel-cards. Tegelijk verschuift de **linker sidebar** van toplevel-icons (Discovery / Settings / Workspace) naar **4-8 lifecycle-icons** die de developer-journey volgen (1. Onderzoek t/m 6. Exploitatie).

**Belangrijk wat S06 NIET doet:**
- Geen nieuwe modal of detail-page — click op perceel-card opent de **bestaande perceel-detail page**
- Geen rebuild van de scan-data, scoring-cards, of bestaande Intelligence Grid tabs (Potentie/Risico/Dossiers)
- Geen brief-feature implementation — die komt uit S04/S04.5/S05; S06 toont alleen de slot waar brief-actie LANDT binnen "1. Onderzoek"
- Geen BRK-data fetching — die komt uit S01/S02; S06 toont alleen de slot waar BRK-state LANDT
- Geen tier-gate UI — die komt uit S07; S06 mag de UI bouwen alsof alle features beschikbaar zijn

**Wat S06 WEL doet:**
- Opgeslagen-tab layout transformatie: grid → full-width cards met BAG-thumbnail
- Sidebar transformatie: toplevel-icons → lifecycle-icons met active-state per perceel-fase
- Wiring tussen card-click en bestaande perceel-detail-route
- "1. Onderzoek"-tab content-organisatie (binnen detail-page) — brief-feature + BRK-persistent als placeholders/slots
- Aura-conform styling (Morning Mist canvas, Pure Glass cards, Plus Jakarta Sans, Warm Amber accent)

</domain>

<decisions>
## Implementation Decisions

### Layout (LOCKED 2026-05-17 via design-review V5)
- **Opgeslagen-tab layout:** Bestaand layout behouden (geen rebuild) met FULL-WIDTH perceel-cards (één kolom, brede cards). Perceel-image thumbnail (BAG-foto, gerendered links) is NIEUW. Card-body: perceel-adres + key scoring-facts + status-pills voor lifecycle-fase.
- **Click-behavior:** Card-click navigeert naar bestaande perceel-detail page route (geen nieuwe overlay/modal/sidebar). Detail-page is single source of truth voor perceel-context.
- **Sidebar:** Linker sidebar transformeert van bestaande toplevel-icons (Discovery / Settings / Workspace) naar 4-8 lifecycle-icons. Exacte iconen + polish deferred naar implementatie-fase (ontdek tijdens bouwen).

### Lifecycle Sidebar Phases (concept, deferred polish)
Voorgestelde 6 fases (mag uitbreid tot 8 indien onderbouwd):
1. **Onderzoek** — Scan-data, scoring, factoren (bestaande detail-page content + BRK-persistent + brief-feature slots)
2. **Eerste contact** — Brief verzonden, response-tracking (uit S05 + future M053)
3. **Kwalificatie** — Eigenaar geïnteresseerd, follow-up-acties
4. **Bod / Onderhandeling** — Aankoop-fase
5. **Bouw / Vergunning** — Realisatie-fase
6. **Exploitatie** — Live perceel

In S06 is alleen **1. Onderzoek** functioneel — andere fases zijn empty-state placeholders met "Komt later" messaging. Status-tracking per perceel-fase komt uit M053+ CRM-fase.

### Visual Design (Aura-conform)
- **Canvas:** Morning Mist `#F2F6F3` (NIET wit)
- **Cards:** Pure Glass — `bg-white/60 backdrop-blur-[24px]` met border-white/20
- **Accent:** Warm Amber `#F9A826` voor active-state lifecycle-icon
- **Font:** Plus Jakarta Sans (single family)
- **Active-state:** Framer Motion layoutId (stiffness 380, damping 30) — match SideRailNav pattern uit v15.0
- **Icon-size:** 22px, strokeWidth 1.5 (match SideRailNav)
- **Border-radius:** Cards rounded-[40px] of vergelijkbaar (match Aura idiom — geen scherpe corners)
- **Background mesh:** Sage Mint blob (40% opacity, blur 150px) top-left, Amber blob (12%) bottom-right — match map-canvas pattern

### Animation + Motion
- **Sidebar transition:** Toplevel → lifecycle is een initial-render swap (geen morph-animation tijdens session). Active-state-shift binnen lifecycle wel Framer Motion layoutId.
- **Reduced-motion:** `prefers-reduced-motion: reduce` → disable Framer Motion + use opacity-only transitions
- **Performance:** `will-change: transform` op floating panels (sidebar pod's) om GPU-acceleration te triggeren

### Click-flow + State Management
- **TanStack Router:** Card-click naar bestaande perceel-detail route (`/parcels/{id}` of vergelijkbaar — verify in implementatie)
- **Favorites hook:** `useFavorites.ts` blijft single source — upgrade alleen om BAG-thumbnail-URL te exposen indien nog niet
- **Sidebar state:** lifecycle-icon active-state komt uit perceel-fase metadata. Initial v1: alle opgeslagen percelen default naar "1. Onderzoek". Future M053+ voegt status-transitions toe.

### M048-coordination (CRITICAL pre-start check)
- **Pin-mechanism (M048 Phase 7):** Mag NIET breken. Pinning is een eigenschap binnen "Onderzoek"-context — moet werkend blijven in nieuwe full-width card layout.
- **Groep-pages (M048 Phase 7):** 4-card-per-page grid + synth-page mechanisme moet werkend blijven binnen perceel-detail page (niet in opgeslagen-tab zelf).
- **Pre-merge regression check:** Test pin-mechanism + groep-pages voor en na S06 — geen visuele of functionele regressies.

### Claude's Discretion
Areas waar de implementer keuzes mag maken (binnen Aura design system):
- **Exacte iconen-keuze** voor lifecycle-fases (Lucide icon names) — pick what matches semantically
- **Card-spacing en breedte-verhoudingen** binnen full-width constraint
- **Empty-state copy** voor lifecycle-fases 2-6 (NL, friendly tone, "Komt later" of vergelijkbaar)
- **Loading-states** voor BAG-thumbnail-fetching (skeleton vs shimmer)
- **Hover-effects** op cards (lift, glow, etc — Aura-idiom)
- **Card-info-density** — welke key-facts naast perceel-adres tonen (suggestie: score, projecttype-badge, status-pill voor laatste activity)
- **Sidebar collapse-mode** — of de sidebar collapse-knop heeft of altijd open is

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `DESIGN.md` (repo root) — Aura design system: tokens, motion, two-mode principles
- `frontend/src/styles/index.css` — Tailwind v4 `@theme` block met canonical tokens
- `~/.gstack/projects/Romainnoo145-propdex/designs/m050-stappenplan-cockpit-20260517/` — design-review V5 wireframe (canoniek mental model voor S06)

### M050 Pre-Planning
- `.planning/milestones/M050-INDEX.md` — hub-doc, alle artifacts
- `.planning/milestones/M050-ENG-PLAN.md` — Lane E (Cockpit UI) row in worktree-parallelization table; depends-on Lane B (BRK) + Lane D (PostNL)
- `.planning/ROADMAP.md` Phase 6 section — requirements + success criteria

### Existing Frontend Patterns (REUSE — geen rebuild)
- `frontend/src/hooks/useFavorites.ts` — favorites infrastructure, hook upgrade indien BAG-thumbnail-URL nog niet exposed
- `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx` (of vergelijkbaar) — huidige opgeslagen-tab grid component, transformeert tot full-width card layout
- `frontend/src/components/SideRailNav.tsx` (of vergelijkbaar) — bestaande toplevel-sidebar pattern (3 floating glass pods); lifecycle-versie moet zelfde Framer Motion layoutId pattern gebruiken
- `frontend/src/routes/_authenticated/parcels/$parcelId.tsx` (of vergelijkbaar) — bestaande perceel-detail page route (target van card-click)

### M048 Components (REGRESSION-CRITICAL — niet breken)
- Pin-mechanism component(en) in `frontend/src/components/scoring/` of vergelijkbaar — moet blijven werken binnen detail-page context
- Groep-pages component (4-card grid + synth-page) — werkt binnen detail-page; S06 mag dit alleen tussen-laag plaatsen, niet hercoderen

### Score v3 Engine (READ-ONLY context)
- `app/services/score_v3.py` + `score_v3_factors.py` — geen wijzigingen in S06; alleen consumer van score-data via React Query

</canonical_refs>

<specifics>
## Specific Ideas + References

### Wireframe Reference (LOCKED)
Design-review output `~/.gstack/projects/Romainnoo145-propdex/designs/m050-stappenplan-cockpit-20260517/` documenteert V5 als canoniek mental model. Key takeaways:
- Full-width perceel-cards met BAG-foto thumbnail
- Sidebar lifecycle-icons (4-8 stappen)
- Click naar bestaande detail-page (geen modal-overhead)

### Aesthetic Reference (from MEMORY)
"Minimal Calm Intelligence — één focuspunt per scherm" — schrap iconen, frames, multi-state grids. Witruimte + typografie doen het werk. Cards mogen NIET overladen — max 4-5 key-facts naast perceel-adres + thumbnail.

### Behance Inspiration Pattern (uit M048 frontend memory)
Real estate bento layouts met map + floating glass panels. Voor S06 specifiek: bento-style perceel-cards binnen full-width column zijn de directe ontwerp-inspiratie.

### Existing Component Reuse
- BAG-thumbnail rendering: check of bestaande perceel-foto-fetching infra al exists (3D BAG + WMS pand-fotos zijn er voor scan-data; thumbnail-versie nog niet expliciet)
- Lifecycle-icon component: nieuwe componentClass of pattern; SideRailNav uit v15.0 is de stylistic reference

</specifics>

<deferred>
## Deferred Ideas

Items expliciet UIT scope van S06, deferred naar latere slices/milestones:

- **Status-transitions tussen lifecycle-fases** — M053+ CRM-fase; in S06 alle opgeslagen percelen blijven default "1. Onderzoek"
- **Functionaliteit voor fases 2-6 (Eerste contact / Kwalificatie / Bod / Bouw / Exploitatie)** — empty-state placeholders only in S06; functionaliteit komt uit M053+
- **Bulk-actions op cards** (selecteer meerdere, mass-update) — M052+
- **Card sorteer/filter opties** binnen opgeslagen-tab — uit scope, default ordering volstaat
- **Sidebar customization (per-user lifecycle-config)** — geen UX hiervoor in v1
- **Drag-and-drop reorder** van cards — out of scope
- **Brief-feature implementation** — S04/S04.5/S05; S06 toont alleen de slot
- **BRK-data fetching** — S01/S02; S06 toont alleen de slot
- **Tier-gate UI** — S07; S06 bouwt alsof alles beschikbaar is

</deferred>

---

*Phase: 06-opgeslagen-cockpit-lifecycle-sidebar*
*Context gathered: 2026-05-17 via express path uit M050 pre-planning artifacts*

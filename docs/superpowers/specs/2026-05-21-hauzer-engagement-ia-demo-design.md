# Design: Hauzer Engagement-laag — IA-herinrichting + Demo-build

**Datum:** 2026-05-21
**Status:** DRAFT (brainstorming-output, wacht op user-review vóór writing-plans)
**Strategie-bron:** `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260521-135656.md`
**Scope:** UI/UX informatie-architectuur voor de System-of-Engagement laag + wat de Hauzer demo concreet toont (echt vs mock, component-hergebruik, fase-verhuizing). Géén pitch/deal-inhoud (staat in strategie-doc).

---

## 1. Wie is Hauzer (grond voor de IA)

Hauzer & Partners (hauzer.com, Venlo) = **makelaardij + advies + verkoop**, geen bouwer. Diensten: woningmakelaardij (grootste nieuwbouw-woning makelaar van Venlo + taxatie), bedrijfsmakelaardij/BOG (WareHouser is hiervan de division), financieel advies/hypotheken (De Hypotheekplanners), verhuur (NVM). Onderdeel van een bredere groep; partners zoals Wijnen doen de bouw. **Hauzer doet de voorkant: vinden → benaderen → toetsen → verkopen/verwerven.** Daarom vallen de ontwikkelaars-fases (Vergunning/Bouw/Beheer/Exit) buiten Hauzer's product.

---

## 2. Informatie-architectuur (BESLIST 2026-05-21)

### Twee navigatie-niveaus

**Top-level (portfolio / cross-perceel)** — `SideRailNav`:
- **Dashboard** (landing, werkdag-cockpit) = Daily Acquisitie Inbox + Off-Market Pipeline Kanban
- **Kaart** (discovery / sourcing; host voor de built-to-suit kavelzoeker-filter)
- **Nieuwbouw-verkoop** (project-matcher: kandidaten ↔ bouwnummers) — Hauzer's kroonjuweel, eigen surface
- later: Verhuur · Verkenner · Beleid · Instellingen

**Per-perceel (klik kaart/Kanban-kaart → sidebar swap naar `LifecycleSideRailNav`)** — acquisitie-arc, 4 fases:
1. **Onderzoek** — score/scan/potentie (bestaat: `OnderzoekPhaseView`)
2. **Contact** — BRK-eigenaar + Verstuur Brief (M050/M051)
3. **Haalbaarheid** — bouwmethode-checklists (optoppen/nieuwbouw/transformatie/splitsen) + AERIUS/parkeernorm/WKB ← checklists verhuizen hierheen
4. **Bod** — bod/onderhandeling/transactie

De 8-fase-lijn (incl. Vergunning/Bouw/Verhuur/Beheer/Exit) blíjft in `phases.ts` voor ontwikkelaar-tenants + Tranche-2-visie, maar wordt voor Hauzer niet getoond. Demo hoeft 4 fases te vullen, niet 8.

### Opslaan op zoekmethode (nieuw data-veld)
Bij het opslaan van een perceel kiest de gebruiker de aanpak (optoppen/nieuwbouw/transformatie/splitsen). Dat ene veld stuurt twee dingen: (a) de scoring (via bestaande M047 projecttype-settings) en (b) welke Haalbaarheid-checklist verschijnt. → nieuw veld `projecttype` op `ParcelFavorite`.

---

## 3. Demo real-vs-mock (codebase-geverifieerd)

| Surface / scherm | Status | Backing (geverifieerd) |
|---|---|---|
| Dashboard → Pipeline Kanban | **ECHT** | `ParcelFavorite.pipeline_stage` (Literal Gesignaleerd/Onderzoek/Contact/Besluit/Afgerond, `favorites/schemas.py:9`) + CRUD `favorites/router.py`; 137k Venlo-percelen. Seed 5-7 favorites in stages. |
| Dashboard → Daily Inbox | **MOCK → upgradebaar** | `change_detector.py` + SRU-bekendmakingen bestaan; demo = 3-5 mock vergunning-items met Venlo-adres. Echt na: change_monitor ARQ-job aan voor GM0983 + Venlo policy-docs uploaden. |
| Per-perceel · Onderzoek | **ECHT** | `OnderzoekPhaseView` + scan/score data live. |
| Per-perceel · Contact | **ECHTE DATA + FAKE WRITE** | BRK-eigenaar live (`BrkOwnershipRecord`); `document_generator.py` eigenaar_brief-template; PostNL-dispatch nog niet gebouwd → preview + mock "verzonden". |
| Per-perceel · Haalbaarheid | **ECHT** | `checklists.py` 4 use-cases × ~20 items (AERIUS/parkeernorm/woonvisie); `ChecklistProgress` tracking; `checklist.$id.tsx` route. |
| Per-perceel · Bod | **MOCK (licht)** | Geen bod-tracking gebouwd; demo = simpele status/notitie (kan op `ParcelFavorite.notitie` leunen). |
| Nieuwbouw-verkoop matcher | **MOCK** | Geen Realworks-koppeling; vereist Hauzer's Nieuwbouw-API (post-deal). |
| Kaart · built-to-suit kavelzoeker | **ECHT** | `ParcelCache.area_m2` + `bestemmingen` (JSONB) + `has_pand`; filter >10.000m² + Logistiek/Industrie + leeg. |

**Netto demo: 4 schermen volledig echt, 1 echt-data-fake-write, 3 mock (1 upgradebaar).**

---

## 4. Component-hergebruik + touchpoints

| Wat | Bestaand | Wijziging voor demo |
|---|---|---|
| Sidebar-swap | `_authenticated.tsx:37-41` (`isOpgeslagenRoute` → `LifecycleSideRailNav`), `phases.ts` | `LifecycleSideRailNav` configureerbaar maken: toon Hauzer-set [Onderzoek, Contact, Haalbaarheid, Bod]. Voeg `Haalbaarheid` toe aan `LIFECYCLE_PHASES` (tussen Contact en Bod). |
| Fase-routing | `opgeslagen.perceel.$parcelId.$phase.tsx` | Nieuw `$phase = 'haalbaarheid'` → rendert nieuwe `HaalbaarheidPhaseView`. |
| Checklist-verhuizing | Standalone route `/checklist/$id` (`checklist.$id.tsx`); ingangen: `ParcelWorkspaceHeader.tsx:142` (via `favorite.report_id`) + `ReportHeader.tsx:228` (via `reportId`). `useChecklistProgress` + `useParcelProjectType`. NB: checklist-id = report-id (koppeling). | **BEVESTIGD verplaatsen → Haalbaarheid.** Ingang weg uit workspace-header/Onderzoek-context; nieuwe `HaalbaarheidPhaseView` host de checklist, gedreven door parcel-`projecttype` (i.p.v. report_id-koppeling). Rapport-ingang (`ReportHeader`) mag blijven als secundair pad. |
| Pipeline Kanban | `pipeline_stage` (backend), `portfolio.ts` PipelineStage, `favorites_service.update_pipeline` | Nieuwe Kanban-pagina in lege `dashboard.tsx`; kolommen = pipeline_stage. Drag = `update_pipeline`. |
| Opslaan-op-zoekmethode | `ParcelFavorite` (geen projecttype-veld), M047 projecttype-settings | Nieuw veld `projecttype` op `ParcelFavorite` + keuze bij opslaan; koppelt scoring + Haalbaarheid-checklist. |
| Daily Inbox | `change_detector.py`, `monitoring/changes_router.py` | Nieuwe Inbox-component in `dashboard.tsx`; demo mock-items, productie via change_monitor. |
| Nieuwbouw-matcher | — | Nieuwe surface, volledig mock voor demo. |

---

## 5. Open punten / reconciliatie

1. **Kanban-kolommen vs per-perceel fases**: Kanban = `pipeline_stage` (5: Gesignaleerd/Onderzoek/Contact/Besluit/Afgerond); per-perceel = acquisitie-arc (Onderzoek/Contact/Haalbaarheid/Bod). Niet 1-op-1. Demo: gebruik bestaande `pipeline_stage` voor Kanban (geen migratie), per-perceel fases apart. Later eventueel uitlijnen. Beslissen vóór build.
2. **Haalbaarheid toevoegen aan phases.ts** raakt de strategy-lock (8-fase-model 2026-05-18). Het is een toevoeging (9e fase) + per-use-case filtering, geen verwijdering — visie blijft intact.
3. **Verhuur** standaard buiten de demo (latere top-level surface).
4. **DESIGN.md** zegt nog "makelaars NIET onze markt" — achterhaald (Hauzer = full-service developer-adjacent, wél de markt). Corrigeren.
5. **Roadmap-reconciliatie nodig (project-breed, los van deze spec).** De cascade-document-roadmap (`CASCADE-DOCUMENT-MAPPING.md`, 2026-04-21) plande M050=Juridisch-klimaat, M051=Subsidies, M054-M057=meer batches. Realiteit: M050=BRK, M051=Brief. De cascade-batches zijn dus verschoven (nummers M050/M051 herbruikt), niet geschrapt — ze blijven nodig (de "magneet"). De engagement-laag (deze spec) is grotendeels nieuw werk. Drie parallelle tracks: scoring-depth (cascade) · engagement-laag (Hauzer) · Tranche-2-developer (M060-M110). Vergt een aparte roadmap-pass om cascade-batches te her-nummeren + engagement-milestones te plaatsen. NIET in soep, wel her-ordenen.

---

## 6. Buiten scope (demo)
- Echte PostNL-dispatch, echte Realworks-koppeling, nieuwbouw-matcher-logica, erfpacht-einddatum-radar (niet auto-sourcebaar, zie strategie-doc Q7), Tranche-2 fases (Vergunning→Exit), verhuur-flow.

---

## 7. Succescriterium
Een demo waarin een makelaar 's ochtends het Dashboard opent (Inbox + Kanban), een perceel doorklikt naar de 4-fase acquisitie-cockpit, in Contact een echte BRK-eigenaar ziet + een brief-preview genereert, in Haalbaarheid een echte bouwmethode-checklist doorloopt — grotendeels op echte Venlo-data. Overtuigt Hauzer dat dit hun dagelijkse acquisitie-hub wordt, niet zomaar een datakaart.

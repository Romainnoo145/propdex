# Phase 7: Factor pinning + groep-pages + 6 cards per page — Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** Design doc 20260424-200512 §"Frontend: Pin-mechanisme + group-per-page (S04)" + Office Hours 2026-04-24 + discuss-phase 2026-04-26 (4 gray-area-pairs resolved)

<domain>
## Phase Boundary

Schaal de ParcelDetailModal Potentie/Risico tabs van de huidige 9 statische cards naar 30+ factoren zonder UI-werk per cascade-milestone (M050+). Drie capabilities samen:

1. **FACTOR_REGISTRY metadata** — nieuw veld voor bron-groepering (`gemeente_beleid` / `markt` / `fysiek` / `klimaat`, evt. `juridisch`/`planologisch` voor Risico). Metadata-only; geen scoring-logica wijziging. Naamconflict met bestaande `FactorRegistryEntry.category: Literal["potentie", "risico"]` opgelost door **nieuw veld** te introduceren (Claude's discretion: voorkeur `bron`; final keuze in plan).
2. **Backend per-user pin-store** — `user_factor_pins` tabel met TenantMixin + Alembic migratie + 3 REST endpoints (list / toggle / delete). Per-user, niet per-org. Persistent across browser-refresh + devices.
3. **Frontend pin-UI + group pagination** — `CARDS_PER_PAGE` 9→6, page 1 = pinned synth-page (of top-6-by-bijdrage fallback bij 0 pins), page 2+ = 1 groep per page met ⭐ badge op pinned factoren in hun eigen groep-page.

**In scope:**
- Migratie + ORM model + Pydantic schemas + REST router + tests (backend)
- `useFactorPins(category)` TanStack Query hook met optimistic updates (frontend)
- Refactor `PotentieLayer.tsx` + `RisicoLayer.tsx` naar groep-paged + pinned-page rendering
- Star-icon + hover-state + max-6-toast + click-semantics
- Component tests (Storybook play-functions, mirror Phase 3+6 precedent)

**Out of scope (expliciet):**
- Drag-to-reorder pins (deferred — creation-order voldoet voor M048)
- Pin-share tussen users in dezelfde org (deferred)
- ScoreBreakdownModal redesign / rapport-PDF redesign (M049+)
- Cascade batch processing (M050+)
- Wijzigen van scoring-logica of FACTOR_REGISTRY runtime gedrag — alléén metadata-uitbreiding
- E2E tests Venlo (Phase 8)

</domain>

<decisions>
## Implementation Decisions

### 1. FACTOR_REGISTRY metadata (GROUP-01)
- **Naamconflict resolutie:** introduceer **nieuw veld** op `FactorRegistryEntry`, niet hernoemen van bestaande `category` (te veel call-sites + breekt Phase 1-6 tests). Default voorkeur naam = `bron` (kort, NL, semantisch); planner/Claude mag `groep` / `thema` / `subcategory` overwegen mits consistency met design-doc's `category`-terminologie in CONTEXT downstream.
- **Type:** `Literal["gemeente_beleid", "markt", "fysiek", "klimaat", "juridisch", "planologisch"]` — Risico krijgt `juridisch` en `planologisch` als nodig (te bepalen tijdens registry-mapping).
- **Mapping van alle 21 entries** (volgens design-doc voorbeeld):
  - Potentie (9): `bestemming` / `vergunning_succeskans` / `woonvisie_match` → `gemeente_beleid`; `funda_frictie` / `demografie` / `capaciteit` → `markt`; `vrije_grond` / `optoppotentie` / `perceelgrootte` / `leegstand` → `fysiek`
  - Risico (12+): planner mapt — bv. `funderingsrisico` / `bodemverontreiniging` / `asbest` → `fysiek`; `geluid` / `lucht` / `overstromingsrisico` → `klimaat`; `monument` → `juridisch`; etc.
- **Geen runtime gedrag verandering:** scoring werkt identiek; alléén UI leest het veld voor groepering.

### 2. Backend `user_factor_pins` model (PIN-02)
- SQLAlchemy 2.x `Mapped[]` + `mapped_column()` syntax (project standaard)
- Inherits `Base` + `TenantMixin` (uit `backend/app/models/base.py`) → `organization_id` mandatory + indexed
- Velden:
  ```python
  id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
  user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
  category: Mapped[str]  # "potentie" | "risico" — tab waarin pin leeft (NIET de bron-groep)
  factor_key: Mapped[str]  # match FACTOR_REGISTRY keys
  position: Mapped[int]  # 0..5, autoincrement op create binnen (user_id, category)
  created_at: Mapped[datetime]  # via TimestampMixin OR expliciet
  ```
- Constraints:
  - `UniqueConstraint("user_id", "category", "factor_key", name="uq_user_factor_pins_user_cat_key")` — voorkomt dubbele pin
  - `Index("ix_user_factor_pins_lookup", "user_id", "category")` — list endpoint hot-path
- **`category` field hier = potentie/risico tab** (NIET de bron-groep uit FACTOR_REGISTRY). Dit is wel verwarrend; document expliciet in model docstring.

### 3. Alembic migratie (PIN-02)
- Volg recente naming: bestand `y0_m048_s04_create_user_factor_pins.py` (volgende letter na `x0`, milestone M048, slice S04).
- `down_revision` = laatste M047 migratie (`28d2d029856d`); planner valideert via `alembic heads`.
- Patroon mirror van `x0_m047_s04_create_factor_extraction_cache.py` (zelfde repo).
- **Geen seed-data:** tabel start leeg; pins worden lazy gecreëerd door user-actie.

### 4. REST endpoints (PIN-03)
- Locatie: nieuw module `backend/app/users/factor_pins/` met `router.py` + `schemas.py`, OF extend `backend/app/users/router.py` (planner kiest — voorkeur eerste voor scope-isolatie).
- Mount onder `/api/users/me/factor-pins` (consistent met "users.me" REST-conventies; lees-vriendelijker dan `/api/user/factor-pins`).
- Endpoints:
  - `GET /api/users/me/factor-pins?category={potentie|risico}` → `list[FactorPinResponse]` (200) — filtert by current_user.id + organization_id
  - `POST /api/users/me/factor-pins` → body `{category, factor_key}` → `FactorPinResponse` (201) of `409 Conflict` als al gepind, of `400 Bad Request` met `code=MAX_PINS_REACHED` als 6e+ pin
  - `DELETE /api/users/me/factor-pins/{pin_id}` → `204 No Content`
- Auth: `Depends(get_current_user)` (uit `backend/app/auth/dependencies.py`)
- **Multi-tenant:** alle queries filter expliciet op `organization_id == current_user.organization_id` (geen impliciete middleware-magic — duidelijke filter in router).
- **Optimistic update contract:** server returnt na POST de volledige nieuwe pin (incl. id + position). Client cancelt query, replacet cached list, then refetcht (TanStack Query default).

### 5. Frontend hook `useFactorPins(category)` (UI-01, PIN-01)
- Locatie: `frontend/src/hooks/useFactorPins.ts` (mirror `useScoreWeights.ts` shape)
- Returns:
  ```ts
  {
    pins: FactorKey[],          // sorted by position asc
    isLoading: boolean,
    toggle: (key: FactorKey) => void,  // optimistic
    isPinned: (key: FactorKey) => boolean,
  }
  ```
- TanStack Query keys: `["factor-pins", category]`
- Optimistic mutation: `onMutate` cancelt query, snapshot pins, voeg key toe / verwijder key, return rollback-context. `onError` rollback. `onSettled` invalidate.
- Max-6 guard: client checkt `pins.length >= 6` vóór POST en toont `toast.warning("⭐ Max 6 bereikt")` (sonner) — server is zelfde 400-response als backup-net.

### 6. Page-structuur (GROUP-02)
**`CARDS_PER_PAGE = 6`** (van `9`) in `PotentieLayer.tsx` + `RisicoLayer.tsx`. Grid = `grid-cols-3 auto-rows-fr` met 2 rijen → 6 cards.

**Page-rendering logica:**
- **Page 0 (synth pinned-page):**
  - Bij `pins.length === 0`: render top-6 factoren by absolute `|bijdrage|` over **alle groepen heen** (één gesorteerde flat list). Title `TOP FACTOREN`.
  - Bij `pins.length >= 1`: render pinned factoren in position-volgorde. Vul resterende slots (tot 6) met **ghost-cells** (placeholder met "Pin een factor" affordance, dashed border, klikbaar → opent group-pages?). Title `GEPIND`.
- **Page 1..N (groep-pages):**
  - Eén page per unieke `bron` (= het nieuwe FACTOR_REGISTRY veld). Volgorde: `gemeente_beleid` → `markt` → `fysiek` → `klimaat` (Potentie); idem + `juridisch` / `planologisch` voor Risico.
  - Title = mensvriendelijke groep-naam (bv. `GEMEENTE BELEID` / `MARKT` / `FYSIEK` / `KLIMAAT`).
  - Mapping `bron-key → display-label` in een aparte constants-file `frontend/src/lib/factor-groups.ts` (i18n-klaar; planner kiest exact module).

**Page header:** boven het grid, links uitgelijnd, `text-[10px] font-black tracking-[0.15em] uppercase text-slate-400` (consistent met huidige `FACTOR_LABELS` styling). **Pagination chevrons + "1/N" blijven onderin gecentreerd** (huidige conventie in `PotentieLayer.tsx:453-475`, NIET wijzigen).

### 7. ⭐ badge consistency (UI-01, PIN-01)
- Op page 0 (pinned-page): pinned factor toont `Star filled` (amber-500) altijd zichtbaar in card-corner rechtsboven. Click op `Star` = unpin met optimistic update + DELETE.
- Op groep-page: zelfde pinned factor (bv. `funda_frictie` op MARKT-page) toont **dezelfde** `Star filled` icoon — visuele consistency. Unpin werkt vanaf beide locaties; cache-update synchroniseert via TanStack Query.
- Op groep-page voor **niet**-pinned factor: hover toont `Star outline` (slate-300) met fade-in 150ms. Klik = pin (mits < 6).

**Click-targets binnen card:**
- Card-body click → primary action van die factor (bv. `woonvisie_match` opent `WoonvisiePopup`, `eigendom` opent `EigendomModal`, andere factoren expanded info).
- `Star` icoon click → toggle pin (preventDefault op card-body click via `e.stopPropagation()`).

### 8. Missing pinned factor handling (PIN-01 gedrag)
- Op page 0: pinned factor met `factor.missing === true` rendert **wel** als card maar met:
  - `border border-dashed border-slate-200` (i.p.v. `border-slate-100` solid)
  - `text-slate-300` voor value (i.p.v. `text-slate-900` zwart)
  - sub = "Geen data" of huidige missing-message
  - `Star filled` (amber-500) blijft zichtbaar — user-pin-intent eerbiedigd
- Op eigen groep-page: zelfde dashed-border-styling, zelfde `Star filled`. Consistent.
- **Geen skip:** missing pinned factoren tellen mee in de 6 pinned slots; user moet 'm explicit unpinnen om plaats te maken.

### 9. Toast + max-6 guard (PIN-01, UI-01)
- Library: `sonner` (al in gebruik via `frontend/src/main.tsx` + `App.tsx`)
- Toast call: `toast("⭐ Max 6 bereikt")` (default variant — niet `error` of `warning`, blijft kalm; minimal aesthetic)
- Duration: sonner default (4s)
- Trigger: client-side guard in `useFactorPins.toggle()` voordat mutation fires. Server 400-response is silent backup (geen tweede toast).

### 10. Reorderability — geen drag (PIN-02 model `position`)
- `position` veld in DB = autoincrement op create. Eerste pin = 0, tweede = 1, etc.
- Bij DELETE van pin in midden (bv. pin op position 2 van 5) → resterende pins **niet** automatisch herrangschikt; gat in position blijft. Frontend sort by position asc — gaat goed (gaten worden gewoon dichterbij elkaar gerendered).
- Bij re-pin van eerder ge-unpinde factor: server kent nieuwe `position = max(existing) + 1`.
- **Geen PATCH endpoint** voor reorder. **Geen @dnd-kit dependency.**
- Future: drag-reorder kan toegevoegd worden zonder schema-change (`position` veld bestaat al).

### 11. Tests (TEST-07)
- **Backend (pytest):**
  - Unit: pin model creates correctly with TenantMixin; UniqueConstraint blocks duplicate; max-6 enforced in service-layer
  - Integration: GET/POST/DELETE endpoints — auth required (401), multi-tenant isolation (org A user kan niet pin of org B user lezen), max-6 returns 400 with `code=MAX_PINS_REACHED`
  - Pre-existing 275 tests groen (geen regression)
- **Frontend (Storybook play-functions, geen RTL — verified test stack):**
  - `PotentieLayer.stories.tsx` — extend met:
    - `PinnedPageEmpty` story: 0 pins → toont "TOP FACTOREN" + top-6 by bijdrage
    - `PinnedPagePartial` story: 3 pins → toont 3 cards + 3 ghost-slots
    - `PinnedPageFull` story: 6 pins → toont 6 cards, géén ghost-slots
    - `PinFlow` play-function: hover groep-card → Star verschijnt → click → optimistic update → page 0 toont nieuwe pin
    - `Max6Guard` play-function: 6 pins + 7e poging → toast verschijnt
    - `MissingPinDashedBorder` play-function: pinned factor met `missing=true` → dashed border render
  - Mock TanStack Query met `QueryClientProvider` decorator; mock fetch via `msw` of inline fetch-mock (planner kiest)
- TEST-07 covers ALL 11 success criteria; TEST-08 (E2E Venlo smoke) blijft Phase 8.

### Claude's Discretion
- Exacte naam nieuw FACTOR_REGISTRY veld (`bron` / `groep` / `thema` / `subcategory`) — voorkeur `bron`; planner kiest mits het Niet conflictueert met andere conventies in score_v3.py
- Exacte module-locatie voor pin-router (`backend/app/users/factor_pins/` vs extend `backend/app/users/router.py`) — voorkeur eerste
- Exacte component-decompositie (`PinnedPage.tsx` / `GroupPage.tsx` / `FactorCard.tsx` extracten) — design doc suggereert; planner mag inline laten als simpler
- Exacte msw / fetch-mock keuze in Storybook — wat al in `frontend/src/stories/` precedent heeft
- Animation specs voor Star fade-in (Framer Motion vs Tailwind transitions) — kies wat consistent is met huidige `framer-motion` gebruik in PotentieLayer
- Logging-regels bij max-6 / duplicate / 401 — log levels en message-format
- Exact JSON shape van `FactorPinResponse` — `{id, category, factor_key, position, created_at}` minimum

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design docs (source of truth)
- `/home/klarifai/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260424-200512.md` §"Frontend: Pin-mechanisme + group-per-page (S04)" + §"Backend: `user_factor_pins` tabel (nieuw in S04)" + §"Backend: FACTOR_REGISTRY category veld (S03)" + §"Open Questions" 1-3 — LOCKED beslissingen + alle drie open Q's nu geresolved in deze CONTEXT
- `/home/klarifai/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260422-163755.md` §"Approach A — Pinning Backend" — eerdere iteratie van pin-design

### Roadmap + requirements
- `.planning/ROADMAP.md` §"Phase 7" — alle 11 success-criteria LOCKED
- `.planning/REQUIREMENTS.md` — PIN-01, PIN-02, PIN-03, GROUP-01, GROUP-02, UI-01, TEST-07

### Prior phase context (carry-forward)
- `.planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-CONTEXT.md` — `FactorResult.waarde` data-shape voor woonvisie_match popup-trigger
- `.planning/phases/03-woonvisie-popup/03-CONTEXT.md` — popup-pattern + Storybook test-stack precedent

### Backend code (te wijzigen of te reflecteren)
- `backend/app/services/score_v3.py:62-145` — `FactorRegistryEntry` dataclass + `FACTOR_REGISTRY` dict (21 entries) — extend met nieuw veld
- `backend/app/models/base.py` — `Base`, `TenantMixin`, `TimestampMixin` — gebruiken voor `UserFactorPin` model
- `backend/app/auth/dependencies.py:19` — `get_current_user` dependency
- `backend/app/users/router.py` — bestaande user-routes, mogelijke mount-point
- `backend/alembic/versions/x0_m047_s04_create_factor_extraction_cache.py` — recente migratie patroon (revision-format, naming, server_default conventie)

### Frontend code (te wijzigen)
- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` — `CARDS_PER_PAGE` constant (line 304), `POTENTIE_KEYS` array (line 328), pagination footer (line 452-475), card-rendering loop (line 400-447) — refactor naar group-paged structure
- `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx` — mirror target, zelfde refactor
- `frontend/src/hooks/useScoreWeights.ts` — pattern voor TanStack Query hook (mirror voor `useFactorPins`)
- `frontend/src/lib/queryClient.ts` — `QueryClient` config + sonner toast import pattern
- `frontend/src/components/map/panels/parcel/EigendomModal.tsx:20` — sonner toast usage example
- `frontend/src/main.tsx:5` + `App.tsx:4` — `<Toaster />` mount

### Storybook + tests
- `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` — play-function pattern + mock-data structure
- `frontend/src/components/map/panels/parcel/ScoreBreakdownModal.stories.tsx` (uit Phase 2) — modal stories pattern
- `backend/tests/unit/` + `backend/tests/integration/` — bestaande test-structuur (275 tests precedent)

### Design system + memory
- `DESIGN.md` (repo root) — Aura tokens (Morning Mist `#F2F6F3`, Warm Amber `#F9A826`, Plus Jakarta Sans, glass surfaces)
- `frontend/src/styles/index.css` — Tailwind v4 `@theme` block (CSS variables, géén hardcoded hex)
- `~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/feedback_minimal_aesthetic.md` — "één focuspunt per scherm" — informeert hover-only voor unpinned + minimal toast

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`TenantMixin`** (`backend/app/models/base.py:16`) — voegt `organization_id` toe aan UserFactorPin model; multi-tenant isolation
- **`get_current_user`** (`backend/app/auth/dependencies.py:19`) — auth dependency voor alle pin-endpoints
- **`FactorRegistryEntry`** (`backend/app/services/score_v3.py:62`) — dataclass; nieuw veld toevoegen via `field()` met default
- **`sonner` toast** (al imported in `lib/queryClient.ts`, `EigendomModal.tsx`, `BronnenLayer.tsx`) — direct gebruiken voor max-6 toast
- **Pagination footer markup** (`PotentieLayer.tsx:452-475`) — herbruik 1:1; alleen `totalPages` herberekening verandert
- **`AnimatePresence` + `motion.div` pagination** (`PotentieLayer.tsx:391-449`) — zelfde animation kan blijven, alleen content shift naar group-paged rendering
- **`FACTOR_LABELS` map** (`PotentieLayer.tsx:107-118`) — extend met nieuwe Risico-keys; deze map kan migreren naar `lib/factor-groups.ts`

### Established Patterns
- **SQLAlchemy 2.x:** `Mapped[T]` + `mapped_column()` syntax (zie `models/base.py`, `models/refresh_token.py`)
- **Alembic naming:** `{letter}{n}_m{milestone}_s{slice}_{description}.py`. Volgende: `y0_m048_s04_create_user_factor_pins.py`. `down_revision` = `28d2d029856d` (laatste M047 head)
- **Datetimes:** `datetime.utcnow()` (naive UTC) — NIET `datetime.now(timezone.utc)` (zie `~/.claude/projects/.../memory/MEMORY.md` Key Patterns)
- **Transactions:** direct `db.add()` / `db.flush()` / `db.commit()` — NIET `async with db.begin()`
- **Multi-tenant queries:** explicit `WHERE organization_id = :org_id` filter in elke query — geen impliciete middleware
- **Storybook test-stack:** `@storybook/addon-vitest` (Playwright Chromium) play-functions, NIET React Testing Library (verified Phase 3)
- **Portal-rendered modals:** `within(document.body)` in play-functions (verified Phase 2)
- **TanStack Query:** ~13min proactive token-refresh + 401 interceptor al ingericht (zie auth-fix Phase 99 / Intelligence Grid Tabs notes)

### Integration Points
- **`PotentieLayer.tsx` props:** `{parcel, gemeenteNaam}` blijven; `useFactorPins('potentie')` hook intern aangeroepen
- **`RisicoLayer.tsx` props:** mirror; `useFactorPins('risico')`
- **Backend router mount:** `app.include_router(factor_pins_router, prefix="/api/users/me", tags=["user-factor-pins"])` in `backend/app/main.py` (planner valideert exact path)
- **Frontend route-tree:** geen route-changes; pin-state lokaal in elke layer-component via hook
- **Cascade-document mapping (M050+):** `lib/factor-groups.ts` mapping is forward-compatible — nieuwe factoren in M050+ erven `bron` veld + verschijnen automatisch in juiste groep-page zonder UI-werk

</code_context>

<specifics>
## Specific Ideas

- **Hover-state afbeelding:** unpinned card → bij hover verschijnt `Star outline` rechtsboven met `transition-opacity 150ms`. Zachte fade-in, géén pop-in. Past bij minimal aesthetic.
- **Star icoon kleur:** outline = `text-slate-300` (zelfde als huidige sub-text in cards); filled = `text-amber-500` (Aura's Warm Amber accent). NIET `text-yellow-400` of andere oranje varianten — moet matchen `--amber-500` token.
- **Ghost-slots design:** dashed border `border-dashed border-slate-200`, lichtere bg `bg-slate-50/50`, centered placeholder text "Pin een factor" met kleine `Star outline` icoon. Click → focus naar groep-page (planner kiest welke; voorkeur `gemeente_beleid` als default).
- **Title formatting:** `text-[10px] font-black tracking-[0.15em] uppercase text-slate-500` — zelfde als bestaande `FACTOR_LABELS` (PotentieLayer.tsx:432) maar iets darker (`text-slate-500` vs `text-slate-400`) zodat title prominenter is dan card-labels.
- **Optimistic update timing:** target < 100ms perceived latency. Sonner toast verschijnt instant bij max-6; pin-add feels instant via cached pin in queryClient state.
- **Pinned-page positie in pagination:** **always page 0** (eerste). Page 1..N = groep-pages. User opent ParcelDetailModal → ziet meteen pinned (of TOP FACTOREN bij 0 pins) — triage-modus.
- **Keyboard nav:** chevrons hebben al `disabled` states; voeg `aria-label="Vorige pagina"` / `"Volgende pagina"` toe (al aanwezig). Geen extra keybindings in deze phase.

</specifics>

<deferred>
## Deferred Ideas

- **Drag-to-reorder pins** — `position` veld is forward-compatible; @dnd-kit kan toegevoegd worden in M049+ zonder schema-change. User feedback verzamelen tot dan.
- **Pin-share tussen org-users** — eigen feature (`organization_factor_pins` tabel? per-team scopes?), out of scope voor user-isolation principle van M048.
- **Toast met "vervang oudste pin" undo-action** — power-user feature; verzamel UX-feedback eerst.
- **Bulk-pin / preset-pins** ("pin alle MARKT factoren in 1 klik") — overengineered voor M048; user-pin per kaart-click is voldoende.
- **i18n van groep-namen** — `lib/factor-groups.ts` is i18n-klaar maar feitelijke vertaling (NL/EN/etc.) komt pas met multi-language milestone.
- **Mobile layout** — desktop-only design beslissing (zie M048 REQUIREMENTS Out of Scope).
- **Drag-and-drop pins van groep-page naar pinned-page** — ipv klikbare ster — overkill, zelfde resultaat met click.
- **Smart-pin suggestions** ("dit perceel scoort hoog op X — pin aanbevolen?") — ML/heuristic feature, M058+.
- **PATCH `/api/users/me/factor-pins/{id}` voor position update** — niet nodig zolang creation-order voldoet.

</deferred>

---

*Phase: 07-factor-pinning-groep-pages-6-cards-per-page*
*Context gathered: 2026-04-26 via discuss-phase (4 gray-area-pairs resolved + 3 design-doc Open Q's closed)*

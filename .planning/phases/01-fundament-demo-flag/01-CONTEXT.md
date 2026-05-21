# Phase 1: Fundament + Demo-flag (M052/S01) - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Source:** /plan-eng-review M052/S01 (architectuur lock-in, 2026-05-21) — vervangt /gsd:discuss-phase voor deze slice

<domain>
## Phase Boundary

S01 levert de fundament-laag waar S02-S06 op bouwen:
1. **projecttype bij opslaan** (FUND-01/FUND-02) — gebruiker kiest een zoekmethode bij het opslaan van een perceel; dat stuurt scoring + (later, S02) welke Haalbaarheid-checklist verschijnt.
2. **HAUZER_DEMO isolatie-infra** (DEMO-01) — een per-org gate zodat mock-surfaces (S03 Inbox, S04 fake-send, S05 matcher, S02 Bod) alleen bij de Hauzer demo-org zichtbaar zijn.
3. **DESIGN.md makelaars-correctie** (DEMO-03) — docs.

**Blocks:** S02 (projecttype → Haalbaarheid-checklist), S03/S04/S05 (HAUZER_DEMO-flag).
**NIET in S01:** de Haalbaarheid-fase zelf, checklists, Kanban, Inbox, Contact-teaser, kavelzoeker (= S02-S05).
</domain>

<decisions>
## Implementation Decisions (LOCKED — eng-review 2026-05-21)

### D1 — projecttype hergebruikt bestaande org-scoped ParcelProjectType (FUND-01)
- **GEEN nieuwe kolom/migratie op `ParcelFavorite`.** ParcelFavorite is user-scoped (geen `organization_id`, org via User). Een tweede projecttype-bron op user-scope zou de multi-tenant-invariant breken en een tweede source of truth maken.
- De "opslaan-op-zoekmethode" picker schrijft naar het **bestaande** `PUT /api/parcels/{parcel_id}/project-type` (org-scoped `ParcelProjectType`, uniek op `(organization_id, parcel_id)`).
- Single source of truth voor de enum blijft `backend/app/api/endpoints/parcel_project_type_schemas.py` (6 waarden). Frontend-mirror: `frontend/src/lib/types/projectType.ts`.
- **Enum-mapping** zoekmethode → canonieke enum: `optoppen→optoppen`, `splitsen→splitsen`, `nieuwbouw→nieuwbouw_wonen`, `transformatie→transformatie_wonen`. Geen keuze = `onbepaald` (default; scoring = default weights, geen shift). `commercieel_naar_wonen` mag, maar zit niet in de 4 Hauzer-zoekmethoden.
- Twee users in dezelfde org die verschillend kiezen = last-write-wins (org-scoped; `set_by_user_id` houdt bij wie). Acceptabel: het is één gedeelde deal van het kantoor. Per-favorite override = DEFERRED.

### D2 — projecttype voedt M047 scoring + rescore-trigger (FUND-02)
- Scoring consumeert projecttype al via de M047 conditional-weight-shift (NIET via `use_case_scoring.py`; dat is een aparte "vergelijk 4 strategieën"-feature).
- **Open werk:** verifieer of `PUT /project-type` al een rescore triggert zodat de headline-score de gekozen aanpak reflecteert. Zo niet → wire de bestaande rescore-cascade in op de set. Zonder rescore faalt FUND-02 STIL (score verandert niet). Dit MOET een test krijgen.

### D3 — HAUZER_DEMO = smalle per-org boolean (DEMO-01)
- `hauzer_demo` boolean kolom op `Organization` (default `false`, NOT NULL).
- Uitgelezen via `/api/auth/me` (org-context toevoegen aan de me-response; frontend heeft nu geen org-payload).
- Frontend `useHauzerDemo()` hook gate't mock-surfaces.
- **Demo-login = `demo@klarifai.nl`** in de demo-org (S06 seedt die org + zet de flag). **NIET `info@klarifai.nl`** (echte admin-account — anders krijgt de eigenaar overal mock-surfaces in zijn werkview).
- Multi-tenant: users in andere orgs krijgen `hauzer_demo:false`, nooit `true`.
- **GEEN env kill-switch** (YAGNI pre-prod). Volledige tier-enum (demo/paid/superadmin) = M050.5, later.

### D4 — DESIGN.md makelaars-correctie (DEMO-03)
- `DESIGN.md:13` zegt nu "Brainbay/NVM (makelaars — NIET onze markt)". Corrigeren: makelaars zijn WÉL onze markt (Hauzer = full-service developer-adjacent: makelaardij + advies + verkoop).

### Claude's Discretion
- Exacte plek/vorm van de zoekmethode-picker in de opslaan-flow (modal na opslaan via `HeartButton` success, of inline). Bestaande `ProjectTypePickerModal` mag hergebruikt worden.
- Exacte vorm van de org-context-uitbreiding op `/api/auth/me` (veld op bestaande me-response vs genest org-object).
- `useHauzerDemo()` hook-implementatie (context-provider vs query).
- Of `FavoriteResponse` het projecttype gedenormaliseerd meekrijgt voor lijst/Kanban-weergave (lees blijft ParcelProjectType; cache optioneel — afweging in plan).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### projecttype (bestaand — hergebruiken, niet dupliceren)
- `backend/app/models/parcel_project_type.py` — org-scoped model, uniek op (organization_id, parcel_id)
- `backend/app/api/endpoints/parcel_project_type_schemas.py` — **single source of truth** 6-waarde enum + DEFAULT_PROJECT_TYPE="onbepaald" + PUT/GET schemas
- `backend/app/api/endpoints/parcel_project_type_router.py` — GET/PUT /api/parcels/{id}/project-type
- `frontend/src/hooks/useParcelProjectType.ts` — useParcelProjectType + useUpdateParcelProjectType (optimistic)
- `frontend/src/lib/types/projectType.ts` — frontend enum-mirror + PROJECT_TYPE_LABELS
- `frontend/src/components/.../ProjectTypePickerModal.tsx` — bestaande picker-UI (hergebruiken)

### opslaan-flow (wiring-punt voor FUND-01)
- `backend/app/favorites/router.py` — POST /api/parcels/favorites (save endpoint)
- `backend/app/favorites/schemas.py` — FavoriteCreate / FavoriteResponse
- `backend/app/models/parcel_favorite.py` — user-scoped; **GEEN projecttype-kolom toevoegen**
- `frontend/src/hooks/useFavorites.ts` — useToggleFavorite mutation
- `frontend/src/components/map/panels/parcel/HeartButton.tsx` — save entry-point

### scoring (FUND-02)
- M047 conditional-weight-shift pad in score_v3 (researcher: lokaliseer waar project_type de score_v3-gewichten shift + waar de rescore-cascade leeft, bv. ARQ rescore job uit M047/M050)
- `backend/app/services/use_case_scoring.py` — **DEFERRED seam, NIET fixen**: USE_CASE_PRESETS keys (4: optoppen/splitsen/transformatie/nieuwbouw) matchen de 6-waarde enum niet; aparte "vergelijk 4 strategieën"-feature, leest de enum niet

### HAUZER_DEMO (DEMO-01)
- `backend/app/models/organization.py` — voeg `hauzer_demo` boolean toe (volg `expose_score_internals` boolean-patroon)
- `backend/app/core/config.py` — env-flag patroon (M050_BRK_PERSIST_ENABLED) als referentie; HAUZER gebruikt GEEN env-flag
- auth `/me` endpoint (researcher: lokaliseer; waarschijnlijk `backend/app/auth/router.py` of `app/api/.../auth`) — org-context toevoegen
- `frontend/src/lib/auth/types.ts` — User type; org-flag exposen

### docs
- `DESIGN.md` (regel 13) — makelaars-regel
- `docs/superpowers/specs/2026-05-21-hauzer-engagement-ia-demo-design.md` — IA-spec (codebase-geverifieerd)

### migratie
- `backend/alembic/versions/` — date-based prefix sinds M050 (`YYYYMMDD_m052_s01_<desc>.py`); latest head 20260519_m050_s02. Eén kleine migratie: `organizations.hauzer_demo`. GEEN parcel_favorites-migratie.
</canonical_refs>

<specifics>
## Specific Ideas

- Picker-keuzes (UI-labels NL): Optoppen · Nieuwbouw · Transformatie · Splitsen · (geen keuze → Onbepaald). Map naar canonieke enum per D1.
- `/api/auth/me` moet `hauzer_demo` (org-level) teruggeven zodat de frontend gate't zonder extra round-trip.
- Multi-tenant regression: een non-demo org mag NOOIT `hauzer_demo:true` of mock-surfaces zien (test).
</specifics>

<deferred>
## Deferred Ideas

- Per-favorite projecttype-override (één perceel onder twee strategieën in de pipeline) — two-way door, pas bouwen bij echte behoefte.
- `use_case_scoring.py` USE_CASE_PRESETS enum-mismatch (4 vs 6) — pre-existing M047-seam, aparte fix.
- Volledige M050.5 tier-enum (demo/paid/superadmin) — vervangt later de losse hauzer_demo-flag.
- HAUZER_DEMO env kill-switch — YAGNI pre-productie.
</deferred>

---

*Phase: 01-fundament-demo-flag*
*Context gathered: 2026-05-21 via /plan-eng-review (architectuur lock-in)*

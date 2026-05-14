# Phase 3: Data Sources UX (S03) — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning
**Source:** Bootstrap uit M049-ROADMAP §Phase 3 + REQUIREMENTS UX-01..UX-06 + TEST-04 + S02 API contract (locked-in 2026-05-14) + DESIGN.md tokens + M045/S05 admin-tab pattern

<domain>
## Phase Boundary

S03 levert de admin-facing frontend voor de M049 data-source hub. Backend API (S02) is GA: `GET /api/admin/data-sources/gemeenten`, `GET /api/admin/data-sources/{gemeente_code}`, `POST /api/admin/data-sources/{gemeente_code}/{source_key}/refresh`. S01 catalog draait. S03 maakt deze data **zichtbaar en bedienbaar** voor superuser-admins via twee nieuwe TanStack Router routes onder `/instellingen/data-bronnen`.

**In scope:**
- 2 nieuwe TanStack Router files: `instellingen.data-bronnen.tsx` (index met gemeente-picker), `instellingen.data-bronnen.$gemeenteCode.tsx` (detail-view met 3 secties)
- SettingsTabNav uitgebreid met 5e pill "Data-bronnen" (superuser-gated, naast bestaande Admin + Beleid-beheer)
- TypeScript type-mirror file `frontend/src/lib/types/data-sources-admin.ts` (sync met S02 Pydantic schemas — handmaintained twin, zelfde patroon als `policy-admin.ts`)
- Data-fetching hooks via TanStack Query (`useGemeentenSummary`, `useGemeenteDataSources`, `useRefreshDataSource`)
- Component library (Aura-conform):
  - `DataSourceSection` (sectie-header per bron-type met count)
  - `DataSourceRow` (label + bron-type badge + status-pill + last_checked relative + action-buttons)
  - `StatusPill` (4 states: live/broken/missing/not_applicable)
  - `GemeentePicker` (dropdown of pill-tabs, default uit org-config)
  - `DataSourcesEmptyState` (CTA voor gemeenten zonder bronnen)
- Action-buttons als **placeholders** (klikbaar maar disabled-tooltip "Komt in S04/S05"):
  - Upload → linkt naar bestaande `/instellingen/beleid-beheer` (M045/S05) als interim deep-link
  - Refresh → wel functioneel (POST naar S02 endpoint) voor open APIs (Type B)
  - Configureer credential → disabled-tooltip "Komt beschikbaar in M049/S05"
  - View versions → disabled-tooltip "Beschikbaar via Beleid-beheer (S04 integratie)"
- Storybook plays voor `DataSourceRow` met 4 status-fixtures + 4 action-state-fixtures (TEST-04)

**Niet in deze phase:**
- UploadDocumentModal / VersionHistoryPanel re-mount in nieuwe hub (Phase 4 — S04)
- Encrypted credential modal + IntegrationCredential calls (Phase 5 — S05)
- ActionItems pagina deprecation + 301-redirect (Phase 6 — S06)
- Backend wijzigingen — S02 contract is locked
- Niet-superuser UX (route is volledig superuser-gated; reguliere users zien geen tab, krijgen 403 op directe URL)

</domain>

<decisions>
## Implementation Decisions

### 1. Routing & file structuur (UX-01)

- **Index route:** `frontend/src/routes/_authenticated/instellingen.data-bronnen.tsx`
  - Loads `GET /api/admin/data-sources/gemeenten` via TanStack Query
  - Toont gemeente-picker (zie #4) + redirect naar default-gemeente
  - **Default gemeente:** eerste gemeente uit `useAuth().user.organization.gemeenten[0]` (org-config). Fallback: eerste uit response (alfabetisch). Als 0 gemeenten → toont `DataSourcesEmptyState` met "Activeer eerst een gemeente in Admin"
- **Detail route:** `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx`
  - Path-param: `gemeenteCode` (string, validation: `^GM\d{4}$` via route `parseParams`/`validateSearch`)
  - Loads `GET /api/admin/data-sources/{gemeente_code}`
  - Renders 3 secties: Beleidsdocumenten / Open APIs / Betaalde integraties
- **Superuser gate:** beforeLoad hook checkt `useAuth().user.is_superuser` — niet superuser → `throw redirect({ to: '/instellingen' })` (zelfde patroon als `instellingen.admin.tsx`)
- **TanStack Router code-splitting:** beide routes lazy-loaded (default voor file-based routes)

### 2. SettingsTabNav uitbreiding (UX-05)

- **File:** `frontend/src/components/settings/SettingsTabNav.tsx`
- **Position:** 5e pill, NA "Beleid-beheer" pill (volgorde: Account → Score profiel → Admin → Beleid-beheer → **Data-bronnen**)
- **Visibility:** `user?.is_superuser && <Link to="/instellingen/data-bronnen" />` — match exact pattern van bestaande Admin pill
- **Match-route logic:** Voeg `isDataBronnenActive` toe met `useMatchRoute({ to: '/instellingen/data-bronnen' })` (fuzzy match — moet ook actief zijn op `$gemeenteCode` sub-route)
- **Aura-tokens:** Hergebruik exact dezelfde className + Obsidian (#0E1111) active-pill + motion.div `layoutId="settings-tab"` (NIET nieuwe layoutId — anders breekt cross-tab transition)
- **Label NL:** "Data-bronnen" (met streepje)

### 3. Status-pill kleurcodes & component (UX-03)

- **Component:** `frontend/src/components/settings/data-bronnen/StatusPill.tsx`
- **Status → kleur mapping (Aura tokens):**
  | Status | Background | Text | Token bron |
  |---|---|---|---|
  | `live` | `bg-[#22C55E]/15` | `text-[#22C55E]` | Vitality Green |
  | `broken` | `bg-red-100` | `text-red-700` | Red (Tailwind default — geen Aura-specifieke) |
  | `missing` | `bg-[#F9A826]/15` | `text-[#F9A826]` | Warm Amber |
  | `not_applicable` | `bg-slate-100` | `text-slate-500` | Neutral grey |
- **Vorm:** pill (rounded-full, px-2.5 py-0.5, text-[11px] font-semibold)
- **NL labels:**
  - `live` → "Live"
  - `broken` → "Foutmelding"
  - `missing` → "Ontbreekt"
  - `not_applicable` → "N.v.t."
- **Tooltip:** bij `broken` toont `error_message` uit DataSourceRow (Radix Tooltip). Andere states geen tooltip.

### 4. Gemeente-picker (UX-01)

- **Component:** `frontend/src/components/settings/data-bronnen/GemeentePicker.tsx`
- **Render:** pill-tabs HORIZONTAAL aan top van detail-view (zelfde scroll-pattern als M048 wijk-tabs)
- **Source:** `GemeenteSummary[]` uit `/gemeenten` endpoint — gesorteerd `last_activity_at DESC`
- **Active state:** Obsidian `#0E1111` pill, motion.div `layoutId="gemeente-picker"`
- **Badge:** elke pill toont `gemeente_naam` + tiny status-dot (groen als alle live, amber als ≥1 missing, rood als ≥1 broken)
- **Overflow:** horizontaal scrollable bij >10 gemeenten, geen wrap
- **Geen gemeenten:** zie #1 fallback

### 5. DataSourceRow component (UX-04)

- **File:** `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx`
- **Layout:** Pure Glass card (`bg-white/60 backdrop-blur-[24px]`, rounded-2xl, border-white/20, p-4 gap-4 flex-col md:flex-row)
- **Columns (desktop flex-row, mobile stack):**
  1. Label + bron-type badge (sm)
  2. Status-pill
  3. `last_checked` als relative string ("2 dagen geleden") — gebruik `date-fns/formatDistanceToNow` met `locale: nl`
  4. Action-button row (rechts uitgelijnd via `ml-auto`)
- **Bron-type badge:** klein chip naast label, kleur per type:
  - `A` (cascade) → Sage Mint `bg-[#D1E2D8]/40 text-[#0E1111]` "Beleid"
  - `B` (open API) → `bg-slate-100 text-slate-700` "API"
  - `C` (paid) → `bg-[#F9A826]/15 text-[#F9A826]` "Integratie"
- **Action-buttons:** map over `available_actions` uit S02 payload. Disabled buttons tonen Radix Tooltip met `reason_disabled` (S02 schema veld). Icon set: Lucide React (`Upload`, `RefreshCw`, `Settings2`, `History`).
- **Loading state:** skeleton-row tijdens query loading (height-match, animate-pulse)

### 6. DataSourceSection component (UX-02)

- **File:** `frontend/src/components/settings/data-bronnen/DataSourceSection.tsx`
- **Header:** sectie-titel + count chip (e.g. "Beleidsdocumenten · 12")
- **Titel-mapping:**
  - `cascade_uploads` → "Beleidsdocumenten"
  - `open_apis` → "Open API-bronnen"
  - `paid_integrations` → "Betaalde integraties"
- **Empty:** als sectie 0 rows → grijze tekst "Nog geen bronnen in deze categorie" (geen full empty-state — die is gemeente-level)
- **Spacing:** secties stacked met `space-y-8`; binnen sectie `space-y-2` voor rows

### 7. Empty-state (UX-06)

- **Component:** `frontend/src/components/settings/data-bronnen/DataSourcesEmptyState.tsx`
- **Trigger:** gemeente heeft 0 rows over alle 3 secties (totaal 0)
- **Illustratie:** Lucide `MapPin` icon (size 48, stroke-2, color `#F9A826`) — geen externe asset
- **Copy:** Heading "Nog geen bronnen geactiveerd voor deze gemeente" + body "Activeer cascade-documenten via Beleid-beheer of configureer open API-bronnen om te starten."
- **CTA:** twee buttons naast elkaar:
  - Primary: "Beleid-beheer openen" → `<Link to="/instellingen/beleid-beheer" />`
  - Secondary: "Documentatie bekijken" → `<a href="https://docs.propdex.nl/data-bronnen" target="_blank">` (placeholder URL — TODO)
- **Aura styling:** Pure Glass card, centered, max-w-md

### 8. Data fetching (TanStack Query)

- **Query hooks file:** `frontend/src/lib/queries/data-sources-admin.ts`
- **Hooks:**
  ```ts
  useGemeentenSummary()  // GET /gemeenten — staleTime 60s
  useGemeenteDataSources(gemeenteCode: string)  // GET /{code} — staleTime 30s
  useRefreshDataSource()  // POST mutation, invalidates useGemeenteDataSources
  ```
- **Query keys:** `['data-sources-admin', 'gemeenten']` en `['data-sources-admin', 'gemeente', gemeenteCode]`
- **Error handling:** TanStack Query default + global error boundary toont "Toegang geweigerd" bij 403 (auth fallthrough)

### 9. Type mirror (data-sources-admin.ts)

- **File:** `frontend/src/lib/types/data-sources-admin.ts`
- **Sync met:** `backend/app/admin/data_sources_schemas.py` (handmatig — zelfde patroon als `policy-admin.ts`)
- **Mirror schemas exact:** `DataSourceRow`, `DataSourceSection`, `GemeenteSummary`, `GemeenteDataSourcesPayload`, `Action`, `SourceType`, `SourceStatus`
- **Header comment:** `/** Mirror of backend data_sources_schemas.py DTOs — M049/S03. Keep in sync. */`

### 10. Storybook plays (TEST-04)

- **File:** `frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx`
- **Plays:** 4 states × 1 minimum each:
  - `LiveWithActions` — status=live, alle actions enabled
  - `BrokenWithError` — status=broken, error_message gevuld, tooltip-test
  - `MissingPlaceholder` — status=missing, alleen "Upload" enabled
  - `NotApplicable` — status=not_applicable, alle actions disabled, tooltips assert
- **Play function:** Storybook `play` met `@storybook/testing-library` queries — assert status-pill class, action button enabled/disabled state, tooltip render bij hover
- **Existing setup:** Check of project Storybook heeft (`frontend/.storybook/`) — als niet aanwezig: planner moet Storybook setup als sub-taak of Vitest component-test fallback gebruiken

### 11. Aura visuele consistentie (UX-02, success criterion 6)

- **Canvas:** Morning Mist `#F2F6F3` (page-level, geen pure wit)
- **Surfaces:** Pure Glass `bg-white/60 backdrop-blur-[24px]` voor rows + cards
- **Typography:** Plus Jakarta Sans (via root font-family, geen inline-overrides)
- **Mesh-background:** Hergebruik bestaande Sage Mint + Amber blobs uit `instellingen.tsx` layout (zit op parent route)
- **Spacing:** `p-4 gap-4` op section level, `p-6` op page content wrapper
- **Border-radius:** `rounded-2xl` op rows, `rounded-full` op pills/badges, `rounded-[40px]` blijft alleen voor map containers (NIET hier)
- **Motion:** `framer-motion` `layoutId` voor tab-transitions; geen entrance-animaties op rows (perf)

### 12. Action-button placeholders & deep-links (afhankelijkheden naar S04/S05)

| Action | Source-types | S03 gedrag | Toekomst |
|---|---|---|---|
| Upload | A (cascade) | Link naar `/instellingen/beleid-beheer` (M045/S05) | S04: opent UploadDocumentModal in-place |
| Refresh | B (open APIs) | POST naar S02 refresh endpoint + toast | Blijft zelfde |
| Configureer credential | C (paid) | Disabled + tooltip "Komt beschikbaar in M049/S05" | S05: opent credential modal |
| View versions | A (cascade) | Disabled + tooltip "Beschikbaar via Beleid-beheer" | S04: opent VersionHistoryPanel side-sheet |

### Claude's Discretion

- File-organisatie binnen `frontend/src/components/settings/data-bronnen/` (één sub-folder, geen verdere nesting tenzij >6 components)
- Toast library — gebruik wat het project al heeft (`sonner` is huidige default per `package.json` check)
- Storybook setup verdiepen — als nog niet aanwezig, planner mag het in een aparte Wave (Wave 0) toevoegen of fallback naar Vitest component tests (interne implementatie-keuze)
- `last_checked` relative-string fallback bij `null` → "Nog niet gecheckt" (geen "—")
- Form-validation regex voor `gemeenteCode` path-param: zod schema in route config
- Test-data fixtures voor Storybook: handmatige `mockDataSources.ts` (geen MSW-server nodig — Storybook play hoeft niet via netwerk)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### M049 milestone documents
- `.planning/ROADMAP.md` — M049 Phase 3 specificatie + success criteria
- `.planning/REQUIREMENTS.md` — UX-01..UX-06 + TEST-04 acceptance criteria
- `.planning/phases/02-admin-api-layer/02-CONTEXT.md` — S02 API contract dat S03 consumeert (schemas, endpoints, payload structuur)
- `~/.gsd/projects/0fbd70b53f1b/milestones/M049/M049-ROADMAP.md` — canoniek milestone-document

### Backend contract (S01 + S02 — al gemerged)
- `backend/app/admin/data_sources_router.py` — REST endpoints (single source of truth voor URL paths + auth)
- `backend/app/admin/data_sources_schemas.py` — Pydantic schemas (mirror exact in TypeScript)
- `backend/app/admin/data_source_keys.py` — catalog (27+ bronnen, 3 types) — gebruik labels uit deze file als bron voor `label_nl` consistency check

### Design system
- `DESIGN.md` (repo root) — Aura design tokens (Morning Mist canvas, Pure Glass surfaces, Vitality Green/Warm Amber/Obsidian palette, Plus Jakarta Sans typography, motion stiffness/damping waarden)
- `frontend/src/styles/index.css` — Tailwind v4 `@theme` block met token-definitions

### Frontend patterns om te volgen (M045/S05 admin-tab template)
- `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx` — superuser-gated route pattern (beforeLoad redirect)
- `frontend/src/routes/_authenticated/instellingen.admin.tsx` — settings sub-route boilerplate
- `frontend/src/components/settings/SettingsTabNav.tsx` — pill-nav met motion layoutId pattern (uit te breiden, niet vervangen)
- `frontend/src/components/settings/beleid/InstellingenBeleidPage.tsx` — page-level layout met sections + Aura tokens
- `frontend/src/components/settings/beleid/DocumentRow.tsx` — row-component pattern voor S03 DataSourceRow
- `frontend/src/lib/types/policy-admin.ts` — type-mirror header comment pattern
- `frontend/src/lib/constants/dataSources.ts` — bestaande shared catalog (M045/S05 T00); check naming consistency

### Project guidelines
- `CLAUDE.md` (repo root) — Propdex stack workflow contract, hard rules (M0xx/Sxx prefix, brainstorm vóór nieuw component, verification vóór "klaar")
- `~/.claude/CLAUDE.md` — Klarifai global rules (multi-tenant, TypeScript types, Tailwind, file size <300 lines)

</canonical_refs>

<specifics>
## Specific Ideas

- Lucide React iconen: `Upload` (16px), `RefreshCw` (16px, animate-spin tijdens mutation pending), `Settings2` (16px), `History` (16px), `MapPin` (48px empty-state)
- `formatDistanceToNow` met `locale: nl` import path: `import { nl } from 'date-fns/locale/nl'`
- Refresh button mutation feedback: optimistic UI — disable button tijdens pending + animate-spin op icoon. On success: invalidate query + toast "Refresh voltooid voor {label}". On error: toast met `error.message` + revert.
- Tooltip library: Radix UI (al in repo via shadcn/ui) — gebruik `@/components/ui/tooltip`
- `useMatchRoute` fuzzy: `matchRoute({ to: '/instellingen/data-bronnen', fuzzy: true })` (TanStack Router optie)

</specifics>

<deferred>
## Deferred Ideas

- Inline UploadDocumentModal in S03 detail view — naar S04 (integratie via portal/modal)
- Inline credential-config modal — naar S05 (encrypted IntegrationCredential model bestaat dan)
- ActionItems content-migratie + 301 redirect — naar S06
- Per-row "Edit configuratie" voor non-secret JSONB veld (refresh-interval per source) — out of M049 scope
- Bulk-refresh per sectie ("Refresh alle Open APIs") — out of M049, mogelijk M050
- Audit-log paneel per data-source — out of scope
- Documentatie-URL (`docs.propdex.nl/data-bronnen`) is placeholder; echte docs schrijven post-M049

</deferred>

---

*Phase: 03-data-sources-ux*
*Context bootstrapped 2026-05-14 from M049-ROADMAP + REQUIREMENTS + S02 API contract*

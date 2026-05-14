# Phase 4: M045 Upload-flow Integratie (S04) — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning
**Source:** Bootstrap uit M049-ROADMAP §Phase 4 + REQUIREMENTS INT-01..INT-04 + TEST-06 + plan-eng-review lock-in 2026-05-14 + S03 deliverables (data-bronnen hub live)

<domain>
## Phase Boundary

S04 maakt het beheer van **gemeente-niveau beleidsdocumenten** uit de data-bronnen hub zelf bedienbaar zonder context-switch naar de oude M045/S05 `/instellingen/beleid-beheer` page. Upload en version-history landen inline; bestaande documenten worden automatisch zichtbaar in de hub-rij; de legacy page blijft functioneel met een redirect-banner.

**In scope:**
- `UploadDocumentModal` mount inline in de data-bronnen detail-route, geopend vanuit row "Upload" action
- `VersionHistoryPanel` mount inline, geopend vanuit row "Bekijk versies" action (alleen bij `status === 'live'`)
- Existing `UploadDocumentModal` props uitbreiden met optionele `initialGemeente?`, `initialSourceKey?`, `onSuccess?` — backwards-compatible voor M045 call site
- Existing `VersionHistoryPanel` props checken op zelfde pattern (mogelijk al voldoende; planner moet bevestigen)
- Banner top-of-page op `/instellingen/beleid-beheer` met deeplink naar `/instellingen/data-bronnen`
- Cache-invalidation wiring: na upload-success invalidateert caller-page `dataSourcesAdminKeys.gemeente(gemeenteCode)` zodat de row's status-pill flipt naar live
- Probe-trigger flow: after upload, refresh action wordt aangeroepen om backend probe te runnen die `gemeente_data_source_status` rij upsert naar status='live' (INT-04 materialisatie)
- Regression-test suite TEST-06: bestaande M045/S05 admin-hub paths blijven groen (smoke-test on beleid-beheer page render + upload via legacy path)

**Niet in deze phase:**
- Landelijk en Provincie niveau coverage in data-bronnen — deferred naar **M050** (banner copy refereert hiernaar)
- Hard redirect van `/instellingen/beleid-beheer` — beslist tegen tijdens eng-review 2026-05-14 omdat Landelijk/Provincie features daar nog actief zijn
- Backend endpoint wijzigingen aan S02 contract — locked
- Encrypted credential modal (S05)
- ActionItems pagina deprecation (S06)
- Nieuwe permissies of RBAC wijzigingen — gebruik bestaande superuser-gate

</domain>

<decisions>
## Implementation Decisions (LOCKED via plan-eng-review 2026-05-14)

### 1. Modal contract extension (eng-review #1)

- Extend `frontend/src/components/settings/beleid/UploadDocumentModal.tsx` met drie optionele props:
  - `initialGemeente?: GemeenteEntry` — pre-selecteert gemeente in stap 2 wanneer geopend vanuit data-bronnen detail-route
  - `initialSourceKey?: string` — pre-selecteert source_key in stap 3 wanneer geopend vanuit specifieke row
  - `onSuccess?: (versionId: string) => void` — optional callback aangeroepen na succesvolle upload, na bestaande cache-invalidations
- **Backwards-compatibility eis:** existing call site in `InstellingenBeleidPage.tsx` (regel ~185) blijft werken zonder wijziging. Props zijn optional met undefined-default. Niveau-selectie blijft mogelijk wanneer `initialGemeente` undefined is.
- **VersionHistoryPanel:** analoge check. Planner inspecteert `VersionHistoryPanel.tsx` en past zelfde pattern toe als nodig (`initialGemeente?`, `initialSourceKey?` of equivalent).

### 2. Cache invalidation pattern (eng-review #2)

- Modal blijft generiek — kent geen S03 query-keys.
- Data-bronnen detail-route (`instellingen.data-bronnen.$gemeenteCode.tsx`) passeert een `onSuccess` callback die `queryClient.invalidateQueries({ queryKey: dataSourcesAdminKeys.gemeente(gemeenteCode) })` doet.
- Volgorde van side-effects op upload-success:
  1. `useUploadPolicyDocument` mutation success → bestaande M045 cache-invalidations (`policy-documents/admin/overview` + per-entity cache)
  2. Sonner toast met version_number
  3. `onSuccess` callback wordt aangeroepen → S03 cache invalidation
  4. Modal sluit
- **INT-04 materialisatie:** na de S03 cache-invalidation triggert de page de `useRefreshDataSource` mutation voor de zojuist geüploade `source_key`. De bestaande Type A probe detecteert de nieuwe policy_documents rij en upsert `gemeente_data_source_status` naar status='live'. Frontend krijgt automatisch verse data via de invalidated query.
- **Validate eerst (planner):** controleer of de Type A probe in `backend/app/admin/data_source_probes.py` daadwerkelijk `policy_documents` rows checkt voor de gemeente+source_key combinatie. Zo niet, dit is een kleine backend-gap die binnen S04 valt op te lossen (1 file, ~10-20 regels).

### 3. Modal hosting locatie (eng-review #3)

- `useState<string | null>(openForSourceKey)` in `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx`
- `UploadDocumentModal` mounted at page level (één instance per page-mount), niet per row
- Row's Upload-button `onClick` zet de state naar zijn `source_key`. Modal opent met `initialGemeente` en `initialSourceKey` pre-filled. `onClose` zet state terug naar `null`.
- **GEEN app-root context-provider** — alleen data-bronnen page heeft dit nodig. Lokaliteit > globaliteit voor één-keer-gebruik.
- Analoge state voor `VersionHistoryPanel`: `useState<string | null>(viewVersionsForSourceKey)`.

### 4. Beleid-beheer banner (eng-review #4)

- Bestand: `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx` (huidige 11 regels — wraps `InstellingenBeleidPage`)
- Banner toegevoegd binnen de route, vóór de bestaande `<InstellingenBeleidPage />` render. Aura-conform amber tint:
  ```tsx
  <div className="bg-[#F9A826]/15 border border-[#F9A826]/30 rounded-2xl p-4 mb-6">
    <p className="text-[13px] text-[#0E1111]">
      <strong>Gemeente-documenten beheer je nu vanuit Data-bronnen.</strong>
      {' '}Landelijk/Provincie blijft hier tot M050.{' '}
      <Link to="/instellingen/data-bronnen" className="font-semibold underline">
        Ga naar Data-bronnen →
      </Link>
    </p>
  </div>
  ```
- Route blijft volledig functioneel. Geen `beforeLoad` redirect. Page-content (CascadeLevelAccordion + DocumentRow + VersionHistoryPanel + UploadDocumentModal) ongewijzigd.

### 5. Row action wiring (DataSourceRow.tsx)

- Huidige `Upload` action is een `<Link to="/instellingen/beleid-beheer">` (deeplink, M049/S03 placeholder)
- Nieuwe gedrag: ontvang `onUpload?: (sourceKey: string) => void` en `onViewVersions?: (sourceKey: string) => void` callback-props van parent. Bij `onClick` van de respectievelijke action: invoke de callback met `row.source_key`. Geen `<Link>` meer.
- **Backwards-compatibility in Storybook:** mockDataSources fixtures werken nog, callbacks zijn optional. Bij missende callback gedraagt knop zich als disabled (tooltip "Komt beschikbaar in S04" verdwijnt want acties zijn live).
- Type A `missing` regel hide-refresh logic uit S03 blijft staan.
- `view_versions` action: alleen enabled wanneer `status === 'live'` (geen versies bij missing/broken). Disabled-tooltip: "Nog geen documenten geüpload".

### 6. INT-04 verificatie pad

- Aanname: bestaande Type A probe (`backend/app/admin/data_source_probes.py`) check op `policy_documents` waar `entity_type='gemeente'`, `entity_code=gemeente_code`, `source_key=source_key`, `is_active=true`.
- Wanneer aanname klopt: geen backend wijziging nodig. Frontend triggert refresh → probe runt → status flips.
- Wanneer aanname niet klopt: planner voegt 1 backend-task toe die de probe-logic uitbreidt met deze check. Geen schema-wijziging, alleen probe-query.
- **Materialisatie van bestaande documenten (INT-04 vereisen "automatisch zichtbaar"):** een one-off backfill of opportunistic probe-on-page-load. Planner kiest tussen:
  - (a) Opportunistic: bij eerste `GET /api/admin/data-sources/{gemeente_code}` voor een gemeente trigger backend automatisch probes voor alle Type A source_keys die status='missing' hebben. Initial load is iets langzamer (~500ms-1s) maar self-healing.
  - (b) Eenmalige backfill-tool (`python -m app.tools.backfill_data_source_status --gemeente Venlo`) gerund na deploy.
  - Voorkeur: **(a) opportunistic** — minder operationeel werk, blijft werken voor nieuwe gemeenten.

### 7. Storybook updates

- `DataSourceRow.stories.tsx`: callbacks toegevoegd in story-args. Play functions checken dat `onClick` triggert en `onUpload`/`onViewVersions` worden aangeroepen met juiste `source_key`.
- Nieuwe story: `InstellingenBeleidPage.stories.tsx` voor de banner — eenvoudige visual confirm dat banner Aura-tokens correct rendert.

### 8. TEST-06 regression scope

- Smoke-test: render `InstellingenBeleidPage` met banner zichtbaar; upload via legacy flow blijft werken (geen prop-conflicts met nieuwe optional props).
- Pre-merge check: oude e2e of integration test die bestaande M045/S05 upload flow walked through moet blijven groen. Geen aparte e2e nodig — bestaande smoke is genoeg.

</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### M049 milestone context
- `.planning/ROADMAP.md` — Phase 4 entry met goal + success criteria + INT/TEST IDs
- `.planning/REQUIREMENTS.md` — INT-01..INT-04 + TEST-06 definities
- `.planning/phases/03-data-sources-ux/03-CONTEXT.md` — S03 architectuur dat S04 op voortbouwt

### M049/S03 deliverables (just shipped — read these for current state)
- `frontend/src/lib/types/data-sources-admin.ts` — TS types mirror van S02 DTOs
- `frontend/src/lib/queries/data-sources-admin.ts` — `dataSourcesAdminKeys` factory + 3 hooks (useGemeentenSummary, useGemeenteDataSources, useRefreshDataSource)
- `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` — huidige row met Upload als Link (S03 placeholder)
- `frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx` — bestaande story battery (te updaten)
- `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` — detail route waarin modal komt te zitten

### M045/S05 components (extending these — backwards-compat-eis)
- `frontend/src/components/settings/beleid/UploadDocumentModal.tsx` — modal component, props worden uitgebreid
- `frontend/src/components/settings/beleid/VersionHistoryPanel.tsx` — version history component
- `frontend/src/components/settings/beleid/InstellingenBeleidPage.tsx` — bestaande call site (regel ~185); blijft werken zonder wijziging
- `frontend/src/hooks/usePolicyDocuments.ts` — `useUploadPolicyDocument` mutation die modal gebruikt
- `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx` — route die banner krijgt

### M049/S02 probe contract (INT-04 dependency)
- `backend/app/admin/data_source_probes.py` — Type A probe-functie, planner moet bevestigen of policy_documents-check er al in zit
- `backend/app/admin/data_sources_router.py` — `POST /api/admin/data-sources/{gemeente_code}/{source_key}/refresh` endpoint dat probes triggert

### Design system
- `DESIGN.md` (repo root) — Aura tokens (`#F9A826` Warm Amber voor banner, glass surfaces, Plus Jakarta Sans, light-mode-only)
- `frontend/src/styles/index.css` — `@theme` token block (Tailwind v4)

</canonical_refs>

<specifics>
## Specific Implementation Notes

### Upload-modal props extension (concrete diff)

```tsx
// frontend/src/components/settings/beleid/UploadDocumentModal.tsx
interface Props {
  open: boolean
  onClose: () => void
  gemeenten: GemeenteEntry[]
  initialGemeente?: GemeenteEntry          // NEW
  initialSourceKey?: string                 // NEW
  onSuccess?: (versionId: string) => void   // NEW
}

// Inside component, after existing useState declarations:
useEffect(() => {
  if (open && initialGemeente) setSelectedGemeente(initialGemeente)
  if (open && initialSourceKey) setSelectedSourceKey(initialSourceKey)
}, [open, initialGemeente, initialSourceKey])

// In existing onSuccess handler of useUploadPolicyDocument:
.then(({ version_id }) => {
  // existing cache invalidations + toast …
  onSuccess?.(version_id)                   // NEW
  handleClose()
})
```

### Detail-route modal-mount (concrete diff)

```tsx
// frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx
const [openUploadFor, setOpenUploadFor] = useState<string | null>(null)
const [openVersionsFor, setOpenVersionsFor] = useState<string | null>(null)
const queryClient = useQueryClient()
const refreshMutation = useRefreshDataSource()

const handleUploadSuccess = (sourceKey: string) => {
  // S03 cache invalidation
  queryClient.invalidateQueries({ queryKey: dataSourcesAdminKeys.gemeente(gemeenteCode) })
  // INT-04: trigger probe so status flips to live
  refreshMutation.mutate({ gemeenteCode, sourceKey, sourceLabel: '...' })
}

// In <DataSourceRow /> children:
<DataSourceRow
  gemeenteCode={gemeenteCode}
  row={row}
  onUpload={(sk) => setOpenUploadFor(sk)}
  onViewVersions={(sk) => setOpenVersionsFor(sk)}
/>

// At page level (after sections):
<UploadDocumentModal
  open={openUploadFor !== null}
  onClose={() => setOpenUploadFor(null)}
  gemeenten={gemeentenForModal /* derived from gemeentenQuery */}
  initialGemeente={...}
  initialSourceKey={openUploadFor ?? undefined}
  onSuccess={() => openUploadFor && handleUploadSuccess(openUploadFor)}
/>
<VersionHistoryPanel
  open={openVersionsFor !== null}
  onClose={() => setOpenVersionsFor(null)}
  gemeenteCode={gemeenteCode}
  sourceKey={openVersionsFor ?? undefined}
/>
```

### Banner copy (exact text)

> **Gemeente-documenten beheer je nu vanuit Data-bronnen.** Landelijk/Provincie blijft hier tot M050. [Ga naar Data-bronnen →]

### Tailwind classes voor banner

`bg-[#F9A826]/15 border border-[#F9A826]/30 rounded-2xl p-4 mb-6`

</specifics>

<deferred>
## Deferred Ideas

- **Landelijk + Provincie coverage in data-bronnen hub** → M050 (apart milestone). Banner refereert hiernaar.
- **Hard redirect van beleid-beheer** → na M050 wanneer alle levels in nieuwe hub zitten.
- **Encrypted credential modal** → M049/S05 (Phase 5).
- **ActionItems pagina deprecation** → M049/S06 (Phase 6).
- **Conditional empty-state** voor view-versions action wanneer status='broken' (huidige plan: gewoon disabled met tooltip "Nog geen documenten geüpload" — adequate UX).

</deferred>

---

*Phase: 04-m045-upload-flow-integratie*
*Context gathered: 2026-05-14 via plan-eng-review lock-in (drie-laags pattern)*

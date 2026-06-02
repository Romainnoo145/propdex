# Data-bronnen Scope Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Data-bronnen the single home for all policy documents (Landelijk + Provinciaal + Gemeente) via a scope switcher, and retire the redundant `beleid-beheer` tab.

**Architecture:** Backend gets a level-tagged catalog + a generalized `GET /{entity_type}/{entity_code}` endpoint (gemeente keeps its A/B/C + `DataSourceStatus` path; Landelijk/Provinciaal are document-only and compute type-A status live from `PolicyDocument` — no migration). Frontend replaces the gemeente picker with a Landelijk·Provincie·Gemeente scope switcher on a generalized route, redirecting old `GM####` URLs. Then beleid-beheer is removed.

**Tech Stack:** FastAPI + SQLAlchemy 2.x (async), Pydantic v2, pytest; React + TanStack Router/Query, Vitest/Storybook.

**Spec:** `docs/superpowers/specs/2026-06-02-data-bronnen-scope-consolidation-design.md`

---

## File Structure

**Backend**
- Modify `backend/app/policy_documents/data_source_keys.py` — add `level` to type-A entries.
- Modify `backend/app/admin/data_source_probes.py` — generalize type-A probe to (entity_type, entity_code).
- Create `backend/app/admin/data_sources_scope.py` — scope helpers (catalog-by-scope, live type-A status, province list).
- Modify `backend/app/admin/data_sources_schemas.py` — add `ScopeDataSourcesPayload`, `ScopeSummary`.
- Modify `backend/app/admin/data_sources_router.py` — add generalized scope endpoints.
- Tests: `backend/tests/unit/test_data_source_keys_levels.py`, `backend/tests/integration/test_admin_data_sources_scope.py`.

**Frontend**
- Modify `frontend/src/lib/types/data-sources-admin.ts` — scope types.
- Modify `frontend/src/lib/queries/data-sources-admin.ts` — scope hooks.
- Create `frontend/src/components/settings/data-bronnen/ScopePicker.tsx` — Landelijk·Provincie·Gemeente switcher.
- Create `frontend/src/routes/_authenticated/instellingen.data-bronnen.$entityType.$entityCode.tsx` — generalized scope page.
- Modify `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` — convert to redirect.
- Modify `frontend/src/routes/_authenticated/instellingen.data-bronnen.index.tsx` — render ScopePicker.

**Removal**
- Delete `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx`.
- Delete `frontend/src/components/settings/beleid/InstellingenBeleidPage.tsx`.
- Modify `frontend/src/components/settings/SettingsTabNav.tsx` — drop beleid-beheer tab.
- Modify `frontend/src/components/settings/data-bronnen/DataSourcesEmptyState.tsx` — repoint link.

---

## Phase 1 — Backend: level-aware catalog + generalized scope endpoint

### Task 1: Tag the catalog with `level`

**Files:**
- Modify: `backend/app/policy_documents/data_source_keys.py`
- Test: `backend/tests/unit/test_data_source_keys_levels.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_data_source_keys_levels.py
"""Every type-A catalog entry must declare a level; B/C are implicitly gemeente."""
from app.policy_documents.data_source_keys import (
    DATA_SOURCE_KEYS,
    get_entries_by_type,
)

VALID_LEVELS = {"landelijk", "provincie", "gemeente"}


def test_every_type_a_entry_has_valid_level() -> None:
    for e in get_entries_by_type("A"):
        assert getattr(e, "level", None) in VALID_LEVELS, f"{e.key} missing/invalid level"


def test_b_and_c_entries_are_gemeente_level() -> None:
    for e in [*get_entries_by_type("B"), *get_entries_by_type("C")]:
        assert e.level == "gemeente"


def test_each_level_has_at_least_one_type_a_entry() -> None:
    levels = {e.level for e in get_entries_by_type("A")}
    assert {"landelijk", "provincie", "gemeente"}.issubset(levels)
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_data_source_keys_levels.py -q`
Expected: FAIL (`DataSourceKeyEntry` has no `level`).

- [ ] **Step 3: Add `level` field + tag entries**

In `data_source_keys.py`, add to the dataclass:

```python
@dataclass(frozen=True)
class DataSourceKeyEntry:
    key: str
    label_nl: str
    source_type: SourceType
    description: str
    level: Literal["landelijk", "provincie", "gemeente"] = "gemeente"
    voedt_factor: tuple[str, ...] = field(default_factory=tuple)
```

Then set `level=` on each type-A entry. Provincie-level keys (set `level="provincie"`):
`omgevingsverordening-provincie`, `provinciale-omgevingsvisie`, `provinciaal-erfgoed`,
`natuur-stikstof-provincie`, `energietransitie-res`, `mobiliteitsbeleid`, `provinciale-subsidies`.
All other type-A keys stay `gemeente` (the default). There are no `landelijk` doc-types in the
current catalog, so add one landelijk entry so the level is represented:

```python
    DataSourceKeyEntry(
        key="omgevingswet-bbl",
        label_nl="Omgevingswet & Bbl (landelijk)",
        source_type="A",
        description="Landelijk wettelijk kader: Omgevingswet + Besluit bouwwerken leefomgeving.",
        level="landelijk",
        voedt_factor=("vergunning_succeskans",),
    ),
```
Type-B and type-C entries: leave `level` defaulting to `"gemeente"` (no change needed).

- [ ] **Step 4: Run tests, verify pass**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_data_source_keys_levels.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify the TS twin still matches (catalog drift guard)**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_data_source_keys_catalog.py -q`
Expected: PASS. If it fails on the new `omgevingswet-bbl` key, mirror that key into
`frontend/src/lib/constants/dataSourceKeys.ts` (add the same entry) and re-run.

- [ ] **Step 6: Commit**

```bash
git add backend/app/policy_documents/data_source_keys.py backend/tests/unit/test_data_source_keys_levels.py frontend/src/lib/constants/dataSourceKeys.ts
git commit -m "feat: level-tag type-A data-source catalog entries"
```

---

### Task 2: Generalize the type-A probe to (entity_type, entity_code)

**Files:**
- Modify: `backend/app/admin/data_source_probes.py`
- Test: `backend/tests/integration/test_admin_data_sources_scope.py` (create; extended in later tasks)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_admin_data_sources_scope.py
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.admin.data_source_probes import probe_type_a_for_entity
from app.models.policy_document import PolicyDocument


@pytest.mark.asyncio
async def test_type_a_probe_live_for_provincie_doc(test_db: AsyncSession) -> None:
    test_db.add(PolicyDocument(
        id=uuid.uuid4(), entity_type="provincie", entity_code="PV31",
        source_key="provinciale-omgevingsvisie", is_global=True,
        filename="x.pdf", content_type="application/pdf", file_data=b"%PDF-1.4",
        version_number=1, status="parsed",
    ))
    await test_db.commit()
    live = await probe_type_a_for_entity("provinciale-omgevingsvisie", "provincie", "PV31", test_db)
    assert live["status"] == "live"
    missing = await probe_type_a_for_entity("provinciaal-erfgoed", "provincie", "PV31", test_db)
    assert missing["status"] == "missing"
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/integration/test_admin_data_sources_scope.py -q`
Expected: FAIL (`probe_type_a_for_entity` undefined).

- [ ] **Step 3: Add the generalized probe**

In `data_source_probes.py`, add (and refactor the existing gemeente probe to delegate):

```python
async def probe_type_a_for_entity(
    source_key: str, entity_type: str, entity_code: str, db: AsyncSession
) -> ProbeResult:
    """Live iff a vendor PolicyDocument exists for (entity_type, entity_code, source_key)."""
    count = await db.scalar(
        select(func.count())
        .select_from(PolicyDocument)
        .where(PolicyDocument.entity_type == entity_type)
        .where(PolicyDocument.entity_code == entity_code)
        .where(PolicyDocument.source_key == source_key)
        .where(PolicyDocument.is_global.is_(True))
    )
    if count and count > 0:
        return {"status": "live", "error_message": None}
    return {"status": "missing", "error_message": "No vendor PolicyDocument rows found"}


async def probe_type_a_cascade(
    source_key: str, gemeente_code: str, db: AsyncSession
) -> ProbeResult:
    return await probe_type_a_for_entity(source_key, "gemeente", gemeente_code, db)
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd backend && .venv/bin/python -m pytest tests/integration/test_admin_data_sources_scope.py -q`
Expected: PASS. Also run `tests/integration/test_admin_data_sources_router.py -q` → still PASS (gemeente path unchanged).

- [ ] **Step 5: Commit**

```bash
git add backend/app/admin/data_source_probes.py backend/tests/integration/test_admin_data_sources_scope.py
git commit -m "feat: generalize type-A data-source probe to any entity scope"
```

---

### Task 3: Scope schemas + scope helper

**Files:**
- Modify: `backend/app/admin/data_sources_schemas.py`
- Create: `backend/app/admin/data_sources_scope.py`

- [ ] **Step 1: Add schemas**

In `data_sources_schemas.py` append:

```python
class ScopeDataSourcesPayload(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    entity_type: Literal["landelijk", "provincie", "gemeente"]
    entity_code: str
    entity_naam: str
    cascade_uploads: list[DataSourceRow]
    open_apis: list[DataSourceRow]       # empty for landelijk/provincie
    paid_integrations: list[DataSourceRow]  # empty for landelijk/provincie


class ScopeOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    entity_type: Literal["landelijk", "provincie", "gemeente"]
    entity_code: str
    entity_naam: str
```

- [ ] **Step 2: Create the scope helper**

```python
# backend/app/admin/data_sources_scope.py
"""Scope-aware catalog assembly for Landelijk/Provincie/Gemeente data-sources."""
from app.admin.data_sources_helpers import _synthesize_missing_row
from app.admin.data_sources_schemas import DataSourceRow
from app.admin.data_source_probes import probe_type_a_for_entity
from app.policy_documents.data_source_keys import get_entries_by_type
from sqlalchemy.ext.asyncio import AsyncSession


async def cascade_rows_for_scope(
    entity_type: str, entity_code: str, db: AsyncSession
) -> list[DataSourceRow]:
    """Type-A rows for a non-gemeente scope, status computed live (no DataSourceStatus)."""
    rows: list[DataSourceRow] = []
    for entry in get_entries_by_type("A"):
        if entry.level != entity_type:
            continue
        probe = await probe_type_a_for_entity(entry.key, entity_type, entity_code, db)
        row = _synthesize_missing_row(entry)
        row.status = probe["status"]  # type: ignore[assignment]
        row.error_message = probe["error_message"]
        rows.append(row)
    return rows
```

- [ ] **Step 3: Run import smoke**

Run: `cd backend && .venv/bin/python -c "from app.admin.data_sources_scope import cascade_rows_for_scope; from app.admin.data_sources_schemas import ScopeDataSourcesPayload, ScopeOption; print('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/admin/data_sources_schemas.py backend/app/admin/data_sources_scope.py
git commit -m "feat: add scope payload schemas + non-gemeente cascade-row helper"
```

---

### Task 4: Generalized scope endpoints (scopes list + per-scope payload)

**Files:**
- Modify: `backend/app/admin/data_sources_router.py`
- Test: `backend/tests/integration/test_admin_data_sources_scope.py`

- [ ] **Step 1: Write failing tests**

Append to `test_admin_data_sources_scope.py`:

```python
@pytest.mark.asyncio
async def test_scopes_endpoint_lists_landelijk_and_provinces(
    async_client, test_db, create_test_user
):
    user, org = await create_test_user(email="scope1@test", is_superuser=True)
    resp = await async_client.get(
        "/api/admin/data-sources/scopes",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    types = {s["entity_type"] for s in resp.json()}
    assert "landelijk" in types


@pytest.mark.asyncio
async def test_scope_payload_landelijk_is_type_a_only(
    async_client, test_db, create_test_user
):
    user, org = await create_test_user(email="scope2@test", is_superuser=True)
    resp = await async_client.get(
        "/api/admin/data-sources/scope/landelijk/NL",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["open_apis"] == [] and body["paid_integrations"] == []
    assert len(body["cascade_uploads"]) >= 1
```

(Import `_superuser_headers` from `tests.integration.test_admin_data_sources_router`.)

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && .venv/bin/python -m pytest tests/integration/test_admin_data_sources_scope.py -q`
Expected: FAIL (404 — endpoints not defined).

- [ ] **Step 3: Add endpoints**

In `data_sources_router.py` add imports `from app.admin.data_sources_scope import cascade_rows_for_scope`, `from app.admin.data_sources_schemas import ScopeDataSourcesPayload, ScopeOption`, `from app.models.gemeente_provincie_map import GemeenteProvincieMap`, and:

```python
# 12 NL provinces — stable code→naam (CBS PVxx). Hardcoded; rarely changes.
_PROVINCE_NAMES = {
    "PV20": "Groningen", "PV21": "Fryslân", "PV22": "Drenthe", "PV23": "Overijssel",
    "PV24": "Flevoland", "PV25": "Gelderland", "PV26": "Utrecht", "PV27": "Noord-Holland",
    "PV28": "Zuid-Holland", "PV29": "Zeeland", "PV30": "Noord-Brabant", "PV31": "Limburg",
}


@router.get("/scopes", response_model=list[ScopeOption])
async def list_scopes(
    _: User = Depends(get_current_superuser), db: AsyncSession = Depends(get_db),
) -> list[ScopeOption]:
    """Landelijk (single) + the provinces present in gemeente_provincie_map."""
    out = [ScopeOption(entity_type="landelijk", entity_code="NL", entity_naam="Nederland")]
    codes = (await db.execute(select(GemeenteProvincieMap.provincie_code).distinct())).scalars().all()
    for code in sorted(c for c in codes if c):
        out.append(ScopeOption(entity_type="provincie", entity_code=code,
                                entity_naam=_PROVINCE_NAMES.get(code, code)))
    return out


@router.get("/scope/{entity_type}/{entity_code}", response_model=ScopeDataSourcesPayload)
async def get_scope_sources(
    entity_type: str, entity_code: str, request: Request,
    _: User = Depends(get_current_superuser), db: AsyncSession = Depends(get_db),
) -> ScopeDataSourcesPayload:
    if entity_type not in ("landelijk", "provincie"):
        raise HTTPException(status_code=400, detail="Use /{gemeente_code} for gemeente scope")
    naam = "Nederland" if entity_type == "landelijk" else _PROVINCE_NAMES.get(entity_code, entity_code)
    cascade = await cascade_rows_for_scope(entity_type, entity_code, db)
    return ScopeDataSourcesPayload(
        entity_type=entity_type, entity_code=entity_code, entity_naam=naam,
        cascade_uploads=cascade, open_apis=[], paid_integrations=[],
    )
```

Note: place the `/scopes` and `/scope/...` routes **before** the `/{gemeente_code}` route in the file so the GM#### path param does not shadow them (FastAPI matches in definition order; literal-prefixed paths are safe but keep them above to be explicit).

- [ ] **Step 4: Run tests, verify pass**

Run: `cd backend && .venv/bin/python -m pytest tests/integration/test_admin_data_sources_scope.py tests/integration/test_admin_data_sources_router.py -q`
Expected: PASS (new + existing gemeente tests).

- [ ] **Step 5: ruff + commit**

```bash
cd backend && ruff check app/admin/ && cd ..
git add backend/app/admin/data_sources_router.py backend/tests/integration/test_admin_data_sources_scope.py
git commit -m "feat: scope list + per-scope data-sources endpoints (landelijk/provincie)"
```

---

## Phase 2 — Frontend: scope picker + generalized route

### Task 5: Scope types + query hooks

**Files:**
- Modify: `frontend/src/lib/types/data-sources-admin.ts`
- Modify: `frontend/src/lib/queries/data-sources-admin.ts`

- [ ] **Step 1: Add types**

In `data-sources-admin.ts` (types) add:

```ts
export type EntityType = 'landelijk' | 'provincie' | 'gemeente'

export interface ScopeOption {
  entity_type: EntityType
  entity_code: string
  entity_naam: string
}

export interface ScopeDataSourcesPayload {
  entity_type: EntityType
  entity_code: string
  entity_naam: string
  cascade_uploads: DataSourceRow[]
  open_apis: DataSourceRow[]
  paid_integrations: DataSourceRow[]
}
```

- [ ] **Step 2: Add hooks**

In `queries/data-sources-admin.ts` add to `dataSourcesAdminKeys`: `scopes: () => [...all,'scopes'] as const`, `scope: (t:string,c:string)=>[...all,'scope',t,c] as const`. Then:

```ts
export function useScopes() {
  const { accessToken } = useAuth()
  return useQuery<ScopeOption[]>({
    queryKey: dataSourcesAdminKeys.scopes(),
    queryFn: () => apiFetch<ScopeOption[]>('/api/admin/data-sources/scopes', { method: 'GET', accessToken }),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
  })
}

export function useScopeDataSources(entityType: string | undefined, entityCode: string | undefined) {
  const { accessToken } = useAuth()
  return useQuery<ScopeDataSourcesPayload>({
    queryKey: dataSourcesAdminKeys.scope(entityType ?? '', entityCode ?? ''),
    queryFn: () => apiFetch<ScopeDataSourcesPayload>(
      `/api/admin/data-sources/scope/${entityType}/${entityCode}`, { method: 'GET', accessToken }),
    enabled: !!accessToken && !!entityType && !!entityCode && entityType !== 'gemeente',
    staleTime: 30 * 1000,
  })
}
```

(Import `ScopeOption, ScopeDataSourcesPayload` from the types module.)

- [ ] **Step 3: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'data-sources-admin' || echo clean`
Expected: `clean`.

```bash
git add frontend/src/lib/types/data-sources-admin.ts frontend/src/lib/queries/data-sources-admin.ts
git commit -m "feat: scope types + useScopes/useScopeDataSources hooks"
```

---

### Task 6: ScopePicker component

**Files:**
- Create: `frontend/src/components/settings/data-bronnen/ScopePicker.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useNavigate } from '@tanstack/react-router'
import { useScopes } from '@/lib/queries/data-sources-admin'
import { GemeentePicker } from './GemeentePicker'

/** Landelijk · Provincie · Gemeente switcher. Landelijk/Provincie navigate to the
 *  generalized scope route; Gemeente delegates to the existing GemeentePicker. */
export function ScopePicker() {
  const navigate = useNavigate()
  const { data: scopes } = useScopes()
  const landelijk = scopes?.find((s) => s.entity_type === 'landelijk')
  const provinces = scopes?.filter((s) => s.entity_type === 'provincie') ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {landelijk && (
          <button
            className="px-4 py-2 rounded-full bg-white/60 backdrop-blur-[24px] text-[13px] font-medium"
            onClick={() => navigate({ to: '/instellingen/data-bronnen/$entityType/$entityCode',
              params: { entityType: 'landelijk', entityCode: landelijk.entity_code } })}
          >
            {landelijk.entity_naam}
          </button>
        )}
        {provinces.map((p) => (
          <button key={p.entity_code}
            className="px-4 py-2 rounded-full bg-white/60 backdrop-blur-[24px] text-[13px]"
            onClick={() => navigate({ to: '/instellingen/data-bronnen/$entityType/$entityCode',
              params: { entityType: 'provincie', entityCode: p.entity_code } })}
          >
            {p.entity_naam}
          </button>
        ))}
      </div>
      <div>
        <h3 className="text-[13px] font-semibold text-slate-500 mb-2">Gemeente</h3>
        <GemeentePicker />
      </div>
    </div>
  )
}
```

(If `GemeentePicker` doesn't self-navigate, check its props and pass an `onSelect` that navigates to `/instellingen/data-bronnen/gemeente/$code` — see Task 7's redirect.)

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'ScopePicker' || echo clean`
Expected: `clean`.

```bash
git add frontend/src/components/settings/data-bronnen/ScopePicker.tsx
git commit -m "feat: ScopePicker (Landelijk/Provincie/Gemeente switcher)"
```

---

### Task 7: Generalized scope route + redirect old gemeente URL + index uses ScopePicker

**Files:**
- Create: `frontend/src/routes/_authenticated/instellingen.data-bronnen.$entityType.$entityCode.tsx`
- Modify: `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx`
- Modify: `frontend/src/routes/_authenticated/instellingen.data-bronnen.index.tsx`

- [ ] **Step 1: Create the generalized scope page**

Model it on the existing `$gemeenteCode` page. For `entityType === 'gemeente'`, reuse `useGemeenteDataSources(entityCode)` + the existing A/B/C section render (move the page body into a shared `GemeenteSourcesView` if convenient). For `landelijk`/`provincie`, use `useScopeDataSources(entityType, entityCode)` and render ONLY the `cascade_uploads` section with `DataSourceSection` (no APIs/paid). Reuse `VersionHistoryPanel` + `UploadDocumentModal` + the `handleViewVersion`/`handleDownloadVersion` handlers (already in the gemeente page — extract into a small hook `usePolicyDocActions()` in the same file and reuse).

```tsx
export const Route = createFileRoute(
  '/_authenticated/instellingen/data-bronnen/$entityType/$entityCode',
)({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.is_superuser) throw redirect({ to: '/instellingen' })
  },
  component: ScopeDataSourcesPage,
})
```

`ScopeDataSourcesPage` branches on `entityType`. Both branches render `<ScopePicker />` at top so the user can switch scope.

- [ ] **Step 2: Convert the old `$gemeenteCode` route to a redirect**

Replace its `beforeLoad`/component with a redirect to the generalized route:

```tsx
export const Route = createFileRoute(
  '/_authenticated/instellingen/data-bronnen/$gemeenteCode',
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/instellingen/data-bronnen/$entityType/$entityCode',
      params: { entityType: 'gemeente', entityCode: params.gemeenteCode },
    })
  },
})
```

(Keep the `GM\d{4}` `parseParams` guard so non-matching codes still 404 rather than redirect-loop.)

- [ ] **Step 3: Index renders ScopePicker**

In `instellingen.data-bronnen.index.tsx`, replace the bare `GemeentePicker` with `<ScopePicker />`.

- [ ] **Step 4: Type-check + manual smoke**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'data-bronnen' || echo clean` → `clean`.
Start dev server, log in as superuser, visit `/instellingen/data-bronnen`: scope buttons render; click Landelijk → type-A doc rows only; click a gemeente → full A/B/C; old `/instellingen/data-bronnen/GM0983` redirects to `…/gemeente/GM0983`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/_authenticated/instellingen.data-bronnen.*.tsx
git commit -m "feat: generalized data-bronnen scope route + gemeente redirect + ScopePicker on index"
```

---

## Phase 3 — Retire beleid-beheer

### Task 8: Remove beleid-beheer, repoint links

**Files:**
- Delete: `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx`
- Delete: `frontend/src/components/settings/beleid/InstellingenBeleidPage.tsx`
- Modify: `frontend/src/components/settings/SettingsTabNav.tsx`
- Modify: `frontend/src/components/settings/data-bronnen/DataSourcesEmptyState.tsx`

- [ ] **Step 1: Confirm no other importers**

Run: `cd frontend && grep -rn "InstellingenBeleidPage\|beleid-beheer" src/ | grep -v "InstellingenBeleidPage.tsx\|instellingen.beleid-beheer.tsx"`
Expected: only `SettingsTabNav.tsx` + `DataSourcesEmptyState.tsx`. If anything else references them, repoint it too.

- [ ] **Step 2: Delete the route + page**

```bash
git rm frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx \
       frontend/src/components/settings/beleid/InstellingenBeleidPage.tsx
```

- [ ] **Step 3: Remove the SettingsTabNav entry**

In `SettingsTabNav.tsx` delete the `isBeleidActive` const (line ~11) and the `<Link to="/instellingen/beleid-beheer" …>` tab (line ~69). Leave the Data-bronnen tab.

- [ ] **Step 4: Repoint the empty-state link**

In `DataSourcesEmptyState.tsx` change the `to="/instellingen/beleid-beheer"` link (line ~35) to `to="/instellingen/data-bronnen"` (or remove the link if it now points at its own page).

- [ ] **Step 5: Verify routes regenerate + type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'beleid-beheer|InstellingenBeleidPage' || echo clean`
Expected: `clean` (no dangling refs). If TanStack route tree is generated, run the dev/build once so `routeTree.gen.ts` drops the deleted route.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/components/settings frontend/src/routes
git commit -m "refactor: retire beleid-beheer tab (consolidated into Data-bronnen)"
```

---

### Task 9: Full verification

- [ ] **Step 1: Backend checks**

Run: `cd backend && ruff check app/ && .venv/bin/python -m pytest tests/unit/test_data_source_keys_levels.py tests/integration/test_admin_data_sources_scope.py tests/integration/test_admin_data_sources_router.py -q`
Expected: ruff clean; all tests PASS.

- [ ] **Step 2: Frontend check**

Run: `cd frontend && npm run check 2>&1 | tail -5`
Expected: no NEW errors versus the pre-existing framer-motion `ease` baseline (none in the files this plan touched).

- [ ] **Step 3: Manual E2E (superuser)**

Verify against spec success criteria: scope switcher works; L/P show type-A rows with upload/version/view/download; gemeente unchanged (A/B/C); old `GM####` URL redirects; `/beleid` hub still loads from SideRailNav; no dead links to beleid-beheer.

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git add -A && git commit -m "chore: data-bronnen scope consolidation — final verification"
```

---

## Self-Review

- **Spec coverage:** scope switcher (Tasks 6-7) ✓; L/P document-only via live type-A status (Tasks 2-4) ✓; no migration (Task 3 uses live status, no `DataSourceStatus` writes for L/P) ✓; gemeente unchanged (Task 7 reuses existing hook/render; existing tests stay green) ✓; beleid-beheer retired + redirect + repointed links (Tasks 7-8) ✓; `/beleid` untouched (not referenced) ✓; testing (Tasks 1,2,4,9) ✓.
- **Placeholder scan:** all steps have concrete code/commands. Task 7 step 1 references reusing the existing gemeente page body — the executor copies from the current `$gemeenteCode` page (provided in repo) rather than inventing.
- **Type consistency:** `level` field name consistent across catalog + helper + tests; `probe_type_a_for_entity` signature consistent (Tasks 2,3); `ScopeDataSourcesPayload`/`ScopeOption` consistent across backend schema + frontend types + hooks.
- **Known detail resolved:** landelijk `entity_code = "NL"`; provinces from `GemeenteProvincieMap` with hardcoded PVxx names.

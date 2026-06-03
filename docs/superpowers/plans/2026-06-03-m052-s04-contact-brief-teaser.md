# M052/S04 Contact Brief-teaser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In de Contact-fase een gepersonaliseerde acquisitiebrief genereren uit echte data (rechtspersoon-eigenaar auto-gevuld, particulier handmatig) met een fake PostNL-send achter `hauzer_demo`, gebouwd voor een 1-op-1 M051-swap.

**Architecture:** Backend krijgt afzender-velden op `Organization` (gespiegeld op het bestaande score-weights-settings-patroon), een brief-genereer-endpoint dat scan-data + projecttype + org-afzender + (indien aanwezig) een rechtspersoon/overheid-BRK-record in de bestaande `document_generator.generate_document()` voert, en een send-endpoint achter een `BriefDispatcher`-interface (`FakeBriefDispatcher` nu, `PostNLBriefDispatcher` in M051). Frontend krijgt een `BriefCard` in `ContactPhaseView` met auto/handmatige modus + Versturen-actie gated op `hauzer_demo`.

**Tech Stack:** FastAPI · SQLAlchemy 2.x (`Mapped`/`mapped_column`) · Alembic · Pydantic v2 · pytest (async httpx) · React + TanStack Router + React Query + Tailwind v4 (Aura) · vitest (unit project).

**Spec:** `docs/superpowers/specs/2026-06-03-m052-s04-contact-brief-teaser-design.md`

**Plan-tijd afwijkingen t.o.v. spec (geverifieerd tegen codebase):**
1. Geen BRK-respons-uitbreiding. Het brief-endpoint leest gepersisteerde records via `read_for_parcel`; leeg → `mode: 'manual'`. Geen wijziging aan de gedeelde BRK-endpoint.
2. `projecttype` via `parcel_project_type_service.get_project_type()` (apart model) + mapping naar template-`use_case` + `_best_use_case`-fallback.
3. Afzender-settings spiegelen `/api/users/org/score-weights` in `app/users/router.py`; frontend vervangt de read-only `CompanySection`-placeholder.

---

## File Structure

**Backend (nieuw):**
- `backend/alembic/versions/20260603_m052_s04_add_org_afzender.py` — afzender-kolommen op `organizations`
- `backend/alembic/versions/20260603_m052_s04_create_brief_dispatches.py` — dispatch-metadata-tabel
- `backend/app/models/brief_dispatch.py` — `BriefDispatch` model
- `backend/app/schemas/brief.py` — request/response schemas (afzender + brief + send)
- `backend/app/services/brief_context.py` — perceel→`generate_document`-context assembler + `project_type→use_case`-map
- `backend/app/services/brief_dispatcher.py` — `BriefDispatcher` protocol + `FakeBriefDispatcher` + resolver
- `backend/app/api/endpoints/brief_router.py` — `POST /api/parcels/{id}/brief` + `POST /api/parcels/{id}/brief/send`
- `backend/tests/integration/test_brief_router.py` — endpoint-tests
- `backend/tests/unit/test_brief_context.py` — context/mapping-tests

**Backend (gewijzigd):**
- `backend/app/models/organization.py` — 4 afzender-velden
- `backend/app/users/router.py` — `GET`/`PATCH /org/afzender`
- `backend/app/users/schemas.py` (of waar `ScoreWeightsResponse` staat) — `AfzenderResponse`/`AfzenderUpdate`
- `backend/app/main.py` — `include_router(brief_router)`

**Frontend (nieuw):**
- `frontend/src/hooks/useBrief.ts` — `useGenerateBrief` + `useSendBrief` + `useAfzender`/`useSaveAfzender`
- `frontend/src/components/lifecycle/BriefCard.tsx` — preview-card (auto/manual) + Versturen
- `frontend/src/components/lifecycle/deriveBriefMode.ts` — pure mode-derivatie (unit-getest)
- `frontend/src/components/settings/AfzenderSection.tsx` — afzender-formulier (vervangt placeholder)
- `frontend/src/components/lifecycle/__tests__/deriveBriefMode.test.ts` — unit-test

**Frontend (gewijzigd):**
- `frontend/src/components/lifecycle/ContactPhaseView.tsx` — mount `BriefCard`
- `frontend/src/routes/_authenticated/instellingen.index.tsx` (of waar `CompanySection` zit) — `AfzenderSection` i.p.v. placeholder

---

## Task 1: Organization afzender-kolommen (migratie)

**Files:**
- Create: `backend/alembic/versions/20260603_m052_s04_add_org_afzender.py`

- [ ] **Step 0: Bevestig de huidige head**

Run: `cd backend && alembic heads`
Zet `down_revision` hieronder op de werkelijke head (hier aangenomen `20260521_m052_s01`; corrigeer als `alembic heads` iets nieuwers toont).

- [ ] **Step 1: Schrijf de migratie**

```python
"""M052/S04 add organizations afzender-velden

Revision ID: 20260603_m052_s04_afz
Revises: 20260521_m052_s01
Create Date: 2026-06-03 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = "20260603_m052_s04_afz"
down_revision = "20260521_m052_s01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("afzender_adres", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("contactpersoon", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("contact_email", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("contact_telefoon", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "contact_telefoon")
    op.drop_column("organizations", "contact_email")
    op.drop_column("organizations", "contactpersoon")
    op.drop_column("organizations", "afzender_adres")
```

- [ ] **Step 2: Pas de migratie toe**

Run: `cd backend && alembic upgrade head`
Expected: `Running upgrade 20260521_m052_s01 -> 20260603_m052_s04_afz`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/20260603_m052_s04_add_org_afzender.py
git commit -m "M052/S04: migratie — organizations afzender-velden"
```

---

## Task 2: Organization model + afzender-schemas

**Files:**
- Modify: `backend/app/models/organization.py`
- Modify: `backend/app/users/schemas.py`

- [ ] **Step 1: Voeg de velden toe aan het model**

In `backend/app/models/organization.py`, na `hauzer_demo`:

```python
    afzender_adres: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    contactpersoon: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    contact_telefoon: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
```

(Gebruik de bestaande `sa`/`Text`-import-stijl van het bestand.)

- [ ] **Step 2: Voeg de Pydantic-schemas toe**

In `backend/app/users/schemas.py`:

```python
class AfzenderResponse(BaseModel):
    bedrijfsnaam: str
    afzender_adres: str | None = None
    contactpersoon: str | None = None
    contact_email: str | None = None
    contact_telefoon: str | None = None


class AfzenderUpdate(BaseModel):
    afzender_adres: str | None = None
    contactpersoon: str | None = None
    contact_email: str | None = None
    contact_telefoon: str | None = None
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/organization.py backend/app/users/schemas.py
git commit -m "M052/S04: afzender-velden op Organization + schemas"
```

---

## Task 3: Afzender GET/PATCH endpoint

**Files:**
- Modify: `backend/app/users/router.py`
- Test: `backend/tests/integration/test_afzender_endpoint.py`

- [ ] **Step 1: Schrijf de falende test**

```python
import pytest
from app.auth.jwt import create_access_token  # gebruik de helper uit test_dashboard_router.py
from tests.conftest import create_test_user


@pytest.mark.asyncio
async def test_get_afzender_defaults_to_org_name(async_client, test_db):
    user, org = await create_test_user(email="a@x.nl", org_name="Hauzer Vastgoed")
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.get("/api/users/org/afzender", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["bedrijfsnaam"] == "Hauzer Vastgoed"
    assert body["afzender_adres"] is None


@pytest.mark.asyncio
async def test_patch_afzender_persists(async_client, test_db):
    user, org = await create_test_user(email="b@x.nl", org_name="Hauzer Vastgoed")
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.patch(
        "/api/users/org/afzender",
        headers=headers,
        json={"afzender_adres": "Postbus 412, 5900 AK Venlo", "contact_email": "info@hauzer.nl"},
    )
    assert r.status_code == 200
    assert r.json()["afzender_adres"] == "Postbus 412, 5900 AK Venlo"
    r2 = await async_client.get("/api/users/org/afzender", headers=headers)
    assert r2.json()["contact_email"] == "info@hauzer.nl"
```

(Verifieer de exacte `create_access_token`-import + `create_test_user`-signatuur in `backend/tests/integration/test_dashboard_router.py` en spiegel die precies.)

- [ ] **Step 2: Run — verwacht FAIL**

Run: `cd backend && pytest tests/integration/test_afzender_endpoint.py -q`
Expected: FAIL (404 — route bestaat niet)

- [ ] **Step 3: Implementeer de endpoints**

In `backend/app/users/router.py` (spiegel het `get_score_weights`/`save_score_weights`-patroon):

```python
from app.models.organization import Organization
from app.users.schemas import AfzenderResponse, AfzenderUpdate


@router.get("/org/afzender", response_model=AfzenderResponse)
async def get_afzender(
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> AfzenderResponse:
    org = (await db.execute(select(Organization).where(Organization.id == organization_id))).scalar_one()
    return AfzenderResponse(
        bedrijfsnaam=org.name,
        afzender_adres=org.afzender_adres,
        contactpersoon=org.contactpersoon,
        contact_email=org.contact_email,
        contact_telefoon=org.contact_telefoon,
    )


@router.patch("/org/afzender", response_model=AfzenderResponse)
async def update_afzender(
    data: AfzenderUpdate,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> AfzenderResponse:
    org = (await db.execute(select(Organization).where(Organization.id == organization_id))).scalar_one()
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return AfzenderResponse(
        bedrijfsnaam=org.name,
        afzender_adres=org.afzender_adres,
        contactpersoon=org.contactpersoon,
        contact_email=org.contact_email,
        contact_telefoon=org.contact_telefoon,
    )
```

(Verifieer dat `select`, `Depends`, `get_current_active_user`, `get_current_organization_id`, `get_db`, `AsyncSession`, `uuid` al geïmporteerd zijn in het bestand; zo niet, voeg toe.)

- [ ] **Step 4: Run — verwacht PASS**

Run: `cd backend && pytest tests/integration/test_afzender_endpoint.py -q`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/users/router.py backend/tests/integration/test_afzender_endpoint.py
git commit -m "M052/S04: GET/PATCH /org/afzender endpoint (TDD)"
```

---

## Task 4: project_type→use_case mapping + brief-context assembler

**Files:**
- Create: `backend/app/services/brief_context.py`
- Test: `backend/tests/unit/test_brief_context.py`

- [ ] **Step 1: Schrijf de falende test**

```python
from app.services.brief_context import project_type_to_use_case, build_brief_parcel_data


def test_project_type_maps_to_template_use_case():
    assert project_type_to_use_case("optoppen") == "optoppen"
    assert project_type_to_use_case("splitsen") == "splitsen"
    assert project_type_to_use_case("transformatie_wonen") == "transformatie"
    assert project_type_to_use_case("commercieel_naar_wonen") == "transformatie"
    assert project_type_to_use_case("nieuwbouw_wonen") == "nieuwbouw"
    assert project_type_to_use_case("onbepaald") is None


def test_build_parcel_data_shapes_for_generate_document():
    data = build_brief_parcel_data(
        address="Kazernestraat 12",
        gemeente_naam="Venlo",
        overall_score=83.0,
        use_case="optoppen",
    )
    assert data["address"] == "Kazernestraat 12"
    assert data["gemeente_naam"] == "Venlo"
    assert data["scores"]["overall"] == 83.0
    # _build_template_context leest use_case uit user_context, niet parcel_data;
    # build_brief_parcel_data levert alleen de perceel-kant.
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `cd backend && pytest tests/unit/test_brief_context.py -q`
Expected: FAIL (module bestaat niet)

- [ ] **Step 3: Implementeer**

```python
"""M052/S04 — brief-context: perceel-data + project_type→use_case-mapping."""
from typing import Any

# parcel_project_types levert deze project_type-waarden; map naar de
# use_case-takken van EIGENAAR_BRIEF_TEMPLATE (optoppen/splitsen/transformatie/nieuwbouw).
_PROJECT_TYPE_TO_USE_CASE: dict[str, str] = {
    "optoppen": "optoppen",
    "splitsen": "splitsen",
    "transformatie_wonen": "transformatie",
    "commercieel_naar_wonen": "transformatie",
    "nieuwbouw_wonen": "nieuwbouw",
}


def project_type_to_use_case(project_type: str | None) -> str | None:
    """Map een parcel project_type naar de template-use_case; None bij 'onbepaald'/onbekend."""
    if not project_type:
        return None
    return _PROJECT_TYPE_TO_USE_CASE.get(project_type)


def build_brief_parcel_data(
    *,
    address: str | None,
    gemeente_naam: str | None,
    overall_score: float | None,
    use_case: str | None,
) -> dict[str, Any]:
    """Bouw de parcel_data-dict die document_generator.generate_document verwacht."""
    return {
        "address": address or "Adres onbekend",
        "gemeente_naam": gemeente_naam or "",
        "scores": {"overall": overall_score} if overall_score is not None else {},
        # use_case wordt via user_context doorgegeven (zie brief_router), niet hier.
    }
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `cd backend && pytest tests/unit/test_brief_context.py -q`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/brief_context.py backend/tests/unit/test_brief_context.py
git commit -m "M052/S04: brief-context assembler + project_type→use_case map (TDD)"
```

---

## Task 5: Brief-genereer-endpoint

**Files:**
- Create: `backend/app/schemas/brief.py`
- Create: `backend/app/api/endpoints/brief_router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/integration/test_brief_router.py`

- [ ] **Step 1: Schrijf de schemas**

In `backend/app/schemas/brief.py`:

```python
from pydantic import BaseModel


class Addressee(BaseModel):
    eigenaar_aanhef: str | None = None
    eigenaar_adres: str | None = None


class GenerateBriefRequest(BaseModel):
    addressee: Addressee | None = None  # handmatige NAW (particulier-modus)


class GenerateBriefResponse(BaseModel):
    markdown: str
    mode: str  # 'auto' (rechtspersoon/overheid) | 'manual' (geen record)


class SendBriefResponse(BaseModel):
    status: str  # 'verzonden'
    sent_at: str
```

- [ ] **Step 2: Schrijf de falende test**

```python
import pytest
from app.auth.jwt import create_access_token
from tests.conftest import create_test_user


@pytest.mark.asyncio
async def test_generate_brief_manual_mode_when_no_brk(async_client, test_db):
    user, org = await create_test_user(email="g@x.nl", org_name="Hauzer Vastgoed")
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.post(
        "/api/parcels/NL.IMKAD.TEST.1/brief",
        headers=headers,
        json={"addressee": {"eigenaar_aanhef": "Geachte heer Janssen", "eigenaar_adres": "Kazernestraat 12, Venlo"}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "manual"
    assert "Hauzer Vastgoed" in body["markdown"]
    assert "Geachte heer Janssen" in body["markdown"]
```

- [ ] **Step 3: Run — verwacht FAIL**

Run: `cd backend && pytest tests/integration/test_brief_router.py -q`
Expected: FAIL (404)

- [ ] **Step 4: Implementeer het endpoint**

In `backend/app/api/endpoints/brief_router.py`:

```python
"""M052/S04 — Contact brief-teaser endpoints (genereer + fake-send)."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.models.user import User
from app.schemas.brief import GenerateBriefRequest, GenerateBriefResponse
from app.services import brief_context
from app.services.brk_read_service import read_for_parcel
from app.services.document_generator import generate_document
from app.services.parcel_project_type_service import get_project_type

router = APIRouter(prefix="/api/parcels", tags=["Brief"])


async def _load_parcel_facts(
    db: AsyncSession, parcel_id: str
) -> tuple[str | None, str | None, float | None]:
    """Adres, gemeente_naam, potentie-score voor een parcel (laatste scan).

    Spiegelt de kansen-query in `app/api/endpoints/dashboard.py:get_kansen`
    (regels 112-157), maar gefilterd op één `parcel_id` i.p.v. gemeente-breed.
    `potentie` is hier de juiste score: de brief-template zegt
    "scoort {{ score }}/100 op ontwikkelpotentieel".

    Returnt (None, None, None) als er geen scan/cache voor het perceel is.
    """
    ranked = (
        select(
            ScanResult.parcel_id.label("parcel_id"),
            ScanResult.flags["scores"]["potentie"].as_float().label("potentie"),
            AreaScan.gemeente_naam.label("gemeente_naam"),
            func.row_number()
            .over(
                partition_by=ScanResult.parcel_id,
                order_by=AreaScan.created_at.desc(),
            )
            .label("rn"),
        )
        # Mirror de exacte ScanResult↔AreaScan join-kolom uit dashboard.get_kansen
        # (regel ~118) — pas dezelfde join-conditie hier toe.
        .join(AreaScan, ScanResult.scan_id == AreaScan.id)
        .where(ScanResult.parcel_id == parcel_id)
        .subquery()
    )
    row = (
        await db.execute(
            select(
                ParcelCache.address,
                ranked.c.gemeente_naam,
                ranked.c.potentie,
            )
            .join(ranked, ranked.c.parcel_id == ParcelCache.parcel_id)
            .where(ranked.c.rn == 1)
        )
    ).first()
    if row is None:
        return None, None, None
    return row.address, row.gemeente_naam, row.potentie


@router.post("/{parcel_id}/brief", response_model=GenerateBriefResponse)
async def generate_brief(
    parcel_id: str,
    payload: GenerateBriefRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> GenerateBriefResponse:
    org = (await db.execute(select(Organization).where(Organization.id == organization_id))).scalar_one()

    # 1. Eigenaar-modus: rechtspersoon/overheid uit BRK → auto; anders manual.
    brk = await read_for_parcel(db=db, organization_id=organization_id, parcel_id=parcel_id)
    mode = "auto" if brk else "manual"

    # 2. project_type → use_case (fallback laat de template de else-tak nemen).
    pt = await get_project_type(db, parcel_id=parcel_id, organization_id=organization_id)
    use_case = brief_context.project_type_to_use_case(pt.project_type)

    # 3. Perceel-facts.
    address, gemeente_naam, overall = await _load_parcel_facts(db, parcel_id)
    parcel_data = brief_context.build_brief_parcel_data(
        address=address, gemeente_naam=gemeente_naam, overall_score=overall, use_case=use_case,
    )

    # 4. user_context: afzender + eigenaar (auto: uit BRK; manual: uit payload.addressee).
    user_context: dict = {
        "use_case": use_case,
        "bedrijfsnaam": org.name,
        "bedrijfsadres": org.afzender_adres or "[Uw bedrijfsadres]",
        "contactpersoon": org.contactpersoon or "[Uw naam]",
        "contact_email": org.contact_email or "[uw@email.nl]",
        "contact_telefoon": org.contact_telefoon or "[uw telefoonnummer]",
    }
    if mode == "auto":
        rec = brk[0]
        user_context["eigenaar_aanhef"] = f"Geachte {rec.eigenaar_naam}"
        user_context["eigenaar_adres"] = rec.statutaire_zetel or ""
    elif payload.addressee:
        if payload.addressee.eigenaar_aanhef:
            user_context["eigenaar_aanhef"] = payload.addressee.eigenaar_aanhef
        if payload.addressee.eigenaar_adres:
            user_context["eigenaar_adres"] = payload.addressee.eigenaar_adres

    markdown = generate_document("eigenaar_brief", parcel_data, user_context) or ""
    return GenerateBriefResponse(markdown=markdown, mode=mode)
```

Implementeer `_load_parcel_facts` door de join uit `dashboard.get_kansen` te kopiëren (ScanResult+AreaScan ROW_NUMBER latest → ParcelCache), gefilterd op `parcel_id`.

- [ ] **Step 5: Registreer de router**

In `backend/app/main.py`, bij de andere `include_router`-regels:

```python
from app.api.endpoints.brief_router import router as brief_router
app.include_router(brief_router)
```

- [ ] **Step 6: Run — verwacht PASS**

Run: `cd backend && pytest tests/integration/test_brief_router.py -q`
Expected: 1 passed

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/brief.py backend/app/api/endpoints/brief_router.py backend/app/main.py backend/tests/integration/test_brief_router.py
git commit -m "M052/S04: brief-genereer-endpoint (auto/manual, TDD)"
```

---

## Task 6: Auto-modus test (rechtspersoon-record)

**Files:**
- Modify: `backend/tests/integration/test_brief_router.py`

- [ ] **Step 1: Voeg de auto-modus-test toe**

```python
@pytest.mark.asyncio
async def test_generate_brief_auto_mode_with_rechtspersoon(async_client, test_db):
    from app.models.brk_ownership_record import BRKOwnershipRecord
    from datetime import datetime
    user, org = await create_test_user(email="auto@x.nl", org_name="Hauzer Vastgoed")
    rec = BRKOwnershipRecord(
        organization_id=org.id, parcel_id="NL.IMKAD.TEST.2",
        eigenaar_type="rechtspersoon", eigenaar_naam="Vastgoed BV",
        statutaire_zetel="Industrieweg 5, Venlo", heeft_hypotheek=False,
        fetched_at=datetime.utcnow(),
    )
    test_db.add(rec)
    await test_db.commit()
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.post("/api/parcels/NL.IMKAD.TEST.2/brief", headers=headers, json={})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "auto"
    assert "Vastgoed BV" in body["markdown"]
```

(Verifieer de exacte verplichte velden van `BRKOwnershipRecord` in het model; vul aan indien nodig.)

- [ ] **Step 2: Run — verwacht PASS**

Run: `cd backend && pytest tests/integration/test_brief_router.py -q`
Expected: 2 passed

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/test_brief_router.py
git commit -m "M052/S04: brief auto-modus test (rechtspersoon)"
```

---

## Task 7: BriefDispatcher + FakeBriefDispatcher (M051-naad)

**Files:**
- Create: `backend/app/services/brief_dispatcher.py`
- Test: `backend/tests/unit/test_brief_dispatcher.py`

- [ ] **Step 1: Schrijf de falende test**

```python
from app.services.brief_dispatcher import FakeBriefDispatcher, resolve_dispatcher


def test_fake_dispatcher_returns_verzonden():
    d = FakeBriefDispatcher()
    result = d.dispatch(markdown="brief", parcel_id="X")
    assert result.status == "verzonden"
    assert result.sent_at  # ISO-string aanwezig


def test_resolver_returns_fake_for_hauzer_demo():
    assert isinstance(resolve_dispatcher(hauzer_demo=True), FakeBriefDispatcher)
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `cd backend && pytest tests/unit/test_brief_dispatcher.py -q`
Expected: FAIL (module bestaat niet)

- [ ] **Step 3: Implementeer**

```python
"""M052/S04 — brief-dispatch met M051-naad.

FakeBriefDispatcher = demo-shim. M051 voegt PostNLBriefDispatcher (zelfde Protocol)
toe en breidt resolve_dispatcher uit; het send-endpoint + de persistence blijven gelijk.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class DispatchResult:
    status: str
    sent_at: str


class BriefDispatcher(Protocol):
    def dispatch(self, *, markdown: str, parcel_id: str) -> DispatchResult: ...


class FakeBriefDispatcher:
    """Demo-shim: doet niets echts, bevestigt 'verzonden'."""

    def dispatch(self, *, markdown: str, parcel_id: str) -> DispatchResult:
        return DispatchResult(status="verzonden", sent_at=datetime.utcnow().isoformat())


def resolve_dispatcher(*, hauzer_demo: bool) -> BriefDispatcher:
    # M051: return PostNLBriefDispatcher() wanneer postnl_enabled, anders Fake.
    return FakeBriefDispatcher()
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `cd backend && pytest tests/unit/test_brief_dispatcher.py -q`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/brief_dispatcher.py backend/tests/unit/test_brief_dispatcher.py
git commit -m "M052/S04: BriefDispatcher + FakeBriefDispatcher (M051-naad, TDD)"
```

---

## Task 8: brief_dispatches model + migratie

**Files:**
- Create: `backend/app/models/brief_dispatch.py`
- Create: `backend/alembic/versions/20260603_m052_s04_create_brief_dispatches.py`

- [ ] **Step 1: Schrijf het model**

```python
"""M052/S04 — dispatch-metadata (GEEN brief-inhoud → geen PII-opslag)."""
import uuid
from datetime import datetime

from sqlalchemy import Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BriefDispatch(Base):
    __tablename__ = "brief_dispatches"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    parcel_id: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    template_id: Mapped[str] = mapped_column(String(64), nullable=False)
    dispatcher: Mapped[str] = mapped_column(String(32), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(nullable=False)

    __table_args__ = (Index("ix_brief_dispatches_org_parcel", "organization_id", "parcel_id"),)
```

(Verifieer de exacte `Base`/`PGUUID`-import-conventie tegen een bestaand model, bijv. `brk_ownership_record.py`, en spiegel die.)

- [ ] **Step 2: Schrijf de migratie**

```python
"""M052/S04 create brief_dispatches

Revision ID: 20260603_m052_s04_disp
Revises: 20260603_m052_s04_afz
Create Date: 2026-06-03 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260603_m052_s04_disp"
down_revision = "20260603_m052_s04_afz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brief_dispatches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parcel_id", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("template_id", sa.String(64), nullable=False),
        sa.Column("dispatcher", sa.String(32), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_brief_dispatches_org_parcel", "brief_dispatches", ["organization_id", "parcel_id"])


def downgrade() -> None:
    op.drop_index("ix_brief_dispatches_org_parcel", table_name="brief_dispatches")
    op.drop_table("brief_dispatches")
```

- [ ] **Step 3: Pas toe**

Run: `cd backend && alembic upgrade head`
Expected: upgrade naar `20260603_m052_s04_disp`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/brief_dispatch.py backend/alembic/versions/20260603_m052_s04_create_brief_dispatches.py
git commit -m "M052/S04: brief_dispatches model + migratie (metadata-only)"
```

---

## Task 9: Send-endpoint (gated op hauzer_demo)

**Files:**
- Modify: `backend/app/api/endpoints/brief_router.py`
- Modify: `backend/tests/integration/test_brief_router.py`

- [ ] **Step 1: Schrijf de falende tests**

```python
@pytest.mark.asyncio
async def test_send_brief_blocked_without_hauzer_demo(async_client, test_db):
    user, org = await create_test_user(email="s1@x.nl", org_name="Geen Demo")
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.post("/api/parcels/NL.IMKAD.TEST.3/brief/send", headers=headers, json={"markdown": "x"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_send_brief_fake_verzonden_with_hauzer_demo(async_client, test_db):
    user, org = await create_test_user(email="s2@x.nl", org_name="Hauzer Demo")
    org.hauzer_demo = True
    test_db.add(org)
    await test_db.commit()
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.post("/api/parcels/NL.IMKAD.TEST.3/brief/send", headers=headers, json={"markdown": "x"})
    assert r.status_code == 200
    assert r.json()["status"] == "verzonden"
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `cd backend && pytest tests/integration/test_brief_router.py -q -k send`
Expected: FAIL (404)

- [ ] **Step 3: Implementeer het send-endpoint**

Voeg toe aan `brief_router.py`:

```python
from fastapi import HTTPException
from app.models.brief_dispatch import BriefDispatch
from app.schemas.brief import SendBriefResponse
from app.services.brief_dispatcher import resolve_dispatcher
from pydantic import BaseModel


class SendBriefRequest(BaseModel):
    markdown: str


@router.post("/{parcel_id}/brief/send", response_model=SendBriefResponse)
async def send_brief(
    parcel_id: str,
    payload: SendBriefRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> SendBriefResponse:
    org = (await db.execute(select(Organization).where(Organization.id == organization_id))).scalar_one()
    if not org.hauzer_demo:
        raise HTTPException(status_code=403, detail="Versturen alleen beschikbaar in demo-modus")

    dispatcher = resolve_dispatcher(hauzer_demo=org.hauzer_demo)
    result = dispatcher.dispatch(markdown=payload.markdown, parcel_id=parcel_id)

    # Persisteer alléén metadata — geen brief-inhoud (geen PII-opslag).
    db.add(BriefDispatch(
        organization_id=organization_id, parcel_id=parcel_id,
        status=result.status, template_id="eigenaar_brief",
        dispatcher="fake", sent_at=datetime.utcnow(),
    ))
    await db.commit()
    return SendBriefResponse(status=result.status, sent_at=result.sent_at)
```

(Voeg `from datetime import datetime` toe bovenin `brief_router.py`.)

- [ ] **Step 4: Run — verwacht PASS**

Run: `cd backend && pytest tests/integration/test_brief_router.py -q`
Expected: alle brief-tests passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/endpoints/brief_router.py backend/tests/integration/test_brief_router.py
git commit -m "M052/S04: brief send-endpoint (fake dispatch, hauzer_demo-gate, TDD)"
```

---

## Task 10: Backend-verificatie

- [ ] **Step 1: Run alle backend-checks**

Run: `cd backend && ruff check . && mypy . && pytest tests/unit/test_brief_context.py tests/unit/test_brief_dispatcher.py tests/integration/test_brief_router.py tests/integration/test_afzender_endpoint.py -q`
Expected: ruff clean, mypy clean, alle tests passed

- [ ] **Step 2: Fix wat faalt, daarna commit indien nodig**

```bash
git commit -am "M052/S04: backend lint/type fixes" || true
```

---

## Task 11: Frontend — afzender-hook + AfzenderSection

**Files:**
- Create: `frontend/src/hooks/useBrief.ts`
- Create: `frontend/src/components/settings/AfzenderSection.tsx`
- Modify: `frontend/src/routes/_authenticated/instellingen.index.tsx`

- [ ] **Step 1: Schrijf de afzender-hooks**

In `frontend/src/hooks/useBrief.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'

export interface Afzender {
  bedrijfsnaam: string
  afzender_adres: string | null
  contactpersoon: string | null
  contact_email: string | null
  contact_telefoon: string | null
}

export function useAfzender() {
  const { accessToken } = useAuth()
  return useQuery<Afzender, Error>({
    queryKey: ['afzender'],
    queryFn: () => apiFetch<Afzender>('/api/users/org/afzender', { method: 'GET', accessToken }),
    enabled: !!accessToken,
  })
}

export function useSaveAfzender() {
  const { accessToken } = useAuth()
  const qc = useQueryClient()
  return useMutation<Afzender, Error, Partial<Omit<Afzender, 'bedrijfsnaam'>>>({
    mutationFn: (patch) =>
      apiFetch<Afzender>('/api/users/org/afzender', {
        method: 'PATCH', body: JSON.stringify(patch), accessToken,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['afzender'] }),
  })
}
```

- [ ] **Step 2: Schrijf AfzenderSection (vervangt de read-only CompanySection-placeholder)**

In `frontend/src/components/settings/AfzenderSection.tsx` — gebruik de bestaande sectie-styling (`rounded-[24px] border border-[#EAEFEF] bg-white p-6`), vier invoervelden (adres, contactpersoon, e-mail, telefoon) + opslaan-knop die `useSaveAfzender` aanroept. `bedrijfsnaam` read-only tonen (= org `name`).

```typescript
import { useState, useEffect } from 'react'
import { useAfzender, useSaveAfzender } from '@/hooks/useBrief'

export function AfzenderSection() {
  const { data } = useAfzender()
  const save = useSaveAfzender()
  const [form, setForm] = useState({ afzender_adres: '', contactpersoon: '', contact_email: '', contact_telefoon: '' })
  useEffect(() => {
    if (data) setForm({
      afzender_adres: data.afzender_adres ?? '', contactpersoon: data.contactpersoon ?? '',
      contact_email: data.contact_email ?? '', contact_telefoon: data.contact_telefoon ?? '',
    })
  }, [data])
  return (
    <div className="rounded-[24px] border border-[#EAEFEF] bg-white p-6 space-y-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500">Briefhoofd / afzender</p>
      <p className="text-[12px] text-slate-500">Bedrijf: <b className="text-aura-ink">{data?.bedrijfsnaam ?? '—'}</b></p>
      {(['afzender_adres', 'contactpersoon', 'contact_email', 'contact_telefoon'] as const).map((f) => (
        <input key={f} value={form[f]} placeholder={f}
          onChange={(e) => setForm({ ...form, [f]: e.target.value })}
          className="w-full rounded-[12px] border border-[#EAEFEF] px-3 py-2 text-[13px]" />
      ))}
      <button onClick={() => save.mutate(form)} disabled={save.isPending}
        className="rounded-full bg-aura-obsidian px-4 py-2 text-[12px] font-semibold text-white">
        {save.isPending ? 'Opslaan…' : 'Opslaan'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Vervang de placeholder**

In `frontend/src/routes/_authenticated/instellingen.index.tsx`: vervang de read-only `CompanySection`-placeholder door `<AfzenderSection />` (verifieer de exacte naam/locatie; de placeholder zegt "binnenkort bewerkbaar").

- [ ] **Step 4: Run check**

Run: `cd frontend && npm run check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useBrief.ts frontend/src/components/settings/AfzenderSection.tsx frontend/src/routes/_authenticated/instellingen.index.tsx
git commit -m "M052/S04: afzender-instellingen UI + hooks"
```

---

## Task 12: Frontend — BriefCard mode-derivatie (unit)

**Files:**
- Create: `frontend/src/components/lifecycle/deriveBriefMode.ts`
- Test: `frontend/src/components/lifecycle/__tests__/deriveBriefMode.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```typescript
import { describe, expect, it } from 'vitest'
import { deriveBriefMode } from '../deriveBriefMode'

describe('deriveBriefMode', () => {
  it('auto wanneer rechtspersoon/overheid-record bestaat', () => {
    expect(deriveBriefMode({ hasBrkRecord: true })).toBe('auto')
  })
  it('manual wanneer geen record', () => {
    expect(deriveBriefMode({ hasBrkRecord: false })).toBe('manual')
  })
})
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `cd frontend && npx vitest run --project unit deriveBriefMode`
Expected: FAIL (module bestaat niet)

- [ ] **Step 3: Implementeer**

```typescript
export type BriefMode = 'auto' | 'manual'

export function deriveBriefMode(input: { hasBrkRecord: boolean }): BriefMode {
  return input.hasBrkRecord ? 'auto' : 'manual'
}
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `cd frontend && npx vitest run --project unit deriveBriefMode`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lifecycle/deriveBriefMode.ts frontend/src/components/lifecycle/__tests__/deriveBriefMode.test.ts
git commit -m "M052/S04: BriefCard mode-derivatie (TDD)"
```

---

## Task 13: Frontend — brief-hooks + BriefCard in ContactPhaseView

**Files:**
- Modify: `frontend/src/hooks/useBrief.ts`
- Create: `frontend/src/components/lifecycle/BriefCard.tsx`
- Modify: `frontend/src/components/lifecycle/ContactPhaseView.tsx`

- [ ] **Step 1: Voeg generate/send-hooks toe aan useBrief.ts**

```typescript
export interface BriefResult { markdown: string; mode: 'auto' | 'manual' }

export function useGenerateBrief(parcelId: string) {
  const { accessToken } = useAuth()
  return useMutation<BriefResult, Error, { eigenaar_aanhef?: string; eigenaar_adres?: string } | undefined>({
    mutationFn: (addressee) =>
      apiFetch<BriefResult>(`/api/parcels/${encodeURIComponent(parcelId)}/brief`, {
        method: 'POST', accessToken,
        body: JSON.stringify(addressee ? { addressee } : {}),
      }),
  })
}

export function useSendBrief(parcelId: string) {
  const { accessToken } = useAuth()
  return useMutation<{ status: string; sent_at: string }, Error, string>({
    mutationFn: (markdown) =>
      apiFetch(`/api/parcels/${encodeURIComponent(parcelId)}/brief/send`, {
        method: 'POST', accessToken, body: JSON.stringify({ markdown }),
      }),
  })
}
```

- [ ] **Step 2: Schrijf BriefCard**

In `frontend/src/components/lifecycle/BriefCard.tsx`: glass-card (`bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-6 mb-4`), heading "Persoonlijke brief". Roept `useGenerateBrief` aan; bij `mode === 'manual'` toont 't invulbare aanhef + adres-velden die opnieuw genereren triggeren. Toont de gerenderde markdown in een brief-opmaak-container. Knop **Versturen** is alléén zichtbaar als `user?.hauzer_demo`; bij klik `useSendBrief(markdown)` → toon "Verzonden ✓"-staat.

```typescript
import { useState } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { useBrkRecords } from '@/hooks/useBrkRecords'
import { useGenerateBrief, useSendBrief } from '@/hooks/useBrief'
import { deriveBriefMode } from './deriveBriefMode'

export function BriefCard({ parcelId }: { parcelId: string }) {
  const { user } = useAuth()
  const { data: records } = useBrkRecords(parcelId)
  const mode = deriveBriefMode({ hasBrkRecord: (records?.length ?? 0) > 0 })
  const gen = useGenerateBrief(parcelId)
  const send = useSendBrief(parcelId)
  const [aanhef, setAanhef] = useState('')
  const [adres, setAdres] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-6 mb-4">
      <h3 className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-3">Persoonlijke brief</h3>
      {mode === 'manual' && (
        <div className="space-y-2 mb-3">
          <input value={aanhef} onChange={(e) => setAanhef(e.target.value)} placeholder="Geachte heer/mevrouw …"
            className="w-full rounded-[12px] border border-[#EAEFEF] px-3 py-2 text-[13px]" />
          <input value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="NAW geadresseerde"
            className="w-full rounded-[12px] border border-[#EAEFEF] px-3 py-2 text-[13px]" />
        </div>
      )}
      <button onClick={() => gen.mutate(mode === 'manual' ? { eigenaar_aanhef: aanhef, eigenaar_adres: adres } : undefined)}
        className="rounded-full bg-aura-obsidian px-4 py-2 text-[12px] font-semibold text-white mb-3">
        {gen.isPending ? 'Genereren…' : 'Genereer brief'}
      </button>
      {gen.data && (
        <pre className="whitespace-pre-wrap text-[13px] text-aura-ink bg-white rounded-[16px] border border-[#EAEFEF] p-4">{gen.data.markdown}</pre>
      )}
      {gen.data && user?.hauzer_demo && (
        sent ? (
          <p className="mt-3 text-[13px] font-semibold text-aura-amber-hover">Verzonden ✓</p>
        ) : (
          <button onClick={() => send.mutate(gen.data!.markdown, { onSuccess: () => setSent(true) })}
            className="mt-3 rounded-full border border-aura-amber/40 bg-aura-amber/[0.12] px-4 py-2 text-[12px] font-semibold text-aura-amber-hover">
            {send.isPending ? 'Versturen…' : 'Versturen'}
          </button>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 3: Mount in ContactPhaseView**

In `frontend/src/components/lifecycle/ContactPhaseView.tsx`, import `BriefCard` en render 'm na het `dispatch.showRecordDisplay`-blok (regel ~139), binnen dezelfde container:

```typescript
        <BriefCard parcelId={parcelId} />
```

- [ ] **Step 4: Run check**

Run: `cd frontend && npm run check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useBrief.ts frontend/src/components/lifecycle/BriefCard.tsx frontend/src/components/lifecycle/ContactPhaseView.tsx
git commit -m "M052/S04: BriefCard in ContactPhaseView (auto/manual + send gated)"
```

---

## Task 14: Eind-verificatie

- [ ] **Step 1: Backend volledig groen**

Run: `cd backend && ruff check . && mypy . && pytest -q -k "brief or afzender"`
Expected: clean + alle tests passed

- [ ] **Step 2: Frontend volledig groen**

Run: `cd frontend && npm run check && npx vitest run --project unit`
Expected: 0 errors + unit-tests passed

- [ ] **Step 3: Handmatige walkthrough (dev-servers draaien al)**

Login als demo-org (`tom@propdex.nl`), open een opgeslagen perceel → Contact-fase. Verifieer:
- Brief genereert (manual: NAW invulbaar; auto bij rechtspersoon-perceel)
- Versturen zichtbaar (hauzer_demo on) → "Verzonden ✓"
- Afzender-instellingen bewerkbaar in /instellingen

- [ ] **Step 4: Screenshot vóór push** (gebruiker-regel: altijd localhost-screenshot tonen)

- [ ] **Step 5: Slice-commit + (na akkoord) push**

```bash
git commit -am "M052/S04: brief-teaser slice afgerond" || true
```

---

## Succescriteria-mapping (uit spec)

| Criterium | Task(s) |
|---|---|
| 1. Brief-preview uit echte BRK-data (auto rechtspersoon / manual particulier) | 4, 5, 6, 13 |
| 2. "Verstuur" → fake-bevestiging achter `hauzer_demo` | 7, 9, 13 |
| 3. M051 1-op-1 swap (`BriefDispatcher`-interface, endpoint + persistence stabiel) | 7, 8, 9 |
| 4. `npm run check` + `ruff check . && mypy .` groen | 10, 14 |
| Afzender = echt product (org-velden + settings-UI) | 1, 2, 3, 11 |

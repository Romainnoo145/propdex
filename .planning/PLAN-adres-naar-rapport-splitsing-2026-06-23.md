# Adres → Splitsing Vergunningskansen-rapport — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een gebruiker typt een adres, kiest verbouwingstype "splitsing", en krijgt een onderbouwd vergunningskansen-rapport (perceelfeiten + huisvestingsverordening + gecureerde jurisprudentie + aandachtspunten), zonder de scoringsmotor aan te raken.

**Architecture:** Nieuwe surface náást het bestaande, zelfde repo, nieuwe branch. Backend: een nieuwe report-assembler die de al-gecachte `HuisvestingsverordeningPayload` (uit `FactorExtractionCache`) combineert met `ParcelCache`-feiten en een gecureerde jurisprudentie-set. Frontend: een schone adres→rapport-route die de bestaande PDOK-lookup hergebruikt. Geen scoring, geen kaart-ontdekking, geen lifecycle.

**Tech Stack:** FastAPI + SQLAlchemy 2.x (async) + Pydantic v2 (backend); TanStack Router + React + TS + TanStack Query (frontend). Tests: pytest + httpx AsyncClient (backend), vitest (frontend).

## Global Constraints

- Branch: maak en werk op `m055-s01-adres-naar-rapport` (geen werk op `main`).
- Commit-format: `M055/S01: <wat>`.
- Multi-tenant: elke query die org-data raakt filtert op `organization_id`; reference-data (jurisprudentie, huisvestingsverordening) mag global zijn.
- Geen aanroep van `score_v3` / `score_splitsingsrisico` / de scoringsmotor in deze flow.
- Datetimes: `datetime.utcnow()` (naive UTC).
- Files onder 300 regels; splits anders.
- Frontend kleuren via CSS-variabelen (DESIGN.md), geen hardcoded merkkleuren.
- Jurisprudentie-`duiding` per zaak MOET geverifieerd zijn tegen de echte uitspraaktekst (bron_url) voordat 'ie aan een klant getoond wordt. Verzin geen rechterlijke oordelen.

---

### Task 1: Jurisprudentie-datamodel + gecureerde splitsing-seed + selector

**Files:**
- Create: `backend/app/jurisprudentie/__init__.py`
- Create: `backend/app/jurisprudentie/models.py`
- Create: `backend/app/jurisprudentie/splitsing_cases.py`
- Create: `backend/app/jurisprudentie/selector.py`
- Test: `backend/tests/jurisprudentie/test_selector.py`

**Interfaces:**
- Produces:
  - `JurisprudentieCase` (Pydantic): `ecli: str`, `verbouwingstype: str`, `gemeente_code: str | None`, `instantie: str`, `datum: str`, `themas: list[str]`, `uitkomst: Literal["toegekend","geweigerd","vernietigd","gemengd"]`, `duiding: str`, `bron_url: str`.
  - `SPLITSING_CASES: list[JurisprudentieCase]` (gecureerd, global reference-data).
  - `select_cases(verbouwingstype: str, themas: list[str], gemeente_code: str | None, *, limit: int = 4) -> list[JurisprudentieCase]` — filtert op verbouwingstype, scoort op thema-overlap, geeft voorkeur aan gelijke gemeente, returnt top-N.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/jurisprudentie/test_selector.py
from app.jurisprudentie.models import JurisprudentieCase
from app.jurisprudentie.selector import select_cases


def _case(ecli, themas, gemeente=None, vt="splitsing"):
    return JurisprudentieCase(
        ecli=ecli, verbouwingstype=vt, gemeente_code=gemeente,
        instantie="Raad van State", datum="2022-01-01", themas=themas,
        uitkomst="geweigerd", duiding="x", bron_url="https://example.test/" + ecli,
    )


def test_filters_by_verbouwingstype():
    cases = [_case("A", ["schaarste"]), _case("B", ["welstand"], vt="dakkapel")]
    out = select_cases("splitsing", ["schaarste"], None, limit=4, cases=cases)
    assert [c.ecli for c in out] == ["A"]


def test_scores_on_thema_overlap_and_prefers_same_gemeente():
    cases = [
        _case("LANDELIJK", ["schaarste", "leefbaarheid"], gemeente=None),
        _case("VENLO", ["schaarste"], gemeente="0983"),
        _case("OTHER", ["proces"], gemeente="0363"),
    ]
    out = select_cases("splitsing", ["schaarste", "leefbaarheid"], "0983", limit=2, cases=cases)
    # Same-gemeente case ranks first on equal thema-overlap; OTHER (no overlap) excluded.
    assert out[0].ecli == "VENLO"
    assert "OTHER" not in [c.ecli for c in out]


def test_falls_back_to_landelijk_when_no_local():
    cases = [_case("LANDELIJK", ["schaarste"], gemeente=None)]
    out = select_cases("splitsing", ["schaarste"], "0983", limit=4, cases=cases)
    assert [c.ecli for c in out] == ["LANDELIJK"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/jurisprudentie/test_selector.py -v`
Expected: FAIL with `ModuleNotFoundError: app.jurisprudentie`

- [ ] **Step 3: Write the model**

```python
# backend/app/jurisprudentie/models.py
from typing import Literal

from pydantic import BaseModel


class JurisprudentieCase(BaseModel):
    ecli: str
    verbouwingstype: str
    gemeente_code: str | None = None
    instantie: str
    datum: str  # ISO yyyy-mm-dd
    themas: list[str]
    uitkomst: Literal["toegekend", "geweigerd", "vernietigd", "gemengd"]
    duiding: str  # mensentaal, geverifieerd tegen bron_url
    bron_url: str
```

- [ ] **Step 4: Write the selector**

```python
# backend/app/jurisprudentie/selector.py
from app.jurisprudentie.models import JurisprudentieCase
from app.jurisprudentie.splitsing_cases import SPLITSING_CASES

_REGISTRY: dict[str, list[JurisprudentieCase]] = {
    "splitsing": SPLITSING_CASES,
}


def select_cases(
    verbouwingstype: str,
    themas: list[str],
    gemeente_code: str | None,
    *,
    limit: int = 4,
    cases: list[JurisprudentieCase] | None = None,
) -> list[JurisprudentieCase]:
    pool = cases if cases is not None else _REGISTRY.get(verbouwingstype, [])
    wanted = {t for t in themas}

    def score(c: JurisprudentieCase) -> tuple[int, int]:
        if c.verbouwingstype != verbouwingstype:
            return (-1, 0)
        overlap = len(wanted.intersection(c.themas))
        same_gem = 1 if (gemeente_code and c.gemeente_code == gemeente_code) else 0
        return (overlap, same_gem)

    scored = [(score(c), c) for c in pool if c.verbouwingstype == verbouwingstype]
    # keep only cases with at least 1 thema-overlap when themas were given
    if wanted:
        scored = [s for s in scored if s[0][0] > 0]
    scored.sort(key=lambda s: (s[0][0], s[0][1]), reverse=True)
    return [c for _, c in scored[:limit]]
```

- [ ] **Step 5: Write the curated seed (real ECLIs; duiding TE VERIFIËREN tegen bron vóór klantgebruik)**

```python
# backend/app/jurisprudentie/splitsing_cases.py
from app.jurisprudentie.models import JurisprudentieCase

# Gecureerde, echte uitspraken. duiding moet door de curator geverifieerd
# worden tegen de uitspraaktekst op bron_url voordat ze aan een klant getoond
# wordt. Begin klein; breid uit per gemeente/thema.
SPLITSING_CASES: list[JurisprudentieCase] = [
    JurisprudentieCase(
        ecli="ECLI:NL:RVS:2022:1427",
        verbouwingstype="splitsing",
        gemeente_code=None,
        instantie="Raad van State",
        datum="2022-05-18",
        themas=["omzettingsvergunning", "schaarste", "leefbaarheid"],
        uitkomst="geweigerd",
        duiding=(
            "TE VERIFIËREN tegen bron: omzettings-/onttrekkingsvergunning, "
            "toetsing schaarste- en leefbaarheidsonderbouwing."
        ),
        bron_url="https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:RVS:2022:1427",
    ),
    JurisprudentieCase(
        ecli="ECLI:NL:RBDHA:2023:447",
        verbouwingstype="splitsing",
        gemeente_code="0518",
        instantie="Rechtbank Den Haag",
        datum="2023-01-20",
        themas=["omzettingsvergunning", "leefbaarheid"],
        uitkomst="gemengd",
        duiding="TE VERIFIËREN tegen bron: kamerverhuur/omzetting, leefbaarheidsweging.",
        bron_url="https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:RBDHA:2023:447",
    ),
]
```

- [ ] **Step 6: Add package init**

```python
# backend/app/jurisprudentie/__init__.py
```

(empty file)

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/jurisprudentie/test_selector.py -v`
Expected: PASS (3 tests)

- [ ] **Step 8: Lint + commit**

```bash
cd backend && .venv/bin/ruff check app/jurisprudentie tests/jurisprudentie
git add backend/app/jurisprudentie backend/tests/jurisprudentie
git commit -m "M055/S01: jurisprudentie model + splitsing seed + thema-selector"
```

---

### Task 2: Beleid-leeslaag — huisvestingsverordening-payload uit cache (geen scoring)

**Files:**
- Create: `backend/app/reports_v2/__init__.py`
- Create: `backend/app/reports_v2/beleid_reader.py`
- Test: `backend/tests/reports_v2/test_beleid_reader.py`

**Interfaces:**
- Consumes: `cascade_enrichment_service.get_huisvestingsverordening_document` (PolicyDocument), `FactorExtractionCache`, `HuisvestingsverordeningPayload` (from `app.ai.factors.splitsingsrisico`).
- Produces:
  - `async def read_huisvestingsverordening(db, gemeente_code: str, organization_id) -> HuisvestingsverordeningPayload | None` — fetcht document, leest de gecachte payload (`parcel_id="__document__"`, `factor_id="splitsingsrisico"`, huidige `schema_version`); returnt None bij geen document of geen cache-hit.
  - `def derive_themas(payload: HuisvestingsverordeningPayload) -> list[str]` — leidt thema's af die de jurisprudentie-selector matcht (bv. "splitsing"/"woningvorming"/"omzetting" in `voorraad_vergunningplichten` → die thema's; randvoorwaarde-categorieën; "schaarste"/"leefbaarheid" als die in citaten/randvoorwaarden voorkomen).

- [ ] **Step 1: Write the failing test for derive_themas (pure function, no DB)**

```python
# backend/tests/reports_v2/test_beleid_reader.py
from app.ai.factors.splitsingsrisico import HuisvestingsverordeningPayload
from app.reports_v2.beleid_reader import derive_themas


def _payload(vergunningplichten, randvoorwaarden=None):
    return HuisvestingsverordeningPayload(
        geldig_van=None, geldig_tot=None,
        voorraad_vergunningplichten=vergunningplichten,
        voorraad_citaat=None,
        huisvestingsvergunning_scope="corporatie_sociale_huur",
        opkoopbescherming=None,
        randvoorwaarden=randvoorwaarden or [],
        confidence=0.9,
    )


def test_themas_include_vergunningplichten():
    p = _payload(["splitsing", "omzetting"])
    themas = derive_themas(p)
    assert "splitsing" in themas
    assert "omzetting" in themas


def test_themas_empty_when_no_vergunningplicht():
    p = _payload([])
    assert derive_themas(p) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_beleid_reader.py -v`
Expected: FAIL with `ModuleNotFoundError: app.reports_v2`

- [ ] **Step 3: Implement derive_themas + read_huisvestingsverordening**

```python
# backend/app/reports_v2/beleid_reader.py
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factors.splitsingsrisico import (
    SCHEMA_VERSION,
    HuisvestingsverordeningPayload,
)
from app.models.factor_extraction_cache import FactorExtractionCache
from app.services.cascade_enrichment_service import (
    get_huisvestingsverordening_document,
)

_DOCUMENT_SENTINEL = "__document__"
_FACTOR_ID = "splitsingsrisico"


def derive_themas(payload: HuisvestingsverordeningPayload) -> list[str]:
    themas: list[str] = []
    for vp in payload.voorraad_vergunningplichten:
        themas.append(vp)  # "splitsing" | "omzetting" | "onttrekking" | "woningvorming"
    text = " ".join(
        [payload.voorraad_citaat or ""]
        + [rv.samenvatting for rv in payload.randvoorwaarden]
        + [rv.citaat or "" for rv in payload.randvoorwaarden]
    ).lower()
    if "schaars" in text:
        themas.append("schaarste")
    if "leefbaar" in text:
        themas.append("leefbaarheid")
    # de-dup, keep order
    seen: set[str] = set()
    out: list[str] = []
    for t in themas:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


async def read_huisvestingsverordening(
    db: AsyncSession,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> HuisvestingsverordeningPayload | None:
    doc = await get_huisvestingsverordening_document(
        db, gemeente_code=gemeente_code, organization_id=organization_id
    )
    if doc is None:
        return None
    row = (
        await db.execute(
            select(FactorExtractionCache).where(
                FactorExtractionCache.parcel_id == _DOCUMENT_SENTINEL,
                FactorExtractionCache.policy_document_id == doc.id,
                FactorExtractionCache.factor_id == _FACTOR_ID,
                FactorExtractionCache.schema_version == SCHEMA_VERSION,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    return HuisvestingsverordeningPayload.model_validate(row.extracted_payload)
```

> **Note for executor:** verifieer de exacte import van `SCHEMA_VERSION` in `app/ai/factors/splitsingsrisico.py` en de signatuur van `get_huisvestingsverordening_document` (gemeente_code/organization_id kwargs) — beide bevestigd in de codebase-mapping. Pas import aan als `SCHEMA_VERSION` elders woont.

- [ ] **Step 4: Add package init**

```python
# backend/app/reports_v2/__init__.py
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_beleid_reader.py -v`
Expected: PASS (2 tests for derive_themas)

- [ ] **Step 6: Lint + commit**

```bash
cd backend && .venv/bin/ruff check app/reports_v2 tests/reports_v2
git add backend/app/reports_v2 backend/tests/reports_v2
git commit -m "M055/S01: beleid-leeslaag (huisvestingsverordening uit cache + thema-afleiding)"
```

---

### Task 3: Rapport-samensteller (splitsing) + responseschema

**Files:**
- Create: `backend/app/reports_v2/schemas.py`
- Create: `backend/app/reports_v2/splitsing_report.py`
- Test: `backend/tests/reports_v2/test_splitsing_report.py`

**Interfaces:**
- Consumes: `ParcelCache`, `read_huisvestingsverordening`, `derive_themas`, `select_cases`.
- Produces:
  - `SplitsingReport` (Pydantic) met blokken: `perceel: PerceelFeiten`, `beleid: BeleidBlok | None`, `jurisprudentie: list[JurisprudentieCase]`, `aandachtspunten: list[str]`, `aanvraag_url: str`, `disclaimers: list[str]`.
  - `async def build_splitsing_report(db, parcel_id: str, organization_id) -> SplitsingReport` — laadt `ParcelCache`, leest beleid, leidt thema's af, selecteert jurisprudentie, stelt aandachtspunten samen. Raised `LookupError` als parcel niet bestaat.

- [ ] **Step 1: Write the failing test (assembler with stubbed beleid + parcel)**

```python
# backend/tests/reports_v2/test_splitsing_report.py
import uuid

import pytest

from app.reports_v2.splitsing_report import build_splitsing_report


@pytest.mark.asyncio
async def test_build_report_for_parcel_with_vergunningplicht(db_session, seed_parcel, seed_huisvestingsverordening):
    parcel = await seed_parcel(gemeente_code="0983", buurt_code="BU09831401", bestemmingen=[{"type": "wonen"}])
    await seed_huisvestingsverordening(gemeente_code="0983", vergunningplichten=["splitsing", "omzetting"])

    report = await build_splitsing_report(
        db_session, parcel_id=parcel.parcel_id, organization_id=uuid.UUID(int=1)
    )

    assert report.perceel.gemeente_code == "0983"
    assert report.beleid is not None
    assert "splitsing" in report.beleid.vergunningplichten
    assert len(report.jurisprudentie) >= 1
    assert any("Omgevingsloket" in d or "vraag" in d.lower() for d in [report.aanvraag_url])
    assert report.disclaimers  # niet leeg


@pytest.mark.asyncio
async def test_build_report_unknown_parcel_raises(db_session):
    with pytest.raises(LookupError):
        await build_splitsing_report(db_session, parcel_id="DOES-NOT-EXIST", organization_id=uuid.UUID(int=1))
```

> **Executor:** `seed_parcel` en `seed_huisvestingsverordening` zijn fixtures die je toevoegt in `backend/tests/reports_v2/conftest.py`: maak een `ParcelCache`-rij en een `PolicyDocument` + `FactorExtractionCache`-rij (`parcel_id="__document__"`) met een minimale `HuisvestingsverordeningPayload`. Volg het bestaande conftest-patroon (function-scoped, direct commit).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_splitsing_report.py -v`
Expected: FAIL with `ModuleNotFoundError` / missing `build_splitsing_report`

- [ ] **Step 3: Write the schemas**

```python
# backend/app/reports_v2/schemas.py
from pydantic import BaseModel

from app.jurisprudentie.models import JurisprudentieCase


class PerceelFeiten(BaseModel):
    parcel_id: str
    adres: str | None
    gemeente_code: str | None
    buurt_code: str | None
    oppervlakte_m2: float | None
    bouwjaar: int | None
    bestemmingen: list[str]


class BeleidBlok(BaseModel):
    vergunningplichten: list[str]
    samenvatting: str  # mensentaal
    randvoorwaarden: list[str]
    bron_geldig_van: str | None
    bron_geldig_tot: str | None
    confidence: float


class SplitsingReport(BaseModel):
    perceel: PerceelFeiten
    beleid: BeleidBlok | None
    jurisprudentie: list[JurisprudentieCase]
    aandachtspunten: list[str]
    aanvraag_url: str
    disclaimers: list[str]
```

- [ ] **Step 4: Write the assembler**

```python
# backend/app/reports_v2/splitsing_report.py
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.jurisprudentie.selector import select_cases
from app.models.parcel_cache import ParcelCache
from app.reports_v2.beleid_reader import derive_themas, read_huisvestingsverordening
from app.reports_v2.schemas import BeleidBlok, PerceelFeiten, SplitsingReport

_OMGEVINGSLOKET = "https://omgevingswet.overheid.nl/aanvragen"
_DISCLAIMER = (
    "Indicatief. Gebaseerd op de gepubliceerde huisvestingsverordening en "
    "openbare jurisprudentie, geen juridisch advies. Toetsing per geval door "
    "de gemeente blijft leidend."
)


def _bestemming_types(bestemmingen: list[dict] | None) -> list[str]:
    if not bestemmingen:
        return []
    out = []
    for b in bestemmingen:
        t = b.get("type") if isinstance(b, dict) else None
        if t:
            out.append(str(t))
    return out


async def build_splitsing_report(
    db: AsyncSession,
    parcel_id: str,
    organization_id: uuid.UUID,
) -> SplitsingReport:
    parcel = (
        await db.execute(select(ParcelCache).where(ParcelCache.parcel_id == parcel_id))
    ).scalar_one_or_none()
    if parcel is None:
        raise LookupError(f"parcel {parcel_id} not found")

    feiten = PerceelFeiten(
        parcel_id=parcel.parcel_id,
        adres=parcel.address,
        gemeente_code=parcel.gemeente_code,
        buurt_code=parcel.buurt_code,
        oppervlakte_m2=parcel.area_m2,
        bouwjaar=parcel.bouwjaar,
        bestemmingen=_bestemming_types(parcel.bestemmingen),
    )

    beleid: BeleidBlok | None = None
    themas: list[str] = []
    if parcel.gemeente_code:
        payload = await read_huisvestingsverordening(
            db, gemeente_code=parcel.gemeente_code, organization_id=organization_id
        )
        if payload is not None:
            themas = derive_themas(payload)
            beleid = BeleidBlok(
                vergunningplichten=list(payload.voorraad_vergunningplichten),
                samenvatting=(
                    payload.voorraad_citaat
                    or "Zie de gemeentelijke huisvestingsverordening voor de exacte voorwaarden."
                ),
                randvoorwaarden=[rv.titel for rv in payload.randvoorwaarden],
                bron_geldig_van=payload.geldig_van,
                bron_geldig_tot=payload.geldig_tot,
                confidence=payload.confidence,
            )

    cases = select_cases("splitsing", themas, parcel.gemeente_code, limit=4)

    aandachtspunten: list[str] = []
    if beleid and "splitsing" in beleid.vergunningplichten:
        aandachtspunten.append(
            "Splitsing is in deze gemeente vergunningplichtig. Vraag de "
            "vergunning aan vóór je aankoop- of verbouwbeslissing."
        )
    if beleid and "omzetting" in beleid.vergunningplichten:
        aandachtspunten.append(
            "Omzetting naar kamerverhuur is vergunningplichtig; let op het "
            "leefbaarheidscriterium per wijk."
        )
    if not beleid:
        aandachtspunten.append(
            "Geen actuele huisvestingsverordening gevonden voor deze gemeente; "
            "verifieer de vergunningplicht handmatig."
        )

    return SplitsingReport(
        perceel=feiten,
        beleid=beleid,
        jurisprudentie=cases,
        aandachtspunten=aandachtspunten,
        aanvraag_url=_OMGEVINGSLOKET,
        disclaimers=[_DISCLAIMER],
    )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_splitsing_report.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Lint + mypy + commit**

```bash
cd backend && .venv/bin/ruff check app/reports_v2 && .venv/bin/mypy app/reports_v2
git add backend/app/reports_v2 backend/tests/reports_v2
git commit -m "M055/S01: splitsing rapport-samensteller + responseschema"
```

---

### Task 4: Backend-endpoint `GET /api/reports-v2/splitsing/{parcel_id}`

**Files:**
- Create: `backend/app/reports_v2/router.py`
- Modify: `backend/app/main.py` (registreer router — zoek waar andere routers via `app.include_router(...)` worden toegevoegd)
- Test: `backend/tests/reports_v2/test_splitsing_endpoint.py`

**Interfaces:**
- Consumes: `build_splitsing_report`, `get_current_active_user`, `get_db`, module-level `limiter`.
- Produces: `GET /api/reports-v2/splitsing/{parcel_id}` → `SplitsingReport` (200) of 404 bij onbekend perceel.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/reports_v2/test_splitsing_endpoint.py
import pytest


@pytest.mark.asyncio
async def test_splitsing_endpoint_returns_report(client, auth_headers, seed_parcel, seed_huisvestingsverordening):
    parcel = await seed_parcel(gemeente_code="0983", buurt_code="BU09831401", bestemmingen=[{"type": "wonen"}])
    await seed_huisvestingsverordening(gemeente_code="0983", vergunningplichten=["splitsing"])

    resp = await client.get(f"/api/reports-v2/splitsing/{parcel.parcel_id}", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["perceel"]["gemeente_code"] == "0983"
    assert body["beleid"]["vergunningplichten"] == ["splitsing"]
    assert isinstance(body["jurisprudentie"], list)


@pytest.mark.asyncio
async def test_splitsing_endpoint_unknown_parcel_404(client, auth_headers):
    resp = await client.get("/api/reports-v2/splitsing/NOPE", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_splitsing_endpoint_requires_auth(client, seed_parcel):
    parcel = await seed_parcel(gemeente_code="0983")
    resp = await client.get(f"/api/reports-v2/splitsing/{parcel.parcel_id}")
    assert resp.status_code in (401, 403)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_splitsing_endpoint.py -v`
Expected: FAIL (404 route not found / import error)

- [ ] **Step 3: Implement the router**

```python
# backend/app/reports_v2/router.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.reports_v2.schemas import SplitsingReport
from app.reports_v2.splitsing_report import build_splitsing_report

router = APIRouter(prefix="/api/reports-v2", tags=["Reports v2"])


@router.get("/splitsing/{parcel_id}", response_model=SplitsingReport)
@limiter.limit("60/minute")
async def get_splitsing_report(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SplitsingReport:
    try:
        return await build_splitsing_report(
            db, parcel_id=parcel_id, organization_id=current_user.organization_id
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
```

- [ ] **Step 4: Register the router in main.py**

Zoek in `backend/app/main.py` het blok met `app.include_router(...)` en voeg toe:

```python
from app.reports_v2.router import router as reports_v2_router
app.include_router(reports_v2_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_splitsing_endpoint.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Full backend suite + commit**

```bash
cd backend && .venv/bin/pytest tests/reports_v2 -v && .venv/bin/ruff check app/reports_v2
git add backend/app/reports_v2/router.py backend/app/main.py backend/tests/reports_v2/test_splitsing_endpoint.py
git commit -m "M055/S01: splitsing rapport-endpoint + router-registratie"
```

---

### Task 5: Frontend — API-client + types + hook

**Files:**
- Modify: `frontend/src/lib/api.ts` (voeg `fetchSplitsingReport` + types toe, of een nieuw `frontend/src/lib/reportsV2.ts` als api.ts > 300 regels)
- Create: `frontend/src/hooks/useSplitsingReport.ts`
- Test: `frontend/src/hooks/useSplitsingReport.test.ts`

**Interfaces:**
- Produces:
  - Types `SplitsingReport`, `PerceelFeiten`, `BeleidBlok`, `JurisprudentieCase` (TS spiegels van de backend-schemas).
  - `fetchSplitsingReport(parcelId: string, accessToken: string | null): Promise<SplitsingReport>` → `GET /api/reports-v2/splitsing/{parcelId}` via bestaande `apiFetch`.
  - `useSplitsingReport(parcelId: string | undefined)` → TanStack Query hook.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/hooks/useSplitsingReport.test.ts
import { describe, expect, it, vi } from 'vitest'
import { fetchSplitsingReport } from '@/lib/reportsV2'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => ({ url })),
}))

describe('fetchSplitsingReport', () => {
  it('calls the reports-v2 splitsing endpoint', async () => {
    const res = (await fetchSplitsingReport('HTT02-A-1', 'tok')) as unknown as { url: string }
    expect(res.url).toBe('/api/reports-v2/splitsing/HTT02-A-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/useSplitsingReport.test.ts`
Expected: FAIL (module `@/lib/reportsV2` not found)

- [ ] **Step 3: Implement client + types**

```typescript
// frontend/src/lib/reportsV2.ts
import { apiFetch } from '@/lib/api'

export interface PerceelFeiten {
  parcel_id: string
  adres: string | null
  gemeente_code: string | null
  buurt_code: string | null
  oppervlakte_m2: number | null
  bouwjaar: number | null
  bestemmingen: string[]
}

export interface BeleidBlok {
  vergunningplichten: string[]
  samenvatting: string
  randvoorwaarden: string[]
  bron_geldig_van: string | null
  bron_geldig_tot: string | null
  confidence: number
}

export interface JurisprudentieCase {
  ecli: string
  verbouwingstype: string
  gemeente_code: string | null
  instantie: string
  datum: string
  themas: string[]
  uitkomst: 'toegekend' | 'geweigerd' | 'vernietigd' | 'gemengd'
  duiding: string
  bron_url: string
}

export interface SplitsingReport {
  perceel: PerceelFeiten
  beleid: BeleidBlok | null
  jurisprudentie: JurisprudentieCase[]
  aandachtspunten: string[]
  aanvraag_url: string
  disclaimers: string[]
}

export async function fetchSplitsingReport(
  parcelId: string,
  accessToken: string | null,
): Promise<SplitsingReport> {
  return apiFetch<SplitsingReport>(`/api/reports-v2/splitsing/${parcelId}`, {
    method: 'GET',
    accessToken,
  })
}
```

- [ ] **Step 4: Implement the hook**

```typescript
// frontend/src/hooks/useSplitsingReport.ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchSplitsingReport } from '@/lib/reportsV2'

export function useSplitsingReport(parcelId: string | undefined) {
  const { accessToken } = useAuth()
  return useQuery({
    queryKey: ['splitsing-report', parcelId],
    queryFn: () => fetchSplitsingReport(parcelId as string, accessToken),
    enabled: !!parcelId,
    staleTime: 5 * 60 * 1000,
  })
}
```

> **Executor:** verifieer het import-pad voor `useAuth` (`@/lib/auth/useAuth` per mapping) en de `apiFetch`-signatuur (`{ method, accessToken }`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/useSplitsingReport.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck + commit**

```bash
cd frontend && npm run check
git add frontend/src/lib/reportsV2.ts frontend/src/hooks/useSplitsingReport.ts frontend/src/hooks/useSplitsingReport.test.ts
git commit -m "M055/S01: frontend client + hook voor splitsing-rapport"
```

---

### Task 6: Frontend — rapport-view component (4 blokken)

**Files:**
- Create: `frontend/src/components/reportsV2/SplitsingReportView.tsx`
- Create: `frontend/src/components/reportsV2/SplitsingReportView.test.tsx`

**Interfaces:**
- Consumes: `SplitsingReport` type.
- Produces: `<SplitsingReportView report={SplitsingReport} />` — rendert vier blokken: perceelfeiten, "Wat geldt hier" (beleid), "Wat zegt de rechter" (jurisprudentie met ECLI + duiding + bron-link), aandachtspunten + aanvraag-CTA + disclaimers.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/reportsV2/SplitsingReportView.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SplitsingReportView } from './SplitsingReportView'
import type { SplitsingReport } from '@/lib/reportsV2'

const report: SplitsingReport = {
  perceel: { parcel_id: 'HTT02-A-1', adres: 'Teststraat 1', gemeente_code: '0983', buurt_code: 'BU09831401', oppervlakte_m2: 120, bouwjaar: 1960, bestemmingen: ['wonen'] },
  beleid: { vergunningplichten: ['splitsing'], samenvatting: 'Splitsing vergunningplichtig.', randvoorwaarden: ['Minimale oppervlakte'], bron_geldig_van: '2024-01-01', bron_geldig_tot: null, confidence: 0.9 },
  jurisprudentie: [{ ecli: 'ECLI:NL:RVS:2022:1427', verbouwingstype: 'splitsing', gemeente_code: null, instantie: 'Raad van State', datum: '2022-05-18', themas: ['schaarste'], uitkomst: 'geweigerd', duiding: 'Toetsing schaarste.', bron_url: 'https://example.test/x' }],
  aandachtspunten: ['Vraag de vergunning aan vóór aankoop.'],
  aanvraag_url: 'https://omgevingswet.overheid.nl/aanvragen',
  disclaimers: ['Indicatief, geen juridisch advies.'],
}

describe('SplitsingReportView', () => {
  it('renders all four blocks', () => {
    render(<SplitsingReportView report={report} />)
    expect(screen.getByText('Teststraat 1')).toBeInTheDocument()
    expect(screen.getByText(/Splitsing vergunningplichtig/)).toBeInTheDocument()
    expect(screen.getByText('ECLI:NL:RVS:2022:1427')).toBeInTheDocument()
    expect(screen.getByText(/Vraag de vergunning aan/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/reportsV2/SplitsingReportView.test.tsx`
Expected: FAIL (component not found)

- [ ] **Step 3: Implement the view (Aura-stijl via CSS-vars, geen hardcoded merkkleuren)**

```tsx
// frontend/src/components/reportsV2/SplitsingReportView.tsx
import type { SplitsingReport } from '@/lib/reportsV2'

export function SplitsingReportView({ report }: { report: SplitsingReport }) {
  const { perceel, beleid, jurisprudentie, aandachtspunten, aanvraag_url, disclaimers } = report
  return (
    <article className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{perceel.adres ?? perceel.parcel_id}</h1>
        <p className="text-sm opacity-70">
          {perceel.bestemmingen.join(', ') || 'onbekend'} · {perceel.oppervlakte_m2 ?? '?'} m² ·
          bouwjaar {perceel.bouwjaar ?? '?'}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Wat geldt hier</h2>
        {beleid ? (
          <div className="space-y-2">
            <p>{beleid.samenvatting}</p>
            {beleid.vergunningplichten.length > 0 && (
              <p className="text-sm">Vergunningplichtig: {beleid.vergunningplichten.join(', ')}</p>
            )}
            {beleid.randvoorwaarden.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {beleid.randvoorwaarden.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm opacity-70">Geen actuele huisvestingsverordening gevonden.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Wat zegt de rechter</h2>
        <ul className="space-y-3">
          {jurisprudentie.map((c) => (
            <li key={c.ecli} className="rounded-lg border p-3">
              <a href={c.bron_url} target="_blank" rel="noreferrer" className="font-mono text-sm underline">
                {c.ecli}
              </a>
              <span className="ml-2 text-xs uppercase opacity-60">{c.uitkomst}</span>
              <p className="mt-1 text-sm">{c.duiding}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Aandachtspunten</h2>
        <ul className="list-disc space-y-1 pl-5">
          {aandachtspunten.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <a href={aanvraag_url} target="_blank" rel="noreferrer" className="mt-3 inline-block underline">
          Vraag de vergunning aan via het Omgevingsloket
        </a>
      </section>

      <footer className="border-t pt-4 text-xs opacity-60">
        {disclaimers.map((d) => (
          <p key={d}>{d}</p>
        ))}
      </footer>
    </article>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/reportsV2/SplitsingReportView.test.tsx`
Expected: PASS

- [ ] **Step 5: Typecheck + commit**

```bash
cd frontend && npm run check
git add frontend/src/components/reportsV2
git commit -m "M055/S01: SplitsingReportView (4 blokken)"
```

---

### Task 7: Frontend — adres→rapport route (entry + resolve + render)

**Files:**
- Create: `frontend/src/routes/_authenticated/rapport-v2.tsx` (adres-entry + verbouwingstype-keuze)
- Create: `frontend/src/routes/_authenticated/rapport-v2.splitsing.$parcelId.tsx` (rapport-pagina)
- Test: handmatige smoke (dev-server), plus typecheck.

**Interfaces:**
- Consumes: `useAddressSuggest` (bestaand), `resolveParcelByAddress` (bestaand, `frontend/src/lib/api.ts`), `useSplitsingReport`, `SplitsingReportView`.
- Flow: gebruiker zoekt adres → kiest suggestie → `resolveParcelByAddress` → navigeer naar `/rapport-v2/splitsing/$parcelId`.

- [ ] **Step 1: Implement the entry route**

```tsx
// frontend/src/routes/_authenticated/rapport-v2.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAddressSuggest } from '@/hooks/useAddressSuggest'
import { useAuth } from '@/lib/auth/useAuth'
import { lookupPdokAddress, resolveParcelByAddress } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/rapport-v2')({
  component: RapportEntry,
})

function RapportEntry() {
  const [query, setQuery] = useState('')
  const { data: suggestions } = useAddressSuggest(query)
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  async function pick(pdokId: string) {
    const addr = await lookupPdokAddress(pdokId)
    const resolved = await resolveParcelByAddress(
      { street: addr.straatnaam, huisnummer: Number(addr.huisnummer), postcode: addr.postcode },
      accessToken,
    )
    navigate({ to: '/rapport-v2/splitsing/$parcelId', params: { parcelId: resolved.parcel_id } })
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Vergunningskansen — splitsing</h1>
      <input
        className="w-full rounded border px-3 py-2"
        placeholder="Typ een adres"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul>
        {(suggestions ?? []).map((s) => (
          <li key={s.id}>
            <button className="w-full py-1 text-left hover:underline" onClick={() => pick(s.id)}>
              {s.weergavenaam}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

> **Executor:** verifieer de exacte velden van `useAddressSuggest`-resultaten (`id`, `weergavenaam`) en `lookupPdokAddress`-output (`straatnaam`, `huisnummer`, `postcode`) — bevestigd in mapping. Pas `resolveParcelByAddress`-args aan op de echte signatuur in `lib/api.ts`.

- [ ] **Step 2: Implement the report page route**

```tsx
// frontend/src/routes/_authenticated/rapport-v2.splitsing.$parcelId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useSplitsingReport } from '@/hooks/useSplitsingReport'
import { SplitsingReportView } from '@/components/reportsV2/SplitsingReportView'

export const Route = createFileRoute('/_authenticated/rapport-v2/splitsing/$parcelId')({
  component: SplitsingReportPage,
})

function SplitsingReportPage() {
  const { parcelId } = Route.useParams()
  const { data, isLoading, error } = useSplitsingReport(parcelId)

  if (isLoading) return <div className="p-6">Rapport laden…</div>
  if (error || !data) return <div className="p-6">Kon het rapport niet laden.</div>
  return <SplitsingReportView report={data} />
}
```

- [ ] **Step 3: Typecheck (route tree regenereert via TanStack plugin)**

Run: `cd frontend && npm run check`
Expected: PASS (geen type-errors; route tree bevat de twee nieuwe routes)

- [ ] **Step 4: Manual smoke test**

Start dev (al draaiend op :9300 / backend :8000). Log in, ga naar `/rapport-v2`, zoek een Venlo-adres met geëxtraheerde huisvestingsverordening, kies het, en controleer dat de rapport-pagina de vier blokken toont met echte jurisprudentie.

- [ ] **Step 5: Commit**

```bash
cd frontend && npm run check
git add frontend/src/routes/_authenticated/rapport-v2.tsx frontend/src/routes/_authenticated/rapport-v2.splitsing.\$parcelId.tsx frontend/src/routeTree.gen.ts
git commit -m "M055/S01: adres→splitsing-rapport route (entry + render)"
```

---

## Self-Review (uitgevoerd)

- **Spec-dekking:** adres→perceel (Task 7 + bestaande lookup), verbouwingstype splitsing (hardcoded v1, Task 3/7), beleid uit cache zonder scoring (Task 2), jurisprudentie-koppeling op thema + gemeente (Task 1+3), rapport-view 4 blokken (Task 6), geen score / geen nep-percentage (assembler geeft duiding + disclaimers, geen %). Gedekt.
- **Open punten voor de executor (geen placeholders in code, wel te verifiëren tegen bestaande signatures):** `SCHEMA_VERSION`-import in `splitsingsrisico.py`; exacte `get_huisvestingsverordening_document`-signatuur; `apiFetch`/`useAuth`/`useAddressSuggest`/`resolveParcelByAddress` exacte vormen (alle bevestigd in codebase-mapping). Test-fixtures `seed_parcel` + `seed_huisvestingsverordening` toe te voegen in `tests/reports_v2/conftest.py` volgens bestaand conftest-patroon.
- **Type-consistentie:** backend `SplitsingReport`/`BeleidBlok`/`PerceelFeiten`/`JurisprudentieCase` ↔ frontend TS-spiegels matchen veld-voor-veld.
- **Content-integriteit:** jurisprudentie-`duiding` is in de seed gemarkeerd als TE VERIFIËREN; curator schrijft de duiding uit de echte uitspraak vóór klantgebruik.

## Niet in scope (fast-follow na klant-validatie)

Geautomatiseerde rechtspraak-pijplijn; meer verbouwingstypes; PDF-export; white-label branding; verwijderen van scoringsmotor + kaart-ontdekking + lifecycle uit de oude app.

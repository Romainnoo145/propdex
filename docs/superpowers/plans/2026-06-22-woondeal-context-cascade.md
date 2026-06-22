# Woondeal Context Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the Woondeal Limburg as honest gemeente-level *context* (extraction → gemeente-panel modal + parcel context card + policy-hub), with **no scoring weight** and **no map colour**.

**Architecture:** A provincie-level policy document (`entity_type="provincie"`, `source_key="woondeals"`) is resolved per gemeente via `GemeenteProvincieMap` and extracted once (document-level, cached) into a typed `WoondealPayload`. A read-only gemeente endpoint serves the structured payload; the frontend renders it in a gemeente-panel `WoondealModal` (home of record) and a compact parcel context card. The factor never enters `FACTOR_REGISTRY` / `compute_score_v3` — the score signal is deferred to a future multi-gemeente slice.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy 2.x async, Pydantic v2, Anthropic tool-use extraction; React 19 + TypeScript, TanStack Query/Router, Tailwind v4, vitest.

## Global Constraints

- Files under 300 lines; split if larger.
- Multi-tenant: every policy-document query filters `is_global OR organization_id`.
- Datetimes: `datetime.utcnow()` (naive UTC), never `datetime.now(timezone.utc)`.
- Transactions: direct `db.add()/flush()/commit()`, never `async with db.begin()`.
- Backend validation per change: `ruff check . && mypy .` from `backend/`.
- Frontend validation per change: `npm run check` (= `tsc -b --noEmit && eslint .`) + `npm run vitest` from `frontend/`.
- Real Woondeal figures only — never the bogus "2.718"; never fabricate parcel-level locations.
- Commit prefix: `M054/S06: <wat>` (cascade-build campaign slice; adjust the slice number if reassigned).
- `SCHEMA_VERSION` is currently `6` (`backend/app/ai/factor_extraction_schemas.py:114`). Do NOT bump it — woondeal adds a new `factor_id`, not a field to an existing payload.
- Extraction is document-level: always call with `parcel_id=DOCUMENT_SENTINEL` (`"__document__"`).

---

### Task 1: Woondeal factor-definition (typed extraction contract)

**Files:**
- Create: `backend/app/ai/factors/woondeal.py`
- Test: `backend/tests/unit/test_woondeal_factor_def.py`

**Interfaces:**
- Consumes: `FactorDefinition` (`app/ai/factor_extraction_schemas.py`), `Randvoorwaarde` (`app/ai/factors/beleidsalignement.py`).
- Produces:
  - `class GemeenteOpgave(BaseModel)` — fields: `gemeente_naam: str`, `toevoegingen: int | None`, `plancapaciteit: int | None`, `sleutelprojecten_aantal: int | None`, `sleutelprojecten_woningen: int | None`.
  - `class WoondealPayload(BaseModel)` — fields: `regio_naam: str`, `provincie: str | None`, `periode: str | None`, `gemeenten: list[GemeenteOpgave]`, `aandeel_betaalbaar: float | None`, `betaalbaar_definitie: str | None`, `regelingen: list[str]`, `doelgroepen: list[str]`, `randvoorwaarden: list[Randvoorwaarde]`, `algemeen_citaat: str`, `confidence: float`.
  - `WOONDEAL_FACTOR_DEF: FactorDefinition[WoondealPayload]` — `factor_id="woondeal"`, `tool_name="extract_woondeal"`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_woondeal_factor_def.py
from app.ai.factors.woondeal import (
    GemeenteOpgave,
    WoondealPayload,
    WOONDEAL_FACTOR_DEF,
)


def test_factor_def_identity():
    assert WOONDEAL_FACTOR_DEF.factor_id == "woondeal"
    assert WOONDEAL_FACTOR_DEF.tool_name == "extract_woondeal"
    assert WOONDEAL_FACTOR_DEF.payload_model is WoondealPayload


def test_payload_validates_real_venlo_row():
    payload = WoondealPayload.model_validate(
        {
            "regio_naam": "Noord-Limburg",
            "provincie": "Limburg",
            "periode": "2022-2030",
            "gemeenten": [
                {
                    "gemeente_naam": "Venlo",
                    "toevoegingen": 1745,
                    "plancapaciteit": 1594,
                    "sleutelprojecten_aantal": 2,
                    "sleutelprojecten_woningen": 706,
                }
            ],
            "aandeel_betaalbaar": 0.667,
            "betaalbaar_definitie": "sociale huur + huur tot EUR1.000 + koop < EUR355.000",
            "regelingen": ["KLC", "BIRK", "Woningbouwimpuls"],
            "doelgroepen": ["aandachtsgroepen"],
            "randvoorwaarden": [],
            "algemeen_citaat": "",
            "confidence": 0.9,
        }
    )
    assert payload.gemeenten[0].gemeente_naam == "Venlo"
    assert payload.gemeenten[0].toevoegingen == 1745


def test_input_schema_is_anthropic_shaped():
    schema = WOONDEAL_FACTOR_DEF.input_schema
    assert schema["type"] == "object"
    assert "gemeenten" in schema["properties"]
    assert schema["required"] == ["confidence"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_woondeal_factor_def.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.ai.factors.woondeal'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/ai/factors/woondeal.py
"""Woondeal context cascade — regionale Woondeal-extractie (M054/S06).

De Woondeal is een regionale afspraak (Rijk + provincie + gemeenten) over de
woningbouwopgave tot 2030. Het document is provincie-niveau en noemt per
gemeente een opgave + plancapaciteit, een regio-breed betaalbaar-aandeel,
sleutelprojecten en regelingen.

CONTEXT-ONLY: deze cascade levert GEEN score (geen FACTOR_REGISTRY-entry, geen
gewicht). Elke NL-gemeente zit in een woondeal en het document geeft geen
perceel-granulariteit, dus een gewicht zou de hele kaart uniform kleuren zonder
differentiatie (zie .planning specs 2026-06-22). De waarde is informatie.

Cloned van grondwaarde_fit.py (M054/S01): Pydantic-modellen -> _INPUT_SCHEMA dict
-> FactorDefinition. Randvoorwaarde wordt hergebruikt uit beleidsalignement.
"""

from typing import Any

from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import FactorDefinition
from app.ai.factors.beleidsalignement import Randvoorwaarde


class GemeenteOpgave(BaseModel):
    """Per-gemeente woningbouwopgave-rij uit de Woondeal."""

    gemeente_naam: str = Field(min_length=1)
    toevoegingen: int | None = Field(default=None, ge=0, description="Aantal toe te voegen woningen")
    plancapaciteit: int | None = Field(default=None, ge=0, description="Aantal woningen in plancapaciteit")
    sleutelprojecten_aantal: int | None = Field(default=None, ge=0)
    sleutelprojecten_woningen: int | None = Field(default=None, ge=0)


class WoondealPayload(BaseModel):
    """Gestructureerde extractie van een regionale Woondeal."""

    regio_naam: str = Field(default="", description="Woondealregio, bv. Noord-Limburg")
    provincie: str | None = Field(default=None)
    periode: str | None = Field(default=None, description="bv. 2022-2030")
    gemeenten: list[GemeenteOpgave] = Field(default_factory=list)
    aandeel_betaalbaar: float | None = Field(default=None, ge=0.0, le=1.0, description="bv. 0.667 = 2/3")
    betaalbaar_definitie: str | None = Field(default=None)
    regelingen: list[str] = Field(default_factory=list, description="bv. KLC, BIRK, Woningbouwimpuls")
    doelgroepen: list[str] = Field(default_factory=list)
    randvoorwaarden: list[Randvoorwaarde] = Field(default_factory=list)
    algemeen_citaat: str = Field(default="")
    confidence: float = Field(ge=0.0, le=1.0)


_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "regio_naam": {"type": "string", "description": "Woondealregio (bv. Noord-Limburg)"},
        "provincie": {"type": "string"},
        "periode": {"type": "string", "description": "Looptijd, bv. 2022-2030"},
        "gemeenten": {
            "type": "array",
            "description": (
                "Per gemeente in de regio een rij met opgave + plancapaciteit. Neem ALLEEN "
                "gemeenten op die letterlijk in het document staan."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "gemeente_naam": {"type": "string", "minLength": 1},
                    "toevoegingen": {"type": "integer", "minimum": 0,
                                     "description": "Aantal toe te voegen woningen"},
                    "plancapaciteit": {"type": "integer", "minimum": 0,
                                       "description": "Aantal woningen in plancapaciteit"},
                    "sleutelprojecten_aantal": {"type": "integer", "minimum": 0},
                    "sleutelprojecten_woningen": {"type": "integer", "minimum": 0},
                },
                "required": ["gemeente_naam"],
                "additionalProperties": False,
            },
        },
        "aandeel_betaalbaar": {"type": "number", "minimum": 0.0, "maximum": 1.0,
                               "description": "Regio-breed betaalbaar-aandeel (2/3 = 0.667)"},
        "betaalbaar_definitie": {"type": "string",
                                 "description": "Wat valt onder 'betaalbaar' (huur-/koopgrenzen)"},
        "regelingen": {"type": "array", "items": {"type": "string"},
                       "description": "Genoemde regelingen/financiële instrumenten (KLC, BIRK, Woningbouwimpuls)"},
        "doelgroepen": {"type": "array", "items": {"type": "string"}},
        "randvoorwaarden": {
            "type": "array",
            "description": "Voorwaarden die een ontwikkelaar raken. Laat weg zonder letterlijke basis.",
            "items": {
                "type": "object",
                "properties": {
                    "categorie": {
                        "type": "string",
                        "enum": ["programmering", "financieel", "doelgroep", "duurzaamheid",
                                 "proces", "ruimtelijk", "markt", "overig"],
                    },
                    "titel": {"type": "string", "minLength": 1},
                    "samenvatting": {"type": "string", "minLength": 1},
                    "citaat": {"type": "string"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["categorie", "titel", "samenvatting"],
                "additionalProperties": False,
            },
        },
        "algemeen_citaat": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
    "required": ["confidence"],
}


WOONDEAL_FACTOR_DEF = FactorDefinition[WoondealPayload](
    factor_id="woondeal",
    tool_name="extract_woondeal",
    description=(
        "Extraheer uit deze regionale Woondeal: de woondealregio, de looptijd, en PER GEMEENTE "
        "de woningbouwopgave (toevoegingen) + plancapaciteit + aantal sleutelprojecten en "
        "bijbehorende woningen. Verzamel ook het regio-brede betaalbaar-aandeel met definitie, "
        "de genoemde regelingen (bv. KLC, BIRK, Woningbouwimpuls), doelgroepen en eventuele "
        "randvoorwaarden. Minimale velden: confidence."
    ),
    input_schema=_INPUT_SCHEMA,
    payload_model=WoondealPayload,
    prompt_instructions=(
        "Lees de Woondeal volledig door en beantwoord via het tool:\n"
        "1. regio_naam: de woondealregio (bv. 'Noord-Limburg'). periode: looptijd (bv. '2022-2030').\n"
        "2. gemeenten: voor ELKE gemeente met een opgave-rij: gemeente_naam exact zoals in het "
        "document, toevoegingen (aantal toe te voegen woningen), plancapaciteit, en — indien "
        "vermeld — sleutelprojecten_aantal + sleutelprojecten_woningen. Verzin GEEN locaties die "
        "niet letterlijk genoemd zijn.\n"
        "3. aandeel_betaalbaar: het regio-brede betaalbaar-streven als fractie (2/3 = 0.667). "
        "betaalbaar_definitie: de huur-/koopgrenzen die 'betaalbaar' afbakenen.\n"
        "4. regelingen: financiële instrumenten/regelingen die genoemd worden.\n"
        "5. randvoorwaarden: gebruik dezelfde categorieën-enum als beleidsalignement.\n"
        "6. confidence: 0.9+ bij heldere tabellen; <0.5 bij twijfel.\n\n"
        "HARDE REGELS:\n"
        "- Geen hallucinaties: laat een gemeente, getal of regeling weg zonder letterlijke basis.\n"
        "- Kopieer citaten letterlijk. Gebruik alleen informatie uit het document."
    ),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_woondeal_factor_def.py -v && ruff check app/ai/factors/woondeal.py && mypy app/ai/factors/woondeal.py`
Expected: 3 passed; ruff + mypy clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/factors/woondeal.py backend/tests/unit/test_woondeal_factor_def.py
git commit -m "M054/S06: Woondeal factor-def (typed extraction, context-only)"
```

---

### Task 2: Provincie-level document resolver + catalog fix

**Files:**
- Modify: `backend/app/services/cascade_enrichment_service.py` (add resolver near `get_grondprijs_document`, ~line 159)
- Modify: `backend/app/policy_documents/data_source_keys.py` (the `woondeals` entry, ~line 115-123)
- Test: `backend/tests/integration/test_woondeal_resolver.py`

**Interfaces:**
- Consumes: `GemeenteProvincieMap` (`app/models/gemeente_provincie_map.py`), `PolicyDocument`.
- Produces: `async def get_woondeal_document(db, *, gemeente_code, organization_id) -> PolicyDocument | None`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_woondeal_resolver.py
import uuid

import pytest

from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.policy_document import PolicyDocument
from app.services.cascade_enrichment_service import get_woondeal_document


@pytest.mark.asyncio
async def test_resolves_provincie_woondeal_for_gemeente(db_session):
    org_id = uuid.uuid4()
    db_session.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    doc = PolicyDocument(
        entity_type="provincie",
        entity_code="PV31",
        source_key="woondeals",
        title="Woondeal Limburg 2022-2030",
        is_global=True,
        organization_id=org_id,
        file_data=b"%PDF-1.7 fake",
        version_number=1,
    )
    db_session.add(doc)
    await db_session.commit()

    found = await get_woondeal_document(
        db_session, gemeente_code="GM0983", organization_id=org_id
    )
    assert found is not None
    assert found.source_key == "woondeals"
    assert found.entity_type == "provincie"


@pytest.mark.asyncio
async def test_returns_none_when_no_provincie_mapping(db_session):
    found = await get_woondeal_document(
        db_session, gemeente_code="GM9999", organization_id=uuid.uuid4()
    )
    assert found is None
```

(If the integration suite uses a different session fixture name than `db_session`, copy it from a neighbouring test in `backend/tests/integration/`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/integration/test_woondeal_resolver.py -v`
Expected: FAIL with `ImportError: cannot import name 'get_woondeal_document'`

- [ ] **Step 3: Write minimal implementation**

In `backend/app/services/cascade_enrichment_service.py`, add this import near the top model imports:

```python
from app.models.gemeente_provincie_map import GemeenteProvincieMap
```

Add the resolver immediately after `get_grondprijs_document` (after line ~159, before `get_parkeernormen_document`):

```python
async def get_woondeal_document(
    db: AsyncSession,
    *,
    gemeente_code: str,
    organization_id: uuid.UUID,
) -> PolicyDocument | None:
    """Zoek de regionale Woondeal op voor een gemeente (M054/S06, context-only).

    De Woondeal is provincie-niveau: resolve gemeente_code -> provincie_code via
    GemeenteProvincieMap, zoek dan het meest recente provincie-document met
    source_key="woondeals". Geeft None als er geen provincie-mapping of document is.
    """
    prov_stmt = select(GemeenteProvincieMap.provincie_code).where(
        GemeenteProvincieMap.gemeente_code == gemeente_code
    )
    provincie_code = (await db.execute(prov_stmt)).scalar_one_or_none()
    if not provincie_code:
        return None

    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "provincie",
            PolicyDocument.entity_code == provincie_code,
            PolicyDocument.source_key == "woondeals",
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
```

In `backend/app/policy_documents/data_source_keys.py`, fix the `woondeals` entry (lines ~115-123) — set provincie level and clear the stale scoring link:

```python
    DataSourceKeyEntry(
        key="woondeals",
        label_nl="Woondeals & woningbouwafspraken",
        source_type="A",
        description=(
            "Regionale afspraken woningbouwaantallen + versnellingslocaties."
        ),
        level="provincie",
        voedt_factor=(),  # context-only: woondeal feeds no scoring factor (M054/S06)
    ),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/integration/test_woondeal_resolver.py -v && python -m pytest tests/unit/test_data_source_keys_catalog.py -v && ruff check app/services/cascade_enrichment_service.py app/policy_documents/data_source_keys.py && mypy app/services/cascade_enrichment_service.py`
Expected: resolver tests pass; the catalog Python↔TS parity test still passes; ruff + mypy clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/cascade_enrichment_service.py backend/app/policy_documents/data_source_keys.py backend/tests/integration/test_woondeal_resolver.py
git commit -m "M054/S06: provincie-level Woondeal resolver + catalog fix"
```

---

### Task 3: Read-only gemeente woondeal endpoint

**Files:**
- Modify: `backend/app/schemas/gemeente.py` (add response schemas)
- Modify: `backend/app/api/endpoints/gemeente.py` (add route)
- Test: `backend/tests/integration/test_woondeal_endpoint.py`

**Interfaces:**
- Consumes: `get_woondeal_document` (Task 2), `WoondealPayload` (Task 1), `FactorExtractionCache`, `SCHEMA_VERSION`.
- Produces: `GET /api/gemeente/{gemeente_code}/woondeal?gemeente_naam=<naam>` → `WoondealGemeenteResponse`.
  - `WoondealGemeenteResponse` fields: `gemeente_naam: str`, `heeft_woondeal: bool`, `regio_naam: str | None`, `periode: str | None`, `opgave: WoondealOpgaveOut | None`, `aandeel_betaalbaar: float | None`, `betaalbaar_definitie: str | None`, `regelingen: list[str]`, `doelgroepen: list[str]`, `document_title: str | None`.
  - `WoondealOpgaveOut` fields: `gemeente_naam: str`, `toevoegingen: int | None`, `plancapaciteit: int | None`, `gat: int | None`, `sleutelprojecten_aantal: int | None`, `sleutelprojecten_woningen: int | None`.

**Design note:** The endpoint reads the extraction **cache only** (no live Claude call in a GET). Production is warmed by the re-extraction tool (Task 4). Cache-read mirrors `load_gemeente_cascade_payloads` in `app/services/cascade_scoring.py`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_woondeal_endpoint.py
import uuid

import pytest

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.policy_document import PolicyDocument


@pytest.mark.asyncio
async def test_woondeal_endpoint_returns_gemeente_row(auth_client, db_session, test_org_id):
    db_session.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    doc = PolicyDocument(
        entity_type="provincie", entity_code="PV31", source_key="woondeals",
        title="Woondeal Limburg 2022-2030", is_global=True,
        organization_id=test_org_id, file_data=b"%PDF fake", version_number=1,
    )
    db_session.add(doc)
    await db_session.flush()
    db_session.add(FactorExtractionCache(
        policy_document_id=doc.id, parcel_id=DOCUMENT_SENTINEL, factor_id="woondeal",
        schema_version=SCHEMA_VERSION,
        extracted_payload={
            "regio_naam": "Noord-Limburg", "provincie": "Limburg", "periode": "2022-2030",
            "gemeenten": [{"gemeente_naam": "Venlo", "toevoegingen": 1745,
                           "plancapaciteit": 1594, "sleutelprojecten_aantal": 2,
                           "sleutelprojecten_woningen": 706}],
            "aandeel_betaalbaar": 0.667, "betaalbaar_definitie": "huur/koop grenzen",
            "regelingen": ["KLC", "BIRK", "Woningbouwimpuls"], "doelgroepen": [],
            "randvoorwaarden": [], "algemeen_citaat": "", "confidence": 0.9,
        },
    ))
    await db_session.commit()

    resp = await auth_client.get("/api/gemeente/GM0983/woondeal?gemeente_naam=Venlo")
    assert resp.status_code == 200
    body = resp.json()
    assert body["heeft_woondeal"] is True
    assert body["regio_naam"] == "Noord-Limburg"
    assert body["opgave"]["toevoegingen"] == 1745
    assert body["opgave"]["gat"] == 151  # 1745 - 1594
    assert "Woningbouwimpuls" in body["regelingen"]


@pytest.mark.asyncio
async def test_woondeal_endpoint_absent_doc(auth_client):
    resp = await auth_client.get("/api/gemeente/GM9999/woondeal?gemeente_naam=Nergens")
    assert resp.status_code == 200
    assert resp.json()["heeft_woondeal"] is False
```

(Use whatever authenticated-client + org fixtures the integration suite already provides; copy fixture names from a neighbouring `test_*_endpoint.py`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/integration/test_woondeal_endpoint.py -v`
Expected: FAIL with 404 (route not registered).

- [ ] **Step 3: Write minimal implementation**

In `backend/app/schemas/gemeente.py`, add:

```python
class WoondealOpgaveOut(BaseModel):
    """Per-gemeente Woondeal-opgave for the gemeente-context surface."""

    gemeente_naam: str
    toevoegingen: int | None = None
    plancapaciteit: int | None = None
    gat: int | None = Field(default=None, description="toevoegingen - plancapaciteit")
    sleutelprojecten_aantal: int | None = None
    sleutelprojecten_woningen: int | None = None


class WoondealGemeenteResponse(BaseModel):
    """Woondeal context for a gemeente (context-only, no score)."""

    gemeente_naam: str
    heeft_woondeal: bool
    regio_naam: str | None = None
    periode: str | None = None
    opgave: WoondealOpgaveOut | None = None
    aandeel_betaalbaar: float | None = None
    betaalbaar_definitie: str | None = None
    regelingen: list[str] = Field(default_factory=list)
    doelgroepen: list[str] = Field(default_factory=list)
    document_title: str | None = None
```

In `backend/app/api/endpoints/gemeente.py`, add imports:

```python
from sqlalchemy import select

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.ai.factors.woondeal import WoondealPayload
from app.db.session import get_db  # use the existing get_db dependency path in this file
from app.models.factor_extraction_cache import FactorExtractionCache
from app.schemas.gemeente import WoondealGemeenteResponse, WoondealOpgaveOut
from app.services.cascade_enrichment_service import get_woondeal_document
```

(If `get_db` / `AsyncSession` are already imported in this router, reuse those; do not duplicate imports.)

Add the route (place after the huisvestingsverordening route, ~line 163):

```python
def _normalize_naam(naam: str) -> str:
    return " ".join(naam.lower().split())


@router.get("/{gemeente_code}/woondeal", response_model=WoondealGemeenteResponse)
@limiter.limit("60/minute")
async def get_woondeal(
    request: Request,
    gemeente_code: str,
    gemeente_naam: str,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> WoondealGemeenteResponse:
    """Woondeal context for a gemeente (context-only — no score).

    Reads the extraction cache only; production is warmed by
    `python -m app.tools.reextract_woondeal`.
    """
    gm = gemeente_code if gemeente_code.startswith("GM") else f"GM{gemeente_code}"
    doc = await get_woondeal_document(
        db, gemeente_code=gm, organization_id=current_user.organization_id
    )
    if doc is None:
        return WoondealGemeenteResponse(gemeente_naam=gemeente_naam, heeft_woondeal=False)

    cached = (
        await db.execute(
            select(FactorExtractionCache)
            .where(
                FactorExtractionCache.policy_document_id == doc.id,
                FactorExtractionCache.parcel_id == DOCUMENT_SENTINEL,
                FactorExtractionCache.factor_id == "woondeal",
                FactorExtractionCache.schema_version == SCHEMA_VERSION,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if cached is None:
        return WoondealGemeenteResponse(
            gemeente_naam=gemeente_naam, heeft_woondeal=False, document_title=doc.filename
        )

    payload = WoondealPayload.model_validate(cached.extracted_payload)
    needle = _normalize_naam(gemeente_naam)
    row = next(
        (g for g in payload.gemeenten if _normalize_naam(g.gemeente_naam) == needle), None
    )
    opgave = None
    if row is not None:
        gat = (
            row.toevoegingen - row.plancapaciteit
            if row.toevoegingen is not None and row.plancapaciteit is not None
            else None
        )
        opgave = WoondealOpgaveOut(
            gemeente_naam=row.gemeente_naam,
            toevoegingen=row.toevoegingen,
            plancapaciteit=row.plancapaciteit,
            gat=gat,
            sleutelprojecten_aantal=row.sleutelprojecten_aantal,
            sleutelprojecten_woningen=row.sleutelprojecten_woningen,
        )

    return WoondealGemeenteResponse(
        gemeente_naam=gemeente_naam,
        heeft_woondeal=True,
        regio_naam=payload.regio_naam or None,
        periode=payload.periode,
        opgave=opgave,
        aandeel_betaalbaar=payload.aandeel_betaalbaar,
        betaalbaar_definitie=payload.betaalbaar_definitie,
        regelingen=payload.regelingen,
        doelgroepen=payload.doelgroepen,
        document_title=doc.filename,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/integration/test_woondeal_endpoint.py -v && ruff check app/api/endpoints/gemeente.py app/schemas/gemeente.py && mypy app/api/endpoints/gemeente.py`
Expected: 2 passed; ruff + mypy clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/endpoints/gemeente.py backend/app/schemas/gemeente.py backend/tests/integration/test_woondeal_endpoint.py
git commit -m "M054/S06: GET /api/gemeente/{code}/woondeal (cache-read, context-only)"
```

---

### Task 4: Re-extraction CLI tool (warms the cache)

**Files:**
- Create: `backend/app/tools/reextract_woondeal.py`

**Interfaces:**
- Consumes: `WOONDEAL_FACTOR_DEF` (Task 1), `extract_factor`, `DOCUMENT_SENTINEL`.
- Produces: CLI `python -m app.tools.reextract_woondeal --provincie PV31`.

- [ ] **Step 1: Write the tool** (no unit test — operational script; verified by Step 2)

```python
# backend/app/tools/reextract_woondeal.py
"""Re-extract the regional Woondeal for a provincie (M054/S06).

Document-level extraction (force_refresh) that warms FactorExtractionCache so the
read-only /woondeal endpoint serves the structured payload. Run once after
uploading the Woondeal PDF as an entity_type=provincie, source_key=woondeals doc.

Usage:
    cd backend
    python -m app.tools.reextract_woondeal --provincie PV31
"""

import argparse
import asyncio

from sqlalchemy import or_, select

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL
from app.ai.factors.woondeal import WOONDEAL_FACTOR_DEF
from app.core.config import settings
from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.services.factor_extraction_service import extract_factor


async def main(provincie: str, model: str | None) -> None:
    if model:
        settings.AI_MODEL = model
        print(f"Using model override: {model}")
    async with async_session_factory() as db:
        stmt = (
            select(PolicyDocument)
            .where(
                PolicyDocument.entity_type == "provincie",
                PolicyDocument.entity_code == provincie,
                PolicyDocument.source_key == "woondeals",
                or_(PolicyDocument.is_global.is_(True), PolicyDocument.file_data.isnot(None)),
                PolicyDocument.file_data.isnot(None),
            )
            .order_by(PolicyDocument.version_number.desc(), PolicyDocument.created_at.desc())
            .limit(1)
        )
        doc = (await db.execute(stmt)).scalar_one_or_none()
        if doc is None:
            print(f"No woondeals document found for provincie={provincie}")
            return

        print(f"Re-extracting woondeal doc={doc.id} (force_refresh, live Claude call)...")
        result = await extract_factor(
            db,
            factor_def=WOONDEAL_FACTOR_DEF,
            parcel_id=DOCUMENT_SENTINEL,
            policy_document=doc,
            force_refresh=True,
        )
        p = result.payload
        print(f"  regio={p.regio_naam} periode={p.periode} confidence={p.confidence}")
        print(f"  gemeenten={len(p.gemeenten)} regelingen={p.regelingen}")
        for g in p.gemeenten:
            print(f"    {g.gemeente_naam}: opgave={g.toevoegingen} plancap={g.plancapaciteit}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--provincie", default="PV31", help="Provincie code, e.g. PV31 (Limburg)")
    parser.add_argument("--model", default=None, help="Optional AI_MODEL override")
    args = parser.parse_args()
    asyncio.run(main(args.provincie, args.model))
```

- [ ] **Step 2: Verify it imports + parses args (no live call)**

Run: `cd backend && python -m app.tools.reextract_woondeal --provincie PV31 --help && ruff check app/tools/reextract_woondeal.py && mypy app/tools/reextract_woondeal.py`
Expected: argparse help prints; ruff + mypy clean. (Full run is a deploy step — Task 10.)

- [ ] **Step 3: Commit**

```bash
git add backend/app/tools/reextract_woondeal.py
git commit -m "M054/S06: reextract_woondeal tool (warms extraction cache)"
```

---

### Task 5: Frontend `useWoondeal` hook

**Files:**
- Create: `frontend/src/hooks/useWoondeal.ts`

**Interfaces:**
- Produces: `useWoondeal(gemeenteCode: string | null, gemeenteNaam: string | null)` → TanStack query of `WoondealResponse`.
  - `WoondealResponse` / `WoondealOpgave` interfaces mirror `WoondealGemeenteResponse` / `WoondealOpgaveOut` (Task 3).

- [ ] **Step 1: Write the hook**

```typescript
// frontend/src/hooks/useWoondeal.ts
/**
 * TanStack Query hook for Woondeal gemeente-context (M054/S06, context-only).
 * Fetches from: GET /api/gemeente/{code}/woondeal?gemeente_naam={naam}
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface WoondealOpgave {
  gemeente_naam: string
  toevoegingen: number | null
  plancapaciteit: number | null
  gat: number | null
  sleutelprojecten_aantal: number | null
  sleutelprojecten_woningen: number | null
}

export interface WoondealResponse {
  gemeente_naam: string
  heeft_woondeal: boolean
  regio_naam: string | null
  periode: string | null
  opgave: WoondealOpgave | null
  aandeel_betaalbaar: number | null
  betaalbaar_definitie: string | null
  regelingen: string[]
  doelgroepen: string[]
  document_title: string | null
}

export function useWoondeal(
  gemeenteCode: string | null,
  gemeenteNaam: string | null,
) {
  const { accessToken } = useAuth()

  return useQuery<WoondealResponse, Error>({
    queryKey: ['woondeal', gemeenteCode, gemeenteNaam],
    queryFn: () =>
      apiFetch<WoondealResponse>(
        `/api/gemeente/${encodeURIComponent(gemeenteCode!)}/woondeal?gemeente_naam=${encodeURIComponent(gemeenteNaam!)}`,
        { method: 'GET', accessToken },
      ),
    staleTime: 60 * 60 * 1000, // 1h — woondeals change rarely
    enabled: !!accessToken && !!gemeenteCode && !!gemeenteNaam,
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useWoondeal.ts
git commit -m "M054/S06: useWoondeal hook"
```

---

### Task 6: `WoondealModal` (gemeente-panel home of record) + wiring

**Files:**
- Create: `frontend/src/components/map/panels/gemeente/WoondealModal.tsx`
- Modify: `frontend/src/components/map/panels/GemeenteContextPanel.tsx`
- Modify: `frontend/src/components/map/panels/gemeente/GemeenteOverview.tsx`

**Interfaces:**
- Consumes: `useWoondeal` (Task 5), `GemeenteModal` (`gemeente/GemeenteModal.tsx`).
- Produces: `<WoondealModal gemeenteCode gemeenteNaam onClose />`.

- [ ] **Step 1: Create the modal**

```typescript
// frontend/src/components/map/panels/gemeente/WoondealModal.tsx
import { GemeenteModal } from './GemeenteModal'
import { useWoondeal } from '@/hooks/useWoondeal'

interface WoondealModalProps {
  gemeenteCode: string
  gemeenteNaam: string
  onClose: () => void
}

export function WoondealModal({ gemeenteCode, gemeenteNaam, onClose }: WoondealModalProps) {
  const { data, isLoading } = useWoondeal(gemeenteCode, gemeenteNaam)
  const active = data?.heeft_woondeal ?? false
  const o = data?.opgave

  return (
    <GemeenteModal
      title="Woondeal"
      subtitle={active ? `${data?.regio_naam ?? 'Regionale'} woningbouwafspraak` : 'Geen woondeal-data'}
      onClose={onClose}
    >
      {isLoading && <p className="text-[13px] text-slate-400 text-center py-8">Laden...</p>}

      {!isLoading && !active && (
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Geen woondeal-context beschikbaar voor deze gemeente.
        </p>
      )}

      {!isLoading && active && (
        <div className="space-y-6">
          {/* Opgave */}
          {o && (
            <div className="rounded-[16px] p-5 bg-[#F8FAF9] border border-[#EAEFEF]">
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-3" style={{ letterSpacing: '0.2em' }}>
                Woningbouwopgave {data?.periode ?? ''}
              </h3>
              <p className="text-[22px] font-bold text-[#0E1111]">
                {o.toevoegingen?.toLocaleString('nl-NL') ?? '—'} woningen
              </p>
              <p className="text-[12px] text-slate-500 mt-1">
                {o.plancapaciteit?.toLocaleString('nl-NL') ?? '—'} in plancapaciteit
                {o.gat != null && o.gat > 0 ? ` · ~${o.gat.toLocaleString('nl-NL')} opgave-gat` : ''}
              </p>
              {o.sleutelprojecten_aantal != null && (
                <p className="text-[12px] text-slate-500 mt-1">
                  {o.sleutelprojecten_aantal} sleutelprojecten
                  {o.sleutelprojecten_woningen != null ? ` · ${o.sleutelprojecten_woningen.toLocaleString('nl-NL')} woningen` : ''}
                </p>
              )}
            </div>
          )}

          {/* Segment */}
          {data?.aandeel_betaalbaar != null && (
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-2" style={{ letterSpacing: '0.2em' }}>
                Segment (regio-afspraak)
              </h3>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                {Math.round(data.aandeel_betaalbaar * 100)}% betaalbaar
                {data.betaalbaar_definitie ? ` — ${data.betaalbaar_definitie}` : ''}
              </p>
            </div>
          )}

          {/* Regelingen */}
          {data && data.regelingen.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-2" style={{ letterSpacing: '0.2em' }}>
                Financiële rugwind
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.regelingen.map((r) => (
                  <span key={r} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Geldt voor heel {gemeenteNaam}. Informatief — telt niet mee in de perceelscore.
          </p>
        </div>
      )}
    </GemeenteModal>
  )
}
```

- [ ] **Step 2: Wire state + render into `GemeenteContextPanel.tsx`**

Add import (near the other gemeente-modal imports):

```typescript
import { WoondealModal } from './gemeente/WoondealModal'
```

Add state (after `const [showHuisvesting, setShowHuisvesting] = useState(false)`):

```typescript
  const [showWoondeal, setShowWoondeal] = useState(false)
```

Pass the callback to `<GemeenteOverview>` (alongside `onShowHuisvesting`):

```typescript
                  onShowWoondeal={() => setShowWoondeal(true)}
```

Render the modal inside `<AnimatePresence>` (after the `{showHuisvesting && (...)}` block):

```typescript
        {showWoondeal && (
          <WoondealModal
            gemeenteCode={code}
            gemeenteNaam={naam}
            onClose={() => setShowWoondeal(false)}
          />
        )}
```

- [ ] **Step 3: Add the trigger in `GemeenteOverview.tsx`**

Add `onShowWoondeal: () => void` to `GemeenteOverviewProps`, add `onShowWoondeal` to the destructured params, and add a `SecondaryField` trigger next to the huisvesting one (near lines 470-474):

```typescript
        <SecondaryField
          value={'Woondeal & woningbouwafspraken'}
          onClick={onShowWoondeal}
        />
```

- [ ] **Step 4: Typecheck + manual verify**

Run: `cd frontend && npm run check`
Expected: no errors.
Manual: start dev server (`npm run dev`, port 9300), open a Venlo gemeente panel → "Woondeal & woningbouwafspraken" field opens the modal. (Will show "Geen woondeal-data" until the doc is uploaded + extracted — Task 10.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/panels/gemeente/WoondealModal.tsx frontend/src/components/map/panels/GemeenteContextPanel.tsx frontend/src/components/map/panels/gemeente/GemeenteOverview.tsx
git commit -m "M054/S06: WoondealModal (gemeente-panel home of record) + wiring"
```

---

### Task 7: Parcel-panel woondeal context card

**Files:**
- Create: `frontend/src/components/map/panels/parcel/WoondealContextCard.tsx`
- Modify: `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`

**Interfaces:**
- Consumes: `useWoondeal` (Task 5), `ScanResultItem` (`parcel.gemeente_code`, `parcel.gemeente_naam`).
- Produces: `<WoondealContextCard gemeenteCode gemeenteNaam />` — violet context card, no contribution pill, "Geldt voor heel <gemeente>", deep-links to `/beleid`.

- [ ] **Step 1: Create the card**

```typescript
// frontend/src/components/map/panels/parcel/WoondealContextCard.tsx
/**
 * WoondealContextCard — calm gemeente-context block in the Potentie tab.
 * Context-only (NO contribution pill): the woondeal is identical for every parcel
 * in a gemeente, so it informs rather than scores. Deep-links to the /beleid hub.
 */
import { Building2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useWoondeal } from '@/hooks/useWoondeal'

interface WoondealContextCardProps {
  /** CBS gemeentecode, e.g. "0983" (no GM prefix). */
  gemeenteCode: string
  gemeenteNaam: string
}

export function WoondealContextCard({ gemeenteCode, gemeenteNaam }: WoondealContextCardProps) {
  const navigate = useNavigate()
  const { data } = useWoondeal(gemeenteCode, gemeenteNaam)
  if (!data?.heeft_woondeal || !data.opgave) return null

  const o = data.opgave
  const gmCode = gemeenteCode.startsWith('GM') ? gemeenteCode : `GM${gemeenteCode}`

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/beleid', search: { gemeente: gmCode, provincie: undefined, source: undefined, category: undefined, niveau: undefined } })}
      className="w-full rounded-[16px] border border-violet-200 bg-violet-50/50 p-3 text-left transition-colors hover:bg-violet-50 group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100">
          <Building2 size={12} className="text-violet-600" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
          Woondeal · geldt voor heel {gemeenteNaam}
        </span>
        <span className="ml-auto text-[10px] text-violet-400 group-hover:text-violet-600 transition-colors">
          Bekijk →
        </span>
      </div>
      <p className="text-[13px] font-semibold text-[#0E1111]">
        Opgave {o.toevoegingen?.toLocaleString('nl-NL') ?? '—'} woningen{data.periode ? ` tot ${data.periode.split('-').pop()}` : ''}
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5">
        {o.plancapaciteit?.toLocaleString('nl-NL') ?? '—'} in plancapaciteit
        {data.aandeel_betaalbaar != null ? ` · ${Math.round(data.aandeel_betaalbaar * 100)}% betaalbaar` : ''}
      </p>
    </button>
  )
}
```

- [ ] **Step 2: Render it in `PotentieLayer.tsx`**

Add the import (near line 16):

```typescript
import { WoondealContextCard } from '../WoondealContextCard'
```

`PotentieLayer` receives `parcel` and `gemeenteNaam`. Render the card just above the `Binnenkort` placeholder section (above the `<div className="shrink-0 mt-3 mb-1 ...">` at line ~488):

```typescript
        {parcel.gemeente_code && (
          <WoondealContextCard
            gemeenteCode={parcel.gemeente_code}
            gemeenteNaam={parcel.gemeente_naam ?? gemeenteNaam}
          />
        )}
```

(If `PotentieLayer`'s `parcel` prop type does not surface `gemeente_code`/`gemeente_naam`, they exist on `ScanResultItem` per `frontend/src/lib/types/scan.ts:14,16`; widen the local prop type to include them.)

- [ ] **Step 3: Typecheck + manual verify**

Run: `cd frontend && npm run check`
Expected: no errors.
Manual: open a Venlo parcel → Potentie tab shows the violet "Woondeal · geldt voor heel Venlo" card (after Task 10 extraction). Confirm there is NO green/red pill on it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/map/panels/parcel/WoondealContextCard.tsx frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx
git commit -m "M054/S06: parcel-panel Woondeal context card (no pill, deep-link)"
```

---

### Task 8: Retire the placeholder + label the source key

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/lib/factor-list.ts` (remove `woondeal_boost` from `PLANNED_POTENTIE`)
- Modify: `frontend/src/hooks/usePolicySummaries.ts` (add `woondeals` label)

- [ ] **Step 1: Remove the placeholder**

In `factor-list.ts`, delete the `woondeal_boost` object (lines ~49-56) from `PLANNED_POTENTIE`, leaving the array starting at `beleidsalignement_provincie`.

- [ ] **Step 2: Add the source-key label**

In `usePolicySummaries.ts`, add to `SOURCE_KEY_LABELS`:

```typescript
  woondeals: 'Woondeals',
```

- [ ] **Step 3: Run the affected tests**

Run: `cd frontend && npm run vitest -- factor-list && npm run check`
Expected: `factor-list.test.ts` still passes (it iterates generically — no length/key assertion on `woondeal_boost`); typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/map/panels/parcel/lib/factor-list.ts frontend/src/hooks/usePolicySummaries.ts
git commit -m "M054/S06: retire woondeal_boost placeholder + label woondeals source key"
```

---

### Task 9: Regression guard — woondeal must never become a silent scored factor

**Files:**
- Create: `backend/tests/regression/test_woondeal_is_context_only.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/regression/test_woondeal_is_context_only.py
"""REGRESSION: woondeal is context-only. It must never enter the scoring registry
(M054/S06). If a future slice activates a score signal, it does so deliberately —
this guard forces that decision to be explicit (update this test in lockstep).
"""
from app.services.score_v3 import FACTOR_REGISTRY


def test_woondeal_not_in_registry():
    assert "woondeal" not in FACTOR_REGISTRY
    assert "woondeal_boost" not in FACTOR_REGISTRY


def test_registry_count_still_29():
    assert len(FACTOR_REGISTRY) == 29
```

- [ ] **Step 2: Run it**

Run: `cd backend && python -m pytest tests/regression/test_woondeal_is_context_only.py tests/regression/test_score_v3_registry_29_factors.py -v`
Expected: all pass (29 unchanged; woondeal absent).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/regression/test_woondeal_is_context_only.py
git commit -m "M054/S06: regression guard — woondeal stays context-only"
```

---

### Task 10: Full validation + deploy runbook

**Files:**
- Modify: `docs/superpowers/specs/2026-06-22-woondeal-context-cascade-design.md` (append a "Shipped" note once verified)

- [ ] **Step 1: Full local validation**

Run:
```bash
cd backend && ruff check . && mypy . && python -m pytest tests/unit/test_woondeal_factor_def.py tests/integration/test_woondeal_resolver.py tests/integration/test_woondeal_endpoint.py tests/regression/test_woondeal_is_context_only.py -v
cd ../frontend && npm run check && npm run vitest -- factor-list
```
Expected: all green.

- [ ] **Step 2: Use verification-before-completion skill**, then deploy backend:

```bash
railway up backend --path-as-root --service api --ci
# Worker: only if a background job imports the new factor-def. rescore_cascade_job
# imports the cascade_enrichment_service MODULE (not WOONDEAL_FACTOR_DEF) and woondeal
# is NOT in _CASCADE_SOURCES, so a worker deploy is NOT required. Verify before skipping:
grep -rn "woondeal\|WOONDEAL" backend/app/jobs/ || echo "no job imports woondeal — worker deploy not needed"
```

- [ ] **Step 3: Upload the Woondeal Limburg PDF** as a provincie policy document (superadmin-only write path): `entity_type="provincie"`, `entity_code="PV31"`, `source_key="woondeals"`, `is_global=true`. (Use the existing policy-document upload/admin flow; the PDF is at `https://www.limburg.nl/publish/pages/9413/woondeal_limburg.pdf`.)

- [ ] **Step 4: Warm the extraction cache** (prod, via the PostGIS public proxy or a prod shell):

```bash
cd backend && python -m app.tools.reextract_woondeal --provincie PV31
```
Expected: prints `regio=Noord-Limburg`, the Venlo row `opgave=1745 plancap=1594`, and `regelingen=['KLC', 'BIRK', 'Woningbouwimpuls']`. Confirm NO "2.718" anywhere.

- [ ] **Step 5: Deploy frontend** (Vercel auto-deploys from `main`) and verify on prod:
  - Venlo gemeente panel → Woondeal modal shows 1.745 / 1.594 / regelingen.
  - Venlo parcel → Potentie tab shows the violet context card, no pill.
  - **No** map colour change; **no** re-score ran.

- [ ] **Step 6: Append "Shipped" note to the design spec + commit**

```bash
git add docs/superpowers/specs/2026-06-22-woondeal-context-cascade-design.md
git commit -m "docs: woondeal context-cascade shipped note (M054/S06)"
```

---

## Self-Review

**Spec coverage:**
- §4.1 extraction (factor-def, resolver, data_source_keys) → Tasks 1, 2. ✓
- §4.2 delivery (read-only endpoint, no scoring breakdown) → Task 3; policy-summary label → Task 8. ✓ (Spec open-question on provincie summary resolution is closed: `get_summaries` already walks the gemeente→provincie ancestor chain, so an extracted woondeal doc surfaces in `usePolicySummaries`.)
- §4.3 frontend (gemeente modal, parcel block, rapport, placeholder removal) → Tasks 6, 7, 8. Rapport one-liner: covered by the policy-summary label (Task 8) feeding the existing `usePolicySummariesByWoonplaats` rapport path; no new rapport code needed. ✓
- §7 not-doing (no registry/score/re-score) → enforced by Task 9 regression. ✓
- §8 testing → Tasks 1,2,3,9. ✓
- §9 deploy → Task 10. ✓

**Placeholder scan:** No TBD/TODO. Two "if the fixture/prop differs, copy from neighbour" notes are concrete fallbacks, not placeholders (exact source file given).

**Type consistency:** `WoondealPayload`/`GemeenteOpgave` (Task 1) ↔ `WoondealGemeenteResponse`/`WoondealOpgaveOut` (Task 3) ↔ `WoondealResponse`/`WoondealOpgave` (Task 5) field names align. `get_woondeal_document(db, *, gemeente_code, organization_id)` signature consistent across Tasks 2, 3, 4. `factor_id="woondeal"` consistent across Tasks 1, 3, 4, 9.

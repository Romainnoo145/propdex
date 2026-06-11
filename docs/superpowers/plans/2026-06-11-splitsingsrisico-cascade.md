# Splitsingsrisico Cascade (Huisvestingsverordening Venlo 2026) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nieuwe cascade-factor `splitsingsrisico` (risico-categorie) gevoed door de gemeentelijke huisvestingsverordening, end-to-end live voor Venlo (GM0983) — eerste Wave-1-slice uit `.planning/CASCADE-BUILD-INVENTARISATIE.md`.

**Architecture:** Kloon van het gelockte S07/S01-cascadepatroon (beleidsalignement): typed LLM-extractie (Anthropic tool-use + `input_schema`) → `FactorExtractionCache` → shared `cascade_scoring`-service → `compute_score_v3` append-after-redistribution met verdict-gating. Nieuw t.o.v. eerdere cascades: per-parcel **buurt-matching** (de Venlose opkoopbescherming geldt per CBS-buurt), dus `parcel_cache` krijgt een `buurt_code`-kolom + backfill via PDOK CBS gebiedsindelingen WFS.

**Tech Stack:** FastAPI/SQLAlchemy 2.x async, Alembic, PostGIS (SRID 28992), Pydantic v2, Anthropic tool-use via OpenRouter-factory, React/TanStack frontend, vitest.

**Slice:** M053/S12 — alle commits `M053/S12: <wat>`.

---

## Domeinfeiten (uit de PDF — geverifieerd 2026-06-11)

Bron-PDF: `/home/klarifai/Documents/Propdex/Huisvestingsverordening gemeente Venlo 2026 _ Lokale wet- en regelgeving.pdf` (8 fysieke pagina's, 60 KB tekst, CVDR759788, geldig 01-07-2026 t/m 30-06-2030).

- **GEEN voorraad-vergunningstelsel** (onttrekking/splitsing/omzetting/woningvorming) in Venlo — het schema moet die wél generiek ondersteunen (andere gemeenten hebben het), maar voor Venlo blijft de lijst leeg.
- **Art. 13 opkoopbescherming**: verhuurverbod 4 jaar na inschrijving voor "beschermde woonruimte" = woonruimte in **20 met name genoemde CBS-buurten** (codes BU0983xxxx, o.a. Craneveld BU09831401, Q4 BU09831102, Vastenavondkamp-Noord BU09832202) **én** WOZ-waarde ≤ **€306.000 (peiljaar 2022)**, met uitzonderingen (corporatie/gemeente-eigendom, nieuwbouw eerste 3 maanden, al >6 mnd verhuurd).
- **Art. 2 huisvestingsvergunning**: alleen corporatie-sociale-huur — display-context, geen ontwikkelaar-risico.
- WOZ-dekking in `scan_results.flags` is ~0 (1/63.817 lokaal) → de scorer MOET "WOZ onbekend" netjes afhandelen (verdict `mogelijk_van_toepassing`).
- `parcel_cache.geometry` SRID = **28992**; buurt-geometrieën via PDOK WFS `gebiedsindelingen:buurt_gegeneraliseerd` met `srsName=EPSG:28992` → join zonder transform.

## Conventies die je MOET volgen

- **SCHEMA_VERSION (=6) NIET bumpen** — nieuwe factor_id heeft eigen cache-rij; bestaande payload-shapes wijzigen niet (`backend/app/ai/factor_extraction_schemas.py:114`).
- Cascade-factoren worden in `compute_score_v3` NA de missing-data-redistribution toegevoegd, gewicht 0 bij `missing=True`, en gewicht alleen bij een relevant verdict (zie beleidsalignement-gating `backend/app/services/score_v3.py:638-658`).
- Risico-registry som default_weight = 100. Herbalanceren via `_rebalance_risico_weights` (public, `score_v3.py:97`) naar 93 + nieuwe factor 7.
- Factor-bestand is self-contained (eigen `Randvoorwaarde`-model, zoals woonvisie/beleidsalignement elk hun eigen hebben — check eerst of beleidsalignement.Randvoorwaarde importeerbaar gedeeld is; zo niet: lokaal definiëren).
- Transactions: direct `db.add()/flush()/commit()`, datetimes naive `datetime.utcnow()`.
- Screenshot vóór push (frontend-wijziging) — memory-regel.

---

### Task 1: Alembic-migratie `parcel_cache.buurt_code`

**Files:**
- Create: `backend/alembic/versions/<rev>_m053_s12_parcel_cache_buurt_code.py` (via alembic autogenerate-naam)
- Modify: `backend/app/models/parcel_cache.py`

- [ ] **Step 1: Model-veld toevoegen**

In `backend/app/models/parcel_cache.py`, naast `gemeente_code`:

```python
    buurt_code: Mapped[str | None] = mapped_column(
        String(12),
        nullable=True,
        index=True,
        comment="CBS buurtcode (BU + 8 cijfers), gevuld via backfill_buurt_codes",
    )
```

- [ ] **Step 2: Migratie genereren**

Run: `cd backend && alembic revision --autogenerate -m "m053_s12_parcel_cache_buurt_code"`
Controleer dat de gegenereerde migratie ALLEEN `add_column` + `create_index` voor `buurt_code` bevat — verwijder eventuele ruis.

- [ ] **Step 3: Migratie draaien + verifiëren**

Run: `cd backend && alembic upgrade head && docker exec propdex-db psql -U postgres -d propdex -c "\d parcel_cache" | grep buurt`
Expected: kolom `buurt_code | character varying(12)`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/parcel_cache.py backend/alembic/versions/
git commit -m "M053/S12: parcel_cache.buurt_code kolom (CBS buurt, nullable + index)"
```

### Task 2: Backfill-tool buurt-codes (PDOK WFS spatial join)

**Files:**
- Create: `backend/app/tools/backfill_buurt_codes.py`
- Test: `backend/tests/unit/test_backfill_buurt_codes.py`

- [ ] **Step 1: Failing test voor de WFS-filterbouw + statcode-parsing**

```python
"""Unit tests M053/S12 — buurt-backfill helpers (geen netwerk/DB)."""
from app.tools.backfill_buurt_codes import build_buurt_filter, parse_buurt_features


def test_build_buurt_filter_strips_gm_prefix():
    f = build_buurt_filter("GM0983")
    assert "<Literal>BU0983%</Literal>" in f
    assert "statcode" in f


def test_parse_buurt_features_returns_code_geometry_pairs():
    fc = {
        "features": [
            {
                "properties": {"statcode": "BU09831401", "statnaam": "Craneveld"},
                "geometry": {"type": "MultiPolygon", "coordinates": [[[[1, 1], [2, 1], [2, 2], [1, 1]]]]},
            },
            {"properties": {"statcode": "WK098314"}, "geometry": None},  # geen buurt / geen geom → skip
        ]
    }
    out = parse_buurt_features(fc)
    assert len(out) == 1
    assert out[0][0] == "BU09831401"
    assert out[0][1]["type"] == "MultiPolygon"
```

- [ ] **Step 2: Run test → FAIL** (`module not found`)

Run: `cd backend && python -m pytest tests/unit/test_backfill_buurt_codes.py -v`

- [ ] **Step 3: Tool implementeren**

`backend/app/tools/backfill_buurt_codes.py` — kloon de WFS-aanpak van `app/services/wijk_service.py:34-70` (OGC XML FILTER, NIET CQL_FILTER):

```python
"""Backfill parcel_cache.buurt_code via PDOK CBS gebiedsindelingen WFS (M053/S12).

Per gemeente: haal alle buurt_gegeneraliseerd features op (EPSG:28992, zelfde
SRID als parcel_cache.geometry) en zet buurt_code via PostGIS spatial join
(ST_Intersects op ST_PointOnSurface van het perceel —一 perceel = één buurt).

Usage: python -m app.tools.backfill_buurt_codes --gemeente GM0983
Onderdeel van het runbook "nieuwe gemeente onboarden" (net als backfill_3dbag/cbs).
"""
import argparse
import asyncio
import json
import logging

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)

WFS_URL = "https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0"


def build_buurt_filter(gemeente_code: str) -> str:
    code = gemeente_code.removeprefix("GM")
    if not code.isdigit() or len(code) != 4:
        raise ValueError(f"Invalid gemeente_code {gemeente_code!r}")
    return (
        "<Filter><PropertyIsLike wildCard='%' singleChar='_' escapeChar='\\\\'>"
        "<PropertyName>statcode</PropertyName>"
        f"<Literal>BU{code}%</Literal>"
        "</PropertyIsLike></Filter>"
    )


def parse_buurt_features(fc: dict) -> list[tuple[str, dict]]:
    out: list[tuple[str, dict]] = []
    for feat in fc.get("features", []):
        code = (feat.get("properties") or {}).get("statcode") or ""
        geom = feat.get("geometry")
        if code.startswith("BU") and geom:
            out.append((code, geom))
    return out


async def fetch_buurten(client: httpx.AsyncClient, gemeente_code: str) -> list[tuple[str, dict]]:
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gebiedsindelingen:buurt_gegeneraliseerd",
        "outputFormat": "application/json",
        "srsName": "EPSG:28992",
        "FILTER": build_buurt_filter(gemeente_code),
    }
    resp = await client.get(WFS_URL, params=params, timeout=60.0)
    resp.raise_for_status()
    return parse_buurt_features(resp.json())


async def backfill_gemeente(session: AsyncSession, gemeente_code: str, buurten: list[tuple[str, dict]]) -> int:
    """Per buurt één UPDATE met ST_Intersects op ST_PointOnSurface (point-in-polygon,
    voorkomt dubbeltelling bij percelen op buurtgrenzen)."""
    total = 0
    for code, geom in buurten:
        result = await session.execute(
            text(
                "UPDATE parcel_cache SET buurt_code = :code "
                "WHERE gemeente_code = :gem AND ST_Intersects("
                "  ST_PointOnSurface(geometry),"
                "  ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 28992)"
                ")"
            ),
            {"code": code, "gem": gemeente_code, "geojson": json.dumps(geom)},
        )
        total += result.rowcount or 0
        logger.info("buurt %s: %s percelen", code, result.rowcount)
    await session.commit()
    return total


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gemeente", required=True, help="bv. GM0983")
    args = parser.parse_args()

    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with httpx.AsyncClient() as client:
        buurten = await fetch_buurten(client, args.gemeente)
    logger.info("%d buurten opgehaald voor %s", len(buurten), args.gemeente)
    async with session_factory() as session:
        total = await backfill_gemeente(session, args.gemeente, buurten)
    logger.info("Klaar: %d percelen van buurt_code voorzien", total)
    await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
```

- [ ] **Step 4: Run tests → PASS**

Run: `cd backend && python -m pytest tests/unit/test_backfill_buurt_codes.py -v`

- [ ] **Step 5: Backfill draaien op lokale DB + verifiëren**

Run: `cd backend && python -m app.tools.backfill_buurt_codes --gemeente GM0983`
Verifieer: `docker exec propdex-db psql -U postgres -d propdex -t -c "SELECT count(*) FILTER (WHERE buurt_code IS NOT NULL), count(*) FROM parcel_cache WHERE gemeente_code='GM0983';"`
Expected: >95% gevuld (gegeneraliseerde buurtgrenzen kunnen randpercelen missen — dat is acceptabel; scorer behandelt buurt_code None als missing).

- [ ] **Step 6: Commit**

```bash
git add backend/app/tools/backfill_buurt_codes.py backend/tests/unit/test_backfill_buurt_codes.py
git commit -m "M053/S12: backfill_buurt_codes tool (PDOK buurt WFS -> PostGIS spatial join)"
```

### Task 3: Payload-schema + FactorDefinition

**Files:**
- Create: `backend/app/ai/factors/splitsingsrisico.py`
- Test: `backend/tests/unit/test_splitsingsrisico_schema.py`

- [ ] **Step 1: Failing test**

Kloon de opzet van `backend/tests/unit/test_beleidsalignement_schema.py`:

```python
"""Unit tests M053/S12 — HuisvestingsverordeningPayload schema."""
import pytest
from pydantic import ValidationError

from app.ai.factors.splitsingsrisico import (
    HUISVESTINGSVERORDENING_FACTOR_DEF,
    HuisvestingsverordeningPayload,
)


def _venlo_payload() -> dict:
    return {
        "geldig_van": "2026-07-01",
        "geldig_tot": "2030-06-30",
        "voorraad_vergunningplichten": [],
        "huisvestingsvergunning_scope": "corporatie_sociale_huur",
        "opkoopbescherming": {
            "van_kracht": True,
            "duur_jaren": 4,
            "woz_grens_eur": 306000,
            "woz_peiljaar": 2022,
            "buurten": [
                {"buurt_naam": "Craneveld", "cbs_buurt_code": "BU09831401"},
                {"buurt_naam": "Q4", "cbs_buurt_code": "BU09831102"},
            ],
            "citaat": "Gedurende de periode van vier jaren na de datum van inschrijving is het verboden beschermde woonruimte te verhuren zonder verhuurvergunning opkoopbescherming.",
        },
        "randvoorwaarden": [],
        "confidence": 0.95,
    }


def test_payload_validates_venlo_shape():
    p = HuisvestingsverordeningPayload.model_validate(_venlo_payload())
    assert p.opkoopbescherming is not None
    assert p.opkoopbescherming.woz_grens_eur == 306000
    assert p.opkoopbescherming.buurten[0].cbs_buurt_code == "BU09831401"
    assert p.voorraad_vergunningplichten == []


def test_payload_rejects_unknown_vergunningplicht():
    bad = _venlo_payload()
    bad["voorraad_vergunningplichten"] = ["verhuurverbod"]  # geen geldige enum
    with pytest.raises(ValidationError):
        HuisvestingsverordeningPayload.model_validate(bad)


def test_factor_def_wiring():
    assert HUISVESTINGSVERORDENING_FACTOR_DEF.factor_id == "splitsingsrisico"
    assert HUISVESTINGSVERORDENING_FACTOR_DEF.payload_model is HuisvestingsverordeningPayload
    schema = HUISVESTINGSVERORDENING_FACTOR_DEF.input_schema
    assert "opkoopbescherming" in schema["properties"]
    assert "confidence" in schema["required"]
```

- [ ] **Step 2: Run → FAIL** (`module not found`)

Run: `cd backend && python -m pytest tests/unit/test_splitsingsrisico_schema.py -v`

- [ ] **Step 3: Factor-bestand schrijven**

`backend/app/ai/factors/splitsingsrisico.py` — kloon structuur van `beleidsalignement.py` (Pydantic-modellen → `_INPUT_SCHEMA` dict → `FactorDefinition`). Kernmodellen:

```python
VoorraadVergunningplicht = Literal["onttrekking", "splitsing", "omzetting", "woningvorming"]


class OpkoopBuurt(BaseModel):
    buurt_naam: str = Field(min_length=1, description="Buurtnaam exact zoals in document")
    cbs_buurt_code: str | None = Field(
        default=None, description="CBS-code BU + 8 cijfers indien in document genoemd"
    )


class Opkoopbescherming(BaseModel):
    van_kracht: bool
    duur_jaren: int | None = None
    woz_grens_eur: int | None = Field(default=None, description="WOZ-bovengrens in euro's")
    woz_peiljaar: int | None = None
    buurten: list[OpkoopBuurt] = Field(default_factory=list)
    citaat: str | None = None
    pagina: int | None = Field(default=None, ge=1)


class HuisvestingsverordeningPayload(BaseModel):
    geldig_van: str | None = Field(default=None, description="ISO-datum, bv. 2026-07-01")
    geldig_tot: str | None = None
    voorraad_vergunningplichten: list[VoorraadVergunningplicht] = Field(default_factory=list)
    voorraad_citaat: str | None = None
    huisvestingsvergunning_scope: str = Field(
        default="", description="Bv. corporatie_sociale_huur — display-context"
    )
    opkoopbescherming: Opkoopbescherming | None = None
    randvoorwaarden: list[Randvoorwaarde] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
```

`Randvoorwaarde`: hergebruik door import als die in `beleidsalignement.py` staat én daar publiek is (`from app.ai.factors.beleidsalignement import Randvoorwaarde`); de klasse is generiek (categorie/titel/samenvatting/citaat/pagina) dus importeren is DRY en de cache-shape blijft identiek. `_INPUT_SCHEMA`: spiegel de Pydantic-modellen exact (zelfde verplichte velden: `required: ["confidence"]` op root + `van_kracht` binnen opkoopbescherming; `additionalProperties: False` per object zoals in beleidsalignement).

`prompt_instructions` (kern — volledig uitschrijven in de file):
1. geldig_van/geldig_tot uit intitulé/slotbepalingen;
2. voorraad_vergunningplichten: ALLEEN opnemen als de verordening een vergunningstelsel voor onttrekking/splitsing/omzetting/woningvorming bevat (hoofdstuk "woonruimtevoorraad") — anders lege lijst;
3. opkoopbescherming: van_kracht, duur, WOZ-grens + peiljaar, ALLE genoemde buurten met CBS-code (staat tussen haakjes achter de naam, bv. "Craneveld (BU09831401)"), letterlijk citaat;
4. randvoorwaarden: uitzonderingen en voorwaarden die een ontwikkelaar raken (bv. "nieuwbouw eerste 3 maanden vrijgesteld", "moet-verlening bij woningcorporatie-verhuur") — zelfde categorieën-enum als beleidsalignement;
5. HARDE REGELS: geen hallucinaties, citaten letterlijk, alleen documentinformatie.

- [ ] **Step 4: Run → PASS**, ruff + mypy schoon

Run: `cd backend && python -m pytest tests/unit/test_splitsingsrisico_schema.py -v && ruff check app/ai/factors/splitsingsrisico.py && mypy app/ai/factors/splitsingsrisico.py`

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/factors/splitsingsrisico.py backend/tests/unit/test_splitsingsrisico_schema.py
git commit -m "M053/S12: huisvestingsverordening extraction schema + FactorDefinition"
```

### Task 4: Scorer `score_splitsingsrisico`

**Files:**
- Modify: `backend/app/services/score_v3_factors.py` (append, na `score_beleidsalignement`)
- Test: `backend/tests/unit/test_score_splitsingsrisico.py`

- [ ] **Step 1: Failing tests** (kloon opzet `test_score_beleidsalignement.py`)

```python
"""Unit tests M053/S12 — score_splitsingsrisico (opkoopbescherming + voorraadstelsel)."""
from app.ai.factors.splitsingsrisico import HuisvestingsverordeningPayload
from app.services.score_v3_factors import score_splitsingsrisico


def _payload(**overrides) -> HuisvestingsverordeningPayload:
    base = {
        "voorraad_vergunningplichten": [],
        "opkoopbescherming": {
            "van_kracht": True,
            "duur_jaren": 4,
            "woz_grens_eur": 306000,
            "woz_peiljaar": 2022,
            "buurten": [{"buurt_naam": "Craneveld", "cbs_buurt_code": "BU09831401"}],
        },
        "confidence": 0.9,
    }
    base.update(overrides)
    return HuisvestingsverordeningPayload.model_validate(base)


def test_no_payload_is_missing():
    r = score_splitsingsrisico(None, buurt_code="BU09831401", woz_waarde=None, has_pand=True)
    assert r.missing is True and r.categorie == "risico" and r.bijdrage == 0.0


def test_geen_pand_niet_van_toepassing():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09831401", woz_waarde=None, has_pand=False)
    assert r.missing is False
    assert r.waarde["verdict"] == "niet_van_toepassing"
    assert r.genormaliseerde_score == 0.0


def test_beschermde_buurt_woz_onder_grens_van_toepassing():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09831401", woz_waarde=250000, has_pand=True)
    assert r.waarde["verdict"] == "van_toepassing"
    assert r.genormaliseerde_score >= 0.8
    assert "Craneveld" in r.toelichting_kort


def test_beschermde_buurt_woz_boven_grens():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09831401", woz_waarde=400000, has_pand=True)
    assert r.waarde["verdict"] == "boven_woz_grens"
    assert r.genormaliseerde_score <= 0.2


def test_beschermde_buurt_woz_onbekend_mogelijk():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09831401", woz_waarde=None, has_pand=True)
    assert r.waarde["verdict"] == "mogelijk_van_toepassing"
    assert 0.4 <= r.genormaliseerde_score <= 0.6


def test_buurt_buiten_lijst_geen_risico():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09839999", woz_waarde=None, has_pand=True)
    assert r.waarde["verdict"] == "buiten_beschermd_gebied"
    assert r.genormaliseerde_score == 0.0


def test_buurt_onbekend_terwijl_regeling_geldt_is_missing():
    r = score_splitsingsrisico(_payload(), buurt_code=None, woz_waarde=None, has_pand=True)
    assert r.missing is True  # eerlijk: we kunnen het niet weten zonder buurt


def test_voorraadstelsel_zonder_opkoop_geeft_basisrisico():
    p = _payload(voorraad_vergunningplichten=["splitsing", "omzetting"], opkoopbescherming=None)
    r = score_splitsingsrisico(p, buurt_code="BU09831401", woz_waarde=None, has_pand=True)
    assert r.waarde["verdict"] == "vergunningstelsel_voorraad"
    assert 0.3 <= r.genormaliseerde_score <= 0.7
```

- [ ] **Step 2: Run → FAIL**

Run: `cd backend && python -m pytest tests/unit/test_score_splitsingsrisico.py -v`

- [ ] **Step 3: Scorer implementeren** in `score_v3_factors.py`

Signature + kernlogica (volg de FactorResult-velden van `score_beleidsalignement`, categorie `"risico"`, `data_bronnen=["Gemeentelijke huisvestingsverordening"]`):

```python
def score_splitsingsrisico(
    payload: HuisvestingsverordeningPayload | None,
    *,
    buurt_code: str | None,
    woz_waarde: float | None,
    has_pand: bool | None,
) -> FactorResult:
    """M053/S12: opkoopbescherming + voorraad-vergunningstelsel uit de
    huisvestingsverordening. Hogere genormaliseerde_score = meer risico.

    Verdicts: geen_regeling | niet_van_toepassing | buiten_beschermd_gebied |
    boven_woz_grens | mogelijk_van_toepassing | van_toepassing |
    vergunningstelsel_voorraad. missing=True bij geen payload óf (regeling
    van kracht maar buurt_code None — zonder buurt kunnen we niets zeggen).
    """
```

Beslistabel (in deze volgorde):
1. `payload is None` → missing=True, score 0, "Geen huisvestingsverordening beschikbaar voor deze gemeente (factor niet meegewogen)."
2. `has_pand is not True` → verdict `niet_van_toepassing`, score 0.0 ("Onbebouwd perceel — opkoopbescherming geldt voor bestaande woonruimte; nieuwbouw is de eerste drie maanden na oplevering uitgezonderd.").
3. Opkoopbescherming `van_kracht` met buurten:
   - `buurt_code is None` → missing=True ("Buurt-gegevens ontbreken voor dit perceel — risico onbepaald.").
   - buurt in `{b.cbs_buurt_code}` (match óók op genormaliseerde buurt_naam als code in document ontbreekt):
     - `woz_waarde` bekend ≤ grens → `van_toepassing`, score 0.85, toelichting met buurtnaam + grens + duur.
     - `woz_waarde` bekend > grens → `boven_woz_grens`, score 0.1.
     - `woz_waarde` None (of grens None) → `mogelijk_van_toepassing`, score 0.5 ("WOZ-waarde onbekend; binnen beschermde buurt — verhuurvergunning waarschijnlijk vereist bij aankoop ≤ €306.000.").
   - buurt niet in lijst → `buiten_beschermd_gebied`, score 0.0.
4. Geen opkoopbescherming maar `voorraad_vergunningplichten` niet leeg → `vergunningstelsel_voorraad`, score 0.5 (vergunningplicht voor splitsen/omzetten = procesrisico, geen verbod).
5. Anders → `geen_regeling`, score 0.0.

`waarde` dict altijd vullen: `{"verdict": ..., "buurt_naam": ..., "woz_grens_eur": ..., "duur_jaren": ..., "vergunningplichten": [...]}` (None-velden weglaten niet nodig — frontend leest verdict). Import van het payload-model bovenin bij de andere factor-imports.

- [ ] **Step 4: Run → PASS** + ruff/mypy

Run: `cd backend && python -m pytest tests/unit/test_score_splitsingsrisico.py -v && ruff check app/services/score_v3_factors.py && mypy app/services/score_v3_factors.py`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/score_v3_factors.py backend/tests/unit/test_score_splitsingsrisico.py
git commit -m "M053/S12: score_splitsingsrisico (opkoopbescherming buurt+WOZ match)"
```

### Task 5: Registry-entry + risico-rebalance + guards

**Files:**
- Modify: `backend/app/services/score_v3.py` (FACTOR_REGISTRY)
- Modify: `backend/tests/regression/test_score_v3_registry_26_factors.py` → rename `..._27_factors.py`
- Create: `backend/tests/unit/test_registry_splitsingsrisico_rebalance.py`
- Check/modify: `backend/tests/regression/test_woonvisie_unchanged.py`, `backend/tests/unit/test_factor_registry_bron_field.py`, `backend/tests/unit/test_compute_score_v3_redistribution.py`

- [ ] **Step 1: Rebalance-getallen berekenen**

Run dit éénmalig om de nieuwe gewichten te bepalen (largest-remainder, exact zoals M050/S03):

```bash
cd backend && python -c "
from app.services.score_v3 import FACTOR_REGISTRY, _rebalance_risico_weights
current = {k: e.default_weight for k, e in FACTOR_REGISTRY.items() if e.category == 'risico'}
print(sum(current.values()))  # moet 100 zijn
new = _rebalance_risico_weights(current, target_sum=93)
for k in sorted(new): print(k, current[k], '->', new[k])
print('som:', sum(new.values()))  # moet 93 zijn
"
```

- [ ] **Step 2: Failing rebalance-test schrijven** (kloon `test_registry_beleidsalignement_rebalance.py`)

```python
"""M053/S12 — splitsingsrisico registry-entry + risico-rebalance som=100."""
from app.services.score_v3 import FACTOR_REGISTRY


def test_splitsingsrisico_registered_risico_weight_7():
    e = FACTOR_REGISTRY["splitsingsrisico"]
    assert e.category == "risico"
    assert e.default_weight == 7
    assert e.bron == "gemeente_beleid"


def test_risico_weights_sum_100_after_rebalance():
    total = sum(e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "risico")
    assert total == 100
```

- [ ] **Step 3: Run → FAIL** (KeyError splitsingsrisico)

- [ ] **Step 4: Registry aanpassen**

In `FACTOR_REGISTRY`: pas de 16 bestaande risico-gewichten aan naar de Step-1-uitkomst, elk met comment `# was X, rebalanced by M053/S12`, en voeg toe:

```python
    "splitsingsrisico": FactorRegistryEntry(
        id="splitsingsrisico",
        category="risico",
        default_weight=7,
        weight_by_projecttype=None,
        data_source="Gemeentelijke huisvestingsverordening (LLM-extracted)",
        bron="gemeente_beleid",
    ),
```

- [ ] **Step 5: Guards bijwerken**

- `git mv backend/tests/regression/test_score_v3_registry_26_factors.py backend/tests/regression/test_score_v3_registry_27_factors.py` en update count 26 → 27 + neem `splitsingsrisico` op in de verwachte-factoren-lijst (volg exact wat c8f8db33 deed voor 25→26).
- `test_woonvisie_unchanged.py`: draai — woonvisie/beleidsalignement-gewichten (potentie) wijzigen NIET, dus moet groen blijven zonder edits.
- `test_factor_registry_bron_field.py` + `test_compute_score_v3_redistribution.py`: draai en update tellingen waar nodig (S01 raakte beide).

- [ ] **Step 6: Volledige unit+regression run → PASS**

Run: `cd backend && python -m pytest tests/unit tests/regression -q`
LET OP: memory meldt 3 pre-existing stale M047 golden-score-asserts (todo `76a3b170`) — als ALLEEN die falen, niet fixen in deze slice; alles anders moet groen.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/score_v3.py backend/tests/
git commit -m "M053/S12: register splitsingsrisico (risico w=7) + rebalance 16 risico weights"
```

### Task 6: Document-loader + cascade-service wiring + buurt/woz in parcel_data

**Files:**
- Modify: `backend/app/services/cascade_enrichment_service.py` (loader, kloon `get_omgevingsvisie_document`)
- Modify: `backend/app/services/cascade_scoring.py` (`_CASCADE_SOURCES` + `build_parcel_data`)
- Modify: `backend/app/jobs/area_scan.py` (Phase 6 inline parcel_data: `buurt_code` toevoegen)
- Test: `backend/tests/services/test_cascade_scoring.py` (uitbreiden), `backend/tests/unit/test_cascade_enrichment_splitsingsrisico.py`

- [ ] **Step 1: Failing loader-test** (kloon `test_cascade_enrichment_beleidsalignement.py` — zelfde mock-aanpak, `source_key="huisvestingsverordening"`)

- [ ] **Step 2: Loader implementeren**

`get_huisvestingsverordening_document(db, *, gemeente_code, organization_id)` — letterlijke kloon van `get_omgevingsvisie_document` met `source_key == "huisvestingsverordening"`. BELANGRIJK: deze source_key matcht `AUTO_INGESTIBLE_DOCUMENTS` in `app/policy_documents/auto_ingest.py` — toekomstige CVDR-versies komen dan automatisch in dezelfde cascade.

- [ ] **Step 3: `_CASCADE_SOURCES` uitbreiden** in `cascade_scoring.py`:

```python
_CASCADE_SOURCES: tuple[tuple[str, Any, type[Any]], ...] = (
    ("woonvisie_match", get_woonvisie_document, WoonvisiePayload),
    ("beleidsalignement", get_omgevingsvisie_document, OmgevingsvisiePayload),
    ("splitsingsrisico", get_huisvestingsverordening_document, HuisvestingsverordeningPayload),
)
```

- [ ] **Step 4: `build_parcel_data` + area_scan Phase 6 inline builder uitbreiden**

In `cascade_scoring.build_parcel_data`: `"buurt_code": parcel_cache.buurt_code,` toevoegen aan het dict. In `area_scan.py` Phase 6 (regel ~943-949, het `if pc:`-blok): `parcel_data["buurt_code"] = pc.buurt_code` toevoegen. PARITEIT: beide builders moeten dezelfde keys zetten — voeg een assert-test toe in `tests/services/test_cascade_scoring.py` die `build_parcel_data` output-keys vergelijkt met wat de scorer nodig heeft (`buurt_code`, `woz`, `has_pand`). `woz` zit al in `_FLAG_OVERLAY_KEYS` — niets te doen.

- [ ] **Step 5: Service-tests draaien → PASS**

Run: `cd backend && python -m pytest tests/services/test_cascade_scoring.py tests/unit/test_cascade_enrichment_splitsingsrisico.py -v`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ backend/app/jobs/area_scan.py backend/tests/
git commit -m "M053/S12: wire splitsingsrisico into cascade loader + parcel_data buurt_code"
```

### Task 7: `compute_score_v3` cascade-blok

**Files:**
- Modify: `backend/app/services/score_v3.py` (na het beleidsalignement-blok, regel ~658)
- Test: `backend/tests/unit/test_compute_score_v3_splitsingsrisico.py`

- [ ] **Step 1: Failing test**

```python
"""M053/S12 — splitsingsrisico in compute_score_v3: verdict-gating + sparse weight-0."""
from app.ai.factors.splitsingsrisico import HuisvestingsverordeningPayload
from app.services.score_v3 import compute_score_v3

_PAYLOAD = HuisvestingsverordeningPayload.model_validate({
    "opkoopbescherming": {
        "van_kracht": True, "duur_jaren": 4, "woz_grens_eur": 306000,
        "buurten": [{"buurt_naam": "Craneveld", "cbs_buurt_code": "BU09831401"}],
    },
    "confidence": 0.9,
})


def _parcel(buurt: str | None) -> dict:
    return {"area_m2": 500, "has_pand": True, "buurt_code": buurt, "woz": None}


def test_in_beschermde_buurt_krijgt_gewicht():
    r = compute_score_v3(_parcel("BU09831401"), {}, cascade_payloads={"splitsingsrisico": _PAYLOAD})
    f = r.score_breakdown["splitsingsrisico"]
    assert f.waarde["verdict"] == "mogelijk_van_toepassing"
    assert f.gewicht == 7.0 and f.bijdrage > 0


def test_buiten_beschermd_gebied_context_only():
    r = compute_score_v3(_parcel("BU09839999"), {}, cascade_payloads={"splitsingsrisico": _PAYLOAD})
    f = r.score_breakdown["splitsingsrisico"]
    assert f.waarde["verdict"] == "buiten_beschermd_gebied"
    assert f.gewicht == 0.0 and f.bijdrage == 0.0  # zichtbaar in card, telt niet mee


def test_geen_payload_missing_weight_0():
    r = compute_score_v3(_parcel("BU09831401"), {}, cascade_payloads={})
    f = r.score_breakdown["splitsingsrisico"]
    assert f.missing is True and f.gewicht == 0
```

- [ ] **Step 2: Run → FAIL** (KeyError splitsingsrisico in breakdown)

- [ ] **Step 3: Cascade-blok toevoegen** in `compute_score_v3`, direct na het beleidsalignement-blok — zelfde patroon (append na redistribution, gewicht alleen bij relevant verdict):

```python
    # Cascade factor: splitsingsrisico (Huisvestingsverordening — M053/S12). Zelfde
    # sparse-behandeling; gewicht alleen wanneer de regeling dit perceel echt raakt
    # (van_toepassing / mogelijk_van_toepassing / vergunningstelsel_voorraad) zodat
    # "geen regeling / buiten gebied" de kaart niet kleurt.
    _sr_result = score_splitsingsrisico(
        _cascade.get("splitsingsrisico"),
        buurt_code=parcel_data.get("buurt_code"),
        woz_waarde=(parcel_data.get("woz") or {}).get("woz_waarde")
        if isinstance(parcel_data.get("woz"), dict) else None,
        has_pand=parcel_data.get("has_pand"),
    )
    _sr_waarde = _sr_result.waarde if isinstance(_sr_result.waarde, dict) else {}
    _sr_actief = _sr_waarde.get("verdict") in {
        "van_toepassing", "mogelijk_van_toepassing", "vergunningstelsel_voorraad",
    }
    if not _sr_result.missing and _sr_actief:
        _sr_entry = FACTOR_REGISTRY["splitsingsrisico"]
        _sr_weight = float(
            (_sr_entry.weight_by_projecttype or {}).get(project_type, _sr_entry.default_weight)
        )
        _sr_result.gewicht = _sr_weight
        _sr_result.bijdrage = round(_sr_result.genormaliseerde_score * _sr_weight, 4)
        _sr_result.percentage_of_category = round(_sr_weight / 100.0, 4)
    breakdown["splitsingsrisico"] = _sr_result
```

LET OP de `woz`-shape: controleer in de M052 WOZ-code hoe `flags["woz"]` eruitziet (dict met `woz_waarde`-key of kale float) en pas de extractie hierboven daarop aan — schrijf de test op de echte shape.

- [ ] **Step 4: Run → PASS** + volledige score-suite

Run: `cd backend && python -m pytest tests/unit/test_compute_score_v3_splitsingsrisico.py tests/unit/test_compute_score_v3_redistribution.py tests/regression -q`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/score_v3.py backend/tests/unit/test_compute_score_v3_splitsingsrisico.py
git commit -m "M053/S12: wire splitsingsrisico into compute_score_v3 (verdict-gated)"
```

### Task 8: Seed-tool Venlo

**Files:**
- Create: `backend/app/tools/seed_huisvestingsverordening_venlo.py`

- [ ] **Step 1: Tool schrijven** — kloon `app/tools/seed_omgevingsvisie_venlo.py` integraal en pas aan:
  - default `--pdf` pad: `/home/klarifai/Documents/Propdex/Huisvestingsverordening gemeente Venlo 2026 _ Lokale wet- en regelgeving.pdf`
  - `source_key="huisvestingsverordening"`, `entity_type="gemeente"`, `entity_code="GM0983"`, `is_global=True`, `title="Huisvestingsverordening gemeente Venlo 2026"`
  - PDF is 260 KB → onder de 30 MB-grens, dus géén fitz-tekstlaag-route nodig; het bestaande oversized-pad in de kloon blijft gewoon staan (no-op).
  - Idempotent: bestaande (entity, source_key) → version_number bump zoals het origineel doet.

- [ ] **Step 2: Seeden + verifiëren**

Run: `cd backend && python -m app.tools.seed_huisvestingsverordening_venlo`
Verifieer: `docker exec propdex-db psql -U postgres -d propdex -c "SELECT id, source_key, entity_code, is_global FROM policy_documents WHERE source_key='huisvestingsverordening';"`
Noteer het document-UUID — nodig in Task 10.

- [ ] **Step 3: Commit**

```bash
git add backend/app/tools/seed_huisvestingsverordening_venlo.py
git commit -m "M053/S12: seed tool Huisvestingsverordening Venlo 2026"
```

### Task 9: Frontend — popup + card in RisicoLayer

**Files:**
- Create: `frontend/src/components/map/panels/parcel/HuisvestingsverordeningPopup.tsx`
- Create: `frontend/src/components/map/panels/parcel/__tests__/HuisvestingsverordeningPopup.test.tsx`
- Create: `frontend/src/stories/parcel/HuisvestingsverordeningPopup.stories.tsx`
- Modify: `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx`
- Modify: `frontend/src/lib/factor-groups.ts` (1 regel: `splitsingsrisico` → groep)

- [ ] **Step 1: Bestudeer eerst `OmgevingsvisiePopup.tsx` + hoe `PotentieLayer.tsx` hem aanroept** (S01-commits `0ab568bb` + `2d8f14c5`). Spiegel dat 1-op-1 in RisicoLayer: FactorCard voor `splitsingsrisico` met klikbare popup.

- [ ] **Step 2: Popup bouwen — minimal per gelockt S07-patroon + Aura/DESIGN.md** (dot+label, plain citaat, één-zins verdict; GEEN extra frames/iconen/grids — memory: minimal versie wint). Inhoud per verdict:
  - `van_toepassing` / `mogelijk_van_toepassing`: "Opkoopbescherming — verhuurverbod {duur_jaren} jaar na aankoop" + buurtnaam + WOZ-grens + citaat + randvoorwaarden-sectie (display-only, zelfde collapsible als OmgevingsvisiePopup).
  - `buiten_beschermd_gebied` / `boven_woz_grens` / `geen_regeling`: één neutrale zin.
  - test: render per verdict-state + geen-data-state (kloon testopzet `OmgevingsvisiePopup.test.tsx`).

- [ ] **Step 3: Tests + check draaien**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/__tests__/HuisvestingsverordeningPopup.test.tsx && npm run check`

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "M053/S12: HuisvestingsverordeningPopup + splitsingsrisico card in RisicoLayer"
```

### Task 10: End-to-end lokaal — extractie + recompute + visuele verificatie

- [ ] **Step 1: Extractie + recompute via het echte prod-pad** (rescore-job-functie direct aanroepen; refresht doc-level cache en draait `recompute_gemeente_cascade`):

```bash
cd backend && python -c "
import asyncio
from app.jobs.rescore_cascade_job import rescore_parcels_for_document
out = asyncio.run(rescore_parcels_for_document({}, document_id='<UUID uit Task 8>'))
print(out)
"
```
Expected: status ok, processed ≈ 63k, 1 Claude-call (doc-level, daarna cache).

- [ ] **Step 2: DB-verificatie — differentiatie checken**

```bash
docker exec propdex-db psql -U postgres -d propdex -c "
SELECT flags->'score_breakdown'->'splitsingsrisico'->'waarde'->>'verdict' AS verdict, count(*)
FROM scan_results GROUP BY 1 ORDER BY 2 DESC;"
```
Expected: mix van `buiten_beschermd_gebied` (meeste), `mogelijk_van_toepassing` (percelen in de 20 buurten), `niet_van_toepassing` (onbebouwd), geen NULL-explosie.

- [ ] **Step 3: Visuele verificatie + screenshot (VERPLICHT vóór push)** — dev-servers draaien al (frontend :9300, backend :8000). Open een perceel in een beschermde buurt (bv. Craneveld of Q4, Venlo-Zuid/Binnenstad), open de Risico-layer → splitsingsrisico-card → popup. Screenshot maken en aan de user tonen.

- [ ] **Step 4: Volledige test-suite + checks**

Run: `cd backend && python -m pytest -q && ruff check . && mypy . && cd ../frontend && npm run check`

- [ ] **Step 5: Afsluitende commit (restjes) — geen push tot user de screenshot heeft gezien**

### Task 11: Prod-uitrol (na user-akkoord op screenshot)

- [ ] **Step 1:** Merge naar main + push (auto-deploy doet Vercel + Railway api; migratie draait via start_web.sh on boot).
- [ ] **Step 2:** ⚠️ **Worker handmatig deployen** (auto-deploy dekt de worker NIET — zie memory deploy-procedure): `railway up backend --path-as-root --service worker --ci`, daarna ARQ-heartbeat checken in prod Redis.
- [ ] **Step 3:** Prod-data: buurt-backfill + seed + rescore lokaal tegen prod-DB via gondola-proxy (memory: tools lokaal draaien, NIET railway ssh):

```bash
cd backend
export DATABASE_URL=$(railway variables --service PostGIS --kv | grep '^DATABASE_URL=' | cut -d= -f2- | sed -E 's#^postgres://#postgresql+asyncpg://#')
python -m app.tools.backfill_buurt_codes --gemeente GM0983
python -m app.tools.seed_huisvestingsverordening_venlo
python -c "import asyncio; from app.jobs.rescore_cascade_job import rescore_parcels_for_document; print(asyncio.run(rescore_parcels_for_document({}, document_id='<prod UUID>')))"
```
LET OP: prod-migratie (`buurt_code`) moet vóór de backfill gedraaid zijn — check `alembic current` via de api-deploy-log of wacht tot de api-deploy SUCCESS is.
- [ ] **Step 4:** Verifieer op propdex.nl met demo-login (info@hauzer.nl) — perceel in beschermde buurt toont de card; verdictverdeling via psql tegen prod.

---

## Self-review checklist (gedaan bij schrijven)

- Spec-dekking: schema generiek (voorraadstelsel + opkoopbescherming) ✓, buurt-matching infra ✓, S07-randvoorwaarden ✓, registry-rebalance + guards ✓, beide parcel_data-builders ✓, seed + e2e + prod ✓.
- Geen SCHEMA_VERSION-bump nodig (nieuwe factor_id) — expliciet vastgelegd.
- Type-consistentie: `score_splitsingsrisico(payload, *, buurt_code, woz_waarde, has_pand)` overal gelijk; verdict-strings overal identiek (`van_toepassing`, `mogelijk_van_toepassing`, `boven_woz_grens`, `buiten_beschermd_gebied`, `niet_van_toepassing`, `vergunningstelsel_voorraad`, `geen_regeling`).
- Open punt voor executor: exacte shape van `flags["woz"]` checken (Task 7 Step 3) en `Randvoorwaarde`-import (Task 3 Step 3) — beide met expliciete instructie in de taak.

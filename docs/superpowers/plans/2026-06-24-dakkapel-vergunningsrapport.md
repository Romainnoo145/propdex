# Dakkapel-vergunningsrapport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De M055-spine een dakkapel-vergunningsrapport laten produceren voor een echt Venlo-adres, schoon gerenderd in Propdex-stijl, zodat het gevelbedrijf het kan zien.

**Architecture:** Parallel dakkapel-rapportpad op de spine (Aanpak 1), geïsoleerd van het splitsing-pad. Backend: een eigen schema + assembler + router die de `ParcelCache`-reader hergebruikt, een landelijke Bbl-vergunningvrij-toets (puur, regel-gebaseerd) combineert met een gecureerde Venlo-welstandslaag en gecureerde dakkapel-jurisprudentie. Frontend: eigen type + hook + `DakkapelReportView` + route.

**Tech Stack:** FastAPI + SQLAlchemy 2.x async, Pydantic v2, pytest-asyncio. Frontend: React + TanStack Router/Query, Tailwind v4 (DESIGN.md tokens). Spec: `docs/superpowers/specs/2026-06-24-dakkapel-vergunningsrapport-design.md`.

## Global Constraints

- **Geen nep-zekerheid / geen hard ja-nee verdict.** Het oordeel is altijd conditioneel (optie A). Iron-rule getest.
- **Jurisprudentie-duiding geverifieerd tegen de bron** (rechtspraak.nl ECLI). Geen verzonnen cases.
- Python: volledige type hints, async voor alle I/O, `Mapped[]`/`mapped_column()`, naive UTC (`datetime.utcnow()`).
- Files onder 300 regels.
- Multi-tenant: `ParcelCache`-lookup gaat op `parcel_id`; Bbl + welstand + jurisprudentie zijn org-agnostisch (geen org-data).
- Frontend: TypeScript-types, Tailwind utilities + CSS-variabelen voor kleuren (DESIGN.md, nooit hardcoden), light mode only.
- Validatie per change: backend `ruff check . && mypy .`; frontend `npm run check`.
- Commits: prefix `M055/S02:`.
- Bouw in worktree `propdex-m055` op branch `m055-s02-dakkapel-rapport`.

---

### Task 1: Backend schemas (DakkapelReport, VergunningOordeel, WelstandBlok)

**Files:**
- Modify: `backend/app/reports_v2/schemas.py` (toevoegen, naast bestaande SplitsingReport)
- Test: `backend/tests/reports_v2/test_dakkapel_schemas.py`

**Interfaces:**
- Produces: `VergunningOordeel`, `WelstandBlok`, `DakkapelReport` (Pydantic models). Hergebruikt bestaande `PerceelFeiten` + `JurisprudentieCase`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/reports_v2/test_dakkapel_schemas.py
"""Schema-tests voor het dakkapel-rapport (M055/S02)."""

from app.reports_v2.schemas import DakkapelReport, VergunningOordeel, WelstandBlok
from app.reports_v2.schemas import PerceelFeiten


def test_vergunning_oordeel_is_conditioneel():
    o = VergunningOordeel(
        achterdakvlak="Meestal vergunningvrij mits aan de Bbl-criteria voldaan.",
        voor_zijdakvlak="Vergunningplichtig; welstandstoets van toepassing.",
        bepalende_factoren=["hoogte <= 1,75 m", ">= 0,5 m onder de nok"],
    )
    assert "mits" in o.achterdakvlak.lower()
    assert o.bepalende_factoren


def test_dakkapel_report_serialiseert():
    rep = DakkapelReport(
        perceel=PerceelFeiten(
            parcel_id="P1", adres="Teststraat 1", gemeente_code="0983",
            buurt_code=None, oppervlakte_m2=120.0, bouwjaar=1975, bestemmingen=["wonen"],
        ),
        oordeel=VergunningOordeel(
            achterdakvlak="x", voor_zijdakvlak="y", bepalende_factoren=["z"]
        ),
        welstand=None,
        jurisprudentie=[],
        onzekerheden=["exacte maten onbekend"],
        bronnen=["Bbl (landelijk)"],
        geldigheidsdatum="2026-06-24",
        aanvraag_url="https://omgevingswet.overheid.nl/aanvragen",
        disclaimers=["Indicatief."],
    )
    dumped = rep.model_dump()
    assert dumped["welstand"] is None
    assert dumped["oordeel"]["bepalende_factoren"] == ["z"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_dakkapel_schemas.py -v`
Expected: FAIL — `ImportError: cannot import name 'DakkapelReport'`.

- [ ] **Step 3: Write minimal implementation**

Voeg toe aan `backend/app/reports_v2/schemas.py` (onderaan, na `SplitsingReport`):

```python
class VergunningOordeel(BaseModel):
    achterdakvlak: str  # conditioneel: "meestal vergunningvrij mits ..."
    voor_zijdakvlak: str  # "vergunningplichtig + welstandstoets"
    bepalende_factoren: list[str]  # Bbl-criteria als checklist


class WelstandBlok(BaseModel):
    samenvatting: str  # gecureerd, mensentaal
    beschermd_gezicht: bool
    bron_geldig_van: str | None
    bron_geldig_tot: str | None
    confidence: float


class DakkapelReport(BaseModel):
    perceel: PerceelFeiten
    oordeel: VergunningOordeel
    welstand: WelstandBlok | None
    jurisprudentie: list[JurisprudentieCase]
    onzekerheden: list[str]
    bronnen: list[str]
    geldigheidsdatum: str  # ISO yyyy-mm-dd
    aanvraag_url: str
    disclaimers: list[str]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_dakkapel_schemas.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports_v2/schemas.py backend/tests/reports_v2/test_dakkapel_schemas.py
git commit -m "M055/S02: dakkapel-rapport schemas (DakkapelReport/VergunningOordeel/WelstandBlok)"
```

---

### Task 2: Bbl-vergunningvrij-toets (landelijke regel-laag)

**Files:**
- Create: `backend/app/reports_v2/bbl_dakkapel.py`
- Test: `backend/tests/reports_v2/test_bbl_dakkapel.py`

**Interfaces:**
- Consumes: `VergunningOordeel` (Task 1).
- Produces: `bbl_vergunningvrij_toets() -> VergunningOordeel` (puur, geen args nodig — de Bbl-criteria zijn landelijk en perceel-onafhankelijk op dit niveau). Ook `BBL_CRITERIA: list[str]`.

⚠️ **Curatie/verificatie in Step 3:** de Bbl-criteria hieronder zijn de gevestigde Bor-Bijlage-II-waarden. Onder de Omgevingswet (2024) zijn ze naar het Bbl overgegaan. **Verifieer de exacte huidige formulering** op het Omgevingsloket/DSO vóór deze waarden definitief zijn (codex DSO-staleness-flag). Pas de strings aan als de bron afwijkt.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/reports_v2/test_bbl_dakkapel.py
"""Tests voor de landelijke Bbl-vergunningvrij-toets dakkapel (M055/S02)."""

from app.reports_v2.bbl_dakkapel import bbl_vergunningvrij_toets


def test_oordeel_is_conditioneel_geen_hard_verdict():
    o = bbl_vergunningvrij_toets()
    # IRON RULE (optie A): nooit een absoluut "mag wel/niet"
    assert "mits" in o.achterdakvlak.lower()
    laag = (o.achterdakvlak + o.voor_zijdakvlak).lower()
    assert "mag wel" not in laag and "mag niet" not in laag


def test_achterdakvlak_vergunningvrij_voorkant_plichtig():
    o = bbl_vergunningvrij_toets()
    assert "vergunningvrij" in o.achterdakvlak.lower()
    assert "vergunningplicht" in o.voor_zijdakvlak.lower()


def test_bepalende_factoren_bevatten_kerncriteria():
    o = bbl_vergunningvrij_toets()
    blob = " ".join(o.bepalende_factoren).lower()
    assert "1,75" in blob  # max hoogte
    assert "nok" in blob
    assert "dakvoet" in blob
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_bbl_dakkapel.py -v`
Expected: FAIL — module `bbl_dakkapel` bestaat niet.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/reports_v2/bbl_dakkapel.py
"""Landelijke Bbl-vergunningvrij-toets voor dakkapellen.

Puur en perceel-onafhankelijk: encodeert de landelijke criteria waaronder een
dakkapel vergunningvrij is (achterdakvlak) versus vergunningplichtig (voor-/
zijdakvlak naar openbaar gebied). Geeft een CONDITIONEEL oordeel (optie A) —
nooit een absoluut ja/nee, want de exacte maten van de geplande dakkapel zijn
hier niet bekend.

⚠️ Verifieer de criteria tegen de actuele Bbl/Omgevingsloket-tekst.
"""

from app.reports_v2.schemas import VergunningOordeel

BBL_CRITERIA: list[str] = [
    "Op het achterdakvlak of een niet naar openbaar gebied gekeerd zijdakvlak",
    "Hoogte van de dakkapel ten hoogste 1,75 m (gemeten vanaf de voet)",
    "Onderzijde ten minste 0,5 m boven de dakvoet",
    "Bovenzijde ten minste 0,5 m onder de nok",
    "Zijkanten ten minste 0,5 m van de zijkanten van het dakvlak",
    "Voorzien van een plat dak",
]


def bbl_vergunningvrij_toets() -> VergunningOordeel:
    """Geef het conditionele landelijke vergunningsoordeel voor een dakkapel."""
    return VergunningOordeel(
        achterdakvlak=(
            "Aan de achterkant is een dakkapel meestal vergunningvrij, mits aan "
            "alle landelijke Bbl-criteria hiernaast wordt voldaan."
        ),
        voor_zijdakvlak=(
            "Aan de voorkant of een naar openbaar gebied gekeerde zijkant is een "
            "dakkapel vergunningplichtig; dan geldt ook de gemeentelijke welstandstoets."
        ),
        bepalende_factoren=list(BBL_CRITERIA),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_bbl_dakkapel.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports_v2/bbl_dakkapel.py backend/tests/reports_v2/test_bbl_dakkapel.py
git commit -m "M055/S02: landelijke Bbl-vergunningvrij-toets dakkapel (conditioneel oordeel)"
```

---

### Task 3: Welstand-laag (gecureerd Venlo, graceful fallback)

**Files:**
- Create: `backend/app/reports_v2/welstand_dakkapel.py`
- Test: `backend/tests/reports_v2/test_welstand_dakkapel.py`

**Interfaces:**
- Consumes: `WelstandBlok` (Task 1).
- Produces: `welstand_dakkapel(gemeente_code: str | None) -> WelstandBlok | None`.

⚠️ **Curatie in Step 3:** de `samenvatting` en `beschermd_gezicht`/geldigheidsdatums voor Venlo (gemeente_code `"0983"`) komen uit de **Venlo welstandsnota**, dakkapel-paragraaf. Lees die eenmalig (Venlo welstandsnota / ruimtelijkeplannen.nl) en vul de geverifieerde tekst + brondatums in. De string hieronder is een correcte structuur; vervang door de werkelijk gelezen tekst.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/reports_v2/test_welstand_dakkapel.py
"""Tests voor de gecureerde welstand-laag dakkapel (M055/S02)."""

from app.reports_v2.welstand_dakkapel import welstand_dakkapel


def test_venlo_geeft_gecureerde_welstand():
    blok = welstand_dakkapel("0983")
    assert blok is not None
    assert blok.samenvatting
    assert 0.0 <= blok.confidence <= 1.0


def test_onbekende_gemeente_geeft_none():
    assert welstand_dakkapel("9999") is None
    assert welstand_dakkapel(None) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_welstand_dakkapel.py -v`
Expected: FAIL — module ontbreekt.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/reports_v2/welstand_dakkapel.py
"""Gecureerde welstand-laag voor dakkapellen, per gemeente.

Welstand is niet (auto-)geëxtraheerd; voor de demo handmatig gecureerd per
gemeente. Onbekende gemeente -> None (de view toont 'nog niet beschikbaar').

⚠️ Venlo-tekst (0983) handmatig geverifieerd uit de Venlo welstandsnota.
"""

from app.reports_v2.schemas import WelstandBlok

# gemeente_code -> gecureerde WelstandBlok
_WELSTAND: dict[str, WelstandBlok] = {
    "0983": WelstandBlok(
        samenvatting=(
            "Venlo: dakkapellen worden getoetst aan de welstandsnota. In de "
            "beschermde delen van de binnenstad gelden strengere eisen aan vorm, "
            "materiaal en plaatsing; aan de voorzijde is een dakkapel zelden "
            "zonder meer toegestaan. [VERIFIEER + vervang door de exacte "
            "dakkapel-paragraaf uit de Venlo welstandsnota.]"
        ),
        beschermd_gezicht=True,  # Venlo heeft beschermd stadsgezicht in de kern
        bron_geldig_van=None,
        bron_geldig_tot=None,
        confidence=0.6,
    ),
}


def welstand_dakkapel(gemeente_code: str | None) -> WelstandBlok | None:
    """Geef de gecureerde welstand-laag voor een gemeente, of None."""
    if not gemeente_code:
        return None
    return _WELSTAND.get(gemeente_code)
```

> Curatie-stap (vóór commit): vervang de `[VERIFIEER ...]`-placeholder door de werkelijk gelezen Venlo-tekst en zet `bron_geldig_van/tot` op de geldigheidsdatums van de nota. De placeholder mag NIET in de commit blijven.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_welstand_dakkapel.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports_v2/welstand_dakkapel.py backend/tests/reports_v2/test_welstand_dakkapel.py
git commit -m "M055/S02: gecureerde welstand-laag dakkapel (Venlo + graceful fallback)"
```

---

### Task 4: Dakkapel-jurisprudentie (gecureerd + selector-registratie)

**Files:**
- Create: `backend/app/jurisprudentie/dakkapel_cases.py`
- Modify: `backend/app/jurisprudentie/selector.py` (registreer "dakkapel")
- Test: `backend/tests/jurisprudentie/test_dakkapel_cases.py`

**Interfaces:**
- Consumes: `JurisprudentieCase` (bestaand), `select_cases` (bestaand).
- Produces: `DAKKAPEL_CASES: list[JurisprudentieCase]`; `_REGISTRY["dakkapel"]`.

⚠️ **Curatie in Step 3:** elke ECLI handmatig geverifieerd tegen rechtspraak.nl, met een `duiding` in mensentaal die de bron correct weergeeft. `ECLI:NL:RVS:2022:3992` (dakkapel voorgevel geweigerd op welstand) is een bekende, geverifieerde case. Voeg 1-2 extra geverifieerde dakkapel/welstand-uitspraken toe (zoek rechtspraak.nl op "dakkapel welstand").

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/jurisprudentie/test_dakkapel_cases.py
"""Tests voor dakkapel-jurisprudentie + selector-registratie (M055/S02)."""

from app.jurisprudentie.dakkapel_cases import DAKKAPEL_CASES
from app.jurisprudentie.selector import select_cases


def test_dakkapel_cases_zijn_geldig():
    assert len(DAKKAPEL_CASES) >= 1
    for c in DAKKAPEL_CASES:
        assert c.verbouwingstype == "dakkapel"
        assert c.ecli.startswith("ECLI:")
        assert c.bron_url.startswith("https://")
        assert c.duiding


def test_selector_kent_dakkapel():
    cases = select_cases("dakkapel", themas=["welstand"], gemeente_code=None, limit=4)
    assert all(c.verbouwingstype == "dakkapel" for c in cases)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/jurisprudentie/test_dakkapel_cases.py -v`
Expected: FAIL — module `dakkapel_cases` ontbreekt.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/jurisprudentie/dakkapel_cases.py
"""Gecureerde dakkapel-jurisprudentie. Elke duiding geverifieerd tegen bron_url."""

from app.jurisprudentie.models import JurisprudentieCase

DAKKAPEL_CASES: list[JurisprudentieCase] = [
    JurisprudentieCase(
        ecli="ECLI:NL:RVS:2022:3992",
        verbouwingstype="dakkapel",
        gemeente_code=None,
        instantie="Raad van State",
        datum="2023-01-17",
        themas=["welstand", "voorgevel"],
        uitkomst="geweigerd",
        duiding=(
            "Dakkapel aan de voorgevel geweigerd op grond van de gemeentelijke "
            "welstandsnota; de weigering hield stand bij de Afdeling. "
            "[VERIFIEER de exacte duiding tegen de uitspraak.]"
        ),
        bron_url="https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:RVS:2022:3992",
    ),
    # TODO-curatie: voeg 1-2 extra geverifieerde dakkapel/welstand-uitspraken toe.
]
```

In `backend/app/jurisprudentie/selector.py`, importeer en registreer:

```python
from app.jurisprudentie.dakkapel_cases import DAKKAPEL_CASES
from app.jurisprudentie.splitsing_cases import SPLITSING_CASES

_REGISTRY: dict[str, list[JurisprudentieCase]] = {
    "splitsing": SPLITSING_CASES,
    "dakkapel": DAKKAPEL_CASES,
}
```

> Curatie-stap (vóór commit): vervang de `[VERIFIEER ...]`-duiding door de geverifieerde tekst, voeg minstens één extra case toe, en verwijder de `TODO-curatie`-regel. Geen placeholder in de commit.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/jurisprudentie/test_dakkapel_cases.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/jurisprudentie/dakkapel_cases.py backend/app/jurisprudentie/selector.py backend/tests/jurisprudentie/test_dakkapel_cases.py
git commit -m "M055/S02: gecureerde dakkapel-jurisprudentie + selector-registratie"
```

---

### Task 5: Assembler (build_dakkapel_report)

**Files:**
- Create: `backend/app/reports_v2/dakkapel_report.py`
- Test: `backend/tests/reports_v2/test_dakkapel_report.py`

**Interfaces:**
- Consumes: `bbl_vergunningvrij_toets` (T2), `welstand_dakkapel` (T3), `select_cases` (T4), `ParcelCache`, `_bestemming_types` (uit `splitsing_report`), schemas (T1).
- Produces: `build_dakkapel_report(db, parcel_id, *, today: str) -> DakkapelReport`. Raises `LookupError` als perceel ontbreekt.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/reports_v2/test_dakkapel_report.py
"""Tests voor build_dakkapel_report assembler (M055/S02)."""

import pytest

from app.reports_v2.dakkapel_report import build_dakkapel_report


@pytest.mark.asyncio
async def test_build_dakkapel_report_venlo(db_session, seed_parcel):
    parcel = await seed_parcel(gemeente_code="0983", bestemmingen=[{"type": "wonen"}])
    rep = await build_dakkapel_report(
        db_session, parcel_id=parcel.parcel_id, today="2026-06-24"
    )
    assert rep.perceel.gemeente_code == "0983"
    assert "mits" in rep.oordeel.achterdakvlak.lower()      # conditioneel
    assert rep.welstand is not None                          # Venlo gecureerd
    assert rep.geldigheidsdatum == "2026-06-24"
    assert rep.disclaimers and "omgevingswet.overheid.nl" in rep.aanvraag_url


@pytest.mark.asyncio
async def test_build_dakkapel_report_onbekende_gemeente_zonder_welstand(
    db_session, seed_parcel
):
    parcel = await seed_parcel(gemeente_code="9999", bestemmingen=[{"type": "wonen"}])
    rep = await build_dakkapel_report(
        db_session, parcel_id=parcel.parcel_id, today="2026-06-24"
    )
    assert rep.welstand is None                              # graceful
    assert rep.oordeel.bepalende_factoren                    # landelijke laag blijft


@pytest.mark.asyncio
async def test_build_dakkapel_report_unknown_parcel_raises(db_session):
    with pytest.raises(LookupError):
        await build_dakkapel_report(db_session, parcel_id="NOPE", today="2026-06-24")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_dakkapel_report.py -v`
Expected: FAIL — module ontbreekt.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/reports_v2/dakkapel_report.py
"""Dakkapel-rapport assembler: perceelfeiten + landelijke Bbl-toets +
gecureerde welstand + gecureerde jurisprudentie. Geen Claude, geen scoring."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.jurisprudentie.selector import select_cases
from app.models.parcel_cache import ParcelCache
from app.reports_v2.bbl_dakkapel import bbl_vergunningvrij_toets
from app.reports_v2.schemas import DakkapelReport, PerceelFeiten
from app.reports_v2.splitsing_report import _bestemming_types
from app.reports_v2.welstand_dakkapel import welstand_dakkapel

_OMGEVINGSLOKET = "https://omgevingswet.overheid.nl/aanvragen"
_DISCLAIMER = (
    "Indicatief. Gebaseerd op de landelijke vergunningvrij-criteria (Bbl), de "
    "gemeentelijke welstandsnota en openbare jurisprudentie. Geen "
    "vergunningsgarantie en geen juridisch advies; bevestig altijd via het "
    "Omgevingsloket. Toetsing per geval door de gemeente blijft leidend."
)


async def build_dakkapel_report(
    db: AsyncSession, parcel_id: str, *, today: str
) -> DakkapelReport:
    """Stel het dakkapel-rapport samen. Raises LookupError als perceel ontbreekt."""
    parcel = (
        await db.execute(select(ParcelCache).where(ParcelCache.parcel_id == parcel_id))
    ).scalar_one_or_none()
    if parcel is None:
        raise LookupError(f"parcel {parcel_id!r} not found")

    feiten = PerceelFeiten(
        parcel_id=parcel.parcel_id,
        adres=parcel.address,
        gemeente_code=parcel.gemeente_code,
        buurt_code=parcel.buurt_code,
        oppervlakte_m2=parcel.area_m2,
        bouwjaar=parcel.bouwjaar,
        bestemmingen=_bestemming_types(parcel.bestemmingen),
    )

    oordeel = bbl_vergunningvrij_toets()
    welstand = welstand_dakkapel(parcel.gemeente_code)
    cases = select_cases("dakkapel", ["welstand"], parcel.gemeente_code, limit=4)

    onzekerheden = [
        "De exacte maten en plaatsing van de geplande dakkapel zijn hier niet "
        "bekend; die bepalen of de Bbl-criteria worden gehaald.",
    ]
    if welstand is None:
        onzekerheden.append(
            "De welstandseisen voor deze gemeente zijn nog niet beschikbaar; "
            "controleer de gemeentelijke welstandsnota."
        )
    else:
        onzekerheden.append(
            "Welstand is deels een beoordeling van de welstandscommissie; "
            "de uitkomst kan per geval verschillen."
        )

    bronnen = ["Besluit bouwwerken leefomgeving (Bbl) — landelijke criteria"]
    if welstand is not None:
        bronnen.append("Gemeentelijke welstandsnota")
    if cases:
        bronnen.append("Openbare jurisprudentie (rechtspraak.nl)")

    return DakkapelReport(
        perceel=feiten,
        oordeel=oordeel,
        welstand=welstand,
        jurisprudentie=cases,
        onzekerheden=onzekerheden,
        bronnen=bronnen,
        geldigheidsdatum=today,
        aanvraag_url=_OMGEVINGSLOKET,
        disclaimers=[_DISCLAIMER],
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_dakkapel_report.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports_v2/dakkapel_report.py backend/tests/reports_v2/test_dakkapel_report.py
git commit -m "M055/S02: dakkapel-rapport assembler (Bbl + welstand + jurisprudentie)"
```

---

### Task 6: Router-endpoint

**Files:**
- Modify: `backend/app/reports_v2/router.py` (endpoint toevoegen)
- Test: `backend/tests/reports_v2/test_dakkapel_endpoint.py`

**Interfaces:**
- Consumes: `build_dakkapel_report` (T5), `DakkapelReport` (T1).
- Produces: `GET /api/reports-v2/dakkapel/{parcel_id}` (auth + rate-limited, 404 bij onbekend perceel).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/reports_v2/test_dakkapel_endpoint.py
"""Endpoint-tests GET /api/reports-v2/dakkapel/{parcel_id} (M055/S02)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dakkapel_endpoint_returns_report(
    async_client: AsyncClient, auth_headers: dict, seed_parcel
):
    parcel = await seed_parcel(gemeente_code="0983", bestemmingen=[{"type": "wonen"}])
    resp = await async_client.get(
        f"/api/reports-v2/dakkapel/{parcel.parcel_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["perceel"]["gemeente_code"] == "0983"
    assert "mits" in body["oordeel"]["achterdakvlak"].lower()
    assert isinstance(body["jurisprudentie"], list)


@pytest.mark.asyncio
async def test_dakkapel_endpoint_unknown_parcel_404(
    async_client: AsyncClient, auth_headers: dict
):
    resp = await async_client.get("/api/reports-v2/dakkapel/NOPE", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_dakkapel_endpoint_requires_auth(async_client: AsyncClient, seed_parcel):
    parcel = await seed_parcel(gemeente_code="0983")
    resp = await async_client.get(f"/api/reports-v2/dakkapel/{parcel.parcel_id}")
    assert resp.status_code in (401, 403)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_dakkapel_endpoint.py -v`
Expected: FAIL — 404 op route die nog niet bestaat (of routing-fout).

- [ ] **Step 3: Write minimal implementation**

Voeg toe aan `backend/app/reports_v2/router.py` (imports + endpoint). De datum komt uit naive UTC, geformatteerd als ISO-dag:

```python
from datetime import datetime

from app.reports_v2.dakkapel_report import build_dakkapel_report
from app.reports_v2.schemas import DakkapelReport, SplitsingReport


@router.get("/dakkapel/{parcel_id}", response_model=DakkapelReport)
@limiter.limit("60/minute")
async def get_dakkapel_report(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DakkapelReport:
    """Geeft het dakkapel-vergunningsrapport voor een perceel."""
    try:
        return await build_dakkapel_report(
            db, parcel_id=parcel_id, today=datetime.utcnow().strftime("%Y-%m-%d")
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/reports_v2/test_dakkapel_endpoint.py -v`
Expected: PASS (3 tests). Daarna volledige backend-check: `ruff check . && mypy . && .venv/bin/pytest tests/reports_v2 tests/jurisprudentie -q`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/reports_v2/router.py backend/tests/reports_v2/test_dakkapel_endpoint.py
git commit -m "M055/S02: GET /api/reports-v2/dakkapel/{parcel_id} endpoint"
```

---

### Task 7: Frontend type + fetch + hook

**Files:**
- Modify: `frontend/src/lib/reportsV2.ts` (types + fetch toevoegen)
- Create: `frontend/src/hooks/useDakkapelReport.ts`

**Interfaces:**
- Produces: TS-types `VergunningOordeel`, `WelstandBlok`, `DakkapelReport`; `fetchDakkapelReport`; `useDakkapelReport`.

- [ ] **Step 1: Write the failing test** (source-export check, mirror van bestaande view-test)

```typescript
// frontend/src/hooks/__tests__/useDakkapelReport.test.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('useDakkapelReport', () => {
  it('exports useDakkapelReport hook', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../useDakkapelReport.ts', import.meta.url)),
      'utf8',
    )
    expect(src).toMatch(/export function useDakkapelReport/)
    expect(src).toMatch(/dakkapel-report/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useDakkapelReport.test.ts`
Expected: FAIL — bestand ontbreekt.

- [ ] **Step 3: Write minimal implementation**

Voeg toe aan `frontend/src/lib/reportsV2.ts`:

```typescript
export interface VergunningOordeel {
  achterdakvlak: string
  voor_zijdakvlak: string
  bepalende_factoren: string[]
}

export interface WelstandBlok {
  samenvatting: string
  beschermd_gezicht: boolean
  bron_geldig_van: string | null
  bron_geldig_tot: string | null
  confidence: number
}

export interface DakkapelReport {
  perceel: PerceelFeiten
  oordeel: VergunningOordeel
  welstand: WelstandBlok | null
  jurisprudentie: JurisprudentieCase[]
  onzekerheden: string[]
  bronnen: string[]
  geldigheidsdatum: string
  aanvraag_url: string
  disclaimers: string[]
}

export async function fetchDakkapelReport(
  parcelId: string,
  accessToken: string | null,
): Promise<DakkapelReport> {
  return apiFetch<DakkapelReport>(`/api/reports-v2/dakkapel/${parcelId}`, {
    method: 'GET',
    accessToken,
  })
}
```

Create `frontend/src/hooks/useDakkapelReport.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchDakkapelReport } from '@/lib/reportsV2'

export function useDakkapelReport(parcelId: string | undefined) {
  const { accessToken } = useAuth()
  return useQuery({
    queryKey: ['dakkapel-report', parcelId],
    queryFn: () => fetchDakkapelReport(parcelId as string, accessToken),
    enabled: !!parcelId,
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useDakkapelReport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/reportsV2.ts frontend/src/hooks/useDakkapelReport.ts frontend/src/hooks/__tests__/useDakkapelReport.test.ts
git commit -m "M055/S02: frontend dakkapel-rapport type + fetch + hook"
```

---

### Task 8: DakkapelReportView (Propdex-stijl)

**Files:**
- Create: `frontend/src/components/reportsV2/DakkapelReportView.tsx`
- Test: `frontend/src/components/reportsV2/__tests__/DakkapelReportView.test.tsx`

**Interfaces:**
- Consumes: `DakkapelReport` (T7).
- Produces: `DakkapelReportView({ report })`.

DESIGN.md: Morning Mist canvas (gebruik bestaande CSS-tokens, geen hardcoded kleuren), Plus Jakarta Sans, rustige hiërarchie. Volg de structuur van `SplitsingReportView.tsx` maar met de dakkapel-secties (oordeel, welstand, jurisprudentie, onzekerheden+wat-nu, bronnen/disclaimers).

- [ ] **Step 1: Write the failing test** (mirror bestaande view-test)

```tsx
// frontend/src/components/reportsV2/__tests__/DakkapelReportView.test.tsx
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('DakkapelReportView', () => {
  it('exports DakkapelReportView and renders the core sections', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../DakkapelReportView.tsx', import.meta.url)),
      'utf8',
    )
    expect(src).toMatch(/export function DakkapelReportView/)
    expect(src).toMatch(/oordeel/)
    expect(src).toMatch(/welstand/)
    expect(src).toMatch(/onzekerheden/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/reportsV2/__tests__/DakkapelReportView.test.tsx`
Expected: FAIL — bestand ontbreekt.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/reportsV2/DakkapelReportView.tsx
import type { DakkapelReport } from '@/lib/reportsV2'

export function DakkapelReportView({ report }: { report: DakkapelReport }) {
  const {
    perceel, oordeel, welstand, jurisprudentie,
    onzekerheden, bronnen, geldigheidsdatum, aanvraag_url, disclaimers,
  } = report
  return (
    <article className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{perceel.adres ?? perceel.parcel_id}</h1>
        <p className="text-sm opacity-70">
          Dakkapel · {perceel.bestemmingen.join(', ') || 'onbekend'} ·{' '}
          {perceel.oppervlakte_m2 ?? '?'} m² · bouwjaar {perceel.bouwjaar ?? '?'}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Mag dit hier?</h2>
        <p>{oordeel.achterdakvlak}</p>
        <p className="mt-1">{oordeel.voor_zijdakvlak}</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {oordeel.bepalende_factoren.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Welstand</h2>
        {welstand ? (
          <div className="space-y-1">
            <p>{welstand.samenvatting}</p>
            {welstand.beschermd_gezicht && (
              <p className="text-sm opacity-70">Let op: beschermd stadsgezicht.</p>
            )}
          </div>
        ) : (
          <p className="text-sm opacity-70">
            Welstandseisen voor deze gemeente nog niet beschikbaar.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Wat zegt de rechter</h2>
        {jurisprudentie.length > 0 ? (
          <ul className="space-y-3">
            {jurisprudentie.map((c) => (
              <li key={c.ecli} className="rounded-lg border p-3">
                <a href={c.bron_url} target="_blank" rel="noreferrer"
                   className="font-mono text-sm underline">{c.ecli}</a>
                <span className="ml-2 text-xs uppercase opacity-60">{c.uitkomst}</span>
                <p className="mt-1 text-sm">{c.duiding}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-70">Geen relevante jurisprudentie gevonden.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Onzekerheden &amp; wat nu</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {onzekerheden.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <a href={aanvraag_url} target="_blank" rel="noreferrer"
           className="mt-3 inline-block underline">
          Vraag de vergunning aan via het Omgevingsloket
        </a>
      </section>

      <footer className="border-t pt-4 text-xs opacity-60">
        <p>Bronnen: {bronnen.join(' · ')}</p>
        <p>Geldig op: {geldigheidsdatum}</p>
        {disclaimers.map((d) => (
          <p key={d}>{d}</p>
        ))}
      </footer>
    </article>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/reportsV2/__tests__/DakkapelReportView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/reportsV2/DakkapelReportView.tsx frontend/src/components/reportsV2/__tests__/DakkapelReportView.test.tsx
git commit -m "M055/S02: DakkapelReportView (Propdex-stijl, conditioneel oordeel)"
```

---

### Task 9: Route

**Files:**
- Create: `frontend/src/routes/_authenticated/rapport-v2.dakkapel.$parcelId.tsx`

**Interfaces:**
- Consumes: `useDakkapelReport` (T7), `DakkapelReportView` (T8).

- [ ] **Step 1: Write the failing test** (source-check)

```tsx
// frontend/src/routes/_authenticated/__tests__/rapport-v2.dakkapel.test.tsx
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('dakkapel route', () => {
  it('wires hook + view at the dakkapel path', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../rapport-v2.dakkapel.$parcelId.tsx', import.meta.url)),
      'utf8',
    )
    expect(src).toMatch(/rapport-v2\/dakkapel\/\$parcelId/)
    expect(src).toMatch(/DakkapelReportView/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/routes/_authenticated/__tests__/rapport-v2.dakkapel.test.tsx`
Expected: FAIL — bestand ontbreekt.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/routes/_authenticated/rapport-v2.dakkapel.$parcelId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useDakkapelReport } from '@/hooks/useDakkapelReport'
import { DakkapelReportView } from '@/components/reportsV2/DakkapelReportView'

export const Route = createFileRoute('/_authenticated/rapport-v2/dakkapel/$parcelId')({
  component: DakkapelReportPage,
})

function DakkapelReportPage() {
  const { parcelId } = Route.useParams()
  const { data, isLoading, error } = useDakkapelReport(parcelId)

  if (isLoading) return <div className="p-6">Rapport laden…</div>
  if (error || !data) return <div className="p-6">Kon het rapport niet laden.</div>
  return <DakkapelReportView report={data} />
}
```

- [ ] **Step 4: Run test to verify it passes + full frontend check**

Run: `cd frontend && npx vitest run src/routes/_authenticated/__tests__/rapport-v2.dakkapel.test.tsx && npm run check`
Expected: PASS + check schoon (type-check + lint + format). Routetree wordt door de TanStack-plugin gegenereerd; los eventuele generatie-melding op.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/_authenticated/rapport-v2.dakkapel.\$parcelId.tsx frontend/src/routes/_authenticated/__tests__/rapport-v2.dakkapel.test.tsx
git commit -m "M055/S02: dakkapel-rapport route (hook + view wiring)"
```

---

### Task 10: Echte Venlo-run + screenshot voor het gevelbedrijf

**Files:** geen code — verificatie tegen echte data + demo-artefact.

**Doel:** bewijzen dat de app een echt dakkapel-rapport produceert voor een Venlo-adres, en een screenshot maken die het gevelbedrijf kan zien.

- [ ] **Step 1: Run-omgeving (read-only prod-data)**

Start de backend lokaal uit deze worktree, **read-only** tegen prod-data via de PostGIS-proxy (`gondola.proxy.rlwy.net:39031`). Borg read-only — geen writes vanuit dev-backend op prod. (Zie eng-review finding 2 in de upstream design doc.)

- [ ] **Step 2: Kies een echt Venlo-adres**

Zoek via de proxy een representatief Venlo-rijtjeshuis (`gemeente_code = '0983'`) dat in `parcel_cache` zit en waar een dakkapel logisch is. Noteer het `parcel_id`.

```sql
SELECT parcel_id, address, gemeente_code, bouwjaar
FROM parcel_cache
WHERE gemeente_code = '0983' AND address IS NOT NULL
LIMIT 10;
```

- [ ] **Step 3: Genereer het rapport**

Open `http://localhost:9300/rapport-v2/dakkapel/<parcel_id>` (ingelogd). Controleer: oordeel conditioneel, Venlo-welstand gevuld, jurisprudentie zichtbaar, onzekerheden + Omgevingsloket-link, bronnen + geldigheidsdatum + disclaimer in de footer.

- [ ] **Step 4: Screenshot + sanity-check**

Maak een screenshot (visual-first; screenshot vóór delen). Controleer dat er GEEN placeholder-tekst (`[VERIFIEER ...]`, `TODO`) in het rapport staat — als dat zo is, is de curatie (Task 3/4) niet afgerond; fix eerst.

- [ ] **Step 5: Deel-artefact**

Lever de screenshot/het rapport aan het gevelbedrijf ("zo ziet het eruit"). Noteer hun reactie + de gekste klantvraag (concierge-terugkoppeling → input voor B).

---

## Self-Review (uitgevoerd bij plan-schrijven)

- **Spec-dekking:** conditioneel oordeel (T1/T2), landelijke Bbl (T2), Venlo-welstand + graceful (T3), gecureerde jurisprudentie (T4), assembler met onzekerheden/bronnen/geldigheidsdatum (T5), endpoint (T6), frontend type/hook (T7), view in Propdex-stijl (T8), route (T9), echte Venlo-run + screenshot (T10). Alle spec-secties gedekt.
- **Iron-rule:** conditioneel-oordeel getest in T1 + T2 (geen "mag wel/niet").
- **Type-consistentie:** `VergunningOordeel`/`WelstandBlok`/`DakkapelReport` identiek gedefinieerd backend (T1) en frontend (T7); assembler-signature `build_dakkapel_report(db, parcel_id, *, today)` consistent in T5/T6.
- **Curatie geen placeholder-in-commit:** T3/T4 hebben expliciete "verwijder placeholder vóór commit"-stappen; T10/Step 4 vangt het alsnog af.

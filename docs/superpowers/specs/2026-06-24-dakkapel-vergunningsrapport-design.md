# Spec: Dakkapel-vergunningsrapport (Venlo demo)

Date: 2026-06-24
Slice: M055/S02
Branch: m055-s02-dakkapel-rapport (off m055-s01-adres-naar-rapport)
Status: APPROVED (brainstorming)
Upstream: office-hours design doc + eng-review (`~/.gstack/projects/Romainnoo145-propdex/klarifai-m054-s07-factor-finalisation-design-20260624-132352.md`)

## Why

Het gevelbedrijf (Venlo, doet dakkapellen/kozijnen/deuren/gevelbekleding) gaf toegang tot echte leads, op één voorwaarde: **"de app moet het eerst eens kunnen ook"** — ze willen zien hoe een echt per-adres rapport eruitziet vóór ze het bij klanten inzetten. Dit overschrijft de eng-review-keuze "rapport #1 handmatig": de aannemer wil aantoonbare app-capaciteit, geen handmatige PDF.

Doel van deze slice: de M055-spine een **dakkapel-vergunningsrapport** laten produceren voor een echt Venlo-adres, schoon gerenderd (Propdex-stijl), zodat het gevelbedrijf het kan zien en erop reageren.

Wig blijft **dakkapel** — de klus met echte vergunning-twijfel (hoogte, voor/achter, welstand). Kozijnen/deuren/gevel zijn meestal vergunningvrij (behalve beschermd gezicht) → latere laag.

## Scope

In scope:
- Een parallel dakkapel-rapportpad op de spine (Aanpak 1), geïsoleerd van het splitsing-pad.
- Conditioneel vergunningsoordeel (optie A — geen hard ja/nee, geen nep-zekerheid).
- Landelijke Bbl-vergunningvrij-toets (regel-gebaseerd, gemeente-agnostisch).
- Gecureerde Venlo-welstandslaag voor dakkapellen + gecureerde dakkapel-jurisprudentie.
- Schone Propdex-stijl rendering (DESIGN.md), geen white-label.

NIET in scope (nu):
- White-label/branding — Propdex-stijl volstaat (de aannemer weet zelf nog niet hoe ze willen white-labelen).
- Hard ja/nee-verdict — bewust conditioneel (optie A).
- Welstand-extractie-automatisering — Venlo handmatig gecureerd; automatiseren = B.
- Klus-config-generalisatie ("projecttype-lens") — B-scope per eng-review.
- Andere klussen (kozijnen/deuren/gevel) — latere laag.

## Architecture (Aanpak 1 — parallel dakkapel-rapportpad)

Hergebruikt de perceelfeiten-reader en plumbing van de spine; eigen schema + assembler + view, los van splitsing.

```
GET /api/reports-v2/dakkapel/{parcel_id}
  → perceelfeiten(parcel_id)            [hergebruik: ParcelCache-reader]
  → bbl_vergunningvrij_toets(perceel)   [NIEUW: landelijke regel-toets → conditioneel oordeel]
  → welstand_dakkapel(gemeente_code)    [NIEUW: gecureerde tekst per gemeente; Venlo nu; graceful als onbekend]
  → dakkapel_jurisprudentie()           [hergebruik selector, gecureerde dakkapel-ECLI's]
  → assembleer DakkapelReport
frontend: /rapport-v2/dakkapel/$parcelId → useDakkapelReport → DakkapelReportView
```

De **Bbl-laag is landelijk, niet Venlo-specifiek** → meteen herbruikbaar voor elke gemeente. Alleen de welstandslaag is per-gemeente handwerk.

### Components (elk één doel)
- `bbl_dakkapel.py` — `bbl_vergunningvrij_toets(perceel) -> VergunningOordeel`. Puur, regel-gebaseerd, geen DB. Encodeert de Bbl-criteria (achterdakvlak vergunningvrij mits hoogte ≤1,75m, ≥0,5m onder nok / boven dakvoet, ≥0,5m van zijkanten; voor/zijdakvlak naar openbaar gebied → vergunningplichtig + welstand). Verifieer exacte criteria bij de bron tijdens implementatie.
- `welstand_dakkapel.py` — `welstand_dakkapel(gemeente_code) -> WelstandBlok | None`. Gecureerde tekst per gemeente (Venlo nu). Onbekende gemeente → `None` (view toont "nog niet beschikbaar").
- `dakkapel_report.py` — assembler die de blokken samenvoegt tot `DakkapelReport`; handelt ontbrekende data af.
- `schemas.py` — `DakkapelReport` (zie onder).
- `router.py` — `GET /api/reports-v2/dakkapel/{parcel_id}`.
- Frontend: `lib/reportsV2.ts` (+ type), `useDakkapelReport` hook, `DakkapelReportView`, route `rapport-v2.dakkapel.$parcelId`.

### Schema `DakkapelReport` (mapt op de eng-review rapport-standaard)
- `perceel: PerceelFeiten` — hergebruik (adres, gemeente, oppervlakte, bouwjaar, bestemmingen).
- `oordeel: VergunningOordeel` (de *conclusie*, conditioneel):
  - `achterdakvlak: str` — "meestal vergunningvrij mits […]"
  - `voor_zijdakvlak: str` — "vergunningplichtig + welstandstoets"
  - `bepalende_factoren: list[str]` — Bbl-criteria als checklist (hoogte ≤1,75m, ≥0,5m onder nok/boven dakvoet, ≥0,5m van zijkanten)
- `welstand: WelstandBlok | None` — `samenvatting` (gecureerd Venlo), `beschermd_gezicht: bool`, `bron_geldig_van/tot: str | None`, `confidence: float`
- `jurisprudentie: list[JurisprudentieCase]` — gecureerde, geverifieerde dakkapel-ECLI's
- `onzekerheden: list[str]` — expliciet ("exacte maten onbekend; welstand is discretionair/commissie-afhankelijk")
- `bronnen: list[str]` + `geldigheidsdatum: str` — brondatum/geldigheid
- `aanvraag_url: str` — Omgevingsloket (*wat nu te doen*)
- `disclaimers: list[str]` — oriënterend, geen vergunningsgarantie, bevestig via Omgevingsloket/DSO

## Data flow & rendering
View-secties (Propdex-stijl, DESIGN.md — Morning Mist canvas, Plus Jakarta Sans, glass):
1. Header — perceelfeiten.
2. **Oordeel** — conditioneel, achter/voor-dakvlak + bepalende factoren als checklist.
3. **Welstand** — Venlo-eisen; "nog niet beschikbaar" als gemeente onbekend.
4. **Wat zegt de rechter** — jurisprudentie (leeg-staat afgehandeld).
5. **Onzekerheden + wat nu** — onzekerheden, Omgevingsloket-link.
6. Footer — bronnen, geldigheidsdatum, disclaimers.

## Error handling (geen nep-zekerheid)
- Perceel niet gevonden → 404 met duidelijke melding, geen leeg rapport.
- Gemeente ≠ Venlo → landelijke Bbl-laag tonen + welstand "nog niet beschikbaar" (niet faken).
- Bestemmingsplan-extractie ontbreekt → rapport werkt door (dakkapel leunt op Bbl + welstand).

## Testing (TDD)
- Unit `bbl_vergunningvrij_toets`: achterkant → vergunningvrij-mits-criteria; voor/zij → vergunningplichtig.
- Unit `welstand_dakkapel`: Venlo → gecureerde tekst; onbekende gemeente → `None`/graceful.
- Assembler `dakkapel_report`: vult alle blokken; handelt ontbrekende welstand/jurisprudentie/bestemmingsplan af.
- View `DakkapelReportView`: rendert alle secties incl. lege staten.
- **Iron-rule regressietest:** het oordeel blijft conditioneel — nooit een absoluut "mag wel/niet" (optie A vastgeklonken).

## Manual curation (eenmalig, vóór/tijdens build)
- Venlo welstandsnota dakkapel-paragraaf (+ beschermd-gezicht-status kern).
- 2-3 dakkapel/welstand-ECLI's, geverifieerd tegen rechtspraak.nl.
- Exacte Bbl-vergunningvrij-criteria (landelijk) — verifiëren bij de bron.

## Run / data
- Backend lokaal uit deze worktree, **read-only tegen prod via PostGIS-proxy** (`gondola.proxy.rlwy.net:39031`) — Venlo ParcelCache + extracties bestaan. Read-only borgen.
- Demo-adres: één representatief Venlo-rijtjeshuis (dakkapel plausibel); `parcel_id` bevestigen via de proxy tijdens de build.

## Dependencies
- M055/S01 spine: `reports_v2/` plumbing, `ParcelCache`-reader, jurisprudentie-selector, `JurisprudentieCase`, frontend reportsV2-patroon.
- `ruling_cache` (jurisprudentie), `FactorExtractionCache` (bestemmingsplan, secundair).

## Open / later
- White-label branding (na klant-validatie).
- Welstand-extractie automatiseren (B).
- Kozijnen/deuren/gevel-klussen + beschermd-gezicht-laag.

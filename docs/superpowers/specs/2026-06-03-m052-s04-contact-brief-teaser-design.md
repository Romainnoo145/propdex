# M052/S04 — Contact Brief-teaser (Design)

**Datum:** 2026-06-03
**Slice:** M052/S04 (CONTACT-01, CONTACT-02)
**Status:** Ontwerp — goedgekeurd in brainstorm, klaar voor implementatieplan

## Doel

De Hauzer-pré: in de Contact-fase (fase-2) een gepersonaliseerde acquisitiebrief
genereren uit echte data, met een geloofwaardige fake-send achter de
`hauzer_demo`-flag. Gebouwd zodat M051 de fake-send 1-op-1 vervangt door echte
PostNL-dispatch.

**Voortbouwend op (al gebouwd):**
- `ContactPhaseView` (fase-2) met BRK-kaarten + persist-panel (S02/M050)
- `document_generator.generate_document('eigenaar_brief', …)` + `EIGENAAR_BRIEF_TEMPLATE`
  + `_build_template_context()` (dormant — geen endpoint roept het aan)
- `hauzer_demo` boolean op `Organization`, via `/auth/me` → frontend `AuthContext`
- `brk_ownership_records` (rechtspersoon/overheid only — CHECK-constraint; particulieren
  worden by design niet gepersisteerd, AVG Tier-3)

## Scope

**In scope:** on-screen brief-preview uit echte data + fake PostNL-send achter
`hauzer_demo`, gebouwd voor 1-op-1 M051-swap.

**Buiten scope:** Bewerken-knop, Download-PDF (latere slice). De mockup-notitie
"vastgelegd in Realworks" geldt niet — send is fake PostNL, geen Realworks-overdracht.

## Beslissingen (brainstorm 2026-06-03)

### B1 — Eigenaar-data: hybride, voorwaarden-conform
Het Kadaster levert persoonsgegevens uitdrukkelijk niet voor commerciële activiteiten
(direct marketing/profiling — Algemene Voorwaarden voor de Levering, art. 7). Betalen
voor BRK-toegang ≠ toestemming om die data voor outreach te gebruiken; "toestemming"
bestaat hier sowieso niet (moet van de betrokkene komen). Particulier-outreach op
auto-opgehaalde data conflicteert dus met de Kadaster-voorwaarden.

Daarom:
- **Rechtspersoon/overheid** → brief vult automatisch op echte opgeslagen BRK-naam +
  statutaire zetel. Zakelijk verkeer, voorwaarden-conform.
- **Particulier** → handmatige-geadresseerde-modus: Propdex genereert de hele brief,
  de makelaar vult de NAW zelf in (uit een hem toegestane bron, bijv. een losse
  Eigendomsinformatie-opvraag voor één object). Propdex haalt/bewaart die particulier-
  data nooit; de makelaar is de verantwoordelijke voor het gebruik.

### B2 — Type-detectie zonder PII-opslag (geen marker)
`eigenaar_type` is alleen bekend ná de BRK-call (zit in de respons). De bestaande
opvraag is gebruiker-getriggerd en per-perceel; type rolt eruit als bijproduct, dus
geen extra call. De BRK-respons draagt `eigenaar_type` + `persisted: false` voor
particulier; de frontend vertakt daarop **per sessie**. Geen marker-tabel → geen
borderline-PII in opslag. Trade-off (geaccepteerd): een particulier-perceel opnieuw
bezoeken toont opnieuw "Eigendom ophalen" en zou een nieuwe call kosten — past bij het
per-perceel, gebruiker-getriggerde kostenmodel.

### B3 — Afzender-data: echt product (org-profielvelden)
Nieuwe `Organization`-velden i.p.v. demo-hardcode (M052 = build-in-productie). Elke org
vult z'n eigen briefhoofd via een instellingen-scherm.

### B4 — Send: dispatch-metadata only
De send-persistentie bewaart alléén metadata (status, tijd, template, dispatcher) —
niet de PII-dragende brief-inhoud. Bij particulier-modus voorkomt dit dat handmatig
ingevulde NAW in opslag belandt.

## Architectuur

### Backend

**Organization afzender-velden** (Alembic-migratie):
- `afzender_adres: str | None`, `contactpersoon: str | None`,
  `contact_email: str | None`, `contact_telefoon: str | None`
- bedrijfsnaam = bestaande `Organization.name`
- GET/PATCH via het bestaande org-settings-pad (locatie te bevestigen in plan), org-scoped

**`POST /api/parcels/{parcel_id}/brief`** — genereer brief-concept
- Haalt: perceel-scan (adres, gemeente_naam, score), `use_case` uit
  `ParcelFavorite.projecttype` (fallback: hoogste use_case_score), org-afzender-velden,
  en de rechtspersoon/overheid-`brk_ownership_records` indien aanwezig
- Bouwt `user_context` (afzender + eigenaar indien rechtspersoon) → roept
  `document_generator.generate_document('eigenaar_brief', parcel_data, user_context)`
- Optionele request-body `addressee` (`eigenaar_aanhef`, `eigenaar_adres`) voor
  particulier-modus (door makelaar ingevuld)
- Respons: gerenderde Markdown + metadata (`mode: 'auto' | 'manual'`, welke velden
  auto-gevuld vs handmatig vereist)
- Org-scoped (organization_id uit middleware)

**`POST /api/parcels/{parcel_id}/brief/send`** — fake-send (M051-naad)
- Achter een `BriefDispatcher`-interface (`dispatch(brief) -> DispatchResult`)
- Nu: `FakeBriefDispatcher` → `{status: 'verzonden', sent_at}`
- Persisteert dispatch-metadata: `parcel_id`, `organization_id`, `status`, `sent_at`,
  `template_id`, `dispatcher` (= 'fake') — **geen** brief-inhoud
- Gated op `hauzer_demo` (org-niveau)
- **M051-swap:** implementeer `PostNLBriefDispatcher` (zelfde interface) + flip de
  resolver; endpoint + persistence-schema ongewijzigd

**BRK-opvraag-respons-uitbreiding:** zorg dat de bestaande fetch/persist-actie
`eigenaar_type` + `persisted` teruggeeft (type-only, geen PII bij particulier), zodat
de frontend de modus kan bepalen.

### Frontend

**`BriefCard`** (nieuw component, in `ContactPhaseView` na de BRK-kaarten):
- Opgemaakte brief-preview conform `Contact.html`-mockup: briefhoofd (org-afzender) →
  NAW → betreft → body → groet
- Twee modi:
  - **auto** (rechtspersoon/overheid-record aanwezig) → preview met echte eigenaar
  - **manual** (particulier / geen record) → invulbare aanhef + NAW; preview update live
- Actie **Versturen** (primary) → send-endpoint → "verzonden"-bevestigingsstaat;
  gated op `user.hauzer_demo`
- Bewerken/Download-PDF: niet in deze slice

**Afzender-instellingen:** klein scherm/sectie in het bestaande instellingen-gebied
om de org-afzender-velden te beheren.

### Data flow

```
Contact-fase (ContactPhaseView)
  → BrkPersistPanel (bestaand): user-getriggerde BRK-opvraag (per perceel, kost 1 call)
      → respons: eigenaar_type + persisted-vlag
         rechtspersoon/overheid → opgeslagen in brk_ownership_records
         particulier            → niet opgeslagen, type-only naar frontend
  → BriefCard
      auto  : POST /brief (eigenaar uit BRK-record)        → preview
      manual: makelaar vult NAW → POST /brief (addressee)  → preview
      Versturen → POST /brief/send (FakeBriefDispatcher, hauzer_demo) → "verzonden"
```

## Componentgrenzen

- **`document_generator`** (bestaand, ongewijzigd): pure template-renderer. Input:
  `parcel_data` + `user_context`. Geen DB, geen netwerk.
- **`BriefDispatcher`** (nieuw): interface met één methode `dispatch`. `FakeBriefDispatcher`
  nu; `PostNLBriefDispatcher` in M051. Isoleert de send-implementatie van het endpoint.
- **brief-endpoint** (nieuw): orkestreert data-ophaal + context-bouw + render. Leunt op
  scan-data, `ParcelFavorite`, org, BRK-record.
- **`BriefCard`** (nieuw): pure presentatie + mode-state. Communiceert via de twee
  endpoints. Te begrijpen/testen los van de rest.

## Tests (TDD)

**Backend:**
- brief-endpoint: auto-fill uit rechtspersoon-record; lege eigenaar-velden + `mode:manual`
  bij geen record; `addressee`-override vult particulier-modus; use_case-branching
  (optoppen/splitsen/transformatie/nieuwbouw); org-scoping
- send-endpoint: `FakeBriefDispatcher` geeft 'verzonden'; `hauzer_demo` off → geblokkeerd/
  onzichtbaar; geen cross-tenant lek; dispatch-record bevat geen brief-inhoud
- afzender-CRUD: GET/PATCH org-scoped
- **Regressie:** BRK-persist blijft particulier weigeren (CHECK-constraint); geen
  particulier-PII in dispatch-opslag

**Frontend:**
- `BriefCard`-state-derivatie: auto vs manual op basis van record-aanwezigheid + type
- send-flow → "verzonden"-staat
- `hauzer_demo`-gating van de Versturen-actie/bevestiging

## Succescriteria (uit roadmap)

1. Contact-fase genereert brief-preview uit echte BRK-eigenaar-data via
   `document_generator` eigenaar_brief-template (perceel-context ingevuld) — auto voor
   rechtspersoon/overheid, handmatige NAW voor particulier
2. "Verstuur" toont gefakete verzend-bevestiging achter `hauzer_demo`; geen echte
   PostNL-call, geïsoleerd als demo-shim
3. Pad zo gebouwd dat M051 de fake-send 1-op-1 vervangt door echte dispatch
   (`BriefDispatcher`-interface, endpoint + persistence stabiel)
4. `npm run check` + `ruff check . && mypy .` groen

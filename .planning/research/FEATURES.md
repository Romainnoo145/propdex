# Feature Landscape: Deep Property Data Sources

**Domain:** Dutch Property Intelligence Platform — WOZ, Energielabel, BRK Eigendom, RCE Monumenten
**Researched:** 2026-02-23
**Confidence:** HIGH (official Dutch government API docs, existing codebase) / MEDIUM (developer UX patterns via web research)

---

## Context: What Already Exists (Do Not Re-Build)

This milestone adds four new data sources to an existing platform. The following report infrastructure is already shipped and must be extended, not replaced.

**Existing PropertyReportResponse sections:**
- `address` — BAG address data (straat, huisnummer, postcode, woonplaats)
- `building` — BAG pand data (pand_id, bouwjaar, status, oppervlakte, gebruiksdoel, geometry)
- `cadastral_parcels` — PDOK parcel list (kadastrale_aanduiding, perceelnummer, sectie, oppervlakte, geometry)
- `zoning` — DSO bestemmingsplan (bestemming, dimensions, functie/gebieds-aanduidingen, AI tekst parsing)
- `monuments` — PDOK spatial query returning (monument_nummer, monument_naam, classification, register_url, legalfoundationdate)
- `map_data` — GeoJSON geometries for map rendering
- `ai_parsing` — AI-parsed bestemmingsplan PDF extraction
- `section_sources` — Per-section data freshness attribution

**Monument gap (the RCE improvement):** Current RCE integration uses PDOK INSPIRE spatial query which returns only 5 fields (monument_nr, naam, classification, url, datum). The monumentenregister has much richer data (redengevende omschrijving, bouwperiode, oorspronkelijke functie, complexnummer) that is inaccessible via the current PDOK endpoint.

**BRK gap:** A `BRKBevragenClient` is implemented and tested (mTLS, API key) but no schema exists yet for the returned ownership data in `PropertyReportResponse`. The data is fetched live and displayed directly (never stored — Kadaster Tier 3 terms).

**WOZ gap:** No WOZ integration exists. No schema exists. WOZ data is not in `PropertyReportResponse`.

**Energielabel gap:** No EP-online integration exists. No schema exists.

---

## Table Stakes

Features that Dutch projectontwikkelaars expect from a property intelligence platform at this price point. Missing these makes the report feel incomplete compared to kadasterdata.nl, brainbay.nl, or a manual Kadaster extract.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| WOZ taxatiewaarde (most recent) | Every deal starts with WOZ as a pricing anchor — below-WOZ purchases are flagged as distressed; above-WOZ means premium location | LOW | Single value + peildatum. Kadaster WOZ API Bevragen or LV-WOZ feed. Restricted to OIN-authenticated parties — may need Altum AI or WOZ Waardeloket scrape as fallback |
| WOZ peildatum (valuation date) | The date determines which market cycle the value reflects — 2024 WOZ based on 1-1-2023 market, 2026 WOZ based on 1-1-2025 market | LOW | Always displayed alongside the waarde. Without it, the number is meaningless |
| Energielabel klasse (A++++–G) | Directly signals renovation cost profile — G label on commercial means mandatory upgrade costs before rental; monument label reveals compliance exposure | LOW | EP-online webservice — single letter class. Free public data via RVO/EP-online API |
| Energielabel registratiedatum | Labels older than 10 years are expired — outdated label means unknown energy status, which is a risk factor | LOW | EP-online field: `registratiedatum`. Must show expiry status (10-year validity) |
| BRK eigenaar type (rechtsvorm) | Whether the owner is a natural person, BV, stichting, or gemeente determines outreach strategy and acquisition likelihood | MEDIUM | BRK Bevragen returns `zakelijkGerechtigde` with `persoon.rechtsvorm` or `persoon.naam`. mTLS + API key required. Never store (Tier 3 terms) |
| BRK zakelijk recht type | Eigendom, erfpacht, opstalrecht, or hypotheek — determines what the buyer actually acquires and what encumbrances carry over | MEDIUM | BRK returns `aardZakelijkRecht` (e.g., "eigendom", "erfpacht") per rights holder |
| RCE redengevende omschrijving | The legal text that defines what is protected — without this, developers cannot assess feasibility of internal changes, façade alterations, or function change | HIGH | Not available via current PDOK INSPIRE endpoint. Requires Rijksmonumentenregister API or RCE Linked Data SPARQL endpoint. Known working approach: monumentenregister.cultureelerfgoed.nl REST API |
| RCE monumentnummer (exact) | The official registration number — required to look up formal restrictions, apply for permits, and contact RCE | LOW | Current implementation extracts this from PDOK `localid`. Needs validation against actual monumentenregister |

---

## Differentiators

Features that make Propdex meaningfully better than a developer doing manual research across woz-waardeloket.nl, ep-online.nl, and monumentenregister.cultureelerfgoed.nl.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| WOZ waarde per m² (calculated) | Raw WOZ number is meaningless without m² normalization — "€800K WOZ" tells you nothing; "€4.200/m² WOZ" immediately contextualizes against market benchmarks | LOW | Derived: `woz_waarde / building.oppervlakte` if BAG m² available; show only when both sources are present |
| WOZ historical values (2–3 years) | Trajectory matters — a WOZ rising 15%/yr indicates hot area; flat WOZ in rising market signals distress | MEDIUM | LV-WOZ Individuele Bevragingen returns history. Kadaster WOZ API Bevragen returns current only; historical requires separate WOZ Individuele Bevragingen subscription |
| Energielabel + bouwjaar correlation signal | Pre-1945 buildings with G label = massive renovation budget; post-2015 with G label = suspicious or data error | LOW | Simple computed signal from existing `bouwjaar` (BAG) + `label_klasse` (EP-online). No extra data needed — just logic |
| Monument energielabel obligation flag | From May 2026, rijksmonumenten must have an energy label upon sale/rental. Propdex can flag when a monument property lacks a registered label — this is an actionable compliance insight | LOW | Cross-reference: `is_monument = True` AND `energielabel = None or expired`. Display as actionable warning card |
| BRK multiple owners display | Properties with multiple eigenaren (e.g., fractional ownership, housing corporation + municipality) signal complex negotiation — single owner is simpler to approach | LOW | BRK returns list of zakelijkeGerechtigden — show count and types, suppress PII for natural persons |
| RCE complex membership | Monument part of a complex (e.g., klooster, fabrieksterrein) — developing one building requires coordinating with the whole complex owner | MEDIUM | RCE monumentenregister has `complexnummer` and complex membership. Developer needs to know: is this standalone or part of a protected group? |
| RCE oorspronkelijke functie (original use) | Kerk → wonen is a very different feasibility than kantoor → wonen. Original function determines structural design, spatial logic, and community opposition likelihood | LOW | RCE Rijksmonumentenregister field: `oorspronkelijkeFunctie`. Available via linked data API |
| RCE bouwperiode | Exact construction era informs structural engineering assumptions — pre-WWII masonry vs 1970s concrete have different renovation approaches | LOW | RCE field: `bouwjaar` or `bouwperiode`. May differ from BAG bouwjaar (which is often approximate) |
| WOZ vs marktwaarde delta signal | If WOZ is far below the apparent market value (calculated from transaction data or manual input), this signals a distressed seller or off-market opportunity | HIGH | Requires transaction data (not currently available). Cross-reference with future Altum AI AVM. Defer to a later milestone |

---

## Anti-Features

Features that seem useful but create more problems than they solve for this user group.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Show BRK natural person name and address | Privacy violation risk under AVG/GDPR — natural persons in Kadaster have data subject rights; displaying their home address creates legal exposure | Show rechtsvorm (natural person vs. legal entity) and entity name for rechtspersonen only; suppress name/address for natural persons |
| Cache or store BRK eigendomsdata | Kadaster Tier 3 API terms explicitly prohibit storage of eigendomsdata — non-compliance risks contract termination | BRK data is already architected as never-cached in the existing BRKBevragenClient. Keep this architecture |
| WOZ "afwijkingspercentage" (deviation vs market) | Calculating a meaningful WOZ deviation requires up-to-date transaction data, which Propdex does not have | Display WOZ value + peildatum clearly. Add a tooltip explaining WOZ is a tax valuation, not market value. Defer deviation calculation to when transaction data is available |
| Full RCE redengevende omschrijving as raw text dump | These descriptions can be 1,000–5,000 words of legal/architectural Dutch that is unreadable to non-specialists | Extract and display: (1) beschermingsomschrijving as a 1–2 sentence summary, (2) key protected elements as a bullet list using AI extraction; show full text behind a "Lees volledig" toggle |
| Energielabel EPC/NTA8800 detailed calculation breakdown | The full calculation has 50+ parameters (heating system, insulation values, orientation, etc.) that are not in EP-online public data and require an on-site energy audit | Show label klasse, registratiedatum, validity status, and methodiek (EPC/NTA8800). Do not promise detail that isn't available via the API |
| WOZ bezwaar (objection) workflow | Some tools try to help users contest their WOZ — this is a residential consumer feature, not a developer feature | Developers use WOZ as a benchmark, not to contest it. Remove any UX that implies objection functionality |

---

## Feature Dependencies

```
WOZ Section
├── woz_waarde ──────────────────────────> new API integration (Kadaster WOZ API Bevragen or LV-WOZ)
├── woz_peildatum ───────────────────────> co-fetched with woz_waarde
├── woz_waarde_per_m2 ───────────────────> DERIVED from woz_waarde / building.oppervlakte
│                                          requires: building.oppervlakte (existing BAG field)
└── woz_history ─────────────────────────> SEPARATE: WOZ Individuele Bevragingen (different API, paid)
                                           defer unless subscription available

Energielabel Section
├── label_klasse ────────────────────────> new API integration (RVO EP-online webservice)
├── registratiedatum ────────────────────> co-fetched with label_klasse
├── geldigheid (expired flag) ───────────> DERIVED: registratiedatum + 10 years vs today
├── methode (EPC/NTA8800) ───────────────> co-fetched (EP-online field: berekeningsmethode)
└── monument_no_label_warning ───────────> DERIVED: monuments.is_monument AND energielabel is None
                                           requires: monuments section (existing)

BRK Eigendom Section  [client already built — no new API integration needed]
├── zakelijk_recht_type ─────────────────> existing BRKBevragenClient.get_eigendom()
├── eigenaar_type (rechtsvorm) ──────────> existing BRKBevragenClient.get_eigendom()
└── multi_owner_flag ────────────────────> DERIVED: count of zakelijkeGerechtigden > 1
                                           note: NEVER store, display-only per Tier 3 terms

RCE Monument Section  [extending existing MonumentStatus schema]
├── monument_nummer ─────────────────────> already extracted from PDOK (needs validation)
├── monument_naam ───────────────────────> already in MonumentSourceResult
├── redengevende_omschrijving ───────────> NEW: requires monumentenregister.cultureelerfgoed.nl
│                                          NOT available via current PDOK INSPIRE endpoint
├── oorspronkelijke_functie ─────────────> NEW: same endpoint as redengevende_omschrijving
├── bouwperiode ─────────────────────────> NEW: same endpoint
├── complex_nummer ──────────────────────> NEW: same endpoint
└── beschermingscategorie (rijks/gemeentelijk) -> partially exists in MonumentSourceResult.monument_type
```

---

## Data Source Reference

### WOZ Waarde

| Field | Dutch Name | Source | Update Frequency | Notes |
|-------|-----------|--------|-----------------|-------|
| woz_waarde | WOZ-waarde | Kadaster LV-WOZ | Annual (Jan–Mar) | Tax valuation, not market value |
| woz_peildatum | Peildatum | Kadaster LV-WOZ | Annual | Always 1 January of preceding year |
| woz_object_type | Objecttype | Kadaster LV-WOZ | Annual | Woning / bedrijf / etc. |
| woz_waarde_per_m2 | Waarde per m² | Derived | Annual | woz_waarde / BAG oppervlakte |
| woz_history | Historische waarden | WOZ Individuele Bevragingen | Annual | Last 3 peildata; requires separate subscription |

**API access:** Kadaster WOZ API Bevragen requires OIN-number + PKIO certificate (same as BRK). Alternative: Altum AI WOZ API (third-party, simpler auth). Current approach: check if existing BRK mTLS credentials grant WOZ API access; if not, use LV-WOZ public endpoint for basic data.

**Confidence:** MEDIUM — WOZ API Bevragen is documented but access requires OIN which is a government entity identifier; commercial SaaS access path needs verification.

### Energielabel

| Field | Dutch Name | Source | Update Frequency | Notes |
|-------|-----------|--------|-----------------|-------|
| label_klasse | Label | EP-online (RVO) | On registration | A++++, A+++, A++, A+, A, B, C, D, E, F, G |
| registratiedatum | Registratiedatum | EP-online | On registration | Date label was filed, not inspection date |
| geldigheid_datum | Geldig tot | Derived | — | registratiedatum + 10 years |
| is_geldig | Nog geldig | Derived | — | geldigheid_datum > today |
| berekeningsmethode | Methode | EP-online | On registration | EPC (pre-2021) or NTA8800 (post Jan 2021) |
| primair_energieverbruik | kWh/m²/jaar | EP-online | On registration | NTA8800 labels only |

**API access:** EP-online public data (RVO). Bulk file (monthly) or webservice with API key (free, request from RVO at epbdwebservices.rvo.nl). HIGH confidence — officially documented, publicly available.

**Missing label handling:** Many pre-1970 buildings, monuments, and industrial properties have no registered label. Display "Geen geregistreerd energielabel" with bouwjaar context. Until May 2026, monuments were legally exempt; after May 2026, label required on sale/rental.

### BRK Eigendomsdata

| Field | Dutch Name | Source | Update Frequency | Notes |
|-------|-----------|--------|-----------------|-------|
| aard_zakelijk_recht | Zakelijk recht | BRK Bevragen | Daily | eigendom / erfpacht / opstal / vruchtgebruik |
| eigenaar_type | Eigenaar type | BRK Bevragen | Daily | Natuurlijk persoon / Rechtspersoon / Overheid |
| eigenaar_naam | Naam | BRK Bevragen | Daily | Only for rechtspersonen — suppress for natural persons |
| eigenaar_woonplaats | Vestigingsplaats | BRK Bevragen | Daily | Only for rechtspersonen |
| aantal_eigenaren | Aantal rechthebbenden | Derived | Daily | Count of zakelijkeGerechtigden |
| hypotheek_aanwezig | Hypotheek | BRK Bevragen | Daily | Boolean — mortgage/lien present |

**API access:** BRK Bevragen v2 — mTLS (PKIOverheid) + X-Api-Key. Client already implemented. NEVER cache or store (Tier 3 terms). HIGH confidence — code already exists and was built in a prior milestone.

**Privacy constraint:** For `persoon.typeNatuurlijkPersoon`, display only "Particulier" (anonymous). For `persoon.typeNietNatuurlijkPersoon`, display full naam and vestigingsplaats. This distinction is mandatory under AVG.

### RCE Monument (Enriched)

| Field | Dutch Name | Source | Update Frequency | Notes |
|-------|-----------|--------|-----------------|-------|
| monument_nummer | Rijksmonumentnummer | Monumentenregister | Nightly | Official registration number |
| monument_naam | Naam | Monumentenregister | Nightly | Official monument name |
| redengevende_omschrijving | Redengevende omschrijving | Monumentenregister | Nightly | Legal protection description; can be 1–5K words |
| oorspronkelijke_functie | Oorspronkelijke functie | Monumentenregister | Nightly | E.g., kerk, school, woonhuis, fabriek |
| bouwperiode | Bouwperiode | Monumentenregister | Nightly | E.g., "1880-1920" |
| complex_nummer | Complexnummer | Monumentenregister | Nightly | Present only if part of a described complex |
| beschermingscategorie | Bescherming | Monumentenregister / PDOK | Nightly | rijksmonument / gemeentelijk / stads-dorpsgezicht |
| status | Aanwijzingsstatus | Monumentenregister | Nightly | "aangewezen" / "voorgenomen" (pre-protected) |

**API access:** Current implementation uses PDOK INSPIRE spatial endpoint — this returns only 5 fields and does NOT include redengevende_omschrijving. For enriched data, use:
1. `monumentenregister.cultureelerfgoed.nl` REST API — requires monument_nummer as input
2. RCE Linked Data API at `linkeddata.cultureelerfgoed.nl` — SPARQL or REST, no auth required
3. `api.rijksmonumenten.info` — Solr-based, returning 403 as of early 2026 (per existing codebase comment)

**Recommended two-step flow:** (1) Use existing PDOK spatial query to find monument_nummer; (2) Use monument_nummer to call monumentenregister REST API for enriched fields. This avoids replacing working spatial discovery logic.

---

## MVP Recommendation

This milestone adds four data sources. Prioritize by implementation cost and developer workflow impact:

**Phase 1 — Quick wins, high value (no new auth needed):**
1. Energielabel klasse + registratiedatum + validity (EP-online free API, simple REST)
2. Derived signals: woz_waarde_per_m2, energielabel expiry flag, monument-without-label warning

**Phase 2 — Moderate effort, core value:**
3. WOZ waarde + peildatum (validate OIN access path; fallback to Altum AI if needed)
4. RCE monument enrichment — redengevende_omschrijving, oorspronkelijke_functie, bouwperiode (second call to monumentenregister using existing monument_nummer)

**Phase 3 — Complex, high value for power users:**
5. BRK eigendomsdata display — schema + UI for already-implemented API client
6. WOZ historical values — only if WOZ Individuele Bevragingen subscription is available

**Defer:**
- WOZ vs marktwaarde delta — requires transaction data not currently available
- RCE complex membership deep linking — valid feature but requires complex-level API queries beyond MVP scope

---

## Display Format Recommendations

### WOZ Section
Display as a card with: large value (€ formatted), peildatum below, waarde/m² as secondary metric. Historical mini-chart (sparkline) if 3 years available. Source badge: "Kadaster WOZ" with peildatum as freshness indicator.

### Energielabel Section
Display as a prominent letter badge (A–G with color coding: A=green, G=red). Below: registration date + "Geldig tot [date]" or "Verlopen" in red. Method badge (EPC/NTA8800). Alert card if monument + no label.

### BRK Eigendom Section
Display as a summary card: recht type, eigenaar type(s), hypotheek indicator. For rechtspersonen: naam + vestigingsplaats. For natural persons: "Particulier eigenaar" (no identifying details). Add disclaimer: "Eigendomsdata — niet opgeslagen per Kadaster voorwaarden."

### RCE Monument Section (enriched)
Replace/extend existing monument alert card. Show: monumentnummer, naam, bouwperiode, oorspronkelijke functie, beschermingscategorie. Add "Redengevende omschrijving" collapsible section with full text. Show complex membership if present. Link to official monumentenregister page.

---

## Sources

- [Kadaster WOZ API Bevragen](https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-api-bevragen) — MEDIUM confidence, official product page
- [WOZ Bevragen GitHub](https://kadaster.github.io/WOZ-bevragen/getting-started) — MEDIUM confidence, official Kadaster documentation
- [EP-Online Public Data (RVO)](https://www.ep-online.nl/PublicData) — HIGH confidence, official RVO documentation
- [EP-Online Webservice Data overheid](https://data.overheid.nl/en/dataset/ep-online-webservice--geregistreerde-energielabels-) — HIGH confidence, official
- [RVO Energielabel Woningen](https://www.rvo.nl/onderwerpen/wetten-en-regels-gebouwen/energielabel-woningen) — HIGH confidence, official RVO
- [BRK Bevragen Haal Centraal](https://vng-realisatie.github.io/Haal-Centraal-BRK-bevragen/) — HIGH confidence, VNG Realisatie official spec
- [BRK Bevragen GitHub (VNG-Realisatie)](https://github.com/VNG-Realisatie/Haal-Centraal-BRK-bevragen) — HIGH confidence, open source spec
- [Kadaster BRK Bevragen Product Page](https://www.kadaster.nl/zakelijk/producten/eigendom/brk-bevragen) — HIGH confidence, official
- [Rijksmonumentenregister](https://monumentenregister.cultureelerfgoed.nl/) — HIGH confidence, official RCE register
- [RCE Linked Data API](https://linkeddata.cultureelerfgoed.nl) — HIGH confidence, official RCE open data
- [RCE API Documentation GitHub](https://cultureelerfgoed.github.io/API/) — MEDIUM confidence, official but sparse
- [Rijksmonument Verbouwing Vergunning](https://www.rijksoverheid.nl/onderwerpen/erfgoed/vraag-en-antwoord/heb-ik-een-vergunning-nodig-voor-verbouwing-of-restauratie-van-een-monument) — HIGH confidence, official Rijksoverheid
- [Redengevende Omschrijving en Bescherming](https://www.monumentenrecht.com/kennisblog/de-redengevende-omschrijving-en-de-bescherming-van-het-monument/) — MEDIUM confidence, legal practice blog
- [Energielabelplicht Monumenten RCE](https://www.cultureelerfgoed.nl/onderwerpen/d/duurzaamheid/energielabel-voor-monumenten/energielabelplicht---vraag--antwoord) — HIGH confidence, official RCE
- [Energielabel Monumenten vanaf 2026](https://labelvoorthuis.nl/vanaf-2026-energielabel-verplicht-voor-monumenten-bij-verkoop-of-verhuur/) — MEDIUM confidence, industry news
- Codebase analysis: `brk_bevragen.py`, `rce_monuments.py`, `property_aggregator.py`, `monument.py`, `property.py` — HIGH confidence, direct source

---
*Feature research for: Deep Property Data Sources — Propdex v7*
*Researched: 2026-02-23*

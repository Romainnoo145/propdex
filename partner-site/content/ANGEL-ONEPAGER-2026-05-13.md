# Propdex BV — Investor Onepager

**Datum:** mei 2026 · **Stadium:** pre-launch, partnership getekend · **Vraag:** seed-ronde

---

## In één zin

**Propdex is de transformatie-laag van de Nederlandse vastgoed-stack** — een intelligence-cockpit die vastgoedontwikkelaars en kwaliteitsborgers van grondpositie tot go/no-go brengt zonder te schakelen tussen tien losse tools.

---

## De thesis

De Nederlandse vastgoedmarkt ondergaat 2026-2030 een fundamentele transitie: de **Omgevingswet** vervangt 350+ bestemmingsplannen door evenzoveel unieke gemeentelijke omgevingsplannen. Tegelijk dwingt de **Wet kwaliteitsborging voor het bouwen (Wkb, 2024)** een nieuwe categorie professionals — kwaliteitsborgers — in een rol die data-intensief is en regelgevingsdruk kent.

Wie in deze transitie de aggregator-rol pakt op transformatie-DD, wint de standaardpositie. Vandaag is die rol leeg. Brainbay/NVM bedient makelaars op huidige waarde. Matrixian/Calcasa doen taxatie. Omgevingsloket is overheidsmonopolie op vergunningen. Niemand integreert scouting → screening → due-diligence → risico-analyse → go/no-go voor transformatie en herontwikkeling.

Propdex bouwt die aggregator. Jaar 1-2: DD-cockpit voor ontwikkelaars en borgers. Jaar 2-3: AI-gegenereerde transformatie-scenarios per perceel (woningen, zorg, commercieel, gemengd). Jaar 3-5: de-facto data-laag tussen ontwikkelaars, financiers en gemeenten.

---

## Wat klanten vandaag krijgen

| Capaciteit | Wat het oplost |
|---|---|
| **Kaartgedreven perceel-scoring** met potentie- en risico-overlay over heel NL | Geen schakelen tussen BAG-viewer, Funda, klimaatviewer, RVO-database, gemeentewebsite |
| **Intelligence Grid per perceel** — Potentie (3×3 kaarten), Risico (paginated), Dossiers (5 tabs) | DD-rapportage in 15-30 minuten ipv 4-8 uur handwerk |
| **Cascade-extractie** van gemeentelijke beleidsdocumenten via Anthropic Claude met deterministische cache | Woonvisies, omgevingsplannen, beleidsstukken automatisch genormaliseerd per perceel |
| **10 environmental APIs vooraf gecached** — Natura2000, overstroming, geluid, lucht, EP-Online, BRK-eigendom, BAG-3D | Compleet risicoprofiel zonder tien losse queries |
| **Multi-tenant SaaS** — organization-level data-isolatie, JWT-auth, audit-log | Enterprise-veilig voor organisaties met meerdere users |

---

## De cijfers

### Markt

- **Doelgroep wedge 1 — Vastgoedontwikkelaars** met 5-30 projecten/jaar in NL, focus transformatie/herontwikkeling. Schatting **800-1.500 organisaties** actief in dit profiel (CBS + sector-data).
- **Doelgroep wedge 2 — Kwaliteitsborgers** (Wkb-verplicht sinds 2024). Schatting **~600 actieve borger-bureaus** in NL.
- Bij **5% penetratie** in jaar 1-2: 40-105 klanten. Bij **10% penetratie** jaar 3+: 140-210 klanten.

### Pricing (binnen €15k/jr software-budget-plafond NL-vastgoed)

| Tier | €/maand | €/jaar | Users | Scans/mnd |
|---|---|---|---|---|
| Starter | €299 | €3.6k | 1 | 50 |
| Team | €699 | €8.4k | 5 | 100 |
| Enterprise | €1.249 | €15k | 15+ | 250 |
| Extra credits | €1.50/scan boven bundle | | | |

### ARR-trajectoire

| Klanten | Gemiddelde ARPU | ARR | Indicatieve waardering @ 10x ARR |
|---|---|---|---|
| 25 | €7.5k | €187k | €1.9M |
| 50 | €7.5k | €375k | €3.75M |
| 100 | €7.5k | €750k | €7.5M |
| 250 (jaar 3+) | €8.5k | €2.1M | €21M |

### Unit economics

- **Marginale kost per scan:** €0.05-€0.15 (AI-API's via OpenRouter, multi-vendor routing)
- **Bruto-marge per klant:** **94-96%** afhankelijk van tier-mix
- **Vast infrastructuur:** €26-150/mnd bij pilot, €350-950/mnd bij groei
- **Per-klant kostprijs:** **~€8-15/mnd** at scale

---

## Product-status

47 product-milestones gemerged (M001–M047), 137.000 percelen verwerkt in productie-database (gemeente Venlo), 64.000 scoringsresultaten beschikbaar, 275+ tests groen. Frontend (Aura design system v15.0) is desktop-first voor 27"-monitor-gebruikers met dagelijkse intensieve workflows. Backend draait op Railway (FastAPI + PostGIS + ARQ), frontend op Vercel. Domein `propdex.nl` actief.

**Commerciële launch:** 3-4 weken werk + 2 weken juridisch parallel-track. Kritieke gaps: Stripe-billing integratie, e-mailprovider, juridische skeletten (DPA/Privacy/ToS).

---

## Team

- **Klarifai BV** — Nederlands product/tech-bureau (info@klarifai.nl) gespecialiseerd in multi-tenant SaaS voor NL/BE. Verantwoordelijk voor product, technologie, infrastructure, datapipeline. Eerder ervaring met logistieke SaaS (Box.16) en compliance-tooling.
- **Sales-partner** (vastgoedontwikkelaar, 50% Propdex BV via Partner Holding BV) — verantwoordelijk voor business development, klant-acquisitie, vastgoed-netwerk, sector-expertise. Tegelijk pilot-organisatie van Propdex als referentie-klant.

**Beide founders 50/50 in Propdex BV** via persoonlijke holdings. Klarifai's IP en voorwerk overgedragen via formele koopakte met uitgestelde foundersvordering. Partner's aandelen reverse-vested over 24 maanden op customer-acquisitie-mijlpalen (3/8/15/25 externe klanten + €3k/€8k/€15k/€25k MRR).

---

## Wat we vragen

**Seed-ronde:** €150.000 — €350.000 tegen pre-money waardering te bespreken op basis van traction in komende 3-6 maanden.

### Use of funds

| Categorie | % | Doel |
|---|---|---|
| Sales-investering | 35% | Eerste fulltime sales-resource of intensifying partner-bandwidth, content marketing, branche-events |
| Product-versnelling | 30% | Kwaliteitsborger-specifieke features (Wkb-rapportageformaten), cascade-batches M050-M057, API-laag voor enterprise-tier |
| Operations + legal | 15% | DPA/Privacy/ToS-review, AVG-compliance hardening, betalingsverwerking |
| Cash-runway | 20% | 12-18 maanden veiligheid bij milestones-tegenslag |

### Investor-rights (standaard NL-SHA-vorm)

- Preferente aandelen met 1x non-participating liquidation preference
- Pro-rata-rechten in toekomstige rondes
- Information rights (kwartaalrapportage)
- Board-observer-positie of board-seat afhankelijk van ronde-grootte
- Standaard tag-along + drag-along

---

## Risico's die we eerlijk benoemen

- **Customer-demand nog te valideren** — pilot-organisatie partner is op dit moment de eerste committed gebruiker. Eerste 3 externe klanten worden in maand 1-6 binnengehaald via partner's netwerk (vesting-mijlpaal).
- **Pricing-positionering is hypothese** — €299/€699/€1.249 voorgesteld op basis van markt-waarneming (€15k/jr software-plafond), eerste 3 verkoopgesprekken zijn expliciete price-discovery.
- **Single-developer dependency Klarifai** — gemitigeerd door standaard-stack (FastAPI, React, geen exotische tech) en uitgebreide documentatie. Bij €15k MRR aanwerving freelance backend-engineer.
- **Concurrent-entry** — geen directe concurrent in transformatie-DD-aggregatie vandaag, wel adjacente partijen (Brainbay, Matrixian). 18+ maanden tech-debt-voorsprong voor nieuwe entrant.

---

## Contact

[Partner-naam invullen] — sales-partner Propdex BV
[Email] · [Telefoon]

Vraag de partner naar de partner-briefing voor uitgebreide context over de deal-structuur, product-roadmap, en strategische positionering.

---

*Propdex BV (in oprichting) is een gezamenlijke onderneming van Klarifai BV en Partner Holding BV. Deze onepager is een investor-introductiedocument en geen aanbod tot het aangaan van overeenkomst. Volledige due-diligence-set beschikbaar op verzoek na NDA.*

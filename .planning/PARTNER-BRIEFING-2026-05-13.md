# Propdex — Partner Briefing

**Datum:** 13 mei 2026 · **Opgesteld door:** Klarifai · **Doel:** Voorbereiding 50/50 partnership-gesprek + contractbasis

---

## Executive Summary

- **Propdex is technisch ver gevorderd.** 47 milestones gemerged (M001–M047), Aura-frontend v15.0 live in staging, scoring-engine v3.0 met Anthropic tool-use voor cascade-extractie, 137.000 Venlo-parcels in productie-DB met 64.000 scan-resultaten. App draait op `api.propdex.nl` (Railway) + Vercel-frontend. M048 (frontend-scaling) is 88% afgerond.
- **Commerciële launch vereist nog ~3-4 weken werk + 2 weken juridische voorbereiding.** Kritieke gaps: Stripe-billing inrichten, e-mailverzending (Resend/SES), Google OAuth secrets aanvullen, legal-skeletten (DPA/Privacy/ToS), worker-service stabiliseren, DNS `api.propdex.nl` afronden. Externe customer-demand is nog te bewijzen — pilot-partner zelf is op dit moment de enige committed gebruiker.
- **Pricing-positionering binnen NL-vastgoed software-budget (plafond ~€15k/jaar):** Starter €299 · Team €699 · Enterprise €1.249 per maand. Bij 50 klanten ~€375k ARR, bij 100 klanten ~€750k ARR — bruto-marge **94-96%** afhankelijk van scan-mix. Pricing-model is hypothese, nog niet markt-gevalideerd.
- **Partner-deal (50/50 aandelen) voorgesteld via holding-structuur** (Klarifai BV + Partner Holding BV → Propdex BV). Klarifai's 50% wordt direct vested onder gelijktijdige IP-overdracht; partner's 50% wordt reverse-vested over 24 maanden op customer-acquisitie-mijlpalen. Pilot-organisatie partner blijft gratis en telt niet mee in vesting-mijlpalen. Concrete clausules in §7.
- **5 strategische keuzes nodig in dit gesprek (§6):** wedge-segmentatie, pricing-model, eigendomsstructuur, IP-koopprijs, vesting-structuur partner. Voorstel Klarifai per beslissing erbij.

---

## 1. Wat is Propdex + waarom betalen klanten

Propdex is een Nederlandse property intelligence cockpit voor de voorkant van vastgoedontwikkeling: **van grondpositie tot go/no-go in één platform**. Het integreert scouting, screening, due-diligence en risicoanalyse over alle relevante databronnen (BAG, Kadaster, bestemmingsplannen, omgevingsplannen, klimaat-risico's, bodemonderzoek, energielabels, jurisprudentie, woonvisies en meer) in één kaartgedreven werkomgeving.

**Use-case:** een vastgoedontwikkelaar of kwaliteitsborger die transformatiepotentie van een perceel beoordeelt — moet vandaag schakelen tussen BAG-viewer, Funda, losse PDF-bestemmingsplannen, klimaatviewer, RVO-EP-database, gemeentewebsites voor woonvisies, en handmatige Excel-consolidatie. Propdex doet die aggregatie automatisch met een scoringsmodel (Score v3.0) dat per perceel potentie en risico weergeeft.

**Tijdwinst per perceel-screening:** ruwe inschatting (nog niet markt-gemeten) is dat een grondige DD-screening vandaag 4-8 uur kost per perceel; Propdex brengt dat naar 15-30 minuten plus kennistransfer naar het team. Bij 10-20 percelen per project en 5-30 projecten per jaar betekent dat tientallen uren per maand bespaard per ontwikkelaar.

**Doelmarkt (wedge):**

| Wedge | Wie | Waarom eerst | ARPU-bandbreedte |
|---|---|---|---|
| **W1a primair** | Vastgoedontwikkelaars 5-30 projecten/jr in NL, focus transformatie/herontwikkeling | Pilot-partner IS dit segment, hoogste pain (DD-uren), Propdex specifiek voor transformatiepotentie gebouwd | €299-€1.249/mnd |
| **W1b parallel** | Kwaliteitsborgers (Wkb-rol sinds 2024) | Regelgevingsdruk dwingt adoptie, ~600 actieve borgers NL, zelfde data-laag | €299-€699/mnd |
| **W2 jaar 1-2** | Kleinere ontwikkelaars + projectmanagers + adviseurs vastgoed-keten | Logische uitbreiding na W1-referenties | €299-€699/mnd |
| **Bewust niet (out-of-scope)** | Makelaars (Brainbay/NVM-monopolie), gemeentes als klant (B2G 12-18 mnd sales-cyclus, andere use-case), B2C particulieren (Omgevingsloket art. 16.1 gratis) | Strategie-keuze 2026-03-02 (STRATEGY.md) | — |

**Concurrentie-positionering:**

- **Brainbay / NVM-tools** — bedienen makelaars, focus op *current value* (huidige WOZ, recente transacties). Propdex doet *transformatiepotentie* — anderssoortige analyse, andere koper.
- **Matrixian / Calcasa** — taxatie + WOZ-modellen. Doen waarde-vaststelling. Propdex doet potentie-screening — complementair.
- **Omgevingsloket** — wettelijk monopolie op vergunningen (Art. 16.1 Omgevingswet). Propdex bouwt expliciet géén vergunningchecker.
- **Status quo** — duct-tape van BAG-viewer + Funda + PDFs + Excel + gemeente-websites. Dit is de daadwerkelijke concurrent. Geen geïntegreerde aggregator bestaat voor transformatie-DD in NL.

**Strategische positie (3-5 jaar horizon, voor partner-context):** Propdex wordt de aggregator-laag voor vastgoed-transformatie-DD onder de Omgevingswet. Met 350+ gemeenten die elk een eigen omgevingsplan-implementatie krijgen tussen 2027-2030, ontstaat een normalisatie-rol die structureel waarde heeft. Aggregator wint die wereld.

**Live op:** `api.propdex.nl` (backend) + `propdex.nl` (frontend, DNS-configuratie afhankelijk van Siteground propagatie). Operationeel niveau: staging-grade. Externe customer-onboarding nog niet productie-ready.

---

## 2. Status — wat is af

### M001–M044 — Core scanning + Aura-frontend ✅
- Map-based perceel-scanning met score-overlay (MapLibre + amber→green gradient op Morning Mist canvas)
- Multi-tenant authenticatie (FastAPI JWT + Postgres RLS + organization_id-filtering)
- Aura design system v15.0 — Morning Mist canvas, Plus Jakarta Sans, glass-morphism, Framer Motion floating panels
- ParcelDetailModal met Intelligence Grid (Potentie 3×3 + Risico paginated + Dossiers 5-tabs)
- 10 environmental APIs pre-cached per scan: BAG, BRK, BAG-3D, PLU WMS, Natura2000, overstromingsrisico, geluid Lden, luchtkwaliteit NO2+PM10, EP-Online, RVO bodem
- CBS-statistiek (bevolking, criminaliteit, leeftijd) per wijk

### M045–M046 — Unified Document Model + Scoring Fundament ✅ (2026-04-18 / 2026-04-20)
- Document model + cascade-infrastructuur (PolicyDocument + ARQ-jobs)
- Score v3.0 opschoning: 58 gewichtspunten gesaneerd, 6 bugs gefixed
- 63.760 scan_results backfilled via `backfill_scan_scores_v3.py`
- 171 backend score_v3 + iron-rule tests groen

### M047 — Projecttype + Cascade-Infra + POC ✅ (2026-04-20)
- Projecttype-datamodel (`parcel_project_type` entity, 6 enum-waarden) + CRUD API
- FACTOR_REGISTRY met conditionele weights per projecttype
- LLM-determinism infrastructure: `factor_extractor.py`, Anthropic tool-use, temp=0, cache-key op (parcel_id, doc_version_hash, factor_id)
- Re-scoring cascade ARQ-job (`rescore_parcels_for_document`)
- POC `woonvisie_match` factor voor Venlo end-to-end

### M048 — Score v4.0 Frontend Scaling 🚧 (88% — 7/8 phases complete)
- Cache Sentinel + Score UI Fix + Woonvisie Popup + KlimaatLayer Bug + Factor Pinning + E2E smoke ✅
- Document-level cache sentinel + WijkPolicy schema upgrade — *pending* (Phase 5+6)

### Infrastructure ✅
- Railway-backend (api-production-7f87.up.railway.app), CNAME `api.propdex.nl` geconfigureerd (DNS-propagatie Siteground in afwachting per laatste deploy-notes 2026-04-03)
- Vercel-frontend met rewrites naar Railway-api
- PostgreSQL 16 + PostGIS 3.7 op Railway (137K parcels Venlo + 64K scan_results)
- Redis 8.2.1 op Railway voor ARQ-jobs
- Sentry EU error-tracking (backend + frontend)
- Docker-compose voor dev (port 5434 DB + 6380 Redis + 8000 backend + 9300 frontend)
- 275+ tests groen (104 unit + 171 integration)

---

## 3. Wat ontbreekt vóór commerciële launch

| Gap | Impact | Effort | Prioriteit |
|---|---|---|---|
| **Stripe billing-integratie** | Geen self-service betaalflow — geen module in codebase aanwezig. Pilot kan handmatig gefactureerd worden; productie niet. | 1-1.5 week | **Kritiek voor paid launch** |
| **Resend / AWS SES e-mailverzending** | SMTP-stub aanwezig maar geen werkende provider. Geen invites, wachtwoord-resets, verification-flows mogelijk. | 1-2 dagen | **Kritiek** |
| **Worker-service stabilisatie Railway** | ARQ-worker crasht silent op startup (2026-04-03 deploy-notes). Cascade-jobs draaien nu niet in productie. | 1-2 dagen | **Kritiek** |
| **DNS-propagatie `api.propdex.nl`** | CNAME geconfigureerd, awaiting DNS in Siteground per laatste notes. Status onbekend — moet bevestigd worden. | 0.5 dag | Hoog |
| **Legal-skeletten DPA / Privacy / ToS** | Niet aanwezig in repo. Moet opgesteld + juridisch gereviewed voordat commercieel ondertekend kan worden. | 2 weken doorlooptijd | **Kritiek** |
| **Google OAuth productie-secrets** | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` zijn leeg in Railway-env. Login werkt nu alleen e-mail/wachtwoord. | 2-4 uur | Hoog |
| **VENDOR_ORG_ID bootstrap** | Productie heeft geen Klarifai-vendor-organisatie ingericht — blokkeert PolicyDocument-uploads via M045-flow. | 1 uur na DB-restore | Medium |
| **M048 Phase 5+6 afronden** | Document-level cache sentinel + WijkPolicy schema — vereist voor Venlo-scale productie (anders 100k Claude-calls per gemeente) | 1 week | Hoog |
| **Production-monitoring + alerting** | Sentry vangt errors. Geen alerting op AI-cost spikes, slow queries, scan-volumes. | 2-3 dagen | Medium |
| **Backup + DR-test productie-DB** | Railway-PostGIS heeft ingebouwde point-in-time restore. Disaster-recovery scenario nog niet expliciet getest. | 0.5-1 dag | Medium |
| **Pilot-volume load testing** | App is tot nu toe met dev-volume (Venlo 137K parcels) gevalideerd. Concurrente klanten + multi-tenant load niet getest. | 3-5 dagen | Medium |

**Geschatte tijd tot productie-ready:** 3-4 weken werk + 2 weken juridisch (parallel-track).

---

## 4. Lopende kosten + Kosten-roadmap per groeifase

### Infrastructuur (vast) — huidige staging-setup

| Component | Provider | Kosten | Toelichting |
|---|---|---|---|
| Frontend hosting | Vercel | **€0-20/mnd** | Hobby of Pro afhankelijk van bandwidth-gebruik |
| Backend (compute) | Railway | **€10-30/mnd** | API-service + worker-service, pay-as-you-go |
| Database | Railway PostGIS | **€10-25/mnd** | 137K parcels Venlo, groeit lineair met klanten |
| Redis | Railway | **€5-10/mnd** | ARQ-job-queue + caching |
| Domein | Siteground (`propdex.nl`) | **~€1/mnd** | Jaarlijks |
| DNS | Cloudflare optioneel | **€0** | Of via Siteground direct |
| Error tracking | Sentry EU | **€0** | Free plan (5k events/mnd) — Team-tier €26/mnd bij groei |
| **Totaal vast (staging/launch)** | | **~€26-86/mnd** | |

### Variabel (per scan / per gebruik)

| Component | Kosten | Per |
|---|---|---|
| Anthropic Claude (haiku 4.5, via OpenRouter) — factor-extractie | **€0.03-0.08** | per cascade-document, gecached per (parcel, doc_version, factor) |
| Google Gemini API — losse extracties | **€0.01-0.03** | per perceel-analyse waar Claude niet voor wordt aangeroepen |
| BAG / DSO / EP-Online / RVO / RCE API's | **€0** | Allen gratis overheids-API's (rate-limits) |
| Cloudflare R2 (toekomst — als rapport-PDFs persistent worden) | **€0-5/mnd** | $0.015/GB, momenteel niet actief |

**Marginale kost per perceel-scan:** ~**€0.05-0.15** afhankelijk van cascade-trigger en factor-mix. Dedup via cache-keys houdt kosten laag bij herhaald scannen.

### Kosten-roadmap per groeifase

| Fase | Klanten | Setup | Vast/mnd | Variabel/mnd (scan-mix) | **Totaal/mnd** | **Per-klant kost/mnd** |
|---|---|---|---|---|---|---|
| **Pilot** | 1-5 | Huidige Railway + Vercel free | €26-86 | €5-25 | **€31-111** | ~€20-25 |
| **Commerciële launch** | 5-25 | + Stripe + Resend (€20/mnd) + Vercel Pro (€20) + Sentry Team (€26) | €100-150 | €25-150 | **€125-300** | ~€10-15 |
| **Groei** | 25-100 | Railway upgrade + Postgres scale + Redis scale | €200-350 | €150-600 | **€350-950** | ~€7-10 |
| **Scale** | 100-500 | Railway enterprise of migratie naar AWS/Hetzner, R2 storage actief | €600-1.500 | €600-3.000 | **€1.200-4.500** | ~€8-10 |

**Per-klant kostprijs daalt bij schaal**: van **~€20-25/klant/mnd** (pilot) naar **~€8-10/klant/mnd** (scale). Bij gemiddelde ARPU €600-800/mnd → **bruto-marge 94-96%**. Bij focus op enterprise-tier → 96-98%.

### Pricing-positionering (voorstel, niet markt-gevalideerd)

NL-vastgoed software-aankoop-plafond is ~€15k/jaar (markt-realiteit per Klarifai's waarneming). Tiers daarbinnen:

| Tier | €/mnd | €/jaar | Users | Scans/mnd inbegrepen | Wat zit erin |
|---|---|---|---|---|---|
| **Starter** | €299 | €3.6k | 1 | 50 | 1 user, basis-features, 1 regio focus |
| **Team** | €699 | €8.4k | 5 | 100 | 5 users, NL-breed, team-collaboration |
| **Enterprise** | €1.249 | €15k | 15+ | 250 | Onbeperkt-features, API-access, custom rapport-branding, priority support, dedicated success-manager |
| **Extra scan-credits** | €1.50/scan | — | — | Boven bundle | Upsell zonder boven plafond te gaan |

**ARR-narrative voor angels** (volume × ARPU):
- 25 klanten gemixt → ~€7.5k ARPU × 25 = **€187k ARR**
- 50 klanten gemixt → **€375k ARR** → ~€3.75M waardering @ 10x ARR
- 100 klanten gemixt → **€750k ARR** → ~€7.5M waardering

### Waarom Stripe + e-mail eerst en niet later

Zonder Stripe-billing: handmatig factureren werkt voor 1-3 pilot-klanten maar niet voor self-service-launch. Klant moet kunnen instappen via website zonder Klarifai-tussenkomst. Zonder e-mailverzender: geen account-verification, geen wachtwoord-reset, geen invite-flow. Beide zijn launch-blockers.

---

## 5. Sprint-roadmap voor commerciële launch

### Sprint 1 (week 1-2) — Productie-blockers
- M048 Phase 5+6 afronden (document-cache sentinel + WijkPolicy)
- Worker-service stabiliseren (root cause crash diagnose)
- DNS `api.propdex.nl` propagatie bevestigen
- E-mailprovider live (Resend of AWS SES)
- VENDOR_ORG_ID bootstrap productie

### Sprint 2 (week 3-4) — Commerciële launch
- Stripe checkout-integratie + webhook-handling (Klarifai: directe inrichting in `backend/app/billing/`)
- Tier-quota enforcement (per-org scan-count tegen tier-limit, hard cap met upgrade-CTA)
- Stripe customer portal voor self-service abonnement-wijziging
- Google OAuth productie-secrets + login-flow testen
- Production-monitoring + alerting (Sentry alerts + CPU/memory + scan-cost-spike-detection)

### Sprint 3 (parallel) — Juridisch
- DPA / Privacy Policy / Terms of Service skeletten opstellen
- Ondernemingsrechtelijk advocaat selecteren voor SHA + statuten + IP-akte
- Notaris-afspraak voor Propdex BV oprichting

### Sprint 4 (post-launch) — Groei-features
- Pilot-volume load testing (concurrente klanten + multi-tenant stress)
- Backup + DR-test productie-DB
- M049+ roadmap (cascade-batches M050-M057, Data Sources per Gemeente hub)
- Kwaliteitsborger-specifieke features (Wkb-rapportageformaten) bij eerste W1b-klant

---

## 6. Belangrijke beslissingen voor het gesprek

| # | Beslissing | Opties | **Voorstel Klarifai** |
|---|---|---|---|
| 1 | **Wedge-segmentatie** | (a) W1 alleen vastgoedontwikkelaars / (b) W1 ontwikkelaars + kwaliteitsborgers parallel / (c) hele markt aanjagen (gemeentes + makelaars + ontwikkelaars) | **(b) Parallel W1 = ontwikkelaars + kwaliteitsborgers.** Twee sales-motions, geen single-segment risico, zelfde data-laag dus geen extra product-bouw. Gemeentes en makelaars expliciet out-of-scope voor jaar 1 (zie §1) |
| 2 | **Pricing-model** | (a) Tiered SaaS-abo / (b) Pay-per-scan / (c) Hybride abo + scan-credits | **(c) Hybride.** Starter €299, Team €699, Enterprise €1.249 (binnen €15k/jr markt-plafond) + €1.50/scan boven bundle. Voorspelbaar voor klant, upsell-pad naar enterprise via features (API, branding, priority) en volume. Pricing is hypothese — eerste 3 klanten valideren |
| 3 | **Eigendomsstructuur** | (a) Binnen Klarifai BV (revenue-share) / (b) Propdex BV apart, beide founders direct / (c) Propdex BV apart, ieder via persoonlijke holding | **(c) Holding-structuur:** Klarifai BV + Partner Holding BV → Propdex BV. Schone cap-table voor angels, management-fees via holdings, fiscaal optimaal, deal met IP-koopprijs makkelijker te structureren. Notariskosten ~€2.5-4k voor SHA+statuten+IP-akte — eenmalig |
| 4 | **IP-koopprijs voor Klarifai's voorwerk** | (a) €50k / (b) €70k / (c) Andere waarde + onderbouwing | **(a) €50k als uitgestelde foundersvordering** op Propdex BV. Onderbouwd via urenreconstructie (~625 uur @ €80/uur). Niet direct cash uit BV — pas afbetalen bij €X MRR-milestone of bij angel-ronde. Voorkomt liquiditeitsdruk + fictief-loon-risico. Mogelijke step-up naar €70k bij eerste angel-ronde mits waardering ondersteunt |
| 5 | **Vesting-structuur partner** | (a) Symmetrische reverse vesting 4j+1j cliff beide founders / (b) Asymmetrisch: Klarifai direct vested + partner reverse-vested 24mnd op mijlpalen / (c) Earn-in: partner 0%→50% in 24mnd | **(b) Asymmetrisch.** Klarifai's IP+app+18mnd voorwerk = delivered value op dag 1 (direct vested). Partner's sales-belofte = promised value (reverse-vested). Cap-table 50/50 vanaf dag 1, stemrecht 50/50, dividend 50/50 — vesting raakt alleen wat gebeurt bij vroege uittreding zonder mijlpalen. Concrete mijlpalen in §7 |

---

## 7. Partner-deal structuur — 50/50 resultaat-gedreven

**Uitgangspunt:** Partner en Klarifai werken samen 50/50 aan Propdex BV. Partner brengt sales-expertise + vastgoed-netwerk + sales-effort. Klarifai brengt het bestaande product, technische continuïteit + IP-overdracht. Beide partijen halen waarde uit groei via aandelen, dividend en exit.

**Zakelijke ruggengraat:** Vier afzonderlijke deal-lagen, elk eigen documentatie:

1. **Eigendomsstructuur** — wie houdt welke aandelen en hoe
2. **IP-overdracht** — hoe Propdex BV juridisch eigenaar wordt van de bestaande app
3. **Vesting + leaver-regelingen** — wat gebeurt bij vroege uittreding of niet-presteren
4. **Toekomstige arbeid** — hoe Klarifai en partner werk inbrengen en daarvoor betaald worden

Onder NL-recht is "gewoon 50/50 en uren factureren later" een hoog-risico-constructie die fiscaal vastloopt op gebruikelijk-loon en juridisch op IP-eigenaarschap (zie §8). Vandaar deze vier-lagen-aanpak.

### 7.1 Eigendomsstructuur — Holdings boven werk-BV

```
   Klarifai BV                         Partner Holding BV
   (bestaand)                          (nieuw op te richten)
        │                                       │
        │ 50% aandelen                          │ 50% aandelen
        │                                       │
        └──────────────┬────────────────────────┘
                       │
                  Propdex BV
              (gezamenlijke werk-BV)
              (nieuw op te richten)
```

**Aandelen:** 50% Klarifai BV — 50% Partner Holding BV. Eén aandelensoort met gelijk stemrecht en gelijke economische rechten (geen preferente structuur op founders-niveau — die laag wordt pas geïntroduceerd bij eerste externe investeerder).

**Bestuur:** Beide aandeelhouders zijn bestuurder, tekeningsbevoegdheid gezamenlijk voor besluiten boven gedefinieerde drempel (zie reserved matters hieronder). Onder die drempel mag elk zelfstandig handelen binnen vooraf afgesproken budget en mandaat.

**Tekeningsbevoegdheid:** Statutair vastgelegd dat besluiten boven €5k uitgave, IP-mutaties, aandelenuitgifte, of klantcontracten boven €25k/jaar twee handtekeningen vereisen.

### 7.2 IP-overdracht — Aparte koopakte + uitgestelde foundersvordering

Auteursrecht op de bestaande Propdex-codebase, designs, documentatie en domein zit nu bij Klarifai BV (of, indien daadwerkelijk privé ontwikkeld, bij Klarifai's bestuurder privé — wordt geverifieerd vóór notaris). Onder NL-recht moet IP-overdracht aan een nieuwe BV schriftelijk en expliciet geschieden.

**Mechanisme — uitgestelde foundersvordering:**

1. Bij oprichting Propdex BV verkoopt Klarifai BV (of bestuurder privé na voorafgaande inbreng in Klarifai BV) de IP aan Propdex BV tegen overeengekomen koopprijs.
2. **Voorgestelde koopprijs: €50.000**, onderbouwd via urenreconstructie en marktconforme tariefbenchmark (~625 uur @ €80/uur, gebaseerd op gemiddeld zzp-tarief NL software-developer 2026).
3. Propdex BV betaalt niet direct — de schuld blijft staan als **uitgestelde foundersvordering** op de balans (achtergestelde lening van Klarifai BV aan Propdex BV).
4. **Aflossing:** in één van de volgende scenarios:
   - Eerste angel-ronde: bij funding-event wordt €50k afgelost uit de opgehaalde middelen (mits ronde groot genoeg om dit niet als belangrijkste use-of-funds-positie te tonen)
   - MRR-milestone: zodra Propdex BV €15.000 MRR bereikt, mag de vordering in termijnen worden afgelost (max 36 mnd vanaf bereiken milestone)
   - Verkoop / exit: vordering wordt afgelost vóór dividenduitkering naar aandeelhouders bij liquiditeitsevenement
5. **Step-up bij angel-ronde:** mocht eerste angel-ronde plaatsvinden op waardering die €70k IP-prijs ondersteunt, kan koopprijs eenmalig worden bijgesteld via aandeelhoudersbesluit. Standaard blijft €50k vastgelegd.
6. **Documentatie:** aparte IP-overdrachts-akte (lijst van repositories, features, domein, designs, datasets), waardebepalingsmemo, leningsovereenkomst Klarifai BV → Propdex BV.

**Waarom geen direct cash:** voorkomt liquiditeitsdruk bij oprichting, voorkomt dat verse investeerders het gevoel krijgen dat hun geld primair een foundersafrekening financiert, blijft fiscaal schoon (vordering, geen verkapt loon).

### 7.3 Vesting — Asymmetrisch op delivered vs promised value

**Klarifai BV (50%) — direct vested.** Cap-table-positie 50% per oprichtingsdatum, geen vesting-schedule, geen cliff. Argumentatie: Klarifai's inbreng (IP + werkende app + 18+ mnd voorwerk + voortgezette tech-team-bandwidth) is op dag 1 *delivered value* — de IP-overdracht is de eigendoms-correlate, de uitgestelde foundersvordering is de financiële correlate.

**Partner Holding BV (50%) — reverse-vested over 24 maanden op mijlpaal-basis.** Cap-table-positie 50% per oprichtingsdatum, met terugkoop-recht voor Klarifai BV op niet-gevestigde aandelen bij vroege uittreding zonder gehaalde mijlpalen.

**Vesting-mijlpalen partner (hybride — beide assen moeten halen voor volledige vesting):**

| Mijlpaal | Cumulatief vested | Termijn vanaf oprichting |
|---|---|---|
| 3 externe betalende klanten **én** €3.000 MRR | 10% (= 5% van totaal aandelen Propdex BV) | 6 maanden |
| 8 externe betalende klanten **én** €8.000 MRR | 25% | 12 maanden |
| 15 externe betalende klanten **én** €15.000 MRR | 40% | 18 maanden |
| 25 externe betalende klanten **én** €25.000 MRR | **50% volledig vested** | 24 maanden |

**Definities** (vastgelegd in SHA):
- *"Externe betalende klant"*: een organisatie die (i) niet de pilot-organisatie van de partner is, (ii) niet aan Klarifai gelieerd is, (iii) minimaal 3 maanden onafgebroken een betaald abonnement heeft afgenomen tegen marktconform tarief (geen ramp-up-kortingen lager dan 50% van standaardpricing), (iv) niet binnen 3 maanden voorafgaand aan de meting heeft opgezegd.
- *"MRR"*: maandelijkse herhalende omzet uit betaalde abonnementen, exclusief eenmalige fees, exclusief scan-credit-bursts boven 200% van het bundle-volume, exclusief omzet van de pilot-organisatie van de partner.
- *"Externe betalende klant" telt voor één* — geen aggregatie van meerdere abonnementen onder één concern, tenzij contractueel als aparte klant-organisatie afgenomen.

**Pilot-organisatie partner — gratis, telt niet mee.** De partner-organisatie krijgt gedurende de eerste 18 maanden een gratis Enterprise-licentie als referentie-pilot. Telt expliciet *niet* mee in de klant-teller of MRR-meting voor vesting. Na 18 maanden of bij vesting-completion mag partner-organisatie overstappen naar regulier betaald abonnement (marktconform tarief).

**Terugkoop bij niet-vesten:** niet-gevestigde aandelen kunnen door Klarifai BV worden teruggekocht tegen nominale waarde (geen marktwaardering — vesting is bedoeld als use-it-or-lose-it-mechanisme).

### 7.4 Toekomstige arbeid — Managementovereenkomsten via holdings

Zodra werk wordt verricht voor Propdex BV door Klarifai of partner persoonlijk, geldt:

- **Klarifai**: managementovereenkomst tussen Klarifai BV en Propdex BV. Marktconforme management-fee per maand voor product-/tech-leiding. Klarifai BV verzorgt salarisadministratie + DGA-gebruikelijk-loon-naleving (€58k/jr minimum 2026) richting Klarifai's bestuurder.
- **Partner**: managementovereenkomst tussen Partner Holding BV en Propdex BV. Marktconforme management-fee per maand voor sales/business development. Partner Holding BV verzorgt eigen salarisadministratie + gebruikelijk-loon.
- **Hoogte fee:** wordt vastgesteld in aparte managementovereenkomst, niet in SHA. Marktconform = onafhankelijke benchmark. Geen fee zolang Propdex BV geen MRR genereert die fees rechtvaardigt (cash-runway-bescherming).
- **Optioneel cash-component partner:** *commissie 5% op MRR* van door partner aangebrachte externe klanten, uitbetaald maandelijks via Partner Holding BV. Motiveert tijdens vesting-cliff, beloont volume direct. Stopt op 5% — geen escalatie.

### 7.5 Reserved matters + Deadlock-ladder

**Besluiten die unanimiteit van beide aandeelhouders vereisen (vetorechten):**

1. Uitgifte nieuwe aandelen / aandelensoorten / opties
2. Wijziging statuten of aandeelhoudersovereenkomst
3. Verkoop, fusie, ontbinding, faillissement-aanvraag
4. Aangaan leningen boven €25k of garanties
5. IP-verkoop, IP-licentie aan derden, of belangrijke IP-mutaties
6. Aanname personeel met salaris >€60k/jr of arbeidscontract >1 jaar
7. Dividenduitkering of andere kapitaal-uitkering
8. Strategische pivot (wijziging primair productdoel / doelmarkt)
9. Aangaan klantcontracten >€50k/jr individueel
10. Investering door externe partij (angel-ronde of anderszins)

**Deadlock-ladder bij blijvend meningsverschil over reserved matter:**

1. **Stap 1 — Intern overleg (4 weken):** Beide partijen documenteren standpunt schriftelijk en zoeken oplossing in directe gesprekken.
2. **Stap 2 — Mediation (4 weken):** Onafhankelijke mediator (te kiezen uit voorgeformuleerde lijst in SHA). Kosten 50/50.
3. **Stap 3 — Bindend advies (8 weken):** Onafhankelijk arbiter (bv. via NAI) geeft bindend advies op basis van proportionaliteit en redelijkheid.
4. **Stap 4 — Buy-sell:** Bij blijvende blokkade na stap 3 mag elke partij de ander uitkopen tegen marktwaarde (waardering door onafhankelijke registervaluator), met first-refusal en match-right.

### 7.6 Tag-along / Drag-along / Pre-emption

- **Pre-emption rights:** bij aandelenoverdracht door één partij heeft de andere partij eerste recht tot aankoop tegen dezelfde voorwaarden.
- **Tag-along:** bij verkoop van >25% van de aandelen door één partij aan derde, mag andere partij meeverkopen pro-rata tegen zelfde voorwaarden.
- **Drag-along:** bij bonafide exit-aanbod dat door 75%+ van aandeelhouders wordt geaccepteerd (relevant na eerste investeringsronde), zijn alle aandeelhouders verplicht mee te verkopen tegen zelfde voorwaarden.

### 7.7 Non-compete + Non-solicitation

- **Non-compete:** 18 maanden vanaf uittreding. Beperking op direct concurrerend PropTech-product voor vastgoedontwikkelaars of kwaliteitsborgers in NL/BE, én adviesdiensten ten behoeve van directe concurrenten van Propdex BV. Geldt voor beide founders, ongeacht reden van uittreding.
- **Non-solicitation:** 24 maanden vanaf uittreding. Geen klanten, werknemers, of contractors van Propdex BV benaderen voor concurrerende doeleinden.

### 7.8 Good leaver / Bad leaver

- **Good leaver** (eigen keuze met respect voor opzegtermijn, ziekte, persoonlijke omstandigheden, overlijden): behoud van gevestigd deel aandelen. Niet-gevestigde aandelen worden teruggekocht tegen nominale waarde.
- **Bad leaver** (bewezen ernstige contractbreuk, bedrog, schending non-compete tijdens vesting): alle aandelen (gevestigd én niet-gevestigd) onderworpen aan terugkoop tegen nominale waarde, los van vesting-status. Beoordeling via onafhankelijk advies indien betwist.

### 7.9 Periodieke evaluatie + Review-momenten

**Elke 3 maanden** gezamenlijke werksessie tussen beide founders:
- Voortgang vesting-mijlpalen (klant-aantal + MRR + pijplijn)
- Bedrijfsstrategie (productroadmap, sales-strategie, financiële positie)
- Samenwerking-kwaliteit (wat werkt, wat schuurt)
- Eventuele bijstelling clausules SHA in overleg

**Eerste formele review-moment maand 6.** Indien op dat moment partner-mijlpaal (3 externe klanten + €3k MRR) niet gehaald, gezamenlijke evaluatie: bijstellen, doorzetten, of vroegtijdig herstructureren.

### 7.10 Juridisch fundament — verplichte documenten

Strategisch raamwerk hierboven is voorbereiding op contracten, niet de contracten zelf. Door ondernemingsrechtelijk advocaat (specialisatie aandeelhoudersovereenkomsten + IP) op te stellen vóór notaris:

1. **Statuten** Propdex BV (notarieel, openbaar): aandelensoorten, stemrecht, bestuur, tekeningsbevoegdheid, transferbeperkingen
2. **Aandeelhoudersovereenkomst (SHA)** (privaat): vesting, reserved matters, deadlock-ladder, tag/drag-along, pre-emption, non-compete, leaver-regelingen, evaluatie-cadans
3. **IP-koopovereenkomst** Klarifai BV → Propdex BV: lijst rechten, koopprijs, betalingsregeling
4. **Leningsovereenkomst** Klarifai BV → Propdex BV: uitgestelde foundersvordering, achterstelling, aflossingsregeling, eventuele rente
5. **Managementovereenkomst** Klarifai BV ↔ Propdex BV: management-fee, scope, opzegtermijn
6. **Managementovereenkomst** Partner Holding BV ↔ Propdex BV: management-fee, eventuele commissie-component, scope, opzegtermijn
7. **Inschrijving aandeelhoudersregister** + UBO-registratie KvK (beide founders boven 25%)
8. **Initiële bestuursbesluiten**: aankoop IP, vaststelling managementovereenkomsten, tegenstrijdig-belang-procedure (Klarifai aan beide kanten van IP-transactie)

**Geschatte kosten:** advocaat €2.5-4k, notaris €1-2k, KvK + administratie €0.3k. Totaal eenmalig **~€4-6k**. Voor te schieten door één partij of 50/50 vooraf — vast te leggen vóór juridische trekken-en-passen begint.

### ⚠️ Juridische review essentieel

Bovenstaande is **strategisch raamwerk, geen rechtsgeldige contracten**. Concrete formulering door advocaat met startup/SHA-ervaring (Loyens & Loeff, AKD, Houthoff, NewLaw, of lokale specialist). Investering €4-6k voorkomt later €100k+ aan geschillen, mislukte due-diligence in angel-ronde, of fiscale naheffingen.

---

## 8. Risico's — eerlijk benoemd

| Risico | Kans | Impact | Mitigatie |
|---|---|---|---|
| **Externe klanten willen niet betalen na partner's intro** | Medium-Hoog | Hoog | Nog 0 externe demand-validatie. Mitigatie: partner committeert vóór deal-sign aan lijst van 10-20 prospects om in week 1-4 te benaderen. Eerste-3-klanten-target binnen maand 6 als vesting-floor |
| **Pricing-positionering klopt niet voor markt** | Medium | Medium | €15k/jr plafond is partner's marktwaarneming, niet hard onderzocht. Mitigatie: eerste 3 verkoopgesprekken zijn explicit price-discovery (€299 t/m €1.249 testen). Bijstellen na pilot-feedback in maand 3 |
| **IP-overdracht juridisch niet schoon** | Laag-Medium | Hoog | Mitigatie: advocaat-review IP-akte, urenreconstructie + waardebepalingsmemo, expliciete verklaring auteursrechtelijke status (privé vs Klarifai BV). Voorkomt due-diligence-blocker bij angel-ronde |
| **Partner werft geen externe klanten** | Medium | Hoog | Mitigatie: reverse vesting partner = geen klanten ⇒ geen vesting ⇒ aandelen terug naar Klarifai. Eerste mijlpaal op 6 mnd (3 klanten/€3k MRR) is harde floor, gemiste mijlpaal triggert evaluatie |
| **Concurrent (Brainbay, Matrixian, of nieuwkomer) lanceert vergelijkbare aggregator** | Laag-Medium | Medium | Brainbay/Matrixian zitten in current-value, niet transformatie — andere koper. Nieuwe entrant heeft 18+ mnd tech-debt in te halen. Mitigatie: snelheid product-iteratie + first-mover positionering bij W1-segment |
| **AI-API-kosten (Claude/Gemini) stijgen of stoppen EU-availability** | Laag | Medium | Mitigatie: marge is 94-96% — kan 5x AI-kostenstijging absorberen voordat bruto-marge onder 80% zakt. Multi-vendor opzet (OpenRouter-routing) maakt switch tussen Anthropic / Google / Mistral EU mogelijk |
| **DSO / BAG / overheids-API's wijzigen schema** | Medium | Laag-Medium | Overheids-API's hebben formele versionering. Mitigatie: PDOK + BAG hebben backwards-compatibility-windows. Klarifai's adapter-laag absorbeert wijzigingen |
| **Worker-service blijft instabiel in productie** | Medium | Medium | Reeds bekend uit deploy-notes 2026-04-03. Sprint 1 prioriteit. Mitigatie: root-cause diagnose + container-resource-limits + restart-policies + alerting |
| **GDPR-incident door fout in retention of audit** | Laag | Hoog | Mitigatie: EU-only stack (Railway, Sentry EU, Cloudflare), legal-review DPA + retention-policy vóór commerciële launch (Sprint 3) |
| **Klarifai single-developer dependency** | Hoog | Hoog | Codebase op GitHub, standaard FastAPI/React stack (geen exotische tech), GSD-methodologie genereert documentatie. Mitigatie post-launch: bij €15k+ MRR eerste freelance backend-engineer onboarding |
| **Partner haalt eerste mijlpaal wel maar tweede niet** | Medium | Medium | Vesting hybride (klant-aantal én MRR) voorkomt manipulatie. Mitigatie: 3-mnd-cadans-evaluatie geeft vroeg signaal, bij stagnatie tussen mnd 12-18 gezamenlijke pijplijn-review en eventueel bijstelling sales-aanpak |
| **Deadlock tussen Klarifai en partner op strategische keuze** | Medium | Medium-Hoog | Mitigatie: reserved-matters-lijst (§7.5) + 4-staps-deadlock-ladder. Geen 50/50-stempel zonder uitweg-mechanisme |

---

## Bijlagen op aanvraag

- Technische architectuur-diagram (FastAPI + PostGIS + ARQ + React + MapLibre)
- Multi-tenancy security model (RLS + organization_id-filtering + JWT-middleware)
- M048 design-doc (cascade-pipeline + factor-pinning + WijkPolicy)
- STRATEGY.md (positionering vs Brainbay/Matrixian/Omgevingsloket)
- ROADMAP.md (M048-M058 + workstream-overzicht 19 milestones tot productie)
- IP-urenreconstructie + waardebepalingsmemo (te genereren vóór notaris)
- Screenshots app (Discovery-modus map-first, Build-management-modus data-dense)

---

*Deze briefing dient als basis voor het partner-gesprek en als briefingstuk voor de ondernemingsrechtelijk advocaat. De cijfers in §4 en §7 zijn voorstellen Klarifai — open voor onderhandeling met partner binnen het gestelde raamwerk.*

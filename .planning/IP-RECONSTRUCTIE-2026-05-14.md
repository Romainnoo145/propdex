# IP-Urenreconstructie + Waardebepalingsmemo

**Onderwerp:** IP-overdracht Klarifai BV → Propdex BV
**Datum:** 14 mei 2026
**Doel:** Onderbouwing van koopprijs €50.000 voor de bestaande Propdex-codebase, designs, documentatie en aanverwante materialen
**Bestemd voor:** ondernemingsrechtelijk advocaat (SHA + IP-akte opsteller) + notaris (oprichtingsstukken Propdex BV) + bijlage SHA

---

## 1. Object van overdracht

Volledig auteursrecht + naburige rechten op:

### 1.1 Software (broncode + binaries)
| Component | Locatie | Omvang |
|---|---|---|
| Backend (FastAPI + SQLAlchemy + ARQ) | `backend/app/` | **277 Python-bestanden**, 58.721 regels |
| Frontend (React 19 + TypeScript + MapLibre) | `frontend/src/` | **388 TypeScript-bestanden**, 69.398 regels |
| Tests (pytest + Storybook) | `backend/tests/`, `frontend/src/**/*.stories.tsx` | 36.176 regels, **275+ tests groen** |
| Database-schema (Alembic migraties) | `backend/alembic/` | **35 ORM-modellen** + bijbehorende migraties |
| Infrastructure-as-code | `backend/Dockerfile`, `backend/railway.json`, `frontend/vercel.json`, `docker-compose.yml` | Productie-deployment-configuratie |
| **Totaal broncode** | | **~128.000 regels code** verspreid over 700+ bestanden |

### 1.2 Niet-software activa
- **Design system** (Aura) — kleuren, typografie, componenten, motion-tokens. Vastgelegd in `frontend/src/styles/index.css` + `DESIGN.md`
- **Domeinregistratie** `propdex.nl` (te formaliseren als overdracht of licentie via Klarifai BV → Propdex BV)
- **Project-documentatie** — `.planning/` directory (47 milestones, roadmap, requirements, design docs, decision logs)
- **Productie-database-content** (Venlo: 137.000 percelen, 64.000 scan_results, 16 rapporten) — datapipeline, niet de overheidsdata zelf, maar de aggregatie + enrichment-resultaten
- **Branding** — logo, kleurensetting, naam "Propdex"
- **API-integraties** — werkende verbindingen met BAG, BRK, DSO, EP-Online, Kadaster, RCE, CBS, 10 environmental APIs, OpenRouter (Anthropic + Gemini)

### 1.3 Wat NIET wordt overgedragen
- Klarifai's eigen kennis/expertise (blijft Klarifai BV)
- Generieke patronen of utilities die ook voor andere Klarifai-projecten worden gebruikt
- Persoonlijke account-credentials (Vercel, Railway, GitHub, etc.) — die worden overgedragen aan Propdex BV via aparte account-transfer of nieuwe accounts

---

## 2. Tijdspad van ontwikkeling

| Periode | Activiteit | Bewijslocatie |
|---|---|---|
| **Nov 2025 — Jan 2026** | Eerste build-fase: marktonderzoek, datamodelontwerp, technologie-keuzes, eerste prototype (Klarifai privé/lokaal — pre-repo) | Klarifai's lokale werkbestanden + ontwerpnotities |
| **2026-02-07** | First commit huidige repo — start gestructureerde GSD-workflow | `git log --reverse` |
| **Feb 2026** | Foundation + core scanning + auth + multi-tenant RLS | 798 commits |
| **Mrt 2026** | Aura design system v15.0 + Intelligence Grid + cascade-infrastructure | 862 commits |
| **Apr 2026** | Score v3.0 + projecttype + LLM-determinism + M048 frontend scaling | 509 commits |
| **Mei 2026** | M048 afronden + productie-prep + commerciële voorbereiding | 24+ commits (lopend) |
| **Totaal commits huidige repo** | | **2.193 commits** |

### Werkdagen kalender
- Actief development begonnen: **november 2025**
- Eerste git-commit in huidige repo: 7 februari 2026 (~3 maanden na start — eerste fase was prototyping + onderzoek vóór GSD-workflow)
- Totaal kalenderdagen actief: ~6.5 maanden (~195 dagen)
- Werkdagen (excl. weekenden + feestdagen NL): **~135 werkdagen**

### Urenraming

**TE INVULLEN DOOR KLARIFAI:**

| Werkmodus | Werkdagen | Uren/dag | Totaal uren | Toelichting |
|---|---|---|---|---|
| Nov 2025 — Jan 2026: onderzoek + eerste build | __ | __ | __ | Pre-repo, marktwerk + concept |
| Feb — Mei 2026: gestructureerde development | __ | __ | __ | GSD-workflow, 47 milestones |
| **Totaal** | | | **__ uur** | |

**Conservatieve indicatie**: ~625-800 uur over de gehele 6.5 maanden, afhankelijk van of grotendeels fulltime of mix met andere Klarifai-werk (Box.16, etc.).

**Voor €50k IP-koopprijs verdedigbaar bij elke uren-schatting binnen 600-850u** (€60-83/uur, alle conservatief onder zzp-marktrange).

---

## 3. Tariefbenchmark

### Marktconforme tarieven Nederland (2026)

| Rol | Tarief €/uur | Bron |
|---|---|---|
| Zzp Software Developer (gemiddeld NL, 2026) | €81 | Onafhankelijke zzp-uurtarief-research 2026 |
| Senior Full-stack Developer NL (zelfstandig) | €94 | Sector-onderzoek freelance.nl + IT-specialisten |
| Senior Specialist met cloud + AI-expertise | €110-€140 | Marktconform voor TypeScript/Python + Anthropic/PostGIS combinatie |
| Tech Lead met productverantwoordelijkheid | €120-€160 | Inclusief architecturele + besluitvormings-rol |

**Gehanteerd tarief voor deze berekening: €80/uur** (conservatieve onderkant van zzp-marktrange, zonder seniority-toeslag).

**Rationale conservatieve tarief:**
- Geen premium voor schaarse skills (AI + GIS-combinatie zou hoger rechtvaardigen)
- Geen tech-lead-toeslag (eenmans-architectuur, single-decision-maker)
- Geen premium voor speed/AI-tooling (relevante 2025-2026 marktshift)
- Past bij houdbare onderbouwing richting Belastingdienst (vermijdt "te hoog gewaardeerd om verkapte foundersbeloning" interpretatie)

---

## 4. Waardeberekening

### 4.1 Direct uren × tarief
```
625 uur × €80/uur = €50.000
```

### 4.2 Alternatieve invalshoeken (cross-check)

**Vervangingswaarde:** wat zou het kosten om Propdex vanaf 0 op te bouwen door een extern team?
- Senior dev-team (2-3 personen) × 6 maanden full-time × €100/u × 160u/mnd = **€288.000 — €576.000**
- Conclusie: €50k IP-prijs is **5-11x lager dan vervangingswaarde**, conservatief gewaardeerd

**Discounted cash flow** (toekomstige inkomsten):
- Bij 50 klanten gemixt jaar 2 = €375k ARR
- Bij 100 klanten jaar 3 = €750k ARR
- IP-koopprijs €50k = ~3-5% van jaar 3 ARR-projectie. Verdedigbaar.

**Persoonlijke goodwill (NIET inbegrepen):**
- Klarifai's kennis + reputatie + relaties blijven bij Klarifai BV, geen waarde-overdracht
- Conform NL-praktijk: persoonlijke goodwill telt niet mee in bedrijfswaarde

### 4.3 Conclusie waarde

**Koopprijs €50.000** is verdedigbaar via meerdere benaderingen:
- Onder de markt-conforme urenraming × tarief (conservatief)
- Substantieel onder vervangingswaarde
- Klein percentage van middellange ARR-projectie

**Vast bedrag — geen step-up of bijstelling.** Klarifai en partner zijn overeengekomen €50.000 als definitieve koopprijs. Eventuele latere angel-ronde of hogere bedrijfswaardering leidt niet tot herziening van deze prijs — IP-overdracht is afgehandeld op moment van BV-oprichting.

---

## 5. Voorgestelde structuur overdracht

### 5.1 Mechanisme — 24-maandelijkse termijnen

1. **Bij oprichting Propdex BV** verkoopt Klarifai BV de IP aan Propdex BV
2. **Koopprijs €50.000** wordt **niet direct cash** betaald — afgelost via gespreide termijnen
3. Bedrag wordt geboekt als **achtergestelde schuld van Propdex BV aan Klarifai BV**, met onderliggende leningsovereenkomst
4. **Aflossing in 24 maandelijkse termijnen van €2.083,33 vanaf maand 1 na BV-oprichting** (renteloos of nominale rente — advocaat bepaalt fiscaal optimaal)
5. **Versnelde aflossing optioneel** bij angel-ronde:
   - Indien externe investeringsronde plaatsvindt vóór 24 maanden voltooid: resterende saldo kan in één keer worden afgelost uit opgehaalde middelen
   - Niet verplicht — bestuur Propdex BV beslist of versnelling past binnen use-of-funds-plan van de ronde
   - Aanbeveling advocaat: maximaal 25% van angel-ronde mag aan IP-aflossing besteed worden (anders signaal naar nieuwe investeerders dat geld vooral founder-afkoop financiert)
6. **Cash-flow-cushion clausule** (aanbevolen): bij aantoonbare negatieve operationele cash-flow van Propdex BV mag de bestuurssamenstelling in gezamenlijk besluit **maandelijkse termijn tijdelijk opschorten**, met opgespaarde achterstand inhalen binnen 12 maanden na herstel van positieve cash-flow. Maximaal 6 maanden cumulatief uitstel zonder herstel = trigger voor evaluatie + bijstelling.
7. **Achterstelling:** vordering staat achter algemene crediteuren (geen blokkade BV-operations bij financiële druk van derden)

### 5.2 Financiële realiteit-check (Optie D — bootstrap-tot-angel)

| Fase | Maandelijkse IP-termijn | Verwachte MRR | Netto cash-impact Propdex BV |
|---|---|---|---|
| Maand 1-6 (pre-MRR / pre-angel) | €2.083 nominaal, **opgeschort via 5.1.6** | €0-3k | Geen druk; partner pitcht angels parallel |
| Maand 7-12 (early traction / angel-window) | €2.083 nominaal | €3-8k | Variabel — termijnen starten zodra MRR voldoende OF angel-ronde binnen |
| Maand 13-24 (growth) | €2.083 + inhaal opgespaarde achterstand | €8-15k | Geconcentreerde aflossing-fase |
| Maand 25-32 (mogelijk uitloop) | tot saldo nul | €15k+ | Schema uitloop bij vertraagde MRR-groei |

### 5.3 Geen founder-cash-inbreng bij oprichting — bootstrap-pad

Propdex BV start zonder werkkapitaal. Bewuste keuze (Optie D in beslissingstabel partner-briefing §6) om:
- Circulariteit te vermijden (Klarifai-cash → Klarifai-IP-aflossing = nul-som)
- Partner geen cash-inbreng te eisen (sales-belofte is zijn primaire bijdrage)
- "Puur 50/50 op delivered/promised value" filosofie te respecteren

**Werkkapitaal-strategie:**
- **Spoor 1 — Angels:** partner pitcht angels parallel met klant-acquisitie. €100-300k seed binnen 3-6 maanden. 25% van funds mag IP-versnelling financieren.
- **Spoor 2 — Klanten:** eerste 3 betalende klanten binnen 2-4 maanden uit partner's netwerk. Bouwt MRR + referenties voor angel-pitch.

**Risico-scenario:** indien spoor 1 EN spoor 2 beide haperen (geen angel-ronde + geen klanten binnen 6 maanden), houdt cushion-clausule BV in stand maar moet partner-evaluatie plaatsvinden over deal-houdbaarheid.

### 5.2 Juridische documenten

Door ondernemingsrechtelijk advocaat op te stellen:

1. **IP-overdrachtsakte / Asset Purchase Agreement** Klarifai BV → Propdex BV
   - Lijst van overdragen rechten (zie §1)
   - Garanties: schoon eigendom, geen geschillen, geen claims derden
   - Koopprijs + betaalmechanisme
2. **Leningovereenkomst** Klarifai BV → Propdex BV
   - Achterstellingsclausule
   - Aflossingsregeling (zie 5.1.5)
   - Eventuele rente (advocaat bepaalt fiscaal optimaal)
3. **Bestuursbesluit Propdex BV** — akkoord aankoop IP
   - Tegenstrijdig-belang-procedure (Klarifai aan beide zijden van transactie)
   - Externe-deskundige-vaststelling waarde indien gewenst voor zekerheid
4. **Aandeelhoudersbesluit** — bekrachtiging IP-aankoop + uitgestelde foundersvordering

---

## 6. Auteursrechtelijke verklaring (te tekenen door Klarifai's bestuurder)

> Ondergetekende, [Naam], handelend namens Klarifai BV (KvK: __________), verklaart hierbij dat:
>
> 1. De software, designs en documentatie zoals omschreven in §1 van dit memo geheel of grotendeels eigenhandig zijn ontwikkeld in opdracht van of binnen Klarifai BV;
> 2. Geen derde partij (medewerker, freelancer, opdrachtgever, of andere) aanspraak kan maken op auteursrecht of eigendomsrecht op deze werken;
> 3. Geen open-source code is opgenomen in strijd met de licentievoorwaarden van die code;
> 4. Geen confidentiële informatie van derden is opgenomen;
> 5. Klarifai BV bevoegd is de in §1 omschreven rechten over te dragen aan Propdex BV onder de voorwaarden zoals geformuleerd in §5;
> 6. Eventuele toekomstige aanspraken van derden op deze rechten voor rekening en risico komen van Klarifai BV (vrijwaringsclausule t.a.v. Propdex BV).
>
> Plaats: __________ &nbsp;&nbsp;&nbsp;&nbsp; Datum: __________
>
> Handtekening: ____________________
> Klarifai BV — namens deze: [Naam], bestuurder

---

## 7. Aandachtspunten voor de advocaat

Onderwerpen die de advocaat **moet** adresseren bij opstellen definitieve stukken:

1. **Tegenstrijdig belang**: Klarifai (verkoper) en Klarifai-bestuurder (mede-bestuurder Propdex BV) zitten aan beide zijden van de transactie. Vereist:
   - Specifiek bestuursbesluit Propdex BV met onafhankelijke onderbouwing
   - Mogelijk goedkeuring door alle aandeelhouders (Klarifai BV én Partner Holding BV)
   - Tegenstrijdig-belang-protocol vastleggen voor toekomstige soortgelijke transacties

2. **Waardebepaling validatie**: optioneel een onafhankelijke registervaluator inschakelen die de €50k bevestigt. Kost €1-2k extra maar maakt de structuur "bullet-proof" voor latere due-diligence. Aanbevolen voor angel-traject.

3. **BTW**: IP-overdracht tussen NL-BV's met passende KvK-status is doorgaans BTW-vrijgesteld als "overdracht algemeenheid van goederen" (art. 37d Wet OB). Advocaat/fiscalist verifiëren of dat hier geldt.

4. **Loonbelasting-vrijwaring**: expliciete clausule dat de €50k geen verkapt loon van Klarifai-bestuurder is, maar een zakelijke koopprijs van Klarifai BV. Voorkomt Belastingdienst-discussie.

5. **Vrijwaring derden**: standaard reps & warranties (auteursrechtelijke schoonheid, geen claims derden, geen open-source-licentie-conflicten).

6. **Naderhand-discovery clause**: wat als later blijkt dat enige onderdeel van de overgedragen IP toch claim van derde heeft (bv. een freelancer die nog niet betaald was, of een library met restrictieve licentie). Aansprakelijkheidsregeling.

---

## 8. Bijlagen op aanvraag

- Volledige git-history-export (~2.193 commits) met datum + commit-bericht — kan via `git log --pretty=format:"%h %ad %s"` worden gegenereerd
- Repository-structuurdump (full tree + LOC per directory)
- Lijst van 35 ORM-modellen + Alembic-migratiehistorie
- Lijst van 47 milestones (M001-M047) zoals vastgelegd in `.planning/MILESTONES.md` + `.planning/ROADMAP.md`
- Lijst van externe API-integraties met test-evidence
- Screenshots werkende applicatie (Discovery-modus, ParcelDetailModal, Intelligence Grid)

---

*Dit document is opgesteld op 14 mei 2026 als briefingstuk voor de ondernemingsrechtelijk advocaat die belast wordt met de SHA + IP-overdrachtsakte. Hoofdcijfers zijn voorstellen; finale formulering door advocaat.*

**TE COMPLETEREN DOOR KLARIFAI VÓÓR ADVOCAAT-AFSPRAAK:**

- [ ] Uren-tabel in §2 invullen (concrete eigen schatting voor nov 2025 — mei 2026)
- [ ] KvK-nummer Klarifai BV in §6 invullen
- [ ] Naam + persoonsgegevens bestuurder Klarifai BV invullen in §6
- [ ] Eventueel onafhankelijke waardebepaling laten doen (€1-2k, optioneel maar versterkt angel-DD)
- [ ] Repository-screenshots maken (2-3 stuks voor bijlagen)
- [ ] Cash-flow-cushion clausule (5.1.4) bespreken met partner — opschorting + inhaal-mechanisme
- [ ] Pijplijn-plan voor partner voorbereiden (lijst 10-20 prospects + 3 angel-contacten als basis voor bootstrap-strategie)

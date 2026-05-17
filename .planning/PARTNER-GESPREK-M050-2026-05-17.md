# Partner-Gesprek — M050 BRK Actiefase

**Persoonlijk briefingstuk voor Klarifai · niet bedoeld voor partner**
**Datum opgesteld:** 17 mei 2026 · **Context:** kickoff M050 BRK Actiefase-Wedge

---

## Waarom dit gesprek nodig is

M050 is geen scoring-uitbreiding maar een product-mode-shift (onderzoekstool → actietool). Dat raakt:
1. **Sales-narratief** — Propdex pitcht nu een ander product dan in eerdere partner-conversaties
2. **Cost-model** — Propdex draagt variabele PostNL-cost in tier-prijs (master-account-model)
3. **Partner-onboarding** — pre-sale partner heeft week 8-12 commitment nodig
4. **Juridisch traject** — verwerkersovereenkomst-template moet aangepast vóór GA
5. **Volume-aannames** — quota-defaults staan of vallen met realistische perceel-volumes

Vóór je begint te bouwen wil je partner-alignment op deze vijf. Als één wringt → bijstellen vóór M050/S01-kickoff.

---

## Pre-sale partner — concrete vragen

**Status:** Pre-sale conditie is hard genoeg om M050 op te bouwen. Maar Propdex bouwt 8-12 wk voor deze partner. Bevestiging op de volgende punten dicht het commitment-gat.

### 1. Bereidheid om week 8-12 first-live-user te zijn

Vraag: *"We shippen M050 in week 8-12. Tijdens die periode bouwen we de actiefase voor jullie use-case. Zijn jullie bereid om bij ship direct in productie te draaien, of moeten we eerst beta-fase doen?"*

- Akkoord direct-productie = optie B uit office-hours (gekozen pad)
- Liever beta = re-evaluatie naar optie D (private beta week 6)

### 2. Volume-validatie quota-aannames

Quota-defaults zijn gebaseerd op aannames die we moeten valideren:

| Aanname | Voorgestelde quota |
|---|---|
| ~10 percelen-onderzoek/mnd | Paid 25 BRK-lookups |
| ~50 percelen-onderzoek/mnd | Enterprise 250 BRK-lookups |
| 5:1 onderzoek-tot-brief-ratio | Paid 5 brieven, Enterprise 50 brieven |

Vraag de partner:
- *"Hoeveel percelen onderzoeken jullie typisch per maand?"*
- *"Welke fractie daarvan wordt actief benaderd (brief gestuurd)?"*
- *"Pieken: seizoenscampagnes? Heel jaar verspreid?"*

Als ratio of volume substantieel anders → quota-defaults herijken (`.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` Q8).

### 3. Eigen Kadaster-relatie

BRK is BYOC-pattern. Vraag:
- *"Hebben jullie al een Kadaster-zakelijk-contract met budgetfinanciering? Of moet dat onderdeel zijn van Propdex-onboarding?"*
- Als geen: budget Kadaster (~€500-2000/jr) komt bovenop Propdex-tier — bevestigen of dat acceptabel is

### 4. PostNL-business-model communicatie

Beslissing: Propdex tekent één PostNL Zakelijk-master-account, jullie brieven gaan daaruit. Partner heeft géén eigen PostNL-contract nodig.

Vraag voor afstemming:
- *"Brieven gaan met sender-naam = JOUW bedrijfsnaam (partner-branding). Dat is hoe het werkt qua Postwet en hoe de eigenaar van het perceel je herkent. Akkoord?"*
- Mogelijk tegenargument: partner wil eigen PostNL-account voor tracking-eigendom → check Hybride-optie uit Q6

### 5. Brief-template content + branding

Brieven worden in M050 uit 3 templates gegenereerd (cold-outreach, follow-up, verkenning).

Vraag:
- *"Hebben jullie bestaande brief-formats die we kunnen overnemen als startpunt? Tone-of-voice, opening, sign-off?"*
- *"Welke variabele velden zijn must-have: project-context, eigenaar-aanhef, partner-bedrijfsnaam, partner-contact-info, eigen logo?"*
- Acquisitie-context-template = MVP; follow-up en verkenning kunnen iteratief later

---

## Partner — strategische items

### A. Sales-narratief shift

**Tot dusver gepitcht (per `.planning/PARTNER-BRIEFING-2026-05-13.md`):** "Vastgoed-DD-fragmentatie oplossen — van scouting tot go/no-go in één platform."

**Nieuw narratief vanaf M050:** *"Propdex is de cockpit voor de voorkant van vastgoedontwikkeling — van grondpositie tot brief-naar-eigenaar in 1 platform. Actiegericht werken kan pas als vooronderzoek klopt. Wij leveren beide."*

Aandachtspunten voor partner:
- M050-feature wordt de eerste reden waarom een ontwikkelaar Propdex pakt boven Matrixian/Calcasa (die doen alleen waarde-data, niet contact-actie)
- Vindsubsidies (subsidie-laag) schuift naar later — partner had dit mogelijk al als verkoopargument gepitcht. **Backtrack-risico beheersen.**
- Brief-feature heeft een sales-effect: partner ziet ROI direct (brief = mogelijke deal), niet pas na maanden gebruik

### B. Cost-model — quota in tier-prijs

Propdex draagt variabele PostNL-cost (~€70/mnd worst-case Enterprise = 5,6% van tier-prijs). Geen factuur-line-item voor partner.

Bespreken:
- *"€15k-plafond per partner houden we vast, maar M050 voegt 5-6% cost-floor toe op Enterprise. Bij 50 Enterprise-partneren = €3.500/mnd PostNL-cost voor Propdex. Cashflow-impact bij scaling — willen we batch-tarief negotiatie inzetten zodra we volume hebben?"*
- Partner moet weten dat tier-marge verandert van ~95% naar ~90% bij volwaardig actie-gebruik

### C. Juridisch traject — verwerkersovereenkomst

Drie juridische tracks parallel met M050-dev:
1. **Kadaster verwerkersovereenkomst (DPA)** — vereist voor production-BRK persistent storage. 4-8 wk legal-track. Start NU.
2. **PostNL sender-identity check** — kan Propdex brief verzenden namens-derde-partij (partner) met partner-branding? Postwet + AVG. Check tijdens PostNL-onboarding.
3. **Propdex ↔ partner verwerkersovereenkomst-template** — BRK-data-handling expliciet, retention-termijnen (30/90 dgn), sub-processor-chain (Propdex → partner → Kadaster), Subject Access Request-procedure, data-residency NL/EU.

Partner-vraag: *"Heb jij een legal-advisor of Privacy Officer in je netwerk die de verwerkersovereenkomst-template kan reviewen? Anders trekken we Klarifai's bestaande adviseur."*

### D. Roadmap-impact

Tot dusver gepitcht: scoring-roadmap M046-M058 (~14 scoring milestones).

Nieuw vanaf M050:
- M050 = actiefase-wedge (3-4 mnd realistisch met onboarding)
- M051+ = óf cascade-doc-batch (oud plan) óf actiefase-uitbreiding (CRM-fase 3 uit funnel)
- Tijdslijn naar MVP-completion: verschuift mogelijk 4-6 weken naar achteren

Partner-vraag: *"M050 is een grotere milestone dan M047 + M049 samen. Tijdslijn verschuift. Is dat OK richting angel-pitch-narratief, of moeten we strakker stoppen op MVP-scoping?"*

### E. Vindsubsidies-pivot communicatie

Beslissing 2026-05-17: Vindsubsidies geen eerste paid integration. BRK eerst, Vindsubsidies later.

Bespreken: *"Heb je in eerdere gesprekken Vindsubsidies expliciet genoemd als roadmap-item? Zo ja, wat is de meest natuurlijke manier om dat naar 'later' te shiften zonder vertrouwens-impact?"*

---

## AVG-retention — discussie-punten (niet-onderhandelbaar maar te valideren)

Beslissing 2026-05-17: 30 dgn soft → 90 dgn hard delete, 7 jr brief-tracking, rechtspersoon-only persistent.

Vragen aan partner (of legal-advisor via partner):
- *"Vinden we 30/90 dagen defensief genoeg, of wil Privacy Officer 0-dagen soft-delete (direct hard)?"*
- *"Is 7-jaar brief-tracking-retention juridisch verplicht (commerciële record) of beleid? Bij beleid: korter mogelijk?"*
- *"Sub-processor-chain Propdex → partner → Kadaster: hoe documenteren we dit in de verwerkersovereenkomst? Is er een Klarifai-template dat we kunnen aanpassen?"*

Items die geen partner-discussie nodig hebben maar wel juridische review:
- Subject Access Request-procedure (automatiseren via admin-UX of via support-ticket)
- Right-to-erasure binnen 30 dagen override soft-delete-window
- Data-residency check (Postgres in NL/EU bevestigen)
- Audit-log retention (2 jaar voorgesteld)

Voor full detail zie `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` §Q7.

---

## Checklist vóór `/gsd:new-milestone M050`

- [ ] Pre-sale partner: week 8-12 first-live-user commitment bevestigd
- [ ] Pre-sale partner: volume-aannames gevalideerd (5:1 ratio, 10/50 percelen/mnd)
- [ ] Pre-sale partner: eigen Kadaster-contract bevestigd of plan om die te regelen
- [ ] Pre-sale partner: PostNL master-account-model + partner-branding-sender akkoord
- [ ] Pre-sale partner: brief-template content + tone-of-voice input
- [ ] Partner: sales-narratief shift besproken (actiefase ipv pure-scoring)
- [ ] Partner: cost-model 5,6% Enterprise-impact besproken
- [ ] Partner: Vindsubsidies-pivot communicatie-strategie afgestemd
- [ ] Partner: legal-advisor / Privacy Officer geregeld voor verwerkersovereenkomst-template
- [ ] Partner: roadmap-verschuiving naar angel-pitch-narratief geïntegreerd
- [ ] Day-1: PostNL Zakelijk contract-onboarding gestart
- [ ] Day-1: Kadaster verwerkersovereenkomst-traject gestart

---

## Volgende skill-stap na partner-gesprek

Als alle items akkoord:
1. `/plan-ceo-review` — scope-check, is M050 ambitieus genoeg of houden we precies dit
2. `/plan-eng-review M050` — architectuur-lock-in
3. `/gsd:new-milestone M050` — roadmap landen
4. `/gsd:plan-phase M050/S01` — eerste slice

Als partner-bespreking iets fundamenteel verandert: terug naar `/gstack:office-hours` met nieuwe framing.

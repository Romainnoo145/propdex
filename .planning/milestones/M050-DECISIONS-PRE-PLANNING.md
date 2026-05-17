# M050 — Decisions pre-planning

Opgesteld: 2026-05-17 als output van `/gstack:office-hours` sessie.
**Status: ALLE DRIE LOCKED 2026-05-17** (user: "doe maar al je recommendeds")
Bron-doc: `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260517-131317.md`

## Locked decisions (2026-05-17)

| # | Vraag | Keuze | Rationale-samenvatting |
|---|---|---|---|
| **Q6** | PostNL business-model | **Optie A — Propdex master-account, resell via quota** | Sales-friction-eliminatie weegt zwaarder dan 5,6% cost-floor-impact. Match met "actie-tool"-positionering. |
| **Q7** | AVG retention-policy | **30 dgn soft → 90 dgn hard delete; 7 jaar brief-tracking; rechtspersoon-only persistent** | Defensieve AVG-baseline; ephemeral pad via Phase 105 blijft voor privé-lookups. PO-review-items aparte werkstroom. |
| **Q8** | Quota-defaults per tier | **Demo 0/0 · Paid 25/5 · Enterprise 250/50, soft 80% hard 100%, geen overage in M050** | Cost-impact 1-5,6% per tier = gezonde marge. Volumes te valideren met pre-sale partner. |

**Wat dit ontgrendelt:**
- `/plan-eng-review M050/S01` is unblocked
- M050.5/S02 quota-implementatie kan plannen met concrete cijfers
- PostNL-onboarding-track heeft expliciete vragenset (zie Q6-vervolgactie)
- Privacy Officer kan parallel verwerkersovereenkomst-template reviewen

**Wat dit NIET vervangt:**
- Day-1 acties uit design-doc (PostNL contract starten, Kadaster DPA starten) blijven nodig
- Pre-sale partner volume-validatie (Q8 uncertainty-items) blijft open — uitvragen tijdens deal-finalisering
- Privacy Officer / legal-advisor-review op verwerkersovereenkomst-chain is aparte juridische track

---

---

## Cost-basis (research 2026-05-17, public sources)

| Item | Tarief | Bron | Notitie |
|---|---|---|---|
| BRK Bevragen API (production) | **gratis binnen budget-financiering** | [Kadaster Zakelijke tarieven 2026](https://www.kadaster.nl/zakelijk/over-ons/financieel/tarieven) | Partner tekent jaarcontract Kadaster met budget-pakket; calls binnen pakket zijn "gratis". Concrete budget-prijs niet publiek — vraag bij Kadaster |
| Eigendomsinformatie per object (consumer-portal) | €3,70 standaard | idem | Voor consumer-PDF-bevraging, NIET relevant voor API-route |
| Hypotheekinformatie per object | €3,70 standaard | idem | Idem — consumer-portal-route |
| PostNL Zakelijk standaardbrief klein (tot 20g) | **€1,40 per stuk** | [Impress.nl Posttarieven 2026](https://www.impress.nl/blog/wat-kost-een-brief-versturen-in-2026/) | 2026 ongewijzigd tov 2025; 2-werkdagen-bezorging is nieuwe standaard |
| PostNL Zakelijk batch-tarief | Lager, niet publiek | [PostNL Zakelijk](https://www.postnl.nl/zakelijk/tarieven/) | "Scherp aanbod" op aanvraag bij maandelijks volume — relevant als Propdex master-account neemt |

**Conclusie cost-basis voor quota-modelling:**
- BRK-side: **€0 variabele cost voor Propdex** als partner zelf Kadaster-contract heeft (BYOC). Tier-quota op BRK-lookups is een **gebruiksgrens**, niet een cost-floor-bescherming.
- PostNL-side: **€1,00–1,40 per brief variabele cost** afhankelijk van master-account (Optie A onder Q6) vs per-org (Optie B). Tier-quota op brieven IS cost-floor-bescherming voor Propdex als Optie A.

---

## Q8 — Quota-defaults per tier *(voorstel, bevestig of overschrijf)*

### Voorgestelde quota per tier per maand

| Tier | Maandprijs | BRK-lookups | Brieven | PostNL-kost @ €1,40 (worst-case) | % van tier-prijs |
|---|---|---|---|---|---|
| **Demo** | €0 | 0 (locked) | 0 (locked) | €0 | n.v.t. |
| **Paid** | €699 | 25 | 5 | €7,00 | 1,0% |
| **Enterprise** | €1.249 | 250 | 50 | €70,00 | 5,6% |

### Rationale

**Demo (0/0):** demo-tier toont scoring + scan-features. Actiefase is paid-only — anders ondergraaft demo de tier-waarde van Paid/Enterprise.

**Paid (25 BRK / 5 brieven):** Pilot-niveau voor ontwikkelaar met ~5-10 percelen-acquisitie-pipeline per maand. Brief-quota gaat ervan uit dat niet elke onderzochte perceel een brief krijgt (factor ~5:1). Cost-impact 1% van tier-prijs = ruime marge.

**Enterprise (250 BRK / 50 brieven):** Volwaardig acquisitie-team. 50 brieven/mnd = 12/wk = realistisch voor 2-3-persoons acquisitie-team. Cost-impact 5,6% blijft acceptabel — bij 80% margin-doel houdt Propdex 75-79% over.

### Soft-cap policy

- **80% van quota:** warning-banner in opgeslagen-tab + upsell-CTA naar hogere tier
- **100% van quota:** hard-block met "upgrade nu" knop; brieven gaan in pending-state tot volgende maand of upgrade
- **Reset:** maandelijks op de 1e (UTC), via ARQ cron-job in M050.5/S02
- **Overage-billing:** **niet in M050** — bewust beslist als toekomst-optie (M051+). Hard-cap voorkomt onverwachte cost-spike.

### Uncertainty / risico's

1. **Volume-aannames zijn schattingen.** Bevestig met pre-sale partner: hoeveel percelen onderzoeken jullie per maand? Hoeveel daarvan krijgen brief? Als ratio anders dan 5:1 → quota's herijken.
2. **BRK-budget bij Kadaster onbekend.** Als partner geen budget-financiering wil → fallback per-bevraging €3,70/object × 25 = €92,50/mnd voor partner. Bij Paid-tier is dit boven €699-feel pijnlijk — bevestig bij Kadaster-onboarding.
3. **PostNL batch-tarief.** Bij Optie A (master-account) onder Q6 wordt PostNL-cost mogelijk €0,80–1,00/brief → margin-impact halveert.
4. **Tracking-webhook-cost.** Onbekend of in basis-pakket of upgrade. Mogelijk €X/maand fixed bij Propdex (master-account-scenario).

### Beslissing (LOCKED 2026-05-17)

[x] **Akkoord met 0/0 · 25/5 · 250/50 voor Demo/Paid/Enterprise** (M050.5/S02 implementeert deze defaults)
[x] **Quota-reset cadans: 1e van maand UTC**
[x] **Overage-billing-plan: niet in M050** (M051+ pas)

Pre-sale partner validatie van volume-aannames blijft open uncertainty (geen blocker, herijken indien afwijkend).

---

## Q6 — PostNL business-model *(decision-brief)*

**Vraag:** Tekent Propdex één PostNL Zakelijk master-contract en biljett via quota in tier-prijs (Optie A), of tekent elke partner z'n eigen PostNL-contract en configureert credentials in M049 admin-hub net als bij BRK (Optie B)?

### Optie A — Propdex master-account (resell via quota)

**Mechanica:**
- Propdex tekent één PostNL Zakelijk contract met API-toegang
- Partneren hebben geen PostNL-relatie nodig
- Brieven gaan namens-partner via sender-aanpassing in PostNL API
- Cost (~€0,80–1,40/brief) zit in tier-prijs verstopt via quota — geen factuurregel

**Pro:**
- **Sales-friction = 0.** Partner tekent Propdex-abonnement, krijgt direct werkende actiefase. Match met "actie-tool"-positionering.
- **Schaalbaar:** één contract-relatie, één integratie, één set credentials.
- **Batch-tarief mogelijk:** bij voldoende volume krijgt Propdex korting → margin omhoog.
- **Tracking-eenduidigheid:** alle webhooks landen bij Propdex, geen multi-tenant credential-puzzel.
- **Consistent met SaaS-pattern:** partner betaalt SaaS-prijs, niet n+1 vendors.

**Con:**
- **Cost-floor risk bij Propdex.** Bij M050.5/S02 quota-doorbraak via Enterprise upgrade-flow weegt PostNL-cost direct op marge (~5,6% bij voorgestelde quota).
- **Sender-identity legal-vraag.** Brief verzenden namens-derde-partij (Propdex stuurt brief in naam van partner naar perceel-eigenaar) raakt Postwet + AVG-verwerkersovereenkomst. Validatie tijdens PostNL-onboarding nodig.
- **Single point of failure:** als Propdex-PostNL-relatie kapot gaat (factuurprobleem, contract-opzegging), zit ELKE partner zonder brief-feature.

**Cost-impact Propdex:** €70/mnd Enterprise (worst-case @ €1,40); minder bij batch. Schaalbaar tot ~€3.500/mnd bij 50 Enterprise-partneren.

### Optie B — Per-org PostNL-contract (BYOC zoals BRK)

**Mechanica:**
- Partner tekent eigen PostNL Zakelijk-contract
- Partner configureert PostNL-API-credentials in Propdex admin-hub via M049-pattern
- Propdex levert alleen integratie-laag; brief-cost gaat direct partner→PostNL
- Geen quota op brieven nodig (partner betaalt PostNL zelf via eigen contract)

**Pro:**
- **Geen Propdex-cost-exposure** op PostNL. Marge-100% op deze laag.
- **BYOC-consistentie met BRK:** partner-config-pattern is uniform voor alle Type-C bronnen.
- **Sender-identity-eenvoud:** partner verstuurt namens zichzelf — geen "namens-derde"-juridische puzzel.
- **Partner heeft directe tracking-relatie met PostNL** voor eventuele disputes/claims.

**Con:**
- **Sales-friction hoog.** Onbekend hoeveel ontwikkelaars al PostNL Zakelijk-contract hebben (vermoedelijk weinig mid-market). Onboarding = nieuwe leverancier-relatie voor partner.
- **"Actie-tool"-belofte wordt zwakker.** Partner koopt Propdex, krijgt actiefase pas na separaat PostNL-contract — onderbreking van "één tool"-positionering.
- **Geen batch-tarief-voordeel:** elke partner zit op eigen PostNL-tarief, geen volume-aggregatie.
- **Integratie-overhead per partner:** Propdex helpt waarschijnlijk met onboarding-vraag → support-cost.
- **Mismatch met quota-narratief.** Quota op BRK is "gebruiksgrens" (geen Propdex-cost), maar brieven hebben dan ook geen quota → tier-differentiatie zwakker.

**Cost-impact Propdex:** €0.

### Recommendation

**Optie A — Propdex master-account.** Vier redenen:

1. **Sales-friction-eliminatie weegt zwaarder dan cost-exposure.** €70/mnd worst-case op €1.249 Enterprise = €15k/jr partner met 5,6% cost is een hele goede SaaS-margin (~94%).
2. **"Actie-tool"-positionering is M050-kern.** Optie B breekt de naadloze loop die de hele product-mode-shift draagt.
3. **Sender-identity-vraag is werk-eenmalig.** Bij Optie A check je het bij PostNL-onboarding én Privacy Officer, eenmalig. Bij Optie B duw je het naar de partner — die heeft die check ook nodig en wordt vertraagd.
4. **BYOC blijft zinvol bij BRK** (partner heeft typisch al Kadaster-relatie voor due-diligence). PostNL is een transactie-laag, geen data-laag — verschil rechtvaardigt verschillende model.

### Tegen-argument waarom je B zou kiezen

Als pre-sale partner al PostNL Zakelijk-contract heeft EN expliciet zegt "ik wil deze brieven onder MIJN PostNL-account, niet jullie account" (bv vanwege eigen tracking-tool, branding-strikteid, of factuur-trail) → Optie B is zinvol. Anders default A.

### Beslissing (LOCKED 2026-05-17)

[x] **Optie A — Propdex master-account, resell via quota**

**Vervolgactie (day-1):** start PostNL Zakelijk onboarding NU, met expliciete vragenset:
1. Sandbox-credentials + ETA
2. Sender-identity-mogelijkheden voor namens-derde-versturen (Postwet + AVG)
3. Batch-tarief: vanaf welk maandelijks volume krijgt Propdex korting? Bij €1,40 nu, target €0,80–1,00 bij schaal
4. Webhook-SLA: zit delivery-tracking in basis-pakket of upgrade-pakket?
5. Multi-tenant routing: kunnen wij PostNL-account één keer onboarden en per brief sender-naam dynamisch maken (partner-branding)?

---

## Q7 — AVG retention/deletion-policy voor persistent BRK-data *(decision-brief)*

**Vraag:** Hoe lang bewaart Propdex BRK-data nadat een gebruiker een perceel uit "opgeslagen" haalt? Welk deletion-traject volgt?

### Wettelijk kader

- **BRK Eigendomsinformatie** kan natuurlijke personen (privé-eigendom) bevatten → AVG-persoonsgegeven, hogere bescherming nodig.
- **BRK Hypotheekinformatie** vergelijkbaar.
- **Rechtspersoon-data** (bedrijven, overheid) valt niet onder AVG strikt, maar wel onder goede-praktijk-governance + verwerkersovereenkomst met partner.
- **Phase 105 BRK Eigendom Modal** filtert nu al alleen rechtspersoon (geen privé-naam in UI) → dit pattern MOET behouden blijven bij persistent opslag.

### Voorgesteld beleid

**1. Storage scope (welke data gaan we opslaan)**

- ✅ Rechtspersoon-eigendom: naam, KvK-nummer, statutaire zetel, zakelijk-recht-type, koopsom, koopjaar, hypotheek-flag
- ✅ Overheid-eigendom: idem
- ❌ Natuurlijke persoon eigendom: **niet opslaan in persistent-laag**. Bij API-respons met privé-eigenaar → record opslaan met `eigenaar_type = "privé"` + `eigenaar_naam = NULL`, géén persoonsgegevens persistent
- ❌ Phase 105 ephemeral modal blijft beschikbaar voor on-the-fly privé-lookups (gcTime=0, no storage) — geen verandering tov huidige AVG-baseline

**2. Retention-life-cycle**

| Trigger | Actie | Termijn |
|---|---|---|
| Perceel wordt opgeslagen, BRK gequery'd | BRK-record gecreëerd, status `active` | n.v.t. |
| Perceel wordt uit opgeslagen gehaald | Status → `soft_deleted` (record bewaard, niet zichtbaar in UI) | T = unfavorite-moment |
| Soft-delete-periode | Record reversibel (her-favorite restored het) | T + 30 dagen |
| Hard-delete | Record permanent verwijderd uit DB | T + 90 dagen |
| Re-favorite vóór hard-delete | Soft-delete opgeheven, geen nieuwe BRK-call | n.v.t. |
| Organisatie-account-sluiting | Onmiddellijke hard-delete van alle records org | direct |

**Rationale termijnen:**
- 30 dagen soft = partner kan per ongeluk unfavorite reverten zonder data-verlies
- 90 dagen hard = max retention voor BRK-data zonder actieve partnerrelatie. Korter dan typische verwerkersovereenkomst-norm (1 jaar) — extra-strikt omdat we transactionele data (eigenaar-NAW) bewaren

**3. Tracking-data (verzonden brieven) retention**

- Brief-content (recipient-adres, brief-tekst, tracking-status) blijft **7 jaar** retentie (commerciële record voor mogelijke geschil/dispute)
- Niet gebonden aan BRK-record-lifecycle — een brief blijft bewaard ook al wordt het bron-perceel uit opgeslagen gehaald

**4. Audit-log**

- Elke BRK-bevraging logged: wie (user_id), wanneer, voor welk perceel, welk org
- Audit-log retention: 2 jaar
- Inzage door partner: SAR-procedure (zie Privacy Officer items hieronder)

**5. Privacy Officer review-items**

Niet door dev op te lossen, juridisch traject vereist:

- [ ] **Verwerkersovereenkomst tussen Propdex en partner** moet expliciet BRK-data-handling, retention-termijnen, sub-processor-status (Kadaster), en deletion-trigger noemen
- [ ] **Subject Access Requests (SAR):** procedure voor "welke BRK-data hebben jullie over mij/mijn bedrijf opgeslagen?" — moet automatisch beantwoordbaar of via partner-routering
- [ ] **Right to erasure:** verwijder-verzoek van data-subject moet binnen 30 dagen leiden tot hard-delete (override soft-delete-window indien nodig)
- [ ] **Data-residency:** bevestig Postgres-instance draait in NL/EU. Geen data-transfer buiten EU.
- [ ] **Sub-processor agreement met Kadaster:** Propdex is mogelijk sub-processor voor partner; Kadaster is dan sub-sub-processor. Documenteren in verwerkersovereenkomst-chain.

**6. Export-functie**

- Partner kan op verzoek alle BRK-records + verzonden-brieven van eigen organisatie exporteren (JSON/CSV) voor eigen archivering
- Built in M050/S08 als admin-functie

### Alternatieven om te overwegen

- **Stricter:** 0 dagen soft-delete (direct hard-delete bij unfavorite). Veiliger AVG, minder UX-fout-tolerant. Aanrader als Privacy Officer dit wenst.
- **Korter hard-delete:** 30 of 60 dagen i.p.v. 90. Defensiever, behoud van re-favorite-functie.
- **Langer retention voor "research-archief":** opt-in toggle per partner: "behoud BRK-history voor verslag-doeleinden tot 1 jaar". Risk: AVG-uitleg complexer, alleen overwegen als partner expliciet vraagt.

### Beslissing (LOCKED 2026-05-17)

[x] **30 dagen soft-delete → 90 dagen hard-delete retention-life-cycle**
[x] **7-jaar brief-tracking retention** (commerciële record)
[x] **Storage Scope: rechtspersoon-only persistent**; privé-eigendom alleen ephemeral via bestaande Phase 105 modal (no storage)
[x] **Privacy Officer-review-items naar aparte juridische werkstroom** (parallel, niet M050-dev-blokker maar wel ship-blokker — verwerkersovereenkomst MOET rond zijn vóór GA-flip)

**Vervolgactie M050-dev:** retention-policy + deletion-trigger opnemen in M050/S01 datamodel (soft_deleted_at, hard_delete_after kolommen, ARQ cron-job voor periodic cleanup).

**Vervolgactie juridisch:** verwerkersovereenkomst-template aanpassen voor BRK-data-handling, retention-termijnen, sub-processor-chain (Propdex → partner → Kadaster). Laten reviewen door PO of legal-advisor.

---

## Sources

- [Kadaster Zakelijke tarieven 2026](https://www.kadaster.nl/zakelijk/over-ons/financieel/tarieven)
- [PostNL Zakelijk Tarieven](https://www.postnl.nl/zakelijk/tarieven/)
- [PostNL Tarievenboekje 2026 (PDF)](https://www.postnl.nl/api/assets/blt43aa441bfc1e29f2/blt770f6ae54ed9c28c/tarievenboekje-2026b.pdf)
- [Impress.nl Posttarieven 2026 overzicht](https://www.impress.nl/blog/wat-kost-een-brief-versturen-in-2026/)

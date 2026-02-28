# Feature Landscape: v9.0 Professional Marketplace — Kwaliteitsborger Lead Generation

**Domain:** Dutch Construction Professional Marketplace — Wkb kwaliteitsborger lead generation on existing property intelligence platform
**Researched:** 2026-03-01
**Confidence:** HIGH (Wkb law, TloKB register, Bbl requirements via official Dutch government sources) / MEDIUM (marketplace patterns via web research and comparable platforms)

---

## Context: What Already Exists (Do Not Re-Build)

This milestone transforms the existing property intelligence platform into a lead generation platform. The following infrastructure is already shipped and must be extended, not replaced.

**Existing platform capabilities that feed this milestone:**
- `PropertyReportResponse` pipeline — BAG, DSO, WOZ, EP-online, BRK, RCE data per address
- `buildability_delta` — hoeveel kan hier nog gebouwd worden (m², units, height delta)
- `wkb_precheck` — Layer A: gevolgklasse determination + Layer B: optional refinement (already built in v7.2)
- `permit_precedent_benchmark` — comparable permits by gemeente and building type
- `bouwjaar` from BAG — critical for asbest risk flagging (pre-1994 threshold)
- `energielabel` from EP-online — registered label data
- `bodemloket` — Bodemloket WMS available (WFS limited, ArcGIS REST documented at gdngeoservices.nl)
- Area scan results — parcels with opportunity scores, bestemmingen, zoning data
- Meldingen intelligence — bekendmakingen matched to parcels
- PDF export pipeline via WeasyPrint — already generates structured reports

**Wkb context (mandatory for feature decisions):**
- Wet kwaliteitsborging voor het bouwen (Wkb) mandatory from January 1, 2024 for gevolgklasse 1
- Gevolgklasse 1 = grondgebonden woningen, vakantiewoningen, industriegebouwen max 2 verdiepingen
- Gevolgklassen 2 and 3 are NOT yet mandatory — current scope is exclusively GK1
- TloKB (Toelatingsorganisatie) maintains the public register at register.tlokb.nl
- VKBN is the professional association for kwaliteitsborgers
- Kwaliteitsborger fee: approximately 1–1.5% of bouwsom (€3,750 for €250K bouwsom)
- 33 projects were fully gereedgemeld by end of 2024 — market is early-stage, opportunity is real

---

## Table Stakes

Features that a property developer or kwaliteitsborger expects from a professional lead generation platform in this domain. Missing these makes the product feel unfinished or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Gevolgklasse determination (GK1/2/3) | Every Wkb workflow starts here — the kwaliteitsborger cannot quote without knowing the class | LOW | Already partially built in v7.2 `wkb_precheck`. Extend with explicit GK label and rationale display. Rules: grondgebonden woning = GK1; functie + verdiepingen + span determine class |
| Asbest risk indicator (bouwjaar-based) | Pre-1994 buildings have presumptive asbest risk — legally mandated inventory before sloop/verbouw. Kwaliteitsborger needs to know this upfront | LOW | Derived from existing BAG `bouwjaar`. Simple threshold: bouwjaar < 1994 → flag. Display as a prominent risk badge on the report. No new API needed |
| Bodemloket soil contamination indicator | Kwaliteitsborger risicobeoordeling must address "bijzondere lokale omstandigheden" including bodemverontreiniging — missing this means incomplete dossier | MEDIUM | Bodemloket ArcGIS REST at `gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer`. Query by parcel geometry (ST_Contains or bbox). Returns WBB_punten (point contaminations) and WBB_locaties (polygon areas). Display as "Bodemverontreiniging aanwezig/niet aanwezig/onbekend" |
| Risicobeoordeling dossier (structured PDF) | Kwaliteitsborger saves 1–3 hours per project if the initial dossier is pre-assembled. The risicobeoordeling must cover: constructieve veiligheid, brandveiligheid, energieprestatie, specifieke lokale omstandigheden | HIGH | Aggregate from existing report sections + new Bodemloket data + asbest indicator + GK classification into a structured PDF export. Uses existing WeasyPrint pipeline. New template only |
| "Vraag kwaliteitsborger aan" CTA in report | Users expect an actionable next step after reading a property intelligence report — without a CTA, the lead generation journey breaks | LOW | A button/card in the report UI. Triggers a lead capture form. No payment required — manual matching in MVP. Must appear contextually after GK determination is shown |
| Lead capture form (project brief) | Kwaliteitsborger needs: type bouwwerk, locatie, bouwjaar, GK, oppervlakte, geschatte bouwsom, contactgegevens. Without this, a professional cannot respond | MEDIUM | Form collects: address (auto-filled from report), bouwjaar (auto-filled), gevolgklasse (auto-filled), bouwtype, geschatte bouwsom, gewenste startdatum, opmerkingen, naam, email, telefoon. Pre-fill from existing report data where possible |
| Professional directory listing (kwaliteitsborger profiles) | Users expect to see who they are contacting — anonymous lead routing is distrusted. TloKB register is public, VKBN lists members | MEDIUM | Display per listing: naam/organisatie, erkend instrument, werkgebied (provincie/gemeente), contactgegevens, TloKB register link. MVP: static or manually maintained. Phase 2: dynamic from TloKB public register |
| Lead notification to professional | Kwaliteitsborger must be notified when a matching lead arrives — without this the marketplace is just a form | MEDIUM | Email notification to matched kwaliteitsborger with project brief summary. MVP: manual routing by Propdex team. Phase 2: automated matching by werkgebied/type |
| Lead confirmation to developer | Developer must receive confirmation their request was received — no confirmation = no trust | LOW | Email confirmation to developer with: submitted project brief summary, expected response time (48 hours), contact for support. Transactional email via existing infra |

---

## Differentiators

Features that make Propdex meaningfully better than a generic marketplace (Werkspot, Bark.com) for this specific domain. These leverage the existing property intelligence platform in ways a general marketplace cannot.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pre-filled dossier from property data | Kwaliteitsborger typically asks developer for 5–10 documents before quoting. Propdex auto-assembles: gevolgklasse, bouwjaar, bestemmingsplan, bodemkwaliteit, asbest indicator, energielabel, BRK eigendomsdata, oppervlakte | HIGH | Depends on all existing data pipeline sections. The dossier replaces the "intake questionnaire" phase, saving 1–3 hours per project. Core differentiator vs any generic marketplace |
| Gevolgklasse pre-determination with rationale | Generic platforms ask the user to select a category manually. Propdex determines GK1/2/3 automatically from BAG + bestemmingsplan data and explains why | MEDIUM | Leverages existing `wkb_precheck` Layer A. Display: GK badge + "Waarom GK1: grondgebonden woning, 2 verdiepingen, geen bijzondere functies" rationale card. Kwaliteitsborger trusts pre-screened leads |
| Bodemloket risk flag in lead brief | Generic marketplaces send project descriptions. Propdex sends structured risk signals — kwaliteitsborger can immediately see: asbest Y/N, bodem Y/N, GK, oppervlakte. Faster decision on which leads to pursue | MEDIUM | Requires Bodemloket integration. Display as structured risk matrix in the lead notification email and professional dashboard |
| Permit precedent in lead context | Showing comparable vergunningen for the gemeente and building type helps the kwaliteitsborger understand project complexity before accepting | LOW | Leverages existing `permit_precedent_benchmark` (v7.2). Include 2–3 comparable cases in the dossier PDF and lead notification |
| Buildability delta context | For new construction leads, showing hoeveel er nog gebouwd kan worden gives the kwaliteitsborger immediate scope sizing | LOW | Leverages existing `buildability_delta` (v7.2). Include in dossier for nieuwbouw projects |
| Meldingen context (active vergunningaanvragen) | Active bekendmakingen matched to the parcel (vergunningaanvraag, sloopmelding) tell the kwaliteitsborger the project timeline is real | LOW | Leverages existing meldingen intelligence pipeline. Include matched meldingen count and categories in the lead brief |
| Lead quality scoring for professionals | Instead of receiving all leads, kwaliteitsborger sees a "lead score" based on: completeness of dossier, GK match to werkgebied, days to planned start. Prevents wasted time on low-quality leads | MEDIUM | Computed from: dossier completeness %, GK1 confirmed (vs estimated), start date specificity, developer contact verified. Display as 1–5 star or traffic light signal |
| TloKB register verification badge | Display that the kwaliteitsborger is confirmed active in the TloKB register — reduces fraud risk for developers. Generic platforms cannot do this without domain knowledge | MEDIUM | Link to public TloKB register entry. Manual verification in MVP; can automate with register.tlokb.nl scrape or API in Phase 2 |

---

## Anti-Features

Features that seem natural for a marketplace but create specific problems in this domain.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Open bidding / price comparison (aanbesteding) | Developers want to compare prices from multiple kwaliteitsborgers | Commoditizes a professional service that requires trust and ongoing collaboration. Kwaliteitsborgers are reluctant to participate in race-to-bottom bidding. Wkb requires an *ongoing relationship*, not a one-time transaction | Show market rate context (1–1.5% of bouwsom) as an informational reference. Route to 1–2 matched professionals instead of open bidding |
| Star ratings and public reviews for kwaliteitsborgers | Every marketplace has reviews | Kwaliteitsborger-developer relationships are long-term and legally constrained (independence requirement). Bad reviews from a contractor they had to fail could be legally contentious. Market is too small (few hundred active kwaliteitsborgers NL) to get statistically meaningful reviews | Show TloKB registration status, instrument provider, years active, werkgebied coverage as trust signals. Reviews can be added post-market-fit |
| Instant booking / automatic matching without human check | Faster is better | Kwaliteitsborger must be independent from all project parties (architect, aannemer, developer). Matching without checking for conflicts of interest creates legal liability | Lead routing with a manual conflict-of-interest step in MVP. Flag if same kwaliteitsborger already working for the aannemer on this project |
| Payment processing in MVP | Monetize from day one | Payment infrastructure is complex (escrow, VAT, invoicing), legally constrained, and premature — v9.0 goal is to prove lead generation value first. Premature payment adds friction that kills lead volume | Manual invoicing to kwaliteitsborgers for a monthly subscription or per-lead fee. Payment infrastructure deferred to v10.0+ |
| GK2 and GK3 lead generation | More scope = more leads | Wkb does not yet require kwaliteitsborging for GK2/GK3. Taking on GK2/GK3 leads before the law applies creates confusion and professional liability risk | Clearly scope to GK1 only. Show a "GK2/3: kwaliteitsborging nog niet verplicht" notice for higher-class buildings |
| Gevolgklasse determination by user input only | Simpler form, user knows their building | Self-classification leads to systematic errors. A developer may underclassify to save cost. Kwaliteitsborger who acts on wrong GK faces liability | Use automated GK determination from BAG + bestemmingsplan as the primary source. Allow manual override with explicit warning |
| Multi-vertical marketplace launch (kwaliteitsborger + constructeur + asbestbedrijf simultaneously) | One platform for all professionals | Scope explosion for first launch. Each vertical has different compliance requirements, different user journey, different trust signals | Prove the model with kwaliteitsborger vertical first. Leave database schema flexible for future verticals, but build only kwaliteitsborger UX in v9.0 |
| Full CRM pipeline for professionals | Kwaliteitsborgers want to track leads through their sales process | This is a full CRM product (Salesforce/Hubspot), not a marketplace feature. Building it adds months of scope and zero benefit to the developer side | Show lead status (Nieuw / In behandeling / Offerte verstuurd / Afgewezen) updated by the professional via a simple status change. Nothing more |

---

## Feature Dependencies

```
[GK Determination (wkb_precheck v7.2)]
    └── already built ──> [GK display in report UI]
                              └── feeds ──> [Gevolgklasse badge in risicobeoordeling dossier]
                                                └── required by ──> [Lead capture form (auto-fill)]

[Asbest risk indicator]
    └── depends on ──> [BAG bouwjaar] (already in report)
    └── feeds into ──> [Risicobeoordeling dossier]

[Bodemloket integration]
    └── new API ──> [Bodemverontreiniging indicator]
                       └── feeds into ──> [Risicobeoordeling dossier]
                       └── feeds into ──> [Lead brief to kwaliteitsborger]

[Risicobeoordeling dossier PDF]
    └── requires ──> [Existing WeasyPrint pipeline]
    └── requires ──> [GK determination]
    └── requires ──> [Asbest indicator]
    └── requires ──> [Bodemloket indicator]
    └── enhanced by ──> [Permit precedent benchmark (v7.2)]
    └── enhanced by ──> [Buildability delta (v7.2)]
    └── enhanced by ──> [Meldingen matched to parcel (v6.0)]

["Vraag kwaliteitsborger aan" CTA]
    └── depends on ──> [GK determination displayed in report]
    └── triggers ──> [Lead capture form]

[Lead capture form]
    └── auto-fills from ──> [Report data (address, bouwjaar, GK, oppervlakte)]
    └── on submit ──> [Lead record created in DB]
                         └── triggers ──> [Email to developer (confirmation)]
                         └── triggers ──> [Email to kwaliteitsborger (notification)]

[Professional directory]
    └── provides ──> [Routing target for lead notifications]
    └── displays ──> [TloKB registration badge]

[Lead notification to professional]
    └── requires ──> [Professional directory listing]
    └── includes ──> [Risicobeoordeling dossier summary]
    └── includes ──> [Lead quality score]
```

### Dependency Notes

- **Risicobeoordeling dossier requires GK determination:** Without a confirmed gevolgklasse, the dossier is legally incomplete. This means GK display in the report must ship before the dossier feature.
- **Lead capture form requires dossier:** The value proposition of the lead form is "your dossier is pre-assembled." Without the dossier, the form is just another contact form (commodity, low conversion).
- **Bodemloket enhances but does not block dossier:** Dossier can ship without Bodemloket data — show "Bodemkwaliteit: niet opgevraagd" as a placeholder. Add Bodemloket in the same phase if API integration is straightforward, or defer to v9.1.
- **Professional directory is pre-condition for lead routing:** Without at least one listed kwaliteitsborger, leads cannot be routed. Seed with 3–5 known TloKB-registered professionals before launch.

---

## Risicobeoordeling Dossier: Required Content

Based on official Bbl requirements and TloKB guidelines, a compliant risicobeoordeling must cover:

| Content Area | Source in Propdex | Notes |
|-------------|-------------------|-------|
| Gevolgklasse determination | wkb_precheck (v7.2) | GK1 classification + rationale |
| Bouwwerk identificatie (adres, perceel, BAG-ID) | BAG + kadastrale aanduiding | Already in report |
| Bouwjaar | BAG bouwjaar | Already in report |
| Gebruiksfunctie (woonfunctie, industriefunctie) | BAG gebruiksdoel | Already in report |
| Constructieve veiligheid risico's | Derived from bouwjaar + type + GK | Show risk level: low/medium/high based on age and type |
| Brandveiligheid risico's | Derived from GK + function | GK1 residential has standard profile |
| Energieprestatie (energielabel) | EP-online (v7.0) | Label klasse + geldigheid |
| Bijzondere lokale omstandigheden: bodem | Bodemloket | NEW: bodemverontreiniging aanwezig/niet/onbekend |
| Bijzondere lokale omstandigheden: asbest | BAG bouwjaar < 1994 | NEW: asbest risico indicator |
| Gelijkwaardige oplossingen | User-supplied | Text field in lead capture form: "zijn er gelijkwaardige oplossingen gepland?" |
| Vergunningenstatus (actieve aanvragen) | Meldingen intelligence (v6.0) | Matched bekendmakingen count + categories |
| Referentieprojecten gemeente | Permit precedent benchmark (v7.2) | 2–3 comparable cases |
| Bebouwingsmogelijkheden | Buildability delta (v7.2) | For nieuwbouw projects |

---

## MVP Definition

### Launch With (v9.0)

Minimum viable product — what's needed to validate kwaliteitsborger lead generation.

- [ ] GK determination prominently displayed in property report — the entry point for every kwaliteitsborger
- [ ] Asbest risk indicator (bouwjaar < 1994 flag) — zero API cost, derived from existing BAG data
- [ ] Bodemloket soil contamination query (at least WMS-based indicator) — required for risicobeoordeling completeness
- [ ] "Vraag kwaliteitsborger aan" CTA in report, visible after GK is determined
- [ ] Lead capture form with auto-fill from report data — reduces developer effort, increases conversion
- [ ] Risicobeoordeling dossier PDF export — the core value proposition for kwaliteitsborgers
- [ ] Professional directory: minimum 3–5 manually seeded kwaliteitsborger listings
- [ ] Email notification to kwaliteitsborger with dossier summary
- [ ] Email confirmation to developer with submitted brief

### Add After Validation (v9.x)

Features to add once first leads are flowing and kwaliteitsborgers provide feedback.

- [ ] Lead quality scoring — add after seeing what information kwaliteitsborgers actually use to accept/reject leads
- [ ] TloKB register verification badge — adds trust, implement once directory is being used
- [ ] Dynamic professional directory from TloKB register (scrape or API) — replace manual seed data
- [ ] Lead status updates by professional (Nieuw/In behandeling/Offerte) — add once professionals are logging in

### Future Consideration (v10.0+)

- [ ] Payment infrastructure — credit system, per-lead or subscription billing
- [ ] Additional verticals: constructeurs, asbestbedrijven, bodemonderzoekers
- [ ] B2B API for borgingspartijen (Woningborg, Kiwa, SWK)
- [ ] Automated conflict-of-interest checking between professional and project parties
- [ ] Full lead pipeline visualization on map (color-coded by pipeline stage)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| GK display in report | HIGH | LOW (extends v7.2 wkb_precheck) | P1 |
| Asbest risk indicator | HIGH | LOW (BAG bouwjaar already present) | P1 |
| "Vraag kwaliteitsborger aan" CTA | HIGH | LOW (button + form trigger) | P1 |
| Lead capture form (auto-fill) | HIGH | MEDIUM (form + DB model + email) | P1 |
| Risicobeoordeling dossier PDF | HIGH | HIGH (new PDF template, multi-source aggregation) | P1 |
| Bodemloket integration | MEDIUM | MEDIUM (new API client, WMS/REST query) | P1 |
| Professional directory (seeded) | HIGH | LOW (static data, admin CRUD) | P1 |
| Lead notification emails | HIGH | LOW (transactional email, existing infra) | P1 |
| Lead quality scoring | MEDIUM | MEDIUM (scoring logic + display) | P2 |
| TloKB verification badge | MEDIUM | LOW (static link, manual check) | P2 |
| Dynamic TloKB directory | MEDIUM | MEDIUM (register.tlokb.nl scrape) | P2 |
| Lead status tracking | MEDIUM | MEDIUM (status model + professional UI) | P2 |

**Priority key:**
- P1: Must have for v9.0 launch
- P2: Add in v9.x after first leads validated
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Werkspot (NL generic) | Bark.com (INT generic) | Propdex v9.0 Approach |
|---------|----------------------|------------------------|----------------------|
| Professional discovery | Browse by category + location | Browse by category + location | TloKB-verified directory filtered by GK and werkgebied |
| Lead qualification | Consumer fills free-text form | Consumer fills category-specific form | Auto-filled from existing property intelligence data |
| Project dossier | None | None | Structured risicobeoordeling PDF with government API data |
| GK determination | Manual (user selects) | Not applicable | Automatic from BAG + bestemmingsplan |
| Asbest/bodem risk | Not shown | Not applicable | Flagged from bouwjaar + Bodemloket |
| Professional verification | Reviews only | Reviews + some manual checks | TloKB register link (legally authoritative) |
| Conflict of interest check | None | None | Manual in MVP, automated in future |
| Lead response time | Marketplace competition (fast) | Marketplace competition (fast) | Curated routing (slower but higher quality) |
| Payment model | Per-lead credits | Per-lead credits | Manual billing in MVP (no payment infra) |

---

## User Journey: Property Check to Lead Capture

This journey maps how a Propdex user (developer) naturally arrives at a kwaliteitsborger request.

```
1. Developer enters address → generates property report [existing]
        ↓
2. Report displays GK determination: "Gevolgklasse 1 — kwaliteitsborging verplicht" [NEW]
        ↓
3. Report shows asbest indicator (if bouwjaar < 1994) [NEW]
        ↓
4. Report shows bodem risk (if WBB contamination nearby) [NEW]
        ↓
5. Risicobeoordeling dossier generated (PDF export) [NEW]
        ↓
6. Developer sees CTA: "Vraag een kwaliteitsborger aan" [NEW]
        ↓
7. Lead capture form opens — auto-filled with address, bouwjaar, GK, oppervlakte [NEW]
        ↓
8. Developer adds: bouwtype, geschatte bouwsom, startdatum, contactgegevens
        ↓
9. Lead submitted → email confirmation to developer [NEW]
        ↓
10. Lead routed to matched kwaliteitsborger(s) with dossier summary [NEW]
        ↓
11. Kwaliteitsborger responds directly (email/phone) within 48 hours [MANUAL MVP]
```

**Key insight:** Steps 1–5 are the unique Propdex value — no other marketplace gives the kwaliteitsborger a pre-assembled dossier. The CTA (step 6) appears *after* the developer has already seen the intelligence, not before. This context-first approach is why Propdex leads will be higher quality than Werkspot/Bark leads.

---

## Sources

- [Wet kwaliteitsborging voor het bouwen — Rijksoverheid](https://www.rijksoverheid.nl/onderwerpen/bouwregelgeving/meer-toezicht-in-de-bouw-via-de-wet-kwaliteitsborging-voor-het-bouwen-wkb) — HIGH confidence, official
- [Kwaliteitsborger — Informatiepunt Leefomgeving (IPLO)](https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/kwaliteitsborger/) — HIGH confidence, official
- [Bouwwerken in gevolgklasse 1 — IPLO](https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/bouwwerken-gevolgklasse/) — HIGH confidence, official
- [Gevolgklassen — TloKB](https://www.tlokb.nl/wet-kwaliteitsborging/gevolgklassen) — HIGH confidence, official regulatory body
- [TloKB Register (kwaliteitsborgers)](https://register.tlokb.nl/kb/kwaliteitsborger) — HIGH confidence, public official register
- [VKBN — Vereniging Kwaliteitsborgers Nederland](https://www.vkbn.nl/) — HIGH confidence, professional association
- [Dossier bevoegd gezag inhoud — BWTinfo](https://www.bwtinfo.nl/nieuws/2025/11/het-dossier-bevoegd-gezag-wat-moet-daarin) — HIGH confidence, November 2025 industry guidance
- [Asbestinventarisatieplicht Bbl — IPLO](https://iplo.nl/regelgeving/regels-voor-activiteiten/sloopactiviteit/asbestinventarisatieplicht/) — HIGH confidence, official
- [Bodemloket](https://www.bodemloket.nl/) — HIGH confidence, official national soil contamination portal
- [Bodemloket ArcGIS REST endpoint](https://www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer) — MEDIUM confidence (2019 blog source, endpoint may have changed; needs verification)
- [Kwaliteitsborger kosten — Borgingcompany.nl](https://borgingcompany.nl/wet-kwaliteitsborging-kosten/) — MEDIUM confidence, industry pricing data
- [Services Marketplace Features — Rigby](https://www.rigbyjs.com/blog/services-marketplace-features) — MEDIUM confidence, web research
- [Werkspot — Instapro Group](https://www.werkspot.nl/) — MEDIUM confidence, comparable NL platform

---
*Feature research for: v9.0 Professional Marketplace — Kwaliteitsborger Lead Generation*
*Researched: 2026-03-01*

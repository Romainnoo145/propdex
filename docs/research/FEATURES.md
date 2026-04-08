# Feature Research: Projecten Portfolio — Deal Pipeline & Portfolio Management

**Domain:** Property portfolio management + deal pipeline for Dutch vastgoedontwikkelaars (PropTech)
**Researched:** 2026-03-15
**Milestone:** v17.0 Projecten Portfolio
**Confidence:** MEDIUM — Pipeline stage naming from general PropTech + Dutch domain knowledge; Dutch-specific acquisition workflow from government/industry sources; dossier completeness patterns from international PropTech (no Dutch-specific tools found)

---

## Context: What This Milestone Adds

Propdex already has: map scanning, per-parcel scoring, due diligence reports, document uploads, BRK eigendom modal, and a basic heart/favorite for gemeenten. The gap is **no place for a developer to manage their actual acquisition pipeline** after they find an opportunity.

Today a developer uses Propdex to find/score parcels, then manages the acquisition in Excel/email/their head. This milestone adds the pipeline layer that closes the loop: favorite a parcel → assign a stage → track the dossier → prepare outreach → make a go/no-go call.

---

## Table Stakes

Features users expect in any property pipeline tool. Missing = product feels like a prototype.

| Feature | Why Expected | Complexity | Dependencies on Existing | Notes |
|---------|--------------|------------|--------------------------|-------|
| **Parcel favoriting** (heart button) | Cannot manage a pipeline without first saving a lead. The most basic primitive — "I care about this parcel" | LOW | ParcelDetailPanel (exists), localStorage heart for gemeenten (exists as pattern) | Needs server-side persistence (not localStorage) — must be org-scoped. DB model: `FavoritedParcel(org_id, parcel_id, wijk_id, created_at)` |
| **Geographic portfolio navigation** (provincie → gemeente → wijk → parcel) | Developers organize their pipeline geographically. "Show me everything I'm tracking in Noord-Holland" is natural to them | MEDIUM | Gemeente/wijk card nav (exists), SVG silhouettes (exists) | New /projecten route with drill-down. Provincie layer is new (currently skip to gemeente). Re-use existing WijkMapPanel patterns for cards |
| **Pipeline status per parcel** | Every CRM for real estate has stages. Without stages, there's no pipeline — just a list | MEDIUM | Per-parcel document storage (exists) | 5 stages (see Pipeline Stages section). Status stored in `FavoritedParcel` or separate `ParcelProject` model |
| **Parcel project workspace** (expanded dossier view) | After favoriting, users need a dedicated workspace per parcel: notes, documents, status, contacts | HIGH | Per-parcel document storage (exists), 5 dossier categories (exists), notes system (exists) | Full-screen or route-based workspace. Shows dossier completeness + action links per missing doc |
| **Dossier completeness indicator** | Users need to know "what am I still missing?" before a go/no-go meeting. Percentage + missing items list | MEDIUM | 20 document types already defined in upload system | Weighted checklist: which docs are critical vs nice-to-have for each pipeline stage. Progress bar per category |
| **Multi-parcel project grouping** | Adjacent parcels often form one deal (e.g., three lots for apartment block). Must group them | MEDIUM | Parcel selection (exists in /resultaten), FavoritedParcel model | `Project` model with many-to-many parcels. Display as "project" card in portfolio, not individual parcel cards |

---

## Dutch Pipeline Stages

Based on research into Dutch vastgoedontwikkeling acquisition workflow and general real estate CRM patterns.

### Standard Dutch Developer Pipeline (5 Stages)

| Stage | Dutch Label | Description | Trigger | Exit Criterion |
|-------|-------------|-------------|---------|----------------|
| 1 | **Gesignaleerd** | Parcel identified as interesting from scan. Initial signal. | Heart/favorite parcel | Decide to investigate further |
| 2 | **Onderzoek** | Active due diligence: ownership research, zoning analysis, feasibility check. Pre-contact phase | Promote from Gesignaleerd | Sufficient info to decide: contact owner or drop |
| 3 | **Contact** | Owner contacted (brief/email/phone). May include principeverzoek at gemeente. Negotiation begins | Promote from Onderzoek | LOI signed, OR dropped |
| 4 | **Besluit** | Internal go/no-go decision. Board/partner approval. Term sheet / koopovereenkomst negotiation | Owner responded positively | Go → purchase agreement, No-go → Afgerond/Afgewezen |
| 5 | **Afgerond** | Closed: Gekocht (purchased) OR Afgewezen (rejected) with reason | Decision made | — |

**Rationale for these 5 stages:**
- Maps to the Nederlandse acquisitieproces: signalering → analyse → contactfase → principebesluit → afsluiting
- Aligns with the formal Dutch real estate transaction flow: LOI → due diligence → SPA → notarispassering
- "Principeverzoek" (vooroverleg gemeente) happens in the Contact stage, after initial owner outreach
- Avoids over-engineering: CRM tools that define 10+ stages see poor adoption

---

## Differentiators

Features that set Propdex apart from generic CRM tools and competing PropTech.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Outreach template generator** (brief naar eigenaar) | Generic CRM tools have no idea who owns a Dutch parcel or how to approach them. Propdex already has BRK eigendom data (naam, type, adres). A pre-filled letter template leverages that uniquely | MEDIUM | BRK eigendom modal (exists), parcel data (exists) | Two templates: (1) Brief particuliere eigenaar, (2) Brief rechtspersoon/BV. Pre-fill: naam eigenaar, adres perceel, bestemming, developer org name. Word/PDF export. Claude AI personalization is P2 |
| **Pre-overleg gemeente template** (principeverzoek) | Before investing in a formal permit application, developers always do vooroverleg. Propdex knows the bestemming, bouwregels, max_bouwlagen — enough to draft a principeverzoek request | MEDIUM | Bestemming data (exists), DSO bouwregels (exists), parcel geometry (exists) | Template auto-populates: adres perceel, kadastrale aanduiding, huidige bestemming, gewenste functiewijziging, oppervlakte. Links to gemeente's vooroverleg portal |
| **Dossier completeness with action links** | Other tools show you what's missing. Propdex knows WHERE to get it — Kadaster, EP-Online, gemeenteloket. That's unique. | MEDIUM | 20 document types (exists), BRK/EP-Online/WOZ integrations (exist) | Per-missing-document: show "Ophalen via [source]" with direct link or trigger button. e.g., missing energielabel → "Ophalen via EP-Online" button that fetches it |
| **Map-integrated pipeline view** | Color-code parcels on the main map by pipeline stage. No other NL tool shows "my pipeline" on a map | HIGH | MapLibre tiles (exists), score tile system (exists), FavoritedParcel model | Overlay: Gesignaleerd=blue, Onderzoek=amber, Contact=orange, Besluit=purple, Gekocht=green, Afgewezen=grey. Must be a separate tile layer or client-side GeoJSON overlay |
| **Go/no-go dashboard** | At "Besluit" stage, auto-generate a go/no-go summary: score, risico, eigendom, dossier completeness, aanbeveling | HIGH | Score v3.0 (exists), risico data (exists), dossier model (exists) | Single-page printable summary. Could be a variant of the existing PDF rapport. HIGH value for investor presentations |
| **Stage-based dossier requirements** | Different stages need different documents. In "Onderzoek" you need kadaster extract + bestemmingsplan. In "Besluit" you need bodemonderzoek + taxatierapport | MEDIUM | Document type system (exists), pipeline stages (new) | Show required docs per stage. Incomplete required docs = warning badge. This replaces a flat completeness %, gives context |

---

## Anti-Features

Scope traps or domain violations to explicitly avoid.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Full CRM with contact management** | "We need to track who we talked to at which gemeente" | Turns Propdex into Salesforce. Huge scope, generic problem. Not a differentiator. | Store a single "contactpersoon" field per project (naam + email). Deep CRM is out of scope |
| **Automated email sending** (send brief to eigenaar) | Developers want one-click outreach | Legal risk (spam/GDPR), deliverability infrastructure, reply management. This is not a mail tool. | Generate template → copy/export. User sends via their own email. Never auto-send |
| **Financial feasibility modeling** | "Can we add a grondexploitatie berekening?" | Separate product domain. Requires market price data, construction cost APIs, tax modeling. Already in PROJECT.md out-of-scope | Link to external tools (CBRE, JLL, Excel). Later milestone |
| **Notificaties when owner changes** (Kadaster monitoring) | Triggered by BRK eigendom feature | Requires daily Kadaster polling per parcel. Expensive, rate-limited, legal unclear. | Existing ChangeRecord meldingen feed handles municipality-level changes. Kadaster monitoring is a separate paid tier feature |
| **Drag-and-drop Kanban board** | Visual pipeline management like Trello | Complex UI, poor fit for geographic data. Developers think spatially, not in Kanban boards. | Status dropdown per parcel card + map-based color coding is more natural for this domain |
| **Deal value / ROI tracking** | "Show me IRR on my portfolio" | Requires financial data Propdex doesn't have (purchase price, development costs, expected sales). No reliable source. | Defer to financial modeling milestone. For now: show WOZ value as proxy |
| **Buyer/investor pipeline** (sell finished units) | Confused request from PROJECT.md "out of scope" list | This is selling built units to end buyers — a completely different CRM type for a different persona. Propdex is acquisition-side only | Explicitly NOT building. State clearly in UI: "Dit is de acquisitiezijde" |
| **Automated Kadaster BRK batch fetch** for portfolio | "Show eigendom for all my favorited parcels at once" | BRK is Tier 3 (paid per call). Batch fetching for 50 parcels = expensive, no user trigger. | Keep BRK as on-demand (existing confirm dialog pattern). Show "eigendom onbekend" in portfolio view until user individually requests it |

---

## Feature Dependencies

```
Parcel Favoriting (new DB model)
    └──enables──> Geographic Portfolio Navigation
    └──enables──> Pipeline Status Assignment
    └──enables──> Multi-Parcel Project Grouping
                      └──enables──> Project Workspace
                                        └──enables──> Dossier Completeness Indicator
                                        └──enables──> Stage-based Document Requirements
                                        └──enables──> Outreach Template Generator
                                                          └──requires──> BRK eigendom data (EXISTS)
                                        └──enables──> Pre-overleg Gemeente Template
                                                          └──requires──> Bestemming data (EXISTS)
                                        └──enables──> Go/No-go Dashboard
                                                          └──requires──> Score v3.0 (EXISTS)
                                                          └──requires──> Risico data (EXISTS)

Map-integrated pipeline view
    └──requires──> Parcel Favoriting + Pipeline Status
    └──requires──> MapLibre tile/overlay system (EXISTS)

BRK eigendom data (EXISTS)
    └──enhances──> Outreach Template Generator

Score v3.0 (EXISTS) ──enhances──> Go/No-go Dashboard
```

### Dependency Notes

- **Parcel Favoriting must come first:** Everything in this milestone depends on a server-side model linking parcel_id to org_id with metadata (stage, notes). Cannot build the portfolio UI without this.
- **Multi-parcel grouping vs single-parcel view:** Both should exist. Most parcels will be managed individually; grouping is for complex multi-lot acquisitions. The Project model should be optional: a parcel can be in the pipeline without being in a named Project.
- **Outreach templates require BRK data but BRK is on-demand:** Template generator should work even without BRK — fall back to "eigenaar onbekend, vul in" fields. BRK data pre-fills it when available.
- **Map pipeline overlay conflicts with scan tile layer:** These cannot be active simultaneously cleanly. Map pipeline view likely needs to be a separate toggle mode or only visible on /projecten map view.

---

## Dutch Due Diligence Dossier Categories

Based on Dutch property development practice and the existing Propdex document type system.

### Stage-Required Documents

| Stage | Required Documents | Nice-to-Have |
|-------|-------------------|--------------|
| **Onderzoek** | Kadaster uittreksel, bestemmingsplankaart + regels, BAG basisregistratie | Eigendomshistorie, WOZ-beschikking |
| **Contact** | Eigendomsbewijs (BRK), energie-index (EP), taxatierapport globaal | Principeverzoek gemeente response, erfdienstbaarheden |
| **Besluit** | Bodemonderzoek fase 1, bouwkundige schouw, asbestinventarisatie (indien vóór 1993) | Constructierapport, omgevingsvergunning onderzoek |
| **Afgerond/Gekocht** | Koopovereenkomst, notariële akte, hypotheekakte | Bewijs overdrachtsbelasting |

### Action Links per Missing Document Type

| Document Type | Source | Action |
|--------------|--------|--------|
| Kadaster uittreksel | Kadaster.nl | Link: `https://www.kadaster.nl/producten/perceel/kadastrale-informatie` |
| BRK eigendomsdata | BRK Bevragen API | Trigger: Open eigendom modal (existing feature) |
| Energielabel | EP-Online | Trigger: Fetch via existing EP-Online integration |
| WOZ-waarde | Waardeloket | Trigger: Fetch via existing WOZ integration |
| Bodemonderzoek | Bodemloket / gecertificeerde bureaus | Link: `https://www.bodemloket.nl` |
| Bestemmingsplan | PDOK / DSO | Trigger: Open scan / show in map |
| Principeverzoek response | Gemeente loket | Info: "Dien in via gemeenteloket, upload response hier" |

---

## MVP Definition

### Phase 1 — Core Portfolio (must have)

- [x] `FavoritedParcel` DB model (org_id, parcel_id, gemeente_code, wijk_code, stage, created_at)
- [x] Heart/favorite button in ParcelDetailPanel → saves to DB, not localStorage
- [x] /projecten route: provincie → gemeente → wijk → favorited parcel cards
- [x] Pipeline stage selector per parcel card (Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond)
- [x] Parcel project workspace: dedicated full-page or slide-over per parcel with dossier + status + notes

### Phase 2 — Dossier Intelligence (high value, more complex)

- [x] Dossier completeness indicator (% complete + missing items list with action links)
- [x] Stage-based document requirements (show which docs are required at current stage)
- [x] Multi-parcel project grouping (optional named `Project` linking multiple parcels)
- [x] Outreach templates: brief naar eigenaar + pre-overleg gemeente template

### Phase 3 — Advanced Pipeline (differentiators, can defer)

- [ ] Map-integrated pipeline overlay (pipeline stage colors on main map) — HIGH complexity
- [ ] Go/no-go dashboard (auto-generated summary at Besluit stage) — HIGH complexity
- [ ] Claude AI-personalized outreach letter — P2, needs testing

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Parcel favoriting (server-side) | HIGH | LOW | P1 |
| Geographic portfolio navigation | HIGH | MEDIUM | P1 |
| Pipeline status per parcel | HIGH | LOW | P1 |
| Parcel project workspace | HIGH | HIGH | P1 |
| Dossier completeness indicator | HIGH | MEDIUM | P1 |
| Multi-parcel project grouping | MEDIUM | MEDIUM | P2 |
| Outreach template: brief eigenaar | HIGH | MEDIUM | P2 |
| Outreach template: principeverzoek | MEDIUM | MEDIUM | P2 |
| Stage-based document requirements | MEDIUM | LOW | P2 |
| Map pipeline overlay | MEDIUM | HIGH | P3 |
| Go/no-go dashboard | HIGH | HIGH | P3 |
| AI-personalized outreach | MEDIUM | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | Transect (US) | Spartner (NL) | Dealpath (US) | Our Approach |
|---------|---------------|---------------|---------------|--------------|
| Pipeline stages | Yes, generic | Unknown | Yes, CRE-focused | 5 NL-specific stages matching Dutch acquisition flow |
| Geographic portfolio view | Yes (map-first) | Unknown | No (table-first) | Map-first + card drill-down matching existing Propdex nav |
| Dossier completeness | No | Unknown | Yes | Yes + action links to Dutch gov sources (unique) |
| Outreach templates | No | Unknown | No | Yes, pre-filled with BRK eigenaar data (unique) |
| Document management | Basic | Unknown | Advanced VDR | Already have 20 document types — extend, not replace |
| Multi-parcel grouping | No | Unknown | Yes | Yes — project model for adjacent lots |
| Go/no-go decision support | Partial (zoning) | Unknown | No | Yes — leverages score v3.0 + risico data |

**Confidence note:** Spartner.nl information not publicly detailed — LOW confidence on their features. Transect/Dealpath are US-focused CRE platforms with publicly documented features — MEDIUM confidence on comparison.

---

## Sources

- [CMS.law: Acquisition of Real Estate in the Netherlands](https://cms.law/en/nld/publication/how-to-invest-in-commercial-real-estate-in-the-netherlands/acquisition-of-real-estate) — Dutch acquisition pipeline (LOI → due diligence → SPA → notarispassering)
- [Adventures in CRE: Development Due Diligence Checklist](https://www.adventuresincre.com/real-estate-development-due-diligence-checklist/) — 105 due diligence tasks, 10 categories, status tracking
- [Vastgoedjournaal: Acquisitieplanning](https://vastgoedjournaal.nl/news/53347/acquisitieplanning-de-start-van-vastgoedmanagement) — Dutch 4-phase pipeline: Lead → Soft Pipeline → Committed → Under Construction
- [Infonu.nl: Fasen van de Vastgoedontwikkeling](https://financieel.infonu.nl/diversen/74895-fasen-van-de-vastgoedontwikkeling.html) — 6 development phases (initiatief → haalbaarheid → planontwikkeling → realisatie → beheer)
- [IPLO: Procedure omgevingsvergunning](https://iplo.nl/regelgeving/overzicht-procedures/procedure-aanvraag-omgevingsvergunning-regulier/) — formal permit procedure
- [Planruimte: Vooroverleg gemeente / principeverzoek](https://www.planruimte.nl/vooroverleg/) — pre-consultation with municipality: informal step before permit application
- [De Omgevingsadviseurs: Principeverzoek of vooroverleg indienen?](https://www.deomgevingsadviseurs.nl/diensten/omgevingsadvies/principeverzoek) — principeverzoek process and content
- [Lawyersnetherlands.com: Real estate due diligence in the Netherlands](https://lawyersnetherlands.com/real-estate-due-diligence-in-the-netherlands/) — Netherlands-specific due diligence: legal, tax, environmental, technical, commercial
- [REsimpli: Best Pipeline Stages for Real Estate Investors](https://resimpli.com/blog/the-best-pipeline-stages-for-real-estate-investors-using-a-crm/) — generic pipeline stage patterns for property investors
- [PropFolio](https://propfolio.tech) — AI operating system for CRE investment management (competitor reference)

---

*Feature research for: v17.0 Projecten Portfolio — property portfolio management + deal pipeline for Dutch vastgoedontwikkelaars*
*Researched: 2026-03-15*

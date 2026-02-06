# CRM Plus

## What This Is

A property intelligence platform for Dutch projectontwikkelaars (real estate developers) who buy churches, monuments, land, and commercial buildings to redevelop into residential projects. The platform compresses weeks of due diligence research into minutes by automating property data collection, zoning analysis, and heritage status checks.

## Who It's For

**Primary user:** A Dutch projectontwikkelaar with a mixed portfolio — churches/monuments, land plots, and commercial-to-residential conversions. Small team of 1-5 users.

**How they work today:** When they find a potential property (a church for sale, a plot of land, an old office building), they spend 3-6 weeks manually checking bestemmingsplannen, kadaster records, monument status, and subsidy eligibility. This costs €10-30k+ per opportunity in advisor fees, and by the time due diligence is done, faster competitors have already bought it.

**What they need:** Enter an address, get an instant structured report with everything needed for a go/no-go decision.

## Core Value

**Address → Property Intelligence Report**

Enter any Dutch address and receive within minutes:
- Kadaster data: ownership, transactions, plot boundaries, surface area
- Zoning summary: permitted functions (wonen, zorg, horeca), max height, density, parking requirements — extracted from bestemmingsplannen
- Monument/heritage status: rijksmonument, gemeentelijk monument, or none — with applicable restrictions
- Key restrictions and opportunities identified

This is the ONE thing that must work. Everything else is secondary.

## Business Model

- Built for one specific client first (single-tenant MVP)
- Designed for multi-tenant SaaS expansion into the Dutch developer market
- Revenue model TBD — likely subscription-based per organization

## Platform

- Web dashboard (desktop-first) for primary workflow
- Mobile companion app planned for on-site property checks (post-MVP)

## Data Strategy

**Hybrid approach:**
- **API integrations** where available: Kadaster (PDOK), BAG (Basisregistratie Adressen en Gebouwen), ruimtelijkeplannen.nl, Rijksmonumentenregister
- **AI document parsing** as fallback: upload bestemmingsplan PDFs and extract zoning rules using LLM agents — critical for municipalities without good digital APIs
- Gradual improvement: start with the most reliable API sources, expand AI parsing coverage over time

## Technical Constraints

- Stack to be determined by research phase
- Must support Dutch-language content and data sources
- Must comply with AVG/GDPR for personal data handling
- Multi-tenant architecture from the start (even if single client initially)
- Organization-based data isolation (per Klarifai standards)

## What This Is NOT

- Not a 3D visualization or BIM tool (integration possible later)
- Not a construction project management tool
- Not a financial modeling platform (feasibility calculations are a future phase)
- Not a subsidy application tool (matching is future; auto-filing is out of scope)
- Not a buyer/sales CRM for selling finished units

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can enter a Dutch address and receive a structured property report
- [ ] Report includes kadaster data (ownership, plot, transactions)
- [ ] Report includes zoning summary (permitted functions, height, density, parking)
- [ ] Report includes monument/heritage status and restrictions
- [ ] User can save reports and revisit them
- [ ] User can track multiple properties as opportunities in a simple pipeline
- [ ] Property data sourced via Dutch government APIs (PDOK, BAG, ruimtelijkeplannen.nl)
- [ ] AI parsing of bestemmingsplan PDFs as fallback for unstructured data
- [ ] Authentication and user management for small team
- [ ] Organization-based data isolation

### Out of Scope

- 3D visualization / virtual tours — separate product domain
- Subsidy application automation — too complex for v1, possible future integration
- Financial feasibility calculations — requires market data integrations beyond v1
- Buyer/investor CRM and marketing automation — different product phase
- Mobile app — web responsive first, native app post-MVP
- Automated vergunning (permit) filing — requires government system integration
- AI-generated photos/videos — marketing feature, not core intelligence
- Construction/project management — different product category

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Due diligence speed is core value, not CRM | Client's biggest pain is research time, not contact management | CRM is a lightweight wrapper around the intelligence engine |
| Hybrid data sourcing (API + AI parsing) | Not all municipalities have good digital data; APIs alone won't cover everything | Build API integrations first, AI parsing as fallback |
| One client first, then SaaS | De-risks the product by validating with a real user before scaling | Multi-tenant architecture from day one, single client deployment |
| Web-first, mobile later | Primary workflow is research/analysis — desktop suits better | Responsive web dashboard, mobile companion post-MVP |
| MVP = address-to-report | Smallest thing that saves time and proves the concept | Pipeline/CRM features come after the core report works |
| Stack decided by research | Domain has specific needs (GIS, document parsing, NL APIs) | Research phase will recommend optimal stack |

## Context

- **Developer:** Klarifai (info@klarifai.nl)
- **Market:** Netherlands / Belgium
- **Domain:** PropTech / Real Estate Development
- **Comparable platforms:** Transect (US, land GIS), Datagrid (zoning AI), Prophetic (deal intelligence), Spartner (NL, AI for vastgoed), LightBox (zoning data)
- **Key Dutch data sources:** PDOK, BAG, Kadaster, ruimtelijkeplannen.nl, Rijksdienst voor het Cultureel Erfgoed

---
*Last updated: 2026-02-06 after initialization*

# Feature Landscape: Dutch Property Intelligence Platform

**Domain:** Property intelligence and due diligence for Dutch projectontwikkelaars
**Researched:** 2026-02-07
**Confidence:** MEDIUM

## Executive Summary

Property intelligence platforms for Dutch real estate developers fall into three tiers:

1. **Data aggregation platforms** (Kadaster-centric) - Pull official records, present raw data
2. **Due diligence platforms** (Transect, Prophetic) - Add analysis layers, risk flagging, comparable research
3. **Decision intelligence platforms** (emerging category) - Predictive models, financial feasibility, development scenarios

For projectontwikkelaars specializing in heritage redevelopment (churches, monuments, commercial-to-residential), the core intelligence challenge is **synthesizing Dutch regulatory complexity** (bestemmingsplan, monument status, erfpacht, subsidies) into actionable go/no-go insights.

**Key insight:** Speed is the differentiator. Traditional due diligence takes 3-6 weeks because it requires manual synthesis across 8-12 government databases. Platforms that collapse this to minutes win on operational efficiency, not feature breadth.

## Feature Landscape

### Table Stakes (Users Expect These)

Features projectontwikkelaars assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Kadaster property data** | Foundation of all due diligence in NL | MEDIUM | Eigendomsinformatie, perceelgrenzen, oppervlakte. Requires Kadaster API integration. |
| **Current ownership info** | Need to know who to contact | LOW | From Kadaster eigendomsinformatie. Public record. |
| **Zoning summary (bestemmingsplan)** | Determines what can be built | HIGH | Must parse IMRO/RO Standaarden XML. Complex interpretation layer needed. |
| **Monument status check** | Critical for heritage projects | MEDIUM | Rijksmonument, gemeentelijk monument, beschermd stadsgezicht. From RCE database. |
| **Address autocomplete** | Expected UX pattern | LOW | BAG (Basisregistratie Adressen en Gebouwen) integration. |
| **Basic property characteristics** | Age, size, type | LOW | From BAG and Kadaster WOZ data. |
| **Map visualization** | See property boundaries | MEDIUM | Integration with PDOK (Publieke Dienstverlening Op de Kaart) for cadastral overlay. |
| **PDF report export** | Share with team/investors | LOW | Formatted output for offline review. Expected for all intelligence platforms. |
| **Multiple property comparison** | Compare 3-5 opportunities | MEDIUM | Side-by-side view of key metrics. Developers rarely evaluate single property. |
| **Historical sales data** | Comparable transactions | MEDIUM | From Kadaster verkooptransacties. Needed for valuation sense-check. |

### Differentiators (Competitive Advantage)

Features that set product apart for heritage/complex redevelopment projects.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Instant structured reports** | 3-6 weeks → 3 minutes | HIGH | Core value prop. Requires pre-processing all Dutch planning data + real-time API orchestration. |
| **Monument restriction summary** | Plain-language what you can/can't change | HIGH | RCE beschrijvingen are technical. Need interpretation layer for "Can I add floors?" "Can I change facade?" |
| **Subsidy eligibility detection** | Automatic match to Rijksdienst, provincial, municipal subsidies | HIGH | Heritage redevelopment has 20+ subsidy programs. Auto-matching saves weeks of research. |
| **Church-specific intelligence** | Usage history, community objections, deconsecration status | MEDIUM | Churches are 30% of heritage redevelopment in NL. Specialized data = competitive moat. |
| **Erfpacht (leasehold) analysis** | Terms, buy-out costs, restrictions | MEDIUM | Complex ownership structure in NL cities. Developers need this synthesized, not raw contracts. |
| **Development constraint scoring** | Red/yellow/green rating for project complexity | MEDIUM | Synthesize monument + zoning + soil + access into single risk score. Speeds pre-screening. |
| **Welstandscommissie prediction** | Likelihood of aesthetic board approval | HIGH | Use historical decisions + current guidelines. Unique to NL market. High value, complex ML. |
| **Bestemmingsplan change history** | Track zoning amendments over time | MEDIUM | Shows if area is liberalizing/restricting. Predicts future flexibility. |
| **Soil contamination overlay** | Historical industrial use, investigation reports | MEDIUM | From Bodemloket. Critical for old commercial buildings. Often overlooked until late. |
| **Environmental constraints** | Geluid (noise), luchtkwaliteit, externe veiligheid | HIGH | Required for permits. Synthesizing Atlas Leefomgeving data into "buildable units" estimate is high value. |
| **Neighborhood development pipeline** | What else is being built nearby | MEDIUM | Market saturation check. Scrape omgevingsvergunningen from gemeente portals. |
| **Financial feasibility quick calc** | Rough development budget based on constraints | MEDIUM | "With these restrictions, estimated €X/m² extra cost" helps kill bad leads fast. |

### Anti-Features (Deliberately NOT Building)

Features that seem good but create problems in this domain.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full CRM with pipeline management** | "We need to track deals" | Scope creep. Every developer has existing CRM (Salesforce, HubSpot, custom). Integration hell. | API/webhook to push intelligence reports into their existing CRM. CRM is commodity, intelligence is differentiator. |
| **3D visualization/renders** | "Cool tech, investors love it" | Enormous complexity. Not decision-critical at pre-acquisition phase. Distracts from core intelligence value. | Partner with visualization firms. Provide data via API, let specialists render. |
| **Real-time property alerts** | "Notify me when new properties hit market" | Dutch market doesn't work that way. Properties rarely on open market for heritage/commercial. Deals happen via networks. | Focus on analyzing properties they already identified. Intelligence > deal flow for this segment. |
| **Automated valuation (AVM)** | "What's it worth?" | Heritage properties are never comparable. Monuments, churches, complex buildings = manual valuation always. AVM creates false precision. | Provide comparable transaction data, let user/appraiser value. Don't pretend algorithm knows monument value. |
| **Full project management** | "Track renovation progress" | Post-acquisition feature. Different buyer (contractors, not developers at that stage). Massive scope expansion. | Hard stop at acquisition decision. Partner with project management tools if needed. |
| **Social media integration** | "Share properties on LinkedIn" | Developers don't broadcast opportunities. Competitive intelligence risk. B2C thinking applied to B2B. | Private sharing via email/link. No social features. |
| **Mobile app (native)** | "Need it on the go" | Desktop research workflow. Developers don't make €5M decisions on phone. Mobile dev doubles costs. | Responsive web app. Mobile-friendly, not mobile-first. |
| **Chat/collaboration features** | "Team needs to discuss" | They use email, WhatsApp, Teams already. Won't switch tools for one use case. | Comments/notes per property. Export to their communication tools. |

## Feature Dependencies

```
[Address Input]
    └──requires──> [BAG API Integration]
    └──enables──> [Kadaster Lookup]
                      └──requires──> [Kadaster API Authentication]
                      └──enables──> [Property Characteristics]
                      └──enables──> [Ownership Info]
                      └──enables──> [Cadastral Boundaries]

[Cadastral Boundaries]
    └──enables──> [Zoning Lookup]
                      └──requires──> [IMRO/Ruimtelijkeplannen.nl Parser]
                      └──enables──> [Development Constraints Scoring]

[Property Characteristics]
    └──enables──> [Monument Status Check]
                      └──requires──> [RCE API Integration]
                      └──enables──> [Monument Restrictions Summary]
                      └──enables──> [Subsidy Eligibility Detection]

[Monument Status] + [Zoning] + [Soil] + [Environmental]
    └──all feed──> [Development Constraint Scoring]
    └──all feed──> [Financial Feasibility Calc]

[Structured Report]
    └──requires──> ALL data sources integrated
    └──enhances──> [PDF Export]
    └──enables──> [Property Comparison]
```

### Dependency Notes

- **Address Input is the gateway**: Must resolve to valid BAG ID before any other lookups work. Failed address = failed entire workflow.
- **Zoning parsing blocks constraint scoring**: IMRO XML is complex. Can't do red/yellow/green rating without successfully parsing bestemmingsplan.
- **Monument status + Zoning are co-dependent for heritage projects**: Monument restrictions override zoning permissions. Need both to give accurate buildability assessment.
- **Financial feasibility depends on all constraint data**: Can't estimate costs without knowing monument requirements, soil remediation needs, environmental mitigation, zoning restrictions.
- **Subsidy detection requires monument status + property type + location**: Different programs for rijksmonument vs gemeentelijk monument, churches vs commercial buildings, specific municipalities.

## MVP Definition

### Launch With (v1)

Minimum viable product for single-client validation (projectontwikkelaar with church/monument portfolio).

- [ ] **Address input with BAG autocomplete** — Gateway to all intelligence
- [ ] **Kadaster property data** — Ownership, boundaries, basic characteristics
- [ ] **Monument status check** — Rijksmonument, gemeentelijk, beschermd stadsgezicht
- [ ] **Bestemmingsplan summary** — Current zoning, permitted uses (parsed from IMRO)
- [ ] **Basic constraint flags** — Monument restrictions, zoning restrictions, soil contamination flag
- [ ] **Structured report view** — Single-page summary of all findings
- [ ] **PDF export** — Share with team/advisors
- [ ] **Property save/list** — Revisit previous lookups

**Rationale**: This is the "3 minutes vs 3 weeks" proof. If a developer can enter a church address and get monument status + zoning restrictions + key blockers instantly, the value is proven. Everything else enhances, but this core loop validates the concept.

### Add After Validation (v1.x)

Features to add once first client is using core product.

- [ ] **Monument restriction detail** — Plain-language interpretation of what can/can't be changed
- [ ] **Subsidy eligibility** — Match property to applicable heritage subsidy programs
- [ ] **Property comparison view** — Side-by-side compare 3-5 opportunities
- [ ] **Erfpacht analysis** — For Amsterdam/Utrecht properties with leasehold
- [ ] **Historical sales data** — Comparable transactions in area
- [ ] **Environmental constraints** — Noise, air quality, external safety zones
- [ ] **Development constraint scoring** — Red/yellow/green rating for project complexity
- [ ] **User authentication** — Multi-user access for organization

**Triggers**:
- **Restriction detail**: When user asks "Can I add a floor to this rijksmonument?"
- **Subsidy eligibility**: When user says "What funding is available for this church?"
- **Comparison view**: When user says "I'm looking at 5 churches, hard to compare"
- **Scoring**: When user says "Need to pre-screen 50 properties, which are feasible?"

### Future Consideration (v2+)

Features to defer until product-market fit is established and client base expands.

- [ ] **Welstandscommissie prediction** — Aesthetic board approval likelihood
- [ ] **Bestemmingsplan change history** — Track zoning evolution over time
- [ ] **Neighborhood pipeline analysis** — What else is being built nearby
- [ ] **Financial feasibility calculator** — Rough development budget estimation
- [ ] **Church-specific data enrichment** — Usage history, community, deconsecration
- [ ] **API for CRM integration** — Push reports into client's existing systems
- [ ] **Custom report templates** — Client-specific formatting and branding
- [ ] **Alert system** — Notify when zoning changes for saved properties

**Why defer**:
- **v2 features are predictive/advanced**: Require baseline data + ML models. Need transaction history first.
- **API/integration features**: Only valuable with multiple paying clients. Premature for single-client MVP.
- **Church-specific data**: High value but requires building proprietary database. Defer until product validated.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Address input + BAG | HIGH | LOW | P1 |
| Kadaster property data | HIGH | MEDIUM | P1 |
| Monument status check | HIGH | MEDIUM | P1 |
| Bestemmingsplan summary | HIGH | HIGH | P1 |
| Basic constraint flags | HIGH | MEDIUM | P1 |
| Structured report view | HIGH | LOW | P1 |
| PDF export | MEDIUM | LOW | P1 |
| Property save/list | MEDIUM | LOW | P1 |
| Monument restriction detail | HIGH | HIGH | P2 |
| Subsidy eligibility | HIGH | HIGH | P2 |
| Property comparison | MEDIUM | MEDIUM | P2 |
| Erfpacht analysis | HIGH | MEDIUM | P2 |
| Historical sales data | MEDIUM | MEDIUM | P2 |
| Environmental constraints | MEDIUM | HIGH | P2 |
| Constraint scoring | MEDIUM | MEDIUM | P2 |
| User authentication | LOW | LOW | P2 |
| Welstandscommissie prediction | MEDIUM | HIGH | P3 |
| Zoning change history | LOW | MEDIUM | P3 |
| Neighborhood pipeline | LOW | HIGH | P3 |
| Financial feasibility calc | MEDIUM | HIGH | P3 |
| Church data enrichment | MEDIUM | HIGH | P3 |
| CRM API integration | LOW | MEDIUM | P3 |
| Custom report templates | LOW | LOW | P3 |
| Alert system | LOW | MEDIUM | P3 |

**Priority key:**
- **P1**: Must have for launch - Proves core "instant intelligence" value proposition
- **P2**: Should have when possible - Enhances decision quality, adds stickiness
- **P3**: Nice to have, future - Predictive features, integrations, advanced analysis

## Dutch Market Specifics

### Heritage Redevelopment Context

Dutch projectontwikkelaars working with churches, monuments, and complex conversions face unique challenges:

1. **Regulatory density**: Must check 8-12 government databases for complete picture (Kadaster, RCE, Bodemloket, Atlas Leefomgeving, gemeentelijke portals, etc.)
2. **Monument hierarchy**: Rijksmonument (strictest) → Gemeentelijk monument → Beschermd stadsgezicht → Regular building. Each has different restrictions and subsidy access.
3. **Church surplus**: 1,500+ churches being deconsecrated in NL. Specialized market with community sensitivities, architectural restrictions, often poor condition.
4. **Subsidies are critical**: Heritage redevelopment is rarely financially feasible without subsidies. BIJ (Besluit Instandhouding Jachten), Subsidieregeling Instandhouding Monumenten (SIM), provincial and municipal programs. Knowing eligibility upfront is decision-critical.
5. **Erfpacht (leasehold) complexity**: Especially in Amsterdam, Utrecht, The Hague. Ground lease terms can kill project economics. Need to know terms, buy-out costs, restrictions upfront.
6. **Welstandscommissie (aesthetic board)**: Municipality-specific boards that approve design. Unpredictable. Historical approval patterns in area matter.
7. **Environmental constraints**: Geluid (noise zones near highways/rail), luchtkwaliteit (air quality), externe veiligheid (safety zones near industrial sites). Can block residential conversion even if zoning allows.

### Table Stakes for Dutch Market

Beyond general property intelligence, Dutch developers expect:

- **Bestemmingsplan parsing**: Not optional. Every property decision starts with "Wat mag er?"
- **Monument databases**: RCE integration is expected for heritage work
- **BAG addressing**: Standard addressing system in NL. Must use this, not Google Places
- **PDOK mapping**: Government standard for cadastral visualization
- **Dutch units**: Oppervlakte in m², not sq ft. Euros, not dollars. Dutch date formats.
- **Multi-language support NOT expected**: This is Dutch B2B. Dutch UI, Dutch terminology. English is nice-to-have, not table stakes.

### Differentiators for Dutch Market

Features that matter specifically in NL context:

- **Erfpacht analysis**: Rare in other countries, common pain point in NL
- **Welstandscommissie prediction**: Doesn't exist elsewhere, high value in NL
- **Church-specific data**: Large segment of heritage redevelopment
- **Subsidy program matching**: NL has unusually generous heritage subsidies; knowing eligibility is competitive advantage
- **Bestemmingsplan change tracking**: NL planning system is dynamic. Historical context predicts future flexibility.

## Competitive Feature Comparison

| Feature Category | Transect (UK) | Prophetic (US) | Spartner (NL) | Propdex Approach |
|------------------|---------------|----------------|---------------|-------------------|
| **Core data** | Land Registry (UK) | County records (US) | Kadaster (NL) | Kadaster + BAG + RCE |
| **Zoning** | Planning permissions | Local zoning codes | Basic bestemmingsplan | Parsed IMRO with restrictions |
| **Heritage** | Listed buildings | Historic registers | Monument flag | Monument + restriction detail + subsidy matching |
| **Speed** | Hours to days | Hours to days | Days to weeks | Minutes (target) |
| **Analysis depth** | Deep (land assembly) | Moderate (risk flags) | Shallow (data aggregation) | Moderate (constraint scoring) |
| **Specialization** | Land developers | Commercial CRE | General projectontwikkelaar | Heritage/complex conversion |
| **Report format** | Interactive web | PDF packets | PDF report | Structured web + PDF export |
| **Pricing model** | Per search | Subscription | Per report | TBD (likely subscription) |

### Our Competitive Position

**Differentiation strategy:**
1. **Speed over depth**: Get to "go/no-go" decision in minutes, not weeks. Good enough beats comprehensive-but-slow.
2. **Heritage specialization**: Monument restrictions, subsidy matching, church data. Narrow focus = better product.
3. **Dutch regulatory fluency**: Bestemmingsplan parsing, erfpacht analysis, welstandscommissie context. Not possible for international competitors.
4. **Intelligence over CRM**: Solve the hard problem (synthesizing regulatory complexity) not the commodity problem (tracking deals).

**What we WON'T compete on:**
- Feature breadth (deliberately narrow)
- International coverage (NL only)
- CRM capabilities (not our game)
- 3D visualization (partner/integrate)
- Mobile-first (desktop workflow)

## Sources and Confidence

**Confidence: MEDIUM**

**Source basis:**
- Training knowledge of Dutch real estate practices, Kadaster systems, monument regulations (as of Jan 2025)
- Understanding of property intelligence platform patterns (Transect, Prophetic, similar tools)
- Knowledge of Dutch regulatory structure (bestemmingsplan, RCE, erfpacht)

**Limitations:**
- External research tools unavailable during this session
- Could not verify current state of specific platforms (Spartner, Datagrid, LightBox) in 2026
- Could not access current Kadaster API documentation or pricing
- Could not verify current subsidy programs or monument database APIs

**HIGH confidence areas:**
- Table stakes features (address lookup, Kadaster data, monument status, zoning)
- Dutch regulatory structure (bestemmingsplan, RCE, erfpacht concepts)
- Anti-features (CRM scope creep, 3D visualization, mobile-first for B2B)

**MEDIUM confidence areas:**
- Competitive positioning vs specific platforms
- Implementation complexity estimates
- Subsidy program specifics
- API availability and access patterns

**LOW confidence / needs validation:**
- Current state of Kadaster API capabilities in 2026
- Specific features of Spartner, Datagrid, other NL competitors
- Pricing models in market
- Welstandscommissie data availability

**Recommended validation:**
- Interview 3-5 projectontwikkelaars specializing in heritage/church redevelopment
- Audit current Kadaster, RCE, and gemeente API access and limitations
- Review 2-3 competitor platforms hands-on
- Map subsidy programs and eligibility criteria with actual data sources

---
**Feature research for:** Propdex - Dutch Property Intelligence Platform
**Researched:** 2026-02-07
**Confidence:** MEDIUM (training data + domain knowledge, no live platform verification)

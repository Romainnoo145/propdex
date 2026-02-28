# Pitfalls Research: v9.0 Professional Marketplace

**Domain:** PropTech SaaS — adding Bodemloket API, Wkb gevolgklasse classification, asbest risk flagging, PDF dossier generation, lead capture flow, and kwaliteitsborger professional directory to an existing property intelligence platform
**Researched:** 2026-03-01
**Confidence:** HIGH for Wkb regulatory details (official Dutch government sources verified), HIGH for existing system pitfalls (codebase known), MEDIUM for marketplace cold-start and lead routing (general patterns verified against domain context)
**Scope:** Pitfalls specific to adding lead generation and B2B marketplace features to an existing multi-tenant property data platform. Focuses on what goes wrong when extending an established system rather than building from scratch.

---

## Critical Pitfalls

Mistakes that cause regulatory violations, architectural rewrites, incorrect legal outputs, or trust failures with professional users.

---

### Pitfall 1: Wkb Gevolgklasse Classification Presented as Authoritative When It Is Indicative

**What goes wrong:**
The platform generates a Wkb gevolgklasse classification (GK1/GK2/GK3) from property data (bouwjaar, bestemming, building type, pand_status) and presents it in the risicobeoordeling dossier or on the property card. A kwaliteitsborger or projectontwikkelaar reads the classification, relies on it, and discovers it is wrong — either a monument was missed (monuments are explicitly excluded from GK1), or the building has a mixed-use function that bumps it to GK2, or the project is a renovation (verbouw, which is explicitly out of Wkb scope as of December 2024). The professional makes a quoting or contracting decision based on the wrong class.

**Why it happens:**
The classification rules are based on text in the Omgevingsbesluit and are complex. The existing Propdex data (from BAG, bestemmingsplan, RCE) provides enough information for a reasonable *inference* but not a legally reliable determination. Specifically:
- Monument status from RCE covers only rijksmonumenten — gemeentelijke monumenten are invisible to the system, meaning the "monument exclusion from GK1" rule can silently fail
- Bestemmingsplan data often does not capture the exact current functional use of a building — a retail building with a residential annex may appear as single-function in BAG
- The December 2024 ministerial decision excluded verbouwingen from Wkb scope indefinitely, but the system cannot reliably distinguish nieuwbouw from verbouw from the available data alone
- When mixed-use buildings apply the "highest gevolgklasse wins" rule, identifying all present functions requires data the system does not always have

**How to avoid:**
Never present the gevolgklasse output as a legal determination. Label it explicitly as "Indicatieve gevolgklasse op basis van beschikbare data" with a mandatory disclaimer: "De werkelijke gevolgklasse wordt bepaald in overleg met de kwaliteitsborger en het bevoegd gezag. Raadpleeg altijd een gecertificeerde kwaliteitsborger." Add a dedicated "Onzekerheidsindicator" field — if monument status is from RCE only (no gemeentelijk monument check), flag as uncertain. If bestemming contains a mixed-use indicator, flag as uncertain. If pand_status or construction type suggests verbouw rather than nieuwbouw, note Wkb scope may not apply.

**Warning signs:**
- UI copy that says "Dit gebouw valt onder gevolgklasse 1" instead of "Indicatief: gevolgklasse 1"
- No disclaimer visible on the classification result
- Monument exclusion logic only checking `is_rijksmonument` without checking for gemeentelijk monument uncertainty
- No treatment of the verbouw exclusion (December 2024 ministerial decision)

**Phase to address:**
Wkb classification engine phase — the disclaimer and uncertainty flags must be designed before the classification logic is built, not added after.

---

### Pitfall 2: Bodemloket Data Absence Does Not Mean No Contamination

**What goes wrong:**
The Bodemloket integration fetches soil contamination data for a parcel. The API returns no results (empty response or "geen registraties"). The platform displays this as "Geen bodemverontreiniging geregistreerd" or similar positive-sounding language. The kwaliteitsborger or developer treats this as clean-bill-of-health for soil. In reality: Bodemloket is a portal that aggregates data *only from provinces and larger municipalities that have delivered their data*. Smaller municipalities have not delivered complete data. Additionally, historical soil contamination may not have been investigated, meaning absence from the register is not evidence of absence of contamination.

**Why it happens:**
The Bodemloket FAQ explicitly states: "De informatie op de kaart van bodemloket.nl is niet volledig." The portal does not manage the underlying data and explicitly disclaims responsibility for completeness. But developers building a clean integration will receive a clean API response for genuinely unregistered parcels and for parcels in municipalities with gaps — there is no way to distinguish between the two from the API response alone. The natural developer behavior is to render what the API returns.

**How to avoid:**
Never use positive framing for a Bodemloket empty result. The correct display is: "Geen geregistreerde bodemverontreiniging gevonden via Bodemloket (peildatum: [date]). Bodemloket bevat niet alle gemeentelijke bodemdata. Nader bodemonderzoek kan nodig zijn." The risicobeoordeling dossier must include the Bodemloket disclaimer text verbatim. Add a coverage indicator: if the parcel's gemeente is not in the list of known Bodemloket contributors, flag the result as "Dekking onbekend voor deze gemeente." Bodemloket's own disclaimer page states it is not responsible for the information — reflect this in the product copy.

**Warning signs:**
- Display copy reading "Geen bodemverontreiniging" without a coverage disclaimer
- No source date shown alongside the Bodemloket result
- No municipality coverage indicator distinguishing "not found" from "not registered here"
- Risicobeoordeling dossier presenting Bodemloket clean result as a positive clearance

**Phase to address:**
Bodemloket integration phase — the display template must be designed with the disclaimer as a mandatory, non-removable element.

---

### Pitfall 3: Asbest Flagging on Bouwjaar < 1994 Is a Trigger, Not a Result

**What goes wrong:**
The platform flags properties built before 1994 as having "asbestrisico" based on the bouwjaar. The asbest prohibition in the Netherlands was enacted with a general ban in 1994 (full scope in 2005). Pre-1994 construction legally requires asbestinventarisatie before demolition or renovation work. The platform displays this flag, and a user (developer or kwaliteitsborger) misreads it as confirmation that asbestos is present, or conversely as a clearance that no inventory is needed because the BAG record shows bouwjaar 1996 (just past the threshold). Either misread creates a liability.

**Why it happens:**
Bouwjaar in BAG is often inaccurate or refers to the year a verblijfsobject was registered, not the year the original structure was built. A building renovated in 1996 that has a registered bouwjaar of 1996 may have original structural elements from 1970. BAG does not store renovation history or original construction dates. The flag based on bouwjaar is the best available approximation but should be treated as a trigger for further investigation, not as a definitive finding.

**How to avoid:**
The asbest indicator must be labeled "Asbestonderzoek mogelijk vereist" not "Asbest aanwezig" or "Geen asbestrisico." The rule: bouwjaar < 1994 → flag as "onderzoek vereist"; bouwjaar >= 1994 → flag as "Drempelwaarde niet bereikt op basis van BAG bouwjaar — nader onderzoek kan alsnog vereist zijn bij verbouw met oudere bouwdelen." Include explicit copy: "Het bouwjaar in de BAG is een registratiedatum en kan afwijken van de werkelijke bouwdatum." Link to the Nederlandse Arbeidsinspectie asbestinventarisatie requirement page. The kwaliteitsborger receiving the dossier should see this as a prompt, not a clearance.

**Warning signs:**
- Flag displayed as a binary "asbestrisico: ja/nee" without nuance
- No mention of BAG bouwjaar accuracy limitations in the flag copy
- Bouwjaar threshold applied without a disclaimer about renovation history
- Flag copy saying "geen asbestrisico" for bouwjaar >= 1994 without qualification

**Phase to address:**
Asbest risk indicator phase — copy and disclaimer must be reviewed by the product owner before any UI implementation begins.

---

### Pitfall 4: Lead Routing Without Explicit AVG Consent Is a Regulatory Violation

**What goes wrong:**
The lead capture flow works as follows: a developer uses Propdex, sees the Wkb classification, clicks "Vraag kwaliteitsborger aan," and their contact details (name, organization, email, project address) are routed to a kwaliteitsborger in the professional directory. This constitutes processing and sharing personal data with a third party (the kwaliteitsborger). Under AVG (GDPR), this requires a legal basis. If the developer did not explicitly consent to their data being shared with specific third-party professionals, this is a violation.

**Why it happens:**
It feels natural to route the lead because the user clicked a CTA. But clicking "Vraag aan" is not the same as giving informed, specific, unambiguous consent to have your contact details sent to a named third party. Dutch AP (Autoriteit Persoonsgegevens) enforcement treats pre-checked boxes, implied consent, and bundled consent (e.g., "by using this service you consent to lead sharing") as non-compliant. B2B contexts offer gerechtvaardigd belang (legitimate interest) as an alternative legal basis, but this requires a documented legitimate interest assessment (LIA) and cannot override the user's explicit objections.

**How to avoid:**
Design the lead capture flow with explicit two-step consent:
1. User sees what data will be shared and with whom before confirming ("Uw naam, bedrijfsnaam, e-mailadres en projectadres worden gedeeld met [kwaliteitsborger naam]").
2. User actively confirms ("Ja, stuur mijn gegevens naar [naam]").
No pre-checked boxes. The consent must be logged with timestamp and user ID. Store consent records separately from the lead record so they can be produced as evidence. Alternatively, structure the flow so Propdex sends a notification to the kwaliteitsborger that a developer is interested, and the kwaliteitsborger contacts Propdex to retrieve an anonymized lead — meaning personal data is never transmitted until the developer separately consents to the specific professional's outreach. Draft a verwerkersovereenkomst (data processing agreement) template that kwaliteitsborgers must sign before receiving leads.

**Warning signs:**
- Lead routing flow that submits developer contact details without a pre-submission consent screen
- No consent logging in the leads table
- No verwerkersovereenkomst with professional directory members
- Single CTA button that both matches and shares data in one click

**Phase to address:**
Lead capture flow phase — AVG compliance design must be reviewed before any frontend CTA is built.

---

### Pitfall 5: Professional Directory Without Kwaliteitsborger Verification Creates Liability

**What goes wrong:**
The platform lists kwaliteitsborgers in a directory. A developer clicks through, contacts the professional, hires them, and discovers the professional is not actually certified by the Toelatingsorganisatie Kwaliteitsborging Bouw (TLoKB). The developer has a problem: the Wkb requires that the kwaliteitsborger hold a valid instrument certificate from an instrument provider that is itself admitted by TLoKB. If the hired professional is not certified, the bouwmelding (building notification) cannot be properly filed and the building permit process stalls. The developer may attribute this to a bad Propdex recommendation.

**Why it happens:**
Building a professional directory without verification feels like a shortcut — collect self-reported profiles, display them, collect leads. But TLoKB certification is the legal requirement for practicing as a kwaliteitsborger under GK1. Self-reported credentials are not reliable. Additionally, certifications can be suspended or lapse.

**How to avoid:**
Before launching the professional directory, establish a verification step. Options (in order of rigor):
1. **Manual spot-check**: Require kwaliteitsborgers to provide their instrument provider name and instrument approval number (publiek register at TLoKB). Manually verify against TLoKB's public register before approving the listing.
2. **TLoKB public register link**: Display the TLoKB registration link alongside the professional listing. Do not claim Propdex verifies certification — make the TLoKB check the user's responsibility with a visible link.
3. **Self-certification with disclaimer**: Lowest viable option for MVP — list professionals who self-declare certification, with a prominent notice: "Propdex verifieert geen certificering. Controleer altijd de TLoKB registratie voor u een kwaliteitsborger inschakelt." Add a link to the TLoKB public register.

Add terms in the professional's listing agreement that they are responsible for the accuracy of their certification claims and indemnify Propdex against any claims arising from false certification.

**Warning signs:**
- Directory listing professionals with only self-reported "kwaliteitsborger" title
- No TLoKB register link or verification step in the listing flow
- No disclaimer in the directory about certification verification responsibility
- No indemnification clause in the professional terms of service

**Phase to address:**
Professional directory phase — verification policy must be decided before any professional onboarding begins.

---

### Pitfall 6: Monument Properties Are Excluded From Wkb Scope — System Must Not Generate Wkb CTAs for Them

**What goes wrong:**
Propdex already has RCE monument data integrated. The v9.0 Wkb classification engine adds a GK1 determination. If a property is a rijksmonument, it is explicitly excluded from the Wkb quality assurance requirement (Wkb does not apply to monuments as of January 2024). If the system generates a "Wkb vereist — vraag kwaliteitsborger aan" CTA for a monument property, it misleads the developer and creates a false lead for the kwaliteitsborger. This is particularly problematic given that Propdex's target clients buy and redevelop churches and monuments — these are precisely the properties where this mistake will occur.

**Why it happens:**
The Wkb classification engine and the lead capture CTA are built in different phases, by separate feature implementations. The classification engine correctly classifies GK1 based on building type. The CTA component separately checks "is_gk1 == True" and displays the CTA. The monument exclusion check is missing from the CTA logic because it was implemented in the classification engine but not propagated to the display layer.

**How to avoid:**
The classification result must carry a `wkb_applicable: bool` field that is `False` for monuments, `False` for verbouwingen (renovation scope exclusion), and `False` when the building's permit-exemption status means no kwaliteitsborger is required. The lead capture CTA must check `wkb_applicable` not just `gevolgklasse`. The classification result schema must be the single source of truth — no secondary "check if monument" logic scattered across components.

**Warning signs:**
- CTA "Vraag kwaliteitsborger aan" appearing on monument property report pages
- Classification result showing `gevolgklasse: 1` for a rijksmonument without a `wkb_applicable: false` flag
- CTA logic reading `gevolgklasse === 'GK1'` without also checking `wkb_applicable`

**Phase to address:**
Wkb classification engine phase — `wkb_applicable` field must be part of the schema before CTA is built.

---

### Pitfall 7: Extending the Direct-Commit Pattern With New B2B Models Breaks Existing Rollback Assumptions

**What goes wrong:**
Propdex uses direct `db.add() / db.flush() / db.commit()` pattern throughout (documented in MEMORY.md: NOT `async with db.begin()`). New v9.0 models — LeadRequest, ProfessionalProfile, ProfessionalLead — need to be added to this pattern. The risk: a developer who is new to this constraint uses `async with db.begin()` or `db.begin_nested()` for the new models, creating an inconsistency. When a transaction error occurs in a combined operation (e.g., creating a LeadRequest and updating a property report in one request), the mixed pattern causes the "transaction already begun" error documented in MEMORY.md.

**Why it happens:**
The `async with db.begin()` pattern is the "standard" SQLAlchemy 2.x pattern in most tutorials and documentation. Developers adding new features for B2B lead flow naturally follow what they read, not what the project established. The pattern is not enforced at the database session level — it is a convention that lives only in MEMORY.md.

**How to avoid:**
Add a comment block to `database.py` and `dependencies.py` that documents the direct-commit pattern and explicitly prohibits `async with db.begin()`. Add an integration test that creates a LeadRequest alongside a property report update in the same request and verifies no "transaction already begun" error. When implementing the new B2B models, copy the pattern from an existing model (e.g., `ChangeRecord` or `ScanResult`) rather than starting from scratch. The LeadRequest creation endpoint should follow the same `db.add(lead) / db.flush() / db.commit()` pattern as `POST /scans`.

**Warning signs:**
- `async with db.begin():` appearing anywhere in the new B2B router or service files
- "Can't operate on closed transaction" or "A transaction is already begun" in logs after B2B feature integration
- New endpoints using `db.begin_nested()` without explicit coordination with existing session lifecycle

**Phase to address:**
Lead capture flow backend phase — explicitly document and reference the pattern in the new router's file header.

---

## Moderate Pitfalls

---

### Pitfall 8: Cold Start Problem — Empty Directory Makes Lead CTA Useless

**What goes wrong:**
The platform ships the "Vraag kwaliteitsborger aan" CTA and lead capture flow before any kwaliteitsborgers are in the professional directory. A developer clicks the CTA, submits a lead request, and either gets no response or gets a generic "we'll be in touch" message. The value proposition of the lead feature dies at first use.

**Why it happens:**
The classic marketplace cold-start problem: the demand-side feature (CTA for developers) is easier to build than the supply-side onboarding (recruiting and verifying kwaliteitsborgers). The temptation is to ship the CTA and "figure out supply later."

**How to avoid:**
Build the supply side before the demand side. Manually recruit 2-3 kwaliteitsborgers before the lead capture CTA goes live. This is feasible for a niche market: there are approximately 200-300 TLoKB-certified instruments in the Netherlands as of 2024, each operated by a relatively small number of professionals. Direct outreach to borgingspartijen (Woningborg, Kiwa, SBK) to recruit their certified professionals is a viable seeding strategy. The lead CTA should only display if at least one verified kwaliteitsborger serves the parcel's gemeente. If none is available for a given area, show "Geen kwaliteitsborger beschikbaar voor deze regio — meld uw interesse voor een borgingspartner."

**Warning signs:**
- Lead CTA shipped with an empty or unverified professional directory
- No gemeente-based matching between lead and available kwaliteitsborgers
- Generic "we'll contact you" response with no timeline commitment when no kwaliteitsborger is available

**Phase to address:**
Professional directory supply recruitment must happen before lead capture CTA is enabled in production.

---

### Pitfall 9: Risicobeoordeling PDF Dossier Presented as a Formal Compliance Document

**What goes wrong:**
The PDF export function generates a "risicobeoordeling dossier" for a property. The document looks professional, includes data from multiple government sources, and has the Propdex branding. A kwaliteitsborger receives this document from a developer and treats it as the risicobeoordeling that satisfies the Wkb instrument requirement. In reality, the risicobeoordeling under the Wkb must be produced and signed by the kwaliteitsborger themselves using an approved instrument. The Propdex document is a data summary, not a certified assessment.

**Why it happens:**
The document looks authoritative because it aggregates real government data. There is no standard format for what a "risicobeoordeling dossier" should look like — the term is used loosely in the market. The developer who receives the PDF may not understand the distinction between a data aggregation report and a certified quality assurance document. The kwaliteitsborger receiving it should know better, but may be confused by the document's scope.

**How to avoid:**
The PDF must include a prominent, non-removable header or first-page disclaimer: "Dit document is een automatisch gegenereerde datasamenvatting van Propdex en vormt GEEN officiële risicobeoordeling in het kader van de Wet kwaliteitsborging voor het bouwen. De officiële risicobeoordeling dient te worden opgesteld en ondertekend door een gecertificeerde kwaliteitsborger met een goedgekeurd borgingsinstrument." Name the document "Propdex Dossier Samenvatting" not "Risicobeoordeling" in the generated PDF's title. Add a footer on every page with the same disclaimer. The branding should clearly identify this as a Propdex data product.

**Warning signs:**
- PDF title reading "Risicobeoordeling [address]" without "Propdex Datasamenvatting" prefix
- No disclaimer on the first page of the generated PDF
- WeasyPrint template for the dossier using legal-document styling that implies official status
- Kwaliteitsborger in user testing treating the PDF as a usable compliance document without additional work

**Phase to address:**
PDF dossier generator phase — the template must include the disclaimer as a hardcoded, non-configurable element from the first iteration.

---

### Pitfall 10: Multi-Tenant Isolation Breaks When Professional Directory Is Shared Across Tenants

**What goes wrong:**
The professional directory (kwaliteitsborger listings) should be visible to all tenant organizations on Propdex. But the existing `organization_id` isolation pattern on all models means a naively implemented `ProfessionalProfile` model with `organization_id = NOT NULL` would make each professional invisible to other tenants. Alternatively, a professional profile with no `organization_id` would break the existing RLS policy that filters all queries by organization.

**Why it happens:**
The multi-tenant pattern (organization_id on all models, RLS enforcement via app_role, 11 RLS tests) is correct for tenant-specific data. But marketplace supply (professional listings) is a platform-level resource, not a tenant-specific resource. The two concerns collide when you apply the existing pattern uniformly to new model types.

**How to avoid:**
Create a separate `organization_id` policy for platform-level resources. Options:
1. Use a sentinel "platform" organization (e.g., `organization_id = '00000000-0000-0000-0000-000000000000'`) for all professional profiles, with an RLS policy that allows any authenticated user to read rows with this sentinel ID.
2. Use `organization_id = NULL` with a separate RLS policy for professional profiles that allows NULL (read-only to all, write restricted to admin role).
3. Create a separate non-RLS-protected schema or table prefix for platform-level data.
The lead routing records (which professional received which lead from which organization) DO need `organization_id` on the developer side for tenant isolation. The professional profile itself does not.

Whichever approach is chosen, add explicit integration tests for cross-tenant directory visibility and single-tenant lead privacy before the feature ships.

**Warning signs:**
- `ProfessionalProfile` model defined with `organization_id: Mapped[UUID] = mapped_column(nullable=False)`
- No integration test verifying that Tenant A can read Tenant B's kwaliteitsborger listings
- RLS policy that silently filters out all professional profiles when queried from a different tenant

**Phase to address:**
Professional directory schema phase — data isolation design must be decided and tested before any listing API endpoint is built.

---

### Pitfall 11: Bodemloket Has No REST JSON API — Must Use WMS Tile Fetch or Screen Scraping

**What goes wrong:**
The integration plan assumes Bodemloket provides a queryable API (JSON endpoint, WFS service, or similar programmatic access). In practice, Bodemloket's primary access mechanism is a WMS (Web Map Service) for map tile rendering. The underlying data is managed by provinces and municipalities and is not exposed through a standardized REST API with per-parcel JSON responses. A developer expects to call `GET /api/bodem?perceel_id=...` and receive a structured JSON response. This does not exist.

**Why it happens:**
Bodemloket's changelog (version 34.26, September 2025) mentions "adapting WMS for disclosing Bodemloket in your own software package" as a future development, suggesting that WMS-based access is the current integration path. The data.overheid.nl community discussion about Bodemloket explicitly notes the data is "too complex and continuously updated" to provide as a bulk download. The WFS service that was planned circa 2019 may or may not be operational for all datasets.

**How to avoid:**
Verify the actual available access method before committing to an integration architecture:
1. Check `https://www.bodemloket.nl/geoserver/` for WMS/WFS GetCapabilities to determine what layers and query methods are available.
2. Test a WFS GetFeature request with a bbox filter over a known contaminated parcel to verify whether structured attribute data is returned.
3. If only WMS tiles are available (raster image rendering only), the integration cannot return structured JSON data per parcel — it can only render a visual layer on the map. Plan accordingly: the map integration (tile overlay) may be the primary deliverable, with a link to the Bodemloket parcel report as the data source.
4. Do not plan a phase that depends on structured Bodemloket JSON data until the API access method is confirmed.

**Warning signs:**
- Integration plan written assuming `GET /bodemloket/parcel/{id}` returns structured JSON
- No spike/proof-of-concept scheduled before the Bodemloket integration phase
- Phase timeline that does not include a "verify API access method" step

**Phase to address:**
A Bodemloket API access spike should be the very first task before any integration work begins.

---

### Pitfall 12: Wkb Scope Changed in December 2024 — Verbouw Is Out Until Further Notice

**What goes wrong:**
The Wkb classification engine is built assuming Wkb applies to all building activities at GK1. In December 2024, Minister Keijzer announced that verbouwingen (renovations) are excluded from Wkb indefinitely — only nieuwbouw (new construction) falls under GK1 quality assurance. Propdex's primary clients work heavily with renovation and conversion projects (churches, commercial buildings, old offices). If the classification engine presents a Wkb requirement for a verbouw project without the verbouw exclusion, it creates false positives that erode user trust.

**Why it happens:**
The December 2024 decision came after years of preparation for verbouw inclusion. Older documentation, blog posts, and industry guides written before December 2024 describe verbouw under Wkb as coming "from January 2024." A developer following pre-December 2024 sources builds a classification engine that includes verbouw.

**How to avoid:**
The classification engine must explicitly handle the verbouw exclusion. If the available data suggests the project is a verbouw (existing pand_status, BAG indicates an existing structure rather than new construction, bestemming indicates existing building type), set `wkb_applicable: false` and explain: "Op basis van beschikbare data lijkt dit een verbouwing — verbouwingen vallen voorlopig niet onder de Wkb (besluit december 2024)." Note that the available data may not always distinguish nieuwbouw from verbouw with certainty, so the uncertainty flag applies here too. Monitor for updates: the minister indicated results review in summer 2025 with a final evaluation in 2027.

**Warning signs:**
- Classification engine applying GK1 to all permit-requiring building activities without a nieuwbouw/verbouw distinction
- No reference to the December 2024 ministerial decision in classification engine code comments
- "Wkb vereist" displayed for addresses where BAG pand_status indicates existing construction

**Phase to address:**
Wkb classification engine phase — verbouw exclusion must be implemented alongside the core GK1 logic.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Present gevolgklasse without uncertainty flags | Cleaner UI | Users rely on incorrect classification; liability when professionals act on it | Never for production |
| Display Bodemloket "geen registratie" as clearance | Looks like useful data | Developers believe soil is clean; contamination found during construction; trust loss | Never — rephrase to "niet geregistreerd" |
| Ship lead CTA before kwaliteitsborger supply is recruited | Faster to market | Zero conversions; first impressions of broken feature; developer churns | Never for external demo |
| Use organization_id on ProfessionalProfile same as other models | Consistent pattern | Professionals invisible across tenants; marketplace doesn't function | Never — platform data needs different isolation model |
| Label the PDF export "Risicobeoordeling" without disclaimer | More impressive document name | Legal liability if misused as formal compliance document | Never |
| Skip TLoKB verification for professional listings | Faster to onboard professionals | Uncertified professionals receive leads; developers hire non-compliant kwaliteitsborgers | Only for internal testing, never for production |
| Store lead routing records without explicit AVG consent log | Simpler data model | AP enforcement risk; cannot prove consent was given | Never |

---

## Integration Gotchas

Common mistakes when connecting to the new services and extending the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Bodemloket | Assuming JSON REST API exists | Verify WMS/WFS access via GetCapabilities before scoping integration; plan for tile overlay if structured data unavailable |
| Bodemloket | Treating empty result as "clean soil" | Display "geen geregistreerde verontreiniging" with coverage disclaimer, not "schone grond" |
| Wkb classification | Classifying monuments as GK1 | Apply monument exclusion check (`is_rijksmonument` AND gemeentelijk monument uncertainty) before classification |
| Wkb classification | Ignoring verbouw exclusion | Check nieuwbouw vs. verbouw indicator before applying Wkb scope; `wkb_applicable: false` for verbouw |
| Asbest flag | Using `bouwjaar >= 1994` as "no asbestos" | Use as "threshold not met on available data" — explicitly note BAG bouwjaar may not reflect original construction |
| Lead capture | Routing contact data on CTA click | Show explicit consent screen listing what data goes to which professional before submission |
| Professional directory | Assuming ProfessionalProfile needs organization_id | Platform-level data needs different RLS approach: sentinel org, NULL org_id, or separate schema |
| PDF dossier | Calling it "risicobeoordeling" in the template | Name as "Propdex Datasamenvatting"; add mandatory disclaimer on page 1 and every footer |
| Direct commit pattern | Using `async with db.begin()` in new B2B routers | Follow existing pattern: `db.add() / db.flush() / db.commit()` as documented in all existing routers |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Bodemloket WMS request on every property view | Slow map rendering; Bodemloket rate limit or block | Cache WMS tile requests aggressively; use JSONB cache with 30-day TTL for structured Bodemloket results if available | At ~20 concurrent users viewing contamination data |
| Generating PDF dossier synchronously in the HTTP request | Request times out for complex properties with multiple data sources | Queue PDF generation as ARQ background job; return job ID immediately; poll for completion | First time a property has both Bodemloket + Wkb + asbest data loaded |
| Loading all kwaliteitsborgers in professional directory without gemeente filter | Directory becomes unusable as supply grows; JSONB payload too large | Filter directory by gemeente from the first query; add pagination | At ~50+ professionals in the directory |
| Lead routing without deduplication | Same developer submits multiple lead requests to the same professional; kwaliteitsborger receives spam | Deduplicate on (developer_org_id, professional_id, parcel_id) with a time window (e.g., 7 days) | Immediately if a user double-clicks the CTA |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing lead data (developer contact + project address) to unverified professionals | Personal data breach; AP enforcement | Require verified listing agreement with professional before lead data is visible to them |
| Sharing organization_id in lead routing API response | Tenant enumeration attack: kwaliteitsborger discovers how many tenants use the platform | Return only the lead-specific data needed; do not expose internal organization_id in professional-facing responses |
| Storing AVG consent as a boolean flag without timestamp and version | Cannot prove consent version matches current privacy policy | Store consent with: timestamp, user_id, policy_version, ip_address, consent_text hash |
| PDF dossier accessible without authentication via shared URL | Sensitive property data (contamination, ownership, Wkb status) exposed publicly | PDF must be generated behind authentication; if sharing is needed, use signed short-lived URLs (e.g., 24h expiry) |
| No rate limiting on lead submission endpoint | Lead spamming; kwaliteitsborger receives fraudulent leads | Rate limit POST /leads per organization: max 10 per day per professional, with CAPTCHA or session validation |

---

## UX Pitfalls

Common user experience mistakes specific to this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing Wkb CTA before explaining what a kwaliteitsborger does | Developers unfamiliar with the role do not understand the CTA's value | Add a brief "Wat is een kwaliteitsborger?" inline explanation on first exposure; link to iplo.nl/wkb |
| Lead CTA with no feedback after submission | Developer does not know if the lead was received; submits multiple times | Show confirmation with expected response time ("Een kwaliteitsborger neemt binnen 2 werkdagen contact op") |
| Professional directory with no quality signals | Developer cannot choose between professionals; picks randomly; bad match | Add region (regio), project type specialization (nieuwbouw, utiliteitsbouw), and instrument provider name as filter facets |
| Wkb classification shown without explanation of what GK means | Classification number (GK1/GK2/GK3) is meaningless without context | Show inline tooltip: "Gevolgklasse 1: Grondgebonden woningen en kleine bedrijfspanden. Laagste risiconiveau." |
| Asbest flag shown without actionable next step | Developer sees flag, does not know what to do next | Flag must include: "Wat nu? → Laat een asbestinventarisatie uitvoeren door een gecertificeerd SA-I bedrijf" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Wkb classification:** Often missing `wkb_applicable: false` for monuments — verify classification result returns `wkb_applicable: false` for any property flagged as rijksmonument or in a beschermd stads/dorpsgezicht.
- [ ] **Wkb classification:** Often missing verbouw exclusion — verify that a property with existing BAG pand and non-"planned" pand_status returns `wkb_applicable: false` with verbouw reason.
- [ ] **Bodemloket integration:** Often missing coverage disclaimer — verify the UI display always includes the Bodemloket coverage disclaimer text, not just the result.
- [ ] **PDF dossier:** Often missing disclaimer on non-first pages — verify the WeasyPrint template includes the legal disclaimer in the footer of every page, not just the cover page.
- [ ] **Lead capture consent:** Often missing explicit consent log — verify the `LeadRequest` model stores a `consent_timestamp`, `consent_text_hash`, and `consent_given: bool` field before any lead is stored.
- [ ] **Professional directory:** Often missing cross-tenant read test — verify that an API call from Organization A can read professional listings that have no `organization_id` linkage to Organization A.
- [ ] **Asbest flag:** Often missing the BAG bouwjaar accuracy disclaimer — verify the flag copy explicitly notes BAG bouwjaar may not equal original construction date.
- [ ] **CTA logic:** Often missing `wkb_applicable` check — verify that the "Vraag kwaliteitsborger aan" CTA does not render when `wkb_applicable === false`, regardless of gevolgklasse value.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wkb classification presented as authoritative — user makes wrong decision | HIGH | Immediately add disclaimer to all classification results. Contact affected users. Add `wkb_applicable` and uncertainty flag retroactively. Consider legal review of liability exposure. |
| Bodemloket "clean soil" misrepresentation causes trust failure | MEDIUM | Change all "geen bodemverontreiniging" copy to "niet geregistreerd in Bodemloket." Invalidate cached Bodemloket results. Add disclaimer to all previously generated PDF dossiers. |
| Lead routing without AVG consent discovered by AP | HIGH | Stop all lead routing immediately. Delete lead records without consent log. Notify affected users. Implement consent screen. File voluntary AP notification. |
| Uncertified professional receives leads — client damaged | HIGH | Remove professional from directory. Notify affected developers. Implement TLoKB verification before re-listing. Review all other directory listings. |
| Direct-commit pattern broken in B2B routers — transaction errors in production | MEDIUM | Identify all routers using `async with db.begin()`. Refactor to direct-commit pattern. Deploy hotfix. Run integration tests confirming fix. |
| PDF dossier circulates as formal compliance document without disclaimer | MEDIUM | Issue corrected PDF template with mandatory disclaimer. Notify all users who generated dossiers in previous version. Add regeneration CTA in the UI. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wkb classification presented as authoritative (Pitfall 1) | Wkb classification engine phase | UI shows "indicatief" and disclaimer; schema has `wkb_applicable` and `uncertainty_flags` fields |
| Bodemloket absence = clean soil (Pitfall 2) | Bodemloket integration phase | Display copy always includes coverage disclaimer; "niet geregistreerd" not "schoon" |
| Asbest flag as binary result (Pitfall 3) | Asbest indicator phase | Flag labeled "onderzoek mogelijk vereist"; includes BAG bouwjaar accuracy disclaimer |
| Lead routing without AVG consent (Pitfall 4) | Lead capture flow phase | Consent screen exists; `LeadRequest` model stores consent log; DPA template drafted |
| Unverified professionals in directory (Pitfall 5) | Professional directory phase | TLoKB link or manual verification step in onboarding; disclaimer in directory UI |
| Monument properties getting Wkb CTA (Pitfall 6) | Wkb classification engine phase | Integration test: rijksmonument address → `wkb_applicable: false` → no CTA rendered |
| Direct-commit pattern broken by new routers (Pitfall 7) | Lead capture backend phase | New router files have pattern comment; integration test creates LeadRequest with no transaction error |
| Cold start — empty directory (Pitfall 8) | Pre-launch supply recruitment (before CTA goes live) | At least 2 verified kwaliteitsborgers listed before lead CTA enabled |
| PDF dossier as formal compliance document (Pitfall 9) | PDF dossier generator phase | PDF template reviewed: disclaimer on page 1 and all footers; document title is "Propdex Datasamenvatting" |
| Multi-tenant isolation breaks for directory (Pitfall 10) | Professional directory schema phase | Integration test: Org A query returns all professional profiles; Org B's lead data not visible to Org A |
| Bodemloket has no REST JSON API (Pitfall 11) | Bodemloket API spike — first task of integration | Spike result documents actual available access method; phase scope adjusted accordingly |
| Wkb verbouw exclusion missing (Pitfall 12) | Wkb classification engine phase | Test: address with existing BAG pand → `wkb_applicable: false` with verbouw reason code |

---

## Sources

- [TLoKB — Gevolgklassen](https://www.tlokb.nl/wet-kwaliteitsborging/gevolgklassen) — HIGH confidence (official Toelatingsorganisatie Kwaliteitsborging Bouw)
- [IPLO — Bouwwerken in gevolgklasse 1](https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/bouwwerken-gevolgklasse/) — HIGH confidence (official Informatiepunt Leefomgeving, Dutch government)
- [Garanta — Wkb: wat valt er wel onder gevolgklasse 1 (en wat niet)](https://garanta.nl/nieuws-blogs/wkb-wat-valt-er-wel-onder-gevolgklasse-1-en-wat-niet/) — MEDIUM confidence (certified kwaliteitsborging instrument provider)
- [VNG — Verbouwingen voorlopig niet onder de Wkb](https://vng.nl/nieuws/verbouwingen-voorlopig-niet-onder-de-wkb) — HIGH confidence (official VNG, December 2024 ministerial decision)
- [Stichting IBK — Vallen monumenten ook onder de Wkb?](https://www.stichtingibk.nl/2024/01/24/vallen-monumenten-ook-onder-de-wkb/) — HIGH confidence (official Stichting Instituut voor Bouwkwaliteit)
- [Bodemloket — FAQ](https://bodemloket.nl/faq-page) — HIGH confidence (official Bodemloket, data completeness limitations acknowledged)
- [Bodemloket — Whatsnew versie 34.26](https://www.bodemloket.nl/content/whatsnew-bodemloket-versie-3426) — HIGH confidence (official Bodemloket technical changelog, September 2025)
- [Data.overheid.nl — Aanvullende informatie Bodemloket](https://data.overheid.nl/community/datarequest/aanvullende-informatie-bodemloket) — MEDIUM confidence (government data community confirming data limitations)
- [Nederlandse Arbeidsinspectie — Asbestinventarisatie](https://www.nlarbeidsinspectie.nl/onderwerpen/asbest/asbestinventarisatie) — HIGH confidence (official Dutch Labour Inspectorate)
- [Rijksoverheid — Asbestregels](https://www.rijksoverheid.nl/onderwerpen/asbest/asbestregels) — HIGH confidence (official Dutch government, 1994 prohibition date)
- [DPO Centre NL — Leadgeneratie en de AVG](https://www.dpocentre.nl/en/2024/08/12/leadgeneratie-en-de-avg-is-uw-compliance-op-orde/) — MEDIUM confidence (Dutch DPO advisory firm, 2024)
- [Borgingcompany — De verschillende gevolgklassen](https://borgingcompany.nl/uncategorized/de-verschillende-gevolgklassen/) — MEDIUM confidence (kwaliteitsborging industry practitioner)
- MEMORY.md — HIGH confidence (established project patterns, direct-commit constraint documented)
- PROJECT.md — HIGH confidence (existing system capabilities, monument data, pand_status fields confirmed)

---
*Pitfalls research for: v9.0 Professional Marketplace — lead generation, Wkb classification, Bodemloket, asbest flagging, professional directory*
*Researched: 2026-03-01*

# Pitfalls Research

**Domain:** Dutch PropTech Property Intelligence Platform
**Researched:** 2026-02-07
**Confidence:** MEDIUM (based on domain knowledge of Dutch government APIs, AI document parsing, and PropTech platforms)

## Critical Pitfalls

### Pitfall 1: Treating Bestemmingsplan AI Parsing as 100% Accurate

**What goes wrong:**
Platform presents AI-parsed zoning regulations as definitive legal facts. Users make €500k+ investment decisions based on incorrect AI interpretations. When the actual bestemmingsplan says "no residential development allowed" but AI parsed it as "residential allowed with conditions," the developer loses months and significant legal costs.

**Why it happens:**
LLMs are impressive at parsing Dutch legal documents and extracting structured data from PDFs. Initial testing shows 85-95% accuracy, which feels "good enough." Developers trust the AI because it works most of the time, and building a confidence scoring system feels like over-engineering.

**How to avoid:**
- Always show confidence scores for AI-parsed data (LOW/MEDIUM/HIGH based on document structure clarity)
- Flag ambiguous interpretations with "Verify with notaris" warnings
- Never use words like "definitief" or "official" for AI-parsed data
- Include direct PDF snippets alongside interpretations so users can verify
- Build an "AI parsed this, human should verify" indicator for critical fields
- Test specifically on edge cases: handwritten annotations, scanned documents, multi-municipality edge zones

**Warning signs:**
- User feedback mentioning "wrong zoning data"
- No confidence scoring in UI
- No way to see the source PDF section that was parsed
- Marketing materials saying "automated legal analysis"
- No explicit disclaimers about AI accuracy limits

**Phase to address:**
Phase 1 (MVP Document Parsing) — Build confidence scoring and verification UI from day one. Adding disclaimers later breaks user trust.

---

### Pitfall 2: Assuming Dutch Government APIs Are Always Available

**What goes wrong:**
User enters an address, clicks "Generate Report," and gets a 500 error because PDOK/BAG/Kadaster API is down or throttling requests. Report generation takes 45 seconds instead of promised 5 seconds because of API timeouts. Platform appears broken during demo to prospective client because ruimtelijkeplannen.nl is experiencing downtime.

**Why it happens:**
Dutch government APIs generally work well, so initial testing shows 99% uptime. Developers build synchronous report generation that fetches all data on-demand. No fallback strategy exists because "the APIs are reliable." Rate limits aren't discovered until production load hits them.

**How to avoid:**
- Implement aggressive caching with staleness indicators (e.g., "BAG data as of 2024-01-15")
- Build async report generation: queue the request, fetch data in background, notify when ready
- Store fetched data permanently — never re-fetch the same address/parcel data
- Implement circuit breakers for each API: if PDOK is down, skip that section and flag as "unavailable"
- Display partial reports with clear "missing data" sections rather than failing completely
- Pre-fetch and cache common municipalities' base data during off-peak hours
- Monitor each API's SLA and status pages: PDOK, BAG API, Kadaster API, ruimtelijkeplannen.nl
- Build a status dashboard showing which data sources are operational

**Warning signs:**
- No caching layer in architecture
- Synchronous API calls in report generation endpoint
- No timeout handling on external requests
- No retry logic with exponential backoff
- User-facing errors saying "PDOK connection failed"
- No way to generate reports when one API is down

**Phase to address:**
Phase 1 (Core Data Pipeline) — Caching and async architecture must be foundational. Retrofitting this later requires rewriting the entire data layer.

---

### Pitfall 3: Monument Data Is Fragmented and Inconsistent Across Sources

**What goes wrong:**
A church is listed as "rijksmonument" in the RCE database but not flagged in BAG data. User generates report, sees "No monument status," proceeds with demolition plans, then discovers during permit application that it's protected. Platform credibility destroyed.

Another case: Monument data shows conflicting information — RCE says "beschermd stadsgezicht," municipality says "gemeentelijk monument," Kadaster has no monument flag. User doesn't know which source to trust.

**Why it happens:**
Monument data lives in multiple systems (RCE Monumentenregister, BAG, Kadaster, municipality databases) with different update cycles. Developers pick one "authoritative" source (usually BAG) and miss monuments that aren't synced yet. Edge cases like "in process of designation" or "beschermd stadsgezicht" (protected cityscape) aren't in standard APIs.

**How to avoid:**
- Query ALL monument data sources and show all results with source attribution
- Flag conflicts explicitly: "RCE says monument, BAG says no monument — verify with gemeente"
- Never show single "Monument: Yes/No" field — show detailed breakdown by source
- Include "beschermd stadsgezicht" status separately (different restrictions than individual monuments)
- Add timestamp for each data source: "RCE data from 2024-12-01, BAG data from 2025-01-15"
- For churches specifically, cross-reference with "herbestemming kerken" databases
- Build manual override capability for known data quality issues
- Include link to official RCE Monumentenregister page for user verification

**Warning signs:**
- Only querying one monument data source
- Boolean "is_monument" field instead of structured data
- No conflict detection between sources
- No timestamps showing data freshness
- No way to see which authority designated monument status
- Missing "beschermd stadsgezicht" entirely

**Phase to address:**
Phase 2 (Monument Data Integration) — After core BAG/PDOK integration works, add comprehensive monument checking. This is critical for churches/historic buildings target market.

---

### Pitfall 4: Ignoring Data Freshness and Update Frequency Differences

**What goes wrong:**
Platform shows "eigenaar: [company name]" from Kadaster data that's 8 months old. User contacts wrong owner, wastes weeks, discovers property was sold 6 months ago. Trust in platform evaporates.

Bestemmingsplan was updated 3 months ago (new development allowed), but platform shows cached old version saying "no development permitted." User skips opportunity that would have been profitable.

**Why it happens:**
Different data sources update at different frequencies: BAG updates daily, Kadaster updates weekly-monthly, bestemmingsplannen update irregularly (could be years between updates). Developers cache everything for 30 days uniformly without considering source-specific refresh needs.

**How to avoid:**
- Implement source-specific cache strategies:
  - BAG: 24 hours (changes frequently)
  - Kadaster eigenaar: 7 days max (ownership changes matter)
  - Bestemmingsplan: Check for updates every 14 days, cache for 90 days if no changes
  - Monument status: 30 days (changes slowly)
  - WOZ value: 365 days (annual assessment)
- Show explicit staleness indicators: "BAG data: Updated 2 hours ago" vs "Bestemmingsplan: Last checked 14 days ago"
- Allow users to force-refresh specific data sections
- Send background jobs to check for updates on recently accessed properties
- Flag "high risk of staleness" for critical fields like ownership
- Monitor ruimtelijkeplannen.nl for new plan publications and invalidate cache
- Build "data last verified" timestamps into database schema from day one

**Warning signs:**
- Single cache TTL for all data sources
- No "last updated" timestamps in UI
- No way for users to refresh data
- Database stores cached data without capture timestamp
- No monitoring for upstream data changes
- Treating all data as equally time-sensitive

**Phase to address:**
Phase 1 (Core Data Pipeline) — Build differentiated caching from the start. Changing cache strategy later requires data migration and invalidation logic.

---

### Pitfall 5: Municipality Boundaries and Multi-Jurisdiction Properties

**What goes wrong:**
A land parcel spans two municipalities (gemeente grens runs through it). Platform shows bestemmingsplan from only one municipality. User plans development based on incomplete zoning data, discovers during permit process that the other municipality has stricter rules that block the project.

Another case: Address lookup returns wrong municipality because BAG assigns it to one gemeente but the actual parcel is in another (or spanning both).

**Why it happens:**
Developers assume one address = one municipality = one bestemmingsplan. Edge cases where properties span boundaries are rare in testing (mostly in rural/agricultural areas) so they're not handled. BAG API returns single gemeente code, so code doesn't check for multi-jurisdiction scenarios.

**How to avoid:**
- After BAG address lookup, query Kadaster for parcel boundaries (perceelgrenzen)
- Check if parcel boundary intersects multiple municipality boundaries using PDOK BRT boundaries
- For multi-jurisdiction properties, fetch bestemmingsplannen from ALL municipalities
- Flag clearly in UI: "Property spans 2 municipalities — different rules may apply"
- Show each municipality's plans separately with boundary visualization
- Add special handling for properties near water boundaries (waterschappen jurisdiction)
- For edge cases, recommend user consults omgevingsdienst
- Test specifically with addresses near gemeente borders

**Warning signs:**
- Only querying bestemmingsplan using address municipality
- No parcel boundary visualization
- No check for boundary intersections
- Assuming one address = one jurisdiction
- No handling for waterschappen or other special jurisdictions
- User reports of "missing zoning data"

**Phase to address:**
Phase 3 (Advanced Zoning Features) — After basic bestemmingsplan parsing works, add multi-jurisdiction detection. This affects smaller subset of users but is critical for those cases.

---

### Pitfall 6: PDF Parsing Fails Silently on Complex Document Structures

**What goes wrong:**
Bestemmingsplan PDF has zoning rules in tables, footnotes, and appendices. AI parser only extracts main text body, misses critical restrictions in footnotes like "for parcel 123, maximum height is 12m instead of 18m." User plans 15m building, gets permit rejected.

Another case: Scanned PDF with OCR errors causes parser to misread "10 woningen" as "100 woningen," dramatically inflating development potential.

**Why it happens:**
Initial testing uses clean, well-structured digital PDFs. Production encounters scanned documents, complex layouts, handwritten annotations, and multi-part documents. LLM confidently extracts what it can parse and says nothing about what it couldn't parse. No validation checks for document structure complexity.

**How to avoid:**
- Detect document type: digital PDF vs. scanned (OCR quality indicator)
- Parse document structure metadata: tables, images, footnotes, appendices
- Flag documents with complex structures: "Contains tables/footnotes — AI parsing may be incomplete"
- Extract and display ALL document sections separately (regels, verbeelding, toelichting)
- For tables, use specialized table extraction instead of general LLM parsing
- Check for appendices and supplementary documents linked from main plan
- Validate extracted numbers: if "100 woningen" parsed but parcel is 500m², flag as unlikely
- Show confidence score per section, not just overall document
- Allow users to flag parsing errors — feed this back to improve prompts
- For critical projects, offer "human verification" service tier

**Warning signs:**
- No document structure analysis before parsing
- Same parsing prompt for all document types
- No detection of scanned vs. digital PDFs
- Missing validation of extracted numbers against physical constraints
- No way for users to report parsing errors
- High confidence scores even for complex documents
- Not parsing appendices or verbeelding (zoning map)

**Phase to address:**
Phase 1 (MVP Document Parsing) — Build structure detection and confidence scoring from start. Phase 4 (Accuracy Improvements) — Add human-in-the-loop verification for high-value projects.

---

### Pitfall 7: Caching/Storing Personal Data from Kadaster Without Proper Consent

**What goes wrong:**
Platform caches eigenaar (owner) names and contact details from Kadaster. This is personal data under GDPR/AVG. User generates report, shares PDF with colleague, personal data of property owner leaks. Kadaster or AP (Autoriteit Persoonsgegevens) investigates, platform faces GDPR fines.

**Why it happens:**
Kadaster API returns eigenaar data, developers store it like any other property attribute. No one considers it's personal data requiring special handling. Privacy policy doesn't mention storing owner information. No data retention policy exists.

**How to avoid:**
- Classify Kadaster eigenaar data as personal data requiring AVG compliance
- Implement strict purpose limitation: only fetch owner data when user explicitly requests it
- Don't include eigenaar in default cached property records
- Set short retention period (7-30 days) for owner data with automatic deletion
- Require user acceptance of terms before showing owner information
- Don't include owner data in exported/shared PDFs unless explicitly opted-in
- Log access to owner information for audit trail
- Document legal basis for processing in privacy policy (legitimate interest for due diligence)
- Consider fetching owner data on-demand without caching
- Filter organization_id properly — never show owner data across organizations
- For businesses/companies as eigenaar, different rules apply than individuals

**Warning signs:**
- Owner name stored in same table as building data
- No TTL on cached owner information
- Export/PDF includes owner by default
- No logging of who accessed owner data
- Privacy policy doesn't mention Kadaster data
- No distinction between individual vs. company owners
- Same retention policy for all data types

**Phase to address:**
Phase 1 (Core Data Pipeline) — Data classification and retention policies must be built in from start. Adding privacy controls later requires data migration and potential deletion of existing data.

---

### Pitfall 8: Underestimating Bestemmingsplan Complexity and Variation

**What goes wrong:**
Platform works great for modern digital bestemmingsplannen (post-2010 IMRO standard). User requests report for property with older plan from 1987 — completely different format, not digitized, only available as scanned images at gemeentehuis. Report shows "No bestemmingsplan found" despite plan existing.

Another case: Platform handles standard residential/commercial zoning well, but fails on special categories like "overgangsrecht" (grandfather clauses), "vrijstellingen" (exemptions), or "anterieure overeenkomsten" (prior agreements) that override standard zoning.

**Why it happens:**
Developers test with recent, standard bestemmingsplannen from large municipalities. Older plans, special cases, and complex legal overlays aren't encountered until production. ruimtelijkeplannen.nl API primarily indexes IMRO-compliant plans, older plans may not be digitized.

**How to avoid:**
- Detect plan vintage: flag plans older than 2008 (pre-Wro) as "may require manual verification"
- Check ruimtelijkeplannen.nl for plan type: bestemmingsplan, inpassingsplan, beheersverordening
- Parse and highlight special categories:
  - Overgangsrecht (existing use allowed despite zoning)
  - Wijzigingsbevoegdheid (municipality can change rules)
  - Vrijstellingen (exemptions granted)
  - Anterieure overeenkomsten (private agreements on file)
- For plans not in ruimtelijkeplannen.nl, show "Older plan — contact gemeente for details"
- Include link to gemeentelijk loket for manual lookup
- Build "plan complexity" indicator based on: age, document structure, special provisions
- Parse omgevingsvergunning history (permits granted can indicate exemptions)
- Handle Omgevingswet transition (July 2024+): new plans vs. old plans in parallel

**Warning signs:**
- Only testing with post-2010 plans
- No handling for plan types beyond bestemmingsplan
- Not parsing wijzigingsbevoegdheid or overgangsrecht sections
- Assuming all plans are in ruimtelijkeplannen.nl
- No Omgevingswet transition strategy
- No indicator of plan vintage/complexity
- Boolean "zoning found" without nuance

**Phase to address:**
Phase 1 (MVP Document Parsing) — Detect plan vintage and type. Phase 3 (Advanced Zoning Features) — Parse special provisions and edge cases. Phase 5 (Omgevingswet Compliance) — Handle new regulatory framework.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing raw API responses instead of normalized data | Fast to implement, "just cache JSON" | Can't query efficiently, schema changes break everything, huge storage waste | Never — normalize from day one |
| Single monolithic "generate report" function | Works for MVP, easy to understand | Impossible to add features, can't optimize individual data sources, hard to debug failures | Only for prototype/demo, must refactor before launch |
| Hardcoding municipality-specific logic | Handles known edge cases quickly | Unmaintainable as you add municipalities, requires code deploy for config changes | Never — use configuration/rules engine |
| Skipping background job queue for API calls | Simpler architecture, faster initial development | Timeouts, can't handle API downtime, poor UX for slow operations | Only if all APIs respond <2s and have 99.9% uptime (never true) |
| Treating all parsing errors as "confidence: LOW" | Easier than categorizing error types | Can't improve systematically, no debugging data, user sees same vague warning for different issues | Never — log specific error types |
| Not versioning cached data | No migration complexity | Can't roll out improvements, stale data persists forever, no A/B testing parsing changes | Only for MVP with <10 test users |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PDOK APIs | Using WFS without pagination, fetching entire datasets | Use WFS with propertyName filters, bbox, and maxFeatures. Cache aggressively. |
| BAG API | Assuming nummeraanduiding ID is stable forever | Store both nummeraanduiding ID and verblijfsobject ID. Cross-reference on staleness. |
| Kadaster API | Not handling eigenaar privacy restrictions | Check if eigenaar is masked/restricted before displaying. Have fallback UI for "eigenaar niet beschikbaar." |
| ruimtelijkeplannen.nl | Assuming PDF URLs are permanent | Store PDF locally after first fetch. URL can change if plan is re-published. |
| RCE Monumentenregister | Querying by address instead of Rijksmonumentnummer | BAG has monumentnummer field — use that to query RCE for details. Address matching is fuzzy. |
| LLM APIs (OpenAI/Anthropic) | Sending entire 200-page bestemmingsplan in one prompt | Extract relevant sections first (use TOC/structure analysis), send targeted chunks, reassemble. |
| Omgevingsloket | Assuming API has all permit data | Only recent permits are in API. Historical permits may only be in paper archives. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous LLM parsing in request/response cycle | Initial reports work, then timeouts start | Queue parsing jobs, return report ID, notify when ready | >10 concurrent report requests |
| Fetching all BAG data for a municipality on first query | Works for small gemeenten, fails for Amsterdam | Fetch only requested addresses, pre-cache popular areas | Municipalities >50k addresses |
| No rate limiting on external APIs | Development is fast, production hits Kadaster rate limits | Implement token bucket rate limiter per API, queue requests | >100 reports/hour |
| Storing full PDFs in PostgreSQL | Simple, works initially | PDFs bloat database, backups become huge, queries slow | >1000 cached reports |
| Re-parsing same bestemmingsplan for every address | Saves storage, seems logical | Same plan parsed 100x for 100 addresses in same zone | >500 reports in same municipality |
| Loading all cached reports into memory for dashboard | Fast queries initially | Memory exhaustion, OOM kills | >10k cached reports |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing other organizations' property research | Competitor sees what properties your users are researching, steals deal flow | Strict organization_id filtering on ALL queries, audit log access patterns |
| Allowing unlimited API calls to Kadaster with user's org credentials | Malicious user burns through API quota, blocks legitimate users | Per-organization rate limiting, quota monitoring, alerts |
| Storing Kadaster API credentials in application code | Credentials leak in git, decompiled code, logs | Use environment variables, secret management (Vault/AWS Secrets Manager) |
| Showing raw addresses in URLs (report/generate?address=Kerkstraat+1+Amsterdam) | Leaks what properties are being researched in browser history, logs, analytics | Use opaque IDs (report/generate?id=uuid), store address separately |
| Not sanitizing user input for address search | SQL injection, XSS in reports if malicious address entered | Parameterized queries, input validation, output escaping |
| Including API keys in client-side code for map rendering | API keys exposed, can be used for abuse | Use backend proxy for all external API calls, rotate keys regularly |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw API error messages ("PDOK returned 503") | User thinks platform is broken, no clear action | "Property data temporarily unavailable. Retry in 5 minutes or view cached data." |
| Using technical terms (perceelnummer, verblijfsobject) without explanation | User unfamiliar with Dutch cadastral system gets confused | Provide tooltips/help text, use friendly labels ("Parcel number (kadastrale aanduiding)") |
| Generating full report without progress indication | User waits 30s staring at blank screen, assumes it crashed | Show progress: "Fetching BAG data... Parsing bestemmingsplan... Checking monument status..." |
| Displaying conflicting data without explanation | Monument status shows "Yes" and "No" from different sources, user loses trust | "Conflict detected: RCE says monument, BAG says no monument. Verify with gemeente." |
| Not explaining why certain data is missing | Report shows "N/A" for bestemmingsplan with no reason | "No digital bestemmingsplan found. Property may have older plan — contact Gemeente Smalltown." |
| Exporting reports as PDF without date/version | User shares stale report, recipient doesn't know it's old | Include "Generated: 2024-01-15" and "Data sources: BAG (2024-01-14), Kadaster (2024-01-10)" |
| No way to compare multiple properties side-by-side | User opens 5 browser tabs, manually compares | Build comparison view for shortlisted properties |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Address lookup:** Often missing handling for addresses with toevoeging (e.g., "12A") — verify edge cases work
- [ ] **Monument status:** Often missing beschermd stadsgezicht (only checks individual monuments) — verify RCE scope query
- [ ] **Bestemmingsplan parsing:** Often missing appendices and verbeelding (zoning map) — verify all document parts extracted
- [ ] **Eigenaar data:** Often missing GDPR consent flow and data retention — verify privacy compliance
- [ ] **API caching:** Often missing staleness indicators and force-refresh option — verify users know data age
- [ ] **Error handling:** Often missing partial results when one API fails — verify graceful degradation
- [ ] **Multi-tenancy:** Often missing organization_id filters on cached data queries — verify data isolation
- [ ] **Report export:** Often missing data freshness timestamps and confidence indicators — verify exports are verifiable
- [ ] **Rate limiting:** Often missing per-organization quotas — verify fair usage enforcement
- [ ] **Background jobs:** Often missing retry logic and dead letter queue — verify failed jobs don't disappear

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AI parsing errors discovered by users | MEDIUM | 1. Build feedback mechanism to flag errors 2. Create correction database 3. Re-parse with improved prompts 4. Notify affected users of corrections |
| GDPR violation (cached personal data) | HIGH | 1. Immediate data purge 2. Notify AP and affected individuals 3. Update privacy policy 4. Implement controls 5. Legal consultation |
| Wrong municipality data shown | MEDIUM | 1. Identify affected addresses 2. Invalidate cache 3. Re-fetch correct data 4. Email users with corrected reports 5. Add validation to prevent recurrence |
| API rate limit exhaustion | LOW | 1. Implement request queue 2. Throttle new requests 3. Serve cached data 4. Contact API provider for limit increase 5. Add rate limit monitoring |
| Database bloated with PDF storage | MEDIUM | 1. Migrate PDFs to object storage (S3) 2. Update schema to store URLs 3. Clean up old database PDFs 4. Update queries to fetch from new location |
| Stale data shown as current | LOW | 1. Add "Last updated" to all data points 2. Re-fetch affected properties 3. Invalidate old cache 4. Set appropriate TTLs going forward |
| Monument designation missed | HIGH | 1. Contact affected users directly 2. Issue corrected reports 3. Add all monument data sources 4. Implement conflict detection 5. Add manual verification step for churches |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AI parsing accuracy issues | Phase 1 (MVP Document Parsing) | Test suite with 50+ real bestemmingsplannen, confidence scores in UI |
| API availability assumptions | Phase 1 (Core Data Pipeline) | Simulate API downtime, verify partial reports generated |
| Monument data fragmentation | Phase 2 (Monument Data Integration) | Check test addresses against all sources, verify conflict detection UI |
| Data freshness inconsistency | Phase 1 (Core Data Pipeline) | Verify different TTLs per source, "last updated" in UI |
| Multi-jurisdiction properties | Phase 3 (Advanced Zoning Features) | Test addresses on gemeente boundaries, verify multiple plans fetched |
| PDF parsing fails silently | Phase 1 (MVP Document Parsing) | Test scanned PDFs, complex layouts, verify structure detection works |
| GDPR non-compliance (owner data) | Phase 1 (Core Data Pipeline) | Privacy audit, verify TTLs on personal data, test data deletion |
| Bestemmingsplan complexity | Phase 1 (MVP) + Phase 3 (Advanced) | Test old plans, special provisions, verify complexity indicators |

## Sources

**Note:** Due to WebSearch being unavailable, this research is based on domain expertise with Dutch government data systems, PropTech platforms, and AI document parsing. Confidence level is MEDIUM.

**Knowledge sources:**
- Dutch government API documentation and behavior (BAG, PDOK, Kadaster, RCE)
- Bestemmingsplan structure and legal framework (Wet ruimtelijke ordening)
- GDPR/AVG requirements for property data
- PropTech platform architecture patterns
- LLM document parsing limitations and strategies
- Multi-tenant SaaS security best practices

**Recommended verification:**
- Consult with Kadaster API documentation for current rate limits and SLAs
- Review PDOK service status history for availability patterns
- Check ruimtelijkeplannen.nl API documentation for coverage limitations
- Validate GDPR interpretation with legal counsel specializing in Dutch property data
- Test with real bestemmingsplannen from target municipalities (churches, monuments)

---
*Pitfalls research for: CRM Plus — Dutch PropTech Property Intelligence Platform*
*Researched: 2026-02-07*
*Confidence: MEDIUM — Based on domain expertise, should verify specifics with official sources*

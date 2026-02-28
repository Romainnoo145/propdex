# Project Research Summary

**Project:** Propdex v9.0 Professional Marketplace
**Domain:** Dutch PropTech — Wkb kwaliteitsborger lead generation on existing property intelligence platform
**Researched:** 2026-03-01
**Confidence:** HIGH (stack, architecture, Wkb rules, asbest rules) / MEDIUM (Bodemloket API access method, marketplace patterns)

## Executive Summary

Propdex v9.0 extends a mature Dutch property intelligence platform (v1.0–v8.x, 8 shipped versions) into a B2B lead generation marketplace for Wkb kwaliteitsborgers. The pivot is well-timed: the Wet kwaliteitsborging voor het bouwen became mandatory for gevolgklasse 1 (GK1) new construction in January 2024, and renovation projects were explicitly excluded in December 2024, creating a focused, validated market need. The platform already has all the data infrastructure required (BAG, bestemmingsplan, RCE monuments, WeasyPrint PDF, fastapi-mail, TanStack Table) — v9.0 adds six new features with zero new npm or pip dependencies, which is an unusually low-risk milestone from a dependency perspective.

The core differentiator over generic marketplaces (Werkspot, Bark.com) is the pre-assembled risicobeoordeling dossier: Propdex auto-generates the kwaliteitsborger intake document from government API data, saving 1–3 hours per project and making leads significantly higher quality than self-reported competitor leads. This context-first approach — developer first sees property intelligence, then sees a CTA — is the product's competitive moat and must be protected in every phase ordering decision. The two new data sources (Bodemloket soil contamination, Wkb gevolgklasse classifier) feed directly into the dossier's required content per official IPLO.nl and Bbl requirements.

The primary technical risk is the Bodemloket API access method: the ArcGIS REST endpoint documented in community sources returned 404 during direct architecture testing; the WMS GetCapabilities did confirm three layers. The integration must start with a spike to establish the actual viable query method before committing to scope. The primary regulatory risks are (1) presenting gevolgklasse classification as authoritative rather than indicative — monuments and verbouwingen are explicitly excluded from Wkb scope, (2) treating Bodemloket empty results as soil clearance when Bodemloket itself disclaims data completeness, and (3) routing developer contact data to professionals without explicit AVG consent logging. All three require disclaimer and consent design before UI implementation begins.

## Key Findings

### Recommended Stack

The v9.0 stack is entirely the existing stack. All six new features — Bodemloket API client, Wkb gevolgklasse classifier, asbest risk indicator, risicobeoordeling dossier PDF, lead capture flow, and professional directory — are implemented using already-installed packages. No changes to `pyproject.toml` or `package.json`.

**Core technologies (all existing):**
- httpx + pyproj: Bodemloket WMS client — existing government API pattern, WGS84 to RD New coordinate conversion already in use for RCE monuments
- WeasyPrint + Jinja2: Dossier PDF — existing `asyncio.to_thread()` pipeline from `reports/pdf_export.py`, new Jinja2 template file only
- fastapi-mail: Lead notification emails — existing pattern from `auth/email.py`
- SQLAlchemy ARRAY(Integer) + ARRAY(String): Professional directory gevolgklassen/regio filtering — already supported via PostGIS Docker image
- TanStack Table: Professional directory frontend — already installed in `package.json`
- react-hook-form + zod + sonner: Lead capture form and toast feedback — all already installed

Two new database migrations are required (professionals table, lead_requests table). One new config field is needed (BODEMLOKET_BASE_URL). All existing patterns must be preserved: direct `db.add()/db.flush()/db.commit()` (never `async with db.begin()`), `datetime.utcnow()` (not timezone-aware), `Mapped[type]` + `mapped_column()` SQLAlchemy 2.x syntax throughout.

### Expected Features

**Must have (table stakes) — v9.0 launch:**
- Gevolgklasse determination (GK1) prominently displayed in property report — entry point for every kwaliteitsborger workflow
- Asbest risk indicator (bouwjaar < 1994 flag) — zero API cost, derived from BAG data already present
- Bodemloket soil contamination indicator — required for legally complete risicobeoordeling under Bbl
- "Vraag kwaliteitsborger aan" CTA in report — contextual, appears only when `wkb_applicable === true`
- Lead capture form with auto-fill from report data — address, bouwjaar, GK, oppervlakte pre-populated
- Risicobeoordeling dossier PDF export — core value proposition for kwaliteitsborgers (saves 1–3 hours of intake work)
- Professional directory (minimum 3–5 manually seeded TloKB-verified listings) — supply side required before CTA goes live
- Email notification to kwaliteitsborger (manual routing in MVP) + confirmation to developer

**Should have (differentiators) — v9.x post-validation:**
- Lead quality scoring (dossier completeness %, GK match to professional's werkgebied, start date specificity)
- TloKB register verification badge on professional listings
- Dynamic professional directory populated from TloKB public register (replaces manual seed)
- Lead status tracking by professional (Nieuw/In behandeling/Offerte verstuurd)
- Pre-filled structured risk matrix in lead notification email (asbest Y/N, bodem Y/N, GK, oppervlakte)

**Defer to v10.0+:**
- Payment infrastructure (per-lead credits, subscription billing, escrow, VAT invoicing)
- Additional professional verticals: constructeurs, asbestbedrijven, bodemonderzoekers
- B2B API for borgingspartijen (Woningborg, Kiwa, SWK)
- Automated conflict-of-interest checking between professional and project parties

**Anti-features to explicitly avoid:**
- Open bidding/price comparison — commoditizes a professional trust relationship that Wkb requires to be ongoing
- Public star ratings — legally contentious in a small professional market with independence requirements
- GK2/GK3 lead generation — Wkb does not yet require kwaliteitsborging for GK2/GK3
- Multi-vertical marketplace launch — scope explosion; prove kwaliteitsborger model first

### Architecture Approach

v9.0 extends a stable three-tier architecture (React frontend, FastAPI backend, PostgreSQL/PostGIS) without restructuring it. The central data contract is `PropertyReportResponse` — all new data sources (bodem_data, wkb_classification, asbest_risk) add optional Pydantic fields to this schema, flowing through the existing aggregator, DB save, and PDF export pipeline. Two entirely new subsystems are added alongside the extended report pipeline: the dossier generator (POST/GET dossier endpoints, Jinja2 template, WeasyPrint) and the marketplace layer (professionals table, lead_requests table, email routing). The professional directory uses NULL organization_id (platform-level resource) rather than the tenant-scoped pattern used by all other models — this is a deliberate and critical exception requiring its own RLS policy and cross-tenant integration tests.

**Major components:**
1. Bodemloket WMS client (`government_apis/bodemloket_wms.py`) — queries WBB_locaties layer via GetFeatureInfo with 50m bbox buffer, 30-day JSONB cache, 2 concurrent / 100 per hour rate limit
2. Wkb classifier service (`services/wkb_classifier.py`) — pure Python rule engine, called from property_aggregator, returns WkbClassification with gevolgklasse + wkb_applicable + confidence + classification_basis list
3. Asbest indicator service (`services/asbest_indicator.py`) — pure Python, bouwjaar threshold (< 1994), high/medium/none/unknown risk levels with NEN 2991 reference
4. Dossier generator (`dossier/router.py`, `dossier/generator.py`, `dossier/templates/wkb_kwaliteitsborger.html`) — aggregates report sections, asyncio.to_thread WeasyPrint, POST generate + GET download pattern, GeneratedDossier model
5. Lead capture (`leads/router.py`, `models/lead_request.py`) — org-scoped leads with consent logging fields, email notification via fastapi-mail, direct-commit pattern
6. Professional directory (`professionals/router.py`, `models/professional.py`) — platform-scoped (NULL org_id), ARRAY GIN indexes for gevolgklassen and regio_gemeenten filtering, admin-managed in MVP

### Critical Pitfalls

1. **Wkb classification presented as authoritative** — The schema must include `wkb_applicable: bool` and `uncertainty_flags` from the start. Label as "Indicatief" in all UI copy. Monument exclusion (`is_rijksmonument`) and verbouw exclusion (December 2024 ministerial decision) must be built into the classifier before any CTA is built. The CTA component must check `wkb_applicable`, not just `gevolgklasse`. Gemeentelijke monumenten are not visible to RCE data — flag this uncertainty explicitly.

2. **Bodemloket empty result treated as soil clearance** — Bodemloket's own FAQ states its data is incomplete. Display must always read "Geen geregistreerde verontreiniging gevonden" not "Geen bodemverontreiniging." The ArcGIS REST endpoint returned 404 during testing; WMS is the verified fallback. A spike to confirm the viable access method is mandatory before integration work begins.

3. **AVG consent not logged for lead routing** — Sharing developer contact details with a professional requires explicit, specific, timestamped consent under Dutch AVG (GDPR). The LeadRequest model must store `consent_timestamp`, `consent_text_hash`, and `consent_given` before any lead data is transmitted. A verwerkersovereenkomst template for professionals must be drafted before the directory goes live.

4. **Professional directory multi-tenant isolation break** — Professional profiles are platform-level data visible to all tenants. Using `organization_id NOT NULL` on the Professional model would make all listings invisible across tenants. Use `organization_id = NULL` with a separate RLS policy. Cross-tenant read integration test is required before the directory API ships.

5. **Cold start: lead CTA enabled before supply is recruited** — The CTA must be gated by gemeente-based availability check. Supply-side recruitment (2–3 verified kwaliteitsborgers with TloKB confirmation) must happen before the CTA is enabled in production. Seeding the directory is a launch blocker, not an optional post-launch task.

## Implications for Roadmap

Based on research, suggested phase structure (5 phases):

### Phase 1: Wkb Classification Engine + Asbest Risk Indicator

**Rationale:** The gevolgklasse determination is the entry point for the entire user journey. The CTA, the dossier, and the lead form all depend on a trustworthy GK classification being present in the report. Asbest indicator ships in the same phase — it is zero-cost (pure computation from existing bouwjaar) and feeds the same dossier. Both pitfalls around Wkb misclassification (monument exclusion, verbouw exclusion) must be addressed here before anything downstream is built.
**Delivers:** `wkb_classification` field in PropertyReportResponse (gevolgklasse + wkb_applicable + uncertainty_flags + classification_basis); `asbest_risk` field (risk_level + bouwjaar + NEN 2991 reference); extended WkbSection and new AsbstSection in ReportDetailPage; `wkb_classifier.py` and `asbest_indicator.py` service files.
**Features from FEATURES.md:** GK determination (P1), asbest risk indicator (P1)
**Avoids:** Pitfalls 1, 3, 6, 12 (classification as authoritative; asbest as binary result; monument CTA; verbouw exclusion missing)
**Research flag:** Skip research-phase. Pure Python rule engines with well-documented rules from IPLO.nl and TloKB (HIGH confidence). Follow existing `wkb_precheck.py` as structural template.

### Phase 2: Bodemloket Integration

**Rationale:** Bodemloket is required for a legally complete risicobeoordeling under Bbl, but its API access method is unconfirmed (MEDIUM confidence). Phase 2 starts with a mandatory spike to verify whether WMS GetFeatureInfo or ArcGIS REST is the viable query path. Only after the spike resolves does integration proceed. Keeping Bodemloket as a separate phase prevents the spike uncertainty from blocking Phase 1 delivery.
**Delivers:** `bodem_data` field in PropertyReportResponse; BodemSection in ReportDetailPage with "Geen geregistreerde verontreiniging" framing plus coverage disclaimer; `bodemloket_wms.py` API client; 30-day JSONB cache; BodemData schema.
**Features from FEATURES.md:** Bodemloket soil contamination indicator (P1)
**Avoids:** Pitfalls 2 and 11 (absence treated as clearance; no REST JSON API assumed)
**Research flag:** Mandatory spike at phase start. Verify actual viable Bodemloket query method (WMS GetFeatureInfo vs ArcGIS REST) before scoping integration. Document live response format for WBB_locaties layer with a known contaminated parcel before writing the parser.

### Phase 3: Risicobeoordeling Dossier PDF Generator

**Rationale:** The dossier aggregates outputs from Phases 1 and 2 and is the core differentiator. It is the prerequisite for the lead capture CTA — without the dossier, the CTA is just another contact form with no competitive moat. Building Phase 3 after Phases 1 and 2 ensures real data flows through the template. The WeasyPrint pattern is already established; this phase is primarily a template authoring task with careful copy and disclaimer design.
**Delivers:** POST /api/dossier/{report_id}/generate + GET /api/dossier/{dossier_id}/download; `wkb_kwaliteitsborger.html` Jinja2 template with mandatory "Propdex Datasamenvatting" title and disclaimer on every page; GeneratedDossier model; asyncio.to_thread generation flow; "Genereer dossier" CTA in ReportDetailPage.
**Features from FEATURES.md:** Risicobeoordeling dossier PDF (P1)
**Uses from STACK.md:** WeasyPrint + Jinja2 (existing), asyncio.to_thread pattern (established in pdf_export.py)
**Avoids:** Pitfall 9 (PDF presented as formal Wkb compliance document — disclaimer and naming are hardcoded, non-configurable from first iteration)
**Research flag:** Skip research-phase. Existing WeasyPrint pipeline is proven in production. Follow `reports/pdf_export.py` and `reports/templates/report.html` as structural templates.

### Phase 4: Professional Directory + Supply Recruitment

**Rationale:** The directory must be live and seeded with verified professionals before the lead CTA is enabled. This phase has the most nuanced technical requirement (NULL org_id RLS pattern, cross-tenant visibility tests) and a non-technical prerequisite (manual recruitment of 2–3 kwaliteitsborgers with TloKB link verification). Both must be complete and tested before Phase 5 ships. The database schema decision about NULL org_id must be made and tested before any API endpoint is built.
**Delivers:** Professional model (NULL org_id, GIN indexes on gevolgklassen and regio_gemeenten arrays, TimestampMixin); GET /api/professionals with gemeente and gevolgklasse filters + pagination; ProfessionalDirectory frontend component (TanStack Table); TloKB link on each professional listing card; disclaimer copy about certification verification responsibility; admin CRUD for managing listings; seeded with 3–5 verified professionals with TloKB confirmation.
**Features from FEATURES.md:** Professional directory listing (P1), TloKB verification link (P2 partial)
**Avoids:** Pitfalls 5, 8, 10 (unverified professionals receiving leads; cold start CTA with empty directory; multi-tenant isolation break on Professional model)
**Research flag:** Skip research-phase for technical implementation. Standard PostgreSQL ARRAY + CRUD. Operational dependency (supply recruitment and verwerkersovereenkomst draft) must be tracked as a parallel non-code task and must complete before Phase 5 launches.

### Phase 5: Lead Capture Flow + Email Routing

**Rationale:** Lead capture is the final step in the user journey and depends on the dossier (Phase 3), the directory (Phase 4), and the GK determination (Phase 1). It carries the highest regulatory risk (AVG consent) and must be designed carefully before any frontend work begins. The consent screen design and consent logging model fields must be specified before the CTA button is built — retrofitting consent is structurally harder than designing it in from the start.
**Delivers:** LeadRequest model with consent_timestamp, consent_text_hash, consent_given, and org-scoped isolation; POST /api/leads with AVG consent validation; admin GET /api/leads; lead notification email to admin (manual routing in MVP); developer confirmation email; "Vraag kwaliteitsborger aan" CTA in WkbSection (gated by `wkb_applicable === true` and gemeente availability); LeadCaptureForm with auto-fill (address, bouwjaar, GK, oppervlakte from report data); CTA not rendered when no professional serves the parcel's gemeente.
**Features from FEATURES.md:** "Vraag kwaliteitsborger aan" CTA (P1), lead capture form with auto-fill (P1), lead notification to professional (P1), lead confirmation to developer (P1)
**Avoids:** Pitfalls 4, 7, 8 (AVG consent violation in lead routing; direct-commit pattern broken by new B2B routers; cold start CTA before supply is live)
**Research flag:** Skip research-phase. AVG consent flow is well-documented (Dutch AP guidelines). Direct-commit pattern is project-established in MEMORY.md. Verwerkersovereenkomst is a legal/operational deliverable, not a coding research question — must be complete before launch.

### Phase Ordering Rationale

- Phases 1 and 2 must precede Phase 3 because the dossier template aggregates their output fields. Bodemloket can render "Niet beschikbaar" in the dossier if Phase 2 encounters delays, but GK classification cannot be absent from the dossier.
- Phase 2 is isolated from Phase 1 specifically because the Bodemloket spike carries uncertain scope — it must not block Phase 1 delivery.
- Phase 4 must precede Phase 5 because lead routing requires at least one verified professional in the directory and the consent model requires the professional_id foreign key.
- Phase 5 is last because it is the public-facing revenue-generating feature and requires all preceding infrastructure to be complete, tested, and have supply seeded.
- Supply recruitment (Phase 4 operational track) and verwerkersovereenkomst drafting must run in parallel to coding and complete before Phase 5 CTA is enabled in production.

### Research Flags

Phases needing deeper research or validation:
- **Phase 2 (Bodemloket):** Mandatory spike before any integration code is written. Verify WMS GetFeatureInfo vs ArcGIS REST for structured JSON data. Document live response format for WBB_locaties with a known contaminated parcel (e.g., a known WBB dossier location). If WMS-only returns HTML text/xml rather than structured JSON, the display capability changes from "status code + dossier ID" to "contamination indicator only" — this changes the frontend component scope.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Wkb/Asbest):** Official IPLO.nl and TloKB rules are clear, authoritative, and HIGH confidence. Follow existing `wkb_precheck.py` pattern.
- **Phase 3 (Dossier PDF):** WeasyPrint + Jinja2 pattern is proven in production. Template authoring task.
- **Phase 4 (Directory):** Standard PostgreSQL ARRAY + CRUD. The NULL org_id pattern is a design decision, not research.
- **Phase 5 (Lead Capture):** Established patterns throughout. AVG consent requirements are documented by Dutch AP.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies confirmed by direct audit of pyproject.toml and package.json. All six features use existing packages. Version compatibility matrix verified. |
| Features | HIGH | Wkb rules, asbest threshold, and dossier required content sourced from IPLO.nl, TloKB, Nederlandse Arbeidsinspectie (all official Dutch government). Marketplace patterns from Werkspot/Bark comparables. |
| Architecture | HIGH | Based on direct codebase analysis of existing v7.2 pipeline. Integration points, component boundaries, and NULL org_id decision are explicit. One MEDIUM gap: Bodemloket API response format. |
| Pitfalls | HIGH | Critical pitfalls sourced from official regulatory sources (VNG December 2024 decision, Bodemloket FAQ, Stichting IBK monument exclusion, Dutch AP AVG guidance). MEMORY.md constraints verified against codebase. |

**Overall confidence:** HIGH, with one MEDIUM-confidence gap (Bodemloket API access method and response format).

### Gaps to Address

- **Bodemloket REST API availability:** The ArcGIS REST endpoint returned 404 during architecture research testing. WMS GetCapabilities confirmed three layers. Phase 2 must begin with a live spike to determine whether structured JSON data is available via ArcGIS REST or whether the integration is WMS GetFeatureInfo only. If WMS GetFeatureInfo returns text/xml, field extraction via lxml (already installed) is the path; if it returns only a raster tile, the integration becomes a map overlay only with a link to Bodemloket.nl for detailed data.

- **Bodemloket municipality coverage data:** Bodemloket FAQ explicitly states data is incomplete and not all municipalities have delivered their data. No published list of contributing municipalities exists. The coverage disclaimer must be prominent in all display and PDF output, but a per-gemeente coverage indicator is not achievable without additional data sourcing.

- **Kwaliteitsborger supply recruitment:** Seeding the professional directory with 2–3 TloKB-verified professionals before Phase 5 launches is an operational prerequisite that is external to the codebase. This must be tracked as a launch blocker alongside Phase 4 delivery. TloKB's public register at `register.tlokb.nl` provides the authoritative source for verification.

- **Verwerkersovereenkomst template:** A data processing agreement for professionals receiving lead data is a legal/compliance prerequisite for Phase 5. Must be drafted and reviewed before lead routing is enabled in production. Not a coding task, but a Phase 5 launch gate.

## Sources

### Primary (HIGH confidence)
- [IPLO.nl — Bouwwerken in gevolgklasse](https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/bouwwerken-gevolgklasse/) — GK1 classification criteria, monument exclusion
- [TloKB — Gevolgklassen overview](https://www.tlokb.nl/wet-kwaliteitsborging/gevolgklassen) — Three-class risk rationale, TloKB certification requirements
- [IPLO.nl — Kwaliteitsborger dossier requirements](https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/kwaliteitsborger/) — Borgingsplan and dossier required content per Bbl
- [VNG — Verbouwingen voorlopig niet onder de Wkb](https://vng.nl/nieuws/verbouwingen-voorlopig-niet-onder-de-wkb) — December 2024 ministerial decision excluding renovations from Wkb scope
- [Stichting IBK — Vallen monumenten ook onder de Wkb?](https://www.stichtingibk.nl/2024/01/24/vallen-monumenten-ook-onder-de-wkb/) — Monument exclusion from Wkb quality assurance requirement
- [Nederlandse Arbeidsinspectie — Asbestinventarisatie](https://www.nlarbeidsinspectie.nl/onderwerpen/asbest/asbestinventarisatie) — Pre-1994 asbestos mandatory inventory rule (NEN 2991)
- [Bodemloket — FAQ](https://bodemloket.nl/faq-page) — Explicit data completeness limitations disclaimer
- [Bodemloket WMS GetCapabilities](https://gis.gdngeoservices.nl/standalone/services/blk_gdn/lks_blk_rd_v1/MapServer/WMSServer) — Three layers confirmed live: WBB_locaties, Bevoegd_gezag, Beschikbaarheid_gegevens; EPSG:28992 supported
- MEMORY.md — Direct-commit pattern, datetime constraints, PyJWT/pwdlib patterns, multi-tenant isolation
- Codebase audit: `backend/app/reports/pdf_export.py`, `backend/app/auth/email.py`, `backend/app/services/wkb_precheck.py`, `backend/pyproject.toml`, `frontend/package.json` — existing patterns confirmed, zero new dependencies verified

### Secondary (MEDIUM confidence)
- [Bodemloket ArcGIS REST endpoint](https://www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer) — Documented in 2019 community blog; REST query returned 404 in architecture research; WMS is the confirmed fallback
- [Friesewoudloper blog — Bodemloket layer structure](http://www.friesewoudloper.nl/2019/05/30/Hergebruik-van-bodemkwaliteitsgegevens.html) — WBB field names (2019, needs live verification in Phase 2 spike)
- [Borgingcompany.nl — Wkb kosten](https://borgingcompany.nl/wet-kwaliteitsborging-kosten/) — Kwaliteitsborger fee approximately 1–1.5% of bouwsom
- [DPO Centre NL — Leadgeneratie en de AVG](https://www.dpocentre.nl/en/2024/08/12/leadgeneratie-en-de-avg-is-uw-compliance-op-orde/) — AVG consent requirements for B2B lead routing

### Tertiary (LOW confidence — needs live validation in Phase 2 spike)
- Bodemloket field names `WBB_DOSSIER_DBK`, `STATUS_OORD`, `LOCATIECODE_BEVOEGD_GEZAG`, `NEN3610_ID_SOIL_LOCATION` — inferred from 2019 blog and architecture research docs; must be verified against live WMS GetFeatureInfo response before writing the parser

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*

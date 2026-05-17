# Propdex

## What This Is

Dutch property intelligence cockpit for vastgoedontwikkelaars and kwaliteitsborgers. End-to-end platform from scouting → screening → due diligence → risico-analyse → go/no-go → vergunningenbeheer tot aan bouwfase. Multi-tenant SaaS (NL/BE).

## Core Value

From grondpositie to first spade in one cockpit — no switching between 10 tabs.

## Requirements

### Validated

- ✓ Map-based perceel scanning met score-overlay (Aura v15.0 frontend, Score v3.0 backend) — M001-M044
- ✓ Intelligence Grid: Potentie (3×3) + Risico (paginated) + Dossiers — Phase 103-104
- ✓ Scoring fundament opgeschoond — 58 gewicht gesaneerd, 6 bugs gefixed — M046
- ✓ Projecttype datamodel + CRUD API (parcel_project_type entity, 6 enum values) — M047/S01
- ✓ Projecttype UX (lichtgewicht modal bij perceel-opening) — M047/S02
- ✓ Score-engine refactor: FACTOR_REGISTRY, conditionele weights per projecttype — M047/S03
- ✓ LLM-determinism infrastructure: factor_extractor.py, Anthropic tool-use, temp=0, cache-key op (parcel_id, doc_version_hash, factor_id) — M047/S04
- ✓ Re-scoring cascade ARQ job (rescore_parcels_for_document) + cascade_service — M047/S05
- ✓ POC woonvisie_match factor voor Venlo end-to-end — M047/S06
- ✓ Score UI dynamisch — potentie_risico_balance prop + percentage_of_category — M048/Phase 2
- ✓ Woonvisie kaart popup in Intelligence Grid (kaart 10 klikbaar, minimal Aura style) — M048/Phase 3
- ✓ KlimaatLayer gemeente-switch bug fix — M048/Phase 4
- ✓ Document-level cache sentinel (`parcel_id="__document__"`) — 1 Claude-call per document — M048/Phase 5
- ✓ WijkPolicy schema + per-wijk woonvisie scoring (Blerick vs Venlo-Centrum diff ≥ 0.2) — M048/Phase 6
- ✓ Factor pinning + groep-pages (max 4 per categorie, 2x2 grid, synth-page) — M048/Phase 7
- ✓ E2E smoke voor Venlo woonvisie pipeline — M048/Phase 8
- ✓ Test-corpus validation: woonvisie_match generaliseert naar Amsterdam/Rotterdam/Sittard-Geleen (confidence 0.60-0.92) — M048 bonus
- ✓ `gemeente_data_source_status` model + 27+ source-key catalog in 3 bron-types — M049/S01
- ✓ Admin API layer (`GET /api/admin/data-sources/{gemeente_code}` + refresh) superuser-gated — M049/S02
- ✓ Data Sources UX (`/instellingen/data-bronnen/{gemeente_code}`) met 3 secties + status-pills + Aura-tokens — M049/S03
- ✓ M045/S05 upload-flow integratie in nieuwe hub + legacy-route redirect-banner — M049/S04
- ✓ Encrypted `IntegrationCredential` model (Fernet + MultiFernet rotation pattern) + admin UX — M049/S05
- ✓ ActionItems pagina deprecation + content migratie naar Data-bronnen action-buttons — M049/S06

## Current Milestone: M050 BRK Actiefase-Wedge

**Goal:** Product-mode-shift van onderzoekstool → actietool. Drie-fase-funnel introduceren: Onderzoek → Actie (brief naar eigenaar) → CRM (M053+). Eerste paid Type-C integration (BRK Eigendom persistent) + AI-personalized brief-feature via PostNL master-account-model.

**Target features:**
- BRK persistent storage (rechtspersoon-only, 30/90 dgn retention) + 3 nieuwe scoring-factoren (hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend)
- Brief-template registry + AI-personalisatie via Claude streaming (Pydantic-typed, audit-logged)
- PostNL Zakelijk master-account dispatch + delivery-tracking webhooks + partner-branding-injection
- Opgeslagen-tab cockpit transformatie: full-width perceel-cards + lifecycle-sidebar (4-8 icons: Onderzoek → Exploitatie)
- Tier-gates + quota-enforcement (Demo 0/0 · Paid 25/5 · Enterprise 250/50 — Q8 LOCKED)
- M050.5 parallel: tier-decorator + quota-counter infra

**Pre-planning artifacts (2026-05-17):**
- `.planning/milestones/M050-INDEX.md` (hub)
- `.planning/milestones/M050-ENG-PLAN.md` (6 architectuur-decisions D1-D6 + datamodel + 7-lane worktree-parallelization)
- `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` (Q6 PostNL master-account · Q7 retention · Q8 quota-defaults)

### Active

- [ ] BRK datamodel + retention-life-cycle (Q7 LOCKED) + ARQ cleanup-cron — M050/S01
- [ ] BRK persist client (Phase 105 ephemeral → persist-mode) met M049 credential-resolver — M050/S02
- [ ] 3 scoring-factoren live + rescore-cascade trigger op BRK-write — M050/S03
- [ ] Brief-template registry + 3 templates + preview met perceel-context — M050/S04
- [ ] AI brief-personalisatie via Claude streaming + audit-log + partner-review verplicht (D7) — M050/S04.5
- [ ] PostNL dispatch + delivery-tracking webhooks + partner-branding-injection — M050/S05
- [ ] Admin-UX partner-branding-upload in M049-hub-stijl — M050/S05.5
- [ ] Opgeslagen-cockpit + lifecycle-sidebar transformatie (V5 wireframe LOCKED) — M050/S06
- [ ] E2E wiring + tier-gates + feature-flag triad + AVG-audit-trail — M050/S07

### Out of Scope

- B2C particulieren — Omgevingsloket (Art. 16.1 wettelijk monopolie) is gratis; wij bouwen voor professionals
- Makelaars — Brainbay/NVM bedient die markt; wij doen transformatiepotentie, niet current value
- Mobile app — Desktop-first (27" monitor, 6-8h/day target users)
- Dark mode — Out of scope, sloopt Aura Morning-Mist character
- Vergunningchecker — wettelijk voorbehouden aan Omgevingsloket
- Ground-truth kalibratie — Uitgesteld tot M058
- BRK Eigendom als M050 — eerste paid Type-C integration (overruled landscape volgorde 2026-05-17)
- NVM/Vindsubsidies betaalde integraties — M053+
- Cascade-batches buiten woonvisie_match POC — M051-M057
- Projecttype-gebonden balance / pruning sparse factoren — M050+

## Context

- **Stack:** FastAPI + SQLAlchemy 2.x + PostGIS (backend), React 18 + TanStack Query + MapLibre + Framer Motion + Tailwind v4 (frontend), ARQ (job queue), Redis (cache)
- **Design system:** Aura — DESIGN.md at repo root. Morning Mist canvas, Plus Jakarta Sans, Warm Amber accent. Two-mode: Discovery (map-first) + Build-management (data-dense).
- **Score architecture:** FACTOR_REGISTRY in score_v3_factors.py. per-category weights (potentie: _POTENTIE_MAX, risico: _RISICO_MAX). potentie_risico_balance=0.7 (developer-upside default). percentage_of_category nieuwe veld post-M047/S03.
- **LLM:** Anthropic tool-use, factor_extractor.py, cache-key (parcel_id, doc_version_hash, factor_id). SCHEMA_VERSION=1 in factor_extraction_schemas.py:114.
- **Cascade:** ARQ job rescore_parcels_for_document triggered by PolicyDocument mutation + auto_ingest. Idempotent via cache-key.
- **Tests:** 275 groen als M047-baseline (104 unit + 171 integration).

## Constraints

- **Multi-tenant:** Every query filters on organization_id — zero exceptions
- **Files:** Under 300 lines, split otherwise
- **Commit format:** M0xx/Sxx: <what>
- **Ports:** Backend 8000, Frontend 9300, DB 5434 (propdex-db), Redis 6380 (propdex-redis)
- **Validation:** `npm run check` (frontend), `ruff check . && mypy .` (backend) after every change

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| weights herverdelend (niet additief), 100 per categorie | Nieuwe factor = weight-shift op bestaande; additief escaleert totaal onbeheersbaar | ✓ Good |
| potentie_risico_balance=0.7 fixed | Developer-upside; zonder bias komen scores nooit in 70+ range voor kansrijke percelen | ✓ Good |
| percentage_of_category data-contract | Backend exposeert %, houdt gewicht voor backward-compat; frontend nooit meer raw integer | ✓ Good |
| potentie_risico_balance als frontend-prop, niet flags | flags is scan-data; balance is org-config. Prop vanuit useOrgScoreWeights hook | — Pending (M048) |
| Woonvisie popup: kaart 10 klikbaar, niet ScoreBreakdownModal rebuild | ScoreBreakdownModal rebuild te groot voor M048; popup is gericht en approved | ✓ Good |
| SCHEMA_VERSION bump na M047 | M047/S04 nieuwe extraction pipeline, S06 woonvisie_match — cache invalideren | — Pending (M048/S01) |
| Dark mode out of scope | Sloopt Morning-Mist canvas + glass-morphism die de helft van Aura's character zijn | ✓ Good |
| Mobile out of scope | 27" monitor target users, 6-8h/day use patterns require desktop density | ✓ Good |
| CARDS_PER_PAGE 4 ipv 6 (M048 Phase 7) | Steady-state factor projection wint op visuele dichtheid bij 2x2 grid | ✓ Good |
| Pin-mechanism backend-backed | localStorage skipt cross-device, backend-tabel werkt direct met TenantMixin | ✓ Good |
| Probe-tool retained voor M050+ | woonvisie_match POC bewees generalisatie; protocol gestandaardiseerd per nieuwe factor | ✓ Good |
| M049 vóór M050+ cascade-batches | Integratie-milestones hebben configuratie-UX nodig; als hub later komt → ad-hoc plekken die later refactored moeten | ✓ Good |
| M050 = BRK Eigendom-diepte ipv Vindsubsidies | BRK bredere wedge (elke ontwikkelaar wil eigendomsinfo); Vindsubsidies raakt alleen Enterprise-subset met bestaand contract — beslissing 2026-05-17 | — Pending (M050) |
| M050 PostNL master-account (Q6) | Sales-friction-eliminatie weegt zwaarder dan 5,6% cost-floor; sender-naam dynamisch per partner-branding | — Pending (M050) |
| M050 AVG retention 30/90 dgn (Q7) | Defensieve baseline; rechtspersoon-only persistent storage; Phase 105 ephemeral pad blijft voor privé-lookups | — Pending (M050) |
| M050 cockpit = pipeline-cards + workspace-sidebar | Single-column brede cards + perceel-foto thumbnail; sidebar van toplevel-icons → 4-8 lifecycle-icons (V5 wireframe LOCKED) | — Pending (M050/S06) |
| Partner = klant + reseller terminologie | Partner gebruikt product zelf EN verkoopt door; alle "klant" refs → "partner" in M050 docs 2026-05-17 | ✓ Good |

---
*Last updated: 2026-05-17 after M049 shipped + M050 milestone start*

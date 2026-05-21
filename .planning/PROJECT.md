# Propdex

## What This Is

Dutch property intelligence + management cockpit. Multi-tenant SaaS (NL/BE).

**Phased platform (strategy pivot 2026-05-18):**

| Tranche | Scope | Status |
|---------|-------|--------|
| **Tranche 1 — Onderzoekstool** (current) | Scouting → screening → due diligence → go/no-go → vergunning → bouw | Shipping (M001-M050) |
| **Tranche 2 — Actie + Beheer-tool** (planned) | Verhuur → Beheer (MJOP/verduurzaming/mutaties) → Exit (verkoop/herfinanciering) | Roadmap M060-M110 |

Tranche 1 is voor vastgoedontwikkelaars + kwaliteitsborgers. Tranche 2 voegt beleggers, makelaars (onderverhuur-flow), eigenaren en VvE-beheerders toe als target users — terwijl de intelligence-laag (transformation potential, scoring, cascade-docs) door alle fases heen zichtbaar blijft. **One platform, intelligence-first.**

## Core Value

**Tranche 1:** Van grondpositie tot first spade in één cockpit — no switching between 10 tabs.

**Tranche 2 (toegevoegd 2026-05-18):** Pand blijft in Propdex tot aan exit. Beheer-flow inherits intelligence-context (scoring, BRK, scan-data) die concurrenten niet hebben — Twinq/Vastgoedpro doen beheer maar zonder transformatie-data; Calcasa/Matrixian doen waarde maar zonder operationele flow.

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
- ✓ BRK Eigendom persistent storage (rechtspersoon-only, 30/90 dgn AVG-retention + cron) — eerste paid Type-C — M050/S01-S02
- ✓ 3 BRK scoring-factoren (hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend) + BRK-write→rescore cascade — M050/S03
- ✓ Opgeslagen-cockpit + LifecycleSideRailNav (scoped to perceel-detail) op Aura-tokens — M050/S06
- ✓ Lifecycle fase-2 (Contact) als BRK-home: `GET /api/parcels/{id}/brk` + RescoreProgressBanner + 1922-LOC monoliet → 7 componenten — M050/S06-cont

## Current Milestone: M052 Hauzer Engagement-Demo

**Goal:** Sprong van System-of-Record (data) → System-of-Engagement (dagelijkse werkplek). De engagement-laag — het kernproduct verkoopbaar aan elke makelaar — bouwen **in productie** op echte Venlo-data, met dunne demo-shims voor de Hauzer-pitch. Hauzer & Partners (Venlo) = beoogde launching-partner (nog NIET gepitcht; demo-first). Doel: Hauzer overtuigen dat dit hun dagelijkse acquisitie-hub wordt.

**Aanpak (BESLIST 2026-05-21):** In productie bouwen, niet wegwerp. ~80% is echt kernproduct (Kanban/Haalbaarheid/kavelzoeker/projecttype) dat je sowieso wilt. Demo-isolatie via **demo-org seed + feature-flags** (`HAUZER_DEMO`). Alleen Hauzer-API-afhankelijke features (Realworks-matcher, nieuwbouw-matcher) blijven puur mock tot na de deal — die kun je sowieso niet speculatief bouwen. Zo blijft de office-hours "geen speculatieve verbranding"-discipline intact zonder dubbel werk.

**Target features:**
- `projecttype`-veld op `ParcelFavorite` + "opslaan-op-zoekmethode" (stuurt M047-scoring + welke Haalbaarheid-checklist verschijnt)
- Per-perceel 4-fase acquisitie-arc: Onderzoek → Contact → **Haalbaarheid** (9e fase, additief in phases.ts) → Bod; checklist-verhuizing Onderzoek→Haalbaarheid; `LifecycleSideRailNav` configureerbaar (Hauzer-set)
- Dashboard-landing (werkdag-cockpit): Pipeline Kanban (ECHT, `pipeline_stage` + drag) + Daily Acquisitie Inbox (mock-items, upgradebaar)
- Kaart: built-to-suit kavelzoeker-filter (ECHT, >10.000m² + Logistiek/Industrie + leeg) · Nieuwbouw-verkoop matcher (mock surface)
- Demo-org seed (5-7 favorites in stages + mock inbox) + DESIGN.md makelaars-correctie

**Demo real-vs-mock:** 4 schermen volledig echt · 1 echt-data-fake-write (Contact: BRK echt, PostNL-send gefaket) · 3 mock (Inbox upgradebaar · nieuwbouw-matcher + Realworks gated op Hauzer-API).

**Pre-planning artifacts (2026-05-21):**
- `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260521-135656.md` — office-hours strategie (System-of-Engagement + deal-structuur)
- `docs/superpowers/specs/2026-05-21-hauzer-engagement-ia-demo-design.md` — IA + demo real-vs-mock + component-touchpoints (codebase-geverifieerd)

### Active

- [ ] `projecttype` op `ParcelFavorite` + opslaan-op-zoekmethode UI — M052
- [ ] `Haalbaarheid`-fase (phases.ts additief) + `HaalbaarheidPhaseView` + checklist-verhuizing — M052
- [ ] `LifecycleSideRailNav` configureerbaar (Hauzer 4-fase set) + Bod mock-light — M052
- [ ] Dashboard Pipeline Kanban (echt, `pipeline_stage` + drag→update_pipeline) — M052
- [ ] Daily Acquisitie Inbox surface (mock-items achter `HAUZER_DEMO`) — M052
- [ ] Built-to-suit kavelzoeker-filter op Kaart (echt) — M052
- [ ] Nieuwbouw-verkoop matcher (mock surface achter `HAUZER_DEMO`) — M052
- [ ] Demo-org seed + DESIGN.md makelaars-correctie — M052
- [ ] Forward-roadmap reconciliatie (3 sporen + cascade-batch her-nummering) — M052 setup

### Defined / gated (nog te doen — niet gedropt)

Deze milestones zijn volledig gedefinieerd (requirements + roadmap in `.planning/milestones/`) maar nog niet gestart. Ze blijven actieve scope; M052 gaat vóór omdat de demo demand moet valideren vóór verdere investering.

- **M051 Brief-Send Pipeline** (defined 2026-05-19, gated op Kadaster-DPA + PostNL Zakelijk legal-track) — eigenaar-outreach na BRK: 3 templates + Claude AI-personalisatie + PostNL-dispatch + partner-branding + tier-gate triad + AVG-audit. 23 reqs, 5 phases. **Grote Hauzer-pré:** de "Verstuur Brief"-knop is engagement-feature #3. In M052 zit dit als echt-data-fake-write (Contact-fase: brief-preview echt, send gefaket) — de demo-teaser; M051 maakt het post-deal productie. Docs: `.planning/milestones/M051-INDEX.md` / `-REQUIREMENTS.md` / `-ROADMAP.md`.
- **M050.5 Feature Tiering & Demo Lockdown** (defined 2026-05-16, parallel-runnable) — org-level tiers (demo/paid/superadmin), backend-enforced + `<TierGate>`. 36 reqs, 4 phases. Relevant voor M052: het lange-termijn-alternatief voor de `HAUZER_DEMO`-flag-aanpak; M052 gebruikt flags nu, tiering kan later de gating overnemen. Docs: `.planning/milestones/M050.5-REQUIREMENTS.md` / `-ROADMAP.md`.

### Out of Scope

- B2C particulieren — Omgevingsloket (Art. 16.1 wettelijk monopolie) is gratis; wij bouwen voor professionals
- ~~Makelaars — Brainbay/NVM bedient die markt; wij doen transformatiepotentie, niet current value~~ **REVISED 2026-05-18**: makelaars (i.h.b. onderverhuur-workflow) zijn target-users binnen **Tranche 2** (M090 Verhuur-milestone). Brainbay/NVM blijven concurrenten op pure transactie-CRM; Propdex's wedge in dit segment = intelligence-context vanuit Tranche 1 (eigendom, scoring, beleid) gekoppeld aan operationele flow.
- Mobile app — Desktop-first (27" monitor, 6-8h/day target users)
- Dark mode — Out of scope, sloopt Aura Morning-Mist character
- Vergunningchecker — wettelijk voorbehouden aan Omgevingsloket
- Ground-truth kalibratie — Uitgesteld tot M058
- BRK Eigendom als M050 — eerste paid Type-C integration (overruled landscape volgorde 2026-05-17)
- NVM/Vindsubsidies betaalde integraties — M053+
- Cascade-batches buiten woonvisie_match POC — M051-M057
- Projecttype-gebonden balance / pruning sparse factoren — M050+
- **M052 demo-scope:** echte PostNL-dispatch + echte Realworks-koppeling + nieuwbouw-matcher-logica blijven mock — vereisen Hauzer's API-toegang, post-deal (€16.6k consulting)
- **M052:** erfpacht-einddatum-radar — BRK Bevragen is overheid-only, geen bulk-query voor private SaaS; reframe als manueel/partnership-registry (later), per-perceel `zakelijk_recht_type`-flag wél
- **M052:** Tranche-2-fases (Vergunning→Exit) + Verhuur-surface — buiten Hauzer's voorkant-product (makelaardij/advies/verkoop)

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
| **Tranche 2 pivot 2026-05-18** | Propdex evolueert van onderzoekstool naar onderzoek + actie + beheer platform. Verhuur/Beheer/Exit toegevoegd als M060-M110 milestones, parallel-able per dev-team. Lifecycle-sidebar van 6 → 8 fases. Makelaars + beleggers + eigenaren toegevoegd als target users (was: out-of-scope). One-way door — locked. | — Pending (M060+) |
| **System-of-Engagement pivot 2026-05-21** | Van System-of-Record (data, eenmalig waardevol) → System-of-Engagement (dagelijkse werkplek, retentie). Engagement-laag (5 features) = kernproduct voor elke makelaar. Hauzer = beoogde launching-partner (demo-first, nog niet gepitcht). Vervangt het angel-spoor; oude 50%-dev-partner-deal afgeketst. | — Pending (M052) |
| **M052 in productie bouwen, niet wegwerp-demo** | Engagement-laag = kernproduct dat je sowieso wilt; wegwerp-demo = dubbel werk. Echt product in productie achter feature-flags; demo-isolatie via demo-org seed + `HAUZER_DEMO`-flag; alleen Hauzer-API-features (Realworks/nieuwbouw-matcher) puur mock. Speculatieve-burn-discipline blijft want het Hauzer-specifieke deel blijft ongebouwd. | — Pending (M052) |
| **M052 Haalbaarheid als 9e fase** | Additief in phases.ts (geen verwijdering) + per-use-case filtering — 8-fase Tranche-2-visie blijft intact. Checklists verhuizen Onderzoek→Haalbaarheid, gedreven door parcel-`projecttype` i.p.v. report_id-koppeling. | — Pending (M052) |

---
*Last updated: 2026-05-21 — M052 Hauzer Engagement-Demo (System-of-Engagement pivot, build-in-production)*

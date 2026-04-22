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

### Active

- [ ] Score UI dynamisch (percentage_of_category ipv hardcoded 60/40 + ×{gewicht}) — M048
- [ ] potentie_risico_balance als prop in ScoreBreakdownModal vanuit org-profiel — M048
- [ ] Woonvisie kaart popup in Intelligence Grid (kaart 10 klikbaar) — M048
- [ ] SCHEMA_VERSION bump 1→2 voor cache-invalidatie na M047 — M048
- [ ] KlimaatLayer gemeente-verdict bug fix — M048

### Out of Scope

- B2C particulieren — Omgevingsloket (Art. 16.1 wettelijk monopolie) is gratis; wij bouwen voor professionals
- Makelaars — Brainbay/NVM bedient die markt; wij doen transformatiepotentie, niet current value
- Mobile app — Desktop-first (27" monitor, 6-8h/day target users)
- Dark mode — Out of scope, sloopt Aura Morning-Mist character
- Vergunningchecker — wettelijk voorbehouden aan Omgevingsloket
- Ground-truth kalibratie — Uitgesteld tot M058
- BRK/NVM/Vindsubsidies betaalde integraties — M051/M052/M053
- Cascade-batches buiten woonvisie_match POC — M050-M057
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

---
*Last updated: 2026-04-22 after M047 shipped + M048 milestone start*

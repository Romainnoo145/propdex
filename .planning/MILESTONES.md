# Milestones

## M049 Data Sources per Gemeente hub (Shipped: 2026-05-17)

**Phases completed:** 10 phases, 23 plans, 7 tasks

**Key accomplishments:**
- (none recorded)

---

## 🆕 M050.5 Feature Tiering & Demo Lockdown (Defined 2026-05-16 — parallel-runnable)

**Status:** Defined, niet gestart. Parallel-runnable met M049 + M050 via separate `.planning/milestones/M050.5-*` paths (geen clobber van M049's active `.planning/REQUIREMENTS.md`/`.planning/ROADMAP.md`).

**Scope:** 3 product-tiers (`demo` / `paid` / `superadmin`). Demo ziet 1 gemeente (Venlo) + totaalscore + factor-namen. Eigendom, marktsignalen, opportunities, building metrics, subsidies, jurisprudentie, rapporten, favorieten, custom-profiel, document-upload allemaal achter Pro-badge gate. Backend-enforced (403/redact) + frontend `<TierGate>` wrapper.

**Driver:** Phase 04.2 dichtte alleen `score_breakdown`. De échte exposure is dat demo-users de hele feature-surface zien — blueprint-risico. M050.5 maakt demo een trailer.

**Locked decisions (2026-05-16):**
- Tier is org-level enum (`demo` / `paid` / `superadmin`), niet per-user
- Bestaande orgs met superuser → `superadmin` via migratie, anderen → `demo`; paid handmatig
- Demo gemeente = Venlo (GM0983)
- Geen self-service upgrade flow in v1 (mailto:info@klarifai.nl)
- Geen Stripe/payment-integratie (I-01 staat apart)

**Coordination:** Na Phase 1 (tier-infra) landing → notify M050-agent dat Vindsubsidies-feature met `requires_tier("paid")` ingebakken kan worden. Voorkomt rework.

**Artifacts:**
- `.planning/milestones/M050.5-REQUIREMENTS.md` — 36 requirements (TIER/API/UI/TEST/MIG)
- `.planning/milestones/M050.5-ROADMAP.md` — 4 phases (Foundation → Backend ∥ Frontend → Verify)

---

## 🚧 M049 Data Sources per Gemeente hub (In Progress — kickoff 2026-05-14)

**Status:** Phases 1-4 + 04.1 shipped (15 plans). Phase 5 (Encrypted Credentials) eng-reviewed 2026-05-16 — ready for plan. Phase 6 (ActionItems Deprecation) parallel-eligible met P5.

**Scope:** Vendor-managed credentials infrastructure + admin data-sources UX hub per gemeente. Replaces oude ActionItems pagina met data-bronnen rijen die status (live/missing/expired) tonen per gemeente. Type-A (cascade uploads), Type-B (open APIs), Type-C (paid integrations zoals BRK/Vindsubsidies/NVM met encrypted credentials via Fernet).

**Locked decisions:**
- 2026-05-14: Vendor-managed credentials (geen TenantMixin) — match pricing-tier model uit partner-briefing (€299/€699/€1.249), BYOK future enterprise-feature
- 2026-05-14: `IntegrationCredential` klassenaam, `integration_credentials` tabel, UQ op (source_key, credential_name)
- 2026-05-16: MultiFernet rotation pattern (rolling-deploy compatible), generic audit_log tabel (Phase 5 = first emitter), vast credential_name enum per source_key via CREDENTIAL_FIELDS registry

---

## v1.48 Score v4.0 Frontend Scaling (Shipped: 2026-05-13)

**Phases completed:** 8 phases, 17 plans, 9 tasks

**Key accomplishments:**
- (none recorded)

---

## M046 Scoring Fundament Opgeschoond (Shipped: 2026-04-20)

**Status:** ✅ Complete — 6/6 slices shipped in 2 dagen (kickoff 2026-04-19, ship 2026-04-20)

**Scope:** 58 scoregewicht opgeschoond op Score v3.0. Bug-fix rigor; geen schema-wijziging (Alembic head `bbdb5c6ff811` unchanged).

**Slices shipped:**
- **S01** RM-1 — `vergunning_succeskans` dev-type filter (gewicht 21). Jurisprudence-aggregator filtert nu op nieuwbouw/sloop/bestemmingswijziging/uitbreiding; dakkapellen/milieu-bezwaren verwateren de succeskans niet meer.
- **S02** BUG-2 — `vrije_grond` shape-ratio guard (gewicht 12). Strook/wegvormige percelen (perimeter/sqrt(area)>10) krijgen geen valse "100% vrije grond" meer.
- **S03** SNF-4 — `funda_frictie` narrative eerlijk over pilot-state (gewicht 5, capped).
- **S04** BUG-1 — `_best_bestemming_type` count-voting + priority tie-breaker (gewicht 20 via `segment_match` + `bestemmingswijziging`). Mixed parcels [verkeer, verkeer-verblijf, wonen] worden nu correct als "verkeer" geclassificeerd ipv optimistisch "wonen".
- **S05** BUG-3 — `score_monument` via RCE-register wire-up. RCE-client + aggregator bestonden al; area_scan pipeline roept ze nu aan. Keyword-match blijft fallback bij API-down. ⚠ Operational blocker: `api.rijksmonumenten.info` 403 — feature-benefit gerealiseerd zodra API-access geregeld.
- **S06** OBS-2 — Frontend eerlijkheid: missing-data badge (>2 factoren ontbreken → "Beperkte data" pill naast parcel_code), expandable FactorCards in ScoreBreakdownModal met S01/S03 metadata inline, sage-mint wijk-breed tag voor CBS-factoren. Plus post-plan backend patches (F1: `FactorResult` S01-velden, F3: `primary_bestemming_type` exposed → sluit S04 UI-parity gap).

**Key numbers:**
- 6 PRs gemerged (#2-7) naar main
- 171 backend score_v3 + iron-rule tests groen (was 163 pre-M046)
- 63760 scan_results re-computed via `backfill_scan_scores_v3.py` — nieuwe narratives + S04 count-voting + S06 F1 velden live in productie
- Alembic head unchanged

**Pre-M046 beslissingen (2026-04-19 locked):**
- F1 scope-expansion split per-milestone (niet bulk vooraf)
- I-01 infrastructuur gesplitst (mailserver eerst, OAuth+Stripe laatst)
- Ground-truth skip tot M058

**Open tech-debt:**
- S05 RCE API 403 blocker (`.planning/todos/pending/2026-04-20-s05-rce-api-403-access-blocker.md`) — 4 oplossingsrichtingen geïdentificeerd
- Scoring-weights-recalibration (pre-M047 herijking van gewichten + drempels op historische distributie)
- KlimaatLayer gemeente-verdict bug (M048 Frontend Scaling)

**Roadmap-artefact:** `~/.gsd/projects/0fbd70b53f1b/milestones/M046/M046-ROADMAP.md` + slice-folders met CONTEXT/PLAN/TESTS per slice

---

## M045 Unified Document Model (Shipped: 2026-04-18)

**Phases completed:** 0 phases, 0 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---


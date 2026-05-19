# Milestones

## 🆕 M051 Brief-Send Pipeline (Defined 2026-05-19 — split from M050)

**Status:** Defined, niet gestart. Kickoff gated op (a) Kadaster DPA progress (M050 BRK persist dormant tot DPA), (b) PostNL Zakelijk legal-track (~4 wk lead-time), (c) M050.5/S02 quota-counter merged.

**Scope:** Eigenaar-outreach pipeline na BRK lookup — templates (cold-outreach / follow-up / verkenning) + Claude streaming AI-personalisatie (D1+D6+D7) + PostNL Zakelijk dispatch (atomic quota D2 + webhook idempotency D3) + partner-branding admin (logo/voettekst/font/bedrijfsnaam) + tier-gate triad (D4) + AVG-audit trail.

**Origin:** Losgekoppeld van M050 BRK Actiefase-Wedge na milestone-audit op 2026-05-19. M050 shipte alleen BRK lookup-helft (5/10 phases, 22/45 reqs); brief-send-actie-helft (23 reqs) hier opnieuw neergezet als M051. Architectuur-decisions D1-D7 + Q6/Q8 LOCKED uit `M050-ENG-PLAN.md` blijven authoritative.

**Artifacts:**
- `.planning/milestones/M051-INDEX.md` (hub-doc + origin + dependencies + kickoff-checklist)
- `.planning/milestones/M051-ROADMAP.md` — 5 phases (Brief-Template → AI → PostNL → Partner-Branding → Wiring+Tier-Gates)
- `.planning/milestones/M051-REQUIREMENTS.md` — 23 requirements

**Volgende stap:** Verwerkersovereenkomst-track Kadaster bevestigen → bij DPA-signed kickoff `/gsd:new-milestone M051` en `/gsd:plan-phase 1` (= M051/S01 Brief-Template).

---

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

**Coordination:** Na Phase 1 (tier-infra) landing → notify M050-agent dat BRK-actiefase-feature met `requires_tier("paid")` ingebakken kan worden. Voorkomt rework. *(2026-05-17: M050 pivot van Vindsubsidies naar BRK Actiefase-Wedge — Vindsubsidies schuift naar later, BRK heeft bredere wedge.)*

**Artifacts:**
- `.planning/milestones/M050.5-REQUIREMENTS.md` — 36 requirements (TIER/API/UI/TEST/MIG)
- `.planning/milestones/M050.5-ROADMAP.md` — 4 phases (Foundation → Backend ∥ Frontend → Verify)

---

## ✅ M050 BRK Lookup-Wedge (Shipped 2026-05-19, awaiting archive)

**Status:** Lookup-helft COMPLETE — 5/5 phases shipped + verified passed. Re-scoped 2026-05-19 (was "BRK Actiefase-Wedge" met 10 phases — brief-send-helft losgekoppeld als M051). Audit-rapport: `.planning/vM050-MILESTONE-AUDIT.md`. Awaiting `/gsd:complete-milestone` na audit-re-run op rescoped scope.

**Shipped (5 phases, 22 plans, 22 requirements):**
- ✓ Phase 1 BRK Datamodel + Retention (S01) — 2026-05-18 · 9/9 must-haves
- ✓ Phase 2 BRK Fetch+Persist Endpoint (S02) — 2026-05-18 · 25/25 must-haves
- ✓ Phase 3 Scoring-Factoren Cascade (S03) — 2026-05-18 · 4/4 backend + 1 human-QA deferred
- ✓ Phase 6 Opgeslagen-Cockpit + LifecycleSideRailNav (S06) — 2026-05-18 · 5/5 must-haves, M048 regression-free
- ✓ Phase 8 BRK Fase-2 Wire-up (S06-cont) — 2026-05-19 · 7/7 must-haves, DEF-01 resolved (backend schema field for cascade_rescored_at)

**Moved to M051 (Brief-Send Pipeline) on 2026-05-19:**
- Phases 4, 4.5, 5, 5.5, 7 (brief-templates / AI / PostNL / branding / wiring+tier-gates)
- 23 requirements (BRIEF-01..03, AI-01..04, POST-01..05, BRAND-01..03, WIRE-01..03, TEST-04..08)

**Active / Locked:**
- ◆ S01 BRK Datamodel + Retention — eng-plan locked 2026-05-18 (`.planning/milestones/M050-S01-ENG-PLAN.md`). Ready for /gsd:plan-phase.

**S01 locked decisions (2026-05-18):**
- D1 Tier 3 conflict: feature-flag `M050_BRK_PERSIST_ENABLED=false` + DB CHECK `eigenaar_type IN (rechtspersoon, overheid)`
- D2 `raw_brk_response` JSONB: strip-at-write redact natuurlijke personen
- D3 Soft-delete: service-layer primary + cron safety-net for orphans
- D4 Feature-flag scope: write-path only (read-path werkt, schema bestaat altijd)
- D5 UNIQUE (org, parcel, fetched_at): historie bewust (voedt S03 koopwaarde_trend)
- D6 Observability: structured-log + Sentry alert >1000 deletes/run
- D7 Service-file naming: `brk_persistence_service.py` (matcht milestone-plan, geen split)
- D8 `eigenaar_naam` nullability: TEXT NULL + service-layer reject NULL bij rechtspersoon
- Migration naming: vanaf S01 date-based prefix (`YYYYMMDD_*`), oude prefixes blijven ongerenamed

**Pivot 2026-05-17:** M050 was Vindsubsidies (per landscape-doc 20260418). Vervangen door BRK Actiefase-Wedge omdat BRK bredere wedge heeft (elke ontwikkelaar wil eigendomsinfo per perceel; Vindsubsidies raakt alleen Enterprise-tier subset met bestaand contract). Vindsubsidies schuift naar latere milestone.

**Karakter:** Product-mode-shift — eerste brug van onderzoekstool naar actietool. BRK = middel (eigenaar + hypotheek-lookup), brief sturen via PostNL Zakelijk = doel. 3 scoring-factoren landen mee (potentie moet kloppen vóór actie kan).

**Scope (8 slices + 2 M050.5-slices parallel):** BRK persistent datamodel + AVG retention · BRK client persist-mode · 3 scoring-factoren (hypotheek_risico, eigendoms_complexiteit, koopwaarde-trend) · brief-template registry (3 templates) · PostNL Zakelijk API + async verzend-job + tracking · opgeslagen-tab stappenplan-cockpit · E2E integratie · admin-UX quota-monitoring. ~8-12 wk realistisch.

**Locked decisions (2026-05-17, zie `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md`):**
- Q6 PostNL business-model: Propdex master-account, resell via quota (Optie A)
- Q7 AVG retention: 30 dgn soft → 90 dgn hard delete; 7 jr brief-tracking; rechtspersoon-only persistent
- Q8 Quota-defaults: Demo 0/0 · Paid 25 BRK + 5 brieven · Enterprise 250/50 · soft 80% hard 100% · reset 1e van maand UTC · geen overage in M050

**Day-1 wall-time-blockers:**
- PostNL Zakelijk contract-onboarding starten (sandbox-credentials, sender-identity, batch-tarief)
- Kadaster verwerkersovereenkomst (DPA) traject — 4-8 wk legal, vereist voor production-BRK
- Privacy Officer review verwerkersovereenkomst-template
- Pre-sale klant volume-validatie + week 8-12 first-live-user commitment

**Scope-expansion (CEO-review 2026-05-17, mode = SELECTIVE EXPANSION):**
- E1 ACCEPTED: AI-personalisatie via Claude in S04.5 (klant-review verplicht per D7)
- E3 ACCEPTED: brief-preview met perceel-context in S04
- E5 ACCEPTED: klant-branding-upload (logo/voettekst/font) in S05+S05.5
- E7 DEFERRED: S08 admin-UX quota-monitoring → M052, vervangen door CLI/Postgres-snippets
- D6 ACCEPTED: PostNL SPOF risk in v1 (geen graceful-degrade-dev, document SLA + incident-protocol)
- D7 ACCEPTED: AI brief-governance pattern (structured-context + klant-review + audit-log)
- Netto timeline: 9-13 wk (was 8-12)

**Artifacts:**
- `.planning/ROADMAP.md` — 9 phases + dependencies + worktree-parallelization
- `.planning/REQUIREMENTS.md` — 39 REQ-IDs (BRK/SCOR/BRIEF/AI/POST/BRAND/UX/WIRE/TEST) + traceability table
- `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260517-131317.md` — `/gstack:office-hours` design-doc (APPROVED)
- `~/.gstack/projects/Romainnoo145-propdex/ceo-plans/2026-05-17-m050-brk-actiefase.md` — `/plan-ceo-review` CEO-plan (ACTIVE)
- `.planning/milestones/M050-ENG-PLAN.md` — `/plan-eng-review` (D1-D6 architectuur-decisions + datamodel + failure-modes registry)
- `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md` — Q6/Q7/Q8 locked + cost-basis research
- `.planning/milestones/M050-INDEX.md` — hub van alle M050-related docs
- `.planning/PARTNER-GESPREK-M050-2026-05-17.md` — partner-discussion items (terminologie-fix klant → partner gedaan 2026-05-17)

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


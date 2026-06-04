# Milestones

## M052 Hauzer Engagement-Demo (Shipped: 2026-06-04)

**Slices:** S01-S04 + S06 afgerond, S05 geschrapt. Gebouwd via superpowers (geen GSD phase-dirs). Merge `df068de4`.

**Key accomplishments:**
- System-of-Engagement-laag op echte Venlo-data: per-perceel acquisitie-arc (Onderzoek → Contact → **Voorbereiding** → Bod) met de projecttype-gedreven checklist in de nieuwe `3-voorbereiding`-fase (9-fase lifecycle, additief)
- **Contact brief-teaser**: A4-brief uit `document_generator` + echte BRK-rechtspersoon-eigenaar, briefhoofd uit org-afzendervelden, fake-send via `BriefDispatcher`-interface (M051-naad, metadata-only, gated op `hauzer_demo`)
- **Dashboard twee-signalen acquisitie-radar** (S03): gemeentesignalen + off-market kansen + pijplijn-voetnoot op echte data; cockpit-navigatie bedraad
- **WOZ-Waardeloket** in de Contact eigenaar-card (€614k indicatief) + 4-tegel grid (eigendomsvorm/hypotheek/koopsom/WOZ); BRK-privacy-note
- **Hauzer demo-org seed** (`info@hauzer.nl`, `hauzer_demo`): 6 gescoorde Venlo-percelen over pijplijn-stages + projecttypes + 6 rechtspersoon-BRK-records + volledige rapporten
- Twee pre-existing M050-routingbugs gefixt (parcel `$phase` Outlet-split + LifecycleSideRailNav hardcoded-`/opgeslagen`-links) — exposeerden de lifecycle-fase-navigatie

**⚠️ Prod-deploy:** main → prod deployt de code; de demo-DATA vereist op prod: `alembic upgrade head` (afzender + brief_dispatches migraties) + `python -m app.tools.seed_hauzer_demo` + rapport-generatie per demo-perceel (`POST /api/reports/from-parcel`). WOZ-Waardeloket is `low_confidence` (publiek/indicatief, niet autoritatief WOZ-Bevragen).

**Caveats:** rapport-generatie + WOZ-cache nu via one-off endpoint-calls (niet in de seed gebakken — runtime-deps); seed-reproduceerbaarheid van rapporten = open follow-up.

---

## M050 BRK Lookup-Wedge (Shipped: 2026-05-21)

**Phases completed:** 5 phases (1, 2, 3, 6, 8), 22 plans

**Key accomplishments:**
- BRK Eigendom as first paid Type-C integration: persistent `brk_ownership_records` with AVG-compliant soft→hard-delete retention cron (Q7 LOCKED) + DB-layer natuurlijk-persoon strip-at-write
- Vendor-managed credential resolver + read-through cache fetch/persist endpoint with full Kadaster failure-mode→HTTP registry (BRK-04/05)
- 3 BRK-driven score-v3 risico factors (hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend) with BRK-write→rescore cascade + sparse-data silent-neutral; FACTOR_REGISTRY sum=100 invariant preserved
- Opgeslagen-cockpit transformation: full-width perceel-cards + lifecycle SideRailNav (scoped to perceel-detail) on Aura tokens
- Lifecycle fase-2 (Contact) activated as BRK-home: new `GET /api/parcels/{id}/brk` read endpoint, RescoreProgressBanner, 1922-LOC monolith split into 7 ≤300-LOC components
- Multi-tenant isolation proven at every layer; whole BRK path ships dormant behind feature flags (gated on Kadaster DPA)

**Audit:** rescoped re-audit found + closed one cross-phase seam (SCOR-02/UX-07 freshness signal, `fix(03)` 52add70a). Final: 22/22 requirements satisfied. See `milestones/M050-MILESTONE-AUDIT.md`.

**Split:** original "BRK Actiefase-Wedge" scope; brief-send half split to M051 (see `milestones/M050-MILESTONE-AUDIT-PRESPLIT.md`).

---

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


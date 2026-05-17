# M050 BRK Actiefase-Wedge — Index

**Status:** Defined 2026-05-17 (pre-planning compleet, niet gestart)
**Karakter:** Product-mode-shift — eerste brug van onderzoekstool naar actietool
**Realistische duur:** 8-12 wk + parallel M050.5

Dit doc is de hub van alle M050-related artifacts. Wijzig dit doc als artifacts erbij komen.

---

## Strategische context

- **Pivot 2026-05-17:** M050 was Vindsubsidies (per landscape-doc 20260418), is nu BRK Actiefase-Wedge. Reden: BRK heeft bredere wedge (elke ontwikkelaar wil eigendomsinfo per perceel), Vindsubsidies raakt alleen Enterprise-subset met bestaand contract. Beslissing user: 2026-05-17.
- **Eén-regel-pitch:** *"Actiegericht werken kan pas als vooronderzoek klopt."*
- **Drie-fase-funnel die M050 introduceert:** Onderzoek (huidig) → Actie (M050 — brief naar eigenaar) → CRM (toekomstig, M053+)

---

## Locked decisions (2026-05-17)

| # | Decision | Locked waarde |
|---|---|---|
| Q6 | PostNL business-model | Propdex master-account, resell via quota |
| Q7 | AVG retention/deletion | 30 dgn soft → 90 dgn hard; 7 jr brief-tracking; rechtspersoon-only persistent |
| Q8 | Quota-defaults per tier | Demo 0/0 · Paid 25/5 · Enterprise 250/50 · reset 1e v/d maand UTC · soft 80% hard 100% · geen overage in M050 |

Volledig in: `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md`

---

## Artifacts

### Design + planning
- **Design-doc (APPROVED):** `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260517-131317.md`
  - Output van `/gstack:office-hours` 2026-05-17. Premissen, 4 alternatieven, chosen approach B (parallel met M050.5), reviewer-bevindingen ingewerkt, signal-reflectie.
- **CEO-plan (ACTIVE):** `~/.gstack/projects/Romainnoo145-propdex/ceo-plans/2026-05-17-m050-brk-actiefase.md`
  - Output van `/plan-ceo-review` 2026-05-17. Mode = SELECTIVE EXPANSION. 4 cherry-picks (E1/E3/E5 accepted, E7 deferred). 2 CEO-level risk-decisions (D6 PostNL-SPOF accept, D7 AI brief-governance pattern).
- **Eng-plan (LOCKED 2026-05-17):** `.planning/milestones/M050-ENG-PLAN.md`
  - Output van `/plan-eng-review` 2026-05-17. 6 architectuur-decisions (D1-D6), datamodel SQL, service-layer architectuur, ASCII data-flow diagrams, failure-modes registry, worktree parallelization (7 lanes), test coverage diagram.
- **Design-review artifacts (2026-05-17):** `~/.gstack/projects/Romainnoo145-propdex/designs/m050-stappenplan-cockpit-20260517/`
  - V5 wireframe = canoniek mental model: /opgeslagen blijft bestaand layout met FULL-WIDTH perceel-cards (+ perceel-image thumbnail). Click → bestaande perceel-detail page. Linker sidebar TRANSFORMEERT: toplevel-icons → 4-8 lifecycle-icons (1. Onderzoek t/m 6. Exploitatie). "1. Onderzoek" = bestaande detail-page content + M050 brief-sturen + BRK-persistent. Sidebar-design-polish + exacte lifecycle-icon-keuze deferred naar implementatie (M050/S06).
- **Test plan:** `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-eng-review-test-plan-20260517-182527.md`
  - Affected routes/pages, key interactions, edge cases, critical paths, AI hallucination eval-set spec, regression tests.
- **Pre-planning decisions:** `.planning/milestones/M050-DECISIONS-PRE-PLANNING.md`
  - Q6/Q7/Q8 met LOCKED-status + research-cost-basis (Kadaster + PostNL tariefs)
- **Index (dit doc):** `.planning/milestones/M050-INDEX.md`

### Partner + commercie
- **Partner-gesprek-talking-points:** `.planning/PARTNER-GESPREK-M050-2026-05-17.md`
  - Wat te bespreken met partner + pre-sale partner vóór `/gsd:new-milestone M050`. Bevat checklist.

### Parallel milestone
- **M050.5 (Feature Tiering + quota-infra):** `.planning/milestones/M050.5-REQUIREMENTS.md` + `.planning/milestones/M050.5-ROADMAP.md`
  - Critical-path parallel met M050. Coordination: M050.5 Phase 1 landt vóór M050/S05+ kan tier-gate ingebakken bouwen.

### Roadmap-context
- **MILESTONES.md entry:** `.planning/MILESTONES.md` §M050 BRK Actiefase-Wedge
- **Landscape-doc (overruled volgorde):** `~/.gstack/projects/Romainnoo145-propdex/complete-milestone-landscape-20260418.md` §M050 (had Juridisch klimaat, nu BRK)

---

## Slice-breakdown (preliminair — definitief in `/gsd:new-milestone M050`)

**M050.5 workstream (parallel, ~3-4 wk):**
- S01 — Tier-model + `requires_tier()` decorator + middleware
- S02 — Quota-counter per source-key per org + monthly reset job + soft/hard-cap policy

**M050 workstream (~9-13 wk, na CEO-review SELECTIVE EXPANSION):**
- S01 — BRK persistent datamodel + Alembic migratie + retention-policy + deletion-trigger
- S02 — BRK client uitbreiding: persist-mode bovenop Phase 105 ephemeral lookup, met M049 credential-resolver. *Blokt S03.*
- S03 — 3 scoring-factoren live: hypotheek_risico, eigendoms_complexiteit, koopwaarde-trend. *Depends on S02. Sparse-data fallback inclusief.*
- S04 — Brief-template registry + 3 templates + variabele-substitutie **+ brief-preview met perceel-context (E3 accepted)**
- **S04.5 — AI-personalisatie via Claude (E1 accepted):** structured-context input + sanitized eigenaar-name + partner-review verplicht + audit-log. Hallucination contained per D7 governance.
- S05 — PostNL Zakelijk API client + async verzend-job + delivery-tracking webhooks **+ partner-branding-injection (E5 accepted: logo/voettekst/font per org)**. SPOF accepted per D6 — geen graceful-degrade in v1.
- S05.5 — Admin-UX partner-branding-upload in M049-hub-stijl (E5 deel 2)
- S06 — Opgeslagen-tab stappenplan-cockpit: status-states + Aura-conform UI. *Pre-start: confirm M048-coordination.*
- S07 — End-to-end integratie + wiring (geen nieuwe feature-code)
- ~~S08 admin-UX quota-monitoring~~ → **DEFER M052 (E7 accepted).** S08 wordt: CLI-script + Postgres-query-snippets in `.planning/M050-OPS-RUNBOOK.md`

---

## Day-1 wall-time-blockers (start NU, niet bij milestone-kickoff)

1. **PostNL Zakelijk contract-onboarding** — vragenset in `M050-DECISIONS-PRE-PLANNING.md` §Q6-vervolgactie
2. **Kadaster verwerkersovereenkomst (DPA)** — 4-8 wk legal-track voor production-BRK persistent storage
3. **Privacy Officer / legal-advisor review verwerkersovereenkomst-template** — Propdex ↔ partner chain
4. **Pre-sale partner commitment** — week 8-12 first-live-user + volume-validatie

Voor partner-gesprek: zie `.planning/PARTNER-GESPREK-M050-2026-05-17.md`.

---

## Open items (niet milestone-blokker, uitwerken tijdens slice-planning)

Zie design-doc §Open Questions voor full lijst:

- PostNL onboarding-tijd (slippage-risico op S05)
- Tracking-webhooks in basis-pakket of upgrade
- BRK coverage in productie (sparse-data-pattern parallel met CBS/3D BAG)
- M048 Frontend Scaling dependency op S06 (opgeslagen-tab cockpit)
- Pre-sale partner volume-validatie (kan quota-defaults bijsturen)
- Verwerkersovereenkomst-template review (parallel juridisch, GA-ship-blokker)

---

## Volgende skill-stappen (CLAUDE.md drie-laags)

1. **Partner-gesprek** (zie checklist in `PARTNER-GESPREK-M050-2026-05-17.md`)
2. `/plan-ceo-review` — scope-check (ambitieus genoeg / juist hold-scope?)
3. `/plan-eng-review M050` — architectuur-lock-in (BRK persist-pattern, PostNL async-flow, M050.5 coordination, quota-counter-design)
4. `/gsd:new-milestone M050` — roadmap landen, slices aanmaken
5. `/gsd:plan-phase M050/S01` — eerste slice planning

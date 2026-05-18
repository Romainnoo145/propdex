---
status: draft
created: 2026-05-18
locked_by: CEO-review 2026-05-18 (Tranche 2 strategy pivot)
supersedes: none
target_completion: 2027-Q4 (indicative)
---

# Tranche 2 Roadmap — M060 t/m M110

Onderzoekstool (Tranche 1, M001-M050) → actie + beheer platform (Tranche 2, M060-M110).

Tranche 2 voegt 6 nieuwe milestones toe aan Propdex. Elke milestone is een **dedicated phase** in de lifecycle-sidebar (`frontend/src/lib/lifecycle/phases.ts` fases 3-8). Doel: een externe developer kan één milestone-document lezen, met `/gsd:new-milestone M0xx` aan de slag, en clean mergen in de bestaande Propdex-codebase zonder schema-fragmentation of UX-divergentie.

**Build approach: monolithische git-repo, milestone-isolation.** Geen aparte repos. Eén `frontend/`, één `backend/`, één design system, één multi-tenant pattern. Per milestone: eigen ROADMAP, eigen REQUIREMENTS, eigen phase-tree in `.planning/milestones/M0xx/`. Klarifai = arch-owner per `/plan-eng-review` voor parallel-werk start.

---

## Shared Foundation (van Tranche 1 — niet duplicaten)

Elke Tranche 2 milestone bouwt voort op:

| Foundation | Locatie | Implicaties |
|------------|---------|-------------|
| Multi-tenant pattern | `organization_id` op elk model, expliciet filter in elke query | Zero exceptions. Zie CLAUDE.md "Multi-Tenant Security" |
| Aura design tokens | `frontend/src/styles/index.css` `@theme` block | Geen hardcoded hex, alleen Tailwind utils + CSS vars |
| Auth | JWT (PyJWT + Argon2id), 401-interceptor + 13min refresh-timer | `useAuth()` hook frontend, FastAPI dep backend |
| Multi-tenant credentials | `IntegrationCredential` (Fernet) — M049/S05 | Externe API-keys versleuteld per org |
| LifecycleSideRailNav | `frontend/src/components/layout/LifecycleSideRailNav.tsx` | Fase-icon + active-state via `activePhaseKey` prop |
| Pipeline stage backend | enum 5 stages: `Gesignaleerd / Onderzoek / Contact / Besluit / Afgerond` | Acquisitie-only. Tranche 2 fases krijgen eigen `*_status` velden |
| FACTOR_REGISTRY scoring | `backend/app/scoring/score_v3_factors.py` | Nieuwe scoring-factoren per milestone (bouw_voortgang, verhuur_bezetting, mjop_status, etc.) |
| Cascade documenten | `parcel_documents` + factor-extractor pipeline | Tranche 2 docs (huurcontract, MJOP-rapport, taxatie) inheriten dit |

**Coupling-contract:** Tranche 2 milestones mogen Tranche 1 schema **niet** wijzigen. Toevoegingen (nieuwe tabellen, nieuwe kolommen) zijn OK; wijzigingen aan bestaande modellen → escalate naar Klarifai.

---

## Milestone-overzicht

| Milestone | Sidebar fase | Effort (CC-compressed) | Parallel-able met | Dependency |
|-----------|--------------|------------------------|-------------------|------------|
| M060 Bod | 3-bod | M (~3-4 weken) | M070 Vergunning | M050 (Contact moet shipped) |
| M070 Vergunning | 4-vergunning | L (~6-8 weken) | M060 Bod | M050 (geen, kan parallel) |
| M080 Bouw | 5-bouw | M (~4 weken) | — | M060 + M070 (sequential) |
| M090 Verhuur | 6-verhuur | L (~6-8 weken) | M100 Beheer | M080 (gebouw moet bestaan om te verhuren) |
| M100 Beheer | 7-beheer | XL (~8-12 weken) | M090 Verhuur | M080 (gebouw moet bestaan) |
| M110 Exit | 8-exit | M (~4 weken) | — | M090 + M100 |

**Critical path:** M050 → M060 → M080 → M090/M100 (parallel) → M110.

**Parallel-streams (3 developers, max snelheid):**
- Stream A (acquisitie-completion): M050 → M060 → M080
- Stream B (vergunning-laan): M070 (start parallel met M060)
- Stream C (operate-laan): M090 + M100 parallel zodra M080 shipped

---

## M060 — Bod / Onderhandeling

**Phase:** 3-bod (sidebar icon: Handshake)

**Goal:** Vanaf positieve respons op brief (M050/S04) door naar koopovereenkomst. Cockpit voor onderhandeling-stadium met financieringsstatus en due-diligence-checklists.

**Scope:**
- `bids` tabel: bedrag, datum, status (uitgebracht/geaccepteerd/afgewezen/ingetrokken), tegenbod-historie
- `finance_status` velden: financieringsvoorbehoud, hypotheek-aanvraag-status, equity-confirmatie
- `dd_checklist` flexibel schema: anders per projecttype (transformatie vs nieuwbouw vs aankoop-bestaand)
- UX: bod-formulier met counter-bid log, financiering-tracker, DD-status per item
- AI-assist: brief-ontvanger heeft positief gereageerd → suggest next-best-action (NBA)
- Scoring-factor: `bod_succeskans` (geen rocket science, op basis van markt-comparables uit M048)

**Data-model hints:**
```sql
bids (id, organization_id, parcel_id, amount_eur, status, submitted_at, response_at, counter_history JSONB)
finance_status (id, organization_id, parcel_id, hypotheek_status, equity_confirmed, voorbehoud_deadline)
dd_checklist (id, organization_id, parcel_id, project_type, items JSONB)  -- items is array of {key, label, status, notes, doc_ref}
```

**Concurrenten in dit segment:** Salesforce Real Estate, lokale CRMs. Propdex's wedge = direct gekoppeld aan Tranche 1 scoring-context (eigenaar, BRK, beleid, woonvisie-match) en M050 brief-flow.

---

## M070 — Vergunning

**Phase:** 4-vergunning (sidebar icon: FileCheck)

**Goal:** Omgevingsvergunning + Wkb-flow integration. Tracker voor vergunning-aanvraag van conceptueel → ingediend → goedgekeurd. Cross-reference met bestaande DSO/Omgevingswet bronnen (M044).

**Scope:**
- `permits` tabel: aanvraag-status, indieningsdatum, RVT-bezwaartermijn, voorwaarden, koppeling DSO-ID
- `wkb_steps` (Wet kwaliteitsborging bouw): kwaliteitsborger-toewijzing, instrument-keuze, dossier-opbouw, gereedmelding
- UX: timeline-view aanvraag-status, document-koppeling (gemeente-correspondentie), termijn-alerts
- Externe API: DSO Omgevingsloket (status-poll), gemeente-specifieke API's per integratie-credential (M049/S05)
- AI-assist: complete-check op aanvraag-pakket vóór indiening
- Scoring-factor: `vergunning_complexiteit_runtime` (live update vanuit dit proces feedback naar Tranche 1 scoring)

**Strategic value:** dit is waar Kwaliteitsborgers (target #2 Tranche 1) hun primary workflow krijgen. Wkb-integratie sluit hen vast aan Propdex.

**Concurrenten:** dossiermakers (Cobra, Stabu). Propdex's wedge = end-to-end koppeling met Tranche 1 onderzoekfase — kwaliteitsborger ziet WAAROM dit project gebouwd wordt, niet alleen de papieren.

---

## M080 — Bouw

**Phase:** 5-bouw (sidebar icon: Hammer)

**Goal:** Bouw-uitvoering tracking. Vóór-aanvang t/m oplevering. Foto's, planning-milestones, kwaliteitskeuringen.

**Scope:**
- `construction_phases` tabel: ruwbouw / installaties / afbouw / oplevering, percentage-complete, milestone-dates
- `inspections` tabel: keuringen (constructie, brandveiligheid, EPC, kwaliteitsborger-checks)
- `as_built_docs` koppeling: tekeningen, certificaten, opleverdossier
- UX: timeline + foto-grid (per phase, drag-drop upload), inspection-status badges
- Externe API: foto-services (eigen S3/Spaces bucket), optioneel BIM-integratie
- Scoring-factor: `bouw_voortgang_realisatie` (delta-tracking vs gepland)

**Coupling met M070:** opleverdossier (as-built) wordt input voor Wkb-gereedmelding.

---

## M090 — Verhuur

**Phase:** 6-verhuur (sidebar icon: Key)

**Goal:** Huurder-acquisitie, contracten, mutaties, **onderverhuur-flow**. Eerste milestone die makelaars als target-user serieus neemt.

**Scope:**
- `tenants` tabel: NAW, contactgegevens, KVK (zakelijk), credit-check status, IND-status (indien internationaal)
- `lease_agreements` tabel: contract-vorm (huur/onderhuur/anti-kraak), start/eind, huurprijs, indexering, opzeg-clausule
- `lease_pdfs` storage: getekende contracten + addenda
- `tenant_changes` tabel: mutaties — opzegging, verlenging, huurverhoging, eindafrekening
- `makelaar_connections`: makelaar-account per pand (M090.5 indien nodig: separate makelaar-tenancy)
- UX: huurder-zoek-funnel (advertising tot tekening), contract-builder met templates, mutatie-flow met automated tekst-generatie
- AI-assist: huurcontract-review (afwijkingen van wet/template flaggen), huurder-screening (publicaties scan), onderhuur-advies
- Scoring-factor: `verhuur_bezetting_pct` (org-level KPI)

**Strategic value:** makelaars (was Tranche 1 out-of-scope) zijn hier target users. Propdex's wedge boven Brainbay/NVM = de gekoppelde intelligence-context (eigenaar weet hoe pand is verworven, welke beleidsregels gelden, energielabel-status, MJOP-planning).

**Onderhuur-specifiek:** eigen contract-template, koppeling aan hoofd-huurcontract, akkoord-flow met hoofdverhuurder.

---

## M100 — Beheer

**Phase:** 7-beheer (sidebar icon: Wrench)

**Goal:** Onderhoud, verduurzaming, klachten, VvE-coordinatie. Doorlopend, niet event-based.

**Scope:**
- `maintenance_jobs` tabel: type (preventief/correctief/groot-onderhoud), priority, datum-planning, leverancier, kosten
- `mjop` tabel: meerjaren-onderhoudsplan, scope (per element: dak/CV/gevel/etc.), kosten-prognose 10-30 jaar
- `complaints` tabel: huurder-klacht-tickets, priority, SLA, doorlooptijd, resolutie
- `verduurzamings_traject` tabel: huidig energielabel, doel-label, maatregelen, subsidies (Vindsubsidies-koppeling), payback-period
- `vve_actions` tabel: VvE-besluit-tracking, ledenadministratie, ALV-agenda
- UX: dashboard-view (woon-, niet projectgericht), kalender-view voor planning, leverancier-portaal voor maintenance-jobs
- AI-assist: MJOP-update suggesties op basis van inspecties, klachten-categorisatie, subsidie-matching
- Scoring-factor: `onderhoud_achterstand` (fundamenteel risico-component, feedback naar Tranche 1 risico-score)

**Concurrenten:** Twinq, Bouwinvest tooling. Propdex's wedge = niet-silo'd: beheer-fase ziet Tranche 1 data (eigendoms-historie, beleidsmonitoring, scoring-context) en M070 vergunning-archief.

---

## M110 — Exit

**Phase:** 8-exit (sidebar icon: TrendingUp)

**Goal:** Verkoop **OF** herfinanciering. Niet alleen "weg-doen" — herfinanciering is vaker exit-event dan verkoop voor beleggers.

**Scope:**
- `valuations` tabel: taxatie-snapshots (waarde, taxateur, datum, methodiek)
- `exit_plans` tabel: scenario (verkoop/herfinanciering/holding), target-datum, target-prijs, koppeling makelaar/financierer
- `refinancing` sub-flow: huidige hypotheek-condities, target-condities, LTV-evolutie, equity-extractie
- UX: scenario-builder met cashflow-projectie, koppeling Calcasa/Matrixian (huidige waarde — Propdex doet niet zelf taxatie), makelaar-handoff bij verkoop
- AI-assist: optimal-exit-timing op basis van markt-trends, scoring-trends (Tranche 1 risico-score evolutie)
- Scoring-factor: `exit_optimaliteit` (cross-cutting indicator)

**Strategic value:** dit is waar de full-lifecycle-narrative betaalt. Een belegger die in Propdex M060 een pand koopt en in M110 verkoopt heeft 5+ jaar data in één platform. Dat is een retention-wapen tegen elke concurrent.

---

## Cross-cutting Concerns (alle milestones)

| Concern | Aanpak |
|---------|--------|
| **Schema-fragmentation** | Centraal `backend/app/models/` schema. Per milestone één PR met alle nieuwe models in dezelfde Alembic-migratie. Klarifai review voor merge. |
| **UX-divergentie** | DESIGN.md is hard contract. `/gsd:ui-phase` per frontend-phase verplicht voor parallel-dev. Design-review gate bij merge. |
| **Multi-tenant lekken** | Eerste PR per milestone = security audit door Klarifai. `organization_id` filter in elke query. Test-coverage voor cross-tenant scenarios non-negotiable. |
| **API-consistentie** | RESTful pattern, `/api/v1/{resource}` namespace. Pydantic-typed schemas. Voorbeeld te volgen: `app/routers/admin_data_sources.py` (M049/S02). |
| **Scoring integration** | Nieuwe scoring-factoren per milestone via `FACTOR_REGISTRY`. Geen score-engine wijzigingen — alleen factor-toevoegingen. Cascade triggert automatisch. |
| **Document handling** | Bestaand `parcel_documents` + factor-extractor pipeline (M047). Nieuwe doc-types (huurcontract, MJOP, taxatie) krijgen eigen extractor maar volgen het pattern. |
| **Lifecycle sidebar** | `frontend/src/lib/lifecycle/phases.ts` is source-of-truth. Nieuwe fase wordt `enabled: true` ZODRA bijbehorende milestone shipped (in dezelfde PR). |
| **Test discipline** | 275 tests is baseline post-M047. Elke milestone voegt minimaal happy-path + 2 edge-case + cross-tenant test toe per nieuwe endpoint. |

---

## Pricing Tier Impact (TODO voor Klarifai)

Huidige tier-structuur (Starter €299 / Team €699 / Enterprise €1.249 per memory) is ontworpen voor Tranche 1 ontwikkelaars. Tranche 2 voegt heel andere user-typen toe (beleggers per-eenheid, makelaars per-transactie). Pricing-revisie hoort bij M090 launch — niet binnen scope van M060-M080.

**Open question:** per-eenheid pricing (woningcorporatie-pattern) vs per-user (developer-pattern) vs hybrid?

---

## Handoff Checklist voor Nieuwe Developer

Voor je begint aan een M0xx Tranche 2 milestone:

- [ ] Lees `CLAUDE.md` (drie-laags stack, multi-tenant rules, commit format)
- [ ] Lees `DESIGN.md` (Aura design system — niet afwijken zonder Klarifai-approval)
- [ ] Lees `.planning/PROJECT.md` (huidige strategy + key decisions)
- [ ] Lees `.planning/STATE.md` voor live status
- [ ] Lees deze TRANCHE-2-ROADMAP.md (jij bent hier)
- [ ] Run `/gsd:new-milestone M0xx` om milestone formeel te starten
- [ ] Voor architectuur-keuzes: `/plan-eng-review` met Klarifai vóór 5 PRs
- [ ] Eerste PR per milestone = security audit door Klarifai (multi-tenant correctness)
- [ ] Frontend-werk: `/gsd:ui-phase` voor design contract vóór code

---

*Status: draft. Te lockken na partner-validatie van Tranche 2 strategie.*

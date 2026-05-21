# Phase 8: BRK Fase-2 Wire-up — Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Source:** Eng-plan express path (`08-ENG-PLAN.locked.md`, output van `/plan-eng-review M050/S06` 2026-05-19)

<domain>
## Phase Boundary

Activeer lifecycle-fase 2 (Contact) als BRK-home en complete de BRK frontend wire-up
op het cockpit-shell dat in Phase 6 al shipped is. Drie sub-domeinen:

1. **Backend** — Nieuw `GET /api/parcels/{parcel_id}/brk` read-endpoint + read-service
   met multi-tenant isolation (cross-org returns []).
2. **Frontend hooks + components** — `ContactPhaseView` als fase-2 home; sub-componenten
   `BrkPersistPanel` / `BrkOwnerCard` / `BrkHypotheekCard` / `BrkKoopwaardeTimeline` /
   `RescoreProgressBanner`; hooks `useBrkRecords` / `usePersistBrk` / `useRescorePoll`.
3. **Refactor** — Split 1922-LOC `FavoriteParcelWorkspaceView.tsx` in ≤300-LOC
   componenten conform CLAUDE.md "files <300 lines" rule, met feature-parity
   regression-test.

Plus 2 cross-cutting wijzigingen:
- `phases.ts` enable `2-contact` (was reserved voor M050/S04 brief work)
- `RisicoLayer.tsx` FACTOR_LABELS + formatFactorValue extension voor 3 BRK factor-keys

NIET in scope: brief-template (S04), AI personalize (S04.5), PostNL (S05),
partner-branding (S05.5), tier-gates (M050.5), multi-eigenaar UX (M053+).

</domain>

<decisions>
## Implementation Decisions

### AD1: Fase-allocatie BRK
- BRK volledig naar lifecycle-fase 2 (Contact). Fase 1 (Onderzoek) verliest BRK-CTA.
- Fase 1 AANPAK card krijgt nieuwe copy: "Klaar met onderzoek? Stap door naar Contact".
- Geen score-drempel. Fase-overgang IS de gate (gecorrigeerd 2026-05-19 t.o.v. eerdere score≥65 misinterpretatie).
- 3 BRK factoren in score_v3 registry (geshipped in Phase 3) blijven onaangetast — landen retroactief in fase-1 RisicoLayer na rescore.

### AD2: BRK read-path
- Nieuw endpoint `GET /api/parcels/{parcel_id}/brk` returnt `list[BRKOwnershipRecordRead]`.
- Service-layer `app/services/brk_read_service.py::read_for_parcel` met hard org-filter + `soft_deleted_at IS NULL` filter.
- Latest fetch-cycle: anchor op `MAX(fetched_at)`, return alle rows met die fetched_at (multi-owner support).
- Cross-org access: return `[]` (NIET 403 — geen leak van bestaan, parallel met S02 pattern).
- React Query cache-key `['brk', parcelId]` gehydreerd op `ContactPhaseView` mount.
- `usePersistBrk` mutation `onSuccess` invalideert deze cache.

### AD3: Rescore polling
- Na succesvolle `POST /brk/persist`: start polling op scan-endpoint.
- Cadence: 2s interval, max 30 ticks (60s totale window).
- Stop conditie: `flags.cascade_rescored_at > poll_start_at` → success-banner + link terug naar fase 1.
- Timeout conditie: 60s zonder update → banner "Bijwerken duurt langer dan verwacht. Vernieuw fase 1 over enkele minuten." Geen retry-loop.
- Cleanup on unmount via React `useEffect` return.

### AD4: Empty BRK response UX
- Persist returnt `[]` bij alleen-natuurlijk-persoon eigenaars (AVG 3-layer strip).
- UI: "Particuliere eigenaar" infoblok met uitleg AVG-strip + outreach-suggestie via BAG-adres / makelaar.
- CTA: link naar fase-2 brief-flow (komt in S04 — voor nu placeholder).
- Stop polling (rescore impact negeerbaar bij lege records).

### AD5: File split FavoriteParcelWorkspaceView
- Bron: `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx` (1922 LOC).
- Target: 6 files in `frontend/src/components/cockpit/` + 2 helper files in `frontend/src/lib/cockpit/`, alle ≤300 LOC.
- Split-grenzen:
  - `OnderzoekPhaseView.tsx` (~280 LOC) — fase-1 shell wrapper
  - `AanpakCard.tsx` (~140 LOC) — next-step card (BRK CTA verwijderd, vervangen door "Stap door naar Contact")
  - `DossierPager.tsx` (~260 LOC) — 5 tab-pages Notities/Acquisitie/Technisch/Juridisch/Planologisch
  - `DossierCardSlot.tsx` (~180 LOC) — individueel dossier-card (sleep/upload)
  - `ProjectnotitiesGrid.tsx` (~120 LOC) — 4-slot grid
  - `lib/cockpit/dossier-pages.ts` (~200 LOC) — buildPages, mergeDocuments, flattenCards
  - `lib/cockpit/cockpit-derivations.ts` (~140 LOC) — deriveMissingCards, deriveNextStep, contactFollowUp
- Route update: `opgeslagen.perceel.$parcelId.tsx` mount `OnderzoekPhaseView` ipv `FavoriteParcelWorkspaceView`.
- Bron-bestand DELETE na split (alle imports redirected).
- Feature-parity REGRESSION-CRITICAL test verifieert: 5 dossier-tabs werken, scores tonen, document upload werkt, projectnotities-grid intact, score-modals openen.

### AD6: Fase-2 component structure
- Top-level: `frontend/src/components/lifecycle/ContactPhaseView.tsx` (~280 LOC).
- Sub-componenten (in `frontend/src/components/lifecycle/`):
  - `BrkPersistPanel.tsx` (~180 LOC) — CTA + 7 typed error states + empty-response UX (AD4)
  - `BrkOwnerCard.tsx` (~120 LOC) — rechtspersoon/overheid render variants, multi-owner list
  - `BrkHypotheekCard.tsx` (~80 LOC) — heeft_hypotheek Y/N + (later S04) lender summary
  - `BrkKoopwaardeTimeline.tsx` (~110 LOC) — koopjaar + koopsom historie display
  - `RescoreProgressBanner.tsx` (~90 LOC) — polling state UI (shared tussen fase 1 + fase 2)
- Mount-pad: `routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx` dispatch op `phase === '2-contact'` → render `ContactPhaseView`.

### Backend-error-mapping (7 typed errors → HTTP statuses, M050/S02 D12 pattern)
- 401 unauthenticated → re-auth redirect (handled by axios interceptor al)
- 403 CrossOrgParcelAccess → masked als 404 in frontend (geen leak van bestaan)
- 404 ParcelNotFound → "Perceel niet in jouw portfolio"
- 422 ValidationError → "Ongeldige perceel-identificatie"
- 502 GovernmentAPIError → "Kadaster tijdelijk niet beschikbaar"
- 503 FeatureDisabled → "BRK is nog niet beschikbaar (DPA in afhandeling)"
- 503 CredentialNotConfigured → "Kadaster credential ontbreekt — admin configureren"

### Multi-tenant safety (REGRESSION-CRITICAL)
- Endpoint dep: `current_user.organization_id` uit JWT.
- Service-layer hard-filter (NOT bypass-bar).
- Cross-org GET returns `[]` (silent — NIET 403).
- Cross-org POST returns 404 (mask cross-org bestaan).
- Test in `backend/tests/regression/test_multi_tenant_brk_isolation.py`.

### Phase enablement
- `frontend/src/lib/lifecycle/phases.ts`:
  - `2-contact`: `enabled: false → enabled: true`
  - `2-contact`: `plannedMilestone: 'M050/S04' → 'M050/S06 cont. (Phase 8)'`
- Phases 3-8 (Bod/Vergunning/Bouw/Verhuur/Beheer/Exit) blijven `enabled: false` — REGRESSION test.

### Claude's Discretion
- Aura-token klassen (`bg-white/60 backdrop-blur-[24px]`, `text-aura-ink`, etc.) blijven consistent met DESIGN.md.
- Hook-implementatie details (React Query keys, refetch policies) volgens bestaand `useFavorites.ts` + `useScans.ts` patroon.
- Test-file lokaties + naming volgen bestaand pattern (`backend/tests/unit/` + `frontend/src/.../__tests__/`).
- ARIA-labels + keyboard-nav details binnen bestaande shadcn-equivalent pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Eng-plan (source of truth voor deze phase)
- `.planning/phases/08-brk-fase-2-wire-up/08-ENG-PLAN.locked.md` — full eng-plan with 6 architecture decisions, ASCII data-flow diagrams, failure-modes registry, test coverage diagram, file structure changes, plan-task breakdown

### M050 milestone-level
- `.planning/milestones/M050-INDEX.md` — slice catalogue + dependencies + locked Q6/Q7/Q8 decisions
- `.planning/milestones/M050-ENG-PLAN.md` — milestone-level D1–D6 architecture decisions
- `.planning/milestones/M050-S01-ENG-PLAN.md` — S01 BRK datamodel (LOCKED, shipped)
- `.planning/milestones/M050-S02-ENG-PLAN.md` — S02 BRK persist endpoint (LOCKED, shipped)
- `.planning/milestones/M050-S03-ENG-PLAN.md` — S03 3 BRK risico-factoren (LOCKED, shipped)

### Project-level
- `CLAUDE.md` — drie-laags pattern, files <300 lines rule, multi-tenant filter requirement, ports 8000/9300/5434/6380
- `DESIGN.md` — Aura design tokens (Morning Mist canvas, Pure Glass, Plus Jakarta Sans)
- `~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/feedback_brk_as_action_gate.md` — BRK fase-2 allocation rule (gecorrigeerd 2026-05-19)
- `~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/feedback_lifecycle_sidebar_scope.md` — sidebar-swap scope rule

### Backend touchpoints
- `backend/app/scans/brk_router.py` — POST endpoint LIVE, GET handler TOEVOEGEN
- `backend/app/services/brk_fetch_service.py` — persist channel (S02), distinct van read-service
- `backend/app/services/brk_persistence_service.py` — feature flag + AVG 3-layer strip pattern
- `backend/app/models/brk_ownership_record.py` — model met soft_deleted_at + UQ(org, parcel, fetched_at)
- `backend/app/schemas/brk_ownership_record.py` — BRKOwnershipRecordRead schema
- `backend/app/services/score_v3.py` — FACTOR_REGISTRY met 3 BRK keys (hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend)
- `backend/app/jobs/rescore_cascade_job.py` — D7 hook live na persist

### Frontend touchpoints
- `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx` — 1922-LOC monolith, SPLIT target
- `frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.tsx` — fase-1 route, mount-target update
- `frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx` — dispatch site voor fase 2
- `frontend/src/routes/_authenticated.tsx` — sidebar swap logic line 37-42 (NIET wijzigen — werkt al correct)
- `frontend/src/lib/lifecycle/phases.ts` — `2-contact` enable toggle
- `frontend/src/components/layout/LifecycleSideRailNav.tsx` — sidebar component (NIET wijzigen — werkt al correct)
- `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx` — FACTOR_LABELS + formatFactorValue extension
- `frontend/src/components/map/panels/parcel/FactorCard.tsx` — render-target voor 3 BRK factoren (NIET wijzigen — auto-render via labels)
- `frontend/src/hooks/useFavorites.ts` — pattern voor nieuwe BRK hooks
- `frontend/src/hooks/useScans.ts` — pattern voor scan-cache invalidation + polling

</canonical_refs>

<specifics>
## Specific Ideas

### Test file targets (mandatory locations)
- `backend/tests/unit/services/test_brk_read_service.py`
- `backend/tests/unit/scans/test_brk_router_get.py`
- `backend/tests/integration/test_brk_read_e2e.py`
- `backend/tests/regression/test_multi_tenant_brk_isolation.py` (CRITICAL)
- `backend/tests/regression/test_phase105_modal_still_works.py` (CRITICAL — encode iron-rule)
- `frontend/src/components/lifecycle/__tests__/ContactPhaseView.test.tsx`
- `frontend/src/components/lifecycle/__tests__/BrkPersistPanel.test.tsx`
- `frontend/src/hooks/__tests__/useRescorePoll.test.ts`
- `frontend/src/components/cockpit/__tests__/OnderzoekPhaseView.parity.test.tsx` (REGRESSION-CRITICAL — feature-parity)

### Plan-task volgorde (sequential per eng-plan, geen worktree-split)
- 08-01: Backend GET /brk + read service + multi-tenant regression
- 08-02: Frontend BRK hooks (useBrkRecords, usePersistBrk, useRescorePoll) + error mapping
- 08-03: Fase 2 components (ContactPhaseView + 4 BRK sub-components + RescoreProgressBanner)
- 08-04: RisicoLayer 3 BRK factor entries + regression
- 08-05: phases.ts enable 2-contact + $phase router dispatch
- 08-06: FavoriteParcelWorkspaceView SPLIT (5 nieuwe files + helpers + parity test)
- 08-07: AANPAK card copy + "Stap door naar Contact" CTA wiring
- 08-08: E2E integration tests (8 critical flows) + verification

### Regression-tests die als IRON-RULE moeten landen
- Phase 105 ephemeral BRK modal werkt (verschillende schema BRKOwnership vs BRKOwnershipRecordRead)
- rescore_cascade_job D7 hook triggert correct na BRK persist
- LifecycleSideRailNav alleen op `/opgeslagen/perceel/$parcelId/*`, NIET `/opgeslagen`
- FavoriteParcelWorkspaceView feature-parity post-split
- Phases 3-8 enabled: false placeholder rendering ongewijzigd
- 19 score factoren unchanged
- Cross-org GET /brk returns [] (no leak)

</specifics>

<deferred>
## Deferred Ideas

### Bewust UIT scope deze phase
- Brief-template registry + AI personalize (Phase 4 / S04)
- PostNL verzending integratie (Phase 5 / S05)
- Partner-branding upload UI (Phase 5.5 / S05.5)
- Tier-gates op BRK persist quota (M050.5 parallel milestone)
- Multi-eigenaar UX voor rechtspersoon-met-meerdere-directies (M053+ per M050-ENG-PLAN.md regel 415)
- BRK record edit / annotation (M053+)
- BAG-adres fallback voor outreach zonder BRK (S04 brief flow)
- Eigenaar-historie timeline (alleen koopwaarde nu, niet eigenaar-changes) (M053+)
- Fases 3-8 activatie (Bod/Vergunning/Bouw/Verhuur/Beheer/Exit — M060/M070/M080/M090/M100/M110)
- Score-drempel UX (gecanceld per architectuur — fase-overgang IS de gate)

</deferred>

---

*Phase: 08-brk-fase-2-wire-up*
*Context gathered: 2026-05-19 via eng-plan express path. Eng-plan in same dir: `08-ENG-PLAN.locked.md`*

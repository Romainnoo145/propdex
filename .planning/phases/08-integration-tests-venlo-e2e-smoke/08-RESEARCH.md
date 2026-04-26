# Phase 8: Integration tests + Venlo E2E smoke - Research

**Researched:** 2026-04-26
**Domain:** Backend integration testing (pytest-asyncio, monkeypatch Claude) + frontend Storybook play-functions + cross-phase smoke
**Confidence:** HIGH (project conventions are well-established and the M047/S06 + Phase 5+6 codepaths already have unit-level coverage Phase 8 will lift to E2E)

## Summary

Phase 8 is the **convergence smoke layer** for M048 — the four success criteria each map to one cross-phase property already exercised at the unit/component level by phases 5/6/3/7, but **not yet asserted as one composed flow**. The job is therefore *not* to invent a new test stack but to **stitch existing patterns together**: Phase-5's `test_woonvisie_uses_document_sentinel` (DOCUMENT_SENTINEL caller wiring), Phase-6's `test_venlo_smoke_wijk_differentiation` (Blerick vs Venlo-Centrum scoring), Phase-3's `WoonvisiePopup.stories.tsx::ClickOpensPopup` (popup-on-click), and Phase-7's `PotentieLayer.stories.tsx::PinFlow + Max4Guard` (pin persistence) are all extant. Phase 8 must compose them and add the missing seams.

Project test posture is **already very mature**: 1709 backend tests collected (not 275 — the ROADMAP figure is stale; SC#5's "275 pre-existing" must be interpreted as "no regressions in the suite that was green at M048 kickoff"). Frontend uses `@storybook/addon-vitest` with Playwright as headless browser driver — there is **no separate Playwright/Cypress harness** in `frontend/tests/` (the dir doesn't exist). All component-level E2E happens through Storybook play-functions executed under Vitest.

**Primary recommendation:** Treat Phase 8 as a **5-test integration smoke layer**: 2 backend integration tests (cache-dedup proof + score-differentiation proof composed via `cascade_enrichment_service` + `compute_score_v3`), 1 backend tenant-isolation regression, and 2 frontend Storybook play-functions composing existing fixtures (popup-shows-Blerick-citaat-not-gemeente-breed + pin-persistence-across-refresh-mock). Do NOT introduce Playwright as a new test framework. Do NOT seed a real Venlo woonvisie PDF — the pattern across all M048 phases is `monkeypatch` of `extract_factor` with synthetic `WoonvisiePayload` fixtures.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

No CONTEXT.md exists for Phase 8 — `/gsd:discuss-phase` was not run. The locked decisions for Phase 8 come from the ROADMAP.md success criteria + STATE.md `### Decisions` accumulated across phases 5/6/3/7, which constrain the surface area Phase 8 tests:

- **DOCUMENT_SENTINEL is caller-level** in `cascade_enrichment_service`, not on FactorDefinition (Phase 5 decision). Phase 8 tests the *behavior* (1 Claude call), not the registry shape.
- **`FactorResult.waarde` for woonvisie_match is a dict** `{matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}` (Phase 6 / Plan 03 decision). Phase 8 frontend smoke must consume this dict shape, not legacy string.
- **Venlo smoke threshold = 0.2 score-differentiation** Blerick (groei + sociaal/midden overlap) vs Venlo-Centrum (neutraal + duur/gemengd no-overlap) for `project_type=nieuwbouw_wonen` (Phase 6 / Plan 04 decision). Phase 8 reuses this exact Blerick/Centrum payload-pair so the smoke is dimensionally identical to the assert that already exists at unit-level — but composed through the cascade_enrichment_service + compute_score_v3 boundary.
- **CARDS_PER_PAGE = 4, MAX_PINS_PER_CATEGORY = 4** (Phase 7 / Plan 05 decision). REQUIREMENTS.md still says "max 6" — that is documented doc-lag. Phase 8 tests the **shipped** value of 4.
- **Pin star always-visible for pinned cards, hover-only for unpinned** (Phase 7 / Plan 05 UX decision). Phase 8 pin-persistence smoke must use `data-testid="pin-star-filled"` for assertions, not `pin-star-button`.
- **No real PDF, no real Claude call** — `monkeypatch.setattr(cascade_enrichment_service, "extract_factor", fake)` is the project pattern for asserting "1 Claude call" claims. The Anthropic mock helpers live in `backend/tests/ai_mocks.py` (`make_mock_anthropic_client`, `make_tool_use_response`).

### Claude's Discretion

- **Test file layout** — single `test_m048_phase8_smoke.py` integration file vs splitting per criterion. Recommend single file with 4 grouped tests (one per SC#1-#4) so the convergence intent is co-located.
- **Frontend smoke location** — extend `PotentieLayer.stories.tsx` with new "Phase 8" story group (`Phase8/PinPersistsAfterRemount`, `Phase8/WoonvisieCitaatIsWijkSpecific`) vs new `Phase8Smoke.stories.tsx` file. Recommend extending existing because the Phase 7 fixtures + Phase 3 fixtures are already imported there.
- **How to assert "popup toont Blerick-citaat (niet gemeente-breed)"** — negative assertion (`expect(within(document.body).queryByText(payload.algemeen_citaat)).toBeNull()`) vs positive only. Recommend both: positive asserts wijk citaat appears AND negative asserts gemeente algemeen_citaat does NOT appear in the active popup.
- **"Min 15 new tests"** — distribution across criteria. Recommend 4-5 backend (SC#1+#2+isolation+cache-key-shape), 8-10 frontend stories (SC#3+#4 plus regression coverage on the dict-shape contract from Phase 6 → Phase 3 type drift). 12-15 total is achievable without inflation.
- **Whether to backfill `pyproject.toml` E2E job** — Phase 8 is the natural time to add a `phase-8-smoke` pytest marker and Storybook test-runner CI step. Recommend deferring CI wiring to a M049 followup unless the planner wants it now (no infra exists today).

### Deferred Ideas (OUT OF SCOPE)

- **Real Venlo woonvisie PDF upload + actual Claude call** — out of scope; deferred to ground-truth calibration milestone (M058 per REQUIREMENTS.md L65).
- **Playwright/Cypress E2E harness against running dev server** — not in stack today; would require new framework install + CI environment + auth fixture for live backend. Defer to M049+ if user-acceptance E2E is a future need.
- **Concurrency-burst Claude-call coalescing** (`asyncio.Semaphore(5)` race in rescore_cascade_job) — Phase 5 SUMMARY documents this as deferred to M050+. Phase 8 smoke explicitly asserts **sequential** 2-parcel scans, mirroring Phase 5 SC#3.
- **Storybook chromatic visual diffing** — out of scope; visual sign-off was a manual Phase 7/Plan 05 checkpoint.
- **Multi-gemeente smoke** (e.g. Venlo + Maastricht differentiation) — out of scope; Venlo only per ROADMAP.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-08 | E2E smoke — Venlo woonvisie upload → 2 parcelen scan → 1 Claude call → verschillende scores → popup toont wijk-specifiek citaat → pins persisteren across refresh | Decomposed into 5 ROADMAP success criteria. (1) cache-dedup → existing pattern: `tests/integration/test_cascade_enrichment_service.py::test_woonvisie_uses_document_sentinel` + `tests/unit/test_factor_extraction_service.py::test_document_sentinel_one_claude_call_for_two_parcels`. (2) score-diff → existing pattern: `tests/integration/test_woonvisie_match.py::test_venlo_smoke_wijk_differentiation`. (3) wijk-citaat in popup → existing pattern: `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx::BlerickGroeiMatch` + `PotentieLayer.stories.tsx::ClickOpensPopup`. (4) pins-persist → existing pattern: `PotentieLayer.stories.tsx::PinFlow` + `factorPinsMock.ts`. (5) regression-green → `cd backend && uv run pytest tests/ -x` (1709 collected). |
</phase_requirements>

## Standard Stack

### Core (already installed — DO NOT add)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | 7.x (project convention) | Backend integration tests | Existing fixture chain (`test_db`, `async_client`, `create_test_user`, `auth_headers`) in `backend/tests/conftest.py` |
| pytest-asyncio | configured | Async coroutines (`@pytest.mark.asyncio`) | All Phase 5/6/7 backend tests use this |
| httpx + ASGITransport | latest | In-process API calls without HTTP | `async_client` fixture pattern; replaces TestClient (which blocks on async) |
| asyncpg | latest | PostgreSQL driver for `propdex_test` DB | conftest.py creates the DB + extensions automatically |
| unittest.mock (AsyncMock, MagicMock, monkeypatch) | stdlib | Stub Anthropic Claude calls | Project pattern: `tests/ai_mocks.py::make_mock_anthropic_client` |
| Storybook 10.2.8 | already installed | Frontend component E2E | `@storybook/addon-vitest` runs play-functions under Vitest |
| Playwright 1.58.2 | already installed | Headless browser for Storybook tests | Used **only** as Vitest browser driver via `@vitest/browser-playwright`, NOT as standalone E2E framework |
| storybook/test (within, userEvent, expect, waitFor) | bundled with SB10 | DOM assertions inside play-functions | `from 'storybook/test'` (NOTE: not `@storybook/test` — package path changed in v10) |
| TanStack Query 5.x | already installed | Cache pre-seed for stories | Pattern: `factorPinsMock.ts::makeQueryClientWithPins` |

### Supporting (Phase 8 will reuse, not introduce)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tests/api_mocks.py` (`make_mock_response`, `make_mock_client`) | project-internal | Mock httpx government APIs | Not needed for Phase 8 (no PDOK / WFS calls) |
| `tests/ai_mocks.py` (`make_mock_anthropic_client`, `make_tool_use_response`) | project-internal | Mock Anthropic | Use for SC#1 cache-dedup test |
| `factorPinsMock.ts` (`makeFactorPin`, `makeQueryClientWithPins`) | project-internal | Pre-seed pin state in stories | Use for SC#4 pin-persistence story |
| `geoalchemy2 + shapely` (existing) | latest | Synthetic Venlo geometries | Use for `_seed_parcel` helpers if seeding two ParcelCache rows |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Storybook play-functions | Playwright E2E against `pnpm dev` | New framework + CI surface + auth setup — out of scope for SC#3/#4 which are component-level |
| Real woonvisie PDF + real Claude | `monkeypatch` on `extract_factor` | Real call costs credits + non-deterministic + fails on OpenRouter 402 (Phase 5 SUMMARY documented OpenRouter exhaustion). Mock pattern is the project convention. |
| New `tests/e2e/` directory | `tests/integration/test_m048_phase8_smoke.py` | Additional dir signals "different framework" — there isn't one. Single integration file co-locates. |

**Installation:** None. Phase 8 adds zero dependencies.

## Architecture Patterns

### Recommended File Layout

```
backend/tests/integration/
└── test_m048_phase8_smoke.py        # NEW — 4 backend tests (SC#1, SC#2, isolation, cache-key shape)

frontend/src/stories/parcel/
├── PotentieLayer.stories.tsx        # EXTEND — add 2 Phase 8 stories
└── (no new files; reuse existing)

.planning/phases/08-integration-tests-venlo-e2e-smoke/
├── 08-RESEARCH.md                   # this file
├── 08-VALIDATION.md                 # planner creates next
├── 08-01-PLAN.md                    # planner creates next (likely 1-2 plans)
└── 08-XX-SUMMARY.md                 # one per plan
```

### Pattern 1: Compose-not-invent for SC#1 (cache-dedup composed at the cascade boundary)

**What:** SC#1 already has unit-level proof (`call_count == 1` in `test_document_sentinel_one_claude_call_for_two_parcels`) and caller-level proof (`captured_kwargs["parcel_id"] == DOCUMENT_SENTINEL` in `test_woonvisie_uses_document_sentinel`). Phase 8 needs to compose: TWO sequential calls to `cascade_enrichment_service.get_cascade_payloads` for two **different parcel_ids in two different wijken** against ONE doc → assert mock Claude was hit exactly once.

**When to use:** Top-level SC#1 smoke. The new dimension over Phase 5 is "two different real parcel_ids" (Phase 5 only proved sentinel-substitution; Phase 8 proves sentinel-substitution actually collapses two parcel-paths into one Claude call when invoked through the public boundary).

**Example (skeleton):**
```python
# Source: composes patterns from
#   backend/tests/integration/test_cascade_enrichment_service.py:1-87 (monkeypatch spy)
#   backend/tests/unit/test_factor_extraction_service.py:204,215 (call_count assert)

@pytest.mark.asyncio
async def test_two_parcels_one_claude_call_via_cascade_boundary(
    test_db, create_test_user, monkeypatch
):
    """SC#1: two parcels (Blerick + Centrum) against same Venlo woonvisie → 1 Claude call."""
    user, org = await create_test_user()
    doc = await _seed_venlo_woonvisie(test_db, org, user)  # fixture from test_rescore_cascade_job

    # Use a real mock Claude client so call_count is observable
    from tests.ai_mocks import make_mock_anthropic_client, make_tool_use_response
    mock_response = make_tool_use_response(
        tool_name="extract_woonvisie",
        tool_input=_VENLO_BLERICK_CENTRUM_PAYLOAD_DICT,  # see fixture below
    )
    mock_client = make_mock_anthropic_client(mock_response)
    monkeypatch.setattr("app.services.factor_extraction_service.get_claude_client",
                        lambda: mock_client)

    # Two different real parcel_ids; both go through cascade_enrichment_service
    payloads_1 = await cascade_enrichment_service.get_cascade_payloads(
        test_db, parcel_id="NL.IMBAG.Pand.0983-BLERICK-001",
        gemeente_code="0983", organization_id=org.id,
    )
    payloads_2 = await cascade_enrichment_service.get_cascade_payloads(
        test_db, parcel_id="NL.IMBAG.Pand.0983-CENTRUM-002",
        gemeente_code="0983", organization_id=org.id,
    )

    # The proof
    assert mock_client.messages.create.call_count == 1
    assert "woonvisie_match" in payloads_1
    assert "woonvisie_match" in payloads_2
```

### Pattern 2: Score-diff composed through compute_score_v3 with real cascade_payloads (SC#2)

**What:** Phase 6's `test_venlo_smoke_wijk_differentiation` already calls `compute_score_v3` twice with the same payload but different `parcel.wijk_naam`. Phase 8's added value: feed payload **through `cascade_enrichment_service.get_cascade_payloads`** so the test composes the cache layer + score layer (proving the dict that comes back from the cache is consumable by the scorer).

**When to use:** SC#2. Different from Phase 6 because Phase 6 hardcoded the payload as a kwarg; Phase 8 routes it through the cache boundary.

**Example:**
```python
# Source: composes
#   backend/tests/integration/test_woonvisie_match.py:186-233 (Venlo smoke)
#   backend/app/services/cascade_enrichment_service.py:81 (DOCUMENT_SENTINEL call site)

@pytest.mark.asyncio
async def test_two_parcels_different_woonvisie_scores_via_cache(
    test_db, create_test_user, monkeypatch,
):
    """SC#2: same payload from cache, different wijken → different woonvisie_match scores."""
    user, org = await create_test_user()
    doc = await _seed_venlo_woonvisie(test_db, org, user)
    monkeypatch.setattr(cascade_enrichment_service, "extract_factor",
                        _fake_extract_returning_blerick_centrum_payload)

    payloads = await cascade_enrichment_service.get_cascade_payloads(
        test_db, parcel_id="NL.IMBAG.Pand.X", gemeente_code="0983", organization_id=org.id,
    )

    blerick_score = compute_score_v3(
        _minimal_parcel_data("Blerick"),  # helper from test_woonvisie_match.py
        project_type="nieuwbouw_wonen",
        cascade_payloads=payloads,
    ).score_breakdown["woonvisie_match"].genormaliseerde_score

    centrum_score = compute_score_v3(
        _minimal_parcel_data("Venlo-Centrum"),
        project_type="nieuwbouw_wonen",
        cascade_payloads=payloads,
    ).score_breakdown["woonvisie_match"].genormaliseerde_score

    assert blerick_score > centrum_score
    assert abs(blerick_score - centrum_score) >= 0.2  # Phase 6 locked threshold
```

### Pattern 3: Storybook play-function for SC#3 (popup wijk-citaat)

**What:** Phase 3's `PotentieLayer.stories.tsx::ClickOpensPopup` already navigates to page 2, clicks WOONVISIE, asserts `Blerick` + `Groeigebied` appear. Phase 8 adds **negative assertion**: `payload.algemeen_citaat` ("Gemeente Venlo streeft naar...") must NOT appear when a wijk-policy match was found, and must DEFAULT-render when wijk_naam is unknown.

**When to use:** SC#3. Cross-phase contract proof: Phase-6 dict-shape (`waarde.matched_policy.citaat` populated) + Phase-3 popup consumer (renders wijk-specific not gemeente-breed) work together.

**Example:**
```typescript
// Source: extends frontend/src/stories/parcel/PotentieLayer.stories.tsx (Phase 3 ClickOpensPopup pattern + Phase 7 makeQueryClientWithPins for pin context)

export const Phase8WijkCitaatNotAlgemeen: Story = {
  parameters: { /* same as ClickOpensPopup but parcel.wijk_naam = "Blerick" */ },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /volgende/i }))  // page 2
    await userEvent.click(canvas.getByRole('button', { name: /WOONVISIE/i }))
    await waitFor(async () => {
      const popup = within(document.body)
      // Positive: wijk citaat appears
      await expect(popup.getByText(/Blerick blijft een van de drie groeikernen/i)).toBeInTheDocument()
      // Negative: gemeente-breed citaat MUST NOT appear in popup
      expect(popup.queryByText(/Gemeente Venlo streeft naar 2800 nieuwe woningen/i)).toBeNull()
    }, { timeout: 2000 })
  }
}
```

### Pattern 4: Pin-persistence story via cache-pre-seed remount (SC#4)

**What:** Real cross-browser persistence requires backend round-trip — out of scope for Storybook. The component-level proof Phase 8 can offer is: pre-seed `queryClient.setQueryData(['factor-pins', 'potentie'], [pin1, pin2, pin3])` BEFORE first render → confirm 3 pins appear on synth-page-0 → unmount/remount component (`rerender` pattern) → confirm 3 pins still appear (because they came from cache, not from a fresh GET).

**When to use:** SC#4 component-level. Acknowledge in plan that "real refresh" is human-verification (Phase 7 already flagged this in `07-VERIFICATION.md` human_verification block). Add the human-verification entry to `08-VERIFICATION.md` for live-backend persistence.

**Example:**
```typescript
export const Phase8PinsPersistAcrossRemount: Story = {
  parameters: {
    queryClient: makeQueryClientWithPins(PARCEL_ID, [
      makeFactorPin('woonvisie_match', 0),
      makeFactorPin('vergunning_succeskans', 1),
      makeFactorPin('demografie_match', 2),
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // First mount: page 0 (GEPIND) shows 3 pinned cards
    await waitFor(() => {
      expect(canvas.getByText(/GEPIND/i)).toBeInTheDocument()
      expect(canvas.getAllByTestId('pin-star-filled')).toHaveLength(3)
    })
    // Navigate to a group page and back (forces remount of card list)
    await userEvent.click(canvas.getByRole('button', { name: /volgende/i }))
    await userEvent.click(canvas.getByRole('button', { name: /vorige/i }))
    // Pins still visible
    expect(canvas.getAllByTestId('pin-star-filled')).toHaveLength(3)
  }
}
```

### Anti-Patterns to Avoid

- **Spinning up real Anthropic / OpenRouter calls** — fails on credit exhaustion (Phase 5 SUMMARY documented this). Always `monkeypatch`.
- **Using `TestClient` instead of `AsyncClient + ASGITransport`** — blocks on async code, project doc cited in `MEMORY.md`.
- **Fresh `propdex` DB writes** — must use `propdex_test` (conftest.py auto-creates). NEVER write to `propdex` from tests.
- **Asserting hardcoded "275 tests"** — collected count is 1709 today. ROADMAP SC#5 should be interpreted as "no regressions in the previously-green subset" not "exactly 275". The new test count threshold (>290 / +15) holds against the *post-Phase-7* baseline.
- **Adding pytest.skip / xfail** — Phase 7 STATE.md decision: "no pytest.skip/xfail allowed; Wave-0 stubs must fail loud". Phase 8 inherits.
- **`@storybook/test` import** — wrong; Storybook 10 moved to `from 'storybook/test'` (Phase 2 STATE.md decision).
- **Asserting on `pin-star-button` for pinned cards** — Phase 7/Plan 05 decision: pinned cards render `pin-star-filled` (always-visible), unpinned cards render `pin-star-button` (hover-only). Mixing them in assertions fails silently.
- **Calling `compute_score_v3` with deprecated `growth_wijken=` kwargs** — Phase 6/Plan 04 decision: those args are purged from the test surface. Always use `WijkPolicy(...)` constructor.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Did Claude get called once?" assertion | Custom call-counter wrapping httpx | `mock_client.messages.create.call_count == 1` via `make_mock_anthropic_client` | The pattern is established in `test_factor_extraction_service.py:204,215`; reuse it verbatim |
| "Did the caller pass DOCUMENT_SENTINEL?" assertion | Inspecting cache rows post-hoc | `monkeypatch.setattr(cascade_enrichment_service, "extract_factor", spy)` + `captured_kwargs["parcel_id"] == DOCUMENT_SENTINEL` | Existing pattern in `test_cascade_enrichment_service.py:72-83` |
| Two-parcel score-diff fixture | Building synthetic ParcelCache rows + bestemmingsplan + WFS mocks | `_minimal_parcel_data("Blerick")` + `_minimal_parcel_data("Venlo-Centrum")` helpers from `test_woonvisie_match.py` | Reusing avoids the seed-explosion that bit M045 tests; payloads are the only variable |
| Frontend "click → popup" assertion | Custom DOM walker | `userEvent.click` + `waitFor(within(document.body).getByText(...))` | The `within(document.body)` portal pattern is critical — Phase 2 STATE.md: "Portal-rendered modals require `within(document.body)` in play functions" |
| Pin-state pre-seed | Manual `localStorage.setItem` | `makeQueryClientWithPins` from `factorPinsMock.ts` | Pins are backend-backed (`user_factor_pins` table) not localStorage; the only honest mock is QueryClient cache pre-seed |
| Venlo woonvisie PDF | Adding a real PDF binary to `tests/fixtures/` | Pydantic `WoonvisiePayload` constructed inline in test | The whole point of Phase 5+6 is that `extract_factor` is bypassable via `monkeypatch` — test the contract, not the LLM |

**Key insight:** Phase 8 is **the integration test layer that should not exist** if the unit tests are doing their job. It exists to catch *seam* bugs (dict-shape drift between Phase 6 backend → Phase 3 frontend; cache-key collision between Phase 5 sentinel + Phase 7 user_factor_pins query path). Keep it minimal — 4-5 backend tests + 2-3 stories — and reuse all fixtures.

## Common Pitfalls

### Pitfall 1: Stale "275 tests" baseline in ROADMAP SC#5

**What goes wrong:** Plan asserts `pytest --collect-only -q | tail -1` shows "275 tests collected". Real number is 1709.
**Why it happens:** ROADMAP.md Phase 8 SC#5 was written when M045 was active; M045/M046/M047/Phase-1..7 collectively added ~1400 tests.
**How to avoid:** Reframe SC#5 as "no test that was green at Phase 7 close becomes red, AND new test count delta >= +15". The honest baseline is "1709 collected; ~1625 green per Phase 6 SUMMARY full-suite gate; 68 pre-existing failures unrelated to woonvisie/wijk-policy". Plan must enumerate the 68 known-failing files (Phase 6/Plan 04 SUMMARY lists them) so SC#5 doesn't drown in noise.
**Warning signs:** Plan acceptance criteria says "1693 → 1708 tests"; that's only 15 new and matches the SC. But "all 275 green" is unachievable because 275 doesn't exist as a meaningful set today.

### Pitfall 2: Pin-persistence "across refresh" cannot be tested in Storybook

**What goes wrong:** Plan writes "test that refresh keeps pins" expecting Vitest+Storybook to do it. Storybook play-functions run inside one Vitest browser context — there is no real page reload.
**Why it happens:** The phrase "across refresh" in SC#4 is colloquial. Real refresh requires backend + DB round-trip.
**How to avoid:** Decompose SC#4 into (a) component-level: pre-seeded TanStack cache survives a remount/navigation cycle (Storybook), (b) human-verification: live dev-server + actual Cmd+Shift+R against real backend. Phase 7's `07-VERIFICATION.md` already documented (b) as human-verification — Phase 8 inherits. Plan must explicitly ship BOTH the Storybook component-level proof AND a `human_verification` block in `08-VERIFICATION.md`.
**Warning signs:** Plan tries to add `window.location.reload()` inside a play function — won't work; navigates the test runner away.

### Pitfall 3: `WoonvisiePayload` deprecated keyword args still present in cache fixtures

**What goes wrong:** Plan-08 test seeds `WoonvisiePayload(growth_wijken=["Blerick"], shrink_wijken=[])` (M047/S06 shape). Pydantic still accepts these (Phase 6 retained for cache-roundtrip), but the *scorer* no longer reads them — Blerick gets neutral score; assertion fails.
**Why it happens:** Phase 6/Plan 03 decision: deprecated fields retained on payload for cache-roundtrip but `_PRIORITEIT_SCORE_DELTA` only consults `wijk_policies`. Tests written against the old shape silently pass schema validation but produce wrong scores.
**How to avoid:** ALWAYS construct woonvisie payloads via `WoonvisiePayload(wijk_policies=[WijkPolicy(...)], algemeen_citaat=..., confidence=...)`. Never use `growth_wijken=`, `shrink_wijken=`, `excluded_project_types=`. (Phase 6/Plan 04 SUMMARY pattern.)
**Warning signs:** Test reproduces M047/S06 fixture verbatim → suspect dict-shape drift.

### Pitfall 4: Storybook play-function sees `<button>` only when `hasWoonvisieData` is true

**What goes wrong:** Plan-08 click on WOONVISIE card fails because parcel mock lacks `score_breakdown.woonvisie_match.waarde.matched_policy`.
**Why it happens:** `PotentieLayer.tsx:393–422` (Phase 3 wiring) wraps WOONVISIE card in `<button>` only if `hasWoonvisieData = factor.waarde.matched_policy != null`. If mock parcel has `matched_policy: null`, card stays `<div>` (inert) and `userEvent.click` finds nothing.
**How to avoid:** Phase 8 fixtures MUST set `score_breakdown.woonvisie_match.waarde = { matched_wijk: 'Blerick', matched_policy: BLERICK, prioritized_segment: 'sociaal', algemeen_citaat: '...' }`. Reuse `BLERICK` constant from `PotentieLayer.stories.tsx` mockParcelWithBlerick.
**Warning signs:** "Unable to find role 'button' with name /WOONVISIE/" → check `hasWoonvisieData` truthiness.

### Pitfall 5: `monkeypatch.setattr` targets the wrong binding for `extract_factor`

**What goes wrong:** `monkeypatch.setattr("app.services.factor_extraction_service.extract_factor", fake)` — but `cascade_enrichment_service.py` does `from app.services.factor_extraction_service import extract_factor` at module load, so the binding it resolves at runtime is `cascade_enrichment_service.extract_factor`, not `factor_extraction_service.extract_factor`.
**Why it happens:** Python imports bind names at the call-site module. Patching the source module doesn't update the call-site name.
**How to avoid:** ALWAYS `monkeypatch.setattr(cascade_enrichment_service, "extract_factor", fake)` (Phase 5 decision recorded in STATE.md). The integration test in `test_cascade_enrichment_service.py:72` is the canonical example.
**Warning signs:** Test seems to ignore the mock and calls real Claude → 402 OpenRouter / network error.

### Pitfall 6: Frontend Phase 8 stories overload an already-499-line `PotentieLayer.stories.tsx`

**What goes wrong:** Adding 4 Phase 8 stories pushes the file past 600 lines; CI lint or future readability suffers.
**Why it happens:** Phase 7 already has 8 Phase-7 stories + 2 Phase-3 stories in this file; project rule is "files under 300 lines" but is documented as "for production code, test files commonly exceed" (Phase 6/Plan 04 SUMMARY).
**How to avoid:** Hard-decision time. Two options: (a) accept the bloat (continues current path); (b) extract Phase 8 stories into `frontend/src/stories/parcel/PotentieLayer.phase8.stories.tsx`. Recommend (b) ONLY if planner agrees Phase 8 is explicitly a new tier — otherwise (a) preserves co-location.
**Warning signs:** ESLint complexity warning; reviewer can't find the test they're looking for.

## Code Examples

Verified patterns from project source:

### Mock Anthropic Claude with call-count assertion
```python
# Source: backend/tests/ai_mocks.py:71-79
# Source: backend/tests/unit/test_factor_extraction_service.py:204,215
from tests.ai_mocks import make_mock_anthropic_client, make_tool_use_response

response = make_tool_use_response(
    tool_name="extract_woonvisie",
    tool_input={"periode_start": 2025, "periode_einde": 2030,
                "wijk_policies": [...], "algemeen_citaat": "...", "confidence": 0.9},
)
mock_client = make_mock_anthropic_client(response)
# ... after invoking extract_factor twice with DOCUMENT_SENTINEL ...
assert mock_client.messages.create.call_count == 1
```

### Monkeypatch caller-resolved import binding
```python
# Source: backend/tests/integration/test_cascade_enrichment_service.py:72-83
from app.services import cascade_enrichment_service

captured_kwargs: dict = {}
async def fake_extract_factor(db, *, factor_def, parcel_id, policy_document, **kwargs):
    captured_kwargs["parcel_id"] = parcel_id
    return ExtractedFactor[WoonvisiePayload](...)

monkeypatch.setattr(cascade_enrichment_service, "extract_factor", fake_extract_factor)

await cascade_enrichment_service.get_cascade_payloads(
    test_db, parcel_id="NL.IMBAG.Pand.X",
    gemeente_code="0983", organization_id=org.id,
)
assert captured_kwargs["parcel_id"] == DOCUMENT_SENTINEL
```

### Seed Venlo woonvisie + parcel + scan_result
```python
# Source: backend/tests/integration/test_rescore_cascade_job.py:25-115
from app.models.policy_document import PolicyDocument
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.models.area_scan import AreaScan

doc = PolicyDocument(
    organization_id=org.id, entity_type="gemeente", entity_code="0983",
    source_key="woonvisie", filename="venlo-woonvisie.pdf",
    content_type="application/pdf", file_data=b"%PDF-1.4\n%fake\n%%EOF",
    file_size=22, uploaded_by_user_id=user.id, status="parsed",
    version_number=1, is_global=False,
)
test_db.add(doc)
await test_db.commit()
```

### Storybook: pre-seed pins + render layer + assert pinned page
```typescript
// Source: frontend/src/stories/parcel/PotentieLayer.stories.tsx (Phase 7 stories)
// Source: frontend/src/test-utils/factorPinsMock.ts:19-46

import { makeFactorPin, makeQueryClientWithPins } from '@/test-utils/factorPinsMock'
import { expect, within, userEvent, waitFor } from 'storybook/test'

const queryClient = makeQueryClientWithPins(PARCEL_ID, [
  makeFactorPin('woonvisie_match', 0),
  makeFactorPin('vergunning_succeskans', 1),
  makeFactorPin('demografie_match', 2),
])

// In play function:
const canvas = within(canvasElement)
await waitFor(() => {
  expect(canvas.getByText(/GEPIND/i)).toBeInTheDocument()
  expect(canvas.getAllByTestId('pin-star-filled')).toHaveLength(3)
})
```

### Compute score with cascade_payloads (WijkPolicy shape)
```python
# Source: backend/tests/integration/test_woonvisie_match.py:186-233
from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload
from app.services.score_v3 import compute_score_v3

payload = WoonvisiePayload(
    periode_start=2024, periode_einde=2030,
    wijk_policies=[
        WijkPolicy(wijk_naam="Blerick", prioriteit="groei",
                   gewenste_segmenten=["sociaal", "midden"],
                   citaat="Blerick blijft groeigebied. 400 woningen tot 2030...",
                   pagina=24),
        WijkPolicy(wijk_naam="Venlo-Centrum", prioriteit="neutraal",
                   gewenste_segmenten=["duur", "gemengd"],
                   citaat="Venlo-Centrum wordt niet als groei- of krimpgebied aangemerkt.",
                   pagina=18),
    ],
    algemeen_citaat="Gemeente Venlo streeft naar 2800 nieuwe woningen tot 2030.",
    confidence=0.9,
)

blerick_score = compute_score_v3(
    _minimal_parcel_data("Blerick"),
    project_type="nieuwbouw_wonen",
    cascade_payloads={"woonvisie_match": payload},
).score_breakdown["woonvisie_match"].genormaliseerde_score
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `WoonvisiePayload(growth_wijken=, shrink_wijken=)` (M047/S06) | `WoonvisiePayload(wijk_policies=[WijkPolicy(...)], algemeen_citaat=, confidence=)` (Phase 6) | 2026-04-24 | Tests using old shape compile but produce neutral scores (deprecated fields retained for cache-roundtrip but not consulted by scorer) |
| `factor.waarde` as string (M047/S06) | `factor.waarde` as dict `{matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}` (Phase 6/Plan 03) | 2026-04-24 | Frontend popup consumer must read `waarde.matched_policy.citaat` not `waarde` directly |
| `CARDS_PER_PAGE=9` (Phase 7 mid-execution) | `CARDS_PER_PAGE=4` + 2x2 grid (Phase 7/Plan 05) | 2026-04-26 | All page-navigation assertions and pinned-page-overflow tests must use 4. REQUIREMENTS.md still says 6 (doc lag) |
| `MAX_PINS_PER_CATEGORY=6` | `MAX_PINS_PER_CATEGORY=4` | 2026-04-26 | Toast text "⭐ Max 4 bereikt"; story `Max4Guard` (was `Max6Guard`) |
| `pin-star` hover-only | `pin-star-filled` always-visible (pinned) + `pin-star-button` hover-only (unpinned) | 2026-04-26 | Test selectors split into two test-ids |
| `@storybook/test` imports | `from 'storybook/test'` | Storybook 10 release | Build error if old path used |
| 275 backend tests | 1709 collected (≈1625 green) | growth from M045/M046/M047/M048 | SC#5 baseline must be re-anchored |

**Deprecated/outdated:**
- `growth_wijken` / `shrink_wijken` / `excluded_project_types` on WoonvisiePayload — retained for cache-roundtrip only (Phase 6/Plan 04 decision); will be deleted in M050+ after pre-v4 caches rotate
- ROADMAP.md Phase 8 SC#5 "275 tests" — stale baseline; ignore the literal number, honor the spirit ("no regressions, +15 new")
- Phase 7 "max 6" REQUIREMENTS.md text (PIN-01, GROUP-02, TEST-07) — known doc lag, not a code bug

## Open Questions

1. **Should the SC#1 cache-dedup test invoke the rescore_cascade_job ARQ entrypoint, or stop at `cascade_enrichment_service.get_cascade_payloads`?**
   - What we know: Phase 5 SUMMARY explicitly defers the `asyncio.Semaphore(5)` concurrency-burst race to M050+. The job-level path has unit tests in `test_rescore_cascade_job.py`.
   - What's unclear: SC#1 says "upload Venlo woonvisie PDF → 2 parcelen scannen". Does "scannen" mean (a) the live ARQ rescore_parcels_for_document path, or (b) the lower-level get_cascade_payloads path?
   - Recommendation: Test at the **`get_cascade_payloads` boundary**, sequentially called twice. This aligns with Phase 5 SC#3 ("2 sequentiële scans") and avoids the documented concurrency race. Leave job-level concurrency proof as M050 work.

2. **Should the Phase 8 frontend smoke instantiate `ParcelDetailPanel` (full panel) or `PotentieLayer` (just the grid)?**
   - What we know: Phase 3's `ClickOpensPopup` story is on `PotentieLayer` — the grid component, not the full panel. ParcelDetailPanel.stories.tsx may not exist.
   - What's unclear: SC#3 says "ParcelDetailModal voor Blerick-perceel → klik Potentie tab → klik Woonvisie kaartje". The "klik Potentie tab" part requires the panel-level component (tab nav).
   - Recommendation: Reuse `PotentieLayer.stories.tsx` and document in plan that the "Potentie tab click" is implicit (the layer IS the Potentie tab content). If the planner wants the literal tab-click, ship a new `ParcelDetailPanel.phase8.stories.tsx` — but that's net-new component-test surface and adds risk. Default: stay at PotentieLayer level.

3. **Should pin-isolation across organizations be re-tested in Phase 8?**
   - What we know: Phase 7's `test_factor_pins_router.py::test_org_a_user_cannot_see_org_b_pins` already proves multi-tenant isolation at the API level.
   - What's unclear: Whether Phase 8 SC#4 implicitly re-asserts this. ROADMAP SC#4 says "user pint 3 factoren → refresh → pins blijven" — single-user.
   - Recommendation: Skip multi-tenant in Phase 8. Phase 7's API test is authoritative; Phase 8 is convergence smoke, not RBAC re-litigation.

4. **What's the exact full-suite gate command for SC#5?**
   - What we know: Phase 6/Plan 04 ran `cd backend && uv run pytest` (1693 collected, 1625 passed, 68 pre-existing failures). Frontend `pnpm check` runs `tsc -b --noEmit && eslint .`. Storybook tests run via `pnpm storybook` (or `pnpm exec vitest run --project=storybook`).
   - What's unclear: Should Phase 8 gate run Storybook play-functions in CI? `package.json` has `"build-storybook": "storybook build"` but no explicit `test:storybook` script.
   - Recommendation: Plan should call out the gate explicitly:
     - Backend: `cd backend && uv run pytest -x` (assert: 1709 collected, 0 NEW failures vs Phase-7 baseline)
     - Frontend type/lint: `cd frontend && pnpm check`
     - Storybook tests: `cd frontend && pnpm exec vitest run --project=storybook` (verify the project name matches `vite.config.ts:64` `name: 'storybook'`)
   - Open: whether to wire any of these to CI in this phase. Recommend: not in scope; document for M049+ infra milestone.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 7.x + pytest-asyncio (existing in `backend/pyproject.toml`) |
| Frontend framework | Storybook 10.2.8 + `@storybook/addon-vitest` + Playwright (browser driver) — existing in `frontend/package.json` + `frontend/vite.config.ts:51-78` |
| Backend config file | `backend/pyproject.toml` (existing) |
| Frontend config file | `frontend/vite.config.ts` (existing — `test.projects[0]` named `'storybook'`) |
| Quick run command (backend) | `cd backend && uv run pytest tests/integration/test_m048_phase8_smoke.py -x` |
| Quick run command (frontend) | `cd frontend && pnpm exec vitest run --project=storybook -t Phase8` (filter by story name) |
| Full suite command | `cd backend && uv run pytest -x` AND `cd frontend && pnpm check && pnpm exec vitest run --project=storybook` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-08 / SC#1 | 2 sequential `get_cascade_payloads` calls for different parcel_ids → 1 Claude call | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_two_parcels_one_claude_call_via_cascade_boundary -x` | NEW (Wave 0) |
| TEST-08 / SC#2 | Compose cache → score: same payload, different `parcel.wijk_naam` → diff ≥ 0.2 | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_two_parcels_different_woonvisie_scores_via_cache -x` | NEW (Wave 0) |
| TEST-08 / SC#3 | Clicking WOONVISIE card surfaces wijk-citaat AND hides algemeen_citaat | storybook play | `pnpm exec vitest run --project=storybook -t Phase8WijkCitaatNotAlgemeen` | NEW (extend `PotentieLayer.stories.tsx`) |
| TEST-08 / SC#4 | Pre-seeded pins persist across page-nav-then-back-remount | storybook play | `pnpm exec vitest run --project=storybook -t Phase8PinsPersistAcrossRemount` | NEW (extend `PotentieLayer.stories.tsx`) |
| TEST-08 / SC#4-human | Live backend → Cmd+Shift+R → pins survive | manual | dev-server visit `:9300`, pin 3 factors, hard refresh | manual-only — `08-VERIFICATION.md` human_verification block |
| TEST-08 / SC#5 | All previously-green tests still green | regression | `cd backend && uv run pytest -x` (compare passing-count vs Phase 7 baseline) + `cd frontend && pnpm check && pnpm exec vitest run --project=storybook` | EXISTING |
| TEST-08 / dict-shape contract | `factor.waarde` from cache is consumable by `compute_score_v3` AND `WoonvisiePopup` | integration + storybook | reused above two | NEW (Wave 0) |
| TEST-08 / cache-key shape | `(parcel_id="__document__", policy_document_id, factor_id, schema_version=4)` is the hit-tuple | integration regression | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_cache_key_shape -x` | NEW (Wave 0) |

**Min 15 new tests** target distribution (achievable):
- Backend integration smoke (4–5): SC#1, SC#2, cache-key shape, tenant-isolation regression, idempotency-of-second-cascade-call
- Frontend Storybook (8–10): SC#3 + SC#3-negative-fallback (algemeen_citaat shown when wijk_naam unknown), SC#4 + SC#4-pin-then-unpin, SC#4-pinned-also-on-group-page-survives-nav, SC#3-with-multiple-wijken-shows-correct-one, regression: dict-shape default value when scorer-fallback fires, regression: ESC closes popup (currently a doc'd gap from Phase 3 — could fix here)
- Optional 1–2 unit-level cross-phase contract tests (TypeScript types match Pydantic shape — could be a `WoonvisieMatchWaarde` shape test in `frontend/src/lib/types/scan.ts`)

### Sampling Rate
- **Per task commit:** quick-run command for the relevant layer (backend integration <30s; storybook play <60s for a single story)
- **Per wave merge:** `cd backend && uv run pytest tests/integration/ -x` (<3min) + `cd frontend && pnpm exec vitest run --project=storybook` (<2min)
- **Phase gate:** full backend suite green + frontend `pnpm check` green + Storybook full-suite green BEFORE `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_m048_phase8_smoke.py` — NEW file; covers SC#1, SC#2, cache-key shape, idempotency
- [ ] Helper: `_seed_venlo_woonvisie(test_db, org, user)` — extract from existing `test_rescore_cascade_job.py:_seed_policy_doc` → relocate to `tests/factories.py` if planner wants reuse, or inline
- [ ] Helper: `_VENLO_BLERICK_CENTRUM_PAYLOAD` constant — single source of truth for the Phase-6 Blerick-vs-Venlo-Centrum WoonvisiePayload (today duplicated in `test_woonvisie_match.py:test_venlo_smoke_wijk_differentiation`)
- [ ] Frontend: extend `frontend/src/stories/parcel/PotentieLayer.stories.tsx` with `Phase8/*` story-name prefix (or new file `PotentieLayer.phase8.stories.tsx` if planner prefers split — see Pitfall 6)
- [ ] `08-VALIDATION.md` per-task verification map (planner creates next; mirror `06-VALIDATION.md` structure)
- [ ] `08-VERIFICATION.md` human_verification block listing live-backend pin-refresh + visual smoke

**No framework install required.** No new dependencies.

## Sources

### Primary (HIGH confidence) — project source code, read directly

- `backend/tests/conftest.py` — fixture chain (`test_db`, `async_client`, `auth_headers`, `create_test_user`)
- `backend/tests/api_mocks.py` — httpx mock helpers
- `backend/tests/ai_mocks.py` — Anthropic Claude mock helpers (`make_mock_anthropic_client`, `make_tool_use_response`)
- `backend/tests/integration/test_cascade_enrichment_service.py` — DOCUMENT_SENTINEL caller-spy pattern (Phase 5)
- `backend/tests/integration/test_woonvisie_match.py` — Venlo smoke pattern (Phase 6)
- `backend/tests/integration/test_rescore_cascade_job.py` — seed-helper pattern (org/user/scan/parcel/policy_doc)
- `backend/tests/unit/test_factor_extraction_service.py` — `mock_client.messages.create.call_count` assertion pattern (Phase 5)
- `frontend/src/stories/parcel/PotentieLayer.stories.tsx` — Storybook play-function pattern + `within(document.body)` portal queries
- `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` — popup play-function pattern
- `frontend/src/test-utils/factorPinsMock.ts` — TanStack cache pre-seed for pins (Phase 7)
- `frontend/vite.config.ts:51-78` — Storybook+Vitest+Playwright config
- `.planning/phases/05-document-level-cache-sentinel-woonvisie/05-VERIFICATION.md` — Phase 5 outcome
- `.planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-VERIFICATION.md` — Phase 6 outcome + frontend audit
- `.planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-04-SUMMARY.md` — TypeScript dict-shape contract for Phase 3 (recapped above)
- `.planning/phases/03-woonvisie-popup/03-VERIFICATION.md` — Phase 3 outcome
- `.planning/phases/07-factor-pinning-groep-pages-6-cards-per-page/07-VERIFICATION.md` — Phase 7 outcome + 4/4 cap decision + human_verification template
- `.planning/STATE.md` — accumulated decisions for phases 1–7
- `.planning/ROADMAP.md` — Phase 8 success criteria + execution order
- `.planning/REQUIREMENTS.md` — TEST-08 + traceability
- `CLAUDE.md` — Klarifai 3-layer stack contract + ports + DB

### Secondary (MEDIUM confidence) — pattern docs

- `~/.claude/projects/.../memory/MEMORY.md` — Klarifai test patterns (rate limiter, function-scoped DB, AsyncClient)

### Tertiary (LOW confidence)

None — this phase is entirely composable from project-internal patterns. No external library research needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; zero new deps
- Architecture patterns: HIGH — every pattern is sourced from a verified file in the repo
- Pitfalls: HIGH — each pitfall is grounded in a specific Phase 5/6/7 SUMMARY decision or VERIFICATION human_verification block
- Open questions: MEDIUM — answers depend on planner judgment (e.g. Q1 ARQ-vs-cascade boundary, Q2 ParcelDetailPanel-vs-PotentieLayer)

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days — stable; only at risk if Storybook 11 lands or Phase 7 frontend file gets reorganized)

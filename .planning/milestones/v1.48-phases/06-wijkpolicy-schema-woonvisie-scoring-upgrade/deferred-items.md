# Deferred Items — Phase 06 WijkPolicy Schema + Woonvisie Scoring Upgrade

## Out-of-scope issues discovered but NOT fixed

### Pre-existing mypy errors in `backend/app/services/score_v3_factors.py` (23 errors)

- **Discovered:** Plan 06-03 lint gate
- **Type:** `Missing type parameters for generic type "dict"  [type-arg]`
- **Lines affected:** 252, 293, 324, 386, 418, 466, 548, 610, 665, 717, 806, 839, 899, 971, 1011, 1063, 1108, 1153, 1351 (19 function signatures `parcel_data: dict`) — plus a handful more
- **Cause:** Factor scoring functions take bare `dict` instead of `dict[str, Any]`.
- **Pre-existence confirmed:** `git stash && mypy` shows identical error count (23) on pre-M048 baseline
- **Scope decision:** Plan 06-03 only touched `score_woonvisie_match` + added `_normalize_wijk` / `_PRIORITEIT_SCORE_DELTA` / promoted `_PROJECTTYPE_SEGMENT_MAP`. No new errors introduced. Blanket conversion to `dict[str, Any]` is a refactor out of M048 scope.
- **Suggested future slice:** M050+ chore pass to add proper `TypedDict`s for `parcel_data` (huge impact on readability + type safety across all 21 factor functions).

### Pre-existing unit-test failures (9 tests, unrelated to Phase 6)

- **Discovered:** Plan 06-03 regression gate
- **Failing tests:**
  - `tests/unit/test_agent_service.py::TestToolUseCycle::test_single_tool_call`
  - `tests/unit/test_agent_tools.py::TestToolSchemas::*` (4 tests)
  - `tests/unit/test_claude_client.py::TestParseErrors::*` (2 tests)
  - `tests/unit/test_post_migration_model_contracts.py::test_user_scoped_models_do_not_define_organization_id`
- **Pre-existence confirmed:** `git stash && pytest` reproduces identical 9 failures on pre-M048 baseline
- **Scope decision:** None touch `score_v3_factors.py` or woonvisie. Out of Phase 6 scope.


# Deferred Items — Phase 02-admin-api-layer

## Pre-existing Ruff Issues in app/admin/eval_service.py

Found during 02-01 execution. Out of scope (pre-existing, unrelated file).

- F401: `sqlalchemy.text` unused import
- UP017: Use `datetime.UTC` alias (2 occurrences)
- UP041: Replace `asyncio.TimeoutError` with builtin `TimeoutError`

Action: Fix in a future maintenance pass or dedicated cleanup slice.

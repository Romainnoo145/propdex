# Deferred items — Phase 01 BRK datamodel + retention

Out-of-scope discoveries logged per CLAUDE.md scope-boundary policy.

## Pre-existing lint warnings (not introduced by this phase)

### B904 in `backend/app/favorites/favorites_service.py:117`

```
except (ValueError, AttributeError):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
```

Ruff B904 — should be `raise HTTPException(...) from None` (or `from err`). Existed before M050/S01. Out-of-scope auto-fix; can be cleaned in a future lint-cleanup pass.

## Pre-existing mypy `type-arg` errors

25 pre-existing mypy errors in `app/models/*` (bare `dict` / `list` annotations) — all predate M050/S01. Wave 1 documented this baseline; new code under M050/S01 is held to the stricter `dict[str, Any] | None` standard.

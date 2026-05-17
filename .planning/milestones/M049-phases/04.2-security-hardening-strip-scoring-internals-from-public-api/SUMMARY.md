# Phase 04.2 — Security Hardening (M049/S04.2)

**Shipped:** 2026-05-16
**Driver:** Pre-demo audit found the per-factor weight table (`gewicht`, `bijdrage`, `percentage_of_category`, `waarde`) was exposed verbatim in 3 public-facing endpoints. A competitor with a demo account could scrape one response and reverse-engineer the entire scoring model in an evening.

## What changed

### Backend
- `organizations.expose_score_internals BOOLEAN NOT NULL DEFAULT false` — new column. Migration `b2a4f6c8e1d3` flips existing orgs to `TRUE` at upgrade-time so paying customers see no behavioral change; new signups default to `FALSE` (redact).
- `app/scans/redaction.py` — pure `redact_score_breakdown()` helper. Strips only the 4 weight fields; preserves `genormaliseerde_score`, `data_bronnen`, `toelichting_*`, `categorie`, factor names. Handles v3.0 nested, v3.0 list, and legacy flat shapes. Returns `(payload, was_redacted)`.
- `app/auth/dependencies.py` — new `get_current_org_expose_score_internals()` dependency (single 1-column SELECT, defaults False on missing row).
- `app/scans/results_router.py` + `parcels_router.py` — wire the dependency into `list_results`, `get_parcel_scan_data`, `get_parcel_at_point`.
- `app/scans/schemas.py` — `score_breakdown_redacted: bool` field on `ScanResultItem` + `ParcelAtPointResponse`. Frontend uses this to render a "Volledige weights in Pro" badge.
- `app/middleware/rate_limit.py` — `org_rate_key()` helper that keys per-org (falls back to IP). Applied to the tile endpoint at 600/min (10/sec) — accommodates fast pan/zoom but caps gemeente-wide scraping.
- `app/main.py` — `docs_url`/`redoc_url`/`openapi_url` set to `None` when `ENVIRONMENT=production`. Removes OpenAPI introspection in prod.

### Frontend
- `src/lib/types/scan.ts` + `src/lib/api.ts` — added `score_breakdown_redacted?: boolean` to scan + at-point types.
- `src/components/map/panels/parcel/ScoreBreakdownModal.tsx` — Lock-icon badge "Volledige weights in Pro" appears in the modal header when `scoreBreakdownRedacted=true`. UI continues to function via the preserved `genormaliseerde_score` field (the layers/pills already null-tolerated the math fields).
- `src/components/map/panels/parcel/ParcelBentoOverview.tsx` — passes the new flag to the modal.

## Tests
- `tests/unit/test_score_breakdown_redaction.py` — 9 unit tests covering pass-through, redaction, UI-field preservation, immutability, v3.0 nested+list+flat shapes, false flag when nothing to strip.
- `tests/integration/test_m049_s04_2_score_internals_redaction.py` — 2 integration tests asserting the dependency wires the flag correctly into `list_results` kwargs for both default (False) and flipped (True) orgs.
- `tests/integration/test_alembic_m049_migration.py` — fixed to pin downgrade to the m049_s01 revision specifically (was relying on `head`, which broke when 04.2 stacked on top).

## Verification
- `pytest` — 42/42 green across touched suites (9 new unit + 2 new integration + 31 existing integration on touched routers/migration).
- `ruff check` — clean (5 auto-fixed import nits in modified files).
- `alembic upgrade head` — applied to dev DB successfully.
- Frontend `tsc -b --noEmit` — no new errors (pre-existing framer-motion `Easing` and `is_superuser`-in-stories issues are unrelated).

## Out of scope (intentional)
- **Rate-limit on `at-point` / `results` per org** — left at IP-based 60-120/min. Tile is the primary scraping vector; per-org tile cap is the focused defense.
- **Redacting `genormaliseerde_score`** — kept visible because layers/pills rely on it. Reverse-engineering the weight table from normalized scores alone requires correlation across thousands of parcels — a much higher friction than reading `gewicht: 13` directly.
- **Demo-signup gating / email whitelist** — separate operational concern; not a code change.

## How to flip an org
```sql
UPDATE organizations SET expose_score_internals = true WHERE id = '<uuid>';
-- or to redact (e.g. revoke a trial):
UPDATE organizations SET expose_score_internals = false WHERE id = '<uuid>';
```

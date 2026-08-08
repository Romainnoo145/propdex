# Propdex repository guide

## Purpose

Propdex is a multi-tenant property-intelligence platform with a React/Vite frontend, FastAPI backend, PostgreSQL/PostGIS, Redis, and background processing.

**Context baseline:** reconciled with committed state `d717865` on 2026-08-08. This file defines durable safety and architecture rules, not milestone status.

## Authority and freshness

Use this order when sources disagree:

1. manifests/lockfiles, schemas, migrations, configuration, tests, and current code;
2. security, operations, and current architectural contracts;
3. `DESIGN.md` for visual intent, with `frontend/src/styles/index.css` and components as exact implementation;
4. `.planning/`, research, roadmap documents, and external planning state as historical or task context only.

Tracked planning currently trails the active work. External `.gsd` state and global model memory are not required repository authority and must never be the only place a durable decision lives. If a design or plan conflicts with code, report and reconcile the drift in Git.

## Repository and toolchain

- `frontend/` — React/Vite, Node `22.12.0`, pnpm `10.27.0`, port `9300`.
- `backend/` — FastAPI, Python 3.11 and uv, port `8000`.
- PostgreSQL/PostGIS — host port `5434`, container `propdex-db`.
- Redis — host port `6380`, container `propdex-redis`.
- `partner-site/` — separate npm project; do not treat it as part of the frontend pnpm workspace.
- Root `DESIGN.md` describes the light-only Aura visual language; current CSS tokens decide exact values.

## Durable invariants

- Every query, cache key, job, object, and mutation must preserve `organization_id` tenant isolation.
- Keep schema changes in Alembic and make migrations backward-aware.
- Use existing frontend/backend provider abstractions; do not scatter direct AI, storage, or email calls.
- Keep modules cohesive and reasonably small; refactor touched complexity without unrelated code-volume churn.
- Do not enforce obsolete milestone commit prefixes or model-specific skill rituals.

## Verification

With existing dependencies and no real environment files:

```bash
corepack pnpm --dir frontend run check

cd backend
uv run --frozen --extra dev ruff check . --no-cache
uv run --frozen --extra dev mypy --no-incremental .
```

Backend tests derive and create/drop a test database. Run pytest only with an explicitly isolated disposable database and secret-free settings. Partner-site build/sync and credential-bearing provider calls are not routine verification.

## Safety boundaries

- Do not read `.env*`, expose property/client data, use embedded credential fallbacks, migrate/seed databases, push, or deploy without explicit approval.
- Preserve active lockfile and feature work; never fold unrelated changes into an instruction commit.
- No production credentials or external writes from normal agent workflows.

## Agent protocol

- Start long work with `NOW`; checkpoint after at most three tool calls or about 90 seconds.
- Use `DONE`, `NEXT`, and `BLOCKER`; announce child agents and external writes.
- Read before editing, preserve unrelated work, and report only checks actually run.

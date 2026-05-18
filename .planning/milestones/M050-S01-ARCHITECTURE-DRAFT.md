# M050/S01 — BRK Datamodel + Retention (Architecture Draft)

**Status:** DRAFT — input voor `/plan-eng-review M050/S01`
**Date:** 2026-05-18
**Upstream:** M050-ENG-PLAN.md (locked 2026-05-17, milestone-level)

---

## Slice scope

S01 levert het persistent datamodel + Alembic migratie + retention-state-machine + ARQ cleanup-cron voor BRK eigendomsdata. Geen API-endpoints, geen client-uitbreiding, geen frontend. **Foundation-only.**

**Wel:**
- Alembic migratie `zc_m050_s01_create_brk_ownership_records.py`
- SQLAlchemy 2.x model `app/models/brk_ownership_record.py`
- Retention-state-machine (Q7-LOCKED: 30d soft → 90d hard, 7y brief-tracking, rechtspersoon-only persistent)
- ARQ cron-job `brk_retention_cleanup_job.py` (daily, hard-delete waar `hard_delete_after < NOW()`)
- Unit-tests voor model + state-machine + cleanup-job

**Niet:**
- BRK Bevragen client wrapper (S02)
- Endpoints (S02)
- Frontend (S06)
- Scoring-factoren (S03)

---

## Critical Decision — BRK Tier 3 "never store"

**Bestaande code** (`backend/app/schemas/brk_ownership.py:127`):
```python
class BRKOwnership(BaseModel):
    # Class-level never_cache marker — checked by save layer before JSONB persist.
    never_cache: ClassVar[bool] = True
```
Comment: *"BRK eigendomsdata MUST NEVER be cached or stored (Kadaster Tier 3 never-store terms). This field MUST be excluded from model_dump() before DB persist."*

**M050/S01 intent:** persist BRK met retention-policy (Q7 LOCKED).

**Resolution required vóór code-werk:**

| Optie | Gevolg |
|---|---|
| **A. DPA-eerst** — verwerkersovereenkomst (4-8 wk legal-track, M050-INDEX day-1 blocker) regelt persistent storage. Code mag pas live na DPA-signed. | Slice schema lokaal/staging bouwen, production-gate via feature-flag `M050_BRK_PERSIST_ENABLED=false` tot DPA klaar. Geen blokker op slice-execution. |
| **B. Anonymized-only persist** — sla geen `eigenaar_naam` op voor natuurlijk_persoon (al uitgesloten in Pydantic), alleen rechtspersoon + KvK. Type + counts wel. | Q7 LOCKED zegt al *"rechtspersoon-only persistent"* — dit is feitelijk al de keuze. DPA dekt rechtspersoon-data toegankelijkheid. |
| **C. Geen persist, alleen replay-cache** | Conflict met scoring-cascade (S03) — factoren hebben historische data nodig voor `koopwaarde_trend`. Verwerpen. |

**Recommendation:** A + B combineren. Schema accepteert alleen rechtspersoon-records (DB constraint), feature-flag gates production-rollout tot DPA signed. `never_cache` marker in Pydantic blijft voor `natuurlijk_persoon` records (defense in depth).

**Vraag eng-review:** schema-level constraint `CHECK (eigenaar_type IN ('rechtspersoon', 'overheid'))` of service-layer filter?

---

## Datamodel — DRAFT verfijning op M050-ENG-PLAN

Milestone-plan schema (regels 25-47) verfijnd op slice-niveau:

```sql
CREATE TABLE brk_ownership_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parcel_id VARCHAR(64) NOT NULL,                 -- BAG-style ID
  eigenaar_type VARCHAR(32) NOT NULL,             -- 'rechtspersoon' | 'overheid' (CHECK)
  eigenaar_naam TEXT NOT NULL,                    -- NOT NULL (alleen rechtspersoon/overheid)
  kvk_nummer VARCHAR(8),
  statutaire_zetel TEXT,
  zakelijk_recht_type VARCHAR(32),
  aandeel TEXT,
  koopsom NUMERIC,
  koopjaar INTEGER,
  heeft_hypotheek BOOLEAN NOT NULL DEFAULT FALSE,
  raw_brk_response JSONB,                         -- debugging only, AVG-redacted
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  soft_deleted_at TIMESTAMP,                      -- Q7 retention trigger
  hard_delete_after TIMESTAMP,                    -- Q7: soft_deleted_at + 60d (totaal 90d na unfav)
  CONSTRAINT eigenaar_type_check
    CHECK (eigenaar_type IN ('rechtspersoon', 'overheid')),
  UNIQUE (organization_id, parcel_id, fetched_at)
);
CREATE INDEX idx_brk_org_parcel ON brk_ownership_records (organization_id, parcel_id);
CREATE INDEX idx_brk_hard_delete ON brk_ownership_records (hard_delete_after)
  WHERE soft_deleted_at IS NOT NULL;
```

**Wijzigingen t.o.v. milestone-plan:**
1. `eigenaar_type` CHECK-constraint (Q7 + Tier 3 enforcement bij DB-laag)
2. `eigenaar_naam` `NOT NULL` (omdat natuurlijk_persoon nooit-persistent is)
3. `heeft_hypotheek` `NOT NULL DEFAULT FALSE` (boolean nooit NULL — voorkomt 3-state bugs in scoring)
4. `ON DELETE CASCADE` op `organization_id` FK (consistent met TenantMixin pattern)
5. `hard_delete_after = soft_deleted_at + 60d` (Q7 zegt totaal 90d na unfav: 30d soft + 60d hard window)

**Vraag eng-review:** is `raw_brk_response` JSONB nodig voor debugging, of leakage-risico op natuurlijk_persoon-data die binnen raw response zit? → strip-at-write nodig?

---

## Retention state-machine

```
[live record] ──unfavorited──► [soft_deleted_at = NOW()]
                                       │
                                       │ +30d (Q7 LOCKED)
                                       ▼
                              [eligible for re-favorite without re-fetch]
                                       │
                                       │ +60d (totaal 90d)
                                       ▼
                              [hard_delete_after < NOW()] ──cron──► DELETE row
```

**Trigger voor `soft_deleted_at`:** when ALL `parcel_favorites` rows voor (org, parcel_id) zijn verwijderd.

**Open vraag eng-review:** wie zet de trigger? Drie opties:
- **A.** DB trigger op `parcel_favorites` AFTER DELETE
- **B.** Service-layer in `parcel_favorites_service.delete()` (expliciet)
- **C.** Periodic ARQ-job die unfavorited BRK-rows zonder soft_deleted detecteert

Recommendation: **B (service-layer)** — expliciet, testbaar, geen DB-trigger-magic. C als safety-net (defense-in-depth).

---

## ARQ cleanup-job

```python
# app/jobs/brk_retention_cleanup_job.py
async def brk_retention_cleanup_job(ctx: ARQContext) -> dict[str, int]:
    """Daily cron: hard-delete BRK records waar hard_delete_after < NOW()."""
    async with get_async_session() as db:
        result = await db.execute(
            delete(BRKOwnershipRecord).where(
                BRKOwnershipRecord.hard_delete_after < datetime.utcnow(),
                BRKOwnershipRecord.soft_deleted_at.isnot(None),
            )
        )
        await db.commit()
        return {"deleted_count": result.rowcount}
```

Schedule via ARQ `cron_jobs` in `app/jobs/worker.py`: daily 03:00 UTC.

**Observability:** log structured event `brk.retention.cleanup` met `deleted_count` per run. Alert als `deleted_count > 1000` (anomaly).

---

## Tests (unit + integration)

```
backend/tests/unit/models/test_brk_ownership_record.py
  ├── test_create_record_with_rechtspersoon ✓
  ├── test_create_record_rejects_natuurlijk_persoon (CHECK constraint) ✓
  ├── test_unique_constraint_org_parcel_fetched_at ✓
  └── test_cascade_delete_on_org_removal ✓

backend/tests/unit/services/test_brk_retention_state_machine.py
  ├── test_soft_delete_on_unfavorite ✓
  ├── test_hard_delete_after_calculation ✓
  └── test_re_favorite_within_30d_skips_refetch ✓ (S02 dependency — stub)

backend/tests/integration/test_brk_retention_cleanup_job.py
  ├── test_cleanup_deletes_expired_records ✓
  ├── test_cleanup_preserves_non_expired ✓
  ├── test_cleanup_idempotent ✓
  └── test_cleanup_logs_observability_event ✓
```

**Multi-tenant test (verplicht):**
```
backend/tests/integration/test_brk_multi_tenant_isolation.py
  └── test_org_a_cannot_query_brk_records_of_org_b ✓ (returns 404, niet 403)
```

---

## What already exists (geen rebuild)

| Bestaand | Hergebruik | Locatie |
|---|---|---|
| `BRKOwnership` Pydantic schema | Service-layer input type bij persist | `app/schemas/brk_ownership.py` |
| `ZakelijkGerechtigde` Pydantic | Mapping naar `BRKOwnershipRecord` velden | `app/schemas/brk_ownership.py` |
| `TenantMixin` + `TimestampMixin` | Model base | `app/models/base.py` |
| Alembic patroon (z0_m049_s01) | Migratie template | `backend/alembic/versions/z0_m049_s01_create_data_source_status.py` |
| ARQ worker + cron-jobs pattern | retention-cleanup job | `app/jobs/worker.py` |
| `propdex_test` test DB | Integration tests | `backend/tests/conftest.py` |

---

## Slice deliverables (PR-ready)

1. Alembic migratie `zc_m050_s01_create_brk_ownership_records.py`
2. SQLAlchemy model `app/models/brk_ownership_record.py` + register in `app/models/__init__.py`
3. Retention state-machine helper `app/services/brk_retention_service.py`
4. ARQ job `app/jobs/brk_retention_cleanup_job.py` + worker registration
5. Pydantic schemas voor service-layer (`BRKOwnershipRecordCreate`, `BRKOwnershipRecordRead`)
6. Tests (unit + integration + multi-tenant)
7. `npm run check` + `ruff check . && mypy .` groen
8. Feature-flag stub `M050_BRK_PERSIST_ENABLED=false` in `app/config.py`

---

## Outstanding eng-review vragen

1. **CHECK-constraint of service-layer filter** voor `eigenaar_type` Tier 3 enforcement?
2. **`raw_brk_response` JSONB:** persist-with-strip vs niet-persist?
3. **soft-delete trigger pad:** service-layer (B) + safety-net cron (C), of alleen B?
4. **Feature-flag scope:** alleen schema-creatie aan, of ook write-path gated?
5. **Hard-delete observability:** structured-log-event genoeg, of Sentry-alert bij anomaly threshold?

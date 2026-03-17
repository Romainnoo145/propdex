# T01: 82-ruling-cache-ecli-mapping 01

**Slice:** S01 — **Milestone:** M001

## Description

Create the data foundation for v13.0 Juridisch Klimaat Intelligence: the EcliRegistry module mapping 342 Dutch gemeenten to 11 rechtbanken (plus 16 pre-2013 court codes), and the RulingCache PostgreSQL table for persistent, org-agnostic court ruling storage.

Purpose: All downstream v13.0 features (geo-extraction, AI analysis, feed, explorer) depend on knowing which court handles a gemeente and having a persistent ruling store. Without this, searches continue using garbage national free-text queries.

Output: `ecli_registry.py` module, `ruling_cache.py` model, Alembic migration

## Must-Haves

- [ ] "EcliRegistry maps any of 342 Dutch gemeenten to their rechtbank court code"
- [ ] "EcliRegistry includes 16 pre-2013 court codes that merged in the 2013 reorganization"
- [ ] "ruling_cache table exists in PostgreSQL with ECLI as primary key and no organization_id"
- [ ] "RulingCache model uses TimestampMixin but NOT TenantMixin (public data)"

## Files

- `backend/app/government_apis/ecli_registry.py`
- `backend/app/models/ruling_cache.py`
- `backend/app/models/__init__.py`
- `backend/alembic/versions/xxxx_add_ruling_cache_table.py`

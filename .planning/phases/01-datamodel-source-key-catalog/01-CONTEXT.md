# Phase 1: Datamodel & Source-Key Catalog — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning
**Source:** /plan-eng-review locked-in 2026-05-14 (commit 7439e3a1)

<domain>
## Phase Boundary

Phase 1 levert de SQLAlchemy infrastructuur die de rest van M049 nodig heeft:
- Eén nieuw model `DataSourceStatus` (vendor-managed, geen TenantMixin)
- Eén Alembic migratie
- Eén nieuwe catalog-file in backend + frontend mirror voor ~27 data-source-keys

**Doel:** rest van M049 (Phase 2 API, Phase 3 UX) kan tegen dit datamodel + deze catalog aan bouwen.

**Niet in deze phase:**
- API endpoints (Phase 2)
- Frontend UX (Phase 3)
- M045 upload-integratie (Phase 4)
- Credentials (Phase 5 — daar komt `IntegrationCredential` apart)
- ActionItems deprecation (Phase 6)

</domain>

<decisions>
## Implementation Decisions (Eng-Review Locked-In)

### Datamodel — `DataSourceStatus`

- **Classname:** `DataSourceStatus`
- **Table:** `data_source_status`
- **GEEN TenantMixin** — vendor-managed catalog. Propdex BV (superuser) maintains alle rijen centraal voor alle klant-orgs. Eliminates 33 docs × N orgs duplicate-row probleem.
- **Velden:**
  - `id: UUID` PK
  - `gemeente_code: String(6)` NOT NULL — bv. `"GM0983"` (Venlo)
  - `source_key: String(64)` NOT NULL — kebab-case key uit catalog (bv. `"woonvisie"`, `"bag-panden"`, `"brk-eigendom"`)
  - `status: String(20)` NOT NULL — Literal `["live", "broken", "missing", "not_applicable"]` (validated via Pydantic enum bij schrijven; database-level CHECK constraint optioneel)
  - `last_checked: TIMESTAMP` nullable — wanneer status voor 't laatst bevestigd
  - `error_message: Text` nullable — diagnose-tekst als status=broken
  - `configuratie: JSONB` nullable — non-secret state (refresh-interval, last_synced_doc_id, retry-count). Secrets blijven in `IntegrationCredential` (Phase 5).
  - `managed_by_user_id: UUID FK Users` nullable — welke vendor-superuser deze regel laatst beheerde (audit-trail)
  - `created_at`, `updated_at` (TimestampMixin)
- **Unique constraint:** `(gemeente_code, source_key)` — één rij per gemeente-bron combinatie

### Migratie

- Alembic revision in `backend/alembic/versions/`
- Creates `data_source_status` table + indices:
  - `ix_data_source_status_gemeente_code` op `gemeente_code`
  - `uq_data_source_status_gemeente_source` composite UQ
- `down_revision` = `bbdb5c6ff811` (huidige head)
- Lege tabel — geen data-backfill
- `down()` drops table cleanly

### Catalog files

- **Backend:** nieuwe file `backend/app/policy_documents/data_source_keys.py`
- **Frontend mirror:** nieuwe file `frontend/src/lib/constants/dataSourceKeys.ts`
- **NIET extenden bestaande `source_keys.py`** — naming-confusion-risk (cascade-level keys vs data-source-type keys zijn verschillende concepten)
- Structuur per entry:
  - `key: str` — kebab-case unique identifier
  - `label_nl: str` — Nederlandse displaynaam
  - `source_type: Literal["A", "B", "C"]` — A=cascade-upload, B=open-api, C=paid-integration
  - `description: str` — 1-zin uitleg
  - `voedt_factor: list[str]` — welke scoring-factor(en) deze bron voedt (optioneel, voor admin-context)
- **27+ entries verdeeld over 3 types:**
  - Type A (cascade-uploads): woonvisie, omgevingsvisie, huisvestingsverordening, welstandsnota, parkeerbeleid, duurzaamheidsbeleid, erfgoedverordening, omgevingsverordening (prov), provinciale-omgevingsvisie, woondeals, prov-erfgoed, prov-natuur-stikstof, energietransitie-res, mobiliteitsbeleid, raadsinformatie, leegstandsverordening, gemeentelijke-subsidies, provinciale-subsidies, grondprijsbeleid, omgevingsplan-bouwregels, **bron: `.planning/CASCADE-DOCUMENT-MAPPING.md`**
  - Type B (open APIs): bag-panden, bag-adressen, 3d-bag, kadaster-cadastral, cbs-statline, bodemloket, pdok-funderingsrisico, pdok-natura2000, rws-overstroming-wms, rivm-geluid-lden, rivm-luchtkwaliteit, sru-bekendmakingen, rechtspraak-jurisprudentie, dso-omgevingsplan, koop-sru-cvdr, rce-rijksmonumenten, ep-online-energielabel
  - Type C (paid integrations): brk-eigendom, brk-hypotheek, brk-beslag, nvm-transactiedata, kadaster-nhr, vindsubsidies, funda-enrichment, wws-huurpunten
- Total target: ~45 entries (mag iets minder zijn als sommige consolideerd worden)

### Tests

- **Test bestand:** `backend/tests/unit/test_data_source_status_model.py` (of vergelijkbaar pad volgens project-conventie)
- **Coverage targets:**
  1. Model-creation roundtrip met alle velden
  2. UQ duplicate-insert raises IntegrityError
  3. Status enum-validation (invalid status → ValidationError op Pydantic-laag)
  4. JSONB `configuratie` roundtrip (empty + populated)
  5. Catalog completeness assertions:
     - `len(DATA_SOURCE_KEYS) >= 27`
     - Alle 3 source_types A/B/C vertegenwoordigd
     - Geen duplicate keys
     - Elke entry heeft niet-lege `label_nl`
  6. Frontend mirror sync test (Python catalog count == TS catalog count, key-set match)
- **Superuser-RBAC test:** placeholder in `backend/tests/integration/test_admin_data_sources_rbac.py` — dummy route met `Depends(require_superuser)`, regular user→403, superuser→200. Actual route komt in Phase 2 maar de RBAC-helper-test bewijst de pattern werkt.

### Migration-test

- `backend/tests/integration/test_alembic_migration.py` of inline: smoke-test dat `alembic upgrade head` + `alembic downgrade -1` clean draait op `propdex_test` zonder errors.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements + roadmap

- `.planning/REQUIREMENTS.md` — DATA-01, DATA-02, DATA-03, TEST-01 (full specs)
- `.planning/ROADMAP.md` — Phase 1 success criteria + eng-review decisions block

### Reference implementations (M045/S05 patterns)

- `backend/app/models/policy_document.py` — TenantMixin example (we doen het ANDERS, maar zelfde model-structuur als referentie)
- `backend/app/policy_documents/source_keys.py` — bestaande cascade-level catalog (DON'T extend; gebruik als naming/structuur referentie)
- `frontend/src/lib/constants/dataSources.ts` — bestaande frontend mirror voor cascade-level catalog (DON'T extend; gebruik als structuur referentie voor nieuwe `dataSourceKeys.ts`)

### Reference catalog content

- `.planning/CASCADE-DOCUMENT-MAPPING.md` — 33 cascade-documenten verdeeld over milestones, dient als bron voor type A keys
- `~/.gstack/projects/Romainnoo145-propdex/complete-milestone-landscape-20260418.md` §"Deel 3 — Unified Scoring Data-Source Inventory" — volledige inventaris van alle 27+ bronnen (alle 3 types)

### Alembic head

- Current head: `bbdb5c6ff811` (unchanged sinds M046)
- Nieuwe revision in M049/Phase 1 wordt eerste bump sinds M048 phases

### Project conventions

- `./CLAUDE.md` — Propdex three-layer workflow + harde regels + multi-tenant security baseline
- Commits: `M049/S01: <wat>` format (per CLAUDE.md harde regels)

</canonical_refs>

<specifics>
## Specific Ideas

### Catalog source — gebruik landscape doc §3

De landscape doc heeft de complete inventaris in een 3-secties tabel-structuur (Actief-functioneel, Broken-sparse, Ontbrekend-toe-te-voegen). Deze tabellen direct mappen naar Python entries + frontend TS objects.

### Status enum — KISS

4 states `["live", "broken", "missing", "not_applicable"]` is voldoende voor MVP. Latere states (`"stale"`, `"configuring"`) kunnen later. Niet vooruit-engineering.

### Migration safety

- Pure additive (nieuwe tabel) — geen data-loss risk
- Productie heeft 0 rijen — geen backfill
- Down() drops tabel — clean

### Frontend mirror sync

M045/S05 pattern: hand-maintained twin (Python en TS files met identieke key-set). Voorzie een test (Python ↔ TS count match) zodat drift detectable wordt. Geen OpenAPI codegen — overkill voor deze scope.

</specifics>

<deferred>
## Deferred Ideas

Items expliciet uitgesteld:

- **Status enum uitbreiden** met `"stale"`, `"configuring"`, `"rotating"` — wacht tot bewezen-nodig in Phase 2/3
- **Postgres native ENUM type** in plaats van String — adds migration-friction, String + Pydantic validation is voldoende
- **Audit-log voor status-transitions** — Phase 5 voegt audit toe voor credentials; Phase 2 kan dezelfde pattern uitbreiden naar status changes
- **Catalog OpenAPI codegen / shared TypeScript-Python types** — M045/S05 deed hand-maintained twin succesvol; consistent blijven met MVP
- **Per-org credential overrides (BYOK enterprise feature)** — future M0XX milestone, niet Phase 5 MVP

</deferred>

---

*Phase: 01-datamodel-source-key-catalog*
*Context gathered: 2026-05-14 via /plan-eng-review lock-in (no separate /gsd:discuss-phase needed)*

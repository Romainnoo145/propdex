# Data-bronnen Scope Consolidation — Unified scope picker (retire beleid-beheer)

**Date:** 2026-06-02
**Status:** Approved (design) — pending implementation plan
**Topic:** Make Data-bronnen the single home for all policy documents (Landelijk + Provinciaal + Gemeente) and retire the redundant `beleid-beheer` settings tab.

---

## Context & problem

The M049 Data-bronnen hub was meant to absorb policy-document management, but only the **gemeente** level was migrated. Today there are two overlapping admin surfaces:

- `/instellingen/data-bronnen/$gemeenteCode` — per-gemeente catalog (type-A docs + type-B open APIs + type-C paid integrations), with status + upload + version history + view/download.
- `/instellingen/beleid-beheer` (`InstellingenBeleidPage`) — document management at **all three levels** (Landelijk + Provinciaal + Gemeente). It already shows a banner pushing gemeente-docs to Data-bronnen, but **Landelijk + Provinciaal management lives only here**.

So beleid-beheer is only *partially* redundant. The goal is to finish the migration: move Landelijk + Provinciaal into Data-bronnen, then retire beleid-beheer.

**Not in scope / stays:** the user-facing `/beleid` hub (Configuratie: Landelijk/Provinciaal/Gemeentelijk + subsidies levels, linked from SideRailNav + the map's BeleidscontextCard). It is a primary feature surface, not an admin duplicate. (Future idea, captured separately: make `/beleid` *actionable* rather than a passive document store — out of scope here.)

## Key constraint (shapes the whole design)

**Landelijk and Provinciaal are document-only.** There are no type-B open APIs or type-C paid integrations at those levels — those are all per-gemeente coordinate/credential queries. So L/P scopes show only type-A document rows.

## Goal

One Data-bronnen hub with a scope switcher (`Landelijk · Provincie · Gemeente`). Gemeente keeps its full A/B/C catalog; L/P show their document rows. `beleid-beheer` route + `InstellingenBeleidPage` removed. No DB migration.

---

## Design

### 1. IA & routing

- The gemeente picker becomes a **scope switcher**: `Landelijk | Provincie | Gemeente`.
- Route generalizes from `…/data-bronnen/$gemeenteCode` → `…/data-bronnen/$entityType/$entityCode`
  (`entityType ∈ {landelijk, provincie, gemeente}`).
  - Landelijk: single entity (e.g. `entityCode = "NL"` / the existing landelijk code).
  - Provincie: per-province code; Gemeente: per-gemeente code (as today).
- **Backwards-compat redirect:** old `…/data-bronnen/$gemeenteCode` (matching `GM\d{4}`) redirects to `…/data-bronnen/gemeente/$gemeenteCode` so existing links/bookmarks don't break.
- Selecting a scope:
  - **Gemeente** → full catalog (A + B + C) — unchanged behaviour.
  - **Provincie / Landelijk** → only type-A document rows for that level.

### 2. Backend — minimal generalization, NO migration

- **Catalog level-tagging:** add `level: Literal["landelijk","provincie","gemeente"]` to `DataSourceKeyEntry` for type-A entries. Type-B/C are implicitly `gemeente`. A regression test asserts every type-A entry has a `level`.
- **Generalized read endpoint:** `GET /api/admin/data-sources/{entity_type}/{entity_code}`.
  - Determines applicable catalog entries by scope: gemeente → all (A+B+C); provincie/landelijk → type-A entries with matching `level`.
  - Per entry, compute status:
    - **type-A (all levels):** live iff a vendor `PolicyDocument(entity_type, entity_code, source_key, is_global=True)` exists — a generalization of the existing `probe_type_a_cascade` (which already does this, currently hard-scoped to `entity_type='gemeente'` / `gemeente_code`). Pass `entity_type` + `entity_code` through instead.
    - **type-B / type-C (gemeente only):** unchanged — existing `DataSourceStatus` + probe path.
  - **Status persistence decision:** L/P type-A status is **computed live** from `PolicyDocument` presence and synthesized into rows (no `DataSourceStatus` rows for L/P). `DataSourceStatus` stays gemeente-scoped → **no schema migration**.
- **Existing gemeente endpoints** (`/gemeenten`, `/{gemeente_code}`) either kept as-is or thin-wrapped by the generalized endpoint; opportunistic gemeente probes unchanged.
- Upload / version / view / download already work for any `entity_type` (policy-documents router is entity-generic; view/download wired 2026-06-02, commit d8b2f9a4).

### 3. Retiring beleid-beheer

After L/P render in Data-bronnen:
- Delete route `/_authenticated/instellingen/beleid-beheer` + `InstellingenBeleidPage`.
- Remove its entry from `SettingsTabNav`.
- Repoint the `DataSourcesEmptyState` link (currently → beleid-beheer) to the relevant Data-bronnen scope.
- **Keep** `UploadDocumentModal` + `VersionHistoryPanel` (reused by Data-bronnen).
- **Keep** the `/beleid` route + components untouched.

### 4. Testing

- Backend unit: catalog level-tagging coverage (every type-A entry has a `level`); generalized endpoint returns correct row-set per scope; L/P type-A live-status derived from `PolicyDocument`.
- Frontend: scope-switcher renders correct row-set per level (gemeente = A+B+C, L/P = A-only); old `GM\d{4}` URL redirects to `…/gemeente/$code`.
- Regression: existing gemeente data-sources tests stay green (gemeente path unchanged).

## Success criteria

1. Data-bronnen has a working `Landelijk · Provincie · Gemeente` scope switcher.
2. Landelijk + Provinciaal document rows (status + upload + version + view/download) are managed entirely within Data-bronnen.
3. Gemeente view is behaviourally unchanged (full A/B/C catalog).
4. `beleid-beheer` route + tab + `InstellingenBeleidPage` removed; old gemeente URLs redirect; no dead links.
5. `/beleid` hub untouched and working.
6. `npm run check` no worse than baseline; backend `ruff` + tests green; no DB migration.

## Out of scope

- The `/beleid` user-facing Configuratie/subsidies hub (stays).
- Making `/beleid` "actionable" (future idea — separate todo).
- Any type-B/C support at Landelijk/Provinciaal level (they have none).
- Generalizing `DataSourceStatus` to (entity_type, entity_code) — explicitly avoided.

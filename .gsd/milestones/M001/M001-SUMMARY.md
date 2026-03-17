---
id: M001
provides:
  - "Full property intelligence pipeline: address → structured report with kadaster, zoning, heritage, AI analysis"
  - "Area scan with opportunity scoring, parcel caching, and MVT tile rendering"
  - "Jurisprudentie explorer with AI juridisch klimaat analysis"
  - "Fysiek Risicoprofiel: foundation risk, soil, asbestos, contamination"
  - "Meldingen intelligence: bekendmakingen geocoded to parcels"
  - "Portfolio favorites with parcel identity unification (parcel_code + FK)"
  - "Industrial Amber design system, persistent MapLibre map, mobile responsive"
  - "275+ backend tests, 74% coverage, RLS enforcement"
key_decisions:
  - "Map-first UI over dashboard — the map IS the app"
  - "Three-tier data cache (DB/JSONB/BRK) balances freshness vs API load"
  - "Amber-only risk badges — never red for indicative assessments"
  - "Worst-of risk aggregation excluding onbekend"
  - "PDOK WMS raster for parcels (not vector tiles)"
  - "PostGIS spatial joins for parcel matching"
  - "ARQ background jobs for AI analysis with polling"
patterns_established:
  - "PropertyReportResponse as central schema flowing from aggregator through save to PDF"
  - "PDOK OGC API batch lookup with asyncio.Semaphore concurrency"
  - "Multi-strategy address extraction (5 regex patterns)"
  - "ChangeReadState model (absence = unread, insert/delete rows)"
  - "useMapLayerState centralized toggle state machine"
observability_surfaces:
  - "275 backend tests (104 unit + 171 integration)"
  - "ARQ worker health via Redis"
  - "Scan progress stepper in UI"
requirement_outcomes: []
duration: "~13 slices over multiple sessions"
verification_result: passed
completed_at: 2026-03-17
---

# M001: Migration

**Built the complete Propdex property intelligence platform from v1.0 through v17.0 — address-to-report pipeline, area scanning, map visualization, jurisprudentie analysis, physical risk profiling, and portfolio favorites with parcel identity unification.**

## What Happened

13 slices delivered incrementally, each building on the last. S01-S03 established the data foundation: ruling cache with ECLI mapping, geo-contextualization of rulings to gemeenten, and AI-powered doorlooptijd analysis. S04-S05 built the jurisprudentie explorer with faceted search and trend statistics. S06-S08 added physical risk intelligence: soil data from BRO, foundation risk engine, and refined asbestos assessment. S09 surfaced the Fysiek Risicoprofiel in the frontend. S10-S13 built the portfolio system: favorites backend, heart button extraction, portfolio navigation, and parcel identity unification linking favorites to cached parcel data.

S14 (Pipeline Stages) and S15 (Map Markers) were superseded by the M002 product vision — pipeline management absorbed into the new Opgeslagen view, and map markers carry forward to Kansenkaart.

## Cross-Slice Verification

Each slice was verified via its own test suite and integration checks. S13 (final completed slice) confirmed parcel_code coverage at 99.97% of queryable rows and 100% FK linkage via live database JOINs.

## Requirement Changes

No requirements changed status during M001 closeout. All 16 validated requirements were validated during their respective slice completions.

## Forward Intelligence

### What the next milestone should know
- The Projecten page is dead — M002 kills it. All portfolio/pipeline work moves to a new Opgeslagen view.
- Navigation simplifies from 5 items to 3 (Kaart + Opgeslagen + Jurisprudentie). Jurisprudentie stays — its wizard explorer is a different interaction model that can't live on the map. The existing SideRailNav will need a rework.
- parcel_favorites has a working FK to parcel_cache via parcel_cache_id — M002 can JOIN to get geometry, address, and enrichment data for favorited parcels.
- The map is the entire product surface going forward — gemeente intelligence needs a new left panel (~400px) alongside the existing right panel.

### What's fragile
- BAG WFS fetch failure in area_scan.py is silent — causes entire scan to produce garbage data. This hasn't been fixed.
- PDF export status is unknown after v7.x data additions — needs audit.
- Parcel count pre-check is disabled due to CRS mismatch between CBS bbox and BAG WFS.

### Authoritative diagnostics
- Backend test suite (275 tests) — run with `pytest` from backend directory
- Alembic migration chain — check `alembic history` for schema state
- parcel_cache/parcel_favorites FK linkage — query `SELECT COUNT(*) FROM parcel_favorites WHERE parcel_cache_id IS NOT NULL`

### What assumptions changed
- Pipeline stages on Projecten page assumed Projecten would survive — product vision killed it in favor of dual-panel map + Opgeslagen
- Map markers for favorites assumed they'd ship in M001 — deferred to M002 Kansenkaart

## Files Created/Modified

- Too many to list individually across 13 slices — see individual slice summaries (S01-S13) for detailed file lists.

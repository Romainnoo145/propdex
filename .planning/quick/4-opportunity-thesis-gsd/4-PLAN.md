# Quick Task 4: Opportunity Thesis (GSD)

**Date:** 2026-02-25  
**Type:** Strategic product blueprint (phase-ready)

## Goal

Build a repeatable engine that ranks Dutch parcels on **real redevelopment potential** and sells that intelligence to developers, builders, and investors.

This document is the source of truth for:
- what we can prove now,
- what we can only infer,
- which signals to build next,
- and how that maps to upcoming phases.

---

## North Star

From one wijk click to a defensible, explainable list of parcels with:
- vacancy likelihood,
- buildability constraints (FAR/bebouwingspercentage where available),
- aggregation potential (multi-parcel),
- and actionability for a specific buyer persona.

---

## What Exists Today (Hard Facts)

Current scan/ranking uses:
- BAG: building presence, status, construction year.
- PLU WMS: bestemming + partial maatvoering extraction.
- Geometry: parcel size and location.
- Score transparency: factor breakdown + vacancy signal + opportunity signals.

Current limitation:
- We detect `leeg_perceel` and some `leegstaand_pand` patterns.
- We do **not** directly know internal/partial vacancy (empty floors, low occupancy) from one authoritative public API.

---

## Evidence Model (Non-Negotiable)

Every signal must be tagged with evidence level:
- `HARD`: explicit in authoritative source.
- `PROXY`: strong indirect indicator.
- `SPEC`: speculative/experimental indicator.

No mixed scoring without label.  
No sales claim without evidence level.

---

## Signal Catalog v1 (Build Queue)

1. `empty_land` (HARD)  
Source: BAG `has_pand=false`  
Value: immediate greenfield/repositioning opportunities.

2. `vacant_building_status` (HARD/PROXY)  
Source: BAG `pand_status`  
Value: detects non-in-use/sloop contexts.

3. `zoning_build_intensity` (HARD where present, else PROXY)  
Source: PLU `maatvoering` parsing  
Value: FAR/bebouwings% envelope for upside.

4. `listing_duration` (PROXY)  
Source: market listings snapshots (te koop/te huur over time)  
Value: stale listings = motivated sellers / friction assets.

5. `permit_trajectory` (PROXY)  
Source: bekendmakingen + permit categories over time  
Value: renovation/sloop/functiewijziging pressure.

6. `ownership_change_pressure` (PROXY/HARD hybrid)  
Source: BRK (where licensed), transaction traces  
Value: ownership churn and likely dealability.

7. `assemblage_potential` (PROXY)  
Source: adjacency graph + same risk profile neighbors  
Value: multi-parcel play, bigger ticket opportunities.

8. `underused_commercial` (PROXY)  
Source: combined status + permits + listing + age patterns  
Value: office/retail conversion targeting.

---

## Phase Map (Proposed)

### Phase 57: Evidence Layer + Signal Registry

Deliverables:
- Formal `signal_registry` (id, source, evidence_level, ttl, owner).
- UI/API exposure of evidence level per parcel signal.
- Score engine reads from registry, not hardcoded assumptions.

Done when:
- Every surfaced signal has evidence label.
- “Why this parcel?” panel shows source + evidence.

### Phase 58: Market Friction Signals

Deliverables:
- Listing snapshot ingestion (daily/weekly).
- `listing_duration_days` and `price_change_count`.
- Proxy vacancy signal enrichment.

Done when:
- Ranking can filter on listing-duration bands.
- We can show stale-listing hotspots by wijk.

### Phase 59: Permit + Vacancy Confidence Model

Deliverables:
- Feature model combining BAG + listing + permit behavior.
- `vacancy_confidence` score (0-1) with explanation.

Done when:
- Parcel cards show confidence + top 3 reasons.
- False-positive review set is trackable.

### Phase 60: Assemblage Intelligence

Deliverables:
- Parcel adjacency graph.
- Cluster ranking (single parcel vs assemblage opportunity).
- “Buy 3 nearby parcels” scenarios.

Done when:
- Wijk overlay can highlight assemblage clusters.
- Export includes cluster id and aggregate potential.

### Phase 61: Commercial Data Productization

Deliverables:
- Persona bundles: developer / builder / investor views.
- API/CSV product packs with evidence labels.
- Report templates focused on monetizable insights.

Done when:
- Same parcel can be packaged differently per buyer type.
- Sales demo can show clear value delta per persona.

### Phase 62: Feedback Loop + Revenue Analytics

Deliverables:
- Outcome tracking (won/lost/dead leads).
- Signal-to-conversion attribution.
- Quarterly weight recalibration process.

Done when:
- We know which signals actually predict deals.
- Ranking weights are data-driven, not intuition-only.

---

## Guardrails

- No “AI magic” claims without traceable evidence.
- Keep expensive sources behind qualification gates.
- Keep legacy scans reproducible (versioned scoring profile).
- Always separate `rank_for_research` from `rank_for_sales`.

---

## GSD Weekly Cadence

1. Monday: add/adjust one signal with evidence label.  
2. Wednesday: validate on one real wijk (Arcen baseline set).  
3. Friday: decide keep/drop based on precision and deal relevance.

If a signal does not change decisions, remove it.

---

## Fast Rekindle Prompt

Use this when restarting strategy discussion:

> “Open Quick Task 4 (Opportunity Thesis GSD). Start from Phase 57 scope, preserve evidence model (HARD/PROXY/SPEC), and propose the next smallest deployable slice that improves parcel ranking quality for Arcen-like wijken.”


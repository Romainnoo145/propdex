---
created: 2026-04-19T18:50:00.000Z
title: Funda ingestion productify — schaal funda_snapshot.py voor echte market_signals data
area: backend
files:
  - backend/app/jobs/funda_snapshot.py
  - backend/app/services/funda_listing_ingestion.py
  - backend/app/jobs/area_scan.py:665
  - backend/app/services/score_v3_factors.py:278 (score_funda_frictie)
---

## Problem

Funda-frictie factor (P5, gewicht=5) is 100% inactief op alle 63,817 scan_results — niet
omdat de factor-logica fout is maar omdat er **geen data** is:

- `funda_listing_snapshots` table: **5 rows ooit** (single PoC run 2026-02-27)
- `scan_results.flags->market_signals`: **0/63,817 niet-null** (0.0% dekking)
- Write-path zit in `area_scan.py:665` en werkt correct — alleen: `build_funda_listing_signal_map`
  (funda_listing_ingestion.py:385-445) queryt `funda_listing_snapshots` met `matched_parcel_id IN (...)`.
  Als die table leeg is, blijft `market_signals=None`.

M046-ROADMAP claimde dat een job `backend/app/jobs/funda_enrichment.py` bestond om deze data
te populeren, maar die file bestaat niet — daar zit scope-confusion op roadmap-niveau.

M046/S03 heeft de factor-narrative eerlijk gemaakt ("Funda-data niet beschikbaar (pilot-fase)"),
maar de echte activering van 5 scoregewicht vereist Funda-data op schaal.

## Solution

**Fase 1 — Onderzoek funda_snapshot.py capabilities:**
- Kan de job een hele gemeente scrapen of alleen per-adres lookups?
- Wat zijn Funda rate limits / anti-bot risico's?
- Hoeveel listings verwachten we voor een pilot-gemeente (Venlo ~150K inwoners)?

**Fase 2 — Pilot op Venlo:**
- Draai `funda_snapshot.py` over Venlo om funda_listing_snapshots te vullen (target: 100-500 listings)
- Verifieer `_match_parcel_for_listing` matching-rate (address text matching naar ParcelCache)
- Meet: hoeveel van de Venlo-scans krijgen `market_signals` na een rescan?

**Fase 3 — Backfill of rescan beslissing:**
- Optie A: Bouw een backfill-tool die alleen market_signals populeert in bestaande scan_results
  (geen full rescan, ~30min werk in Python)
- Optie B: Volledige rescan van gemeente — duurder maar alle enrichments refreshed

**Fase 4 — Monitoring:**
- Dashboard: hoeveel % scans heeft market_signals, per gemeente
- Alert als ingestion stilvalt (laatste snapshot > X dagen geleden)
- Success-threshold: bv. ≥20% van scans met market_signals per gemeente vóór groenlicht

**Scope:** Dit valt **buiten M046** (scoring fundament opschonen). Hoort waarschijnlijk in:
- M058 Ground-truth kalibratie (data-uitbreiding)
- OR aparte M0xx Funda-data-integratie slice
- OR workstream parallel aan M047+ (data-onderhoud)

**Niet-scope:** geen factor-logica wijzigen (staat al correct). Focus = data pipeline.

Reference: memory/scoring-roadmap-active.md + M046/S03 commit (b5b1704).

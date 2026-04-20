# TODO: M046-brede scan_results backfill na afronden alle slices

**Captured:** 2026-04-20 tijdens M046/S06 T06 verificatie
**Target:** NA alle M046 slices gemerged (S01+S02+S03+S04+S05+S06). Niet per-slice backfillen — anders blijven we iteratief backfillen.

## Probleem

Bestaande `scan_results` in de DB zijn van 2026-03-01 (pre-M046). Alle
slices in M046 wijzigen **factor-logica en/of narratives** maar veranderen
geen schema:

- **S01** RM-1: `vergunnings_succeskans` + `juridisch_klimaat` filteren op dev-types
- **S02** BUG-2: `vrije_grond` shape-ratio guard voor strook-percelen
- **S03** SNF-4: `funda_frictie` narrative eerlijk over pilot-state
- **S04** BUG-1: `_best_bestemming_type` count-voting (raakt `segment_match` + `bestemmingswijziging`)
- **S06 F1** (post-plan): `succeskans_*` structured fields in FactorResult
- **S06 F3** (post-plan): primary_bestemming_type exposed (geen scan_results impact want at-point recomputeert)

Fixes zitten in de code, maar **oude scan_results dragen pre-M046 narratives
en factor-scores**. Een Venlo-gebruiker ziet tot re-scan:
- oude "Geen marktgegevens" ipv "pilot-fase" (S03)
- oude ongefilterde succeskans (S01) — kritiek: 36% vs 75% differentie
- oude "wonen" voor mixed bestemmingen (S04 via score_breakdown)

## Oplossing

Draai `backend/app/tools/backfill_scan_scores_v3.py` over alle bestaande
scan_results. De tool:
- Leest parcel_data + neighborhood_metrics uit cache/DB
- Recomputes `compute_score_v3()` met fresh factor-logica
- Writes updated `flags.score_breakdown` + top-level score-velden terug

**Timing**: pas draaien NA alle M046 slices PR-gemerged. Anders:
- Backfill met S01 fix → S02 merget → alles backfillen weer
- Verspilling van compute + risico op partiële state tijdens iteratie

## Planning

1. Merge PRs: S01 #2 (open), S02, S03, S04, S06 (bundled) — alle pending
2. Merge S05 als die ook klaar is (RCE monumenten)
3. Staging-run backfill op `propdex_dev` — verify diff vs baseline
4. Production-run op `propdex` — idealiter buiten drukke uren
5. Smoke-test: open een paar bekende parcels in UI, verify S06 signalen
   (missing-badge, wijk-breed tag, narratives) tonen nieuwe state.

## Dependencies

- `backfill_scan_scores_v3.py` werkt met huidige schema (bbdb5c6ff811) ✓
- Geen Alembic-migratie nodig — puur JSONB herschrijven
- CLAUDE.md: gebruik project startup-scripts, NOOIT handmatig services

## Files

- `backend/app/tools/backfill_scan_scores_v3.py` (bestaand, bumped tijdens S01)
- `backend/app/services/score_v3.py` (aangepast S06 F1)
- `backend/app/services/score_v3_factors.py` (aangepast S01/S02/S03/S04/S06 F1)

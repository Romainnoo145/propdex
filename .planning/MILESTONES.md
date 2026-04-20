# Milestones

## M046 Scoring Fundament Opgeschoond (Shipped: 2026-04-20)

**Status:** ✅ Complete — 6/6 slices shipped in 2 dagen (kickoff 2026-04-19, ship 2026-04-20)

**Scope:** 58 scoregewicht opgeschoond op Score v3.0. Bug-fix rigor; geen schema-wijziging (Alembic head `bbdb5c6ff811` unchanged).

**Slices shipped:**
- **S01** RM-1 — `vergunning_succeskans` dev-type filter (gewicht 21). Jurisprudence-aggregator filtert nu op nieuwbouw/sloop/bestemmingswijziging/uitbreiding; dakkapellen/milieu-bezwaren verwateren de succeskans niet meer.
- **S02** BUG-2 — `vrije_grond` shape-ratio guard (gewicht 12). Strook/wegvormige percelen (perimeter/sqrt(area)>10) krijgen geen valse "100% vrije grond" meer.
- **S03** SNF-4 — `funda_frictie` narrative eerlijk over pilot-state (gewicht 5, capped).
- **S04** BUG-1 — `_best_bestemming_type` count-voting + priority tie-breaker (gewicht 20 via `segment_match` + `bestemmingswijziging`). Mixed parcels [verkeer, verkeer-verblijf, wonen] worden nu correct als "verkeer" geclassificeerd ipv optimistisch "wonen".
- **S05** BUG-3 — `score_monument` via RCE-register wire-up. RCE-client + aggregator bestonden al; area_scan pipeline roept ze nu aan. Keyword-match blijft fallback bij API-down. ⚠ Operational blocker: `api.rijksmonumenten.info` 403 — feature-benefit gerealiseerd zodra API-access geregeld.
- **S06** OBS-2 — Frontend eerlijkheid: missing-data badge (>2 factoren ontbreken → "Beperkte data" pill naast parcel_code), expandable FactorCards in ScoreBreakdownModal met S01/S03 metadata inline, sage-mint wijk-breed tag voor CBS-factoren. Plus post-plan backend patches (F1: `FactorResult` S01-velden, F3: `primary_bestemming_type` exposed → sluit S04 UI-parity gap).

**Key numbers:**
- 6 PRs gemerged (#2-7) naar main
- 171 backend score_v3 + iron-rule tests groen (was 163 pre-M046)
- 63760 scan_results re-computed via `backfill_scan_scores_v3.py` — nieuwe narratives + S04 count-voting + S06 F1 velden live in productie
- Alembic head unchanged

**Pre-M046 beslissingen (2026-04-19 locked):**
- F1 scope-expansion split per-milestone (niet bulk vooraf)
- I-01 infrastructuur gesplitst (mailserver eerst, OAuth+Stripe laatst)
- Ground-truth skip tot M058

**Open tech-debt:**
- S05 RCE API 403 blocker (`.planning/todos/pending/2026-04-20-s05-rce-api-403-access-blocker.md`) — 4 oplossingsrichtingen geïdentificeerd
- Scoring-weights-recalibration (pre-M047 herijking van gewichten + drempels op historische distributie)
- KlimaatLayer gemeente-verdict bug (M048 Frontend Scaling)

**Roadmap-artefact:** `~/.gsd/projects/0fbd70b53f1b/milestones/M046/M046-ROADMAP.md` + slice-folders met CONTEXT/PLAN/TESTS per slice

---

## M045 Unified Document Model (Shipped: 2026-04-18)

**Phases completed:** 0 phases, 0 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---


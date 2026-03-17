# T01: 86-trend-statistics 01

**Slice:** S05 — **Milestone:** M001

## Description

Add a trend endpoint that returns rolling 12-month klimaat score data and aggregated statistics per gemeente.

Purpose: Provides the data layer for TREND-01 (monthly score trend) and TREND-02 (aggregated statistics bar). The frontend plan (86-02) will consume this endpoint.
Output: Single new endpoint in existing jurisprudence router.

## Must-Haves

- [ ] "GET /api/jurisprudence/trend/{gemeente_naam} returns monthly buckets with klimaat_score, outcome counts, and avg_doorlooptijd"
- [ ] "Summary object includes total_rulings, avg_doorlooptijd, succes_pct, and months_with_data"
- [ ] "Only months with actual rulings are returned (no zero-filled gaps)"
- [ ] "Rolling 12-month window filters out older data"

## Files

- `backend/app/api/endpoints/jurisprudence.py`

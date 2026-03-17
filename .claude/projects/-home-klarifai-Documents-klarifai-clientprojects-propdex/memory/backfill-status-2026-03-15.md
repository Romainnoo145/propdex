---
name: backfill-status-2026-03-15
description: Background backfill processes running for Venlo — address enrichment + EP-Online energielabel
type: project
---

Two chained backfill processes running in background (started 2026-03-15 ~04:56):

**1. Address enrichment** (`backfill_address_turbo --gemeente Venlo`)
- Log: `/tmp/backfill_turbo.log`
- Status: 19/21 wijken done, ~31,943 parcels enriched with vergunningen + funderingsrisico
- Look for `TURBO COMPLETE` in log to confirm done
- **Why:** 52% of parcels were missing vergunningen + funderingsrisico data

**2. EP-Online energielabel** (`backfill_energielabel --gemeente Venlo`)
- Log: `/tmp/backfill_energielabel.log`
- Starts automatically after address backfill completes (chain script at `/tmp/run_ep_backfill_after.sh`)
- Chain log: `/tmp/backfill_chain.log`
- Look for `EP-ONLINE COMPLETE` in log to confirm done
- **Why:** 0% energielabel coverage — feeds constructieve_staat + asbest score factors

**After both complete:**
- All 63,817 parcels will be rescored with new data
- Score distribution should shift — check with: `SELECT COUNT(*) FILTER (WHERE score >= 60) FROM scan_results;`
- Threshold is now 60 (was 40), configurable in Settings
- User wants to evaluate if threshold 50 is better after backfill

**How to apply:** Check logs on session start. If complete, report results. If still running, report progress.

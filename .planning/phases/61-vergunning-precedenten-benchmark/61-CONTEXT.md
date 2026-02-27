# Phase 61: Vergunning Precedenten Benchmark - Context

**Gathered:** 2026-02-27  
**Status:** Ready for execution after Phase 59

<domain>
## Phase Boundary

Provide evidence-based permit precedent insights per gemeente so users can estimate expected path and timing.

Focus areas:
- comparable permit cohorting (same municipality + comparable type)
- throughput metrics (median/p75 lead time)
- outcome distribution (verleend/geweigerd/ingetrokken/etc.)
- shortlist of most relevant precedent cases in report output

Out of scope:
- deterministic approval prediction
- nationwide legal simulation
- replacing municipal legal review

</domain>

<decisions>
## Implementation Decisions

- v1 starts pragmatic: same municipality, recent period (e.g. 24 months), comparable category.
- Output is benchmark + context, not a guaranteed forecast.
- Existing monitoring/change-record pipelines are reused before adding new external providers.
- Report and map quick views must reuse one backend benchmark block.

</decisions>

---

*Phase: 61-vergunning-precedenten-benchmark*  
*Prepared for GSD execution*


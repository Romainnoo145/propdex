# Idea: make the /beleid hub actionable (not just a document store)

**Created:** 2026-06-02
**Type:** idea / future-direction
**Trigger:** During the data-bronnen consolidation (2026-06-02), confirmed `/beleid`
is a large, primary user-facing module (Landelijk/Provinciaal/Gemeentelijk + subsidies
levels) — but currently it's **purely a database/document browser**. No actions come out of it.

## Thought
Right now beleid = passive: browse policy docs/levels. Could become actionable, e.g.:
- surface "what does this policy mean for THIS parcel/project" (link policy → scoring factor → action)
- alerts when relevant beleid changes (ties into change-monitor)
- per-project beleid-checklist / next-steps
- turn cascade factors (woonvisie_match etc.) into visible "why this score" + recommended moves

## Status
Out of scope for the data-bronnen consolidation (which only retired beleid-BEHEER, the admin
doc-management tab). The /beleid hub stays as-is. Revisit as its own milestone/brainstorm —
likely after Hauzer demo validates which beleid signals matter.

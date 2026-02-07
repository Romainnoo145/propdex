# Phase 4: AI Document Parsing - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract zoning rules from bestemmingsplan PDFs using Claude API when DSO API data is insufficient. Always parse the full legal text for every property lookup — the PDF contains detailed rules (conditions, exceptions, footnotes) that the API never exposes. Processing runs asynchronously in background with progressive report loading. User uploads serve as fallback when auto-download fails.

</domain>

<decisions>
## Implementation Decisions

### PDF Acquisition
- Auto-download from Ruimtelijkeplannen.nl as primary source, user upload as fallback
- PDF only, 100MB max file size for uploads
- PDFs stored permanently linked to the property/plan — not deleted after parsing
- Cache parsed results by plan ID — if bestemmingsplan "Centrum 2018" is already parsed for Address A, reuse for Address B in the same plan area

### Claude's Discretion: Download scope
- Claude determines whether to fetch most relevant plan only or all active plans per location based on technical research

### Job Lifecycle
- Fully async — user can navigate away, parsing continues in background; results appear when they return
- Progressive loading: API data (kadaster, basic zoning, monuments) shown immediately, AI-parsed section loads when ready with loading indicator
- Always parse — every property lookup triggers bestemmingsplan PDF parsing alongside API calls

### Claude's Discretion: Status tracking & failure handling
- Claude determines polling vs WebSocket for job status updates
- Claude determines retry strategy on parsing failure (auto-retry vs immediate fail with options)

### AI Output Structure
- Deep extraction: permitted/forbidden uses, building dimensions, parking norms, environmental restrictions, special conditions, article references — unless gap-filling-only proves significantly cheaper in token costs (Claude evaluates during research)
- Overall confidence score for the AI parsing + individual flags only on LOW-confidence items needing manual verification
- Disclaimers: section-level banner ("AI-geanalyseerd — Controleer bij notaris voor investeringsbeslissingen") + per-item warnings on LOW-confidence flagged items
- Article references included per extracted rule for source verification, but presented in a non-cluttered way (e.g., collapsible, secondary text)

### Fallback When PDF Not Found
- Show API data as-is (report still has value without AI parsing)
- Display notice: "Bestemmingsplan niet digitaal beschikbaar" with option to upload PDF manually
- No re-parse button needed — once parsed, results are final

</decisions>

<specifics>
## Specific Ideas

- "The full legal text is the core value proposition for developers doing due diligence" — always parse, don't gate behind user action
- User explicitly noted re-parsing is not a use case: once parsed, developers work with the data immediately
- Disclaimers in Dutch for the target audience
- Plan-level caching is important for cost control — many addresses share the same bestemmingsplan

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-ai-document-parsing*
*Context gathered: 2026-02-07*

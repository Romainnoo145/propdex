# Phase 83: Geo-Contextualization + Gemeente Feed - Research

**Researched:** 2026-03-07
**Domain:** NLP-lite location extraction from Dutch court ruling text + feed API
**Confidence:** HIGH

## Summary

Phase 83 builds two connected capabilities on top of Phase 82's ruling cache: (1) a GeoContextualizer service that extracts gemeente names from cached ruling text using regex patterns validated against the existing ECLI registry gemeente list, and (2) a feed endpoint that auto-populates a chronological jurisprudence list per gemeente without requiring manual search.

The current JurisprudenceSection (in WijkDetailView) uses free-text search via `useJurisprudenceSearch` -- users type "omgevingsvergunning {gemeente}" and get national results. Phase 83 replaces this with an auto-populated feed using the cached rulings from Phase 82's `/api/jurisprudence/rulings/{gemeente_naam}` endpoint, enriched with geo-relevance sorting: gemeente-matched rulings first, then arrondissement-level. The key new backend artifact is a `GeoContextualizer` service that processes `RulingCache.full_text` to extract gemeente mentions via regex, then adds a `geo_relevance` field to each ruling.

The RVS (Raad van State) problem is the hardest part: RVS rulings use court code "RVS" in their ECLI (already defined in `ecli_registry.py` line 425), providing no geographic information. These must be geo-tagged purely via text extraction. The existing `search_by_court()` method filters by rechtbank codes, so RVS rulings are currently NOT captured. The ingestion job must be extended to also fetch RVS omgevingsrecht rulings and geo-tag them post-hoc.

**Primary recommendation:** Add `extracted_gemeente` and `geo_relevance` columns to RulingCache via Alembic migration, build a GeoContextualizer that runs during ingestion (not at query time), and transform the frontend JurisprudenceSection from search-driven to feed-driven.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GEO-01 | GeoContextualizer extracts gemeente names from ruling text using regex patterns | Regex patterns documented below; GEMEENTE_TO_RECHTBANK dict (342 entries) available as validation source |
| GEO-02 | Extracted gemeente names validated against known CBS gemeente list | Use GEMEENTE_TO_RECHTBANK.keys() from ecli_registry.py -- already contains 342 gemeenten including historical names |
| GEO-03 | Two-pass geo-scoping: ECLI prefix for arrondissement, text extraction for gemeente | ECLI court code extraction already exists (extract_court_code()), text extraction is the new layer |
| GEO-04 | RVS rulings geo-tagged via text extraction | RVS court code constant already defined in ecli_registry.py; needs separate search_by_court call with ["RVS"] + text-based geo-tagging |
| FEED-01 | Auto-populated chronological jurisprudentie feed per gemeente | Replace current search-driven JurisprudenceSection with feed from /api/jurisprudence/rulings/{gemeente} endpoint |
| FEED-02 | Rulings sorted by relevance: gemeente-matched first, then arrondissement-level | Add geo_relevance enum to RulingCache, sort by (geo_relevance DESC, datum_uitspraak DESC) |
| FEED-03 | Win/loss ratio as aggregate outcome percentages | Requires uitkomst extraction from ruling text or summary; add to feed endpoint response |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python re (stdlib) | 3.x | Regex-based gemeente extraction from ruling text | Confirmed in research: regex + known gemeente list outperforms spaCy NER on legal text |
| SQLAlchemy 2.x | existing | RulingCache model extension + queries | Already in use, Mapped[] + mapped_column() pattern |
| FastAPI | existing | Feed endpoint | Already in use for jurisprudence router |
| Alembic | existing | Migration for new columns | Standard migration tool |
| TanStack Query | existing | Frontend data fetching for feed | Replace useJurisprudenceSearch with useGemeenteRulingsFeed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lxml | existing | XML parsing for RVS document text extraction | Already used in RechtspraakClient |
| ARQ | existing | Background job for geo-enrichment during ingestion | Extend ruling_ingestion_job |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Python re (regex) | spaCy NER | spaCy training data is news, not legal text; regex + known list is more reliable and zero dependencies |
| Post-ingestion enrichment | Query-time extraction | Post-ingestion is correct: extract once, store result, never re-process |

## Architecture Patterns

### Recommended Changes

```
backend/app/
  services/
    geo_contextualizer.py    # NEW: regex extraction + gemeente validation
  models/
    ruling_cache.py          # MODIFY: add extracted_gemeente, geo_relevance columns
  jobs/
    ruling_ingestion.py      # MODIFY: call GeoContextualizer after fetching, also fetch RVS
  api/endpoints/
    jurisprudence.py         # MODIFY: add feed response with geo_relevance sorting + win/loss ratio

frontend/src/
  hooks/
    useJurisprudence.ts      # MODIFY: add useGemeenteRulingsFeed hook
  components/projects/
    JurisprudenceSection.tsx  # MODIFY: replace search-driven with feed-driven
  lib/
    api.ts                   # MODIFY: add getGemeenteRulingsFeed API binding (or reuse existing)
```

### Pattern 1: GeoContextualizer Service
**What:** Pure function service that takes ruling text + known gemeente set, returns extracted gemeente names with confidence.
**When to use:** Called during ruling ingestion job, after full_text is fetched.
**Example:**
```python
# backend/app/services/geo_contextualizer.py
import re
import logging
from app.government_apis.ecli_registry import GEMEENTE_TO_RECHTBANK

logger = logging.getLogger(__name__)

# Known gemeente names for validation (set for O(1) lookup)
KNOWN_GEMEENTEN: set[str] = set(GEMEENTE_TO_RECHTBANK.keys())

# Regex patterns for gemeente extraction from Dutch legal text
# Order matters: most specific first
GEO_PATTERNS: list[re.Pattern[str]] = [
    # "college van burgemeester en wethouders van {gemeente}"
    re.compile(
        r"college\s+van\s+(?:burgemeester\s+en\s+wethouders|[Bb]&[Ww]|B\s+en\s+W)\s+van\s+(?:de\s+gemeente\s+)?([A-Z][a-zA-Z\s\-']+)",
        re.IGNORECASE,
    ),
    # "gemeente {gemeente}" (preceded by word boundary)
    re.compile(r"\bgemeente\s+([A-Z][a-zA-Z\s\-']+)", re.IGNORECASE),
    # "te {gemeente}" (location indicator)
    re.compile(r"\bte\s+([A-Z][a-zA-Z\s\-']+)", re.IGNORECASE),
    # "gelegen in {gemeente}" / "gelegen te {gemeente}"
    re.compile(r"\bgelegen\s+(?:in|te)\s+([A-Z][a-zA-Z\s\-']+)", re.IGNORECASE),
    # "raad van de gemeente {gemeente}"
    re.compile(r"\braad\s+van\s+de\s+gemeente\s+([A-Z][a-zA-Z\s\-']+)", re.IGNORECASE),
]


def extract_gemeente_from_text(text: str) -> str | None:
    """Extract most likely gemeente name from ruling text.

    Uses regex patterns validated against known gemeente list.
    Returns the first match that validates against KNOWN_GEMEENTEN.
    """
    if not text:
        return None

    for pattern in GEO_PATTERNS:
        for match in pattern.finditer(text):
            candidate = match.group(1).strip().rstrip(".,;:")
            # Try exact match first
            if candidate in KNOWN_GEMEENTEN:
                return candidate
            # Try title-cased version
            titled = candidate.title()
            if titled in KNOWN_GEMEENTEN:
                return titled
            # Try with common suffixes stripped (e.g., "Amsterdam heeft" -> "Amsterdam")
            for suffix in [" heeft", " heeft het", " is", " een", " het", " de", " op"]:
                if candidate.endswith(suffix):
                    cleaned = candidate[: -len(suffix)]
                    if cleaned in KNOWN_GEMEENTEN:
                        return cleaned
    return None
```

### Pattern 2: Geo-Relevance Enum
**What:** Simple string enum stored on RulingCache to enable sorting.
**When to use:** Set during ingestion based on geo-extraction results.
**Example:**
```python
# Values for geo_relevance column (String, not Python enum -- simpler)
# "gemeente" = ruling text mentions the specific gemeente being viewed
# "arrondissement" = ruling is from the correct rechtbank but no gemeente mention extracted
# "national" = RVS or other national-level ruling geo-tagged to this gemeente via text
```

### Pattern 3: Feed Endpoint Response
**What:** Extended `/api/jurisprudence/rulings/{gemeente_naam}` response with geo_relevance and win/loss aggregation.
**Example:**
```python
# Response shape
{
    "status": "success",
    "rulings": [
        {
            "ecli": "ECLI:NL:RBLIM:2024:1234",
            "court_code": "RBLIM",
            "instantie": "Rechtbank Limburg",
            "datum_uitspraak": "2024-03-15",
            "title": "...",
            "summary": "...",
            "extracted_gemeente": "Venlo",  # NEW
            "geo_relevance": "gemeente",    # NEW
        },
        # ...
    ],
    "win_loss": {                          # NEW
        "toegewezen": 12,
        "afgewezen": 8,
        "gedeeltelijk": 3,
        "onbekend": 2,
        "total": 25,
    },
    "ingestion_status": "fresh",
    "count": 25,
}
```

### Anti-Patterns to Avoid
- **Query-time geo-extraction:** Never run regex on full_text at query time. Extract once during ingestion, store result in `extracted_gemeente` column. Query-time extraction on 100+ rulings with 5K-100K chars each would be unacceptably slow.
- **spaCy / NLP pipeline:** The research explicitly confirmed that regex + known gemeente list is more reliable for legal text than NER models trained on news data. Do not add spaCy as a dependency.
- **Storing geo_relevance relative to a specific gemeente:** The `extracted_gemeente` column stores the absolute extraction result. The `geo_relevance` relative to the VIEWED gemeente must be computed at query time (a ruling mentioning "Venlo" is "gemeente" relevance when viewing Venlo, but "arrondissement" when viewing Roermond).

**CORRECTION to Pattern 2:** `geo_relevance` should NOT be stored on the model. It must be computed at query time because the same ruling has different relevance depending on which gemeente is being viewed. Only `extracted_gemeente` is stored.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gemeente name validation | Custom NLP/fuzzy matching | `GEMEENTE_TO_RECHTBANK.keys()` set lookup | 342 names already in codebase, exact match after regex extraction |
| Uitkomst classification | Custom text analysis | Regex on ruling summary/text for keywords | "toegewezen", "afgewezen", "gegrond", "ongegrond" are standardized legal terms |
| RVS ruling detection | Complex court hierarchy logic | `extract_court_code(ecli) == "RVS"` | Already defined in ecli_registry.py |

**Key insight:** The ECLI registry (342 gemeenten) is the validation source. Do not introduce a separate CBS gemeente list -- the ECLI registry already includes historical/merged names needed for older rulings.

## Common Pitfalls

### Pitfall 1: Anonymized Addresses in Ruling Text
**What goes wrong:** Rechtspraak anonymizes specific addresses as `[adres]` and `[locatie]`, removing street-level location data.
**Why it happens:** Privacy policy for court rulings.
**How to avoid:** Do NOT try to extract street addresses. Focus on gemeente-level extraction from institutional references ("college van B&W van {gemeente}", "gemeente {gemeente}"). These are NOT anonymized because they refer to government bodies, not private individuals.
**Warning signs:** Regex returning `[adres]` or `[locatie]` as gemeente names.

### Pitfall 2: False Positives from Common Words
**What goes wrong:** Regex pattern `te {gemeente}` matches common Dutch phrases like "te groot" or "te zien", and "gemeente" followed by generic nouns.
**Why it happens:** Overly broad regex without validation step.
**How to avoid:** Always validate extracted candidate against `KNOWN_GEMEENTEN` set. The validation step eliminates false positives because "groot", "zien", etc. are not in the gemeente list.
**Warning signs:** High extraction rate (>95%) suggesting false positives are sneaking through.

### Pitfall 3: Geo-Relevance Computed Wrong
**What goes wrong:** Storing geo_relevance as a fixed column on RulingCache, then getting wrong results when the same ruling appears in feeds for different gemeenten.
**Why it happens:** A ruling mentioning "Venlo" from Rechtbank Limburg is "gemeente" relevance for Venlo but "arrondissement" for Roermond.
**How to avoid:** Store only `extracted_gemeente` on the model. Compute relevance at query time: if `extracted_gemeente == viewed_gemeente` then "gemeente", else "arrondissement".
**Warning signs:** Same ruling showing same relevance level in all gemeente feeds.

### Pitfall 4: RVS Rulings Not Captured
**What goes wrong:** The current `ruling_ingestion_job` only fetches rulings matching rechtbank court codes. RVS (Raad van State) uses court code "RVS" which is never in `get_court_codes_for_gemeente()` results.
**Why it happens:** Phase 82 focused on rechtbank-level rulings. RVS is a separate appellate court.
**How to avoid:** Add a separate RVS fetch pass in the ingestion job: search with subject=omgevingsrecht (no court-code filter needed for RVS since it is national), then geo-tag via text extraction. Store with `gemeente_query=NULL` (not tied to one gemeente) and rely on `extracted_gemeente` for feed inclusion.
**Warning signs:** Zero RVS rulings appearing in any gemeente feed.

### Pitfall 5: Win/Loss Ratio Without Uitkomst Data
**What goes wrong:** FEED-03 requires win/loss ratio but Phase 82's RulingCache has no `uitkomst` column.
**Why it happens:** Uitkomst extraction was planned for Phase 84 (AI analysis).
**How to avoid:** Add a lightweight `uitkomst` column to RulingCache. Extract uitkomst via simple keyword matching on ruling text/summary during ingestion (not AI -- save that for Phase 84). Keywords: "gegrond" -> toegewezen, "ongegrond" -> afgewezen, "gedeeltelijk gegrond" -> gedeeltelijk. This gives a reasonable approximation without AI.
**Warning signs:** All rulings showing "onbekend" uitkomst.

### Pitfall 6: Frontend Search vs Feed State Confusion
**What goes wrong:** JurisprudenceSection currently manages search state (debounced input, search term). Switching to feed mode while keeping search capability creates state complexity.
**Why it happens:** Mixing two paradigms (auto-populated feed vs user-driven search).
**How to avoid:** Phase 83 replaces search with feed completely. The search functionality moves to Phase 85 (Explorer UI). JurisprudenceSection becomes a read-only feed: fetch from `/api/jurisprudence/rulings/{gemeente}`, display sorted results, show win/loss summary. Remove SearchInput, remove debounce logic, remove `useJurisprudenceSearch`.
**Warning signs:** Two data sources (search results + feed results) competing in the same component.

## Code Examples

### Alembic Migration for New Columns
```python
# alembic/versions/xxx_add_geo_columns_to_ruling_cache.py
def upgrade() -> None:
    op.add_column("ruling_cache", sa.Column("extracted_gemeente", sa.String(200), nullable=True))
    op.add_column("ruling_cache", sa.Column("uitkomst", sa.String(30), nullable=True))
    op.create_index("ix_ruling_cache_extracted_gemeente", "ruling_cache", ["extracted_gemeente"])

def downgrade() -> None:
    op.drop_index("ix_ruling_cache_extracted_gemeente")
    op.drop_column("ruling_cache", "uitkomst")
    op.drop_column("ruling_cache", "extracted_gemeente")
```

### Uitkomst Extraction (Lightweight Keyword Matching)
```python
def extract_uitkomst(text: str, summary: str) -> str:
    """Extract ruling outcome from text using legal terminology keywords.

    Not AI-powered -- simple keyword matching for Phase 83.
    Phase 84 will add AI-based classification for better accuracy.
    """
    combined = f"{summary} {text[:2000]}".lower()

    if "gedeeltelijk gegrond" in combined:
        return "gedeeltelijk"
    if "gegrond" in combined and "ongegrond" not in combined:
        return "toegewezen"
    if "ongegrond" in combined:
        return "afgewezen"
    if "niet-ontvankelijk" in combined:
        return "afgewezen"
    if "beroep gegrond" in combined:
        return "toegewezen"
    if "beroep ongegrond" in combined:
        return "afgewezen"
    return "onbekend"
```

### Feed Query with Geo-Relevance Sorting
```python
# In jurisprudence.py endpoint
from sqlalchemy import case

# Compute geo_relevance at query time
geo_relevance_expr = case(
    (RulingCache.extracted_gemeente == gemeente_naam, "gemeente"),
    else_="arrondissement",
)

stmt = (
    select(RulingCache, geo_relevance_expr.label("geo_relevance"))
    .where(
        (RulingCache.gemeente_query == gemeente_naam)
        | (RulingCache.extracted_gemeente == gemeente_naam)
    )
    .order_by(
        # gemeente-matched first, then arrondissement
        case((RulingCache.extracted_gemeente == gemeente_naam, 0), else_=1),
        RulingCache.datum_uitspraak.desc(),
    )
)
```

### Frontend Feed Hook
```typescript
// In useJurisprudence.ts -- new hook replacing useJurisprudenceSearch for feed
export function useGemeenteRulingsFeed(gemeenteNaam: string) {
    const { accessToken } = useAuth()

    return useQuery<GemeenteRulingsFeedResponse, Error>({
        queryKey: ['jurisprudence', 'feed', gemeenteNaam],
        queryFn: () => getGemeenteRulings(gemeenteNaam, accessToken),
        enabled: !!accessToken && gemeenteNaam.length > 0,
        staleTime: 5 * 60 * 1000,
        // Refetch when window regains focus (stale-while-revalidate)
        refetchOnWindowFocus: true,
    })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text search | ECLI court-code filtered cache | Phase 82 (2026-03-07) | Rulings now scoped to arrondissement |
| Manual search trigger | Auto-populated feed | Phase 83 (this phase) | No user action needed to see rulings |
| National results | Gemeente-matched first | Phase 83 (this phase) | Most relevant rulings at top |

**Current state (pre-Phase 83):**
- Backend: `GET /api/jurisprudence/rulings/{gemeente}` exists but returns flat list without geo-relevance or uitkomst
- Frontend: JurisprudenceSection uses `useJurisprudenceSearch` (free-text search), ignoring the cached rulings endpoint
- RulingCache has no `extracted_gemeente` or `uitkomst` columns

## Open Questions

1. **RVS ruling volume**
   - What we know: RVS uses "RVS" court code, no geographic indicator in ECLI
   - What's unclear: How many omgevingsrecht RVS rulings exist? If thousands, we need pagination for the RVS fetch pass
   - Recommendation: Start with `max_results=100` for RVS, same as rechtbank fetches. Monitor volume.

2. **Geo-extraction accuracy**
   - What we know: "college van B&W van {gemeente}" pattern is highly reliable for rechtbank rulings
   - What's unclear: What percentage of rulings contain extractable gemeente names? Research estimates 70-80%.
   - Recommendation: Accept that some rulings will have `extracted_gemeente=NULL`. These appear as "arrondissement" level in feeds. Do not over-engineer for 100% coverage.

3. **Uitkomst keyword accuracy**
   - What we know: "gegrond"/"ongegrond" are standard legal terms used consistently in rulings
   - What's unclear: Edge cases like "deels gegrond" vs "gedeeltelijk gegrond"
   - Recommendation: Start with the keyword list in the code example. Phase 84's AI analysis will provide more accurate classification later.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `ecli_registry.py` (342 gemeenten, court codes, RVS constant), `ruling_cache.py` (model), `ruling_ingestion.py` (ARQ job), `jurisprudence.py` (endpoints), `rechtspraak.py` (client)
- Existing codebase: `JurisprudenceSection.tsx` (302 lines, current search-driven UI), `useJurisprudence.ts` (hooks), `WijkDetailView.tsx` (integration point)
- `.planning/research/SUMMARY.md` -- v13.0 research findings (geo-extraction patterns, pitfalls, architecture)

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- requirement definitions for GEO-01 through FEED-03
- `.planning/STATE.md` -- Phase 82 decisions (ECLI filtering, org-agnostic cache, regex over spaCy)

### Tertiary (LOW confidence)
- Geo-extraction accuracy estimate (70-80%) -- needs empirical validation on real ruling texts
- Uitkomst keyword matching accuracy -- untested, Phase 84 AI will improve

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, all existing patterns
- Architecture: HIGH - clear extension of Phase 82 artifacts, well-understood data flow
- Pitfalls: HIGH - six pitfalls identified from codebase analysis and research findings
- Geo-extraction patterns: MEDIUM - patterns are sound but accuracy unverified on real data

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable domain, no external API changes expected)
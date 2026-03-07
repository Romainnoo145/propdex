# Phase 84: AI Analysis Upgrade + Doorlooptijd - Research

**Researched:** 2026-03-07
**Domain:** AI jurisprudence analysis enhancement, per-ruling caching, vergunningstype extraction, procedure duration calculation
**Confidence:** HIGH

## Summary

Phase 84 upgrades the existing AI analysis pipeline from batch-mode (analyze all rulings as one blob, cache by ECLI-hash) to per-ruling mode (analyze and cache each ruling individually, add vergunningstype classification). It also introduces doorlooptijd (procedure duration) calculation and display. The phase builds on Phase 83's geo-contextualized feed, ensuring AI analysis only runs on location-relevant rulings.

The current implementation has three key problems this phase fixes: (1) the analysis is batch-keyed -- changing the ruling list (e.g., date filters) invalidates the entire cache and triggers re-analysis; (2) there is no vergunningstype classification, making the analysis generic instead of actionable; (3) there is no doorlooptijd data despite it being a key due-diligence metric for developers. The fix requires schema changes to RulingCache (add `ai_analysis` JSONB + `vergunningstype` + `doorlooptijd_dagen` columns), an enhanced prompt with vergunningstype extraction, and a new DoorlooptijdService that extracts filing dates from ruling text since the Rechtspraak API metadata does NOT include filing dates.

**Primary recommendation:** Add per-ruling AI analysis columns to RulingCache (org-agnostic, since the analysis is deterministic on public text), extract vergunningstype via enhanced Claude prompt, and compute doorlooptijd by parsing "beroepschrift ingediend op" patterns from ruling text combined with `datum_uitspraak` metadata.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | AI analysis runs only on filtered, location-relevant rulings | Phase 83 delivers geo-filtered feed; analysis endpoint must consume only feed ECLIs, not national results |
| AI-02 | Per-ruling AI analysis caching (not per-batch) | Add `ai_analysis` JSONB column to RulingCache; check column before sending to Claude; survives filter changes |
| AI-03 | Vergunningstype classification per ruling | Enhanced Claude prompt extracts type; stored as `vergunningstype` column on RulingCache |
| AI-04 | Token budget controls: truncate to OVERWEGINGEN + BESLISSING | Text section extraction before sending to Claude; max 60K input tokens per batch |
| DOOR-01 | Procedure duration from ruling metadata dates | `datum_uitspraak` from metadata + filing date from text extraction; difference in days |
| DOOR-02 | Average doorlooptijd per gemeente per vergunningstype | SQL aggregation on RulingCache where both dates available; group by gemeente + type |
| DOOR-03 | Graceful degradation when filing dates unavailable | Show "onvoldoende data" when <3 rulings have extractable dates for a gemeente/type combo |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| anthropic | existing | Claude API for per-ruling analysis | Already in use; Sonnet 4.5 model configured |
| SQLAlchemy 2.x | existing | RulingCache model extension + queries | Project standard ORM |
| Pydantic | existing | Schema validation for AI responses | Project standard |
| ARQ | existing | Background job for batch analysis | Already used for ruling ingestion |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| re (stdlib) | n/a | Filing date extraction from ruling text | Doorlooptijd calculation |
| datetime (stdlib) | n/a | Date parsing and duration calculation | Doorlooptijd computation |
| statistics (stdlib) | n/a | Mean/median doorlooptijd aggregation | Display statistics |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-ruling JSONB on RulingCache | Separate ai_ruling_analysis table | Separate table adds JOIN complexity; JSONB on RulingCache is simpler since it is org-agnostic and 1:1 |
| Text regex for filing date | Dedicated NLP date parser | Regex is sufficient for structured legal text patterns; NLP adds dependency for marginal gain |

**Installation:**
No new dependencies required. All capabilities exist in the current stack.

## Architecture Patterns

### Current State (Problems to Fix)

```
Current flow:
1. Frontend sends ALL feed ECLIs to /analyze endpoint
2. Backend hashes sorted ECLI list -> cache_key = "ai_juridisch:{org}:{hash}"
3. If cache miss: enqueue ARQ job -> Claude analyzes ALL rulings in one call
4. Result stored in CachedAPIResponse (org-scoped)

Problems:
- Cache key is batch-specific: changing date filter = new ECLI list = cache miss = re-analyze everything
- No vergunningstype: analysis is generic "bezwaargrond + uitkomst"
- CachedAPIResponse is org-scoped but analysis is deterministic on public text
- All ruling text sent as JSON blob (no section extraction, no token budget)
```

### Target State

```
New flow:
1. Frontend requests analysis for gemeente (not specific ECLIs)
2. Backend fetches feed rulings from RulingCache
3. For each ruling: check if ai_analysis JSONB column is populated
4. Rulings without analysis: batch-send to Claude (max 10 per call, 60K token budget)
5. Claude returns per-ruling analysis WITH vergunningstype
6. Store analysis back on RulingCache.ai_analysis JSONB column
7. Aggregate scores + doorlooptijd in Python, return to frontend

Key changes:
- Per-ruling cache on RulingCache (org-agnostic, deterministic)
- Vergunningstype as separate indexed column (for aggregation queries)
- Filing date extraction from text stored as datum_indiening column
- Doorlooptijd computed as datum_uitspraak - datum_indiening
```

### Recommended Project Structure

```
backend/app/
  models/
    ruling_cache.py          # ADD: ai_analysis JSONB, vergunningstype, datum_indiening, doorlooptijd_dagen
  ai/
    prompts.py               # MODIFY: enhanced JURIDISCH_ANALYSE_PROMPT with vergunningstype
    schemas.py               # ADD: RulingAnalysisV2 with vergunningstype field
    claude_client.py         # MODIFY: per-ruling analysis method, text truncation
  services/
    doorlooptijd.py          # NEW: filing date extraction, duration calc, aggregation
  api/endpoints/
    jurisprudence.py         # MODIFY: new /analyze endpoint that uses per-ruling cache
  jobs/
    jurisprudence_analysis.py # MODIFY: per-ruling storage instead of batch CachedAPIResponse
frontend/src/
  components/projects/
    JuridischKlimaatCard.tsx  # MODIFY: add doorlooptijd display
    JurisprudenceSection.tsx  # MODIFY: vergunningstype badges, auto-analyze on feed load
  lib/
    api.ts                    # MODIFY: updated types for vergunningstype + doorlooptijd
```

### Pattern 1: Per-Ruling AI Cache on RulingCache

**What:** Store AI analysis result as JSONB on the RulingCache row itself, since analysis is deterministic on public ruling text.

**When to use:** When the analyzed entity is public data and analysis is idempotent.

**Example:**
```python
# RulingCache model extension
class RulingCache(Base, TimestampMixin):
    # ... existing columns ...

    # Per-ruling AI analysis (org-agnostic, deterministic on text)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vergunningstype: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    datum_indiening: Mapped[str | None] = mapped_column(String(20), nullable=True)
    doorlooptijd_dagen: Mapped[int | None] = mapped_column(nullable=True)
    ai_analyzed_at: Mapped[datetime | None] = mapped_column(nullable=True)
```

### Pattern 2: Text Section Extraction for Token Budget

**What:** Extract OVERWEGINGEN + BESLISSING sections from ruling text before sending to Claude.

**When to use:** Controlling token cost while preserving the most relevant content.

**Example:**
```python
def extract_relevant_sections(full_text: str, max_chars: int = 15000) -> str:
    """Extract overwegingen + beslissing sections from ruling text.

    Dutch court rulings follow a standard structure:
    1. PROCESVERLOOP (procedure history) - less relevant
    2. OVERWEGINGEN (considerations) - most relevant
    3. BESLISSING (decision) - essential
    """
    text_lower = full_text.lower()

    # Find section markers
    overwegingen_idx = -1
    for marker in ["overwegingen", "beoordeling", "het geschil"]:
        idx = text_lower.find(marker)
        if idx >= 0:
            overwegingen_idx = idx
            break

    if overwegingen_idx >= 0:
        relevant = full_text[overwegingen_idx:]
    else:
        # Fallback: take last 60% of text (usually contains overwegingen + beslissing)
        relevant = full_text[len(full_text) * 2 // 5:]

    return relevant[:max_chars]
```

### Pattern 3: Doorlooptijd Filing Date Extraction

**What:** Extract filing date from ruling text since Rechtspraak API metadata only has `datum_uitspraak` (judgment date) and `dcterms:issued` (publication date), NOT filing date.

**When to use:** Computing procedure duration requires both start and end dates.

**Example:**
```python
import re
from datetime import datetime

# Dutch month names for date parsing
DUTCH_MONTHS = {
    "januari": 1, "februari": 2, "maart": 3, "april": 4,
    "mei": 5, "juni": 6, "juli": 7, "augustus": 8,
    "september": 9, "oktober": 10, "november": 11, "december": 12,
}

# Patterns for filing date in Dutch legal text
_FILING_PATTERNS = [
    # "beroepschrift is ingediend op 15 maart 2023"
    re.compile(r"beroepschrift\s+(?:is\s+)?ingediend\s+(?:op\s+)?(\d{1,2})\s+(\w+)\s+(\d{4})", re.IGNORECASE),
    # "bezwaarschrift van 15 maart 2023"
    re.compile(r"bezwaarschrift\s+van\s+(\d{1,2})\s+(\w+)\s+(\d{4})", re.IGNORECASE),
    # "ingekomen op 15-03-2023" or "ontvangen op 15-03-2023"
    re.compile(r"(?:ingekomen|ontvangen)\s+op\s+(\d{1,2})[-/](\d{1,2})[-/](\d{4})", re.IGNORECASE),
]

def extract_filing_date(text: str) -> str | None:
    """Extract filing/registration date from Dutch legal ruling text."""
    for pattern in _FILING_PATTERNS:
        match = pattern.search(text[:3000])  # Filing info in first section
        if match:
            groups = match.groups()
            try:
                if groups[1].isdigit():
                    # Numeric date format
                    return f"{groups[2]}-{int(groups[1]):02d}-{int(groups[0]):02d}"
                else:
                    # Dutch month name
                    month = DUTCH_MONTHS.get(groups[1].lower())
                    if month:
                        return f"{groups[2]}-{month:02d}-{int(groups[0]):02d}"
            except (ValueError, KeyError):
                continue
    return None

def compute_doorlooptijd(datum_uitspraak: str, datum_indiening: str) -> int | None:
    """Compute procedure duration in days."""
    try:
        uitspraak = datetime.strptime(datum_uitspraak[:10], "%Y-%m-%d")
        indiening = datetime.strptime(datum_indiening[:10], "%Y-%m-%d")
        delta = (uitspraak - indiening).days
        return delta if delta > 0 else None
    except (ValueError, TypeError):
        return None
```

### Anti-Patterns to Avoid

- **Batch cache key by ECLI hash:** Current pattern. Any filter change (date range, vergunningstype) changes the ECLI list, invalidating the cache and triggering full re-analysis. Use per-ruling cache instead.
- **Org-scoped AI analysis cache:** Analysis is deterministic on public ruling text. Storing in CachedAPIResponse with org_id means each tenant re-analyzes the same rulings. Store on RulingCache (org-agnostic).
- **Sending full ruling text to Claude:** Rulings can be 30K-100K chars. Extract OVERWEGINGEN + BESLISSING sections and cap at 15K chars per ruling.
- **Triggering analysis per-ruling API call:** Would cause N API calls to Claude for N rulings. Batch rulings into groups of 5-10 per Claude call, with total token budget cap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vergunningstype classification | Rule-based keyword classifier | Claude prompt extraction | Legal text has too many variants; AI handles nuance (dakopbouw vs aanbouw vs opbouw) |
| Date parsing from Dutch text | Custom NLP pipeline | Regex with known Dutch month names | Court rulings use consistent date formatting; regex is reliable and fast |
| AI response validation | Manual JSON parsing | Pydantic model_validate_json | Existing pattern in codebase; handles edge cases |

## Common Pitfalls

### Pitfall 1: Rechtspraak Has No Filing Date in Metadata
**What goes wrong:** Assuming `dcterms:date` or `dcterms:issued` is the filing date. `dcterms:date` = datum uitspraak (judgment date), `dcterms:issued` = publication date on rechtspraak.nl.
**Why it happens:** Dublin Core field names are ambiguous.
**How to avoid:** Extract filing date from ruling TEXT (patterns like "beroepschrift ingediend op {date}"). Accept that many rulings will have no extractable filing date.
**Warning signs:** Doorlooptijd showing negative values or 0 days.

### Pitfall 2: Low Filing Date Availability
**What goes wrong:** Building the doorlooptijd feature assuming most rulings have extractable dates, then finding <30% do.
**Why it happens:** Not all rulings mention filing dates explicitly; some only state "het beroep" without dates.
**How to avoid:** Design for graceful degradation from day one. Show "onvoldoende data" when fewer than 3 rulings per gemeente/type combo have dates. Never show averages based on 1-2 data points.
**Warning signs:** Aggregate doorlooptijd stats based on tiny sample sizes.

### Pitfall 3: Token Budget Explosion
**What goes wrong:** Sending 10 full rulings (each 30K-100K chars) to Claude in one call exceeds input token limits.
**Why it happens:** `max_chars_per_ruling=5000` in current code is too aggressive (loses context), but no truncation is worse.
**How to avoid:** Extract OVERWEGINGEN + BESLISSING sections (the legally relevant parts), cap at 15K chars per ruling, batch max 5 rulings per Claude call. Total input stays under 80K chars (~60K tokens).
**Warning signs:** Anthropic 400 errors for context length exceeded.

### Pitfall 4: Re-analyzing Already-Analyzed Rulings
**What goes wrong:** When the user switches date filters or the feed refreshes, triggering re-analysis of rulings that already have AI analysis.
**Why it happens:** Batch-level cache key changes when the ECLI list changes.
**How to avoid:** Per-ruling cache: check `ai_analysis IS NOT NULL AND ai_analyzed_at IS NOT NULL` before including in the analysis batch. Only send un-analyzed rulings to Claude.
**Warning signs:** Redundant Claude API calls for the same ECLIs.

### Pitfall 5: Vergunningstype Taxonomy Explosion
**What goes wrong:** Claude returns dozens of unique vergunningstype strings ("dakopbouw", "opbouw dak", "uitbreiding dakverdieping") making aggregation useless.
**Why it happens:** Uncontrolled free-text extraction.
**How to avoid:** Provide a fixed taxonomy in the prompt (max 8-10 categories) and instruct Claude to map to the closest category. Include "overig" as fallback.
**Warning signs:** More than 10 distinct vergunningstype values in the database.

## Code Examples

### Enhanced AI Prompt with Vergunningstype

```python
JURIDISCH_ANALYSE_PROMPT_V2 = """
Je bent een expert in Nederlands omgevingsrecht en analyseert rechtspraak voor vastgoedontwikkelaars.
Je ontvangt een lijst van gerechtelijke uitspraken met ECLI, instantie, datum en tekst.

**Per uitspraak analyseer je:**
1. bezwaargrond: 1 zin die de kern van het bezwaar beschrijft
2. uitkomst: exact een van ["toegewezen", "afgewezen", "gedeeltelijk", "onbekend"]
3. vergunningstype: exact een van ["nieuwbouw", "verbouw", "dakopbouw", "uitbreiding", "sloop", "bestemmingswijziging", "milieu", "monumenten", "overig"]
4. relevantie: 1-2 zinnen over de relevantie voor vastgoedontwikkeling
5. confidence: exact een van ["HIGH", "MEDIUM", "LOW"]

**Vergunningstype toelichting:**
- nieuwbouw: nieuwbouw woning, appartementencomplex, bedrijfspand
- verbouw: interne verbouwing, renovatie, herbestemming bestaand pand
- dakopbouw: dakopbouw, extra verdieping, optopping
- uitbreiding: aanbouw, bijgebouw, uitbreiding bestaand pand
- sloop: sloopvergunning, sloop-nieuwbouw
- bestemmingswijziging: bestemmingsplanwijziging, afwijking bestemmingsplan, omgevingsplanactiviteit
- milieu: milieuvergunning, geluidsoverlast, bodem, luchtkwaliteit
- monumenten: monumentenvergunning, beschermd stadsgezicht
- overig: overige omgevingsvergunningen

**Retourneer het resultaat als JSON:**
{
  "gemeente_naam": "<gemeente>",
  "risico_samenvatting": "<3-5 zinnen>",
  "top_risico_factoren": ["<factor1>", ...],
  "ruling_analyses": [
    {
      "ecli": "<ECLI>",
      "bezwaargrond": "<1 zin>",
      "uitkomst": "<toegewezen|afgewezen|gedeeltelijk|onbekend>",
      "vergunningstype": "<uit bovenstaande lijst>",
      "relevantie": "<1-2 zinnen>",
      "confidence": "<HIGH|MEDIUM|LOW>"
    }
  ]
}

Retourneer ALLEEN de JSON.
"""
```

### Per-Ruling Analysis Endpoint (Backend)

```python
@router.post("/analyze/{gemeente_naam}")
async def analyze_gemeente_rulings(
    gemeente_naam: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    current_user=Depends(get_current_active_user),
):
    """Analyze geo-filtered rulings for a gemeente. Uses per-ruling cache."""
    # Fetch feed rulings (already geo-filtered by Phase 83)
    stmt = select(RulingCache).where(
        (RulingCache.gemeente_query == gemeente_naam)
        | (RulingCache.extracted_gemeente == gemeente_naam)
    )
    result = await db.execute(stmt)
    rulings = result.scalars().all()

    # Split: already analyzed vs needs analysis
    analyzed = [r for r in rulings if r.ai_analysis is not None]
    needs_analysis = [r for r in rulings if r.ai_analysis is None and r.full_text]

    if needs_analysis:
        # Enqueue background job for un-analyzed rulings only
        arq_pool = request.app.state.arq_pool
        job = await arq_pool.enqueue_job(
            "ruling_analysis_job",
            gemeente_naam,
            [r.ecli for r in needs_analysis],
            _job_id=f"ruling_analyze:{gemeente_naam}",
        )
        # Return partial results + job_id for polling
        return {
            "status": "analyzing",
            "analyzed_count": len(analyzed),
            "pending_count": len(needs_analysis),
            "job_id": job.job_id,
            "partial_result": _build_analysis_result(analyzed, gemeente_naam),
        }

    # All analyzed: return aggregated result
    return {
        "status": "complete",
        "result": _build_analysis_result(analyzed, gemeente_naam),
    }
```

### Doorlooptijd Aggregation Query

```python
async def get_doorlooptijd_stats(
    db: AsyncSession,
    gemeente_naam: str,
) -> dict:
    """Compute average doorlooptijd per vergunningstype for a gemeente."""
    stmt = (
        select(
            RulingCache.vergunningstype,
            func.count().label("count"),
            func.avg(RulingCache.doorlooptijd_dagen).label("avg_dagen"),
            func.min(RulingCache.doorlooptijd_dagen).label("min_dagen"),
            func.max(RulingCache.doorlooptijd_dagen).label("max_dagen"),
        )
        .where(
            (RulingCache.gemeente_query == gemeente_naam)
            | (RulingCache.extracted_gemeente == gemeente_naam),
            RulingCache.doorlooptijd_dagen.isnot(None),
            RulingCache.vergunningstype.isnot(None),
        )
        .group_by(RulingCache.vergunningstype)
    )
    result = await db.execute(stmt)
    rows = result.all()

    stats = {}
    for row in rows:
        if row.count >= 3:  # Minimum sample size
            stats[row.vergunningstype] = {
                "count": row.count,
                "avg_dagen": round(row.avg_dagen),
                "min_dagen": row.min_dagen,
                "max_dagen": row.max_dagen,
            }
        else:
            stats[row.vergunningstype] = {
                "count": row.count,
                "avg_dagen": None,
                "insufficient_data": True,
            }

    return stats
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Batch ECLI-hash cache key | Per-ruling JSONB on RulingCache | Phase 84 | Filter changes no longer invalidate analysis cache |
| CachedAPIResponse (org-scoped) | RulingCache.ai_analysis (org-agnostic) | Phase 84 | Eliminates duplicate analysis across tenants |
| 5K char truncation | Section extraction (OVERWEGINGEN + BESLISSING) | Phase 84 | Better context preservation within token budget |
| No vergunningstype | Fixed 9-category taxonomy from AI | Phase 84 | Enables per-type doorlooptijd aggregation |

**Deprecated/outdated:**
- `_build_cache_key()` function in jurisprudence.py (ECLI hash approach) -- replaced by per-ruling cache
- `CachedAPIResponse` for AI juridisch analysis -- no longer needed; analysis stored on RulingCache
- `JuridischAnalyseJob` table -- may still be useful for tracking analysis runs, but cache lookup changes

## Open Questions

1. **Filing date extraction accuracy**
   - What we know: Court rulings often contain "beroepschrift ingediend op {date}" in the PROCESVERLOOP section. The Rechtspraak API metadata has NO filing date field.
   - What's unclear: What percentage of omgevingsrecht rulings contain extractable filing dates. Estimate: 30-60%.
   - Recommendation: Implement regex extraction, measure coverage during first ingestion run. Design for "onvoldoende data" from day one. If coverage is <20%, consider the feature informational-only.

2. **Vergunningstype taxonomy coverage**
   - What we know: The 9 proposed categories (nieuwbouw, verbouw, dakopbouw, etc.) cover common omgevingsrecht case types.
   - What's unclear: Whether Claude consistently maps to these categories or frequently falls back to "overig".
   - Recommendation: Include clear descriptions per category in the prompt. Monitor "overig" percentage; if >30%, refine taxonomy.

3. **JuridischAnalyseJob table future**
   - What we know: Currently used for batch analysis tracking. Per-ruling cache changes the job model.
   - What's unclear: Whether to keep the job table for tracking analysis runs or deprecate it.
   - Recommendation: Keep it for now; use it to track per-gemeente analysis jobs rather than per-batch. The job tracks "analyze gemeente X" rather than "analyze ECLIs [a,b,c]".

## Sources

### Primary (HIGH confidence)
- Existing codebase: `ruling_cache.py`, `jurisprudence_analysis.py`, `claude_client.py`, `schemas.py`, `prompts.py`, `rechtspraak.py` -- full implementation analysis
- Rechtspraak Open Data v1.14/v1.15 technical documentation -- confirmed metadata fields: `dcterms:date` (judgment date), `dcterms:issued` (publication date), NO filing date in metadata
- [Rechtspraak Open Data](https://www.rechtspraak.nl/Uitspraken/Paginas/Open-Data.aspx) -- official API documentation page
- [docplayer v1.14 docs](https://docplayer.nl/10863946-Spir-it-open-data-van-de-rechtspraak-versie-1-14.html) -- detailed field list confirming dcterms:date = datum uitspraak

### Secondary (MEDIUM confidence)
- [rechtspraak-js library](https://github.com/cacfd3a/rechtspraak-js) -- confirms psi:procedure and psi:zaaknummer fields available; notes data quality issues with date typing
- Project SUMMARY.md research -- doorlooptijd approach and pitfalls documented

### Tertiary (LOW confidence)
- Filing date extraction coverage estimate (30-60%) -- needs empirical validation on real ruling texts
- Vergunningstype taxonomy coverage -- needs measurement after initial AI analysis runs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, all patterns verified against codebase
- Architecture: HIGH - per-ruling cache pattern is straightforward extension of existing RulingCache model
- Pitfalls: HIGH - Rechtspraak metadata gap (no filing date) confirmed via official docs; token budget issues from existing implementation analysis
- Doorlooptijd: MEDIUM - filing date extraction from text is feasible but coverage unknown

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable domain, no API changes expected)

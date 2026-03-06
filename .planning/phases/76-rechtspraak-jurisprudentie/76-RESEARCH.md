# Phase 76: Rechtspraak Jurisprudentie - Research

**Researched:** 2026-03-06
**Domain:** Dutch court ruling API (Rechtspraak Open Data), XML parsing, inline document viewer
**Confidence:** HIGH

---

## Summary

Phase 76 is a **full rebuild plus frontend polish** phase. The backend `rechtspraak.py` client is rated 2-3/10 by a prior agent: it imports from a non-existent `app.government_apis.exceptions` module (startup blocker), uses stdlib `xml.etree.ElementTree` without XXE protection, uses a bare `asyncio.Semaphore` instead of the project's `APIRateLimiter` singleton pattern, and constructs `GovernmentAPIError` with wrong signature. The frontend `JurisprudenceSection` and hooks already exist and work — they need targeted fixes: explicit `subject=` parameter to auto-filter for `bestuursrecht_omgevingsrecht`, and an ECLI display that shows court name parsed from the title (it's embedded in the title string, not a separate field).

The Rechtspraak Open Data search API (`data.rechtspraak.nl/uitspraken/zoeken`) returns a standard Atom 1.0 feed with only a default Atom namespace. Each `<entry>` has five child elements: `<id>` (ECLI), `<title>` (contains court name and date embedded), `<summary>` (usually "-"), `<updated>` (ISO timestamp), and `<link>` (alternate HTML URL). The `subject=` parameter accepts PSI URIs like `http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht` and works in combination with `searchterms=`. The full document endpoint returns `<open-rechtspraak>` XML with RDF metadata and an `<uitspraak>` or `<conclusie>` content body using `<para>` elements.

**Primary recommendation:** Create `app/government_apis/exceptions.py` as a re-export shim first (one-liner), then rebuild `rechtspraak.py` following the `sru_bekendmakingen.py` pattern exactly (lxml, APIRateLimiter singleton, base.py imports, correct error signatures). Frontend changes are minor: add `subject=` filter to the API call and extract court name from the title string.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RECHT-01 | User can search court rulings by keyword with omgevingsrecht domain filter | `subject=http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht` parameter confirmed working via live API test (32,490 results). Backend adds it automatically; frontend passes only the user's keyword as `searchterms`. |
| RECHT-02 | User can read full court ruling documents inline with court name and date | Full document XML structure confirmed: `<uitspraak>` body with `<para>` elements; `<dcterms:creator>` for court name, `<dcterms:issued>` for date. Already rendered inline in `JurisprudenceViewer` — needs ECLI validation guard. |
| RECHT-03 | Search defaults to gemeente context when viewing a project/wijk | Already implemented in `JurisprudenceSection` as `defaultSearch = 'omgevingsvergunning ${gemeenteNaam}'`. The fix needed: pass this as `searchterms` while adding the `subject=` filter as a permanent backend parameter, not user-visible. |
| RECHT-04 | Rechtspraak client follows established patterns (correct base.py imports, ECLI format validation, rate limiter registration, lxml XML parsing with XXE protection) | All four sub-requirements researched in detail below. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lxml | >=5.3.0 | XXE-safe XML parsing | Already in pyproject.toml; used by `sru_bekendmakingen.py`; lxml 5.x disables external entities by default |
| httpx | project version | Async HTTP client | Project standard, shared `AsyncClient` passed in |
| app.government_apis.base | project | `GovernmentAPIError`, `retry_with_backoff` | Project three-state contract pattern |
| app.government_apis.rate_limiter | project | `APIRateLimiter` singleton | Project standard; all API clients register here |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| re (stdlib) | stdlib | ECLI regex validation | Validate ECLI before making HTTP request |
| urllib.parse (stdlib) | stdlib | URL encoding search terms | Already in current rechtspraak.py |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lxml XMLParser | defusedxml | defusedxml is a wrapper around stdlib ET; lxml 5.x already safe + already a project dependency |
| APIRateLimiter singleton | asyncio.Semaphore | Semaphore lacks time-based throttling and `enabled` flag for tests |

**No new dependencies needed.** lxml is already in pyproject.toml at `>=5.3.0`.

---

## Architecture Patterns

### Existing Pattern Reference: sru_bekendmakingen.py

This file is the canonical template for a new XML-parsing government API client in this project. Key elements to replicate:

```python
# Module-level XXE-safe XML parser singleton
_parser = etree.XMLParser(
    resolve_entities=False,  # XXE prevention
    no_network=True,         # Block DTD network access
    remove_comments=True,    # Cleaner parsing
)

# Module-level rate limiter singleton (registered in rate_limiter.py)
from app.government_apis.rate_limiter import rechtspraak_limiter

# Correct error import (from base, NOT from exceptions)
from app.government_apis.base import GovernmentAPIError, APITimeoutError, retry_with_backoff
```

### Pattern 1: exceptions.py Startup Blocker Fix

The file `app/government_apis/exceptions.py` does not exist but is imported by both `rechtspraak.py` and `app/api/endpoints/jurisprudence.py`. It must be created as a re-export shim:

```python
# app/government_apis/exceptions.py
"""Re-export shim: GovernmentAPIError lives in base.py."""
from app.government_apis.base import (  # noqa: F401
    GovernmentAPIError,
    APINotFoundError,
    APIRateLimitError,
    APITimeoutError,
)
```

This is a one-liner fix that resolves the startup blocker without changing any callers.

### Pattern 2: APIRateLimiter Registration

New singleton added to `rate_limiter.py`:

```python
# Rechtspraak Open Data — public, polite limits
# Official docs: ~10 req/sec limit; use conservative async limits
rechtspraak_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)
```

Usage in the client:

```python
async with rechtspraak_limiter:
    response = await retry_with_backoff(
        lambda: client.get(url, params=params, timeout=15.0),
        source="rechtspraak",
    )
```

### Pattern 3: ECLI Format Validation

ECLI format: `ECLI:[country]:[court]:[year]:[ordinal]`
- Country: 2 uppercase letters (NL for Netherlands)
- Court: up to 7 chars, uppercase letters
- Year: 4 digits
- Ordinal: up to 25 chars, letters/digits/dots only

```python
import re

_ECLI_RE = re.compile(
    r'^ECLI:[A-Z]{2}:[A-Z0-9]{1,7}:\d{4}:[A-Z0-9.]{1,25}$',
    re.IGNORECASE,
)

def _validate_ecli(ecli: str) -> bool:
    """Return True if ecli matches the ECLI identifier format."""
    return bool(_ECLI_RE.match(ecli.strip()))
```

Validation should happen at the endpoint level in `jurisprudence.py` before calling the client. Return 400 on invalid ECLI rather than making an HTTP request.

### Pattern 4: Atom Feed Parsing with lxml

The search endpoint returns an Atom 1.0 feed. Only the default Atom namespace is present (`http://www.w3.org/2005/Atom`). No psi: or dcterms: extensions appear in the search result entries — those are only in the full document XML.

```python
from lxml import etree

ATOM_NS = "http://www.w3.org/2005/Atom"

def _parse_atom_feed(xml_bytes: bytes) -> list[dict]:
    root = etree.fromstring(xml_bytes, parser=_parser)
    results = []
    for entry in root.findall(f"{{{ATOM_NS}}}entry"):
        ecli = _text(entry, f"{{{ATOM_NS}}}id")
        title = _text(entry, f"{{{ATOM_NS}}}title")
        summary = _text(entry, f"{{{ATOM_NS}}}summary")
        updated = _text(entry, f"{{{ATOM_NS}}}updated")
        if ecli and _validate_ecli(ecli):
            results.append({
                "ecli": ecli,
                "title": title,
                "summary": summary if summary and summary != "-" else "",
                "date": updated.split("T")[0] if updated else "",
            })
    return results
```

### Pattern 5: Full Document XML Parsing

The content endpoint returns `<open-rechtspraak>` as root. Key tags to extract (local-name matching to handle namespaces):

- `<uitspraak>` or `<conclusie>` — main text body, contains `<para>` elements
- `<dcterms:creator>` — court/institution name
- `<dcterms:issued>` — ruling date (ISO date)
- `<inhoudsindicatie>` — summary section (optional, precedes `<uitspraak>`)

The current approach of iterating `root.iter()` and matching local name via `tag.split('}', 1)[-1]` is correct. With lxml's `etree.fromstring(..., parser=_parser)`, this is safe and equivalent functionality to the stdlib approach but XXE-protected.

### Pattern 6: subject= Filter for Omgevingsrecht

The `subject=` parameter accepts a PSI URI and works alongside `searchterms=`:

```
https://data.rechtspraak.nl/uitspraken/zoeken
  ?subject=http://psi.rechtspraak.nl/rechtsgebied%23bestuursrecht_omgevingsrecht
  &searchterms=Amsterdam
  &max=10
  &sort=DESC
```

This returned 20,980 results with both filters active (confirmed via live test). The subject filter should be hardcoded in the backend, not exposed to frontend users. The `searchterms` parameter is the user's free-text query.

**Important:** The `searchterms` parameter in the API does NOT support full-text document search (per the REQUIREMENTS.md "Out of Scope" section and API documentation — it's a metadata/title search). This is acceptable and already documented.

### Pattern 7: Court Name from Title

The search API does not return court name as a separate field. It is embedded in the `<title>` field:

```
"ECLI:NL:RBARN:1998:AA1005, Rechtbank Arnhem, 07-12-1998, 98/2137 98/2138"
```

Format: `ECLI:..., {court name}, {date}, {case number}`

The frontend already strips the ECLI from the display (`res.title.replace(res.ecli, '').replace(/^,\s*/, '')`). The court name can be parsed from this by splitting on `,` and taking the second segment. The full document's `instantie` field gives the canonical court name more reliably.

### Anti-Patterns to Avoid

- **Importing from `app.government_apis.exceptions`:** This module doesn't exist. Always import from `app.government_apis.base`. The exceptions.py shim re-exports from base to fix existing callers without changing them.
- **`async with db.begin()` (irrelevant here):** Jurisprudence has no DB writes, but noted as general pattern.
- **`asyncio.Semaphore` directly in client file:** Replaced by module-level `APIRateLimiter` singleton in `rate_limiter.py`.
- **`xml.etree.ElementTree` (stdlib):** Replace with `lxml.etree` with `_parser` singleton.
- **Catching bare `Exception` and returning `None` silently:** Follow three-state contract — raise `GovernmentAPIError` or return `None` only for explicit 404.
- **Wrong `GovernmentAPIError` signature:** Current `rechtspraak.py` calls `GovernmentAPIError(f"...")` with one arg. The base class requires `GovernmentAPIError(source: str, message: str)`. Must fix all call sites.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XXE protection | Custom entity stripping | `lxml.etree.XMLParser(resolve_entities=False, no_network=True)` | lxml 5.x handles it; sru_bekendmakingen.py already proves the pattern |
| Rate limiting | asyncio.Semaphore per-method | `APIRateLimiter` singleton in rate_limiter.py | Token bucket + semaphore + test `enabled` flag |
| Retry logic | Custom loop | `retry_with_backoff()` from base.py | Already handles 429 + 5xx; source param for logging |
| API error types | Custom exception hierarchy | `GovernmentAPIError`, `APITimeoutError` from base.py | Established project types with correct signatures |

**Key insight:** The entire rebuild is a matter of copy-adapting `sru_bekendmakingen.py` structure. The XML parsing approach (lxml singleton + local-name iteration) is identical.

---

## Common Pitfalls

### Pitfall 1: GovernmentAPIError Signature Mismatch
**What goes wrong:** `GovernmentAPIError("message")` raises `TypeError` at runtime because `base.py` requires `(source, message)` two positional args.
**Why it happens:** The current `rechtspraak.py` was written against a `exceptions.py` module that never existed; the base class was written separately.
**How to avoid:** Always pass `source="rechtspraak"` as first arg: `GovernmentAPIError("rechtspraak", "message here")`. Same for `APITimeoutError("rechtspraak", "message")`.
**Warning signs:** `TypeError: __init__() missing 1 required positional argument` in logs.

### Pitfall 2: Summary Field Usually "-"
**What goes wrong:** Display shows literal "-" as summary text.
**Why it happens:** The Rechtspraak API returns "-" as the summary value for most older decisions. Only recent decisions (post-2015 approx.) have real summaries.
**How to avoid:** In both backend (set to `""`) and frontend (already guards: `res.summary && res.summary !== '-'`), normalize "-" to empty string.

### Pitfall 3: lxml `fromstring()` vs `parse()`
**What goes wrong:** `etree.fromstring()` takes bytes or string; `etree.parse()` takes a file-like object. Using the wrong one raises `TypeError`.
**Why it happens:** The response text needs `.encode()` if passing to `fromstring()`, or pass `response.content` (bytes) directly.
**How to avoid:** Use `etree.fromstring(response.content, parser=_parser)` — `response.content` is bytes, which lxml accepts directly.

### Pitfall 4: ECLI in URL Path Must Be Encoded
**What goes wrong:** `GET /doc/ECLI:NL:RVS:2023:1234` — colons in path cause 404 or routing failure.
**Why it happens:** ECLI contains `:` which is a path delimiter in URLs.
**How to avoid:** Frontend already uses `encodeURIComponent(ecli)` in the API call. Backend route uses `ecli: str` path param — FastAPI decodes it automatically. The content endpoint uses `?id=ECLI:...` (query param), which is safe.

### Pitfall 5: subject= URI Must Be Percent-Encoded
**What goes wrong:** `subject=http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht` — the `#` in the URI becomes a URL fragment separator if not encoded.
**Why it happens:** Fragment identifiers after `#` are not sent to the server.
**How to avoid:** Use `urllib.parse.quote(subject_uri, safe='')` or pass as httpx params dict (httpx encodes automatically): `params={"subject": "http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht"}`. httpx encodes `#` → `%23` in query strings.

### Pitfall 6: `app/api/` Directory Is Untracked
**What goes wrong:** The `backend/app/api/` directory is listed as `??` in git status — it's completely untracked including `endpoints/jurisprudence.py`. Any commit must stage these files explicitly.
**Why it happens:** The directory was created in a prior session but never committed.
**How to avoid:** Both plans must stage `backend/app/api/` when committing.

---

## Code Examples

### Corrected Client Skeleton (following sru_bekendmakingen.py pattern)

```python
"""Rechtspraak Open Data API client."""
import logging
import re
import urllib.parse

import httpx
from lxml import etree

from app.government_apis.base import APITimeoutError, GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import rechtspraak_limiter

logger = logging.getLogger(__name__)

SEARCH_URL = "https://data.rechtspraak.nl/uitspraken/zoeken"
CONTENT_URL = "https://data.rechtspraak.nl/uitspraken/content"
ATOM_NS = "http://www.w3.org/2005/Atom"
OMGEVINGSRECHT_URI = (
    "http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht"
)

_ECLI_RE = re.compile(
    r'^ECLI:[A-Z]{2}:[A-Z0-9]{1,7}:\d{4}:[A-Z0-9.]{1,25}$',
    re.IGNORECASE,
)

_parser = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    remove_comments=True,
)


def validate_ecli(ecli: str) -> bool:
    return bool(_ECLI_RE.match(ecli.strip()))
```

### Rate Limiter Singleton Registration

```python
# In rate_limiter.py — append after existing singletons:
# Rechtspraak Open Data — public, polite limits
rechtspraak_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)
```

### exceptions.py Shim (one file, fixes startup blocker)

```python
# backend/app/government_apis/exceptions.py
"""Backward-compatibility re-export. GovernmentAPIError lives in base.py."""
from app.government_apis.base import (  # noqa: F401
    GovernmentAPIError,
    APINotFoundError,
    APIRateLimitError,
    APITimeoutError,
)
```

### Frontend: ECLI Display Showing Court Name

The title string format is `"ECLI:NL:RVS:2023:1234, Raad van State, 15-03-2023, 202301234/1/R4"`.

```typescript
// Extract court name from title: split on ', ' and take index 1
function parseCourtFromTitle(ecli: string, title: string): string {
  const withoutEcli = title.replace(ecli, '').replace(/^,\s*/, '')
  const parts = withoutEcli.split(', ')
  return parts[0] ?? ''
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `xml.etree.ElementTree` (stdlib) | `lxml.etree` with `XMLParser(resolve_entities=False)` | XXE protection |
| `asyncio.Semaphore(5)` in client file | `APIRateLimiter` singleton in rate_limiter.py | Time-based throttling + test disable support |
| `from app.government_apis.exceptions import ...` | `from app.government_apis.base import ...` (after creating shim) | Resolves startup ImportError |
| `GovernmentAPIError("message")` | `GovernmentAPIError("rechtspraak", "message")` | Correct base class contract |

**No deprecated items in the Rechtspraak API itself.** The API has been stable at `data.rechtspraak.nl` since 2013.

---

## Open Questions

1. **omgevingsrecht subject vs searchterms combined behavior**
   - What we know: Live test confirmed `subject=bestuursrecht_omgevingsrecht&searchterms=Amsterdam` returns 20,980 results; subject-only returns 32,490.
   - What's unclear: Whether `searchterms` does title search or description search. API docs say it's NOT full-text (confirmed in REQUIREMENTS.md Out of Scope).
   - Recommendation: Proceed with both parameters. The combination narrows results meaningfully.

2. **`return=DOC` parameter**
   - What we know: The wetsuite docs mention a `return` parameter for DOC availability filtering.
   - What's unclear: Whether `return=DOC` means "only return entries where full doc is available" or something else.
   - Recommendation: Add `return=DOC` to search params to avoid entries with no fetchable document.

3. **Frontend omgevingsrecht filter visibility**
   - What we know: Success criterion says "omgevingsrecht/bestuursrecht domain automatically" — auto-applied, not user-configurable.
   - What's unclear: Whether to show a label/badge "Omgevingsrecht filter actief" in the UI.
   - Recommendation: Add a small `<span>` badge below the search input indicating the domain filter is active. Low effort, good UX transparency.

---

## Sources

### Primary (HIGH confidence)
- Live API test: `https://data.rechtspraak.nl/uitspraken/zoeken?subject=http://psi.rechtspraak.nl/rechtsgebied%23bestuursrecht_omgevingsrecht&searchterms=Amsterdam&max=3` — confirmed subject + searchterms combination, entry structure, namespace, result count
- Live API test: `https://data.rechtspraak.nl/uitspraken/content?id=ECLI:NL:RVS:2023:1234` — confirmed `<open-rechtspraak>` root, `<uitspraak>` body, `<dcterms:creator>`, `<dcterms:issued>` structure
- Project codebase: `backend/app/government_apis/sru_bekendmakingen.py` — canonical template for lxml XMLParser pattern
- Project codebase: `backend/app/government_apis/rate_limiter.py` — APIRateLimiter singleton registration pattern
- Project codebase: `backend/app/government_apis/base.py` — GovernmentAPIError(source, message) two-arg signature confirmed
- lxml FAQ: `https://lxml.de/FAQ.html` — `XMLParser(resolve_entities=False, no_network=True)` confirmed as XXE protection approach

### Secondary (MEDIUM confidence)
- wetsuite API docs: `https://wetsuite.knobs-dials.com/apidocs/wetsuite.datacollect.rechtspraaknl.html` — confirmed `subject=`, `creator=`, `max=`, `sort=`, `type=`, `return=` params; MEDIUM because unofficial wrapper docs
- Rechtspraak Open Data technical docs v1.15 referenced at `https://www.rechtspraak.nl/SiteCollectionDocuments/Technische-documentatie-Open-Data-van-de-Rechtspraak.pdf` — not fetched directly but multiple sources confirm parameter set

### Tertiary (LOW confidence)
- PSI URI for omgevingsrecht: `http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht` — confirmed WORKING via live API test returning 32,490 results (elevated to MEDIUM)
- ECLI format regex: `ECLI:[A-Z]{2}:[A-Z0-9]{1,7}:\d{4}:[A-Z0-9.]{1,25}` — derived from ECLI specification on Wikipedia + EU e-Justice portal

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — lxml already in project, all patterns verified against existing code
- Architecture: HIGH — live API tests confirmed request/response structure; existing sru_bekendmakingen.py is exact template
- Pitfalls: HIGH — startup blocker confirmed via git status + STATE.md; error signature confirmed by reading base.py

**Research date:** 2026-03-06
**Valid until:** 2026-09-06 (Rechtspraak API is very stable; subject URIs rarely change)

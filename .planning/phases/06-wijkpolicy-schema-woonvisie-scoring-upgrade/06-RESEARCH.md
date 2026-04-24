# Phase 6: WijkPolicy schema + woonvisie scoring upgrade — Research

**Researched:** 2026-04-24
**Domain:** Backend — Pydantic schema evolution, Anthropic tool-use `input_schema`, scorer refactor, cache invalidation via SCHEMA_VERSION bump
**Confidence:** HIGH (codebase inspection complete; all assertions grounded in verified file reads; Anthropic tool-use guidance cross-checked with current docs)

## Summary

Phase 6 is a **schema evolution + scorer refactor** landing in three files: `backend/app/ai/factors/woonvisie_match.py` (Pydantic + Anthropic tool schema), `backend/app/ai/factor_extraction_schemas.py` (SCHEMA_VERSION bump 3→4 + `ExtractedFactor.schema_version` default), and `backend/app/services/score_v3_factors.py:1201` (`score_woonvisie_match` rewrite). The current scorer consumes flat gemeente-brede lists (`growth_wijken`/`shrink_wijken`/`herstructureringswijken`/`excluded_project_types`); Phase 6 replaces that with per-wijk `WijkPolicy` objects containing quotable `citaat` + `pagina` so Phase 3 popup can render wijk-specific beleid text.

The integration surface is narrow: `cascade_enrichment_service.get_cascade_payloads()` is payload-shape agnostic (already using `DOCUMENT_SENTINEL` from Phase 5, no changes needed), the compute_score_v3 caller at `score_v3.py:422` passes `(payload, wijk_naam, project_type)` unchanged, and `FACTOR_REGISTRY["woonvisie_match"]` entry + weight-by-projecttype mapping stay intact. The breakage surface for the 275-test suite is limited to `backend/tests/integration/test_woonvisie_match.py` (6 tests that assert behaviour against old WoonvisiePayload fields) — all other woonvisie-touching tests use local Sample payloads or only reference `source_key="woonvisie"` string identifier.

**Primary recommendation:** Use Anthropic tool-use `input_schema` with a nested `wijk_policies` array of objects (each with `required: ["wijk_naam","prioriteit","gewenste_segmenten","citaat"]`), keep `wijk_policies` optional at top level (fallback to `algemeen_citaat`), and add defensive Dutch-normalisation (casefold + NFKD diacritic-strip + strip whitespace + strip hyphens) before substring match so "Venlo-Centrum" also matches "Venlo Centrum" and "venlo centrum". Store structured `matched_policy` in `FactorResult.waarde` as dict so Phase 3 popup reads it directly without re-parsing `toelichting_lang`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**1. WijkPolicy schema (LOCKED via ROADMAP)**
- Velden: `wijk_naam: str`, `prioriteit: Literal["groei","krimp","herstructurering","neutraal"]`, `gewenste_segmenten: list[Literal["sociaal","midden","duur","gemengd"]]`, `citaat: str` (non-empty, `min_length=1`), `pagina: int | None`
- `citaat` is **required non-empty** — als Claude geen citaat kan extraheren voor een wijk, laat hij de WijkPolicy weg (lege lijst is OK)
- `pagina` is **optional** — sommige woonvisies hebben geen duidelijke paginanummering

**2. WoonvisiePayload uitbreiding**
- Nieuw: `wijk_policies: list[WijkPolicy] = []` (default leeg = vage extractie)
- Nieuw: `algemeen_citaat: str = ""` (fallback voor gemeente-brede tekst als `wijk_policies` leeg is)
- Behouden: `periode_start`, `periode_einde`, `document_type`, `opgave_totaal`, `pct_*`, `confidence`
- **Oude velden:** `growth_wijken`, `shrink_wijken`, `herstructureringswijken`, `prioritized_segment`, `excluded_project_types`, `doelgroepen` blijven in het Pydantic model voor backwards-compat van cache-entries, maar Claude krijgt ze **niet meer in de prompt/input_schema** (dus nieuwe extracties vullen ze niet). SCHEMA_VERSION 3→4 invalideert oude entries.
- `score_woonvisie_match()` leest **alleen** `wijk_policies` + `algemeen_citaat` + `confidence` — geen fallback naar oude velden.

**3. Claude tool_use schema**
- `_INPUT_SCHEMA` krijgt `wijk_policies` als `{type: "array", items: {type: "object", properties: {...}, required: ["wijk_naam","prioriteit","gewenste_segmenten","citaat"]}}`
- `required` op top-level blijft: `["periode_start","periode_einde","confidence"]` — `wijk_policies` + `algemeen_citaat` mogen default-empty zijn (vage documenten)
- `prompt_instructions` herschreven: focus op "per wijk extraheren: naam + prioriteit + gewenste segmenten + letterlijk citaat + pagina". Expliciet: "laat WijkPolicy leeg als citaat niet letterlijk terug te vinden is — geen hallucinaties".

**4. Fallback bij geen wijk-match**
Als `wijk_policies == []` (vage doc) OF `wijk_naam` matcht geen enkele `WijkPolicy.wijk_naam` via substring-logica:
- Score = **5.0 neutraal** (behoud huidige startpunt-logica)
- `toelichting_lang` = `algemeen_citaat` (gemeente-brede tekst), of generieke fallback-string als ook `algemeen_citaat` leeg is
- **NIET** `missing=True` — de factor draagt nog steeds bij aan gemeente-brede score, alleen zonder wijk-differentiatie
- **NIET** terugvallen op oude `growth_wijken`-lijsten — dat is dode code na SCHEMA_VERSION bump

**5. Substring-matching (LOCKED via ROADMAP)**
Bidirectioneel: `g in wijk_lower or wijk_lower in g` voor elke `wijk_policies[i].wijk_naam`. Matcht "Blerick" met "Blerick-Noord" én "Blerick" (exact). **Eerste match wint** — lijst-volgorde uit Claude. Als `parcel.wijk_naam` None/leeg is → geen match → fallback (§4).

**6. Projecttype × segment scoring**
Behoud bestaande `_PROJECTTYPE_SEGMENT_MAP` in `score_v3_factors.py`:
- `nieuwbouw_wonen` → `[sociaal, midden]`
- `transformatie_wonen` → `[sociaal, midden, gemengd]`
- `optoppen` → `[midden, duur]`
- `splitsen` → `[sociaal, midden]`
- `commercieel_naar_wonen` → `[midden, gemengd]`
- `onbepaald` → `[]`

Bonus +2.0 per overlap tussen `preferred_segments` en `wijk_policies[match].gewenste_segmenten`. Penalty -1.0 als `preferred_segments` non-empty én geen overlap. Geen stapeling van bonussen voor meerdere matches — max één +2.0 per scoring-call.

**7. Confidence-pull (behouden)**
Score × `payload.confidence` + 5.0 × (1 - `payload.confidence`), dan clamp 0..10, dan `/10` voor `genormaliseerde_score`. Per-factor confidence (uit hele-document extractie), niet per-WijkPolicy.

**8. Citaat-format in toelichting_lang**
Plain text: `"{uitleg_regel}. Citaat ({wijk_naam}, p.{pagina}): {citaat_tekst}"` — of zonder pagina-suffix als `pagina is None`. Phase 3 popup parset dit niet; die leest `matched_policy` structured uit `FactorResult.waarde` (wordt daar in opgeslagen als dict met wijk-metadata). `toelichting_lang` is dus voor mens-readability + FactorCard expanded-view; popup gebruikt structured data.

**Implication:** `FactorResult.waarde` voor woonvisie_match is nu een dict: `{"matched_wijk": str | None, "matched_policy": WijkPolicy.model_dump() | None, "prioritized_segment": str, "algemeen_citaat": str}`.

**9. SCHEMA_VERSION bump**
`SCHEMA_VERSION: int = 4` in `factor_extraction_schemas.py`. Test `test_schema_version_exists_and_is_int` aanpassen naar `>= 3` (version-agnostic per Phase 5 beslissing). Bestaande `SCHEMA_VERSION >= 2` guards in Phase 1 tests blijven correct.

**10. Tests (version-agnostic)**
- `test_wijk_policy_schema.py` — Pydantic validation
- `test_score_woonvisie_match_wijk_differentiation.py` — Blerick (groei, sociaal) vs Venlo-Centrum (neutraal, duur) met `project_type="nieuwbouw_wonen"`
- `test_score_woonvisie_match_fallback.py` — lege `wijk_policies` + `algemeen_citaat` gevuld → score 5.0
- Cache-invalidation test via bestaande pattern
- Pre-existing 275 tests **moeten groen blijven**

### Claude's Discretion
- Exacte `prompt_instructions` tekst voor Claude (herschrijven vanuit huidige)
- `_INPUT_SCHEMA` JSON-details (description-strings, enum-declaraties)
- Dict-structuur van `FactorResult.waarde` (sleutelnaam-conventie)
- Logging-regels bij lege `wijk_policies` extractie (warning vs info)

### Deferred Ideas (OUT OF SCOPE)
- **Per-WijkPolicy confidence veld** — over-engineering voor M048; één document-level confidence is voldoende. Naar M050+.
- **Herziene `_PROJECTTYPE_SEGMENT_MAP`** — huidige mapping werkt voor Venlo-POC, uitbreiding in M050+.
- **Configureerbare projecttype-segment matrix per organisatie** — niet nodig voor M048.
- **Old-field deletion uit WoonvisiePayload** — verwijderen van `growth_wijken`/`shrink_wijken`/etc. uit Pydantic model. Nu: deprecaten (Claude stopt vullen), blijven lezen voor cache-backwards-compat. Clean delete in M050+ als alle pre-v4 caches verdwenen zijn.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WOON-04 | `WijkPolicy` pydantic model met wijk_naam, prioriteit, gewenste_segmenten, citaat, pagina | §Standard Stack (Pydantic v2 Literal + Field constraints); §Architecture Patterns (single-module definition next to WoonvisiePayload in `woonvisie_match.py`); §Code Examples (Pydantic BaseModel with Literal + min_length) |
| WOON-05 | `WoonvisiePayload` uitgebreid met `wijk_policies`, `algemeen_citaat`, `confidence`; SCHEMA_VERSION bump 3→4 | §Standard Stack (existing Pydantic v2 pattern reused); §Architecture Patterns (bump in `factor_extraction_schemas.py:114` + `ExtractedFactor.schema_version` default bump from 3 to 4); §Cache Invalidation (no migration — WHERE clause `schema_version == SCHEMA_VERSION` in `_get_cache_hit` auto-rejects v3 rows) |
| SCORE-04 | `score_woonvisie_match()` produceert differentiërende scores per wijk met zelfde projecttype | §Architecture Patterns (rewrite at `score_v3_factors.py:1201`); §Code Examples (substring match + prioriteit-basis + segment × projecttype); §Common Pitfalls (Dutch name normalisation, first-match semantics, confidence-pull retention) |
| TEST-06 | Unit/integration tests: Blerick vs Venlo-Centrum produceren verschillende scores met zelfde projecttype | §Validation Architecture (3 nieuwe test files + existing `test_woonvisie_match.py` rewrite); §Code Examples (Blerick-groei vs Centrum-neutraal fixture pattern); §Common Pitfalls (275-suite breakage surface contained to 6 existing tests) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pydantic | v2.x (`BaseModel`, `Field`, `Literal`) | `WijkPolicy` + `WoonvisiePayload` validation | Project-wide standard — all factor payloads extend Pydantic v2 BaseModel per `factor_extraction_schemas.py` contract |
| anthropic (Claude SDK) | project-pinned (via `AI_MODEL=anthropic/claude-haiku-4-5-20251001` through OpenRouter) | tool-use `input_schema` for structured extraction | Already wired in `factor_extraction_service.py`; no new dependency |
| SQLAlchemy 2.x `Mapped[]` | existing | `FactorExtractionCache` row reads/writes | WHERE clause with `schema_version == SCHEMA_VERSION` auto-rejects old entries (verified in `_get_cache_hit`) |
| pytest + pytest-asyncio | existing | unit + integration tests | Project-wide standard; version-agnostic guards pattern from Phase 5 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `unicodedata` (stdlib) | — | NFKD diacritic stripping for Dutch wijk-naam normalisation | If user-supplied `parcel.wijk_naam` differs in diacritics/casing from Claude-extracted `WijkPolicy.wijk_naam` |
| `uuid` (stdlib) | — | Test fixture policy_document IDs | Existing pattern in `test_woonvisie_match.py` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual JSON Schema in `_INPUT_SCHEMA` dict | `WijkPolicy.model_json_schema()` auto-gen | Rejected per `FactorDefinition` docstring: Anthropic wants `type/properties/required` without `$defs`-indirection — manual write keeps schema debuggable. Stay with existing project convention. |
| Enum class for `prioriteit` | `Literal["groei",...]` string union | `Literal` already used in `WoonvisiePayload.document_type`; project convention. Enums would require json-schema `enum` gen differently and break Pydantic → JSON Schema alignment. |
| Split new `WijkPolicy.py` module | Keep in `woonvisie_match.py` | Context.md locks "same module" — file is 140 lines, well under 300-line rule. No benefit to splitting. |
| Delete deprecated fields now | Keep deprecated fields for cache backwards-compat | Context §2 + §Deferred explicitly keeps them. SCHEMA_VERSION bump invalidates, but Pydantic validator must accept pre-v4 cache-read shapes if read path ever short-circuits the version check. Safer to keep. |

**Installation:** No new dependencies. All packages already in `backend/pyproject.toml`.

## Architecture Patterns

### Recommended Project Structure

No new files beyond tests. Edits land in exactly these 3 source files:

```
backend/app/
├── ai/
│   ├── factor_extraction_schemas.py   # SCHEMA_VERSION 3→4 (line 114) + ExtractedFactor.schema_version default 3→4 (line 64)
│   └── factors/
│       └── woonvisie_match.py          # Add WijkPolicy class + extend WoonvisiePayload + rewrite _INPUT_SCHEMA + new prompt_instructions
└── services/
    └── score_v3_factors.py:1201        # Rewrite score_woonvisie_match body (signature unchanged)

backend/tests/
├── unit/
│   ├── test_wijk_policy_schema.py                          # NEW — Pydantic field validation
│   ├── test_score_woonvisie_match_wijk_differentiation.py  # NEW — Blerick > Centrum with same projecttype
│   ├── test_score_woonvisie_match_fallback.py              # NEW — algemeen_citaat pad
│   └── test_factor_extraction_schemas.py                   # EDIT — version-agnostic guard (>=3 → >=4 or use SCHEMA_VERSION constant)
└── integration/
    └── test_woonvisie_match.py                             # REWRITE 6 existing tests to use wijk_policies shape
```

### Pattern 1: FactorDefinition schema mirror

**What:** Pydantic `payload_model` and Anthropic `input_schema` JSON dict are manually kept aligned. Pydantic validates Claude's tool_use output at runtime; the JSON dict constrains Claude's generation at inference. Single source of truth is the Pydantic model; the dict is the Anthropic-compatible projection.

**When to use:** Every new factor extraction or schema extension.

**Example (how WijkPolicy lands):**
```python
# backend/app/ai/factors/woonvisie_match.py — Source: file inspection 2026-04-24
from typing import Literal
from pydantic import BaseModel, Field

class WijkPolicy(BaseModel):
    """Per-wijk beleid extracted from a woonvisie (Phase 6)."""
    wijk_naam: str = Field(min_length=1, description="Wijk-naam zoals in woonvisie-tekst")
    prioriteit: Literal["groei", "krimp", "herstructurering", "neutraal"]
    gewenste_segmenten: list[Literal["sociaal", "midden", "duur", "gemengd"]] = Field(default_factory=list)
    citaat: str = Field(min_length=1, description="Letterlijk citaat uit document, non-empty")
    pagina: int | None = Field(default=None, ge=1, description="Paginanummer in document, None als niet duidelijk")
```

### Pattern 2: SCHEMA_VERSION bump for cache invalidation

**What:** Bumping the constant in `factor_extraction_schemas.py:114` auto-rejects all old rows via the `_get_cache_hit` WHERE clause (`FactorExtractionCache.schema_version == SCHEMA_VERSION`). No Alembic migration. Old rows stay in DB and are superseded via `on_conflict_do_update` on next write.

**When to use:** Any backwards-incompat payload-shape change or new required metadata field.

**Example:**
```python
# factor_extraction_schemas.py — Source: lines 114-121 existing + Phase 6 bump
SCHEMA_VERSION: int = 4  # bumped 3→4 in M048/Phase 6 for WijkPolicy shape

# factor_extraction_schemas.py — ExtractedFactor.schema_version default — line 64
schema_version: int = Field(default=4, description="...")  # was default=3 post-Phase 5
```

### Pattern 3: Structured `FactorResult.waarde` for frontend consumption

**What:** `FactorResult.waarde` is typed `Any` — previously a plain string `"sociaal"`. Post-Phase 6, it becomes a dict so Phase 3 popup can read `matched_policy` without re-parsing `toelichting_lang` natural text.

**When to use:** When downstream UI needs structured access to factor-specific metadata (this pattern also used for `geluid` → `{"lden_db": ..., "classification": ...}` at `score_v3_factors.py:1192`).

**Example contract:**
```python
# score_v3_factors.py:1201 — new shape
FactorResult(
    waarde={
        "matched_wijk": str | None,       # parcel.wijk_naam when a WijkPolicy matched
        "matched_policy": dict | None,     # WijkPolicy.model_dump() of the winning policy
        "prioritized_segment": str,         # effective segment label for backwards-compat UI
        "algemeen_citaat": str,             # gemeente-brede fallback text
    },
    ...
)
```

### Anti-Patterns to Avoid

- **Hand-rolling wijk-naam fuzzy matching (Levenshtein / rapidfuzz)** — Context locks bidirectional substring; adding fuzzy match invites false positives ("Venlo" matches every wijk containing "Venlo"). Stick to substring; if precision fails, extend Claude's prompt to return multiple aliases per policy, not fuzzy-search here.
- **Using `WijkPolicy.model_json_schema()` directly for Anthropic** — produces `$defs`-references Claude tool-use doesn't flatten well. Manual `_INPUT_SCHEMA` dict is the established project pattern ([factor_extraction_schemas.py:26-34](file)).
- **Reading deprecated fields as fallback in scorer** — Context §4 explicitly locks: new scorer reads `wijk_policies + algemeen_citaat + confidence` only. Keeping old-field fallback creates dual-code-paths that mask extraction regressions.
- **Raising on empty `wijk_policies`** — per Context §4, fallback is score=5.0 neutraal (not `missing=True`). The factor contributes to gemeente-brede score even without wijk differentiation.
- **Nested `$ref` in Anthropic `input_schema`** — cross-verified against Anthropic 2026 docs: "avoid recursive schemas, flatten hierarchical structures" and "additionalProperties: false for strict validation". Inline the `wijk_policies` item schema; do NOT split to a separate `$defs` entry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pydantic-JSON-Schema divergence detection | Custom diff between `model_json_schema()` and `_INPUT_SCHEMA` | Manual review + Pydantic validator catching mismatches at runtime (existing `FactorExtractionError(error_code="SCHEMA_VALIDATION_FAILED")`) | Project pattern already in place (`factor_extraction_schemas.py` docstring); over-engineering for single factor |
| Wijk-naam alias resolution | Custom alias table ("Blerick" ↔ "Blerick-Noord" ↔ "Oud-Blerick") | Claude extracts long-form per woonvisie + bidirectional substring catches subsets | Woonvisies use inconsistent phrasing across gemeenten; Claude learns per-document patterns. Our job: capture what the document literally says in `WijkPolicy.wijk_naam`. |
| Cache invalidation via Alembic migration | DELETE-from-table migration | SCHEMA_VERSION bump + WHERE-clause auto-reject | Zero-downtime; re-extraction happens lazily per-document via cache-miss path; `on_conflict_do_update` supersedes old rows |
| Dict-shape validation for `FactorResult.waarde` | Dataclass or TypedDict layer | Keep `waarde: Any`, document the dict contract inline | `FactorResult.waarde` is `Any` by design (already dict for `geluid`, string for `vergunning_succeskans`). Adding typing layer breaks existing factors. Frontend TypeScript types handle the consumer contract. |
| Cost estimation per Claude call | Custom token counter | Existing cache layer + DOCUMENT_SENTINEL already collapse 100k → 1 per document | Phase 5 landed; nothing to add |

**Key insight:** Phase 6 is fundamentally a **schema-and-scorer change**; no new infrastructure is justified. Every integration point (cache, DOCUMENT_SENTINEL, extract_factor wrapper, compute_score_v3 caller) is already in place from Phases 1/5 or M047.

## Common Pitfalls

### Pitfall 1: Dutch wijk-naam case + diacritic mismatches
**What goes wrong:** `parcel.wijk_naam = "Venlo-centrum"` (lowercase c from PDOK) doesn't substring-match `WijkPolicy.wijk_naam = "Venlo-Centrum"` (titlecase from woonvisie text). Worse: "Oud-Blerick" with ASCII hyphen vs "Oud‐Blerick" with Unicode non-breaking hyphen.
**Why it happens:** Current scorer already lowercases both sides (`wijk_lower = (wijk_naam or "").lower()`), but does NOT strip diacritics or normalise hyphens. Source data (BAG wijk-indeling vs woonvisie PDF) comes from different publishing chains.
**How to avoid:** Normalise BOTH sides before substring-match:
```python
import unicodedata
def _norm_wijk(s: str) -> str:
    # NFKD split diacritics, filter-out combining marks, casefold, collapse hyphen variants
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.casefold().replace("­", "").replace("‐", "-").replace("‑", "-").strip()
```
Apply `_norm_wijk` to both `parcel.wijk_naam` and each `wijk_policies[i].wijk_naam` before comparing. This is listed as Claude's discretion — recommend implementing.
**Warning signs:** Integration test passes for exact-match ASCII fixture, but Venlo smoke-test on real PDOK data misses "blerick" (lowercase BAG output) vs "Blerick" (titlecase woonvisie).

### Pitfall 2: First-match semantics hide multi-match intent
**What goes wrong:** A parcel in "Blerick" matches BOTH a specific "Blerick-Noord" policy AND a broader "Blerick" policy. Substring-match finds the first in list order (Claude-determined), not the most-specific.
**Why it happens:** Context §5 locks "eerste match wint". Claude's list order is not guaranteed specific-first.
**How to avoid:** Iterate all policies, collect matches, prefer the longest normalised `wijk_naam` match (max `len(normalised_policy_name)`). Document the rationale in code comment. This is deterministic and still respects "eerste match" semantics when list has only one match.
**Warning signs:** Fixture with overlapping policies produces order-dependent scores; flaky test when Claude's mock-response list order shifts.

### Pitfall 3: Missing `wijk_naam` on parcel data
**What goes wrong:** `parcel_data.get("wijk_naam")` returns `None` for ~2-5% of Venlo parcelen (PDOK CBS wijkindeling has gaps near gemeente borders). Current scorer's `if wijk_naam` guard handles this; new scorer must too.
**Why it happens:** BAG pand without CBS wijk-mapping (typically industrial parcelen or water-adjacent).
**How to avoid:** Explicitly test `if not parcel_wijk_norm: → fallback` before iterating `wijk_policies`. Score 5.0 + `algemeen_citaat` toelichting.
**Warning signs:** `test_woonvisie_match_no_wijk_returns_neutral` (existing) — rewrite with new payload shape but keep the expectation.

### Pitfall 4: Deprecated-field presence breaks cache roundtrip
**What goes wrong:** A cache row written at SCHEMA_VERSION=3 contains `growth_wijken` but NOT `wijk_policies`. If `_get_cache_hit` short-circuits the version check (or we loosen the WHERE clause for debugging), Pydantic rehydration of the v3 payload with the v4 model would fail validation (missing `wijk_policies` field? No — `default=[]` makes it optional; missing `algemeen_citaat`? default=""). So rehydration actually succeeds with empty new fields → scorer sees empty `wijk_policies` → falls through to algemeen fallback → scoring-regression without user-visible error.
**Why it happens:** Keeping deprecated fields + making new fields default-empty means Pydantic roundtrips silently.
**How to avoid:** Trust the SCHEMA_VERSION WHERE clause — that IS the guard. Add explicit `test_v3_cache_entry_is_miss_after_bump_to_v4` test following the Phase 5 pattern (`test_v2_cache_entry_is_miss_after_bump_to_v3` in `test_factor_extraction_service.py`). Keep the rest of the contract as designed.
**Warning signs:** Dev runs scan, logs show "from_cache=True" but score doesn't differ between wijken — indicates v3 row served, which should not happen if SCHEMA_VERSION=4.

### Pitfall 5: Frontend contract drift (`FactorResult.waarde` str → dict)
**What goes wrong:** Phase 3 frontend currently expects `waarde: string` (prioritized_segment). Phase 6 ships `waarde: dict` before Phase 3 ships. If any existing frontend code reads `scan.flags.score_breakdown.woonvisie_match.waarde` it breaks.
**Why it happens:** `FactorResult.waarde` is typed `Any` on backend, dynamic on frontend.
**How to avoid:** (a) Grep frontend for `waarde` reads on `woonvisie_match` — Phase 6 plan should include "audit frontend consumers" task, flag for Phase 3 planning. (b) Keep `prioritized_segment` as a key INSIDE the dict (chosen from matched policy's first `gewenste_segmenten`, or `"gemengd"` fallback) so any legacy string-reader degrades gracefully if we stringify on serialize.
**Warning signs:** Phase 3 TypeScript types don't match Phase 6 dict shape; test assertions on `waarde` in `test_woonvisie_match.py:test_compute_score_v3_woonvisie_in_breakdown` need update.

### Pitfall 6: Confidence-pull masking wijk differentiation
**What goes wrong:** If Claude returns `confidence=0.3` for a vague woonvisie, the score is pulled strongly toward 5.0: `score * 0.3 + 5.0 * 0.7 = 0.3s + 3.5`. Blerick (raw ~9.0) lands at 5.6; Venlo-Centrum (raw ~3.0) lands at 4.4. Still differentiating, but compressed.
**Why it happens:** Current formula (Context §7 locks it). Differentiation-test (TEST-06) needs high-confidence fixture to pass with margin.
**How to avoid:** Use `confidence=0.9` in `test_score_woonvisie_match_wijk_differentiation` fixtures (already the pattern in existing `test_woonvisie_match_growth_wijk_boosts_score`). Assert Blerick > 7 and Centrum < 5 (Context §10) — achievable at 0.9 confidence.
**Warning signs:** Test flakes when confidence is set < 0.7.

### Pitfall 7: 275-test suite breakage — scope is narrower than it looks
**What goes wrong:** Fear of breaking "275 tests" balloons the perceived risk.
**Actual breakage surface (verified via grep):**
- `backend/tests/integration/test_woonvisie_match.py` — 6 tests directly use old `WoonvisiePayload(growth_wijken=...)` constructor + `result.toelichting_kort` assertion on old output. **REWRITE all 6.**
- `backend/tests/unit/test_factor_extraction_schemas.py:110` — `test_schema_version_is_three` — **UPDATE to version-agnostic** (use `assert SCHEMA_VERSION >= 3` or import-and-compare).
- `backend/tests/integration/test_cascade_enrichment_service.py` — constructs `WoonvisiePayload(..., growth_wijken=["Blerick"])` in fake_extract_factor monkeypatch. **Still valid** because old fields remain on model (Pydantic accepts old-shape for backwards-compat). No edit needed.
- `backend/tests/integration/test_rescore_cascade_job.py` — references `_V3_FLAGS["score_breakdown"]["woonvisie_match"]` dict stub, does NOT construct WoonvisiePayload. **No edit needed.**
- `backend/tests/integration/test_factor_extractor.py` — uses local `SampleFactorPayload` with unrelated fields; same name, independent model. **No edit needed.**
- `backend/tests/integration/test_m045_*` — reference `source_key="woonvisie"` string only. **No edit needed.**
- `backend/tests/unit/test_factor_extraction_service.py` — constructs `_SimplePayload` with unrelated fields + uses `WOONVISIE_MATCH_FACTOR_DEF` with minimal mock tool-input dict. The mock dict `{"growth_wijken":["Blerick"]}` still Pydantic-validates against new model (old fields remain; new fields default-empty). **No edit needed.**

**How to avoid:** Plan explicitly lists the edit list above; do NOT blanket-rewrite. Run `pytest backend/tests/ -x` after each step.
**Warning signs:** Running full suite at end uncovers unexpected test that grep missed — add that file to plan if found.

## Code Examples

Verified patterns from existing code + Context decisions.

### Example 1: WijkPolicy Pydantic model (NEW)

```python
# backend/app/ai/factors/woonvisie_match.py — Source: Context §1 + existing WoonvisiePayload pattern
from typing import Literal
from pydantic import BaseModel, Field

class WijkPolicy(BaseModel):
    """Per-wijk beleid uit een gemeentelijke woonvisie (M048/Phase 6).
    
    Replaces flat gemeente-brede lists (growth_wijken/shrink_wijken/etc.) with
    structured per-wijk policies carrying a quotable citaat for UI display.
    """
    wijk_naam: str = Field(min_length=1, description="Wijk-naam zoals in woonvisie-tekst")
    prioriteit: Literal["groei", "krimp", "herstructurering", "neutraal"]
    gewenste_segmenten: list[Literal["sociaal", "midden", "duur", "gemengd"]] = Field(
        default_factory=list,
        description="Voorkeurssegmenten voor deze wijk; lege lijst = geen voorkeur uitgesproken",
    )
    citaat: str = Field(
        min_length=1,
        description="Letterlijk citaat uit document ondersteunt prioriteit/segmenten",
    )
    pagina: int | None = Field(default=None, ge=1, description="Paginanummer (None als onbekend)")
```

### Example 2: Extended WoonvisiePayload (backwards-compat deprecated fields retained)

```python
# backend/app/ai/factors/woonvisie_match.py — additions to WoonvisiePayload
class WoonvisiePayload(BaseModel):
    # ... existing fields (periode_start, periode_einde, document_type, opgave_totaal, pct_*) UNCHANGED ...

    # NEW (Phase 6) — primary wijk-differentiatie source
    wijk_policies: list[WijkPolicy] = Field(
        default_factory=list,
        description="Per-wijk beleid; leeg bij vage documenten",
    )
    algemeen_citaat: str = Field(
        default="",
        description="Gemeente-brede citaat-fallback als wijk_policies leeg of geen match",
    )

    # DEPRECATED (Phase 6) — retained for cache-roundtrip backwards-compat; Claude niet meer gevraagd te vullen
    prioritized_segment: Literal["sociaal", "midden", "duur", "gemengd"] = "gemengd"
    growth_wijken: list[str] = Field(default_factory=list)
    shrink_wijken: list[str] = Field(default_factory=list)
    herstructureringswijken: list[str] = Field(default_factory=list)
    doelgroepen: list[str] = Field(default_factory=list)
    excluded_project_types: list[str] = Field(default_factory=list)

    # UNCHANGED — per-document extraction confidence
    confidence: float = Field(ge=0.0, le=1.0, description="0=onzeker, 1=zeker")
```

### Example 3: Anthropic `input_schema` with nested wijk_policies array

```python
# backend/app/ai/factors/woonvisie_match.py — _INPUT_SCHEMA rewrite
# Source: verified pattern from existing _INPUT_SCHEMA at line 68; extends with nested array-of-objects
# Cross-ref: Anthropic docs (2026) on structured outputs / tool-use — prefers flat hierarchies but supports nested arrays
_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "periode_start": {"type": "integer", "description": "Startjaar woonvisie, bv. 2025"},
        "periode_einde": {"type": "integer", "description": "Eindjaar woonvisie, bv. 2030"},
        "document_type": {
            "type": "string",
            "enum": ["woonvisie", "volkshuisvestingsprogramma"],
        },
        "opgave_totaal": {"type": "integer"},
        "pct_sociaal_huur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_middenhuur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_dure_huur": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_betaalbare_koop": {"type": "number", "minimum": 0, "maximum": 100},
        "pct_dure_koop": {"type": "number", "minimum": 0, "maximum": 100},
        # NEW: per-wijk structured policies
        "wijk_policies": {
            "type": "array",
            "description": (
                "Per wijk een beleidsobject met naam, prioriteit, gewenste segmenten, "
                "letterlijk citaat uit document en paginanummer. Laat weg als geen letterlijk "
                "citaat voor de wijk te vinden is — hallucineer geen beleidstekst."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "wijk_naam": {"type": "string", "description": "Wijk-naam zoals in document staat"},
                    "prioriteit": {
                        "type": "string",
                        "enum": ["groei", "krimp", "herstructurering", "neutraal"],
                    },
                    "gewenste_segmenten": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["sociaal", "midden", "duur", "gemengd"],
                        },
                    },
                    "citaat": {"type": "string", "minLength": 1, "description": "Letterlijk uit document"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["wijk_naam", "prioriteit", "gewenste_segmenten", "citaat"],
                "additionalProperties": False,
            },
        },
        "algemeen_citaat": {
            "type": "string",
            "description": "Gemeente-breed citaat als fallback wanneer per-wijk onduidelijk",
        },
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
    "required": ["periode_start", "periode_einde", "confidence"],
}
```

**Note:** `additionalProperties: false` on the nested item per Anthropic guidance on structured outputs strictness. Top-level omits it (for the deprecated fields not in Claude's prompt but allowed during Pydantic rehydration of old cache rows).

### Example 4: Rewritten prompt_instructions (Claude's discretion per Context)

```python
# Drop-in for WOONVISIE_MATCH_FACTOR_DEF.prompt_instructions
prompt_instructions=(
    "Lees de woonvisie volledig door en beantwoord via het tool:\n"
    "1. Welke periode beslaat het document (periode_start, periode_einde)?\n"
    "2. Welke wijken krijgen expliciete beleidsaandacht? Voor ELKE zo'n wijk:\n"
    "   - wijk_naam: exact zoals in document genoemd (niet parafraseren)\n"
    "   - prioriteit: groei (verdichten/bouwen), krimp (restrictief/afname), "
    "herstructurering (sloop-nieuwbouw/transformatie), neutraal (stabilisatie)\n"
    "   - gewenste_segmenten: welke segmenten (sociaal/midden/duur/gemengd) wil de gemeente "
    "daar toevoegen? Lege lijst als niet genoemd.\n"
    "   - citaat: letterlijk citaat uit document dat bovenstaande onderbouwt (1-3 zinnen, "
    "inclusief cijfers/doelgroepen/percentages als ze in dezelfde passage staan)\n"
    "   - pagina: paginanummer als zichtbaar, anders null\n"
    "3. Als er gemeente-brede tekst is die geen wijk noemt maar wel relevant is: zet in algemeen_citaat.\n"
    "4. Confidence: 0.9+ bij helder document met expliciete wijk-paragrafen; 0.5-0.7 bij vage tekst; <0.5 "
    "als je twijfelt of de extractie klopt.\n\n"
    "HARDE REGELS:\n"
    "- Laat WijkPolicy weg als je geen letterlijk citaat voor die wijk kunt vinden. Geen hallucinaties.\n"
    "- Kopieer citaten letterlijk (incl. leestekens en cijfers). Geen parafrases.\n"
    "- Gebruik alleen informatie uit het document. Vul geen beleidsinvulling in die niet in de tekst staat."
)
```

### Example 5: Rewritten score_woonvisie_match (reference implementation)

```python
# backend/app/services/score_v3_factors.py:1201 — Source: Context §3-§8 + existing patterns
import unicodedata

def _normalize_wijk(s: str | None) -> str:
    """Casefold + strip diacritics + normalise hyphen variants for wijk-naam match."""
    if not s:
        return ""
    n = unicodedata.normalize("NFKD", s)
    n = "".join(c for c in n if not unicodedata.combining(c))
    return n.casefold().replace("‐", "-").replace("‑", "-").strip()


_PROJECTTYPE_SEGMENT_MAP: dict[str, list[str]] = {
    "nieuwbouw_wonen": ["sociaal", "midden"],
    "transformatie_wonen": ["sociaal", "midden", "gemengd"],
    "optoppen": ["midden", "duur"],
    "splitsen": ["sociaal", "midden"],
    "commercieel_naar_wonen": ["midden", "gemengd"],
    "onbepaald": [],
}

_PRIORITEIT_SCORE_DELTA: dict[str, float] = {
    "groei": 3.0,
    "herstructurering": 1.5,
    "neutraal": 0.0,
    "krimp": -2.5,
}


def score_woonvisie_match(
    payload: WoonvisiePayload | None,
    *,
    wijk_naam: str | None,
    project_type: str = "onbepaald",
) -> FactorResult:
    """Phase 6 rewrite: per-wijk differentiating scoring via WijkPolicy."""
    if payload is None:
        return FactorResult(
            waarde=None, genormaliseerde_score=0.0, gewicht=0, bijdrage=0.0,
            categorie="potentie",
            toelichting_kort="Geen woonvisie beschikbaar voor deze gemeente (factor niet meegewogen).",
            toelichting_lang="Geen gemeentelijke woonvisie beschikbaar. De factor wordt niet meegewogen.",
            data_bronnen=[], missing=True,
        )

    document_label = f"Woonvisie {payload.periode_start}–{payload.periode_einde}"
    algemeen_citaat = payload.algemeen_citaat or ""

    # 1. Find matching WijkPolicy (longest-normalised-name wins among substring matches)
    parcel_norm = _normalize_wijk(wijk_naam)
    matched: WijkPolicy | None = None
    if parcel_norm and payload.wijk_policies:
        candidates: list[tuple[int, WijkPolicy]] = []
        for p in payload.wijk_policies:
            pn = _normalize_wijk(p.wijk_naam)
            if pn and (pn in parcel_norm or parcel_norm in pn):
                candidates.append((len(pn), p))
        if candidates:
            # prefer longest-normalised match (most-specific), stable on tie via list order
            candidates.sort(key=lambda t: -t[0])
            matched = candidates[0][1]

    # 2. No-match fallback: neutraal with algemeen_citaat
    if matched is None:
        raw_score = 5.0
        # confidence-pull still applies (keeps vage-doc behaviour consistent)
        pulled = raw_score * payload.confidence + 5.0 * (1 - payload.confidence)
        pulled = max(0.0, min(10.0, pulled))
        uitleg_kort = (
            f"Geen wijk-specifiek beleid gevonden in {document_label}; gemeente-brede context gebruikt"
            if algemeen_citaat else
            f"Geen wijk-specifiek beleid gevonden in {document_label}"
        )
        uitleg_lang = uitleg_kort + (f". Citaat (gemeente-breed): {algemeen_citaat}" if algemeen_citaat else "")
        uitleg_lang += f" (confidence {payload.confidence:.0%})"
        return FactorResult(
            waarde={
                "matched_wijk": None,
                "matched_policy": None,
                "prioritized_segment": payload.prioritized_segment,  # legacy UI fallback
                "algemeen_citaat": algemeen_citaat,
            },
            genormaliseerde_score=round(pulled / 10.0, 4), gewicht=0, bijdrage=0.0,
            categorie="potentie",
            toelichting_kort=uitleg_kort, toelichting_lang=uitleg_lang,
            data_bronnen=["Gemeentelijke woonvisie (LLM-extracted)"], missing=False,
        )

    # 3. Matched policy: prioriteit basis + segment × projecttype
    raw_score = 5.0 + _PRIORITEIT_SCORE_DELTA.get(matched.prioriteit, 0.0)
    preferred = _PROJECTTYPE_SEGMENT_MAP.get(project_type, [])
    segment_note = ""
    if preferred:
        overlap = set(preferred) & set(matched.gewenste_segmenten)
        if overlap:
            raw_score += 2.0
            segment_note = f"; projecttype past bij wijk-segment ({', '.join(sorted(overlap))})"
        elif matched.gewenste_segmenten:
            raw_score -= 1.0
            segment_note = f"; projecttype wijkt af van wijk-segment ({', '.join(matched.gewenste_segmenten)})"

    pulled = raw_score * payload.confidence + 5.0 * (1 - payload.confidence)
    pulled = max(0.0, min(10.0, pulled))

    pag_suffix = f", p.{matched.pagina}" if matched.pagina is not None else ""
    uitleg_kort = (
        f"Wijk '{matched.wijk_naam}' prioriteit '{matched.prioriteit}' in {document_label}{segment_note}"
    )
    uitleg_lang = (
        f"{uitleg_kort}. Citaat ({matched.wijk_naam}{pag_suffix}): {matched.citaat}"
        f" (confidence {payload.confidence:.0%})"
    )

    return FactorResult(
        waarde={
            "matched_wijk": wijk_naam,
            "matched_policy": matched.model_dump(),
            "prioritized_segment": (matched.gewenste_segmenten[0] if matched.gewenste_segmenten else payload.prioritized_segment),
            "algemeen_citaat": algemeen_citaat,
        },
        genormaliseerde_score=round(pulled / 10.0, 4),
        gewicht=0,  # gewicht via FACTOR_REGISTRY in compute_score_v3
        bijdrage=0.0,
        categorie="potentie",
        toelichting_kort=uitleg_kort, toelichting_lang=uitleg_lang,
        data_bronnen=["Gemeentelijke woonvisie (LLM-extracted)"],
        missing=False,
    )
```

### Example 6: Wijk differentiation test (TEST-06)

```python
# backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py — NEW
import pytest
from app.ai.factors.woonvisie_match import WoonvisiePayload, WijkPolicy
from app.services.score_v3_factors import score_woonvisie_match


def _venlo_payload() -> WoonvisiePayload:
    return WoonvisiePayload(
        periode_start=2024, periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick", prioriteit="groei",
                gewenste_segmenten=["sociaal", "midden"],
                citaat="Blerick blijft groeigebied. 400 woningen tot 2030, 35% sociaal.",
                pagina=24,
            ),
            WijkPolicy(
                wijk_naam="Venlo-Centrum", prioriteit="neutraal",
                gewenste_segmenten=["duur", "gemengd"],
                citaat="Venlo-Centrum wordt niet als groei- of krimpgebied aangemerkt.",
                pagina=18,
            ),
        ],
        algemeen_citaat="Gemeente Venlo streeft naar 2800 nieuwe woningen tot 2030.",
        confidence=0.9,
    )


def test_blerick_scores_higher_than_centrum_for_nieuwbouw_wonen():
    payload = _venlo_payload()
    blerick = score_woonvisie_match(payload, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    centrum = score_woonvisie_match(payload, wijk_naam="Venlo-Centrum", project_type="nieuwbouw_wonen")
    assert blerick.genormaliseerde_score > 0.7, f"Blerick {blerick.genormaliseerde_score}"
    assert centrum.genormaliseerde_score < 0.5, f"Centrum {centrum.genormaliseerde_score}"
    assert blerick.genormaliseerde_score > centrum.genormaliseerde_score


def test_blerick_citaat_in_toelichting_lang():
    payload = _venlo_payload()
    r = score_woonvisie_match(payload, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    assert "Blerick" in r.toelichting_lang
    assert "groeigebied" in r.toelichting_lang  # from citaat
    assert "p.24" in r.toelichting_lang


def test_matched_policy_in_waarde_dict():
    payload = _venlo_payload()
    r = score_woonvisie_match(payload, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    assert isinstance(r.waarde, dict)
    assert r.waarde["matched_wijk"] == "Blerick"
    assert r.waarde["matched_policy"]["prioriteit"] == "groei"
    assert r.waarde["matched_policy"]["citaat"].startswith("Blerick blijft")


def test_case_and_diacritic_insensitive_match():
    """PDOK 'blerick' (lowercase) should match 'Blerick' policy."""
    payload = _venlo_payload()
    r = score_woonvisie_match(payload, wijk_naam="blerick", project_type="nieuwbouw_wonen")
    assert r.waarde["matched_policy"] is not None
```

### Example 7: Fallback test

```python
# backend/tests/unit/test_score_woonvisie_match_fallback.py — NEW
from app.ai.factors.woonvisie_match import WoonvisiePayload
from app.services.score_v3_factors import score_woonvisie_match


def test_empty_wijk_policies_uses_algemeen_citaat():
    payload = WoonvisiePayload(
        periode_start=2024, periode_einde=2030,
        wijk_policies=[],
        algemeen_citaat="Gemeente X bouwt 1000 woningen tot 2030.",
        confidence=0.8,
    )
    r = score_woonvisie_match(payload, wijk_naam="Zomaar-Wijk", project_type="nieuwbouw_wonen")
    assert r.missing is False
    # neutraal score pulled-to-5.0 — with confidence 0.8: 5.0 * 0.8 + 5.0 * 0.2 = 5.0 → normalized 0.5
    assert 0.45 <= r.genormaliseerde_score <= 0.55
    assert "Gemeente X bouwt" in r.toelichting_lang
    assert r.waarde["matched_policy"] is None


def test_no_wijk_naam_falls_back_without_crash():
    payload = WoonvisiePayload(
        periode_start=2024, periode_einde=2030,
        wijk_policies=[],  # also empty
        algemeen_citaat="",  # fully vague
        confidence=0.5,
    )
    r = score_woonvisie_match(payload, wijk_naam=None, project_type="onbepaald")
    assert r.missing is False
    assert 0.0 <= r.genormaliseerde_score <= 1.0
```

### Example 8: Cache invalidation test (TEST-06 part)

```python
# backend/tests/unit/test_factor_extraction_service.py — add alongside test_v2_cache_entry_is_miss_after_bump_to_v3
@pytest.mark.asyncio
async def test_v3_cache_entry_is_miss_after_bump_to_v4(test_db, create_test_user):
    """M048/Phase 6: pre-bump v3 entries (old payload shape) are cache-miss post-bump."""
    assert SCHEMA_VERSION >= 4, f"Test only valid at SCHEMA_VERSION>=4, got {SCHEMA_VERSION}"
    doc = await _seed_policy_document(test_db, create_test_user)
    stale = FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id, factor_id="woonvisie_match",
        schema_version=3,
        extracted_payload={
            "periode_start": 2020, "periode_einde": 2025,
            "prioritized_segment": "sociaal", "growth_wijken": ["Blerick"], "confidence": 0.9,
        },
    )
    test_db.add(stale)
    await test_db.commit()

    result = await _get_cache_hit(
        test_db, parcel_id=DOCUMENT_SENTINEL,
        policy_document_id=doc.id, factor_id="woonvisie_match",
    )
    assert result is None
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat lists (`growth_wijken: list[str]`) — gemeente-brede | Structured per-wijk policies (`wijk_policies: list[WijkPolicy]`) | M048/Phase 6 | Enables differentiating scores per wijk + quotable citations for UI popup |
| `FactorResult.waarde = prioritized_segment` (string) | `FactorResult.waarde = dict` with matched_policy + metadata | M048/Phase 6 | Frontend can render wijk-specific popup without natural-text parsing |
| Parcel-keyed cache for document-level factors | `DOCUMENT_SENTINEL` keyed cache | M048/Phase 5 | 100k Claude calls → 1 per document (shipped, reused here) |
| `SCHEMA_VERSION=1`, migrations for cache invalidation | `SCHEMA_VERSION=3` (will be 4), WHERE-clause rejection | M048/Phases 1+5 | Zero-downtime schema evolution |
| Anthropic tool-use with flat `input_schema` only | Nested `array` of `object` items supported (with `additionalProperties: false` + `required` in item) | Anthropic structured-outputs 2024→2026 docs | Enables richer per-item extraction without schema-flattening compromises |

**Deprecated/outdated (per Context):**
- `WoonvisiePayload.growth_wijken` / `shrink_wijken` / `herstructureringswijken` / `excluded_project_types` / `doelgroepen` / `prioritized_segment` — retained on model for cache roundtrip but no longer filled by Claude (removed from `_INPUT_SCHEMA.required`, dropped from prompt). Clean delete deferred to M050+ after all pre-v4 caches are gone.

## Open Questions

1. **Does `parcel.wijk_naam` in production match Claude's extracted `WijkPolicy.wijk_naam` string shape?**
   - What we know: PDOK/BAG wijk-naam is CBS-sourced, titlecase ("Blerick", "Venlo-Centrum"). Claude will read woonvisie PDFs with variable phrasing.
   - What's unclear: Real-world mismatch rate (e.g. "Q4" in woonvisie vs "Blerick-Zuid" in BAG).
   - Recommendation: Ship with `_normalize_wijk` (NFKD + casefold + hyphen-normalise), add Venlo smoke-test fixture with 3-5 real Venlo wijk names from a real woonvisie PDF. If mismatch rate > 20% post-ship, extend Claude prompt to emit `wijk_aliases: list[str]` per policy (M050 if needed — not in Phase 6 scope).

2. **Should `matched_policy` dict include all WijkPolicy fields or a subset?**
   - What we know: Context §8 says `WijkPolicy.model_dump()` — full dict.
   - What's unclear: Frontend TypeScript shape already in `WoonvisiePopup.tsx` uses the full object, so this aligns.
   - Recommendation: Full `model_dump()` for forward-compat; Phase 3 already expects full shape.

3. **Logging level for extraction with empty `wijk_policies`?**
   - What we know: Claude's discretion per Context.
   - What's unclear: `info` logs add noise; `warning` creates false alarms for legitimately-vague docs.
   - Recommendation: `info` with structured fields `{gemeente_code, doc_id, has_algemeen_citaat}` so monitoring can aggregate. Escalate to `warning` only if `algemeen_citaat` ALSO empty and `confidence < 0.4` (indicates extraction failure).

4. **Is there risk that extending `_INPUT_SCHEMA.properties` without marking `wijk_policies` required causes Claude to skip it?**
   - What we know: Anthropic docs say non-required fields are Claude's discretion. Prompt instructions explicitly ask for `wijk_policies`.
   - Recommendation: Combine prompt-emphasis + `confidence` as a soft-proxy (vague docs → low confidence, also `wijk_policies=[]`). Accept that some docs legitimately have no per-wijk policies. The `algemeen_citaat` + neutral-score fallback is the correct behaviour for that case.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (existing) |
| Config file | `backend/pyproject.toml` (existing) |
| Quick run command | `cd backend && pytest tests/unit/test_wijk_policy_schema.py tests/unit/test_score_woonvisie_match_wijk_differentiation.py tests/unit/test_score_woonvisie_match_fallback.py -x` |
| Full suite command | `cd backend && pytest tests/ -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WOON-04 | `WijkPolicy` rejects empty citaat, invalid prioriteit literal, accepts None/int pagina | unit | `pytest backend/tests/unit/test_wijk_policy_schema.py -x` | ❌ Wave 0 (new file) |
| WOON-04 | `WijkPolicy.gewenste_segmenten` rejects invalid literal (e.g. "studentenkamer") | unit | `pytest backend/tests/unit/test_wijk_policy_schema.py::test_invalid_segment -x` | ❌ Wave 0 |
| WOON-05 | `WoonvisiePayload` accepts new `wijk_policies`/`algemeen_citaat` with deprecated fields omitted | unit | `pytest backend/tests/unit/test_wijk_policy_schema.py::test_payload_roundtrip -x` | ❌ Wave 0 |
| WOON-05 | SCHEMA_VERSION == 4 (or version-agnostic assertion) | unit | `pytest backend/tests/unit/test_factor_extraction_schemas.py -x` | ✅ EDIT (currently asserts `== 3`; flip to `>= 4` or use constant) |
| WOON-05 | v3 cache entries → miss after bump to v4 | unit/integration | `pytest backend/tests/unit/test_factor_extraction_service.py::test_v3_cache_entry_is_miss_after_bump_to_v4 -x` | ❌ Wave 0 (add to existing file alongside Phase 5 `test_v2_..._to_v3`) |
| SCORE-04 | Blerick (groei + sociaal) scores > 0.7 for `nieuwbouw_wonen`; Venlo-Centrum (neutraal + duur) < 0.5 | unit | `pytest backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py -x` | ❌ Wave 0 |
| SCORE-04 | Blerick citaat appears in `toelichting_lang`; `matched_policy` dict in `waarde` | unit | `pytest backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py::test_blerick_citaat_in_toelichting_lang -x` | ❌ Wave 0 |
| SCORE-04 | Case + diacritic-insensitive substring match | unit | `pytest backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py::test_case_and_diacritic_insensitive_match -x` | ❌ Wave 0 |
| SCORE-04 | Empty `wijk_policies` + non-empty `algemeen_citaat` → neutraal 0.5 + fallback text | unit | `pytest backend/tests/unit/test_score_woonvisie_match_fallback.py -x` | ❌ Wave 0 |
| SCORE-04 | `wijk_naam=None` with empty payload → neutral without crash | unit | `pytest backend/tests/unit/test_score_woonvisie_match_fallback.py::test_no_wijk_naam_falls_back_without_crash -x` | ❌ Wave 0 |
| TEST-06 | compute_score_v3 caller still wires woonvisie_match correctly with new payload | integration | `pytest backend/tests/integration/test_woonvisie_match.py -x` | ✅ EDIT (6 existing tests rewrite using `wijk_policies=[WijkPolicy(...)]` shape) |
| TEST-06 | Venlo-smoke: Blerick-fixture parcel score ≠ Venlo-Centrum-fixture parcel score with same projecttype | integration | `pytest backend/tests/integration/test_woonvisie_match.py::test_venlo_smoke_wijk_differentiation -x` | ❌ Wave 0 (new test in existing file) |
| TEST-06 | Full 275-test suite green | smoke | `pytest backend/tests/ -x` | ✅ (entire suite run) |
| TEST-06 | Anthropic `input_schema` nested array-of-objects not malformed (smoke via Pydantic roundtrip on mock-extract response) | integration | `pytest backend/tests/integration/test_woonvisie_match.py::test_extract_factor_woonvisie_cache_hit -x` | ✅ EDIT (update fixture payload to include `wijk_policies`) |

### Sampling Rate
- **Per task commit:** `pytest backend/tests/unit/test_wijk_policy_schema.py backend/tests/unit/test_score_woonvisie_match_*.py -x` (< 5 seconds)
- **Per wave merge:** `pytest backend/tests/ -k "woonvisie or factor_extraction" -x` (unit + integration subset, < 30 seconds)
- **Phase gate:** `pytest backend/tests/ -x` (full 275+ suite green before `/gsd:verify-work`) + `ruff check backend/` + `mypy backend/`

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_wijk_policy_schema.py` — covers WOON-04, WOON-05 (Pydantic validation)
- [ ] `backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py` — covers SCORE-04, TEST-06 (happy path)
- [ ] `backend/tests/unit/test_score_woonvisie_match_fallback.py` — covers SCORE-04, TEST-06 (fallback paths)
- [ ] Add `test_v3_cache_entry_is_miss_after_bump_to_v4` to existing `backend/tests/unit/test_factor_extraction_service.py`
- [ ] Add `test_venlo_smoke_wijk_differentiation` + update existing 6 tests in `backend/tests/integration/test_woonvisie_match.py` to use new payload shape
- [ ] Update `backend/tests/unit/test_factor_extraction_schemas.py::test_schema_version_is_three` to version-agnostic (`>= 4` or use SCHEMA_VERSION import)

No framework install needed (pytest already configured). No shared fixtures needed beyond `test_db` + `create_test_user` from existing conftest.py.

## Sources

### Primary (HIGH confidence — codebase inspection)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/ai/factors/woonvisie_match.py` (lines 1-140) — WoonvisiePayload + _INPUT_SCHEMA + WOONVISIE_MATCH_FACTOR_DEF
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/ai/factor_extraction_schemas.py` (lines 1-133) — FactorDefinition + ExtractedFactor + SCHEMA_VERSION + DOCUMENT_SENTINEL
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/services/score_v3_factors.py:1201-1304` — current score_woonvisie_match
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/services/score_v3.py:136-145, 400-435` — FACTOR_REGISTRY entry + caller
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/services/cascade_enrichment_service.py` (full file) — DOCUMENT_SENTINEL usage, no-change confirmation
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/tests/integration/test_woonvisie_match.py` (lines 1-243) — 6 existing tests to rewrite
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/tests/unit/test_factor_extraction_service.py` (full file) — version-agnostic test pattern from Phase 5
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/tests/unit/test_factor_extraction_schemas.py` (full file) — existing SCHEMA_VERSION assertion to update
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/tests/integration/test_cascade_enrichment_service.py` — WoonvisiePayload construction still passes with deprecated fields
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/map/panels/parcel/WoonvisiePopup.tsx` — Phase 3 consumer contract (matched_policy shape)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` — mock-data fixtures (Blerick/Venlo-Centrum/Tegelen) informing test fixture design
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/.planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-CONTEXT.md` — locked user decisions
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/.planning/REQUIREMENTS.md` — WOON-04, WOON-05, SCORE-04, TEST-06
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/.planning/ROADMAP.md` — Phase 6 success criteria + execution order

### Secondary (MEDIUM confidence — official docs cross-reference)
- Anthropic Structured Outputs docs — [platform.claude.com/docs/en/build-with-claude/structured-outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — confirms nested array-of-objects supported, `additionalProperties: false` recommended for strict validation, avoid `$defs`-recursion
- Anthropic Tool Use — Define tools — [platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools) — confirms `input_schema` shape requirements
- anthropic-cookbook structured_json example — [github.com/anthropics/anthropic-cookbook/blob/main/tool_use/extracting_structured_json.ipynb](https://github.com/anthropics/anthropic-cookbook/blob/main/tool_use/extracting_structured_json.ipynb) — cross-ref for nested-object input_schema pattern

### Tertiary (LOW confidence — not relied on for decisions)
- None. All planning-critical claims verified against codebase or official Anthropic docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in existing codebase, no new deps
- Architecture: HIGH — edit surface minimal, patterns reused from Phases 1+5
- Pitfalls: HIGH — breakage surface verified via grep across `backend/tests/`; Dutch-normalisation pitfall flagged (medium empirical confidence — won't be fully validated until Venlo smoke-test with real PDOK data)
- Validation mapping: HIGH — test-file-to-requirement mapping is 1:1 and deterministic

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stable backend patterns, no fast-moving upstream deps)

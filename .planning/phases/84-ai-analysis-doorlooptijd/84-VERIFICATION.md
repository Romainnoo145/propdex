---
phase: 84-ai-analysis-doorlooptijd
verified: 2026-03-08T12:00:00Z
status: passed
score: 8/8 must-haves verified
gaps: []
---

# Phase 84: AI Analysis Upgrade + Doorlooptijd Verification Report

**Phase Goal:** AI analysis produces meaningful juridisch klimaat scores because it operates on filtered, location-relevant rulings with vergunningstype classification, and users can see average procedure durations per gemeente
**Verified:** 2026-03-08T12:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AI analysis runs only on geo-filtered rulings for the selected gemeente, never on unfiltered national results | VERIFIED | `jurisprudence.py:242-246` queries RulingCache with `gemeente_query == gemeente_naam OR extracted_gemeente == gemeente_naam` filter; ARQ job receives only filtered ECLI list |
| 2 | Changing date filters does not re-analyze previously analyzed rulings (per-ruling cache) | VERIFIED | `jurisprudence.py:256-260` splits into `analyzed` (ai_analysis IS NOT NULL) vs `needs_analysis` (ai_analysis IS NULL); only un-analyzed rulings sent to Claude |
| 3 | Each analyzed ruling gets a vergunningstype classification from a fixed 9-category taxonomy | VERIFIED | `prompts.py:54-63` defines 9-category taxonomy in V2 prompt; `schemas.py:178-181` has `vergunningstype` field on RulingAnalysis; `ruling_cache.py:39-41` stores it indexed |
| 4 | Average doorlooptijd per gemeente per vergunningstype is returned, with graceful degradation for insufficient data | VERIFIED | `doorlooptijd.py:162-235` implements `get_doorlooptijd_stats` with min sample size of 3, returns `insufficient_data: True` below threshold |
| 5 | Analysis triggers automatically when feed loads, no manual button needed | VERIFIED | `useJurisprudence.ts:115-166` `useGemeenteAnalysis` hook auto-triggers via useEffect when `hasFeedData` becomes true; `JurisprudenceSection.tsx:194` uses it |
| 6 | Vergunningstype badge visible on each ruling card in the feed | VERIFIED | `JurisprudenceSection.tsx:306-308` renders vergunningstype badge; line 126-128 also shows badge on ruling cards |
| 7 | Doorlooptijd statistics displayed per vergunningstype in JuridischKlimaatCard | VERIFIED | `JuridischKlimaatCard.tsx:74,144-162` renders doorlooptijd entries with color coding (green/amber/red) and per-type stats |
| 8 | Insufficient data shows "onvoldoende data" instead of misleading averages | VERIFIED | `JuridischKlimaatCard.tsx:157-159` checks `stat.insufficient_data` and renders "onvoldoende data ({count} uitspraken)" |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/ruling_cache.py` | RulingCache with ai_analysis JSONB + 4 other columns | VERIFIED | Lines 37-44: ai_analysis (JSONB), vergunningstype (String, indexed), datum_indiening, doorlooptijd_dagen (Integer), ai_analyzed_at |
| `backend/app/services/doorlooptijd.py` | Filing date extraction + doorlooptijd computation + aggregation | VERIFIED | 236 lines: extract_filing_date, compute_doorlooptijd, extract_relevant_sections, get_doorlooptijd_stats all implemented |
| `backend/app/ai/prompts.py` | Enhanced prompt with vergunningstype taxonomy | VERIFIED | JURIDISCH_ANALYSE_PROMPT_V2 with 9 categories and JSON schema |
| `backend/app/ai/schemas.py` | RulingAnalysis with vergunningstype, DoorlooptijdStats model | VERIFIED | RulingAnalysis.vergunningstype (line 178), DoorlooptijdStats (line 184), JuridischAnalysisResult.doorlooptijd (line 223) |
| `backend/app/api/endpoints/jurisprudence.py` | Per-ruling analysis + doorlooptijd stats endpoints | VERIFIED | POST /analyze/{gemeente_naam} (line 227), GET /doorlooptijd/{gemeente_naam} (line 368), GET /analyze/status/{gemeente_naam} (line 319) |
| `backend/app/jobs/jurisprudence_analysis.py` | Refactored ARQ job with per-ruling storage | VERIFIED | ruling_analysis_job with batch-of-5, stores ai_analysis/vergunningstype/datum_indiening/doorlooptijd_dagen per ruling |
| `backend/alembic/versions/aa04a6b0b14c_...py` | Migration for 5 new columns | VERIFIED | File exists |
| `frontend/src/lib/api.ts` | Updated types + analyzeGemeenteRulings + getDoorlooptijdStats | VERIFIED | DoorlooptijdStats interface, analyzeGemeenteRulings, getDoorlooptijdStats functions present |
| `frontend/src/hooks/useJurisprudence.ts` | useGemeenteAnalysis + useDoorlooptijdStats hooks | VERIFIED | useGemeenteAnalysis (auto-trigger + polling, line 115), useDoorlooptijdStats (10-min cache, line 173) |
| `frontend/src/components/projects/JurisprudenceSection.tsx` | Auto-analysis + vergunningstype badges | VERIFIED | Uses useGemeenteAnalysis (line 194), useDoorlooptijdStats (line 200), vergunningstype badges (lines 126, 306) |
| `frontend/src/components/projects/JuridischKlimaatCard.tsx` | Doorlooptijd section with graceful degradation | VERIFIED | doorlooptijd prop, Clock icon, color-coded stats, "onvoldoende data" fallback |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| jurisprudence.py | ruling_cache.py | query RulingCache.ai_analysis IS NULL | WIRED | Line 257-260: filters `r.ai_analysis is None and r.full_text is not None` |
| jurisprudence_analysis.py | ruling_cache.py | store per-ruling analysis on RulingCache.ai_analysis | WIRED | Line 130: `ruling.ai_analysis = ra.model_dump()`, line 131: `ruling.vergunningstype = ra.vergunningstype` |
| jurisprudence.py | doorlooptijd.py | get_doorlooptijd_stats for aggregation | WIRED | Line 23: import, line 181: `doorlooptijd = await get_doorlooptijd_stats(db, gemeente_naam)`, line 379: doorlooptijd endpoint |
| claude_client.py | prompts.py | JURIDISCH_ANALYSE_PROMPT_V2 | WIRED | Line 10: import, line 227: system=JURIDISCH_ANALYSE_PROMPT_V2 |
| claude_client.py | doorlooptijd.py | extract_relevant_sections | WIRED | Line 12: import, line 204: section_text = extract_relevant_sections(text) |
| worker.py | jurisprudence_analysis.py | ruling_analysis_job registration | WIRED | Line 17: import, line 52: registered in functions list |
| useJurisprudence.ts | /api/jurisprudence/analyze/{gemeente} | POST auto-trigger | WIRED | Line 120: analyzeGemeenteRulings, line 132: mutation.mutate(gemeenteNaam) |
| JuridischKlimaatCard.tsx | api.ts | DoorlooptijdStats type | WIRED | Line 3: import type { DoorlooptijdStats }, line 8: doorlooptijd prop |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-01 | 84-01, 84-02 | AI analysis runs only on filtered, location-relevant rulings | SATISFIED | Geo-filter in analyze endpoint + auto-trigger from feed |
| AI-02 | 84-01, 84-02 | Per-ruling AI analysis caching (not per-batch) | SATISFIED | ai_analysis JSONB on RulingCache, split analyzed/needs_analysis |
| AI-03 | 84-01, 84-02 | Vergunningstype classification per ruling | SATISFIED | 9-category taxonomy in prompt, vergunningstype field in schema + model, badges in UI |
| AI-04 | 84-01 | Token budget controls via section extraction | SATISFIED | extract_relevant_sections finds OVERWEGINGEN markers, batch size of 5 |
| DOOR-01 | 84-01 | Procedure duration calculated from dates | SATISFIED | extract_filing_date + compute_doorlooptijd in doorlooptijd.py |
| DOOR-02 | 84-01, 84-02 | Average doorlooptijd displayed per gemeente per vergunningstype | SATISFIED | get_doorlooptijd_stats aggregation + JuridischKlimaatCard display |
| DOOR-03 | 84-01, 84-02 | Graceful degradation when filing dates unavailable | SATISFIED | min sample size 3, insufficient_data flag, "onvoldoende data" UI text |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns found |

### Human Verification Required

### 1. Auto-analysis Trigger on Feed Load

**Test:** Open a gemeente detail view that has cached rulings
**Expected:** AI analysis triggers automatically without clicking any button; "Analyseren..." loading state appears, then results populate
**Why human:** Requires running app with live data to verify useEffect trigger timing and mutation behavior

### 2. Vergunningstype Badges Display

**Test:** View ruling feed after analysis completes
**Expected:** Each analyzed ruling card shows a blue pill badge with its vergunningstype (e.g., "nieuwbouw", "verbouw")
**Why human:** Visual rendering and badge styling can only be verified in browser

### 3. Doorlooptijd Color Coding

**Test:** View JuridischKlimaatCard with doorlooptijd data across different duration ranges
**Expected:** Green for <=180 days, amber for 181-365, red for >365 days
**Why human:** Color rendering requires visual inspection

### 4. Insufficient Data Graceful Degradation

**Test:** View gemeente with fewer than 3 rulings having doorlooptijd for a vergunningstype
**Expected:** Shows "onvoldoende data (N uitspraken)" in grey instead of misleading averages
**Why human:** Requires specific data conditions in database

### Gaps Summary

No gaps found. All 8 observable truths verified, all 11 artifacts pass existence + substantive + wiring checks, all 8 key links confirmed wired, all 7 requirements satisfied. Four commits verified in git log (60dc0e9, 5b526f3, bfa16e3, 41bcc54).

---

_Verified: 2026-03-08T12:00:00Z_
_Verifier: Claude (gsd-verifier)_

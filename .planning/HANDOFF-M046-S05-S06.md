# Handoff — M046 resterend werk (S05 + S06)

**Gemaakt:** 2026-04-19 na sessie waarin S01 → S04 compleet werden.
**Voor:** volgende sessie (fresh context na `/clear`).
**Branch-status:** alle voltooide slices gepusht naar GitHub met eigen branches + PR #2 open voor S01.

---

## Waar we staan

**M046 Scoring Fundament Opgeschoond** — 4 van 6 slices klaar.

| Slice | Scope | Gewicht | Status | Branch |
|---|---|---|---|---|
| S01 | RM-1 dev-type filter | 21 | ✅ gepusht + PR #2 | `m046/s01-rm1-dev-types-filter` |
| S02 | BUG-2 shape-ratio guard | 12 | ✅ gepusht | `m046/s02-bug2-vrije-grond-shape-ratio` |
| S03 | SNF-4 funda narrative | 5 | ✅ gepusht (data-pipeline deferred) | `m046/s03-funda-frictie-honest-state` |
| S04 | BUG-1 bestemming voting | 20 | ✅ gepusht | `m046/s04-bug1-bestemming-count-voting` |
| S05 | BUG-3 RCE monumenten | TBD | ⏳ pending | niet gemaakt |
| S06 | OBS-2 frontend eerlijkheid | — | ⏳ pending | niet gemaakt |

**Regression baseline:** 1552 passed, 22 pre-existing failures (stabiel, niet veroorzaakt door M046).
**Alembic head:** `bbdb5c6ff811` (M046 mag NIET wijzigen).

---

## Startprocedure volgende sessie

1. `/clear`
2. SessionStart hook toont STATE + MEMORY automatisch
3. Check git state:
   ```bash
   git log --oneline -20
   git branch -a | grep m046
   gh pr list
   ```
4. Kies S05 óf S06 (zie afwegingen hieronder)
5. Maak branch vanaf `main` na S01-merge, of vanaf S04-tip als S01 nog niet gemerged is

---

## S05: BUG-3 — `score_monument` via RCE-register

**Risico:** hoog (nieuwe externe API, data-quality-onderzoek vereist)
**Scope-omvang:** middelgroot (nieuwe service-module, ~100 regels code + tests + cache)

### Probleem
`score_monument` detecteert momenteel monumenten alleen via keyword-match in `bestemmingen` of `btype` — mist 30-40% gemeentelijke + rijksmonumenten die buiten erfgoed-bestemmingen staan. "Tool zei geen monument, koper ontdekt het later" = incident-scenario.

### Oplossingsrichting
1. **RCE API** (`https://data.cultureelerfgoed.nl/*`) als primaire bron voor rijksmonumenten.
2. Nieuwe service-module `backend/app/services/rce_client.py` analoog aan andere government_apis/ clients.
3. Cache-Tier 2 patroon (zoals andere enrichment APIs) — per-parcel JSONB in scan_results.flags.
4. `score_monument` leest RCE-data primair, bestemmingsplan-tekst als aanvullend.

### Exacte endpoint onderzoek
**Nog te doen:** exacte endpoint identificeren. RCE heeft SPARQL endpoint + REST. Onderzoek eerste 20 min van slice:
- SPARQL: `https://data.cultureelerfgoed.nl/rce/sparql` — flexibel maar complex
- Mogelijk adres-based endpoint beschikbaar in hun API-doc
- Fallback: PDOK heeft `rijksmonumenten` WFS: `https://service.pdok.nl/rce/rijksmonumenten/wfs/v1_0`

### Out-of-scope voor S05 (roadmap-beslissing)
- **Gemeentelijke monumenten (GEM-14)** — vereist per-gemeente erfgoedverordening-upload. Apart issue, M046 scope is alleen rijksmonumenten via RCE.

### Tests
1. Bekend rijksmonument in Venlo (uit bestaande data, niet in erfgoed-bestemming) → herkend als monument.
2. Niet-monument behoudt score 0.0.
3. Cache-hit test (fetched 1×, daarna uit cache).

### Scoping-suggestie
Start met `/gsd:plan-phase M046/S05 --research` of handmatig plan — S05 verdient echte research fase omdat API-contract onbekend is. **Niet gewoon direct TDD starten** zoals S02-S04.

### Files
- `backend/app/services/rce_client.py` (nieuw)
- `backend/app/services/score_v3_factors.py:599` (`score_monument` — factor update)
- `backend/app/jobs/area_scan.py` (enrichment-call toevoegen in Phase 3 of 5)
- `backend/tests/integration/test_rce_client.py` (nieuw)
- `backend/tests/test_score_v3.py` (uitbreiden)

---

## S06: OBS-2 — Frontend eerlijkheid (missing_factor_count UI)

**Risico:** laag (alleen frontend, backend contract staat vast)
**Scope-omvang:** middelgroot (3 UI-patterns + drempel-beslissing + ScoreBreakdownModal refactor)

### Drie sub-features

1. **`missing_factor_count` badge** (prominent):
   - `ScoreV3Result.missing_factor_count` is al beschikbaar vanuit backend.
   - Wanneer `>2` tonen in `ParcelDetailModal` + `ScoreBreakdownModal`: badge *"Beperkte data — score-betrouwbaarheid laag"*.
   - Tailwind + Aura palette (amber voor waarschuwing, niet rood — gebruiker raakt niet in paniek).

2. **Drempels 60/30 kalibreren of configureerbaar maken**:
   - Huidige hardcoded drempels in `score_v3.py:188` (Hoog ≥60, Gemiddeld ≥30, Laag <30).
   - Twee opties:
     - **A. Percentiel-based**: top 25% = Hoog, middelste 50% = Gemiddeld, rest = Laag. Vereist historische score-analyse.
     - **B. Configureerbaar**: drempels uit settings/admin, voorlopig 60/30 default.
   - Implementatie-keuze in S06-plan.

3. **Per-factor uitleg expanderbaar** in `ScoreBreakdownModal`:
   - `FactorResult.uitleg` (of `toelichting_lang`) veld is al populated.
   - Maak klikbare cards die expanderen — motion met framer-motion (matcht Aura patterns).

### Context die je NU al hebt uit deze sessie

- **S01 levert nieuwe response-velden**: `succeskans_missing`, `succeskans_reason`, `dev_type_ruling_count`, `total_ruling_count` (response van POST /analyze). Die worden NU NIET in UI getoond — S06 is het moment.
- **S03 levert narrative** "Funda-data niet beschikbaar (pilot-fase)" — factor ExplanationCard moet die prominent tonen zodat gebruiker begrijpt waarom funda-factor 0.5 heeft.
- **S04 verandert `_best_bestemming_type` gedrag** — bestemming-tile in UI moet niet meer "wonen" tonen voor een verkeer-strook. Dit hoort in `ParcelDetailPanel` / `ParcelBentoOverview` — checken of die direct leest uit bestemmingen-array of uit de factor-output.

### Live-ontdekte UI bug tijdens S01 verificatie (gebruiker aangedragen)
- `KlimaatLayer.tsx:30-48` berekent gemeente-verdict met ALLEEN `approvalRate` uit bekendmakingen (98% Venlo) — negeert jurisprudence-winkans (9% Venlo). Resultaat: gemeente label "99 ONTWIKKELKANSRIJK" ondanks 17/18 afgewezen rechtszaken.
- **Gecaptured als aparte todo**: `.planning/todos/pending/2026-04-19-gemeente-score-conflates-bekendmakingen-approval-with-jurisprudence.md`
- **Hoort NIET in S06** — aparte scope, heeft eigen fix-logica. Beter voor M048 Frontend Scaling.

### Files
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx`
- `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx`
- `frontend/src/components/scoring/ScoreBreakdownModal.tsx` (check of bestaat)
- `frontend/src/lib/api.ts` (types — updates uit S01 al gedaan)
- `backend/app/services/score_v3.py:188` (drempels — alleen als optie A gekozen)

---

## Afhankelijkheden

- **S05 blokkeert NIET S06** — verschillende gebieden.
- **S06 hoort na backend-fixes gemerged** (S01+S04) omdat UI leest uit backend-output.
- **S05 kan parallel met S06**: aparte code-gebieden, geen merge-conflicts.

**Voorstel volgorde:**
1. Eerst PRs mergen van S01/S02/S03/S04 (review + merge)
2. S06 (laag risico, levert zichtbare user-facing verbetering na S01/S04 merge)
3. S05 laatste (hoog risico, externe API dependency)

---

## Openstaande todos (.planning/todos/pending/)

1. `2026-04-19-gemeente-score-conflates-bekendmakingen-approval-with-jurisprudence.md` — KlimaatLayer bug, M048/M049
2. `2026-04-19-funda-ingestion-productify.md` — Funda data pipeline schaling, aparte milestone
3. `2026-04-19-scoring-weights-recalibration.md` — Score v3 gewichten herijken vóór M047

---

## Quick reference — belangrijke plekken

- **Iron-rule tests**: `backend/tests/test_m046_s0{1,2,4}_iron_rule.py` (S05 + S06 moeten hun eigen iron-rule files krijgen)
- **Aggregator helper**: `app/services/ruling_aggregator.py` (S01)
- **Builder helper**: `app/services/juridisch_klimaat_builder.py` (S01, nog niet gewire'd)
- **Roadmap**: `~/.gsd/projects/0fbd70b53f1b/milestones/M046/M046-ROADMAP.md`
- **Factor audit**: `~/.gstack/projects/Romainnoo145-propdex/existing-factors-audit-20260418.md`

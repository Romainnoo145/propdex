# Cascade `beleidsalignement` — Omgevingsvisie Venlo 2040

**Datum:** 2026-06-05
**Milestone/slice:** cascade-build campaign — M053/S01 (eerste gebouwde cascade na de woonvisie-POC; definitief slice-nummer bevestigd bij GSD-executie)
**Type:** nieuwe scoring-factor (cascade) — backend + frontend showcase
**Status:** ontwerp goedgekeurd door user 2026-06-05

---

## Doel

Tweede document-AI cascade naast `woonvisie_match`, om de cascade-engine te bewijzen
(generaliseert voorbij één document) en de Hauzer-demo breder te maken. Bron =
**Omgevingsvisie Venlo 2040** (vastgesteld; CVDR740383 + PDF). De visie is sterk
gebiedsgericht: 6 deelgebieden, elk met een ontwikkelrichting → een perceel krijgt een
per-gebied "windrichting" + letterlijk citaat.

Niet-doel: geen geo-polygoon-digitalisering, geen generieke admin-upload-UI, geen
provinciale laag. Die zijn out of scope voor deze slice (YAGNI).

## Infra-aanname (geverifieerd 2026-06-05)

De M047-cascade-infra is compleet en herbruikbaar; een nieuwe cascade is een **slice**,
geen milestone. Herbruikt zonder wijziging:
- `factor_extractor` + `FactorDefinition[PayloadT]` (Anthropic tool-use + input_schema)
- `factor_extraction_cache` (schema-versioned, idempotent)
- `FACTOR_REGISTRY` + per-projecttype gewichten + sum-guard
- scoring-functie-pattern in `score_v3_factors.py`
- `cascade_enrichment_service.get_cascade_payloads`
- ARQ re-scoring (`rescore_cascade_job.py`)
- `backfill_cascade_scores.py`
- frontend generieke `score_breakdown`-rendering + de WoonvisiePopup-trigger in PotentieLayer

`PolicyDocument`-model noemt `omgevingsvisie` al expliciet als verwachte `source_key`.

## Architectuur & datastroom

```
Venlo Omgevingsvisie PDF
   → PolicyDocument (source_key="omgevingsvisie", entity_code="GM0983", Hauzer-org)
   → factor_extractor (Anthropic tool-use)  →  OmgevingsvisiePayload (cached)
   → score_beleidsalignement(payload, parcel) →  score_breakdown["beleidsalignement"]
   → frontend PotentieLayer leest .waarde.matched_policy → OmgevingsvisiePopup
```
Geen nieuwe API-surface — alles via bestaand `score_breakdown`.

## Componenten

### 1. Extractie-schema — `app/ai/factors/beleidsalignement.py`
`GebiedPolicy` (per deelgebied):
- `gebied_naam: str` — bv. "Transformatiegebieden", "Dorpen"
- `karakter: Literal["centraal_stedelijk","transformatie","stedelijk_wonen","werklocatie","dorp","landschap"]`
- `woningbouwprioriteit: Literal["hoog","gemiddeld","laag","niet_benoemd"]`
- `transformatie_kansgebied: bool`
- `gebonden_plaatsen: list[str]` — bv. ["Blerick","Tegelen","Arcen"] — **de match-sleutel**
- `citaat: str` (letterlijk, min_length 1) + `pagina: int | None`

`OmgevingsvisiePayload`:
- `periode/tijdshorizon: int` (bv. 2040)
- `gebied_policies: list[GebiedPolicy]`
- `algemeen_citaat: str` (gemeente-brede fallback)
- `confidence: float` (0..1)

Plus `OMGEVINGSVISIE_FACTOR_DEF = FactorDefinition[OmgevingsvisiePayload](...)` met
`factor_id="beleidsalignement"`, `tool_name="extract_beleidsalignement"`, input_schema,
prompt_instructions (woonvisie-stijl: letterlijke citaten, geen hallucinatie, laat
GebiedPolicy weg zonder citaat).

### 2. Gebied→perceel matching (naam-match, géén geo)
Perceel-wijk/plaats-naam (uit `parcel_cache`) matchen tegen `gebonden_plaatsen` van elk
deelgebied. Hergebruik de bestaande OCR-normalisatie-helper in `score_v3_factors.py`
(regel ~1206, hyphen/U+2010-normalisatie). Geen match → `algemeen_citaat`, factor
`missing=True` (niet meegewogen) — exact zoals woonvisie.

### 3. Scoring — `score_beleidsalignement(parcel_data, project_type)` (categorie: **potentie**)
- transformatie_kansgebied of woningbouwprioriteit hoog → **0.85–1.0**
- stedelijk_wonen / gemiddeld → **0.5–0.65**
- behoud / werklocatie / landschap (botst met wonen) → **0.2–0.35**
- gemoduleerd door `project_type` (transformatie-project in transformatiegebied = perfect)
- geen match → `genormaliseerde_score=0.5, missing=True`

`waarde` payload (voor frontend): `{ matched_gebied, matched_policy: GebiedPolicy|null,
algemeen_citaat, tijdshorizon }`.

Bewust onderscheiden van `woonvisie_match` (woningbouwopgave/segment) — dit is ruimtelijk
gebiedskarakter. Geen dubbeltelling.

### 4. Registry + rebalance — `score_v3.py`
Nieuwe potentie-entry `beleidsalignement` `default_weight=10`, met
`weight_by_projecttype` bumps voor `nieuwbouw_wonen` + `transformatie_wonen`.
De 9 bestaande potentie-factoren herbalanceren 100→90 via een nieuwe
`_rebalance_potentie_weights(current, target_sum=90)` (kopie van de bewezen
`_rebalance_risico_weights`, largest-remainder, deterministische tie-break).
**Invariant:** sum potentie == 100 na toevoegen, harde assert + `_verify_registry_sum_guard`
blijven groen voor alle projecttypes.

### 5. Enrichment + call-site
- `cascade_enrichment_service.get_cascade_payloads`: branch toevoegen die de
  `omgevingsvisie`-PolicyDocument opzoekt (`get_omgevingsvisie_document`, kopie van
  `get_woonvisie_document` met `source_key=="omgevingsvisie"`) en `extract_factor` draait
  → `payloads["beleidsalignement"]`.
- `compute_score_v3` (score_v3.py ~regel 604): call-site-branch
  `score_beleidsalignement(_cascade.get("beleidsalignement"), project_type=...)` →
  `breakdown["beleidsalignement"]`.

### 6. Venlo-ingestie (one-off seed)
Script (patroon `probe_woonvisie_extraction.py`): haal de Venlo Omgevingsvisie-PDF op,
maak `PolicyDocument(source_key="omgevingsvisie", entity_type="gemeente",
entity_code="GM0983")` op de Hauzer-demo-org (info@hauzer.nl), draai extractie ter
verificatie. Daarna `backfill_cascade_scores.py` om Venlo- + Hauzer-demo-percelen te
herscoren zodat `beleidsalignement` gevuld is.

### 7. Frontend showcase — `OmgevingsvisiePopup.tsx`
Kloon van `WoonvisiePopup.tsx`, Aura-conform (Minimal Calm Intelligence, DESIGN.md-tokens,
light-mode): meta-regel ("Omgevingsvisie Venlo 2040 · p.X"), titel = deelgebied-naam,
karakter-dot + label, **citaat als focuspunt**, één alignement-zin vs. project_type.
Plus `beleidsalignement`-case in `PotentieLayer.tsx` (leest
`score_breakdown.beleidsalignement.waarde.matched_policy`, klikbare kaart → popup).

## Testing (TDD)

**Backend:**
- schema-validatie (geldige + ontbrekende-citaat payloads)
- scoring: groei/transformatie, behoud, no-match, project_type-modulatie
- registry sum-guard == 100 voor alle projecttypes na toevoegen
- rebalance-invariant (`_rebalance_potentie_weights` sum == target)
- **regression:** `woonvisie_match`-gedrag ongewijzigd (encode als regression-test, niet comment)

**Frontend:**
- OmgevingsvisiePopup render-states: match / geen-match / lage-confidence
- PotentieLayer card-wiring voor `beleidsalignement`

## Constraints
- Multi-tenant: PolicyDocument org-scoped (TenantMixin); extractie-cache per org-document.
- Bestanden < 300 regels: schema ~150, scoring-fn ~90, popup ~200.
- `npm run check` (frontend) + `ruff check . && mypy .` (backend) groen vóór commit.
- Commit-prefix per slice-conventie (M053/S01).

## Open verificatiepunt (eerste bouwstap)
Bevestig dat de Venlo Omgevingsvisie-PDF schoon te extraheren is (CVDR-tekst of PDF). Bij
problemen schuift `welstand_beperking` door als alternatieve eerste cascade.

## Deploy
Via de werkende auto-deploy (Railway `railway up backend --path-as-root --service api` +
frontend). Live verifiëren op prod: nieuw `beleidsalignement`-signaal + popup op een
Venlo-perceel.

# Phase 6: WijkPolicy schema + woonvisie scoring upgrade - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** Design doc 20260424-200512 §"Backend: WijkPolicy + scoring upgrade (S02)" + wave-sessie Storybook preview

<domain>
## Phase Boundary

Backend-only. Levert het data-contract + scoring-logica dat Phase 3 (woonvisie popup kaart 10) consumeert:

1. **Schema:** `WijkPolicy` Pydantic model + `WoonvisiePayload.wijk_policies: list[WijkPolicy]` + `algemeen_citaat` + bestaand `confidence` veld
2. **Claude tool:** `_INPUT_SCHEMA` in `WOONVISIE_MATCH_FACTOR_DEF` uitgebreid zodat Claude per document een lijst wijk-specifieke policies extraheert (geen platte gemeente-brede lijsten meer)
3. **Scoring:** `score_woonvisie_match()` zoekt matching `WijkPolicy` via bidirectionele substring-logica; score = prioriteit-basis (groei=+3 / herstructurering=+1.5 / krimp=-2.5) + segment × projecttype (+2.0 match / -1.0 mismatch), confidence-pull naar 5.0 behouden
4. **Cache:** SCHEMA_VERSION 3→4 bump invalideert v3 payload-shape entries; document-level sentinel (Phase 5) blijft werken
5. **Citaat propagatie:** wijk-citaat landt in `FactorResult.toelichting_lang` zodat Phase 3 popup het kan tonen zonder nieuwe API-velden

**Out of scope (in Phase 3/7/8):** popup-component, pinning-UI, `category`-veld in FACTOR_REGISTRY, E2E tests.

</domain>

<decisions>
## Implementation Decisions

### 1. WijkPolicy schema (LOCKED via ROADMAP)
- Velden: `wijk_naam: str`, `prioriteit: Literal["groei","krimp","herstructurering","neutraal"]`, `gewenste_segmenten: list[Literal["sociaal","midden","duur","gemengd"]]`, `citaat: str` (non-empty, `min_length=1`), `pagina: int | None`
- `citaat` is **required non-empty** — als Claude geen citaat kan extraheren voor een wijk, laat hij de WijkPolicy weg (lege lijst is OK)
- `pagina` is **optional** — sommige woonvisies hebben geen duidelijke paginanummering (web-PDF, genummerd per hoofdstuk)

### 2. WoonvisiePayload uitbreiding
- Nieuw: `wijk_policies: list[WijkPolicy] = []` (default leeg = vage extractie)
- Nieuw: `algemeen_citaat: str = ""` (fallback voor gemeente-brede tekst als `wijk_policies` leeg is)
- Behouden: `periode_start`, `periode_einde`, `document_type`, `opgave_totaal`, `pct_*`, `confidence`
- **Oude velden:** `growth_wijken`, `shrink_wijken`, `herstructureringswijken`, `prioritized_segment`, `excluded_project_types`, `doelgroepen` blijven in het Pydantic model voor backwards-compat van cache-entries, maar Claude krijgt ze **niet meer in de prompt/input_schema** (dus nieuwe extracties vullen ze niet). SCHEMA_VERSION 3→4 invalideert oude entries, dus in productie zijn ze binnen enkele scans weg.
- `score_woonvisie_match()` leest **alleen** `wijk_policies` + `algemeen_citaat` + `confidence` — geen fallback naar oude velden. Als `wijk_policies` leeg is bij nieuwe extractie → geen wijk-match pad (zie §4).

### 3. Claude tool_use schema
- `_INPUT_SCHEMA` krijgt `wijk_policies` als `{type: "array", items: {type: "object", properties: {...}, required: ["wijk_naam","prioriteit","gewenste_segmenten","citaat"]}}`
- `required` op top-level blijft: `["periode_start","periode_einde","confidence"]` — `wijk_policies` + `algemeen_citaat` mogen default-empty zijn (vage documenten)
- `prompt_instructions` herschreven: focus op "per wijk extraheren: naam + prioriteit + gewenste segmenten + letterlijk citaat + pagina". Expliciet: "laat WijkPolicy leeg als citaat niet letterlijk terug te vinden is — geen hallucinaties".

### 4. Fallback bij geen wijk-match
Als `wijk_policies == []` (vage doc) OF `wijk_naam` matcht geen enkele `WijkPolicy.wijk_naam` via substring-logica:
- Score = **5.0 neutraal** (behoud huidige startpunt-logica)
- `toelichting_lang` = `algemeen_citaat` (gemeente-brede tekst), of generieke fallback-string als ook `algemeen_citaat` leeg is
- **NIET** `missing=True` — de factor draagt nog steeds bij aan gemeente-brede score, alleen zonder wijk-differentiatie
- **NIET** terugvallen op oude `growth_wijken`-lijsten — dat is dode code na SCHEMA_VERSION bump

### 5. Substring-matching (LOCKED via ROADMAP)
Bidirectioneel: `g in wijk_lower or wijk_lower in g` voor elke `wijk_policies[i].wijk_naam`. Matcht "Blerick" met "Blerick-Noord" én "Blerick" (exact). **Eerste match wint** — lijst-volgorde uit Claude. Als `parcel.wijk_naam` None/leeg is → geen match → fallback (§4).

### 6. Projecttype × segment scoring
Behoud bestaande `_PROJECTTYPE_SEGMENT_MAP` in `score_v3_factors.py`:
- `nieuwbouw_wonen` → `[sociaal, midden]`
- `transformatie_wonen` → `[sociaal, midden, gemengd]`
- `optoppen` → `[midden, duur]`
- `splitsen` → `[sociaal, midden]`
- `commercieel_naar_wonen` → `[midden, gemengd]`
- `onbepaald` → `[]`

Bonus +2.0 per overlap tussen `preferred_segments` en `wijk_policies[match].gewenste_segmenten`. Penalty -1.0 als `preferred_segments` non-empty én geen overlap. Geen stapeling van bonussen voor meerdere matches — max één +2.0 per scoring-call.

### 7. Confidence-pull (behouden)
Score × `payload.confidence` + 5.0 × (1 - `payload.confidence`), dan clamp 0..10, dan `/10` voor `genormaliseerde_score`. Per-factor confidence (uit hele-document extractie), niet per-WijkPolicy. Dit blijft zoals nu — vage documenten trekken scores naar neutraal.

### 8. Citaat-format in toelichting_lang
Plain text: `"{uitleg_regel}. Citaat ({wijk_naam}, p.{pagina}): {citaat_tekst}"` — of zonder pagina-suffix als `pagina is None`. Phase 3 popup parset dit niet; die leest `matched_policy` structured uit `FactorResult.waarde` (wordt daar in opgeslagen als dict met wijk-metadata). `toelichting_lang` is dus voor mens-readability + FactorCard expanded-view; popup gebruikt structured data.

**Implication:** `FactorResult.waarde` voor woonvisie_match is nu een dict: `{"matched_wijk": str | None, "matched_policy": WijkPolicy.model_dump() | None, "prioritized_segment": str, "algemeen_citaat": str}`. Voorheen was het alleen `payload.prioritized_segment` (plain string). Phase 3 frontend-types moeten hierop aangepast — maar dat is Phase 3 scope.

### 9. SCHEMA_VERSION bump
`SCHEMA_VERSION: int = 4` in `factor_extraction_schemas.py`. Test `test_schema_version_exists_and_is_int` aanpassen naar `>= 3` (version-agnostic per Phase 5 beslissing). Bestaande `SCHEMA_VERSION >= 2` guards in Phase 1 tests blijven correct.

### 10. Tests (version-agnostic)
- `test_wijk_policy_schema.py` — Pydantic validation: `citaat min_length=1` rejecteert lege strings, `gewenste_segmenten` rejecteert invalid literals, `pagina` accepteert None + int
- `test_score_woonvisie_match_wijk_differentiation.py` — Blerick-fixture (groei, sociaal) vs Venlo-Centrum-fixture (neutraal, duur) met `project_type="nieuwbouw_wonen"` → Blerick score > 7, Centrum score < 5
- `test_score_woonvisie_match_fallback.py` — lege `wijk_policies` + `algemeen_citaat` gevuld → score 5.0, `toelichting_lang` bevat algemeen_citaat
- Cache-invalidation test via bestaande pattern: v3-entry direct ingeschreven, lookup na bump returned None
- Pre-existing 275 tests **moeten groen blijven** — bevestig via `pytest backend/tests/` na elke wijziging

### Claude's Discretion
- Exacte `prompt_instructions` tekst voor Claude (herschrijven vanuit huidige)
- `_INPUT_SCHEMA` JSON-details (description-strings, enum-declaraties)
- Dict-structuur van `FactorResult.waarde` (sleutelnaam-conventie)
- Logging-regels bij lege `wijk_policies` extractie (warning vs info)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design docs (source of truth)
- `/home/klarifai/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260424-200512.md` §"Backend: WijkPolicy + scoring upgrade (S02)" — LOCKED beslissingen voor M048
- `/home/klarifai/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260422-163755.md` §"Backend: WijkPolicy schema (nieuw)", §"Scoring upgrade", §"Wijk-naam matching risico" — detail-implementatie + mitigaties

### Roadmap + requirements
- `.planning/ROADMAP.md` §"Phase 6" — success criteria 1-7 (LOCKED)
- `.planning/REQUIREMENTS.md` — WOON-04, WOON-05, SCORE-04, TEST-06

### Backend code (te refactoren)
- `backend/app/ai/factors/woonvisie_match.py` — `WoonvisiePayload` + `WOONVISIE_MATCH_FACTOR_DEF` (uitbreiden)
- `backend/app/ai/factor_extraction_schemas.py` — `SCHEMA_VERSION` bump 3→4, `DOCUMENT_SENTINEL` constant blijft
- `backend/app/services/score_v3_factors.py:1201` — `score_woonvisie_match()` refactor (huidige implementatie gebruikt oude velden)
- `backend/app/services/cascade_enrichment_service.py` — **geen wijzigingen nodig**, caller gebruikt al DOCUMENT_SENTINEL
- `backend/app/services/factor_extraction_service.py` — geen wijzigingen, cache-aware wrapper blijft

### Tests (version-agnostic patterns)
- `backend/tests/unit/test_factor_extraction_service.py` — bestaand patroon met `SCHEMA_VERSION >= 2` guard
- `backend/tests/unit/test_factor_extraction_cache_model.py` — cache-key constraint check

### Design system + prior UI decisions
- `DESIGN.md` — Aura tokens (Morning Mist, Warm Amber, Vitality Green, Plus Jakarta Sans)
- `~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/feedback_m048_woonvisie_ui.md` — goedgekeurde popup-design (Phase 3 referentie)
- `frontend/src/components/map/panels/parcel/WoonvisiePopup.tsx` — preview-component uit wave-sessie (2026-04-24), gebruikt Phase 6 data-shape
- `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` — mock-data voor 5 scenarios (Blerick groei, Venlo-Centrum neutraal, Tegelen herstructurering, geen-match fallback, lage confidence)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WOONVISIE_MATCH_FACTOR_DEF` — factor-definitie al ingericht, alleen `payload_model`, `input_schema`, `prompt_instructions` hoeven update
- `factor_extraction_service.py:extract_factor()` — cache-aware wrapper, werkt per-document via DOCUMENT_SENTINEL (Phase 5)
- `cascade_enrichment_service.py:get_cascade_payloads()` — roept extract_factor met DOCUMENT_SENTINEL, blijft ongewijzigd
- Substring-matching logica in huidige `score_woonvisie_match()` (`g in wijk_lower or wijk_lower in g`) — herbruik exact voor WijkPolicy.wijk_naam iteratie

### Established Patterns
- **Sparse factor:** `missing=True` + `gewicht=0` wanneer data ontbreekt (zie score_bestemmingswijziging, score_overstromingsrisico). Phase 6 gebruikt dit NIET voor woonvisie_match — wél neutraal score 5.0 bij geen wijk-match (zie §4).
- **Confidence-pull:** `score × confidence + 5.0 × (1 - confidence)` staat al in huidige `score_woonvisie_match`
- **Version-agnostic tests:** gebruik `SCHEMA_VERSION >= N` of `SCHEMA_VERSION`-import, niet hardcoded versie-numeriek. Patroon uit Phase 5.

### Integration Points
- Callers van `score_woonvisie_match` in `backend/app/services/score_v3.py:422` — signature blijft `(payload, *, wijk_naam, project_type)`, geen caller-changes nodig
- `FACTOR_REGISTRY["woonvisie_match"]` in score_v3.py:136 — blijft ongewijzigd, gewicht 12
- `FactorResult.waarde` verandert van `str` (prioritized_segment) naar `dict` — frontend moet dit opmerken in Phase 3 (out of scope hier, maar flaggen in plan voor Phase 3-awareness)

</code_context>

<specifics>
## Specific Ideas

- Wave-sessie 2026-04-24 op Storybook localhost:6006 met 5 scenarios bevestigd: popup-design + data-contract werken voor groei/neutraal/herstructurering/geen-match/lage-confidence
- Citaten moeten **volle beleidsparagrafen** zijn, niet 2 zinnen — echte woonvisies hebben context, cijfers (bv. "400 sociale huurwoningen, 20% middenhuur"), doelgroepen, uitvoeringspartners, uitzonderingen
- Prioriteit-chip kleuren volgens DESIGN.md semantics: groei=Vitality Green, herstructurering=Warm Amber, neutraal=neutraal-grijs, krimp=Signal Red — **met kleine kleur-dot vóór label** (niet alleen bg-kleur)
- 6 cards per page (Phase 7 beslissing) in Potentie grid, niet 9 — bepaalt hoe kaart 10 (WOONVISIE) in pinned page past

</specifics>

<deferred>
## Deferred Ideas

- **Per-WijkPolicy confidence veld** — over-engineering voor M048; één document-level confidence is voldoende. Naar M050+ als Claude sterk varieert per wijk binnen één document.
- **Herziene `_PROJECTTYPE_SEGMENT_MAP`** (fijnmazigere mapping per projecttype, bv. "optoppen" varieert met bestaand gebouw-segment) — huidige mapping werkt voor Venlo-POC, uitbreiding in M050+.
- **Configureerbare projecttype-segment matrix per organisatie** — flexibel maar niet nodig voor M048.
- **Old-field deletion uit WoonvisiePayload** — verwijderen van `growth_wijken`/`shrink_wijken`/etc. uit Pydantic model. Nu: deprecaten (Claude stopt vullen), blijven lezen voor cache-backwards-compat. Clean delete in M050+ als alle pre-v4 caches verdwenen zijn.

</deferred>

---

*Phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade*
*Context gathered: 2026-04-24 via wave-sessie Storybook preview*

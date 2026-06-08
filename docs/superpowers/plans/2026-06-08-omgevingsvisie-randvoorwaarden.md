# Omgevingsvisie Randvoorwaarden (slice 1) Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Extract the gemeente's randvoorwaarden (toetsingskader + strategic rules) from the omgevingsvisie and show them as a "Randvoorwaarden" section in the OmgevingsvisiePopup — display-only, with zero impact on score/verdict.

**Architecture:** Add a generic `Randvoorwaarde` model + a `randvoorwaarden` list to `OmgevingsvisiePayload` (same Claude call, already reads the whole doc). `score_beleidsalignement` copies the list into `waarde` for display; scoring is byte-identical. Bump `SCHEMA_VERSION` 4→5, re-extract the Venlo omgevingsvisie, re-backfill. The popup renders the section.

**Tech Stack:** Python/pydantic/pytest (backend); React 19/TS/Vitest (frontend). Spec: `docs/superpowers/specs/2026-06-08-omgevingsvisie-randvoorwaarden-design.md`.

**Measurability guard (load-bearing):** randvoorwaarden are display-only. A regression test asserts `genormaliseerde_score` + `verdict` are identical with vs without randvoorwaarden in the payload.

---

### Task 1: Schema — `Randvoorwaarde` model + payload field + prompt + schema bump

**Files:**
- Modify: `backend/app/ai/factors/beleidsalignement.py`
- Modify: `backend/app/ai/factor_extraction_schemas.py:114` (`SCHEMA_VERSION` 4→5)
- Test: `backend/tests/unit/test_beleidsalignement_schema.py`

- [ ] **Step 1: Write the failing schema test**

Add to `backend/tests/unit/test_beleidsalignement_schema.py` (read the file first to match its style):

```python
def test_randvoorwaarde_on_payload():
    from app.ai.factors.beleidsalignement import OmgevingsvisiePayload, Randvoorwaarde

    rv = Randvoorwaarde(
        categorie="programmering",
        titel="70/30 verdeling",
        samenvatting="Bij projecten vanaf 30 woningen geldt 70% vrije sector / 30% sociaal.",
        citaat="70% vrije sector en 30% sociale huur",
        pagina=18,
    )
    p = OmgevingsvisiePayload(tijdshorizon=2040, confidence=0.9, randvoorwaarden=[rv])
    assert p.randvoorwaarden[0].categorie == "programmering"
    # default is empty list (back-compat with v4 payloads)
    p2 = OmgevingsvisiePayload(tijdshorizon=2040, confidence=0.9)
    assert p2.randvoorwaarden == []
```

- [ ] **Step 2: Run it red**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_beleidsalignement_schema.py::test_randvoorwaarde_on_payload -v`
Expected: FAIL (`Randvoorwaarde` / `randvoorwaarden` don't exist).

- [ ] **Step 3: Add the model + field**

In `beleidsalignement.py`, after the `Woningbouwprioriteit` Literal (~line 24), add:

```python
RandvoorwaardeCategorie = Literal[
    "programmering", "financieel", "doelgroep", "duurzaamheid",
    "proces", "ruimtelijk", "markt", "overig",
]


class Randvoorwaarde(BaseModel):
    """Een gemeente-brede randvoorwaarde / toetsingsregel uit de omgevingsvisie.

    Display-only: deze beïnvloeden de score NIET (zie spec — meetbaarheid).
    """

    categorie: RandvoorwaardeCategorie
    titel: str = Field(min_length=1, description="Korte titel van de randvoorwaarde")
    samenvatting: str = Field(min_length=1, description="1-3 zinnen: wat betekent dit voor een ontwikkelaar")
    citaat: str | None = Field(default=None, description="Letterlijk citaat dat het onderbouwt")
    pagina: int | None = Field(default=None, ge=1)
```

Add to `OmgevingsvisiePayload` (after `gebied_policies`):

```python
    randvoorwaarden: list[Randvoorwaarde] = Field(
        default_factory=list,
        description="Gemeente-brede randvoorwaarden / toetsingskader (display-only, niet gescoord)",
    )
```

- [ ] **Step 4: Extend `_INPUT_SCHEMA` + prompt**

In `_INPUT_SCHEMA["properties"]`, add a `randvoorwaarden` array:

```python
        "randvoorwaarden": {
            "type": "array",
            "description": (
                "Gemeente-brede randvoorwaarden / toetsingsregels die voor ELKE ontwikkeling "
                "in de gemeente gelden (niet gebied-specifiek): bv. programmerings-eisen, "
                "kostenverhaal, doelgroep/short-stay regels, duurzaamheidseisen, milieucategorie, "
                "proces/toetsingskader. Laat weg zonder letterlijke basis in het document."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "categorie": {
                        "type": "string",
                        "enum": ["programmering", "financieel", "doelgroep", "duurzaamheid",
                                 "proces", "ruimtelijk", "markt", "overig"],
                    },
                    "titel": {"type": "string", "minLength": 1},
                    "samenvatting": {"type": "string", "minLength": 1,
                                     "description": "1-3 zinnen, wat betekent dit voor een ontwikkelaar"},
                    "citaat": {"type": "string", "description": "Letterlijk citaat"},
                    "pagina": {"type": "integer", "minimum": 1},
                },
                "required": ["categorie", "titel", "samenvatting"],
                "additionalProperties": False,
            },
        },
```

Extend `prompt_instructions` with a numbered step asking Claude to also extract the
gemeente-brede randvoorwaarden into `randvoorwaarden` (categorie + titel + samenvatting +
letterlijk citaat + pagina), with the existing no-hallucination rule.

- [ ] **Step 5: Bump `SCHEMA_VERSION`**

`app/ai/factor_extraction_schemas.py:114`: `SCHEMA_VERSION: int = 5  # M053/S06 randvoorwaarden on OmgevingsvisiePayload`

- [ ] **Step 6: Run the test green + ruff**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_beleidsalignement_schema.py -v && ruff check app/ai/factors/beleidsalignement.py`
Expected: PASS, ruff clean.

- [ ] **Step 7: Commit**

```bash
git add backend/app/ai/factors/beleidsalignement.py backend/app/ai/factor_extraction_schemas.py backend/tests/unit/test_beleidsalignement_schema.py
git commit -m "M053/S06: Randvoorwaarde model + randvoorwaarden on OmgevingsvisiePayload + schema v5"
```

### Task 2: `score_beleidsalignement` surfaces randvoorwaarden (display-only)

**Files:**
- Modify: `backend/app/services/score_v3_factors.py` (`score_beleidsalignement` — the no-match return + the matched return waarde dicts)
- Test: `backend/tests/unit/test_score_beleidsalignement.py`

- [ ] **Step 1: Write the failing + regression tests**

Add to `test_score_beleidsalignement.py` (the `make_omgevingsvisie_payload` fixture exists — extend it to accept `randvoorwaarden` or build inline):

```python
def test_randvoorwaarden_surfaced_in_waarde(make_omgevingsvisie_payload):
    from app.ai.factors.beleidsalignement import OmgevingsvisiePayload, GebiedPolicy, Randvoorwaarde
    payload = make_omgevingsvisie_payload()
    payload.randvoorwaarden = [
        Randvoorwaarde(categorie="programmering", titel="70/30",
                       samenvatting="70% vrije sector / 30% sociaal vanaf 30 woningen."),
    ]
    r = score_beleidsalignement(payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="onbepaald")
    assert isinstance(r.waarde["randvoorwaarden"], list)
    assert r.waarde["randvoorwaarden"][0]["categorie"] == "programmering"


def test_randvoorwaarden_do_not_change_score(make_omgevingsvisie_payload):
    """Measurability guard: randvoorwaarden are display-only — score + verdict identical."""
    from app.ai.factors.beleidsalignement import Randvoorwaarde
    base = make_omgevingsvisie_payload()
    enriched = make_omgevingsvisie_payload()
    enriched.randvoorwaarden = [
        Randvoorwaarde(categorie="financieel", titel="Kostenverhaal", samenvatting="..."),
    ]
    a = score_beleidsalignement(base, wijk_naam="Wijk 11 Venlo-Centrum", project_type="onbepaald")
    b = score_beleidsalignement(enriched, wijk_naam="Wijk 11 Venlo-Centrum", project_type="onbepaald")
    assert a.genormaliseerde_score == b.genormaliseerde_score
    assert a.waarde["verdict"] == b.waarde["verdict"]
    assert a.waarde["strijdig_met_visie"] == b.waarde["strijdig_met_visie"]
```

- [ ] **Step 2: Run red**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_score_beleidsalignement.py -k randvoorwaarden -v`
Expected: `test_randvoorwaarden_surfaced_in_waarde` FAILS (KeyError 'randvoorwaarden'); the guard PASSES already.

- [ ] **Step 3: Add randvoorwaarden to both waarde dicts**

In `score_beleidsalignement`, in BOTH the no-match return and the matched return (the two `waarde={...}` dicts that contain `matched_gebied`), add a key:

```python
            "randvoorwaarden": [r.model_dump(mode="json") for r in payload.randvoorwaarden],
```

(Do NOT add it to the `payload is None` → missing return.) Do not touch
`genormaliseerde_score`, `verdict`, `strijdig_met_visie`, `gewicht`, or `bijdrage`.

- [ ] **Step 4: Run green**

Run: `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_score_beleidsalignement.py -v && ruff check app/services/score_v3_factors.py`
Expected: all PASS, ruff clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/score_v3_factors.py backend/tests/unit/test_score_beleidsalignement.py
git commit -m "M053/S06: surface randvoorwaarden in beleidsalignement waarde (display-only, score unchanged)"
```

### Task 3: Re-extract + re-backfill (controller runs)

**Files:** none (operational — one real Claude call).

- [ ] **Step 1: Force a v5 re-extraction of the Venlo omgevingsvisie**

Write a one-off `backend/app/tools/reextract_omgevingsvisie.py` (or inline `python -c`) that loads the Venlo `PolicyDocument` (source_key='omgevingsvisie', entity_code='GM0983', `is_global` or any org) and calls
`extract_factor(db, factor_def=OMGEVINGSVISIE_FACTOR_DEF, parcel_id=DOCUMENT_SENTINEL, policy_document=doc, force_refresh=True)`. This makes the live Claude call against the new schema and writes the v5 cache. Verify it returns a payload with `randvoorwaarden` populated (len > 0).

- [ ] **Step 2: Re-run the cascade backfill**

Run:
```bash
cd backend && source .venv/bin/activate && python -m app.tools.backfill_cascade_scores \
  --gemeente GM0983 --organization-id ec424ee5-c670-4066-9183-b600aec41377
```
Expected: completes, processed=63817.

- [ ] **Step 3: Verify randvoorwaarden landed + score unchanged**

```bash
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d propdex -tA -c "
SELECT jsonb_array_length(flags->'score_breakdown'->'beleidsalignement'->'waarde'->'randvoorwaarden') AS n_rv,
       count(*)
FROM scan_results
WHERE flags->'score_breakdown'->'beleidsalignement'->'waarde'->'randvoorwaarden' IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC;"
```
Expected: `n_rv` > 0 for parcels (the document's randvoorwaarden count). Also re-confirm the verdict distribution (kansrijk 2336 etc.) is unchanged from before.

### Task 4: Frontend — Randvoorwaarden section in OmgevingsvisiePopup

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx`
- Modify: `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`
- Modify: `frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx`

- [ ] **Step 1: Types + prop**

In `OmgevingsvisiePopup.tsx` add:

```tsx
export interface Randvoorwaarde {
  categorie: string
  titel: string
  samenvatting: string
  citaat?: string | null
  pagina?: number | null
}
```

Add `randvoorwaarden?: Randvoorwaarde[]` to `OmgevingsvisiePopupProps`.

- [ ] **Step 2: Render the section**

Below the citaat block, add (only when `randvoorwaarden?.length`):

```tsx
            {randvoorwaarden && randvoorwaarden.length > 0 && (
              <div className="mt-8 border-t border-[#F2F6F3] pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Randvoorwaarden
                </p>
                <div className="mt-3 space-y-3">
                  {randvoorwaarden.map((rv, i) => (
                    <div key={`${rv.categorie}-${i}`}>
                      <p className="text-[13px] font-semibold text-[#0E1111]">{rv.titel}</p>
                      <p className="text-[12px] leading-relaxed text-[#6B7280]">{rv.samenvatting}</p>
                      {rv.citaat && (
                        <p className="mt-1 text-[11px] italic text-slate-400">
                          “{rv.citaat}”{rv.pagina ? ` · p.${rv.pagina}` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
```

Keep Aura minimal — no chips. (Optional: a small muted categorie label per item if it reads cleanly; skip if it adds noise.)

- [ ] **Step 3: Thread from PotentieLayer**

In `PotentieLayer.tsx`, extend the `omgevingsvisieWaarde` cast to include
`randvoorwaarden?: Randvoorwaarde[]`, import the type, and pass
`randvoorwaarden={omgevingsvisieWaarde?.randvoorwaarden}` into `<OmgevingsvisiePopup .../>`.

- [ ] **Step 4: Story**

Add a `MetRandvoorwaarden` story passing 2-3 sample randvoorwaarden.

- [ ] **Step 5: Typecheck + lint**

Run: `cd frontend && pnpm typecheck && npx eslint src/components/map/panels/parcel/OmgevingsvisiePopup.tsx src/components/map/panels/parcel/layers/PotentieLayer.tsx`
Expected: clean, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx frontend/src/stories/parcel/OmgevingsvisiePopup.stories.tsx
git commit -m "M053/S06: OmgevingsvisiePopup renders Randvoorwaarden section"
```

### Task 5: Validation sweep (controller)

- [ ] `cd backend && source .venv/bin/activate && python -m pytest tests/unit/test_beleidsalignement_schema.py tests/unit/test_score_beleidsalignement.py tests/regression/test_woonvisie_unchanged.py -q` → all green.
- [ ] `ruff check app/ai/factors/beleidsalignement.py app/services/score_v3_factors.py`.
- [ ] `cd frontend && pnpm typecheck && pnpm lint` → 0 errors.
- [ ] Manual: open a Venlo parcel's omgevingsvisie popup on localhost:9300 → "Randvoorwaarden" section renders. Screenshot for the user.

## Out of scope
- Location-aware randvoorwaarden (fase 2).
- Woonvisie randvoorwaarden (slice 2 — identical pattern, see spec).

## Prod deploy note
Schema bump → on prod also: re-extract the omgevingsvisie (one Claude call) + re-run the cascade backfill under the prod demo org.

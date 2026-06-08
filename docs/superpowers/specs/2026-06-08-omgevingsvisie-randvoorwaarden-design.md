# Omgevingsvisie — Randvoorwaarden (slice 1) — Design

**Date:** 2026-06-08
**Status:** Approved (design dialogue 2026-06-08)

## Problem

Our omgevingsvisie extraction captures the spatial skeleton (10 gebieden + karakter) but
misses the most actionable part for a developer: the gemeente's **randvoorwaarden** — the
toetsingskader and the strategic rules a plan must meet. A manual read of the Omgevingsvisie
Venlo 2040 surfaces ~7 categories of these (toetsingskader, kostenverhaal, short-stay,
milieucategorie, natuurinclusiviteit, warmtenet-startwijken, netcongestie). We extract 0% of
them today. The omgevingsvisie popup shows a gebied-verdict + one citaat — useful for "does
the gemeente want development here", but silent on "what must my plan comply with".

## Core decision — measurability draws the line

The omgevingsvisie contains two kinds of information:
1. **Richting** (which gebied, does the gemeente steer development here) → **measurable**
   (location → gebied via the crosswalk) → **this scores** (the existing kansrijk/strijdig
   verdict). Unchanged by this slice.
2. **Randvoorwaarden** (kostenverhaal, toetsingskader, short-stay, milieucategorie, etc.) →
   **not measurable per parcel** (we can't determine whether a given parcel "meets" them)
   → **display-only context, hard-excluded from all scoring/verdict logic.**

We never claim something we can't measure. Randvoorwaarden are shown so the developer can
assess; they move no score and gate no parcel.

It is all **one Omgevingsvisie** — one factor, one card, one popup. No new "spelregels"
concept, no new card, no second score.

## Decisions

| | |
|---|---|
| Name | **Randvoorwaarden** (section in the OmgevingsvisiePopup) |
| Schema | `randvoorwaarden: list[Randvoorwaarde]` on `OmgevingsvisiePayload`, document-wide |
| Categories | toetsingskader · kostenverhaal · short_stay · milieucategorie · natuurinclusiviteit · warmtenet · netcongestie · overig |
| Scoring | unchanged (richting only). Randvoorwaarden = display-only, excluded from score/verdict |
| Extraction | same Claude call (already reads the whole doc); `SCHEMA_VERSION` 4 → 5 → re-extract + re-backfill |
| UI | a "Randvoorwaarden" section under the verdict/citaat in `OmgevingsvisiePopup` |
| Out of scope (fase 2) | location-awareness (highlight which randvoorwaarde applies to *this* parcel — warmtenet startwijk, milieucategorie per terrein) |

## Schema (backend)

In `backend/app/ai/factors/beleidsalignement.py`:

```python
RandvoorwaardeCategorie = Literal[
    "toetsingskader", "kostenverhaal", "short_stay", "milieucategorie",
    "natuurinclusiviteit", "warmtenet", "netcongestie", "overig",
]

class Randvoorwaarde(BaseModel):
    categorie: RandvoorwaardeCategorie
    titel: str = Field(min_length=1, description="Korte titel van de randvoorwaarde")
    samenvatting: str = Field(min_length=1, description="1-3 zinnen: wat betekent dit voor een ontwikkelaar")
    citaat: str | None = Field(default=None, description="Letterlijk citaat dat het onderbouwt")
    pagina: int | None = Field(default=None, ge=1)
```

Add to `OmgevingsvisiePayload`:
```python
    randvoorwaarden: list[Randvoorwaarde] = Field(default_factory=list)
```

Extend `_INPUT_SCHEMA` with a `randvoorwaarden` array (same field shapes) and extend
`prompt_instructions` to ask Claude to extract the gemeente-brede randvoorwaarden /
toetsingskader (document-wide, not per gebied), with a literal citaat + pagina each, and the
hard rule: no hallucinations — leave out anything without a literal basis in the document.

Bump `SCHEMA_VERSION` 4 → 5 in `app/ai/factor_extraction_schemas.py` (invalidates the v4
cache → forces re-extraction).

## Data flow (display-only)

`score_beleidsalignement` copies `payload.randvoorwaarden` into the result `waarde` dict (in
every return path where `payload` is not None), e.g. `"randvoorwaarden": [r.model_dump() for
r in payload.randvoorwaarden]`. This is purely additive to `waarde` — the score
(`genormaliseerde_score`), `verdict`, `strijdig_met_visie`, and the score_v3 weighting are
**untouched**. The popup reads `waarde.randvoorwaarden`.

```
omgevingsvisie doc ──(whole doc)──▶ Claude tool-use ──▶ OmgevingsvisiePayload
                                                           ├─ gebied_policies  → richting → SCORE (unchanged)
                                                           └─ randvoorwaarden  → waarde.randvoorwaarden → POPUP (display-only)
```

Note: the randvoorwaarden list is identical per gemeente but stored per-parcel in `waarde`
(consistent with how `matched_policy` is already stored). Acceptable for one demo gemeente;
a future optimization could fetch it once at gemeente level. Redaction (`redact_score_breakdown`)
strips `waarde` for unauthorized orgs, so no IP leak.

## UI

`OmgevingsvisiePopup` (`frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx`):
- Below the verdict sentence + citaat, add a **"Randvoorwaarden"** section when
  `randvoorwaarden` is non-empty.
- Each item: a small categorie-label, the `titel` (semibold), the `samenvatting` (muted), and
  the `citaat`/`pagina` as subtle/expandable evidence. Keep Aura minimal (no chip-soup).
- Thread `randvoorwaarden` from `PotentieLayer` (it already reads `omgevingsvisieWaarde`).
- Empty state: render nothing if the list is empty (older cache / gemeente without
  extracted randvoorwaarden).

## Re-extraction + backfill

Schema bump → the v4 cache is stale. To populate v5: trigger a live re-extraction of the
Venlo omgevingsvisie (via `extract_factor` / a small one-off, or `rescore_cascade_job` which
calls `extract_factor` cache-aware → live extraction on the v5 miss), then re-run
`backfill_cascade_scores --gemeente GM0983 --organization-id <Hauzer>` so every parcel's
`waarde` carries the new randvoorwaarden. This is one real Claude call (the ~60-page doc).

## Testing

- `Randvoorwaarde` / payload schema validation (unit).
- `score_beleidsalignement` includes `randvoorwaarden` in `waarde` AND leaves
  `genormaliseerde_score`/`verdict` byte-identical with vs without randvoorwaarden in the
  payload (regression: display-only, no score impact).
- Popup renders the Randvoorwaarden section + renders nothing when empty (story/component test).
- Existing beleidsalignement + `test_woonvisie_unchanged` regressions stay green.

## Out of scope

- Location-aware randvoorwaarden (fase 2).
- Finer development-location extraction (the named sub-projects) — separate slice.
- Woonvisie randvoorwaarden — separate.

# Beleidsalignement — Actionable + Directional (M053/S03) — Design

**Date:** 2026-06-08
**Branch (intended):** m053-s03-beleidsalignement-directional
**Status:** Approved (design dialogue + CEO review 2026-06-08)

## Problem

The `beleidsalignement` (Omgevingsvisie) factor exists and loads, but delivers no
value to a developer and actively misleads:

1. **The valuable gebieden reach 0 parcels.** Of 10 deelgebieden, only 5 ever match a
   parcel — all "gemiddeld" dorpen + "Stedelijke woongebieden". The two highest-value
   gebieden ("Hart van het Centraal stedelijk gebied" + "Transformatiegebieden", both
   *woningbouwprioriteit hoog* + *transformatie_kansgebied*) match **0 parcels**, because
   their `gebonden_plaatsen` ("Binnenstad Venlo", "Kazerneterrein") don't substring-match
   the CBS wijk names.
2. **It always adds a `+`.** On no-match the factor returns a neutral 0.5 with
   `missing=False`, which `score_v3` re-weights into a positive contribution (~0.5 ×
   weight) for ~31.5k parcels. It never penalizes — even restrictive landschap-zones get
   the bonus.
3. **The text isn't actionable.** The popup leads with the policy citaat (prose).
   `woningbouwprioriteit` is extracted but not rendered. No translation to a decision.

**Reframe (CEO review):** beleidsalignement is a proxy for *gemeente-medewerkingskans*,
not raw potentie. A great kavel in a protected landschap-zone is a *rem*, not slightly-
less-potential. The job-to-be-done: *"werkt de gemeente mee met wat ik hier wil
ontwikkelen?"*

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Stuurkracht | **Hybride** — soft score (boost-or-neutral, never negative) + a separate hard `strijdig_met_visie` flag that warns independently of the number. |
| 2 | Matching durability | **Venlo crosswalk now**, geocode-generic later. Deterministic, reviewable plaats→CBS-wijk map; substring fallback for other gemeenten. |
| 3 | Popup layout | **Variant B (minimal inline)** — verdict sentence as focal point, `woningbouwprioriteit` shown, citaat demoted to evidence, strijdig = red line. No frames/chips. |

## Scope

In scope: `beleidsalignement` (Omgevingsvisie). The crosswalk + verdict mechanism is built
reusably so woonvisie can adopt it next, but woonvisie changes are NOT in this slice.

## Design

### 1. Matching — Venlo crosswalk (`backend/app/services/score_v3_factors.py`)

- New deterministic map `VENLO_WIJK_TO_GEBIED: dict[str, str]` keyed by normalized CBS
  wijk name → omgevingsvisie `gebied_naam`. Built by listing Venlo's CBS wijk names
  (DB: `scan_results`/parcel wijk values) and assigning each to the gebied whose
  `gebonden_plaatsen` covers it. ~21 entries, verifiable against the map.
- `score_beleidsalignement` resolves the parcel's gebied: **crosswalk lookup first**
  (exact), **fall back to the existing `_normalize_wijk` substring match** when the wijk
  is not in the crosswalk (keeps other gemeenten working as today).
- Effect: centrum + transformatiegebieden parcels finally match their gebied.
- Out of scope: generic geocode→spatial-join matching (separate todo).

### 2. Scoring — directional, soft (`score_beleidsalignement`)

Genormaliseerde score by karakter × woningbouwprioriteit (illustrative anchors, pinned in
plan):

| karakter | prioriteit | norm score |
|---|---|---|
| centraal_stedelijk / transformatie | hoog | ~0.85 |
| stedelijk_wonen / dorp | gemiddeld | ~0.60 |
| werklocatie / landschap | laag | ~0.25 |

- **Never negative** (soft). Stays a potentie factor; no penalty modifier on the overall.
- **No-match → `missing=True`** (was `missing=False` + 0.5). This removes the always-`+`
  floor: non-matching parcels exclude the factor (sparse, weight 0) instead of getting a
  free bonus. This is the fix for complaint #2.
- Projecttype × karakter fit still nudges within the matched range (reuse existing
  `_PROJECTTYPE_SEGMENT_MAP`-style logic; frontend already has `PROJECTTYPE_FIT`).

### 3. Hard flag — `strijdig_met_visie`

- New boolean on the factor result `waarde`, `true` when the matched gebied karakter is
  restrictive-for-wonen (`landschap` or `werklocatie`).
- **Does not change the number.** Feeds the red verdict line in popup + card.

### 4. Verdict logic (shared contract, popup + card)

Derived from match state × karakter × woningbouwprioriteit × projecttype-fit:

- ✓ **Kansrijk** (green): fit + prioriteit hoog/gemiddeld
- **Neutraal** (amber): matched, fit unclear
- ⚠ **Strijdig** (red): `strijdig_met_visie` true → "reken op verzet"
- **Geen beleid** (grey): no match (factor missing)

### 5. Popup — Variant B (`frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx`)

- Verdict sentence becomes the focal point (✓/⚠ + one line). Render
  `woningbouwprioriteit`. Demote citaat to supporting evidence below. Strijdig → red
  line. Keep Aura minimal aesthetic (no frames/chips), solid white card.
- `PotentieLayer` factor-card sub-text reflects the same verdict state.

## Data flow

```
parcel.wijk_naam ──▶ crosswalk lookup ──hit──▶ gebied
                          │ miss
                          ▼
                  substring fallback ──hit──▶ gebied
                          │ miss
                          ▼
                   missing=True (no +0.5)        gebied ──▶ norm score (directional)
                                                       └──▶ strijdig_met_visie (flag)
                                                       └──▶ verdict state ──▶ popup + card
```

## Tests (TDD)

- Crosswalk: a centrum/transformatie wijk now resolves to its high-value gebied (was 0).
- Directional: transformatie+hoog > dorp+gemiddeld > landschap+laag; never negative.
- No-match → `missing=True`, zero contribution (regression on the old +0.5 floor).
- `strijdig_met_visie` true for landschap/werklocatie, false otherwise.
- Verdict mapping (unit) for all four states.
- Popup renders verdict + prioriteit; strijdig renders the red line (component test/story).
- Keep the factor-count regression guard at 26.

## Out of scope (todos)

- Woonvisie parity (same crosswalk + verdict, different doc).
- Generic geocode-based matching for all gemeenten.
- Red flag on the map / opgeslagen-list (this slice: popup + card only).
- S01 `score_v3_factors.py` `no_match_pulled` dead-expression cleanup.

## Deploy note

Backend scoring change → re-run `backfill_cascade_scores --gemeente GM0983` after deploy
(local + prod) so the new matching/score lands on existing parcels.

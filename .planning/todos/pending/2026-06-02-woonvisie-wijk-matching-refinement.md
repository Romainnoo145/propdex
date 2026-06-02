# Refine woonvisie_match per-wijk matching (gemeente-wide fallback dominates)

**Created:** 2026-06-02
**Type:** quality / cascade-scoring refinement
**Trigger:** woonvisie_match live (local+prod), but user sees the SAME gemeente-wide
generic citaat on nearly every wijk.

## Diagnosis (verified on data)
woonvisie extraction (confidence 0.75) found **4 wijk_policies**: Kazerne Kwartier,
binnenstad Venlo, Velden, Hout-Blerick — real citaten + page numbers.

Per-parcel matching result (63,817 parcels):
- 8,375 matched a wijk: `Wijk 41 Velden` (4,517) + `Wijk 26 Hout-Blerick` (3,858)
- **55,442 matched_wijk = None → gemeente-wide algemeen_citaat** (the repetitive generic text)

Two causes:
1. **Name-mismatch**: extracted `"binnenstad van Venlo"` / `"Kazerne Kwartier"` don't match
   the CBS wijk naming (`Wijk 01 …`), so even the centrum (where woonvisie DOES have policy)
   falls back to gemeente-wide. Only Velden + Hout-Blerick happen to name-match.
2. **Doc coverage**: the woonvisie only addresses ~4 wijks specifically; the rest is
   gemeente-wide by the document's nature (gemeente-wide is arguably correct there).

## Fix options
- Fuzzy/alias wijk-matching: map extracted names → CBS wijk codes (binnenstad→Venlo-Centrum,
  Kazerne Kwartier→its CBS wijk). Possibly a small alias table or geocode-based match.
- Display: don't repeat the full gemeente-wide citaat identically on every parcel — show it
  subtly (or only the matched wijk-specific text), so it doesn't read as noise.
- Optionally re-extract with a stronger model to capture more wijk names in matchable form.

## Status
Separate slice (cascade matching logic + display). woonvisie_match IS live and differentiating
for Velden + Hout-Blerick. Not started.

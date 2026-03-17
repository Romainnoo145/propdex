# T02: 84-ai-analysis-doorlooptijd 02

**Slice:** S03 — **Milestone:** M001

## Description

Wire the frontend to the new per-ruling analysis API, add auto-analysis trigger on feed load, display vergunningstype badges on ruling cards, and show doorlooptijd statistics in JuridischKlimaatCard.

Purpose: Users see analysis results automatically without clicking a button, with actionable vergunningstype classification and procedure duration metrics visible per gemeente.

Output: Updated API types, auto-triggering analysis hook, vergunningstype badges, doorlooptijd statistics card.

## Must-Haves

- [ ] "Analysis triggers automatically when feed loads, no manual button needed"
- [ ] "Vergunningstype badge visible on each ruling card in the feed"
- [ ] "Doorlooptijd statistics displayed per vergunningstype in JuridischKlimaatCard"
- [ ] "Insufficient data shows 'onvoldoende data' instead of misleading averages"

## Files

- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useJurisprudence.ts`
- `frontend/src/components/projects/JurisprudenceSection.tsx`
- `frontend/src/components/projects/JuridischKlimaatCard.tsx`

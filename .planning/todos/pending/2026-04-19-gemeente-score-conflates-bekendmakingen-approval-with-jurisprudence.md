---
created: 2026-04-19T16:32:06.339Z
title: Gemeente-level score conflates bekendmakingen-approval with jurisprudence-winkans
area: ui
files:
  - frontend/src/components/map/panels/gemeente/KlimaatLayer.tsx:30-48
  - frontend/src/hooks/useJurisprudence.ts (existing)
  - memory/scoring-roadmap-active.md (Gemeente-level score bug section)
---

## Problem

Live Venlo test (2026-04-19, post M046/S01 merge) toont een semantische disconnect op gemeente-niveau:

- `KlimaatLayer.tsx` berekent verdict-score met `approvalRate` uit `useGemeenteProfile` = **DSO bekendmakingen-goedkeuring** (155 vergunningen, 98% goedgekeurd).
- Diezelfde gemeente-sidebar toont `JURISPRUDENTIE: 18 rechtszaken, winkans bezwaar 9%` (17/18 afgewezen) uit `useGemeenteAnalysisStatus`.
- Resultaat: gemeente krijgt label **"99 ONTWIKKELKANSRIJK — Soepel klimaat · hoge goedkeuring · korte doorlooptijd"** terwijl 17 van de 18 recente rechtszaken afwijzend eindigden.

**Root cause:** "Makkelijke" vergunningen (dakkapel, verbouw, kleine renovatie) domineren bekendmakingen en worden bijna altijd goedgekeurd. Jurisprudentie bevat alleen disputes die naar de rechter gingen — dat is het echte ontwikkelaar-risico-signaal. Deze twee signalen mengen zonder dev-type filter of weging geeft vertekend beeld.

Zelfde **filter-patroon als RM-1** (M046/S01: `vergunning_succeskans` filterde ongefilterd over alle 9 vergunningstypen) maar op gemeente-niveau i.p.v. parcel-level `score_v3_factors.py`.

## Solution

Niet in M046 scope (= parcel-level score_v3 opschonen). Hoort in:

- **M048 Score v4.0 Frontend Scaling** (voorkeur — raakt frontend rendering), OR
- **M049 Data Sources per Gemeente hub** (als gemeente-aggregator daar centraal wordt)

Aanpak (TBD bij milestone-planning):
1. Splits `approvalRate` in `useGemeenteProfile` in `bekendmakingen_approval_rate` vs `jurisprudence_winkans_rate`.
2. Optional: pas dev-type filter toe op bekendmakingen als de type-classificatie beschikbaar is (vergunningen_bekendmakingen.vergunningstype). Zo niet, bekendmakingen-approval als grof signaal houden.
3. Gemeente-verdict-score combineren: weighted blend van beide signals + dev-filtered jurisprudentie-winkans uit M046/S01 aggregator.
4. Narrative label ("ONTWIKKELKANSRIJK") niet baseren op alleen approval-percentage — ook op jurisprudence-uitkomst meewegen (hoge bekendmakingen-approval + lage winkans-bezwaar = "Gemiddeld, niet soepel").

Ironie: M046/S01 leverde de dev-filtered jurisprudence-data al op (`vergunnings_succeskans` nu dev-gefilterd) — frontend toont die waarde wel in de sidebar maar gebruikt hem NIET in de verdict-score-berekening.

Reference: zie memory `scoring-roadmap-active.md` sectie "Gemeente-level score bug ontdekt (2026-04-19, live Venlo)".

---
created: 2026-04-19T19:10:00.000Z
title: Score v3 weights herijken (vóór M047 cascade-factoren of in M048)
area: scoring
files:
  - backend/app/services/score_v3_factors.py (21 factoren met hardcoded gewichten)
  - backend/app/services/score_v3.py:188 (drempels 60/30 + _POTENTIE_MAX/_RISICO_MAX)
  - ~/.gstack/projects/Romainnoo145-propdex/existing-factors-audit-20260418.md
---

## Problem

Huidige Score v3.0 heeft **21 factoren met hardcoded integer gewichten** die oorspronkelijk
ergens op gebaseerd zijn (internal heuristiek / intuïtie), maar:

- Geen documentatie van waarom specifiek deze gewichten. Waarom is vergunning_succeskans=13 en
  funda_frictie=5? Wat is de bron/rationale?
- M046 heeft aangetoond dat een deel van de factoren silent-neutral retourneert
  (`funda_frictie` 100% sparse, 25% van factoren silent-neutral per audit) — die wegen
  dus effectief nul, maar in de UI wegen ze "op papier" wel mee.
- M047 gaat **nieuwe cascade-factoren** introduceren vanuit woonvisies/beleidsdocumenten.
  Die extra factoren kunnen niet zomaar bovenop de bestaande 21 worden gestapeld —
  dan schuiven alle bestaande percentages en breekt de vergelijkbaarheid met eerdere scans.
- `_POTENTIE_MAX` / `_RISICO_MAX` zijn sommen van individuele gewichten —
  bij wijziging moet elke factor worden bekeken.

## Solution

**Fase 1 — Retroactieve documentatie** (30-60 min):
- Document huidige gewichten in een tabel met: factor, gewicht, categorie, data-bron,
  actieve vs sparse status (uit factoren-audit).
- Markeer welke factoren momenteel "cosmetisch" meewegen (altijd neutral=0.5) vs actief.

**Fase 2 — Herijking-principes vastleggen** (vóór M047 start):
- Moet gewicht proportioneel zijn aan data-dekking? Factor met 5% dekking = lager gewicht dan factor met 95%?
- Moeten categorieën (potentie vs risico) gelijk wegen, of mag risico zwaarder tellen?
- Hoe gaan we om met M047 cascade-factoren — additief (totaal wordt groter) of herverdelend (bestaande weights krimpen)?
- Welke factoren zijn "must-have signalen" (bv. bestemming, vrije_grond) en welke zijn "nice-to-haves"?

**Fase 3 — Implementatie** (M048 candidaat):
- `_POTENTIE_MAX` / `_RISICO_MAX` dynamisch maken op basis van factor-registry
- Gewichten naar config/JSON verplaatsen (niet meer hardcoded)
- Drempels (60/30 in score_v3.py:188) kalibreren tegen percentielen op echte scans
- Backward-compat: oude scans krijgen hun oude score label zolang ze niet rescored zijn

**Niet nu doen:**
- M046 is scope-locked op correctness per factor, niet kalibratie
- M047 moet eerst weten hoeveel nieuwe factoren er komen
- Herijking in vacuüm zonder echte cascade-factoren = nutteloos

**Beste timing:** begin M047 planning, of als eigen slice M048/S01.

**Input benodigd vóór herijking:**
- M046 compleet (S05 + S06 afgerond) zodat we weten welke factoren defensibly correct zijn
- M047 scope bevestigd (hoeveel cascade-factoren erbij)
- Gebruikers-feedback op "wat zou anders moeten wegen"

Reference: memory/scoring-roadmap-active.md + `complete-milestone-landscape-20260418.md`.

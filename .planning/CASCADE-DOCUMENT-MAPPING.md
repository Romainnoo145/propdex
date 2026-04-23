# Cascade Document Mapping — 33 documenten × milestone

Overzicht van alle 33 cascade-documenten, welke factor ze voeden, en in welke milestone ze worden opgepakt. Gebruik dit bestand bij het plannen van M050+.

**Uitgewerkte doc-context staat per milestone in een apart bestand** (`cascade/M050-docs.md` etc.) — laad alleen het bestand voor de milestone waar je aan werkt.

---

## LIVE — al actief, geen nieuwe scoring-pipeline nodig

| # | Document | Voedt factor | Actie |
|---|---|---|---|
| GEM-06 | Vergunning-klimaat | vergunning_succeskans | ✅ via SRU bekendmakingen |
| GEM-07 | Jurisprudentie & AI-analyse | juridisch_klimaat, vergunning_succeskans | ✅ via Rechtspraak.nl pipeline |
| GEM-13 | Beschermd erfgoed | monument | ✅ via RCE API |
| GEM-15 | Bekendmakingen monitoring | juridisch_klimaat (zijdelings) | ✅ via SRU |
| LAND-01 | Omgevingswet & Bbl | vergunning_succeskans, bestemmingswijziging | ✅ indirect via omgevingsplan |
| LAND-06 | RVO subsidies | subsidie-context | ✅ als dossier-referentie |

---

## M047 — Projecttype + Cascade-Infra + POC (actief)

| # | Document | Nieuw factor | Slice |
|---|---|---|---|
| GEM-03 | Woonvisie | woonvisie_match | S06 POC Venlo |

> De volledige cascade-infrastructuur (factor extractor, cache, ARQ re-scoring) die in M047 gebouwd wordt, is de technische basis voor alle onderstaande milestones.

---

## M050 — Cascade Batch 1: Juridisch klimaat

**Detail:** `.planning/cascade/M050-docs.md`

| # | Document | Nieuw factor | Slice |
|---|---|---|---|
| GEM-08 | Raadsinformatie | politiek_klimaat | S01/S02 |
| GEM-09 | Leegstandsverordening | leegstandsdruk | S03 |
| GEM-05 | Huisvestingsverordening | splitsingsrisico | S04 |
| LAND-04 | Woningwet & corporatieregels | segment_fit (niche, sociaal-huur) | S05 (minor) |
| LAND-05 | Asbest & sloopregels | verfijnt asbest → kostencalc | S05 |

---

## M051 — Financieel: Subsidies

**Detail:** `.planning/cascade/M051-docs.md`

| # | Document | Nieuw factor | Slice |
|---|---|---|---|
| GEM-10 | Gemeentelijke subsidies | subsidie_potentie (deel gem.) | S01/S02 |
| PROV-04 | Provinciale subsidies | subsidie_potentie (deel prov.) | S02 (gecombineerd) |
| GEM-11 | Grondprijsbeleid | grondwaarde_fit | S04 |

---

## M054 — Kosten-regelgeving: Welstand + Parkeer

**Detail:** `.planning/cascade/M054-docs.md`

| # | Document | Nieuw factor | Slice |
|---|---|---|---|
| GEM-02 | Welstandsnota | welstand_beperking | S01/S02 |
| GEM-04 | Parkeerbeleid | parkeerdruk | S03/S04 |
| GEM-12 | Duurzaamheidsbeleid | duurzaamheid_kosten | S05 |
| LAND-07 | BENG & energieprestatie | beng_kosten | S05 (gecombineerd) |

---

## M055 — Ruimtelijk: Omgevingsvisie + Ladder + Geo-overlay

**Detail:** `.planning/cascade/M055-docs.md`

| # | Document | Nieuw factor | Slice |
|---|---|---|---|
| GEM-01 | Omgevingsvisie (gemeente) | beleidsalignement | S02 |
| LAND-02 | Ladder duurzame verstedelijking | ladder_risico | S03 |
| PROV-01 | Omgevingsverordening | verfijnt bestemming + hard limits | S04 |
| PROV-02 | Provinciale omgevingsvisie | beleidsalignement_provincie | S02 (gecombineerd) |
| PROV-03 | Woondeals & woningbouwafspraken | woondeal_boost | S05 |

---

## M056 — Erfgoed + Natuur verdieping

**Detail:** `.planning/cascade/M056-docs.md`

| # | Document | Nieuw factor | Slice |
|---|---|---|---|
| GEM-14 | Erfgoedverordening | verfijnt monument (gemeentelijk) | S01 |
| PROV-06 | Provinciaal erfgoed | verfijnt monument (provinciaal) | S02 |
| PROV-05 | Natuur & stikstof (prov.) | stikstof_risico, verfijnt natura2000 | S03 |
| LAND-08 | Stikstof & Natura2000 (landelijk) | referentie-context voor PROV-05 | S03 (gecombineerd) |

---

## M057 — Energie + Mobiliteit

**Detail:** `.planning/cascade/M057-docs.md`

| # | Document | Nieuw factor | Slice |
|---|---|---|---|
| PROV-07 | Energietransitie / RES | energie_context | S01/S02 |
| PROV-08 | Mobiliteitsbeleid (prov.) | mobiliteit_waardering | S03/S04 |

---

## Geen scoring-pipeline — feature/alerting

| # | Document | Reden |
|---|---|---|
| LAND-03 | Nationale Woonagenda | [C] puur context, geen per-parcel signaal |
| LAND-09 | Rijksbeleid monitoring | [C] alerting-feature, geen scoring |
| GEM-16 | Nieuws & beleidsmonitoring | [C] alerting-feature, geen scoring |

---

## Samenvatting per milestone

| Milestone | # docs | Detail |
|---|---|---|
| LIVE nu | 6 | Overlap met bestaande APIs — niks te bouwen |
| M047 (nu) | 1 | Woonvisie → woonvisie_match POC |
| M050 | 5 | Juridisch klimaat: raadsinfo, leegstand, huisvestingsverordening, asbest, woningwet |
| M051 | 3 | Subsidies: gemeente + provincie + grondprijsbeleid |
| M054 | 4 | Kosten-regelgeving: welstand, parkeer, BENG, duurzaamheid |
| M055 | 5 | Ruimtelijk: omgevingsvisie, ladder, verordening, woondeals |
| M056 | 4 | Erfgoed + natuur: erfgoedverordening, prov.erfgoed, stikstof (2× niveaus) |
| M057 | 2 | Energie (RES) + mobiliteit |
| Nooit scoring | 3 | Context/alerting: Woonagenda, rijksbeleid, nieuwsmonitoring |

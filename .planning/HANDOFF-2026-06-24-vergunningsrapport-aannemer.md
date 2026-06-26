# HANDOFF — Propdex pivot: per-adres vergunningsrapport (aannemer → particulier, white-label)

**Datum:** 2026-06-24
**Doel volgende sessie:** dit grondig onderzoeken en een **nieuwe roadmap** maken (weg van de splitsing/scoring-richting).

---

## 1. TL;DR — waar we staan

Propdex kantelt van een map-scoring intelligence-tool naar een **per-adres vergunningsrapport** dat een **aannemer/installateur white-label aan z'n particuliere klant geeft**. De aannemer is koper én distributiekanaal; de particulier is ontvanger. Kern van het product: *"voor dit adres en deze klus — mag dit, wat zijn de regels, wat zijn mijn kansen"*. **Subsidies (inclusief lokale gemeente/provincie-subsidies) zijn een echte, gewenste toevoeging — geen bonus.**

Er is deze sessie een werkende "splitsing"-spine gebouwd (M055/S01), maar op de **verkeerde klus en verkeerde persoon** gericht (splitsing = belegger-taal). De architectuur is herbruikbaar; de inhoud niet.

## 2. De reis deze sessie — besluiten + verworpen paden

**Aanleiding:** founder verloor vertrouwen in oude Propdex (gesprek bij Hauzer = makelaar zei "te veel uitzoekwerk, Brainbay biedt meer"). Data-race is verloren: Brainbay (NVM-transactiedata) en het Omgevingsloket (regels, gratis) zijn referentielagen die je niet verslaat.

**Verworpen kopers (met reden):**
- **Makelaar** → leeft al in Brainbay; thuiswedstrijd, onverslaanbaar. Hauzer (de launching partner) zei nee tegen de categorie.
- **Belegger** → niet als nette groep bereikbaar, overlapt makelaars/ontwikkelaars (al bediend/onbereikbaar), marktgrootte onzeker. Splitsing = belegger-activiteit → afgevallen.
- **Ontwikkelaar** → vereist private/tacit data (eigenaarsintentie, politiek draagvlak) die niet te scrapen is; pijn zit in 2-3 jaar gemeenteproces, niet in een rapport.
- **Pure particulier (B2C direct)** → eenmalige aankoop, te dure acquisitie, gratis Omgevingsloket voor "mag het".

**Gekozen model — B2B2C:** koper = **aannemer/installateur**. Lost distributie op twee manieren op: (1) bereikbaar (45k bedrijven, georganiseerd), (2) brengt z'n eigen klantvraag mee (de particulier loopt al binnen met "kan dit, wat kost het"). Je hoeft de eindklant niet te vinden.

**Het stabiele kern-product dat élke wending overleefde:** per-adres "mag dit / wat zijn de regels / wat zijn mijn kansen", als white-label deliverable van aannemer aan klant. Klus-soort = input; subsidie = toevoeging.

## 3. Marktcijfers (web-geverifieerd deze sessie)

- **Koper bereikbaar:** ~45.000–46.000 installatiebedrijven + zzp (194k werkenden, +60% in 10 jaar). Techniek Nederland ~6.000 leden + isolatie-branches (Isolerend Nederland/VENIN).
- **Vraag groot + aangejaagd:** €14 mld/jr aan woningverduurzaming (2023); doel 1,5 mln woningen verduurzaamd vóór 2030; Nationaal Isolatieoffensief aangekondigd 22-6-2026.
- **Subsidie groot + versnipperd:** ISDE €550 mln (2025) / €511 mln (2026); isolatie-deel €248,8 mln geclaimd 2025. Lokale (gemeente/provincie) subsidies = versnipperd, per regio anders → **dat is de pijn én de echte toevoeging**.
- **Bestaande subsidie-tools:** Milieu Centraal Energiesubsidiewijzer, Regionaal Energieloket, Verbeterjehuis — gratis, consument-gericht. Onderscheid van Propdex = **white-label, per-adres, vergunning + subsidie gecombineerd, aannemer-gebrand** (geen generieke consumenten-lookup).

## 4. Onderzoeksagenda voor de nieuwe roadmap

**A. Eerste klus(sen).** Welke klus geeft een aannemer z'n klant een rapport voor? Kandidaten: dakkapel, uitbouw, opbouw, gevelwijziging, verduurzaming. Criterium: echte vergunning-onzekerheid (welstand / beschermd stadsgezicht / afwijking bestemmingsplan) + de klant weet het niet + subsidie waar relevant. Voorlopige hunch: **dakkapel/uitbouw** (bouwkundige bread-and-butter, echte "mag dit op mijn huis"-twijfel).

**B. Vergunning-core verdiepen.** Per klus → welk beleid (bestemmingsplan/omgevingsplan, **welstandsnota**, monument/beschermd gezicht) + welke jurisprudentie. ⚠️ Welstandsnota-extractie bestaat nog NIET (nu geëxtraheerd: huisvestingsverordening, parkeernormen, woonvisie, omgevingsvisie). Welstand is waarschijnlijk de kern voor dakkapel/uitbouw → nieuwe extractie nodig.

**C. Subsidie-laag (nu een echt spoor, geen bonus).**
- *Licht:* landelijke **ISDE** = regel-gebaseerd, stabiel → databron + mapping (klus → maatregelen + bedrag).
- *Zwaar maar gewenst:* **lokale gemeente/provincie-subsidies per adres.** Onderzoek: bronnen (RVO, Energiesubsidiewijzer-data, gemeente-open-data), of scrapen mag/kan, het onderhoudsmodel (342 gemeenten, constant veranderend). Dit is een echt data-sourcing + onderhoud-vraagstuk; de versnippering is precies wat waarde geeft.

**D. White-label mechaniek + verdienmodel.** Hoe brandt de aannemer het rapport (logo/huisstijl)? Hoe levert hij het aan z'n klant? Prijs: per rapport / abonnement / per lead? Hoe onboard je een aannemer?

**E. Concurrentie-gat echt toetsen.** Hoe goed zijn Energiesubsidiewijzer / Energieloket nu? Is de vergunning+subsidie+white-label-combinatie echt onderscheidend? (Eerder alleen oppervlakkig bekeken.)

**F. Klus-type-architectuur.** Verbouwingstype als config die het beleid-cluster + jurisprudentie + subsidie selecteert — de oude "projecttype-lens", maar nu functioneel i.p.v. gewichten-schuiven.

## 5. Wat al gebouwd is (herbruikbaar, NIET weggooien)

**M055/S01 splitsing-spine** — worktree `/home/klarifai/Documents/klarifai/clientprojects/propdex-m055`, branch `m055-s01-adres-naar-rapport` (8 commits, off main @ 3dd5d7b3, NIET gemerged, READY-TO-DEMO maar verkeerde klus).

Werkende pijplijn (= het herbruikbare deel): **adres → PDOK-lookup → perceel (`ParcelCache`) → beleid-leeslaag (leest extractie uit `FactorExtractionCache`, zónder scoringsmotor) → jurisprudentie-selector (gecureerd, thema-match) → getypt rapport (`SplitsingReport`) → view (4 blokken) → route `/rapport-v2`**. Backend 10/10 tests groen, `npm run check` schoon. Geen scoringsmotor, geen nep-percentage.

Om te hergebruiken: vervang "splitsing/huisvestingsverordening" door de gekozen klus + bijbehorend beleid (bv. welstandsnota), en voeg een subsidie-blok toe. Files: `backend/app/jurisprudentie/`, `backend/app/reports_v2/`, `frontend/src/{lib/reportsV2.ts,hooks/useSplitsingReport.ts,components/reportsV2/,routes/_authenticated/rapport-v2*}`.

Spec/plan: `.planning/SPEC-adres-naar-rapport-2026-06-23.md`, `.planning/PLAN-adres-naar-rapport-splitsing-2026-06-23.md`. Ledger: `propdex-m055/.superpowers/sdd/progress.md`.

⚠️ Smoke-check-bevinding (relevant): Venlo's huisvestingsverordening heeft GEEN splitsingsvergunningplicht, wél opkoopbescherming (€306k WOZ, 20 buurten) — bevestigt dat splitsing de verkeerde klus was. De report-assembler las opkoopbescherming niet eens uit.

## 6. Vaste principes (niet opnieuw bevragen)

- Niet de data-race met Brainbay spelen. Niet "beter dan Omgevingsloket op regels" — je zit erbóvenop (oordeel + workflow + per-adres samenstellen).
- GEEN nep-percentage. Jurisprudentie-duiding altijd geverifieerd tegen de bron (rechtspraak.nl ECLI).
- Koper = aannemer/installateur (bereikbaar + brengt vraag mee). Niet belegger/makelaar/particulier-direct.
- Per-adres vergunningsinformatie = core. Subsidie incl. lokaal = echte toevoeging.

## 7. Aanbevolen eerste stap volgende sessie

`/office-hours` of brainstorm op de twee scherpste open punten: **(A) eerste-klus-keuze** en **(D) white-label + verdienmodel**. Daarna een **nieuwe milestone-roadmap** die M055 herdefinieert: weg van splitsing/scoring, naar het per-adres vergunning+subsidie-rapport voor aannemers. Subsidie-laag (C, incl. lokaal) als een eigen, serieus spoor erin.

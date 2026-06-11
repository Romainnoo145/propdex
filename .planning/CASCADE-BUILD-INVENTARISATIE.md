# Cascade-Build Inventarisatie — data × waarde × effort (2026-06-11)

Prioritering van de resterende cascade-documenten uit `.planning/CASCADE-DOCUMENT-MAPPING.md`,
als eerste stap van de cascade-build campagne (vóór Hauzer-demo zoveel mogelijk cascades live,
incrementeel). Venlo/Limburg-databeschikbaarheid is per bron **geverifieerd via web** (2026-06-11),
niet aangenomen.

> ⚠️ De milestone-nummers in CASCADE-DOCUMENT-MAPPING.md (M050/M051/M054-M057) zijn
> pre-renumbering. Cascade-batches = M053-M059. Dit document vervangt die batch-indeling
> door een prioriteit op data × waarde × effort.

---

## Assen

- **Data (Venlo/Limburg, geverifieerd)**: ✓✓ vers + rijk · ✓ aanwezig · ⚠ gedateerd of snel
  verouderend · ✗ bestaat niet
- **Waarde**: bijdrage aan score-differentiatie + voelbaarheid voor de Hauzer-persona
  (vastgoedontwikkelaar Venlo). H/M/L.
- **Effort**: **S** = puur het gelockte S07-patroon (PDF upload → typed extraction →
  randvoorwaarden + editorial drill-down + cascade-score, zoals woonvisie/omgevingsvisie) ·
  **M** = S07 + extra's (geo-bijlagen, regelengine, tweede document) · **L** = ander bron-type
  (API, geo-lagen, feeds) → vereist brainstorm + nieuwe infra.

## Al live (geen werk)

8 scoring-cascades actief: 6 API-gedreven (vergunning_succeskans, juridisch_klimaat, monument,
bekendmakingen, omgevingswet-indirect, RVO-referentie) + 2 LLM-cascades op prod
(woonvisie_match 12 gew., beleidsalignement 10 gew., beide GM0983).

---

## Matrix — resterende cascades

### Wave 1 — pure S07-herhaling, verse Venlo-docs, hoge ontwikkelaar-waarde

| Doc | Factor (cat.) | Venlo-data (geverifieerd) | Waarde | Effort |
|---|---|---|---|---|
| GEM-05 Huisvestingsverordening | `splitsingsrisico` (risico) | ✓✓ **Huisvestingsverordening Venlo 2026** (CVDR759788, effectief 01-07-2026, incl. opkoopbescherming) | **H** — splitsing/onttrekking/opkoopbescherming raakt elke transformatie-businesscase | S |
| GEM-11 Grondprijsbeleid | `grondwaarde_fit` (potentie) | ✓✓ **Grondprijzen 2026** + Nota Grondbeleid en Vastgoed 2024/2025 (vastgoed.venlo.nl, jaarlijks) | **H** — concrete €/m² banden; direct residueel rekenbaar | S |
| GEM-04 Parkeerbeleid | `parkeerdruk` (risico) | ✓ **Parkeerverordening Venlo 2025** (CVDR728054) + Uitvoeringsplan Parkeren. ⚠ check bij bouw: parkeernormén voor ontwikkelingen kunnen in apart normdocument/omgevingsplan zitten (ontwikkel- vs. reguleringsparkeren niet vermengen) | **H** — elke ontwikkeling raakt parkeernormen | S/M |
| PROV-03 Woondeal | `woondeal_boost` (potentie) | ✓✓ **Woondeal Limburg 2022-2030** (PDF, ondertekend 2023) — **noemt Venlo expliciet: 2.718 woningen** | **M/H** — trianguleert nationale→regionale→lokale opgave; versterkt het woonvisie-verhaal in de demo met harde aantallen | S |

### Wave 2 — S07-patroon maar gedateerde of complexere bron

| Doc | Factor (cat.) | Venlo-data | Waarde | Effort |
|---|---|---|---|---|
| GEM-02 Welstandsnota | `welstand_beperking` (risico) | ⚠ Welstandsnota Venlo **2013** (PDF op kaarten.venlo.nl, niet in CVDR; mogelijk herzien — eerst actualiteit checken) | **H** — ontwerpvrijheid + doorlooptijd, dagelijks voelbaar | S/M (gebiedsregimes → evt. geo) |
| PROV-02 Prov. omgevingsvisie | `beleidsalignement_provincie` (potentie) | ⚠ **POVI 2026** door GS vastgesteld maar PS-besluit pas sept 2026; geldende versie = POVI 2021 | **M** — zelfde patroon als gemeente-omgevingsvisie (maximaal hergebruik; upload-modal ondersteunt provincie-niveau al sinds M053/S02) | S |
| GEM-12 Duurzaamheidsbeleid | `duurzaamheid_kosten` (risico) | ✓ **Transitievisie Gebouwde Omgeving 2.0** (2023, herzien vanaf TVW 2021) | **M** — warmte-optie per wijk voedt verduurzamingskosten | M (familie van docs; minimaal warmte- en adaptatie-laag scheiden) |
| PROV-01 Omgevingsverordening | verfijnt `bestemming` + hard limits (risico) | ✓ **Omgevingsverordening Limburg** (CVDR705183; wijziging 2026 in voorbereiding) | **H** — harde provinciale limits (grondwaterbescherming, stiltegebieden) | M/L (tekst + geo-zones) |
| GEM-14 Erfgoedverordening | verfijnt `monument` (risico) | ✓ **Erfgoedverordening Venlo 2024** (CVDR706348) | **L/M** — verfijning van bestaande RCE-factor, geen nieuwe factor | S (optionele quick win) |

### Wave 3 — ander bron-type; brainstorm + nieuwe infra vereist

| Doc | Factor (cat.) | Venlo-data | Waarde | Effort |
|---|---|---|---|---|
| GEM-10 + PROV-04 Subsidies | `subsidie_potentie` (potentie) | ✓ Venlo: LAI, Energievoucher, Stimuleringslening (venlo.nl/subsidies) · Limburg: o.a. "flexibele inzet ondersteuning woningbouw 2025-2027" | **H** voor demo (directe €) | M/L — budgetten/plafonds verouderen sneller dan verordeningen; actualiteitslaag nodig; Vindsubsidies-partnership was bewust uitgesteld |
| GEM-08 Raadsinformatie | `politiek_klimaat` (potentie) | ✓ Venlo op Open Raadsinformatie; gemeenteraad.venlo.nl (migratie 2022, iBabs-archief ervoor) | **M/H** — acquisitie-verhaal ("gemeente is pro-woningbouw") | **L** — ORI API + classificatie over continue stroom; géén PDF-cascade |
| PROV-05 + LAND-08 Stikstof | `stikstof_risico` (risico) | ✓ Limburgs Offensief Stikstof (2025) + AERIUS-kaartlagen (WMS/WFS) | **M/H** — maar `natura2000`-factor bestaat al (afstand); dit verfijnt | **L** — geo-stack werk |
| LAND-07 BENG | `beng_kosten` (risico) | ✓ landelijk (RVO-normen statisch + EP-Online API) | **M** | M/L — regelengine + API, geen cascade-extractie |
| LAND-02 Ladder | `ladder_risico` (risico) | ✓ landelijk (Bkl art. 5.129g + jurisprudentie-feed) | **M** | M — uitbreiding bestaande Rechtspraak-pipeline |
| LAND-04 Woningwet | `segment_fit` (potentie) | ✓ landelijk, statisch | **L/M** — niche (corporatie-samenwerking) | S/M |
| LAND-05 Asbest/sloop | verfijnt `asbest` (risico) | ✓ landelijk (Bbl h7) | **M** — verfijnt bestaande factor | M — regelengine op bouwjaar/functie |

### Parkeren / afvallers

| Doc | Reden |
|---|---|
| GEM-09 Leegstandsverordening | ✗ **Venlo heeft er bewust geen** (kiest sinds 2014 actief tegen het instrument; rapport 2022). Cascade onbouwbaar voor de launching partner — alleen relevant bij latere gemeenten die er wél een hebben. |
| PROV-07 RES | RES 1.0 NML (2021) bestaat, maar weinig per-perceel signaal voor woningontwikkeling. Context, geen score. |
| PROV-08 Mobiliteit | Beleidskader "Bereikbaar en toegankelijk Limburg 2024-2027" bestaat (PDF), maar lage per-perceel waarde. |
| PROV-06 Prov. erfgoed | Erfgoedkaart Limburg = interactieve geo-viewer, geen document; lage toegevoegde waarde naast RCE. |
| LAND-03 / LAND-09 / GEM-16 | Waren al "nooit scoring" (context/alerting). |

---

## Tweede as: schaalpad (uit `roadmap_documentatie_propdex.md` §5-6)

De data-bronnen-doc voegt naast de Venlo-demo-as een **dekking-as** toe (investor-verhaal:
"kortste weg naar 50% extra dekking" = configuratie-uitrol, geen nieuwe architectuur):

- **Auto-ingest (KOOP SRU/CVDR) ondersteunt vandaag al** `omgevingsvisie` +
  `huisvestingsverordening` (`backend/app/policy_documents/auto_ingest.py`,
  `AUTO_INGESTIBLE_DOCUMENTS`) — superadmin-only sinds M053/S08b. Wave-1-cascade
  **huisvestingsverordening heeft dus al een schaalpad naar 342 gemeenten**; de slice hoeft
  alleen de factor-extractie + scoring te bouwen.
- **Zelfde-techniek-uitbreidingen** (CVDR-term toevoegen aan de dict): welstandsnota,
  woonvisie, parkeernormen, erfgoedverordening, grondprijzenbrief (deels), prov.
  omgevingsverordening/-visie. Per Wave-1/2-slice: overweeg de CVDR-zoekterm direct mee te
  nemen waar dekking goed is.
- **Handmatig blijft** (lage standaardisatie / buiten CVDR): woonvisies deels, parkeerbeleid
  deels, grondprijsbeleid, duurzaamheidsbeleid (TVW-familie), welstand buiten CVDR — doc
  adviseert top-50 gemeenten als handmatige scope.
- **Partnerships ipv zelf bouwen** (doc §6.4): Vindsubsidies (subsidies), NVM/brainbay of
  Kadaster (transacties/prijzen) — bevestigt dat Wave-3 `subsidie_potentie` op een
  partner-beslissing wacht, niet op een bouw-slice.
- ⚠️ Eén correctie op doc §6.2: leegstandsverordening als zelfde-techniek-uitbreiding klopt
  landelijk (±30 gemeenten via CVDR) maar niet voor de Venlo-demo (Venlo heeft er bewust geen).

**Bouwspec per slice:** de per-bron secties in `roadmap_documentatie_propdex.md`
("Datavelden die we extraheren" + "Business-regels" + "Concreet actieplan") zijn de
extractieschema-seed per cascade — gebruik die als input voor het `input_schema` van de
factor-extractor, naast de doc-context in `.planning/cascade/Mxxx-docs.md`.

---

## Aanbevolen bouwvolgorde

1. **Wave 1 (4 cascades, allemaal S07-patroon):** huisvestingsverordening → grondprijsbeleid →
   parkeerbeleid → woondeal. Elke cascade = 1 slice volgens het gelockte patroon (S07) + registry-
   rebalance binnen de categorie (zoals M053/S01 deed; som per categorie blijft 100).
2. **Wave 2 (3-5 cascades):** welstand (na actualiteits-check 2013-nota), POVI (beslis: 2021 nu
   of wachten op 2026), TVW 2.0, omgevingsverordening Limburg; erfgoedverordening als optionele
   quick win.
3. **Wave 3:** vergt eerst brainstorm per bron-type (ORI API, AERIUS geo, subsidie-actualiteit,
   EP-Online). Niet starten zonder design-beslissing.

**Bottleneck-bevestiging:** de Venlo-data blijkt GEEN bottleneck voor Wave 1+2 — 8 van de 9
gemeentedocumenten bestaan en zijn vindbaar (vaak CVDR). De echte bottleneck zit in Wave 3
(bron-typen waarvoor het S07-patroon niet volstaat).

**Weights-kanttekening:** elke nieuwe factor herverdeelt de categorie-gewichten (som=100).
Wave 1 voegt 2 risico-factoren (splitsingsrisico, parkeerdruk) en 2 potentie-factoren
(grondwaarde_fit, woondeal_boost) toe → 2 rebalances, elk met regression-guard-update
(zoals factor-count guard 25→26 in M053/S01).

---

## Geverifieerde bron-URLs (2026-06-11)

| Document | URL |
|---|---|
| Huisvestingsverordening Venlo 2026 | https://lokaleregelgeving.overheid.nl/CVDR759788 |
| Grondprijzen Venlo 2026 | https://vastgoed.venlo.nl/grondprijzen-gemeente-venlo-2026 |
| Parkeerverordening Venlo 2025 | https://lokaleregelgeving.overheid.nl/CVDR728054/1 |
| Woondeal Limburg 2022-2030 | https://www.limburg.nl/publish/pages/9413/woondeal_limburg.pdf |
| Welstandsnota Venlo (2013) | https://kaarten.venlo.nl/files/attachments/welstandsnota_gemeente_venlo_2.pdf |
| Transitievisie Gebouwde Omgeving 2.0 | via morgeninvenlo.nl + raadsinformatie |
| Erfgoedverordening Venlo 2024 | https://lokaleregelgeving.overheid.nl/CVDR706348/1 |
| Omgevingsverordening Limburg | https://lokaleregelgeving.overheid.nl/CVDR705183 |
| POVI Limburg | https://www.limburg.nl/onderwerpen/omgeving/povi-ovl/ |
| Subsidies Venlo / Limburg | https://www.venlo.nl/subsidies · https://www.limburg.nl/loket/subsidies/actuele-subsidies/subsidieregelingen-2/ |
| Limburgs Offensief Stikstof | https://www.limburg.nl/onderwerpen/natuur-en-landschap/actuele-projecten/limburgs-offensief-stikstof/ |
| RES Noord- en Midden-Limburg | https://www.resnml.nl/ |

Extra vondst voor het Hauzer-verhaal: **Limburg Centraal** — urbanisatiestrategie rond 6
intercitystations waaronder Venlo, 30.000+ woningen (Verstedelijkingsconcept 2026 staat in het
Venlose raadsinformatiesysteem). Geen cascade, wél demo-munitie.

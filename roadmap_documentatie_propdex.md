# Data-Bronnen Overzicht — Propdex

## 1. Hoe Propdex bronnen verbindt

### 1.1 Doel van dit document
<!-- Korte uitleg wat dit document is en voor wie -->

### 1.2 Cascade-architectuur (Rijk → provincie → gemeente → perceel)
<!-- Uitleg over inname, AI-parsing, cascade, scoring -->

### 1.3 Overzicht broncategorieën
- Landelijk – 9 bronnen
- Provincie – 8 bronnen
- Gemeente – 16 bronnen
- Monitoring & signalering
- Externe data- en API-partners

---

## 2. Landelijk — 9 bronnen

Landelijk beleid vormt het fundament dat via de cascade doorwerkt naar alle 342 gemeentes: wetten, nota’s en subsidieregelingen die voor heel Nederland gelden en automatisch mee-koppelen aan elk perceel.[file:1] Vandaag zijn Omgevingswet & Bbl en RVO-subsidies live; Woningwet, asbestregels, BENG, stikstof en Rijksmonitoring volgen via dezelfde infrastructuur.[file:1]

---

### 2.1 Omgevingswet & Bbl — omgevingswet

#### Korte beschrijving

De Omgevingswet met de vier AMvB’s (waaronder het Besluit bouwwerken leefomgeving, Bbl) vormen de landelijke ruggengraat voor alle bouw- en gebruiksactiviteiten in de fysieke leefomgeving.[file:1][web:14][web:37] Het Bbl bevat de technische rijksregels voor bouwwerken op het gebied van veiligheid, gezondheid, bruikbaarheid en duurzaamheid (energiezuinigheid en milieu) en vervangt het oude Bouwbesluit 2012.[web:16][web:32][web:5]

#### Inhoudelijke scope voor Propdex

- Biedt het **juridische minimumkader**: aan welke technische eisen een project altijd moet voldoen (constructieve veiligheid, brandveiligheid, gezondheid, energieprestatie, bruikbaarheid).[web:16][web:35]
- Vormt de **rijkslaag** in de cascade: regels die overal gelden en slechts lokaal aangescherpt mogen worden (bijv. extra duurzaamheidseisen).[file:1][web:14]
- Voedt de **Potentie- en Risicoscore** met generieke risico’s bij verbouw/transformatie (brand, constructie, toegankelijkheid, energieprestatiegap).[file:1][web:35]

#### Datavelden die we extraheren

A. Activiteiten (vergunning/melding):

- Type activiteit: technische bouwactiviteit (nieuwbouw/verbouw), sloopactiviteit, gebruik/brandveilig gebruik, in stand houden bouwwerk.[web:33][web:35][web:37]
- Vergunningplicht / meldingsplicht / vergunningvrij per activiteit, inclusief drempels (oppervlakte, tijdelijke duur, geringe bouwwerken).[web:33][web:37]

B. Kwaliteitseisen (per functie en bouwfase):

- Brandveiligheid: compartimentering, vluchtwegen, brandwerendheid, alarmering per gebruiksfunctie en per fase (nieuwbouw/bestaand/verbouw).[web:5][web:35][web:39]
- Constructieve veiligheid, gezondheid (daglicht, ventilatie, geluid), bruikbaarheid/toegankelijkheid, duurzaamheid/energie (verwijzingen naar BENG/Omgevingsregeling).[web:16][web:35][web:11]

C. Context:

- Gebruiksfuncties (wonen, kantoor, bijeenkomst, industrie, etc.).[web:42]
- Bouwfase (nieuwbouw, verbouw, bestaande bouw).[web:40]
- Gebruiksniveau (publiek toegankelijke gebouwen, bijzondere functies).[web:39][web:42]

#### Bronnen & automatisering

- **Bronnen**: wetten.overheid.nl / Basiswettenbestand (BWB) voor Omgevingswet, Bbl, Bal en Bkl.[file:1][web:34][web:41]
- **Ingest**: volledige automatische inname via BWB XML/REST-API, gekoppeld aan KOOP-infrastructuur.[file:1][web:38]
- **Update**: mutatiegedreven via Basiswettenbestand na elke Staatsblad-publicatie (dagelijks/wekelijkse jobs).[file:1][web:34]

#### Business-regels / productlogica

- Rijksregels-widget op perceelpagina: per planvariant tonen welke rijksactiviteiten spelen en of ze vergunning- of meldingsplichtig zijn.[web:33][web:37]
- Minimumniveau-check: vlaggen “Bbl-achterstand vermoed” bij bestaande bouw waar brand/constructie/gezondheid vermoedelijk onder de minimumeisen ligt.[web:35]
- Bouwfase-bewust: altijd expliciet maken of het om nieuwbouw, verbouw of bestaande bouw gaat, omdat Bbl-eisen per fase verschillen.[web:40]

#### Risico’s / edge cases

- Overgangsrecht en bruidsschat (oude regels die tijdelijk in omgevingsplannen hangen) zorgen voor samenloop; Propdex moet onderscheid maken tussen rijksregels en omgevingsplanregels.[web:37]
- Veel Bbl-voorschriften zijn prestatie-eisen; Propdex mag ze niet presenteren alsof het volledige NEN-berekeningen uitvoert.[web:5][web:39]
- Samenloop met Bal/Bkl: duidelijk markeren welke eisen uit welke AMvB komen.[web:37]

#### Concreet actieplan (dev/data)

1. Datamodel voor rijksregels uitbreiden met velden `activity_type`, `permit_type`, `use_function`, `building_phase`, `topic`, `summary`.
2. AI-parser templates per thema (brand, constructie, gezondheid, energie) configureren op BWB-XML.[file:1]
3. Rekenservice bouwen die voor een plan (locatie + gebruik + fase) relevante Bbl-artikelen selecteert en als “regels-pakket” teruggeeft.
4. UI-component “Rijksregels (Omgevingswet/Bbl)” toevoegen met compacte samenvatting en links naar wetten.overheid.nl.[web:16][web:41]

---

### 2.2 Ladder duurzame verstedelijking — ladder-verstedelijking

#### Korte beschrijving

De Ladder voor duurzame verstedelijking (artikel 5.129g Bkl) verplicht bij **nieuwe stedelijke ontwikkelingen** tot een onderbouwing van de behoefte en een ruimtelijke afweging van de locatiekeuze.[file:1][web:49] De Ladder is een instructieregel in het Besluit kwaliteit leefomgeving (Bkl) en moet worden toegepast bij omgevingsplannen en vergunningen voor stedelijke ontwikkelingen.[web:49][web:46]

#### Inhoudelijke scope voor Propdex

- Geeft per plan aan of de ontwikkeling **Ladder-plichtig** is en waar de risico’s in de motivering zitten (behoefte, locatieafweging).[file:1][web:49][web:50]
- Biedt een **RvS-risico-indicator** door jurisprudentie over Ladder-uitspraken te analyseren (hoe vaak en waarom plannen sneuvelen).[file:1][web:47][web:56]
- Verbindt landelijke Ladder-regel met regionale/gemeentelijke beleidsdocumenten (Woondeals, woonvisies, omgevingsvisies, omgevingsplannen).[file:1][web:45][web:49]

#### Datavelden die we extraheren

A. Applicatie Ladder:

- `is_stedelijke_ontwikkeling` (ja/nee), op basis van omvang/functie.[web:49][web:51]
- `binnen_bestaand_stedelijk_gebied` (ja/nee) + referentie naar BSG-definitie/kaart.[web:49][web:45]
- `Ladder_plichtig` (ja/nee) als afgeleid veld.[web:49][web:50]

B. Trede 1 – Behoefte:

- `type_behoefte` (kwantitatief/kwalitatief), `bron_behoefte` (Woondeals, woonvisie, marktstudies).[web:49][web:52]
- `mate_van_behoefte_onderbouwing` (sterk/matig/zwak) en `risico_trede1` (laag/midden/hoog), afgeleid uit jurisprudentiepatronen.[web:47][web:56]

C. Trede 2 – Locatieafweging:

- `binnen_bestaand_stedelijk_gebied`, `beschouwing_alternatieve_locaties_ja_nee`, `bereikbaarheid_en_milieu_afgewogen`.[web:49][web:46][web:51]
- `risico_trede2` (laag/midden/hoog).

D. Jurisprudentie-features:

- Per uitspraak: `uitspraak_type`, `uitkomst`, `reden_vernietiging` (trede1/trede2), `betrokken_gemeente/regio`.[web:47][web:56]

#### Bronnen & automatisering

- Artikel 5.129g Bkl via wetten.overheid.nl + BWB.[file:1][web:49]
- InfoMil/IPLO-handreiking en samenvatting als kennisbasis.[file:1][web:52][web:55]
- Jurisprudentie via rechtspraak.nl (bestaande jurisprudentie-feed) + IPLO/overzichtsuitspraak Ladder.[file:1][web:47][web:56][web:53]

Automatisering:

- 1x handreiking + Bkl-artikel uploaden in AI-parser als “Ladder knowledge pack”.
- Rechtspraak-stroom uitbreiden met filter op “Ladder”/“duurzame verstedelijking”/art. 5.129g Bkl.[file:1][web:47][web:56]
- Aggregatie per gemeente/regio: aantallen zaken, % vernietigd, topvernietigingsredenen.[file:1][web:47]

#### Business-regels / productlogica

- Ladder-badge bij plannen: “Ladder-plichtig (indicatief)” of “waarschijnlijk niet Ladder-plichtig” o.b.v. programma/omvang/locatie.[web:49][web:50]
- Rapportblok “Ladder duurzame verstedelijking”: samenvatting trede 1 en 2 + jurisprudentie-snippet (x zaken, y% vernietigd, topredenen).[web:47][web:45]
- Ladder-risicoscore koppelen aan Potentie-/Risicoscore (hoog bij zwakke behoefte/locatieonderbouwing en ongunstige jurisprudentie).[file:1][web:47]

#### Risico’s / edge cases

- Ladder gaat over **nieuwe stedelijke ontwikkeling** (kan ook binnen BSG zijn), niet alleen “buiten bestaand stedelijk gebied” zoals je huidige tekst suggereert.[file:1][web:49][web:50][web:51]
- Niet elke planwijziging is Ladder-plichtig; Propdex moet altijd met disclaimers werken (“indicatie, geen juridisch oordeel”).[web:46][web:47]
- Behoefte-onderbouwing kan verouderen; Propdex moet duidelijk maken op welke jaargang (Primos/regionale studies) de cijfers zijn gebaseerd.[web:47][web:56]

#### Concreet actieplan (dev/data)

1. Artikel 5.129g Bkl + handreiking uploaden en AI-parser instructies voor trede1/trede2-labels configureren.
2. Jurisprudentie-pijplijn uitbreiden met Ladder-filter en extra velden `trede1/2`, `reden_vernietiging`, `betrokken_gemeente`.
3. Aggregatietabel `ladder_stats` bouwen en Ladder-risicoscore integreren in Potentie-/Risicomodel.
4. UI-blok “Ladder” toevoegen op plandetail/due diligence met badge, trede1/2-beoordeling en jurisprudentie-snippet.

---

### 2.3 Nationale Woon- en Bouwagenda — nationale-woonagenda

#### Korte beschrijving

De Nationale Woon- en Bouwagenda (2022) is het landelijke beleidskader waarmee het Rijk de regie op de volkshuisvesting aanscherpt, met als doel **900.000 extra woningen tot en met 2030** en richting 100.000 woningen per jaar in productie.[file:1][web:60][web:62][web:9][web:67] Op basis van de Primos-prognose 2023 is de woningbouwopgave herijkt naar **981.000 woningen tot en met 2030**; dat is een behoeftecijfer, geen nieuw expliciet politiek doel.[web:3][web:65][web:68]

#### Inhoudelijke scope voor Propdex

- Levert de **nationale contextlaag**: totale nieuwbouwdoelstelling, aandeel betaalbaar en sociaal, en prioriteiten per segment/doelgroep.[file:1][web:62][web:9]
- Verbindt de landelijke doelen met regionale Woondeals en gemeentelijke woonvisies, zodat Propdex kan laten zien of een project past binnen de afgesproken opgave.[file:1][web:66][web:64]

#### Datavelden die we extraheren

A. Nationale doelen:

- `nationaal_doel_woningen_2030` = 900.000 (beleidsdoel).[web:60][web:62][web:9][web:67]
- `streef_aandeel_betaalbaar` ≈ 2/3 van de nieuwbouw.[web:9][web:66]
- `streef_aandeel_sociaal` ≈ 30% sociale huur in voorraad/nieuwbouw (richtpercentage).[web:62][web:66]
- `bouwproductie_doel_per_jaar` ≈ 100.000 woningen.[web:9][web:61]

B. Behoefte/prognose:

- `woningbehoefte_2030_primos_2023` = 981.000 woningen nodig tot 2030 om tekort naar ca. 2% terug te brengen.[web:3][web:65][web:68]

C. Segmenten en doelgroepen:

- Segmentdoelen (sociaal, middenhuur/betaalbaar, vrij, koop/huur).[web:62][web:66]
- Doelgroepen: aandachtsgroepen, ouderen, starters, studenten.[web:62][web:66][web:64]

#### Bronnen & automatisering

- Nationale Woon- en Bouwagenda + Programma Woningbouw (hoofddocumenten).[file:1][web:9][web:67]
- Officiële nieuws/duiding over 900.000 en 981.000 (Rijk, Primos).[web:60][web:3][web:63][web:68]

Automatisering:

- Handmatige upload van agenda + programma’s in AI-parser; extraction van doelen, segmentverdeling en doelgroepaccenten.[file:1]
- Jaarlijkse check op nieuwe Primos-prognose en eventuele herijking van de opgave.[web:63][web:68]

#### Business-regels / productlogica

- Contextwidget op regio/provincie/gemeentepagina: “Nationaal doel 900k / behoefte 981k; aandeel betaalbaar en sociaal.”[web:60][web:3][web:62][web:66]
- Alignment-score per project: past het woningprogramma (segmenten/prijzen) bij de landelijke beleidsrichting (meer betaalbaar/sociaal)?
- Ladder trede 1: nationale cijfers + Woondeals + woonvisies vormen samen Propdex’ behoeftebasis.[file:1][web:49][web:66]

#### Risico’s / edge cases

- Verwarring 900k (beleidsdoel) vs. 981k (behoefte); Propdex moet beide expliciet labelen.[file:1][web:3][web:60]
- Segmentdoelen per regio/gemeente zitten vooral in Woondeals en woonvisies; landelijke agenda blijft globaal.[web:66][web:64]

#### Concreet actieplan (dev/data)

1. Tabel `nationaal_volkshuisvestingsbeleid` met doelen, segmenten en doelgroepen; tabel `woningbehoefte_scenario` voor Primos-series.[web:63][web:68]
2. AI-parser trainen op thema’s (betaalbaarheid/beschikbaarheid/doelgroepen/regie) en kernindicatoren per thema.
3. Endpoints bouwen die voor een regio de “triangulatie” tonen: nationaal doel → Woondeal-opgave → woonvisie-lokale opgave.[file:1][web:66][web:64]
4. UI-component “Nationale Woon- en Bouwagenda” integreren in kaart/rapport.

---

### 2.5 Asbest- & sloopregels — asbest-sloop

#### Korte beschrijving

Asbest- en sloopregels bepalen hoe asbest in bouwwerken moet worden geïnventariseerd en verwijderd bij sloop en renovatie, en welke meld- en certificatieplichten daarbij gelden.[file:1][web:149][web:152] Hoofdstuk 7 Bbl regelt sloopmelding, inventarisatieplicht, uitvoering en eindbeoordeling; Asbestverwijderingsbesluit en Arboregelgeving vullen dit aan, terwijl SC‑530 (asbestverwijdering) en SC‑540 (inventarisatie) het certificatiestelsel invullen.[file:1][web:146][web:151][web:157][web:147]

#### Inhoudelijke scope voor Propdex

- Bepaalt of bij een pand (bouwjaar/typologie) relevante **asbestrisico’s** bestaan en hoe zwaar de sanering is (risicoklasse, meldingsplicht, gecertificeerde bedrijven).[file:1][web:149][web:147]
- Voedt Risicoscore en planning: inventarisatie, melding, sanering en vrijgave kosten tijd en geld; vertragingen hier kunnen de business case raken.[file:1][web:146][web:150]

#### Datavelden die we extraheren

- `bouwjaar_risico_asbest` (pre/post 1994) en `functierisico` (utiliteit/industrie) → `risico_score_asbest`.[file:1][web:156][web:159]
- `sloopmelding_verplicht` (ja/nee) en `melding_termijn_dagen` (meestal 28 dagen).[file:1][web:150][web:152]
- `asbestinventarisatieplicht` (ja/nee) conform Bbl.[web:149][web:152]
- `risicoklasse` (1, 2, 2A) en afgeleide verplichtingen (gecertificeerd bedrijf, eindbeoordeling).[web:147][web:146][web:149]
- `SC_530_verplicht` en `SC_540_verplicht` voor verwijdering/inventarisatie.[web:148][web:151][web:157]

#### Bronnen & automatisering

- Bbl hoofdstuk 7 + Asbestverwijderingsbesluit via BWB/wetten.overheid.nl.[file:1][web:149][web:146]
- IPLO-pagina’s “Verwijderen asbest” en “Overzicht asbestregelgeving” voor structuur en duiding.[web:146][web:149][web:152]
- Arbeidsinspectie en Ascert voor certificatieschema’s.[web:147][web:151][web:157]

Automatisering:

- Annotatie van Bbl h7-artikelen in de bestaande BWB-ingest, met labels rond melding, inventarisatie, uitvoering, eindbeoordeling.
- Regelengine die op basis van plan/gebouwkenmerken indicatief bepaalt: melding noodzakelijk, inventarisatieplicht, risicoklasse-indicatie, certificatieplicht.

#### Business-regels / productlogica

- Asbest-badge op pand: “Verhoogd asbestrisico (bouwjaar vóór 1994)” + korte uitleg.[file:1][web:149][web:156]
- Scenario-engine die bij sloop/ingrijpende renovatie automatisch het standaardproces en een grove kosten-/doorlooptijdinschatting toont.[web:150][web:146][web:147]
- Risicoscore-component “Asbest & sloop” die zwaarder weegt bij oude utiliteitsbouw en minder bij recente of al gesaneerde panden.

#### Risico’s / edge cases

- Asbest is niet automatisch een showstopper; risico zit vooral in **ingrepen** (sloop/renovatie) en blootstelling, niet in enkel aanwezig materiaal.[web:150][web:156]
- Regelgeving is een samenspel van Bbl, Asbestverwijderingsbesluit, Arbeidsomstandigheden- en milieurecht; Propdex focust vooral op de bouw/slooplijn.[web:149][web:152][web:159]
- Risicoklasse wordt door gecertificeerde partijen bepaald via modellen; Propdex kan alleen indicatief zijn.[web:147][web:153]

#### Concreet actieplan (dev/data)

1. Bbl h7-artikelen expliciet annoteren in rijksregels-datamodel (asbest/sloop).[file:1]
2. Simpel asbestrisicomodel bouwen op basis van bouwjaar/functie + optionele inventarisatiedata.
3. Scenario-engine “sloop/renovatie” koppelen aan melding/inventarisatie/certificatie-vereisten.
4. UI-sectie “Asbest & sloop” op perceel/rapport toevoegen met 3–5 bullets over risico, verplichtingen en kostenindicatie.

---

### 2.6 RVO subsidies & financiering — rvo-subsidies

#### Korte beschrijving

RVO voert namens verschillende ministeries een groot aantal **subsidie- en financieringsregelingen** uit voor verduurzaming, energie, innovatie en gebiedsontwikkeling.[file:1][web:191][web:187] Voor vastgoed zijn vooral relevant: ISDE (eigenaren, kleine gebruikers), SVVE (VvE’s), SVOH (huurwoningen), DUMAVA (maatschappelijk vastgoed) en diverse energie-innovatieregelingen; deze zijn als open data beschikbaar in de dataset “Subsidies en financiering RVO.nl”.[web:190][web:191][web:195]

#### Inhoudelijke scope voor Propdex

- Biedt per perceel/project inzicht in **welke landelijke subsidies en financieringen** potentieel van toepassing zijn, op basis van gebruiksfunctie, eigenaarstype, bouwjaar en energielabel.[file:1][web:190][web:188]
- Voedt de rapportsectie “Financieel” en de Action Items in het perceeldossier met concrete regelingen (naam, maatregeltype, budget, looptijd, deadlines) zodat ontwikkelaars en eigenaren sneller kunnen acteren.[file:1][web:187][web:191]

#### Datavelden die we extraheren

A. Regeling-metadata (uit RVO open data):

- `regeling_naam` (bijv. ISDE, SVVE, SVOH, DUMAVA).[web:190][web:186]
- `type` (subsidie / lening / fiscale regeling).[web:191][web:194]
- `doelgroep` (eigenaar-bewoners, VvE’s, corporaties, particuliere verhuurders, maatschappelijk vastgoed, bedrijven).[web:190][web:188]
- `maatregeltype`: isolatie, warmtepomp, zonneboiler, warmtenet-aansluiting, laadinfrastructuur, energieadvies, energie-innovatie.[web:188][web:194][web:195]
- `budget` en `looptijd` (totaalbudget, openstellingsperiode, einddatum aanvraag).[web:194][web:191]
- `link_aanvraag` en `voorwaarden_url` (RVO-pagina).

B. Toepassingsfilters voor Propdex:

- `toegestane_gebouweisen`: woning, appartement, VvE-complex, maatschappelijk vastgoed, bedrijfspand.[web:188][web:190]
- `min/max_maatregelomvang`: bijv. subsidie per m² isolatie, per kW warmtepomp, per woning.[web:188][web:186][web:194]
- `vereist_energieadvies` (ja/nee) en `vereist_minimaal_energielabel` (ja/nee).[web:188][web:198]
- `stapeling_toegestaan` (combinaties met andere regelingen).

C. Koppeling aan gebouw/portefeuille:

- Match op `gebruiksfunctie`, `eigenaarstype` (VvE/corporatie/particulier) en `EP-Online-energielabel` om te bepalen of een regeling relevant is.[file:1][web:188][web:199]

#### Bronnen & automatisering

- **Dataset “Subsidies en financiering RVO.nl”** op data.overheid.nl: alle openstaande subsidies/regelingen die via RVO lopen.[web:191][web:187]
- RVO.open-data landing page + API (via data.overheid.nl of derde API-store) voor machine-toegang.[web:187][web:189]
- Energiesubsidiewijzer (Milieu Centraal) als extra referentie voor woningeigenaren/VvE-regelingen (ISDE, SVVE, etc.).[web:187][web:188]

Automatisering:

- Periodieke ingest (bijv. dagelijks/wekelijkse) van de RVO “Subsidies en financiering”-dataset; filter op regelingen met relevant doelgroep- en maatregeltype voor vastgoed.[web:191][web:189]
- Mappinglaag in Propdex die RVO-regelingen koppelt aan Propdex-typologieën (woning/VvE/maatschappelijk vastgoed/bedrijfspand) en EP-Online-gegevens.[file:1][web:199]
- Optioneel: koppeling met EP-Online webservice om actuele energielabels en maatregelen op pandniveau te gebruiken bij subsidie-match.[file:1][web:199]

#### Business-regels / productlogica

- Subsidie-overzicht per perceel: “Voor dit pand zijn op basis van functie/eigenaar/energielabel de volgende landelijke regelingen relevant: …” (met naam, korte omschrijving, indicatieve bijdrage).[file:1][web:188][web:190]
- Integratie in de financiële module: subsidiebedragen (range) als **capex-reductie** op verduurzamingsmaatregelen (isolatie, warmtepomp, warmtenet, laadinfrastructuur).[web:188][web:186][web:194]
- Action Items in perceeldossier: “Vraag SVVE aan voor VvE-verduurzaming”, “Check ISDE voor warmtepomp”, met deadlines (sluitingsdatum regeling).[file:1][web:188][web:198]

#### Risico’s / edge cases

- Regelingen worden regelmatig aangepast of vervangen (SEEH → SVVE; nieuwe tranches SDE++/ISDE); Propdex moet daarom updatefrequentie hoog houden en niet vertrouwen op statische lijsten.[web:186][web:190][web:194]
- Veel RVO-regelingen hebben gedetailleerde voorwaarden (maatregelpakketten, minimale oppervlaktes, combinatieregels); Propdex kan een eerste pre‑check doen, maar niet alle juridische details afdekken.[web:188][web:194]
- Voor sommige datasets/APIs (zoals EP-Online) is toegang beperkt of vereist een key; dat beïnvloedt hoe diep Propdex in individuele subsidie-aanvraagniveaus kan gaan.[web:199][web:193]

#### Concreet actieplan (dev/data)

1. Data-pijplijn bouwen die de dataset “Subsidies en financiering RVO.nl” periodiek inleest, filtert op vastgoedrelevante regelingen en normaliseert naar Propdex’ concessiestructuur.[web:191][web:189]
2. Datamodel `rvo_regeling` opzetten met velden voor doelgroep, maatregeltype, budget, looptijd, kernvoorwaarden en aanvraaglinks.[web:191][web:194]
3. Match-engine ontwikkelen die per perceel/project op basis van functie, eigenaarstype, energielabel en maatregelen bepaalt welke RVO-regelingen relevant zijn.[file:1][web:188][web:199]
4. UI-component “Landelijke subsidies (RVO)” toevoegen aan perceel-/rapportpagina met compacte lijst, verwachte bijdrage en links naar RVO voor aanvraag.[file:1][web:188][web:198]

---

### 2.7 BENG & energieprestatie — beng-energieprestatie

#### Korte beschrijving

Sinds 1 januari 2021 moeten alle vergunningsaanvragen voor nieuwbouw voldoen aan de eisen voor **Bijna Energieneutrale Gebouwen (BENG)**.[web:201][web:205][web:213] De energieprestatie wordt vastgelegd met drie BENG-indicatoren: (1) maximale energiebehoefte (kWh/m².jr), (2) maximaal primair fossiel energiegebruik (kWh/m².jr) en (3) minimaal aandeel hernieuwbare energie (%), berekend volgens de bepalingsmethode NTA 8800.[web:201][web:202][web:204][web:210] BENG heeft de oude EPC vervangen en is gekoppeld aan het energielabel (EP‑1/2/3) en aanvullende indicatoren zoals TOjuli (oververhitting).[web:205][web:207][web:210]

#### Inhoudelijke scope voor Propdex

- Biedt per nieuwbouw- of ingrijpende renovatiecase de **minimale energieprestatie-eisen** voor het type gebouw (woning/utiliteit) en maakt zichtbaar hoe ver een ontwerp daarboven zit.[file:1][web:201][web:202]
- Combineert BENG-eisen met EP‑Online‑gegevens om voor bestaande panden de **verduurzamingsopgave** te schatten: hoeveel maatregelen zijn nodig om naar een toekomstbestendig niveau te komen.[file:1][web:199][web:207]

#### Datavelden die we extraheren

A. BENG-indicatoren en grenswaarden:

- `BENG1_max`: maximale energiebehoefte (kWh/m².jr) per gebouwtype (woning, woongebouw, kantoor, etc.).[web:201][web:202][web:208]
- `BENG2_max`: maximaal primair fossiel energiegebruik (kWh/m².jr) per gebouwtype.[web:201][web:202][web:205]
- `BENG3_min`: minimaal aandeel hernieuwbare energie (%) per gebouwtype.[web:201][web:202][web:208]
- `TOjuli_max` voor woningen: indicatieve grenswaarde voor risico op oververhitting.[web:205][web:207]

B. Bepalingsmethode (NTA 8800):

- Koppeling met EP‑indicatoren: EP1 ↔ BENG1, EP2 ↔ BENG2, EP3 ↔ BENG3.[web:204][web:207][web:210]
- Bouwfase-afhankelijkheid: onderscheid tussen nieuwbouw, ingrijpende renovatie en bestaande bouw (bij bestaande bouw vaak geen BENG‑eis, wel “Standaard” voor warmtebehoefte).[web:202][web:207][web:206]

C. Koppeling aan EP‑Online / energielabels:

- `EP1/EP2/EP3` per pand uit EP‑Online-registratie.[web:199][web:207]
- `labelklasse` (A++++ t/m G) en indicator “voldoet aan BENG voor nieuwbouw ja/nee” voor nieuwbouwobjecten.[web:199][web:207]

#### Bronnen & automatisering

- RVO BENG‑pagina’s (algemene uitleg + indicatoren + grenswaarden per gebouwtype).[file:1][web:201][web:213][web:209]
- IPLO “Energiezuinigheid: regels bij nieuwbouw” voor koppeling met Bbl en bouwfase.[web:202][web:16]
- NTA 8800 (betaalde norm, niet integraal in te lezen) als methodereferentie; Propdex gebruikt vooral de indicator-logica, niet de volledige berekening.[web:204][web:210]
- EP‑Online webservice (energielabels) als bron voor pand-specifieke EP-waarden.[file:1][web:199]

Automatisering:

- Eenmalige ingest van RVO-BENG-handreiking / grenswaarden-tabellen per gebouwfunctie, opslaan in `beng_normen`.[file:1][web:201][web:208]
- Koppeling met EP‑Online-API voor het ophalen van EP1/EP2/EP3 en labelklasse per pand (waar toegestaan).[file:1][web:199]
- Mappinglaag die, gegeven gebouwtype + bouwfase, selecteert welke BENG-eisen gelden en hiermee EP-waarden toetst.[web:202][web:207]

#### Business-regels / productlogica

- **Nieuwbouwscenario’s**: bij invoer van een ontwerp laat Propdex zien of EP1/EP2/EP3 voldoen aan BENG1/2/3, en hoeveel “headroom” er is.[web:201][web:205][web:207]
- **Verduurzamingsopgave bestaande bouw**: gebruik EP‑Online-energielabel/EP‑waarden om in te schatten hoeveel maatregelen nodig zijn om richting BENG‑niveau of een “Parijsproof”‑doel te komen; dit voedt de financiële module.[file:1][web:199][web:207]
- **Risico op oververhitting**: waar TOjuli‑indicator (of gelijkwaardige oververhittingsindicator) beschikbaar is, geeft Propdex een signaal “verhoogd oververhittingsrisico” voor bepaalde woningtypen/orientaties.[web:205][web:207]

#### Risico’s / edge cases

- BENG‑eisen gelden formeel alleen voor **nieuwbouw/aanvragen omgevingsvergunning vanaf 2021**; voor bestaande gebouwen gelden andere kaders (Standaard/Paris Proof), dus Propdex moet dat onderscheid duidelijk maken.[web:201][web:205][web:206]
- Het volledig doorrekenen van BENG volgens NTA 8800 is gecertificeerde specialistentaak; Propdex mag zich beperken tot het **lezen/toetsen** van EP‑indicatoren, niet tot het vervangen van gecertificeerde berekeningen.[web:204][web:207]
- Grenswaarden kunnen in de toekomst worden aangescherpt (RVO verwacht pas rond 2030 een volgende stap), Propdex moet de jaargang van de gehanteerde normen tonen.[file:1][web:201][web:206]

#### Concreet actieplan (dev/data)

1. Tabel `beng_normen` vullen met per gebouwfunctie de BENG1/2/3-waarden en TOjuli‑grens, op basis van RVO-documentatie.[web:201][web:208][web:205]
2. EP‑Online-koppeling activeren en EP1/EP2/EP3 + labels opslaan per pand.[file:1][web:199]
3. Toetsingslogica bouwen die per scenario (nieuwbouw/renovatie) de juiste BENG‑set kiest en EP-waarden toetst met duidelijke UI-feedback (“voldoet / marge / overschrijding”).[web:202][web:207]
4. UI-blok “Energieprestatie (BENG / EP‑Online)” toevoegen aan perceel-/projectpagina met samenvatting, headroom en mogelijke maatregelen-actiepunten.[file:1][web:201][web:199]

---

### 2.8 Stikstof & Natura 2000 — stikstof-nationaal

#### Korte beschrijving

Stikstofregels beschermen kwetsbare natuur in **Natura 2000-gebieden** tegen overmatige stikstofdepositie (NOx en NH₃) op basis van Europese natuurwetgeving.[file:1][web:223] Sinds de PAS-uitspraak (2019) en de Porthos-uitspraak (2022) moet bij elk project met mogelijke extra stikstofdepositie worden beoordeeld of een **natuurvergunning** nodig is; de bouwvrijstelling is vervallen.[web:225][web:222][web:216] De AERIUS Calculator is het officiële rekeninstrument om stikstofdepositie van projecten op Natura 2000-gebieden vast te stellen; een bijdrage ≤ 0,005 mol/ha/jaar geldt als onder de drempel waarbij geen natuurvergunning nodig is.[web:226][web:217][web:220]

#### Inhoudelijke scope voor Propdex

- Maakt per perceel en plan inzichtelijk of er **stikstofrisico’s** zijn: ligt het project (bouw- en gebruiksfase) in de nabijheid van stikstofgevoelige Natura 2000-gebieden en hoe groot is de kans dat een natuurvergunning nodig is.[file:1][web:223][web:221]
- Verbindt het landelijke stikstofkader (Wet natuurbescherming / Wet stikstofreductie en natuurverbetering) met AERIUS-kaartlagen en provinciaal beleid, zodat Propdex een indicatieve risico-inschatting voor woningbouwplannen kan geven.[file:1][web:218][web:224]

#### Datavelden die we extraheren

A. Geospatiale context:

- `afstand_tot_dichtsbijzijnde_Natura2000` (km) en `is_binnen_bufferzone` (bijv. < 7 km/1 km) voor stikstofanalyse.[web:223][web:220]
- `is_stikstofgevoelig_gebied` (ja/nee) op basis van AERIUS/BIJ12-indicatie (niet alle Natura 2000-gebieden zijn stikstofgevoelig).[web:223][web:221]

B. Vergunning- en drempelinformatie:

- `drempel_vergunningvrij` = 0,005 mol/ha/jaar extra depositie per Natura 2000-gebied; bij een bijdrage ≤ 0,005 mol/ha/jaar is geen natuurvergunning nodig.[web:226][web:217]
- `heeft_AERIUS_0_00_scenario` (ja/nee): indicatie of, bij conservatieve aannames (bijv. max. 50 laagbouwwoningen op ≥ 7 km), de depositie naar verwachting 0,00 mol/ha/jaar kan zijn.[web:220]
- `vergunningplicht_waarschijnlijk` (laag/midden/hoog) op basis van afstand, omvang, type plan (bijv. grootschalige woningbouw/infra) en verkeersgeneratie.[web:221][web:223][web:217]

C. Mitigerende routes:

- `ruimte_voor_intern_salderen` (ja/nee/ onbekend) op basis van type initiatief (vervangende bouw/renovatie vs. uitbreiding).[web:226][web:223]
- `externe_saldering_nodig` (indicatie) bij netto toename depositie die niet intern kan worden weggestreept.[web:226]
- Verwijzing naar opties stikstofregistratiesysteem / ADC-route (Alternatieven, Dwingende reden, Compensatie) bij grote projecten.[web:221][web:226][web:225]

#### Bronnen & automatisering

- AERIUS-kaartlagen (Natura2000, stikstofgevoelige habitattypen, depositiekaarten) als geospatiale WMS/WFS‑layers.[file:1][web:229][web:223]
- Wet natuurbescherming / Wet stikstofreductie en natuurverbetering en onderliggende besluiten (landelijk kader).[web:216][web:224]
- VolkshuisvestingNederland “Stikstof” + “Toestemmingsverlening stikstofdepositie bij nieuwe projecten” voor woningbouwspecifieke duiding en 0,005‑drempel.[web:221][web:226]
- Handreiking “woningbouw en AERIUS” met vuistregels voor 0,00 mol/ha/jaar‑scenario’s (bijv. max. 50 woningen op ≥ 7 km).[web:220]

Automatisering:

- Integratie van AERIUS-kaartlaag in de Propdex‑kaart, zodat voor elk perceel de afstand tot en gevoeligheid van Natura 2000 zichtbaar is.[file:1][web:229][web:223]
- Regelengine die op basis van planparameters (aantal woningen, bouwtype, verkeer) grofweg classificeert of AERIUS-berekening waarschijnlijk tot 0,00/≤0,005 of tot hogere depositie leidt.[web:220][web:217]
- Jaarlijkse update/check van landelijke stikstof- en Natura 2000‑datasets en beleid (doelen 2030/2035, nieuwe jurisprudentie).[web:218][web:224]

#### Business-regels / productlogica

- **Stikstof-badge op plan/perceel**: bijv. “Ligt binnen X km van stikstofgevoelig Natura 2000-gebied; natuurvergunning waarschijnlijk nodig tenzij AERIUS-berekening 0,00/≤0,005 mol/ha/jaar aantoont.”[web:221][web:226][web:220]
- In de Risicoscore een aparte factor “Stikstof / Natura 2000” die hoger uitvalt bij grote plannen dichtbij gevoelige gebieden en lager bij kleinschalige of ver weg gelegen projecten.[file:1][web:223][web:230]
- In het due‑diligence rapport een sectie “Stikstof en natuurvergunning” met: afstand/gevoeligheid, indicatie vergunningplicht, mogelijke mitigerende routes (intern/extern salderen, registratiesysteem, ADC) en advies om een specialistische AERIUS-berekening te laten maken.[web:226][web:217][web:225]

#### Risico’s / edge cases

- Het Porthos-arrest heeft de bouwvrijstelling vernietigd; ook **bouwfase‑emissies** moeten nu worden getoetst, niet alleen gebruiksfase.[web:222][web:216][web:225]
- Vuistregels uit handreikingen (bijv. 0,00 mol/ha/jaar bij 50 woningen op ≥ 7 km) zijn indicatief en hebben geen juridische status; Propdex moet dit expliciet labeling als “indicatie, echte toets = AERIUS”.[web:220][web:226]
- Stikstofbeleid blijft politiek en juridisch volatiel; Propdex moet expliciet de datum/jaargang van gebruikte datasets en beleidskaders tonen en geen schijnzekerheid wekken over toekomstige wijzigingen.[file:1][web:218][web:224][web:230]

#### Concreet actieplan (dev/data)

1. AERIUS WFS/WMS‑kaarten integreren in de Propdex‑kaartlaagstack (`natura2000`, `stikstofgevoelig`, `depositieachtergrond`).[file:1][web:229][web:223]
2. Tabel `stikstof_context` opzetten met per perceel: afstand tot dichtstbijzijnde stikstofgevoelige Natura 2000, bufferzoneflag, indicatieve risicoklasse.[web:223][web:220]
3. Regelengine ontwikkelen die, gegeven planomvang/locatie, aangeeft of:
   - een AERIUS-berekening waarschijnlijk 0,00/≤0,005 oplevert (kans “geen vergunning nodig”), of
   - een natuurvergunning en salderingstraject waarschijnlijk aan de orde is.[web:220][web:226][web:217]
4. UI-sectie “Stikstof & Natura 2000” toevoegen met badge, korte uitleg, link naar relevante Rijks-/BIJ12‑pagina’s en een aanbeveling om een specialistisch stikstofadvies in te winnen bij hogere risicoscores.[web:221][web:226][web:229]
---
### 2.9 Rijksbeleid monitoring — rijksbeleid-monitoring

#### Korte beschrijving

Rijksbeleid rondom wonen, bouwen en de fysieke leefomgeving verandert continu via **Kamerstukken, wetsvoorstellen, Kamerbrieven, rapporten en nieuwsberichten**.[file:1][web:231][web:243] Deze documenten worden gepubliceerd via Rijksoverheid.nl, OfficiëleBekendmakingen.nl en het Open Data Portaal van de Tweede Kamer, en zijn via RSS-feeds en APIs real-time te volgen.[web:242][web:233][web:235]

#### Inhoudelijke scope voor Propdex

- Biedt een **“Beleid in beweging”‑feed** voor gebruikers: zicht op relevante landelijke beleidswijzigingen (wetten, conceptwetgeving, Kamerbrieven, rapporten) die impact hebben op woningbouw, omgevingsrecht, energie, stikstof, etc.[file:1][web:243][web:218]
- Helpt ontwikkelaars en investeerders de **beleidsrisico’s en kansen** rondom hun portefeuille te volgen (bijv. Wet versterking regie volkshuisvesting, nieuwe stikstofregels, huurregulering, grondbeleid).[file:1][web:231][web:234]

#### Datavelden die we extraheren

A. Document- en eventmetadata:

- `type_document`: Kamerstuk, wetsvoorstel, Kamerbrief, rapport, nieuwsbericht, persbericht.[web:233][web:236][web:242]
- `onderwerp/thema`: wonen, volkshuisvesting, omgevingswet, stikstof, huur, energie, grondbeleid, etc. (via trefwoorden/ministeries/commissie).[web:242][web:234][web:243]
- `datum_publicatie` en `status` (nieuw, aangenomen wet, in behandeling, consultatie).[web:231][web:236]

B. Herkomstkanalen:

- Rijksoverheid RSS-feeds voor Kamerstukken, nieuws en besluiten per ministerie.[web:242][web:245]
- Zoek.officielebekendmakingen.nl RSS voor parlementaire documenten (Kamerstukken, Handelingen, Kamervragen) en Staatsblad/Staatscourant.[web:233][web:236]
- Tweede Kamer Open Data Portaal (OData/SyncFeed API) voor wetsvoorstellen, moties, amendementen en vergaderingen.[web:235][web:232][web:238]

C. Propdex-specifieke verrijking:

- `relevantie_score` per document op basis van trefwoorden (wonen, volkshuisvesting, omgevingswet, stikstof, energie, grondbeleid).[file:1][web:243]
- `impact_type`: informatief, beleidswijziging concreet, aankondiging, consultatie.
- Optioneel: `ruimtebeperkend` / `ruimtegevend` op basis van een eerste AI-analyse (bijv. meer regulering vs. meer versoepeling).

#### Bronnen & automatisering

- Rijksoverheid RSS-feeds “Alle Kamerstukken” en per ministerie (BZK, VRO, IenW, EZK) voor relevante stukken.[web:242][web:245]
- OfficiëleBekendmakingen RSS voor Kamerstukken, Staatsblad (nieuwe wetten), Staatscourant (regelingen).[web:233][web:236]
- Tweede Kamer Open Data Portaal (OData en SyncFeed) voor gestructureerde toegang tot Kamerstukken, wetsvoorstellen en moties.[web:235][web:232][web:238]

Automatisering:

- Feed-aggregator die geselecteerde RSS-feeds en (optioneel) Tweede Kamer OData/SyncFeed periodiek leest en wegschrijft in `rijksbeleid_event`.[file:1][web:233][web:235]
- AI-classifier die per document/titel/summary bepaalt of het Propdex-relevant is en welk thema(’s) en impacttype van toepassing zijn.[file:1][web:243]
- Filterlaag per gebruiker/portefeuille (bijv. alleen beleid over huurregulering voor beleggers, of stikstof/Omgevingswet voor ontwikkelaars).

#### Business-regels / productlogica

- **Landelijke “Beleid in beweging”-feed** op de Propdex-landingspagina met de meest recente en meest relevante beleidswijzigingen en stukken.[file:1][web:231][web:243]
- Contextblokken in rapporten: bijv. “Er lopen op dit moment X relevante wetsvoorstellen over huurregulering / stikstof / volkshuisvesting; zie beleid-in‑beweging voor details.”[web:231][web:218]
- Alerts/notificaties voor gebruikers wanneer een beleidswijziging direct raakt aan hun projecten (bijv. Wet versterking regie volkshuisvesting, huurplafonds, stikstofnormen).[file:1][web:218][web:221]

#### Risico’s / edge cases

- Volume: RSS-feeds en Kamerdata produceren veel ruis; Propdex moet sterk filteren op relevante thema’s om gebruikers niet te overspoelen.[web:233][web:242]
- Onzekerheid: veel stukken zijn **voorgenomen beleid** (consultatie/voorstel) en gaan niet altijd ongewijzigd of überhaupt door; Propdex moet duidelijk onderscheid maken tussen “voorgesteld” en “in werking”.[web:231][web:243]
- Technische afhankelijkheid: Tweede Kamer Open Data API en RSS-endpoints moeten stabiel zijn; fallbacks via enkel RSS (Rijksoverheid/Officiële bekendmakingen) zijn nodig.[web:235][web:238][web:233]

#### Concreet actieplan (dev/data)

1. Feed-aggregator bouwen voor Rijksoverheid- en OfficiëleBekendmakingen-RSS met themafilters (wonen, bouw, omgevingswet, stikstof, energie, grondbeleid).[file:1][web:233][web:242]
2. Event-tabel `rijksbeleid_event` opzetten met velden voor type, kanaal, thema, impacttype, relevantiescore en links naar bron.[web:236][web:235]
3. AI-classifier trainen op een set gelabelde Kamerstukken/nieuwsberichten om relevantie en impacttype te voorspellen.[web:243][web:231]
4. UI “Beleid in beweging” integreren: landelijk overzicht + koppeling naar provincie-/gemeentepagina’s waar relevant, met simpele filters op thema en datum.[file:1][web:218][web:221]
---

## 3. Provincie — 8 bronnen

### 3.1 Omgevingsverordening — omgevingsverordening

#### Korte beschrijving

Elke provincie heeft precies **één omgevingsverordening** voor haar grondgebied, waarin zij regels over de fysieke leefomgeving vastlegt.[file:1][web:249] Deze verordening bundelt voormalige provinciale milieu-, water- en landschapsverordeningen en bevat zowel **direct werkende regels** (bijvoorbeeld voor grondwaterbeschermingsgebieden en stiltegebieden) als **instructieregels** voor gemeenten en waterschappen.[file:1][web:246][web:247][web:248]

#### Inhoudelijke scope voor Propdex

- Bepaalt of een plan **überhaupt planologisch mogelijk** gemaakt mag worden door de gemeente: provinciale regels kunnen bouwmogelijkheden in stiltegebieden, grondwaterbeschermingszones of landschappelijk waardevolle gebieden begrenzen.[file:1][web:246][web:258]
- Stuurt via instructieregels de **inhoud van omgevingsplannen** (bijv. reserveringszones langs provinciale wegen/spoor, bouwbeperkingen in beschermde gebieden, regels rond bedrijventerreinen en waterveiligheid).[file:1][web:247][web:252]

#### Datavelden die we extraheren

A. Provinciale zones en functies:

- `grondwaterbeschermingsgebied_type`: waterwingebied, grondwaterbeschermingsgebied, boringsvrije zone; met bijbehorende bouw- en gebruiksbeperkingen.[web:246][web:249][web:250]
- `stiltegebied` / `geluidgevoelige_zone` en bijbehorende beperkingen op lawaaiige functies.[web:258]
- `reserveringszone_provinciale_weg/spoor`: breedte (bijv. 15 m aan weerszijden) en toegestane/verboden functies (vaak geen nieuwe bouwwerken).[web:252][web:255]
- Optioneel: provinciale aanduidingen zoals weidevogelkerngebied, regionale waterkeringen, regionale infrastructuurcorridors.

B. Instructieregels richting gemeenten/waterschappen:

- `instructieregel_omgevingsplan`: verplichtingen voor gemeenten om functies toe te delen of bepaalde regels op te nemen (bijv. reserveringszone weg/spoor, bescherming grondwater).[web:247][web:249][web:253]
- `instructieregel_programma` / `waterschapsverordening`: instructies voor programma’s en waterschapsregels die indirect ruimtelijke plannen beïnvloeden (bijv. waterveiligheid, riolering, landbouw).[web:247][web:260]

C. Toepassingscontext:

- `provinciaal_belang` (ja/nee): markering welke regels zijn gebaseerd op provinciale belangen die gemeenten **moeten** volgen (artikel 2.3 en 2.22 Omgevingswet: subsidiariteit en instructieregels).[web:247][web:248][web:251]
- `direct_werkende_regel` vs. `instructieregel`: onderscheid tussen regels die direct burgers/ontwikkelaars binden en regels die via omgevingsplan doorwerken.[web:247][web:251][web:249]

#### Bronnen & automatisering

- 12 provinciale omgevingsverordeningen in CVDR via lokaleregelgeving.overheid.nl (bijv. Omgevingsverordening Limburg, Zuid-Hollandse Omgevingsverordening).[file:1][web:252][web:255]
- IPLO-kennispagina’s over grondwater, geluid en instructieregels in de omgevingsverordening.[web:246][web:249][web:247][web:258]
- Eventuele aanvullende toelichtingen/handreikingen per provincie (bijv. PDF’s over toepassing van de omgevingsverordening).[web:259][web:256]

Automatisering:

- KOOP SRU-title search op “Omgevingsverordening [provincienaam]” voor alle 12 provincies, exact dezelfde ingest‑techniek als voor gemeentelijke omgevingsvisies.[file:1][web:252][web:255]
- AI-parser die per verordening:
  - alle relevante zones (grondwater, stilte, reserveringszones, NNN-koppeling) identificeert;
  - de bijbehorende normteksten (verboden, vergunningplichten, voorwaarden) extraheert;
  - instructieregels markeert en koppelt aan omgevingsplannen/waterschapsverordeningen.[web:247][web:249][web:259]

#### Business-regels / productlogica

- **Perceelbadge “Provinciale zones”**: op de perceelpagina tonen “Ligt in grondwaterbeschermingsgebied X / stiltegebied / reserveringszone provinciale weg” met de kernbeperking (bijv. “geen nieuwe gevoelige functies” of “geen bouwwerken in reserveringszone”).[file:1][web:246][web:252][web:258]
- In de due‑diligence rapporten een paragraaf “Provinciale randvoorwaarden” die samenvat:
  - provinciale zones die het perceel raken;
  - relevante instructieregels voor het omgevingsplan (bijv. verplichte reserveringszones, beperkingen in NNN/grondwatergebieden);
  - impact op vergunnings- en planologische haalbaarheid.[file:1][web:248][web:253]
- Potentie-/Risicoscore verhogen/verlagen op basis van provinciale context (bijv. negatief in streng beschermde zones, positief in aangewezen ontwikkelcorridors als die via omgevingsvisie/verordening zijn vastgelegd).[file:1][web:248][web:249]

#### Risico’s / edge cases

- Provinciale omgevingsverordeningen verschillen inhoudelijk sterk per provincie; de parser moet generiek genoeg zijn om variatie in structuur en terminologie op te vangen.[web:248][web:259]
- Sommige regels werken direct richting burgers/ontwikkelaars, andere alleen via instructieregels; Propdex moet dat onderscheid in de UI duidelijk maken (anders lijkt een niet‑directe regel “harder” dan hij is).[web:247][web:251]
- Verordeningen worden periodiek herzien (2–4 jaar grote herziening, tussentijds amendementen); Propdex moet via CVDR‑versioning en KOOP SRU altijd de geldende versie tonen.[file:1][web:252][web:255]

#### Concreet actieplan (dev/data)

1. KOOP SRU‑ingest uitbreiden met de 12 provinciale omgevingsverordeningen, gebruikmakend van dezelfde code‑path als gemeentelijke omgevingsvisies.[file:1][web:252]
2. Datamodel `provinciale_zone` opzetten met velden: `type` (grondwater, stilte, reservering), `geometrie`, `kernregel`, `direct_werkend` (bool), `provincie_id`.[web:246][web:258][web:252]
3. Datamodel `instructieregel_provincie` opzetten met velden: `adressaat` (gemeente/waterschap), `onderwerp` (omgevingsplan, programma), `kernverplichting`, `artikelverwijzing`.[web:247][web:249][web:260]
4. Perceel‑join bouwen die provinciale zones aan percelen koppelt (spatial join) en deze als flags + tekstsamenvatting toont in UI en scoring.[file:1][web:246][web:252]

---

### 3.2 Provinciale omgevingsvisie — ruimtelijke-visie

#### Korte beschrijving

De provinciale omgevingsvisie is de **integrale langetermijnvisie** van de provincie op de kwaliteit en gewenste ontwikkeling van de fysieke leefomgeving voor het hele provinciale grondgebied.[file:1][web:83][web:266] Provinciale Staten moeten één omgevingsvisie voor de hele provincie vaststellen; dit document is zelfbindend en vormt het strategische kader voor onder meer de omgevingsverordening, provinciale programma’s en regionale gebiedsprocessen.[web:83][web:266][web:261]

#### Inhoudelijke scope voor Propdex

- Bepaalt welke regio’s binnen een provincie **groeikansen krijgen** (stedelijke netwerken, woningbouwcorridors, logistieke knooppunten) en welke gebieden juist voor natuur, landbouw of landschap worden gereserveerd.[file:1][web:261][web:270]
- Legt de **provinciale woningbouw- en infrastructuurambities** neer (bijv. Almere Pampus, stedelijke knooppunten Utrecht, regionetwerken), die richtinggevend zijn voor gemeentelijke omgevingsvisies en omgevingsplannen.[file:1][web:261][web:262][web:265]

#### Datavelden die we extraheren

A. Gebiedsindeling en ontwikkelgebieden:

- `ontwikkelregio`s / `stedelijke_netwerken` met namen (bijv. “U16”, “Amersfoort”, “Foodvalley” in Utrecht).[web:261][web:264]
- `woningbouwcorridors` en `prioritaire ontwikkelgebieden` (bijv. Almere Pampus / Amsterdam Bay Area‑achtige corridors, regionale knooppunten).[web:262][web:265][web:270]
- `landelijk_geen_groei/krimpgebieden` waar provincie juist beperkingen op verstedelijking legt.[web:270][web:273]

B. Opgaven per regio:

- `woningbouwopgave_per_regio` (indicatieve aantallen woningen, waar in visie benoemd).[file:1][web:261][web:270]
- `infrastructuur_opgaven`: OV‑knooppunten, hoofdwegen, fietsroutes, energie‑infrastructuur (netverzwaring, zoekgebieden voor opwek).[web:261][web:270]
- `thema_prioriteiten` per regio (bijv. verstedelijking rond knooppunten, natuurversterking, energietransitie, klimaatadaptatie).[web:261][web:266][web:270]

C. Thematische lijnen (provinciale hoofdkeuzes):

- Hoofdambities per thema: wonen, economie, mobiliteit, energie/klimaat, natuur/landschap, water/bodem, erfgoed.[web:266][web:267][web:261]
- `stedelijk_vs_landelijk_beleid`: bijvoorbeeld “concentreren van woningbouw rond OV‑knooppunten en binnen bestaand stedelijk gebied” vs. voorwaarden voor bouwen in buitengebied.[web:261][web:264][web:270]

#### Bronnen & automatisering

- Provinciale omgevingsvisies in CVDR via lokaleregelgeving.overheid.nl (bijv. Omgevingsvisie Utrecht 2024, Omgevingsvisie Groningen 2025–2050).[file:1][web:264][web:270][web:273]
- IPLO-pagina’s over omgevingsvisie en bestaand provinciaal beleid (kader voor wat in de visie moet staan).[web:83][web:266]
- Provinciale websites/portalen voor kaarten en thematische bijlagen (visualisaties van ontwikkelgebieden, netwerken).[web:261][web:270]

Automatisering:

- KOOP SRU-ingest voor alle 12 provinciale omgevingsvisies, gecombineerd in dezelfde uitrol als de omgevingsverordeningen.[file:1][web:264][web:270]
- AI-parser die per visie:
  - ontwikkelregio’s, stedelijke netwerken en woningbouwcorridors herkent;
  - per regio de belangrijkste opgaven (wonen, energie, mobiliteit, natuur) extraheert;
  - thematische hoofdkeuzes (concentreren/spreiden, water- en bodemsturend) vastlegt.[web:261][web:266][web:270]

#### Business-regels / productlogica

- **Provinciale context op gemeente-/perceelpagina**: badge “Ligt in provinciale ontwikkelregio X / woningbouwcorridor Y” met korte toelichting (“provincie stuurt hier op verstedelijking rond knooppunten” / “behoud landschap, beperkte verstedelijking”).[file:1][web:261][web:265][web:270]
- In rapporten een sectie “Provinciale ontwikkelrichting” die samenvat hoe het project past binnen de provinciale omgevingsvisie (bijv. in lijn met concentratie rond OV‑knooppunten, of juist botsend met beperkingen in landelijk gebied).[web:261][web:266][web:270]
- Koppeling met Woondeals: provinciale omgevingsvisie geeft **ruimtelijk kader**, Woondeals geven kwantitatieve woningbouwafspraken; Propdex toont beide om te onderbouwen of een plan inhoudelijk en kwantitatief in het provinciale plaatje past.[file:1][web:66][web:270]

#### Risico’s / edge cases

- Omgevingsvisies zijn strategische documenten, geen direct bindende regels; Propdex moet duidelijk aangeven dat dit **beleidsrichting**, geen harde norm is (die zit in omgevingsverordening/omgevingsplan).[web:83][web:266]
- Detailniveau verschilt per provincie: sommige hebben sterke gebiedsindeling en expliciete aantallen, andere zijn abstracter; de parser moet hiermee om kunnen gaan en “onbekend/niet gespecificeerd” kunnen tonen waar nodig.[web:261][web:270][web:273]
- Overgang van oude structuurvisies naar omgevingsvisie: in sommige provincies lopen oude plannen nog door; Propdex moet de actuele omgevingsvisie via CVDR-datering pakken en niet oude strategiedocumenten vermengen.[web:266][web:264]

#### Concreet actieplan (dev/data)

1. KOOP SRU‑uitrol voor 12 provinciale omgevingsvisies parallel aan omgevingsverordeningen (zelfde ingest‑pipeline).[file:1][web:264]
2. Datamodel `provinciale_ontwikkelregio` en `provinciale_opgave` opzetten met velden: `regio_naam`, `type` (stedelijk netwerk, corridor, landelijk gebied), `woningbouwopgave_indicatief`, `thema_prioriteiten`, `provincie_id`.[web:261][web:270]
3. Perceel‑en gemeentepagina verrijken met verwijzingen naar relevante provinciale regio’s en hun kernambities (vooral woningbouw en mobiliteit).[file:1][web:261][web:265]
4. UI‑component “Provinciale ontwikkelrichting” toevoegen in rapporten met 3–5 bullets en eventuele linkjes naar de provinciale kaart/visie.[web:261][web:264][web:270]

### 3.3 Woondeals & woningbouwafspraken — woondeals

#### Korte beschrijving

Woondeals zijn **regionale afspraken** tussen Rijk, provincies, gemeenten, corporaties en andere partijen over de woningbouwopgave tot en met 2030 in 35 woondealregio’s.[file:1][web:66][web:279] Ze concretiseren de landelijke ambitie van ruim 900.000 extra woningen in aantallen per provincie, regio en gemeente, inclusief segmentverdeling (sociaal, midden, vrij) en aandacht voor betaalbaarheid en specifieke doelgroepen.[file:1][web:277][web:276][web:284]

#### Inhoudelijke scope voor Propdex

- Bieden per regio een **kwantitatief kader**: hoeveel woningen moeten er waar bij komen, welk aandeel moet betaalbaar zijn (ca. twee derde, met circa 30% sociaal) en welke doelgroepen staan centraal.[file:1][web:66][web:275][web:282]
- Helpen ontwikkelaars en investeerders beoordelen of hun projecten **in lijn zijn met de regionale afspraken** en daarmee meer kans hebben op bestuurlijke steun, versnelling en eventuele rijksbijdragen (bijv. Woningbouwimpuls).[web:278][web:281][web:284]

#### Datavelden die we extraheren

A. Regio- en volumeniveau:

- `woondeal_regio_naam` (bijv. Metropoolregio Amsterdam, SRBT, U10, Amersfoort, Foodvalley).[web:278][web:281][web:282]
- `woningbouwopgave_regio_2030`: aantal extra woningen per regio (bijv. 39.000 voor SRBT, 83.500 voor Utrecht/Amersfoort/Foodvalley samen, 171.200 voor MRA).[web:278][web:282][web:281]
- `woningbouwopgave_per_provincie`: aantallen per provincie, optellend tot ruim 900.000 woningen.[web:277]

B. Segment- en doelgroepverdeling:

- `aandeel_betaalbaar`: streefwaarde ≈ twee derde van de nieuwbouw betaalbaar in Woondeals en landelijke afspraken.[web:66][web:276][web:281]
- `aandeel_sociaal` en `aandeel_midden`: bijvoorbeeld 30% sociale huur, circa 40% voor middeninkomens in diverse Woondeals (regionale variatie).[web:275][web:276][web:281]
- `doelgroepen`: aandachtsgroepen (statushouders, dak-/thuislozen, spoedzoekers), ouderen, studenten, arbeidsmigranten, gezinnen.[web:275][web:278][web:282]

C. Lokale verdeling en sleutelprojecten:

- `opgave_per_gemeente`: aantallen per gemeente binnen de regio, waar in Woondeal vastgelegd.[web:275][web:278][web:283]
- `sleutelprojecten` / `prioritaire locaties`: benoemde gebiedsontwikkelingen en versnellingslocaties (bijv. Almere Pampus in MRA‑context, SRBT‑knooppunten).[web:278][web:281][web:262]

#### Bronnen & automatisering

- Rijk/VolkshuisvestingNederland: overzichtspagina Woondeals + pagina “Woondeals per provincie” met links naar alle 35 Woondeals.[file:1][web:66][web:285]
- Regionale Woondeals (PDF) op rijksoverheid.nl, provinciale en regionale sites (bijv. SRBT‑Woondeal, MRA‑Woondeal, Brabantse Woondeals).[web:278][web:283][web:281][web:275]
- Datawonen “Woondealregio”-databank als aanvullende, gestandaardiseerde bron voor aantallen per regio.[web:279]

Automatisering:

- Eenmalige bulk-upload van alle 35 Woondeals (PDF’s) in de AI-parser; jaarlijkse ingest van voortgangsrapportages.[file:1][web:66][web:279]
- Parser die per Woondeal:
  - totale opgave 2022–2030, segment- en doelgroepverdeling;
  - opgave per gemeente;
  - eventuele sleutelprojecten en versnellingslocaties extraheert.[web:278][web:283][web:282]
- Koppeling naar provincies/gemeenten door `woondeal_regio_id` als sleutel te gebruiken.

#### Business-regels / productlogica

- **Regiobadge op gemeente-/perceelpagina**: “Ligt in Woondealregio X met opgave Y woningen tot 2030, waarvan Z% betaalbaar en ±30% sociaal.”[web:66][web:275][web:281]
- In rapporten een blok “Regionale woningbouwafspraken (Woondeal)” dat laat zien hoe het project bijdraagt aan de kwantitatieve en kwalitatieve opgave van de regio (segment, doelgroep, tempo).[web:278][web:282]
- Potentie-score verhogen in regio’s waar:
  - de opgave groot is;
  - de realisatie achterblijft (via voortgangsrapportages);
  - en een project precies in het gewenste segment/doelgroep valt.[web:276][web:279]

#### Risico’s / edge cases

- Woondeals zijn **bestuurlijke afspraken**, geen formeel juridisch bindende normen; Propdex moet ze presenteren als beleidskader, geen harde juridische verplichting.[web:66][web:287]
- Voortgang en herijking: opgaven kunnen worden herijkt (kwantitatief/kwalitatief), zoals in Brabant; Propdex moet jaargang en versie tonen.[web:275][web:279]
- Overlap met woonvisies en omgevingsvisies: Woondeals zijn regionaler en kwantitatiever; gemeentelijke woonvisies vullen de lokale invulling in. Propdex moet beide lagen duidelijk onderscheiden maar combineren in de behoefte/segment-analyse.[file:1][web:66][web:88]

#### Concreet actieplan (dev/data)

1. Tabel `woondeal_regio` en `woondeal_opgave` opzetten met velden: `regio_id`, `regio_naam`, `provincie_id(s)`, `opgave_totaal`, `opgave_per_segment`, `opgave_per_gemeente`.[web:279][web:278]
2. Bulk-upload van alle 35 Woondeals en eerste automatische extractie; daarna handmatige QA voor topregio’s (MRA, SRBT, grote stedelijke regio’s).[file:1][web:281][web:282]
3. Per gemeente koppelen welke Woondealregio(s) van toepassing zijn, zodat Propdex dit kan tonen op gemeente- en perceelniveau.[web:66][web:275]
4. UI‑component “Regionale Woondeal” integreren in rapporten/portal, met kerncijfers en tekstuele samenvatting en een link naar de originele Woondeal.[web:66][web:281][web:283]

### 3.4 Provinciale subsidies — provinciale-subsidies

#### Korte beschrijving

Provincies hebben eigen **subsidie- en bijdrageregelingen** voor o.a. woningbouwversnelling, gebiedsgerichte aanpak wonen, verduurzaming van vastgoed, natuurherstel en mobiliteit.[file:1][web:289][web:29] Deze regelingen vullen landelijke subsidies (RVO) en gemeentelijke subsidies aan en zijn meestal gekoppeld aan provinciale beleidsagenda’s en Woondeals (bijvoorbeeld fondsen voor woningbouwversnelling, gebiedsgerichte transformatie of natuurherstel rond energieprojecten).[file:1][web:288][web:292][web:295]

#### Inhoudelijke scope voor Propdex

- Biedt per project/regio inzicht in **welke provinciale subsidies beschikbaar zijn**, met doelgroep, thema (wonen, verduurzaming, natuur, infrastructuur) en indicatieve subsidiehoogte.[file:1][web:289][web:292]
- Plaatst projecten in de context van **gebiedsprogramma’s en Woondeals**: vaak kunnen projecten die passend zijn binnen de provinciale opgave rekenen op ondersteuning via versnellingsregelingen of gebiedsgerichte subsidies.[file:1][web:29][web:295]

#### Datavelden die we extraheren

A. Regeling-metadata:

- `regeling_naam` (bijv. “Gebiedsgerichte Aanpak Wonen Zeeland”, “Versnelling Woningbouw 2025–2028 Utrecht”, “Betaalbaar wonen in kleine steden en dorpen Overijssel”).[web:292][web:295][web:298]
- `provincie` en eventueel `regio` / `Woondealregio` waarvoor de regeling geldt.[web:275][web:295][web:292]
- `doelgroep` (gemeenten, corporaties, marktpartijen, VvE’s, maatschappelijke organisaties).[web:292][web:295][web:289]
- `thema`: woningbouwversnelling, gebiedsgerichte aanpak wonen, verduurzaming maatschappelijk vastgoed, natuurherstel, leefbaarheid, etc.[web:289][web:292][web:288]

B. Financiële parameters:

- `subsidiabel_percentage` (bijv. max. 50% van subsidiabele kosten).[web:292][web:296]
- `max_subsidie_per_project` en `min_subsidie`: bijv. € 50.000 – € 750.000 voor gebiedsgerichte aanpak wonen, of enkele miljoenen voor woningbouwversnelling.[web:292][web:295][web:29]
- `totaal_budget` en `openstellingsperiode` (start- en einddatum, eerste-komt-eerst-maalt / tender).[web:292][web:290][web:295]

C. Inhoudelijke criteria:

- `projecttypes` (renovatie, transformatie, herstructurering, nieuwbouw, woonvormen voor doelgroepen, natuurherstel rond energieprojecten).[web:292][web:288][web:298]
- `randvoorwaarden`: relatie met provinciaal beleid/Woondeal, bijdrage aan betaalbare woningen, ruimtelijke kwaliteit, duurzaamheid (biodiversiteit, klimaatadaptatie, circulair bouwen, energietransitie).[web:292][web:29][web:289]

#### Bronnen & automatisering

- Provinciale subsidieportalen en regelingen in CVDR (Algemene subsidiebesluiten + specifieke regelinghoofdstukken).[file:1][web:292][web:295]
- BIJ12 en themapagina’s voor natuur-/landschapsbeheer waar provinciale openstellingsbesluiten worden gepubliceerd (natuursubsidies).[web:299][web:293]
- Externe aggregators zoals Vindsubsidies.nl of vergelijkbare partijen (zoals je zelf al voorstelt) voor actuele en volledige dekking.[file:1][web:291][web:297]

Automatisering:

- Waar mogelijk KOOP SRU-ingest van provinciale subsidieregelingen in CVDR (subsidiebesluiten en specifieke hoofdstukken, bijv. “Gebiedsgerichte aanpak wonen”).[file:1][web:292]
- In de praktijk efficiënter: partnership of API-koppeling met een subsidie-aggregator (Vindsubsidies of vergelijkbaar) die al alle provinciale subsidies structureert; Propdex gebruikt dan alleen de vastgoed-/wonen-/verduurzamingssubset.[file:1][web:291][web:297]
- AI-parser die uit beschrijvingen de kernvelden (doelgroep, thema, percentage, maxbedrag, criteria) extraheert voor regelingen die nog niet door een aggregator zijn gedekt.[web:292][web:295]

#### Business-regels / productlogica

- Subsidie-overzicht per project: naast landelijke RVO-regelingen toont Propdex een **provinciaal blok**: “In provincie X zijn voor dit type project de volgende regelingen relevant: … (naam, thema, doelgroep, max. bedrag).”[file:1][web:292][web:295][web:289]
- Integratie in de financiële module: provinciale subsidies als mogelijke **dekking voor onrendabele top** bij binnenstedelijke transformaties, woningbouwversnelling en verduurzaming.[web:295][web:292][web:29]
- Koppeling met Woondeals: voor projecten die aantoonbaar bijdragen aan de regionale woondealopgave, markeert Propdex regelingen die expliciet aan die Woondeal zijn gekoppeld (zoals flexpool- en versnellingsregelingen).[web:275][web:29][web:295]

#### Risico’s / edge cases

- Provinciale subsidies zijn **tijdelijk en tender-gedreven**; openstellingen, budgetten en voorwaarden veranderen regelmatig en kunnen snel sluiten.[web:292][web:290][web:295]
- Dekking van alle 12 provincies met eigen scrapers is onderhoudsintensief; een aggregator/partner is efficiënter en waarschijnlijk actueler.[file:1][web:291][web:297]
- Veel regelingen hebben overlappende doelen (bijv. woningbouw + leefbaarheid + duurzaamheid); Propdex moet helder aangeven of stapeling mogelijk is of dat combinaties juist uitgesloten zijn (afhankelijk van regelingtekst).[web:292][web:299]

#### Concreet actieplan (dev/data)

1. Proof-of-concept bouwen met 1–2 provincies (bijv. Utrecht en Noord-Brabant) via directe scraping/KOOP SRU + AI-parsing om datamodel te testen op woningbouw- en verduurzamingsregelingen.[file:1][web:29][web:295]
2. Datamodel `provinciale_regeling` opzetten met velden: `provincie_id`, `thema`, `doelgroep`, `subsidiabel_percentage`, `max_subsidie`, `budget`, `looptijd`, `criteria`, `woondeal_koppeling`.[web:292][web:289]
3. Parallel: partnership of API-verkenning met Vindsubsidies of vergelijkbare partij om landelijke/provinciale/gemeentelijke vastgoedgerelateerde subsidies via één feed te betrekken.[file:1][web:291][web:297]
4. UI-component “Provinciale subsidies” toevoegen op project-/perceelniveau, geïntegreerd met het bestaande RVO-subsidieblok en met filters op thema (wonen, verduurzaming, natuur) en aanvraagstatus (open/gesloten/binnenkort).[file:1][web:292][web:295]

### 3.5 Natuur & stikstof provinciaal — natuur-stikstof

#### Korte beschrijving

Naast het landelijke stikstofkader voeren provincies een **gebiedsgerichte aanpak stikstof en natuur** rond Natura 2000‑gebieden en het Natuurnetwerk Nederland (NNN).[file:1][web:304][web:313] In provinciale gebiedsplannen, natuurbeheerplannen en GGA‑documenten leggen zij vast in welke gebieden welke reductie- en herstelmaatregelen nodig zijn, hoeveel ontwikkelruimte er kan ontstaan en welke combinaties met andere opgaven (woningbouw, landbouwtransitie, energietransitie) mogelijk zijn.[web:304][web:305][web:307][web:314]

#### Inhoudelijke scope voor Propdex

- Maakt per perceel inzichtelijk of het binnen of nabij **NNN of stikstofgevoelige Natura 2000‑gebieden** ligt en hoe streng de provinciale natuurbeschermingskaders zijn.[file:1][web:303][web:312][web:306]
- Verbindt provinciale gebiedsprogramma’s (GGA/NPLG-gebiedsprogramma’s) met woningbouwplannen, zodat gebruikers kunnen zien of een locatie in een gebied valt met juist extra **ontwikkelruimte** of juist **versterkte natuurrestricties**.[file:1][web:304][web:305][web:311]

#### Datavelden die we extraheren

A. Natuurnetwerk Nederland (NNN) en provinciale natuurzones:

- `is_binnen_NNN` (ja/nee) en `afstand_tot_NNN` (km) op basis van provinciale NNN‑datasets (IPO / Nationaal Georegister).[web:303][web:312][web:306]
- `NNN_type`: bestaande natuur, nieuwe natuur, ecologische verbindingszone, waternatuur, agrarische natuur binnen N2000.[web:306][web:312]
- Eventuele aanvullende provinciale natuur- en landschapszones (bijv. provinciale weidevogelgebieden, stiltegebieden, landschapsensembles), die samen met de omgevingsverordening bouwmogelijkheden beïnvloeden.[file:1][web:311][web:309]

B. Gebiedsgerichte aanpak stikstof (GGA) en gebiedsprogramma’s:

- `GGA_gebied` / `gebiedsnaam` rond stikstofgevoelige Natura 2000‑gebieden (bijv. Duinen, Biesbosch, Nieuwkoop).[web:307][web:304][web:305]
- `GGA_fase`: verkenning, gebiedsagenda, gebiedsplan, uitvoering (2020–2030).[web:304][web:307][web:313]
- `stikstof_reductieopgave_2030/2035`: indicatieve doelstelling per gebied in lijn met Wsn‑omgevingswaarden (bijv. % hectares onder KDW in 2025/2030/2035).[web:305][web:314]
- `ontwikkelruimte_status`: indicatieve kwalificatie per gebied (beperkt/geen/voorzichtig mogelijk), gebaseerd op gebiedsplannen en (voor zover gepubliceerd) depositieruimte.[web:304][web:307][web:305]

C. Relevantie voor woningbouw:

- `woningbouw_kansgebieden` binnen gebiedsprogramma’s waar provincie expliciet inzet op woningbouw in balans met stikstof/natuur (bijv. woningbouw in bepaalde GGA‑gebieden na maatregelen).[web:304][web:310]
- `maatregelenmix` (hoog over): bronmaatregelen (landbouw, verkeer/industrie) versus natuurherstelmaatregelen en de koppeling aan woningbouw- of infrastructuurprojecten.[web:302][web:314][web:311]

#### Bronnen & automatisering

- Provinciale gebiedsgerichte stikstofplannen, gebiedsagenda’s en gebiedsprogramma’s (PDF’s) per provincie.[file:1][web:304][web:305][web:307][web:308]
- NNN-kaarten per provincie via WMS/WFS en landsdekkende NNN‑dataset van IPO/Atlas Natuurlijk Kapitaal.[web:303][web:306][web:312][web:309]
- BIJ12 en PBL-rapportages over provinciale maatregelen landelijk gebied en gebiedsgerichte aanpak.[web:313][web:293][web:314]

Automatisering:

- WFS/WMS‑koppeling voor NNN‑kaartlagen per provincie, vergelijkbaar met Natura2000/AERIUS‑kaartlagen uit het landelijke stikstofblok.[file:1][web:306][web:312]
- Handmatige ingest van GGA‑gebiedsplannen en gebiedsagenda’s per provincie (beperkt aantal documenten per provincie, maar met hoge impact).[file:1][web:304][web:307][web:305]
- AI-parser die per gebiedsplan GGA‑gebieden, stikstofreductiedoelen, koppeling met NNN/Natura 2000 en expliciete passages over woningbouw/ontwikkelruimte extraheert.[web:304][web:305][web:311]

#### Business-regels / productlogica

- **Natuur-/stikstofbadge provinciaal** op perceelpagina: “Ligt binnen NNN / binnen 1 km van NNN” en “maakt deel uit van GGA‑gebied X (stikstofgevoelig Natura 2000‑gebied).”[file:1][web:303][web:304][web:307]
- In het rapport een sectie “Provinciale natuur- en stikstofcontext” waarin Propdex samenvat:
  - ligging t.o.v. NNN en provinciale natuurzones;
  - of het project in een GGA‑gebied valt en wat de globale stikstofreductieopgave is;
  - of het provinciale gebiedsprogramma ruimte ziet voor woningbouw/gebiedsontwikkeling.[web:304][web:307][web:311]
- Potentie-/Risicoscore: hogere risico’s bij percelen diep in NNN of in zwaar belaste GGA‑gebieden zonder zicht op ontwikkelruimte; lagere risico’s waar gebiedsprogramma’s juist expliciet ruimte zoeken voor woningbouw na maatregelen.[web:304][web:305][web:310]

#### Risico’s / edge cases

- Gebiedsgerichte aanpak en NPLG‑gebiedsprogramma’s zijn volop in ontwikkeling; documenten en kaartbegrenzingen kunnen veranderen tot 2030/2035.[web:305][web:314][web:316]
- NNN‑bescherming en stikstofregels overlappen deels, maar zijn juridisch verschillend; Propdex moet helder scheiden tussen NNN‑beleid (provinciaal natuurbeleid) en Natura 2000/stikstofvergunningplicht (Europees/wet Wnb/Wsn).[web:303][web:312][web:305]
- Publicatie van exacte ontwikkelruimte (depositiecijfers) is vaak beperkt; Propdex kan hier alleen een indicatieve classificatie geven (“waarschijnlijk beperkt / nader onderzoek nodig”).[web:302][web:304][web:313]

#### Concreet actieplan (dev/data)

1. NNN‑kaartlagen integreren in de bestaande geostack (naast Natura 2000, stikstof) via IPO/Atlas Natuurlijk Kapitaal/Nationaal Georegister‑datasets.[web:303][web:306][web:312]
2. Voor elke provincie een beperkte set gebiedsgerichte stikstofplannen en gebiedsagenda’s (GGA) inlezen en parsers trainen op: GGA‑gebied, stikstofdoelen, natuurherstelmaatregelen, verwijzingen naar woningbouw/ontwikkelruimte.[web:304][web:307][web:305]
3. Datamodel `provinciale_natuur_context` opzetten met velden: `is_binnen_NNN`, `afstand_NNN`, `GGA_gebied_id`, `reductieopgave_class`, `ontwikkelruimte_class`.[file:1][web:304][web:311]
4. UI‑component “Provinciale natuur & stikstof” toevoegen op perceel-/projectpagina en in rapport, geïntegreerd met de landelijke stikstof/Natura 2000‑sectie.[file:1][web:221][web:223][web:313]

### 3.6 Provinciaal erfgoed — erfgoed-provinciaal

#### Korte beschrijving

Provincies hebben eigen **cultuurhistorische waardenkaarten/atlassen** waarop zij belangrijke cultuurhistorische structuren, landschappen en ensembles aanwijzen, naast rijks- en gemeentelijke monumenten.[file:1][web:320][web:318] Deze kaarten tonen bijvoorbeeld historische verkavelingspatronen, cultuurhistorische landschappen, linies, kastelen/buitenplaatsen, historische infrastructuur en gebieden met hoge archeologische verwachtingswaarde, en zijn vaak gekoppeld aan provinciaal erfgoedbeleid.[web:323][web:326][web:331]

#### Inhoudelijke scope voor Propdex

- Laat zien of een perceel in een **provinciaal erfgoedgebied** ligt (bijv. cultuurhistorisch kroonjuweel, waardenkaartgebied, historische lijn), wat tot aanvullende ruimtelijke kwaliteitseisen en beperkingen kan leiden bovenop rijks- en gemeentelijk erfgoed.[file:1][web:323][web:318]
- Biedt context voor gebiedsontwikkelingen en woningbouwplannen: projecten binnen provinciale erfgoedzones vragen vaak nadrukkelijker aandacht voor inpassing, behoud en versterking van cultuurhistorische kwaliteiten.[web:322][web:325][web:320]

#### Datavelden die we extraheren

A. Provinciale erfgoedgebieden:

- `erfgoedgebied_type`: cultuurhistorische hoofdstructuur, kroonjuweel, cultuurhistorisch waardevol gebied, historische verkaveling, historische infrastructuur, militair erfgoed, kastelen/buitenplaatsen, archeologische verwachtingszone, etc.[web:323][web:318][web:326]
- `erfgoedgebied_naam` en korte omschrijving van de kernwaarde (bijv. “Brabantse zandontginningslandschap”, “Hollandse Waterlinie‑ensemble”, “historisch boerderijlint”).[web:318][web:323][web:320]
- `provinciaal_belang` (ja/nee) als markering dat het om erfgoed van specifiek provinciaal belang gaat.[web:323][web:320]

B. Waardering en beleidsrichting:

- `waarderingsniveau` (bijv. hoog/gemiddeld/basis) afhankelijk van hoe de provincie de erfgoedwaarde classificeert.[web:323][web:320][web:318]
- Globale `sturingsrichting` voor het gebied: “behoud en versterken”, “zorgvuldig inpassen”, “ruimte voor ontwikkeling met aandacht voor erfgoed”.[web:323][web:325][web:322]

C. Geometrie:

- Polygonen (en soms lijnen/punten) van erfgoedgebieden zoals ontsloten via provinciale geoportalen of landelijke BIJ12‑datasets (cultuurhistorische waardenkaart).[web:321][web:324][web:329]

#### Bronnen & automatisering

- Provinciale cultuurhistorische kaarten/atlassen, bijvoorbeeld:
  - Cultuurhistorische Waardenkaart Noord‑Brabant.[web:318][web:321]
  - Cultuurhistorische kaart/Cultuurhistorische Hoofdstructuur Zuid‑Holland (incl. kroonjuwelen).[web:323][web:325]
  - Cultuurhistorische Atlas (CHAT) Utrecht.[web:326][web:324]
  - Atlas Limburg, kaarten voor Fryslân, etc.[web:327][web:331]
- RCE-overzicht “Provinciale cultuurhistorische waardenkaarten” met links naar alle provinciale viewers.[web:320]
- Landelijke dataset “Cultuurhistorische waardenkaart” van BIJ12 (IMNa_IKN) als landelijk samengevoegd beeld van provinciale erfgoedgebieden.[web:329]

Automatisering:

- Waar mogelijk WMS/WFS‑koppeling naar provinciale geoportalen/open data (bijv. Utrecht Geo-point, Atlas Limburg, provinciale open‑data endpoints) om erfgoedgebieden als kaartlaag op te halen.[web:324][web:327][web:331]
- Alternatief/aanvulling: gebruik de BIJ12‑cultuurhistorische waardenkaart als landelijke basislaag en verrijk met provinciespecifieke attributen waar beschikbaar.[web:329][web:320]
- Beperkte AI-parsing van bijbehorende beleidsdocumenten (bijv. CHW‑toelichting, beleidsperspectieven) om kernwaarden en sturingsrichtlijnen (behoud/ontwikkeling) in tekst te vatten.[web:318][web:323][web:325]

#### Business-regels / productlogica

- **Erfgoedbadge provinciaal** op perceelpagina: “Ligt in provinciaal erfgoedgebied [naam] (type: cultuurhistorisch landschap/kroonjuweel). Richting: behoud en versterking van cultuurhistorische kwaliteiten.”[file:1][web:323][web:318]
- In rapporten een blok “Provinciale erfgoedcontext” waarin Propdex uitlegt welke provinciale erfgoedwaarden spelen en welke impliciete ontwerp-/inpassingsconsequenties dat kan hebben (bijv. behoud zichtlijnen, kavelstructuur, landschapsprofiel).[web:323][web:322][web:325]
- Potentie-/Risicoscore:
  - verhoging van **complexiteit/risico** bij intensieve verdichting in kwetsbare erfgoedgebieden;
  - maar ook extra **kwaliteitspotentieel** voor projecten die erfgoed benutten (bijv. herbestemming, landschappelijke versterking).[web:319][web:322]

#### Risico’s / edge cases

- Provinciale kaarten verschillen sterk in detail, thematiek en waarderingsschaal; Propdex moet een generiek datamodel hanteren en variatie toelaten (bijv. sommige provincies kennen “kroonjuwelen”, andere niet).[web:320][web:318][web:323]
- Erfgoedgebieden overlappen met andere lagen (NNN, Natura 2000, omgevingsverordening, gemeentelijk erfgoed); Propdex moet duidelijk maken dat dit een **extra kwaliteitslaag**, geen zelfstandig verbodsregime is (tenzij verankerd via verordening/omgevingsplan).[web:323][web:320][web:322]
- Sommige provinciale kaarten zijn vooral indicatief; juridisch bindende bescherming loopt via omgevingsverordening/omgevingsplannen en monumentenregisters. De UI moet dit onderscheid duidelijk maken.[web:320][web:323][web:325]

#### Concreet actieplan (dev/data)

1. Landelijke BIJ12‑cultuurhistorische waardenkaart (IMNa_IKN) als basislaag integreren in Propdex’ geostack en koppelen aan percelen.[web:329]
2. Voor prioritaire provincies (bijv. Noord‑Brabant, Zuid‑Holland, Utrecht, Limburg) specifieke cultuurhistorische kaarten/atlassen via WFS/WMS inlezen en mappen naar het generieke datamodel `provinciaal_erfgoedgebied`.[web:318][web:323][web:326][web:327]
3. AI‑parser inrichten voor geselecteerde beleidsdocumenten (CHW‑toelichtingen, beleidsperspectieven) om per gebied een korte beschrijving en sturingsrichtlijn te genereren.[web:318][web:323][web:325]
4. UI‑component “Provinciaal erfgoed” toevoegen op perceel- en rapportniveau, geïntegreerd met bestaande rijksmonumenten- en gemeentelijk erfgoedverordening‑blokken.[file:1][web:317][web:320]
### 3.7 Energietransitie / RES — energie-transitie

#### Korte beschrijving

Nederland is opgedeeld in **30 energieregio’s** die samen een Regionale Energiestrategie (RES) opstellen voor grootschalige duurzame elektriciteitsopwek op land en de warmtetransitie in de gebouwde omgeving.[file:1][web:335][web:340] In RES 1.0 hebben regio’s gezamenlijk een bod gedaan van circa **55 TWh** duurzame elektriciteit op land in 2030 (boven de Klimaatakkoord-doelstelling van minimaal 35 TWh) en schetsen zij de contouren van de Regionale Structuur Warmte (RSW).[web:335][web:346][web:343]

#### Inhoudelijke scope voor Propdex

- Bepaalt per perceel/regio in welke **RES‑regio** het ligt, welke duurzame opwek (wind/zon) gepland is in de omgeving, en hoe de regionale warmtestrategie eruitziet.[file:1][web:340][web:343]
- Geeft context voor woningbouw en renovatie: of een wijk op termijn van het gas af gaat, welke warmteopties kansrijk zijn, en of nabijheid van wind/zon‑opwek ruimtelijke of acceptatie‑impact heeft.[file:1][web:332][web:336][web:338]

#### Datavelden die we extraheren

A. RES‑regio en opwekambitie:

- `RES_regio_naam` en `RES_regio_id`, gekoppeld aan de 30 energieregio’s (met gemeenten per regio).[web:340][web:338]
- `RES1_0_bod_TWh_2030`: bod voor duurzame elektriciteit op land (wind/zon) per regio.[web:335][web:343][web:346]
- Indien beschikbaar: `verdeling_wind_vs_zon` (MW/TWh) en globale zoekgebieden voor wind- en zonneparken.[web:334][web:346][web:343]

B. Warmtetransitie / Regionale Structuur Warmte (RSW):

- `RSW_beschikbare_warmtebronnen`: aanwezigheid van geothermie, restwarmte, aquathermie, biomassa en andere bronnen per regio.[web:332][web:338]
- `warmtevraagprofiel`: globale warmtevraag in de gebouwde omgeving per regio en hoofdclusters.[web:332][web:337]
- `RES_warmte_kansgebieden`: gebieden waar collectieve warmtesystemen kansrijk zijn volgens RSW/RES (bijv. langs warmtenetten, restwarmtebronnen).[web:332][web:333][web:339]

C. Koppeling met gemeentelijke Transitievisie Warmte (TVW):

- `TVW-status` per gemeente (eerste TVW vastgesteld ja/nee) en indicatieve planning welke wijken vóór 2030 in de warmtetransitie aan de beurt zijn (via externe bronnen, niet direct uit RES-document zelf).[web:332][web:336]
- Propdex gebruikt dit niet om de volledige TVW te reconstrueren, maar om de **regionale context** te geven (bijv. regio zet in op warmtenetten vs. all‑electric).

#### Bronnen & automatisering

- RES‑portaal en regio-sites met RES 1.0/2.0‑documenten en kaarten per regio (wind/zon‑zoekgebieden, RSW‑overzichten).[file:1][web:335][web:343][web:339]
- kaart “RES regio’s op de kaart” met landelijke indeling en lijst van gemeenten per regio.[web:340]
- PBL Monitor RES 1.0 en RES‑dataportaal met geaggregeerde boddata en analysekaarten (energieverbruik, potenties).[web:346][web:337]
- RCE RES‑kaarten als aanvullende visualisatie van opwekgebieden en erfgoedcontext.[web:334]

Automatisering:

- Bulk-download van RES 1.0/2.0‑documenten (ca. 30 × 2–3 documenten per regio) en opslag in `res_document`.[file:1][web:343][web:344]
- Landelijke shapefile/WFS voor RES‑regio’s en, waar beschikbaar, wind/zon‑zoekgebieden en RSW‑gebieden (via RES‑dataportaal / regionaal open data).[web:340][web:337]
- AI-parser die per regio:
  - het TWh‑bod en verdeling wind/zon extraheert;
  - de belangrijkste warmteleidende structuren (RSW) en warmte‑kansgebieden per regio benoemt;
  - expliciete passages over gebouwde omgeving/woningbouw markeert.[web:343][web:332][web:338]

#### Business-regels / productlogica

- **RES-badge op perceel/gemeentepagina**: “Ligt in RES‑regio X; regionaal bod: Y TWh duurzame elektriciteit op land in 2030; warmtestrategie: nadruk op restwarmte/warmtenetten versus all‑electric.”[file:1][web:335][web:340][web:332]
- In rapporten een blok “Regionale energietransitie (RES)” dat samenvat:
  - RES‑regio, bod en hoofdkeuzes voor wind/zon;
  - of het perceel in of nabij wind/zon‑zoekgebieden ligt (relevante ruimtelijke/acceptatie‑impact);
  - hoofd richting warmtetransitie (warmtenetten vs. all‑electric) voor de regio en koppeling met mogelijke TVW‑planning.[web:343][web:332][web:336]
- Potentie-/Risicoscore:
  - positieve factor waar de regionale warmtestrategie in lijn is met het gekozen energieconcept van het project (bijv. warmtenetgebied);
  - aandachtspunt waar projecten grootschalige zonne-/windlocaties overlappen (mogelijk conflicterende belangen of landschappelijke beperkingen).[web:341][web:334][web:343]

#### Risico’s / edge cases

- RES‑documenten zijn beleidsafspraken en analyses, geen juridisch bindende regels; planologische binding loopt via omgevingsplannen en omgevingsverordeningen.[web:345][web:341]
- Data in het RES‑dataportaal (analysekaarten) is vaak **theoretisch** en dateert uit RES 1.0; de feitelijke uitvoering per regio kan afwijken en moet via regionale bronnen worden bevestigd.[web:337][web:346]
- Warmtetransitie is primair een gemeentelijke verantwoordelijkheid (Transitievisie Warmte, warmteprogramma’s); Propdex gebruikt RES vooral als regionale contextlaag, niet als exacte wijk‑planning.[web:332][web:336]

#### Concreet actieplan (dev/data)

1. Landelijke RES‑regio‑kaart integreren in Propdex en per perceel/gemeente het `RES_regio_id` toevoegen.[file:1][web:340]
2. Tabel `res_regio_opgave` vullen met per regio: bod TWh, verdeling wind/zon, globale beschrijving warmtestrategie en relevante zoekgebieden.[web:335][web:343][web:346]
3. Waar beschikbaar, wind/zon‑zoekgebieden en RSW‑contouren via regionale open data (WFS/WMS) inlezen en koppelen aan percelen als ruimtelijke flags.[web:334][web:343][web:337]
4. UI‑component “Regionale energietransitie (RES)” toevoegen in Propdex, geïntegreerd met BENG/EP‑Online en lokale TVW‑informatie, zodat gebruikers in één oogopslag de energietransitie‑context van een locatie zien.[file:1][web:332][web:338]


### 3.8 Provinciaal mobiliteitsbeleid — mobiliteit

#### Korte beschrijving

Provincies zijn verantwoordelijk voor het **regionale mobiliteitsbeleid**: provinciale wegen, regionaal OV, fietsnetwerken en de regie op mobiliteit rond stedelijke gebieden.[file:1][web:353][web:347] In provinciale mobiliteitsplannen / Provinciale Verkeer- en Vervoerplannen (PVVP) en programma’s voor OV‑knooppunten beschrijven zij hoe mobiliteit, woningbouw en economie worden verbonden, bijvoorbeeld door verstedelijking rond OV‑knooppunten en versterking van hoofdnetwerken.[web:353][web:355][web:349]

#### Inhoudelijke scope voor Propdex

- Geeft per perceel/gemeente inzicht in de **bereikbaarheid en mobiliteitsontwikkelingen** die waarde en haalbaarheid van woningbouw beïnvloeden: geplande OV‑knooppuntontwikkeling, nieuwe infrastructuur, mobiliteitshubs, fietssnelwegen.[file:1][web:355][web:352]
- Biedt context voor parkeernormen, deelmobiliteit en knooppuntgerichte verstedelijking (bijvoorbeeld grootschalige woningbouw rond OV‑knooppunten in Limburg of Noord‑Holland).[file:1][web:349][web:352][web:358]

#### Datavelden die we extraheren

A. Netwerk- en OV‑knooppunten:

- `OV_knooppunt_classificatie`: hoofdstation, regionaal knooppunt, HOV‑halte, mobiliteitshub (met bijbehorende invloedssfeer, bijv. 300/1.200 meter).[web:355][web:349]
- `woningbouw_kansgebieden_rond_knooppunten`: indicatieve zones (bijv. 0–300 m, 300–1.200 m) met hogere prioriteit voor woningbouw, zoals in diverse programma’s OV‑knooppunten/monitoringsrapportages.[web:349][web:361][web:352]
- `geplande_infra_projecten`: geselecteerde nieuwe/verbeterde OV‑lijnen, stations, provinciale wegen die woningbouwlocaties beter ontsluiten (op hoofdlijnen).[web:353][web:359]

B. Mobiliteitsspeerpunten:

- `beleidsspeerpunten`: bijv. “knooppuntontwikkeling” (wonen bij OV), “fiets first”, “duurzame logistiek”, “veiligheid op provinciale wegen”.[web:353][web:356]
- `corridors` of hoofdstructuren waar provincie investeringen concentreert (bijv. stedelijke corridors tussen grote steden).[web:353][web:356]

C. Data van NDW (Nationaal Dataportaal Wegverkeer):

- Propdex gebruikt NDW‑open data als **kwantitatieve onderlaag**: actuele en historische verkeersintensiteiten, snelheden, reistijden en incidentdata voor provinciale en hoofdwegen.[file:1][web:348][web:351][web:360]
- Deze data voedt bereikbaarheid/drukte‑indicatoren en kan gebruikt worden om potentie voor knooppuntontwikkeling of congestierisico’s te duiden.[web:351][web:354][web:360]

#### Bronnen & automatisering

- Provinciale mobiliteitsplannen / PVVP’s (bijv. Gelderland “Op weg naar duurzame mobiliteit”, Noord‑Brabant PVVP, Zuid‑Holland PVVP) als hoofdkader.[web:353][web:347][web:356]
- Specifieke programma’s zoals “Programma OV‑knooppunten” en monitors (bijv. OV‑knooppunten Noord‑Holland) voor woningbouw rond stations.[web:355][web:349][web:361]
- NDW (Nationaal Dataportaal Wegverkeer) als open datalocatie voor actuele/historische verkeersgegevens.[web:348][web:351][web:360]

Automatisering:

- Handmatige ingest van 12 provinciale mobiliteitsplannen/PVVP’s; AI‑parser extraheert kerncorridors, OV‑knooppuntstrategieën en stedelijk/mobiliteitsbeleid i.r.t. woningbouw.[file:1][web:353][web:355]
- WFS/REST‑integratie met NDW‑open data voor verkeersintensiteit/snelheid op relevante wegvakken; aggregatie naar bereikbaarheid-/drukte‑indices per locatie.[web:348][web:351][web:360]
- In provincies met OV‑knooppuntenprogramma’s: inlezen van knooppuntenlijsten en woningbouw-/ontwikkelstatus binnen 300–1.200 m.[web:349][web:361]

#### Business-regels / productlogica

- **Mobiliteitsbadge** op perceelpagina:
  - “Binnen X meter van OV‑knooppunt Y (classificatie: regionaal knooppunt); provincie stuurt hier op knooppuntverstedelijking.”[web:355][web:361]
  - Bereikbaarheidsscore gebaseerd op reistijden en NDW‑data (bijv. congestie‑indicator voor provinciale hoofdwegen).[web:351][web:360]
- In rapporten een sectie “Regionale mobiliteitscontext” die samenvat:
  - nabijheid en rol van OV‑knooppunten;
  - geplande mobiliteitsinvesteringen;
  - relatie met provinciale woningbouw-/knopenagenda (bijv. grootschalige woningbouw rond Limburgse knooppunten).[web:352][web:355][web:358]
- Potentie-/Risicoscore: hogere potentie bij locaties in provinciale knooppuntversterkingsgebieden (meer steun, lagere parkeernormen) en extra risico waar ernstige congestie en beperkte ontsluiting spelen.[file:1][web:349][web:361]

#### Risico’s / edge cases

- Mobiliteitsplannen zijn strategisch en breed; concrete doorwerking op perceelniveau loopt via omgevingsverordening en gemeentelijke omgevingsplannen.[web:353][web:350]
- NDW‑data is rijk maar complex; Propdex moet een eenvoudige, robuuste set indicatoren kiezen (bijv. gemiddelde intensiteit/snelheid op nabijste hoofdweg) en geen pseudo‑precisie bieden.[web:351][web:360][web:357]
- OV‑knooppuntprogramma’s en woningbouwambities kunnen versneld wijzigen onder druk van de woningbouwopgave; Propdex moet datum/versie van gebruikte programma’s en monitors duidelijk tonen.[web:349][web:361]

#### Concreet actieplan (dev/data)

1. 12 PVVP’s/mobiliteitsplannen inlezen en AI‑parser trainen op het herkennen van:
   - OV‑knooppuntbeleid;
   - corridors en mobiliteitsspeerpunten;
   - koppelingen met woningbouwopgaven.[web:353][web:347][web:356]
2. Lijsten van OV‑knooppunten met classificaties en (indien beschikbaar) woningbouwstatus uit provinciale programma’s/monitors extraheren (start met Noord‑Holland, Limburg).[web:349][web:352][web:361]
3. NDW‑open‑data integratie opzetten voor basisbereikbaarheids- en drukte‑indicatoren rond percelen.[web:348][web:351][web:360]
4. UI‑component “Provinciaal mobiliteitsbeeld” toevoegen op perceel-/gemeentepagina, gekoppeld aan parkeerbeleid, woningbouwpotentie rond knooppunten en energietransitie (RES/TVW).[file:1][web:355][web:332]

---

## 4. Gemeente — 16 bronnen

### 4.1 Omgevingsvisie — omgevingsvisie

#### Korte beschrijving

De gemeentelijke omgevingsvisie is de **integrale langetermijnvisie** van de gemeenteraad op de fysieke leefomgeving van het hele grondgebied.[file:1][web:83][web:78][web:81] De visie legt de hoofdlijnen vast van de bestaande kwaliteit, gewenste ontwikkeling en het integrale beleid voor ruimte, water, milieu, natuur, landschap, mobiliteit, gezondheid, veiligheid en erfgoed, en is zelfbindend: burgers en bedrijven worden er indirect door geraakt via omgevingsplan, verordening en programma’s.[web:78][web:364][web:370]

#### Inhoudelijke scope voor Propdex

- Bepaalt per gemeente **waar groei, transformatie en behoud** zijn voorzien: prioriteitsgebieden voor woningbouw en verdichting, te beschermen landschappen, groene structuren en infrastructuurprojecten.[file:1][web:369][web:367]
- Voedt de Potentiescore door aan te geven of een perceel in een **prioriteitsgebied** ligt (hogere kans op bestuurlijke medewerking) of in een gebied met beperkingen (bijv. behoud landschap, water- en bodemsturend).[file:1][web:24][web:372]

#### Datavelden die we extraheren

A. Gebiedsindeling en gebiedstypen:

- `gebied_id` en `gebied_naam`: namen van ontwikkelgebieden/gebiedstypen (bijv. “Stationsomgeving”, “Binnenstad”, “dorpskern X”, “landelijk gebied Y”).[file:1][web:367][web:372]
- `gebied_type`: ontwikkelgebied, transformatiegebied, verdichtingsgebied, uitbreidingslocatie, consolidatie-/behoudsgebied, enzovoort.[file:1][web:267][web:371]
- `ruimtelijk_profiel`: gewenste identiteit (hoogstedelijk, centrumrand, woonwijk, gemengd, bedrijventerrein, groen/blauw).[web:364][web:267]

B. Opgaven en ambities per gebied:

- `opgave_wonen`: beoogde aantallen/indicatieve bandbreedtes woningen, segmenten (sociaal/midden/vrij; huur/koop) en eventueel doelgroepen.[file:1][web:369][web:367]
- `opgave_werken/voorzieningen`: gewenste m² bvo voor werkfuncties en voorzieningen, waar expliciet benoemd.[web:367][web:264]
- `horizon_jaar`: planhorizon (bijv. 2030/2035/2040).[web:371][web:362]
- `prioriteitsniveau`: kwalificatie (hoog/midden/laag) o.b.v. taalgebruik in de visie (speerpunt, focusgebied, lange termijn).[file:1][web:367][web:372]

C. Gemeentebrede hoofdkeuzes:

- `hoofddoelen`: kernambities (bijv. “verdichten rond OV‑knooppunten”, “groene en klimaatbestendige stad”, “betaalbare en inclusieve stad”).[web:78][web:83][web:367]
- `sturingstype`: mate van regie vs. ruimte voor initiatieven (meer regulering vs. uitnodigingsplanologie).[web:370][web:81]

#### Bronnen & automatisering

- Omgevingsvisies in CVDR via lokaleregelgeving.overheid.nl (bijv. Omgevingsvisie Venlo 2040).[file:1][web:362][web:365]
- IPLO- en VNG‑documentatie over omgevingsvisies als instrument (minimale inhoud, rol, verhouding tot programma/omgevingsplan).[web:83][web:78][web:81]
- Gemeentelijke sites / participatieportalen voor aanvullend kaartmateriaal en samenvattingen (zoals “Nu Venlo”).[web:369][web:372]

Automatisering:

- KOOP SRU‑ingest draait al voor 5 seed‑gemeenten (Venlo, Amsterdam, Utrecht, Den Haag, Rotterdam); configuratie‑uitrol naar alle 342 gemeenten gebruikt dezelfde pipeline.[file:1][web:362]
- AI‑parser die per visie:
  - gebiedstypen en ontwikkelgebieden detecteert;
  - per gebied opgave en prioriteit extraheert;
  - gemeentebrede hoofdambities per thema (wonen, mobiliteit, groen, energie) vastlegt.[file:1][web:367][web:267]

#### Business-regels / productlogica

- **Omgevingsvisie-badge** op perceelpagina: “Ligt in ontwikkel-/prioriteitsgebied X; gemeente wil hier ±Y woningen tot Z” of “Geen specifieke ontwikkelambitie, vooral behoud/kleinschalige veranderingen.”[file:1][web:24][web:369]
- In het due‑diligence rapport een paragraaf “Inpassing in omgevingsvisie” die in 2–4 zinnen samenvat hoe het plan past binnen de gemeentelijke ontwikkelrichting (plus link naar de visie).[web:78][web:367][web:372]
- Potentiescore: opslag van `prioriteitsniveau` per gebied en koppeling aan perceelscore (hoog in prioriteitsgebieden; neutraal of lager in behoud-/beperkingsgebieden).[file:1]

#### Risico’s / edge cases

- Omgevingsvisie is **beleidsrichting, geen direct werkende regel**; juridisch bindend zijn omgevingsplan/omgevingsverordening. Propdex moet dat verschil helder communiceren in de UI.[web:83][web:78][web:370]
- Detailniveau varieert sterk per gemeente; in sommige visies ontbreken expliciete aantallen of strakke gebiedsafbakening. Propdex moet “onbekend/niet gespecificeerd” kunnen tonen i.p.v. te interpoleren.[web:267][web:371]
- Overgang van oude structuurvisies naar omgevingsvisie: Propdex moet altijd de actuele, via CVDR geldende visie gebruiken en oude documenten alleen als achtergrondinformatie.[web:78][web:81]

#### Concreet actieplan (dev/data)

1. Seed‑uitrol: KOOP SRU‑ingest uitbreiden van 5 naar 342 gemeenten voor omgevingsvisies (pure configuratie).[file:1][web:362]
2. Datamodel `gemeentelijke_ontwikkelgebieden` en `omgevingsvisie_ambitie` opzetten met velden: `gemeente_id`, `gebied_id`, `gebied_type`, `opgave_wonen`, `horizon_jaar`, `prioriteitsniveau`, `hoofddoelen`.[file:1]
3. Parser‑templates voor gebiedsindeling, opgaven en hoofdambities op basis van enkele referentievisies (o.a. Venlo 2040, Utrecht, Amsterdam).[web:367][web:261]
4. UI‑component “Omgevingsvisie” toevoegen op gemeente- en perceelpagina’s met badge, kernambities en link naar het brondocument.[file:1][web:362]

### 4.2 Welstandsnota / beeldkwaliteit — welstandsnota

#### Korte beschrijving

De welstandsnota (of nota ruimtelijke/beeldkwaliteit) legt de **criteria vast voor uiterlijk en plaatsing van bouwwerken**, zodat bouwplannen kunnen worden getoetst aan “redelijke eisen van welstand”.[file:1][web:381][web:384] Onder de Omgevingswet is welstand verplaatst naar het (tijdelijke) omgevingsplan; bestaande welstandsnota’s werken via overgangsrecht als beleidsregel door en veel gemeenten gebruiken beeldkwaliteitsplannen als gebiedsgerichte uitwerking.[web:374][web:377][web:380] Gemeenten kunnen gebieden aanwijzen als welstandsvrij of met verschillende welstandsniveaus (zwaar, regulier, soepel).[web:373][web:375][web:31]

#### Inhoudelijke scope voor Propdex

- Geeft per perceel inzicht in het **welstandsniveau** (zware toets, regulier, soepel, welstandsvrij) en de belangrijkste beeldkwaliteitseisen (materiaal, massa, dakvorm, kleur) voor dat gebied.[file:1][web:373][web:375]
- Helpt ontwikkelaars en ontwerpers inschatten hoeveel ontwerpvrijheid er is en welke extra eisen gelden in bijvoorbeeld beschermde stads-/dorpsgezichten, historische linten of zichtlocaties.[web:376][web:384][web:385]

#### Datavelden die we extraheren

A. Gebiedsindeling en welstandsniveaus:

- `welstandsgebied_id` en `welstandsgebied_naam`: indeling in bijzondere, normale, buitengebied- en welstandsvrije gebieden.[web:375][web:378][web:381]
- `welstandsniveau`: zware toetsing / regulier / soepel / welstandsvrij (of gelijkwaardige lokale typologie).[web:373][web:386][web:31]
- `relatie_erfgoed`: flags voor overlap met rijks- of gemeentelijke monumenten en beschermde stads-/dorpsgezichten (hier meestal zwaarder niveau).[web:376][web:380]

B. Algemene en gebiedsgerichte criteria:

- `algemene_criteria`: schaal/maatverhoudingen, relatie met omgeving, materialisering, dakvorm, gevelopbouw, detaillering, enzovoort.[web:375][web:378]
- `gebiedsgerichte_criteria`: extra eisen per gebied (bijv. baksteen verplicht, dakhelling 35–55°, rooilijn, goot- en bouwhoogte, kaprichting, erfafscheidingen).[web:375][web:384]
- `sneltoetscriteria`: gestandaardiseerde regels voor kleine ingrepen (dakkapellen, erkers, bijgebouwen) die ambtelijk kunnen worden afgedaan.[web:375][web:376][web:384]

C. Procedurele aspecten (beperkt voor Propdex):

- `welstandsvrij_ja_nee`: of een perceel (of type bouwwerk op die locatie) geheel welstandsvrij is verklaard.[web:31][web:382]
- Optioneel: `adviescommissie_aanwezig` (ja/nee) en rol (Adviescommissie Omgevingskwaliteit / welstandscommissie), voor context.[web:31][web:377]

#### Bronnen & automatisering

- Welstandsnota’s / nota ruimtelijke kwaliteit in CVDR via lokaleregelgeving.overheid.nl (ca. 60–75% dekking), aangevuld met PDF’s op gemeentelijke websites.[file:1][web:381][web:378]
- Beeldkwaliteitsplannen en nota’s ruimtelijke kwaliteit voor ontwikkellocaties (vaak als bijlage bij bestemmingsplan/tijdelijk omgevingsplan of als afzonderlijk beleidsdocument).[web:375][web:383][web:384]
- Achtergrond: vakinformatie over welstand onder de Omgevingswet en overgangsrecht (welstandsnota = beleidsregel op grond van art. 4.19 Ow).[web:374][web:377][web:380]

Automatisering:

- KOOP SRU‑title search (“welstandsnota”, “nota ruimtelijke kwaliteit”, “nota beeldkwaliteit”) in CVDR, zelfde ingest‑techniek als omgevingsvisie.[file:1][web:381]
- AI‑parser die per welstandsnota:
  - welstandsgebieden en ‑niveaus extraheert (inclusief welstandsvrij);
  - algemene en gebiedsgerichte criteria samenvat in machineleesbare tags;
  - sneltoetscriteria herkent voor standaardbouwvormen (dakkapel, bijgebouw, etc.).[web:373][web:375][web:378]

#### Business-regels / productlogica

- **Welstandsbadge** op perceelpagina:
  - “Welstandsniveau: zwaar/regulier/soepel/welstandsvrij; gebied: [naam].”
  - Bij zwaar: korte duiding (“extra aandacht voor materiaalgebruik, dakvorm, historisch straatbeeld”).[file:1][web:373][web:31]
- In het rapport een blok “Welstand & beeldkwaliteit” met:
  - welstandsgebied, niveau en kerncriteria;
  - of het perceel in een welstandsvrij gebied ligt;
  - verwijzing naar beeldkwaliteitsplan als er een project-/gebiedsplan is.[web:375][web:383][web:384]
- Potentie-/Risicoscore: op zichzelf neutraal, maar hogere **complexiteits-/kostenindicatie** bij zwaar welstandsniveau in combinatie met erfgoed; lagere complexiteit bij welstandsvrij.[file:1][web:373][web:380]

#### Risico’s / edge cases

- Onder de Omgevingswet verschuift welstand naar **omgevingskwaliteit** in het omgevingsplan; bestaande welstandsnota’s werken via overgangsrecht door als beleidsregelkader. Propdex moet de status (oude nota vs. nieuw omgevingsplan‑kader) tonen.[web:374][web:377][web:382]
- Terminologie en opbouw verschillen sterk tussen gemeenten (welstandsniveaus, gebiedsnamen, combinatie met beeldkwaliteitsplannen); het datamodel moet generiek, maar tolerant zijn voor lokale varianten.[web:375][web:381][web:384]
- Welstand snijdt in principe niet in bouwrechten (die zitten in omgevingsplan), maar kan projecten ontwerptechnisch en kostenmatig sterk sturen; de UI moet dat nuanceverschil goed uitleggen.[web:377][web:385]

#### Concreet actieplan (dev/data)

1. CVDR‑auto‑ingest voor welstandsnota’s activeren, met title‑filters op “welstandsnota”, “nota ruimtelijke kwaliteit”, “nota beeldkwaliteit”.[file:1][web:381]
2. Datamodel `welstandsgebied` en `welstand_criteria` opzetten met velden: `gemeente_id`, `gebied_id`, `naam`, `niveau`, `welstandsvrij`, `kerncriteria_tags`, `sneltoets_indicator`.[web:373][web:375]
3. Parser‑template trainen op enkele referentienota’s (bijv. De Bilt, Utrecht, Eemnes) om gebiedsindeling, niveaus en criteria betrouwbaar te extraheren.[web:378][web:384][web:381]
4. UI‑component “Welstand & beeldkwaliteit” integreren op perceel-/gemeentepagina, gekoppeld aan erfgoed‑ en omgevingsplaninformatie.[file:1][web:384]

### 4.3 Woonvisie / volkshuisvestingsbeleid — woonvisie

#### Korte beschrijving

De gemeentelijke woonvisie is het **kerndocument voor lokaal volkshuisvestingsbeleid**: zij beschrijft hoe de gemeente de gehele woningmarkt (sociaal, midden, vrij, huur en koop) wil ontwikkelen in de komende jaren.[file:1][web:93][web:90] Sinds de Woningwet‑wijziging (2022) is een woonvisie verplicht en mag deze maximaal een horizon van vijf jaar hebben; de woonvisie vormt de basis voor prestatieafspraken met corporaties en andere partijen.[web:93][web:90][web:391] Met de Wet Versterking Regie op de Volkshuisvesting (Wvrv) wordt de woonvisie juridisch opgevolgd door een **verplicht volkshuisvestingsprogramma** onder de Omgevingswet, maar inhoudelijk gaat het nog steeds om hetzelfde type volkshuisvestingsagenda.[web:389][web:387][web:123]

#### Inhoudelijke scope voor Propdex

- Bepaalt per gemeente **hoeveel en welk type woningen** men wil bouwen (aantallen per jaar, segmenten sociaal/midden/vrij, huur/koop) en welke doelgroepen prioriteit krijgen (starters, ouderen, aandachtsgroepen, middeninkomens).[file:1][web:240][web:392][web:396]
- Helpt inschatten in hoeverre een concreet initiatief **past binnen de lokale woonagenda**: projecten die bijdragen aan de gewenste segmenten/locaties hebben meer kans op medewerking en steun in prestatieafspraken en regionale Woondeals.[file:1][web:90][web:395][web:240]

#### Datavelden die we extraheren

A. Kwantitatieve bouwopgave:

- `totaal_woningbouwopgave_horizon`: aantal extra woningen binnen de looptijd (vaak 5–10 jaar, bv. 2019–2030 met actualisatie 2025).[file:1][web:240][web:390]
- `woningbouwopgave_per_jaar` en waar mogelijk per deelgebied/wijk.[web:396][web:392][web:393]
- `segmentverdeling`: aandeel sociale huur, middenhuur, vrijesectorhuur en koop (bijv. streven naar 30% sociale huur in nieuwbouw, extra middenhuur).[web:240][web:392][web:395]

B. Kwalitatieve opgave en doelgroepen:

- `doelgroepenbeleid`: aandachtsgroepen (bijv. statushouders, spoedzoekers, dak-/thuislozen), ouderen, starters, gezinnen, mensen met zorgvraag, woonwagenbewoners.[web:392][web:240][web:394]
- `woonmilieus`: gewenste typen woonmilieu (stedelijk, dorps, landelijk, groen, centrum, gemengd) en spreiding over kernen/wijken.[web:392][web:396]
- `bestaande_voorraad`: gewenste ingrepen in de bestaande voorraad (transformatie, herstructurering, splitsen/samenvoegen, woningverbetering, verduurzaming, beter benutten).[web:240][web:392][web:393]

C. Relaties met andere instrumenten:

- `koppeling_woondeals`: verwijzingen naar regionale Woondeals en aantallen die lokaal zijn afgesproken (bijv. 30% sociaal in nieuwbouw, bijdrage aan regionale opgave).[web:240][web:66][web:395]
- `uitvoeringsprogramma/volkshuisvestingsprogramma`: eventuele koppeling naar uitvoeringsprogramma’s of (toekomstig) volkshuisvestingsprogramma onder de Omgevingswet.[web:389][web:387][web:123]

#### Bronnen & automatisering

- Woonvisies in CVDR via lokaleregelgeving.overheid.nl (bijv. “Woonvisie 2019‑2030, actualisatie 2025” van Montfoort).[file:1][web:388][web:240]
- Woonvisie‑PDF’s op gemeentelijke websites of via raadsinformatiesystemen (bijv. Culemborg, Eijsden‑Margraten, Bronckhorst, Duiven).[web:394][web:392][web:396][web:387]
- Achtergrondkaders: VNG‑Raadgever Woningwet, VolkshuisvestingNederland‑pagina over woonvisies en IPLO‑pagina over het volkshuisvestingsprogramma.[web:93][web:90][web:389][web:391]

Automatisering:

- KOOP SRU‑ingest van woonvisies als “beleidsregel” in CVDR; dekking nu ca. 40–60%, dus aanvullende scraping van gemeentelijke websites/raadsinformatie nodig voor volledige dekking.[file:1][web:388][web:392]
- AI‑parser die per woonvisie:
  - kwantitatieve bouwopgave en segmentverdeling extraheert;
  - kwalitatieve prioriteiten en doelgroepen per kern/wijk benoemt;
  - verwijzingen naar Woondeals, prestatieafspraken en (toekomstig) volkshuisvestingsprogramma markeert.[web:240][web:392][web:393]

#### Business-regels / productlogica

- **Woonvisie-badge** op gemeente-/perceelpagina:
  - “Gemeente streeft naar X woningen t/m jaar Y, waarvan Z% sociaal en M% midden; prioriteit voor [doelgroepen] in [delen van de gemeente].”[file:1][web:240][web:392]
- In rapporten een blok “Lokale volkshuisvestingsagenda (woonvisie)” dat aangeeft:
  - of het beoogde programma (aantal, segment, doelgroep) aansluit op de woonvisie;
  - in hoeverre het plan een knelpunt oplost (tekort sociale huur, ouderenhuisvesting, starters, etc.).[web:90][web:392][web:396]
- Potentie-/Risicoscore: hogere score voor projecten die precies matchen met de gewenste segmenten/doelgroepen/locaties; neutraal of verhoogd risico waar plannen haaks staan op de woonvisie (bijv. veel dure koop waar de visie inzet op betaalbaar).[file:1][web:240][web:395]

#### Risico’s / edge cases

- De Wvrv verschuift het formele zwaartepunt van woonvisie (Woningwet) naar **volkshuisvestingsprogramma (Omgevingswet)**; Propdex moet in de UI de status van het document benoemen (woonvisie “oud regime” vs. volkshuisvestingsprogramma).[web:389][web:387][web:123]
- Woonvisies verschillen sterk qua scope (soms zeer strategisch, soms vooral uitvoeringsprogramma); parser moet zowel aantallen als kwalitatieve prioriteiten aankunnen en “niet gespecificeerd” tonen waar cijfers ontbreken.[web:391][web:392][web:396]
- In sommige gemeenten is het woonbeleid uitgesmeerd over meerdere documenten (woonvisie, woonagenda, woonzorgvisie, doelgroepenverordening); Propdex moet primair de hoofdwoonvisie als referentie nemen en overige stukken alleen als verdiepende context.[web:394][web:391][web:240]

#### Concreet actieplan (dev/data)

1. CVDR‑auto‑ingest voor woonvisies activeren, plus scraping‑fallback voor de top‑50 grootste gemeenten via websites/raadsinformatiesystemen (dekt ±80% van de markt).[file:1][web:388][web:392]
2. Datamodel `woonvisie_opgave` opzetten met velden: `gemeente_id`, `horizon_jaar`, `totaal_opgave`, `opgave_per_jaar`, `segmentverdeling`, `doelgroepen`, `koppeling_woondeal`.[file:1][web:240][web:395]
3. Parser‑templates trainen op enkele representatieve woonvisies (bijv. Montfoort, Eijsden‑Margraten, Culemborg, Bronckhorst) om cijfers en prioriteiten robuust te extraheren.[web:240][web:392][web:394][web:396]
4. UI‑component “Woonvisie / volkshuisvestingsprogramma” integreren op gemeente- en perceelpagina’s, met korte samenvatting en link naar bron, gekoppeld aan de regionale Woondeal- en Nationale Woonagenda‑lagen.[file:1][web:66][web:9]
### 4.4 Parkeerbeleid & parkeernormen — parkeerbeleid

#### Korte beschrijving

Gemeentelijk parkeerbeleid vertaalt de landelijke CROW‑parkeerkencijfers naar **juridisch toepasbare parkeernormen** per functie (wonen, werken, voorzieningen, etc.), vastgelegd in een Nota parkeernormen en/of in het (tijdelijke) omgevingsplan.[file:1][web:398][web:111] CROW‑publicaties (voorheen 381 “Toekomstbestendig parkeren”, nu 744 / Parkeerkencijfers 2024) bieden kencijfers en methodiek om per gebiedstype, stedelijkheidsgraad en functie de parkeerbehoefte en dubbelgebruik te bepalen; gemeenten zetten dit om naar eigen normen en beleidsruimte (afwijkingsmogelijkheden, bijdrageregelingen).[web:397][web:105][web:400][web:406]

#### Inhoudelijke scope voor Propdex

- Bepaalt per perceel de **formele parkeereis** bij een plan (aantal auto- en fietsparkeerplaatsen op eigen terrein) op basis van functie, programma, zone (bijv. centrum/OV‑knooppunt/buitengebied) en gemeentelijke normen.[file:1][web:398][web:111]
- Laat zien hoe streng of flexibel een gemeente met parkeren omgaat (normhoogte, dubbelgebruik, deelmobiliteit, afkoopregeling), wat direct doorwerkt in de financiële haalbaarheid (ondergrondse garage, parkeerdek, deelmobiliteitsconcept).[file:1][web:112][web:115]

#### Datavelden die we extraheren

A. Normstructuur per functie:

- `parkeernorm_auto` per functie en zone (bijv. woningen grondgebonden, appartementen, kantoren, winkels, horeca, onderwijs, zorg) in “pp per woning / per 100 m² bvo”.[web:398][web:111]
- `parkeernorm_fiets` waar opgenomen (met name bij centrum-/OV‑locaties en onderwijs/voorzieningen).[web:398]
- `zones`: centrum, schil, rest bebouwde kom, buitengebied, OV‑knooppuntzone, met bijbehorende correctiefactoren.[web:398][web:111][web:115]

B. Beleidsruimte en uitzonderingen:

- `dubbelgebruik-methodiek`: verwijzing naar CROW‑systematiek voor dubbelgebruik per dagdeel (functiemix binnen één plan).[web:398][web:399][web:405]
- `afwijkingsmogelijkheden`: voorwaarden waaronder lagere normen zijn toegestaan (bijv. nabij OV‑knooppunt, bewezen lagere autobezitdoelgroepen, deelmobiliteit).[web:111][web:404][web:112]
- `parkeerbijdrage/afkoopregeling`: hoogte en rekenwijze van de financiële bijdrage als parkeren niet (volledig) op eigen terrein kan worden opgelost.[web:398][web:111]

C. Link met CROW-kencijfers:

- `CROW_referentie`: gebruikte CROW‑publicatie (381, 744 / Parkeerkencijfers 2024) en jaargang.[web:397][web:105][web:406]
- `stedelijkheidsgraad` (CBS‑definitie) en eventuele bandbreedte (minimum–basis–maximum) in de gemeentelijke normen.[web:115][web:400]

#### Bronnen & automatisering

- Nota’s parkeernormen in CVDR via lokaleregelgeving.overheid.nl en via officiële bekendmakingen (bijv. “Nota Parkeernormen 2022”, “Nota parkeernormen 2024”).[file:1][web:398][web:111][web:404]
- Gemeentelijke beleidsregels/richtlijnen voor parkeernormen en parkeerbijdragen (soms als aparte richtlijn buiten CVDR).[web:115][web:407]
- CROW‑publicaties en kennisbank over parkeerkencijfers en parkeernormen als achterliggende methodiek (niet integraal te scrapen, maar als referentiekader).[web:399][web:105][web:400][web:406]

Automatisering:

- KOOP SRU‑ingest van gemeentelijke nota’s parkeernormen uit CVDR, met title‑filters op “Nota parkeernormen”, “parkeernota”, “parkeerbeleid”.[file:1][web:398][web:111]
- AI‑parser die per nota:
  - tabel(len) met auto‑ en fietsparkeernormen per functie/zone extraheert;
  - dubbelgebruik- en afwijkingsregels (deelmobiliteit, OV‑nabijheid, maatwerk) als logische regels vastlegt;
  - eventuele bijdrage-/afkoopregelingen en normbasis (CROW‑publicatie, stedelijkheidsgraad) identificeert.[web:398][web:399][web:115]

#### Business-regels / productlogica

- **Parkeerbadge** op perceel-/projectpagina:
  - “Verwachte parkeereis: X–Y pp (auto) en Z pp (fiets) op basis van huidige programma en gemeentelijke normen; zone: [centrum/OV/bebouwde kom/buitengebied].”[file:1][web:398][web:111]
- In het rapport een blok “Parkeren & mobiliteit” met:
  - berekende parkeereis (incl. dubbelgebruik en bezoekersdeel);
  - financiële impact (globale bandbreedte bouwkosten parkeren) voor de businesscase;
  - expliciete aandachtspunten over afwijkingsruimte/deelmobiliteit (bijv. of lager normniveau verdedigbaar is).[file:1][web:112][web:399]
- Potentie-/Risicoscore: hogere risico’s bij hoge normen in verdichte centra (ondergrondse garages nodig) en lagere risico’s waar de gemeente expliciet lage normen/deelmobiliteit/OV‑knooppuntenbeleid hanteert.[file:1][web:112][web:398]

#### Risico’s / edge cases

- Veel gemeenten werken nog met **verouderde normen** gebaseerd op oudere CROW‑kencijfers (CROW 317/381); deze zijn vaak aan de hoge kant t.o.v. actuele mobiliteitsontwikkelingen.[web:112][web:403] Propdex moet jaargang en basis duidelijk tonen.
- Parkeernormen zijn vaak vastgelegd in beleidsregels of het omgevingsplan; de formele juridische borging ligt niet altijd uitsluitend in de Nota parkeernormen. UI moet aangeven dat berekeningen indicatief zijn en dat detailcontrole tegen het geldende omgevingsplan nodig is.[web:111][web:374]
- Lokale uitzonderingen (autoluwe zones, parkeerregulering, bestaande tekorten) kunnen maken dat feitelijke parkeervraag en handhaving afwijken van de theoretische norm; Propdex kan dit niet volledig modelleren, maar kan wel waarschuwingen tonen bij structureel hoge parkeerdruk (later via NDW/observatiegegevens).[web:111][web:406]

#### Concreet actieplan (dev/data)

1. CVDR‑auto‑ingest voor Nota’s parkeernormen activeren en een eerste set top‑50 gemeenten inlezen (grootste ontwikkelvolumes).[file:1][web:398][web:111]
2. Datamodel `parkeernorm` opzetten met velden: `gemeente_id`, `functie`, `zone`, `norm_auto`, `norm_fiets`, `basis_CROW`, `stedelijkheidsgraad`, `dubbelgebruik_flag`, `afwijkingsmogelijkheden`, `parkeerbijdrage`.[file:1][web:398][web:115]
3. Een rekenmodule in Propdex bouwen die, gegeven het programma per perceel (woningen per type, m² bvo per functie), de parkeereis uitrekent incl. dubbelgebruik en scenario’s met deelmobiliteit/OV‑nabijheid.[file:1][web:399][web:400]
4. UI‑component “Parkeren & mobiliteit” integreren in perceelrapporten en scenario‑analyse, met duidelijke disclaimer over indicatief karakter en verwijzing naar de actuele gemeentelijke stukken.[web:398][web:111]

### 4.5 Huisvestingsverordening — huisvestingsverordening

#### Korte beschrijving

De huisvestingsverordening is het instrument waarmee de gemeenteraad op grond van de **Huisvestingswet 2014** regels kan stellen over woonruimteverdeling en het beheer van de woonruimtevoorraad.[file:1][web:414][web:420] De verordening kan o.a. een vergunningplicht invoeren voor woonruimteverdeling (huisvestingsvergunning) en voor wijzigingen in de voorraad (onttrekking, samenvoeging, omzetting/verkamering, woningvorming/splitsing) én bevat sinds 2022 de lokale uitwerking van de **opkoopbescherming** (verhuurvergunning bij recente aankoop).[web:414][web:415][web:408][web:421]

#### Inhoudelijke scope voor Propdex

- Bepaalt per perceel of er **extra vergunningplichten** gelden bij transformatie, verkamering, splitsing of verhuur na aankoop (opkoopbescherming), bovenop de omgevingsvergunning.[file:1][web:415][web:418]
- Maakt zichtbaar of een locatie in een **schaarste-/focusgebied** ligt voor woonruimteverdeling, kamerverhuur en opkoopbescherming, wat direct invloed heeft op de haalbaarheid en timing van investerings- en herontwikkelingsplannen.[file:1][web:409][web:416][web:414]

#### Datavelden die we extraheren

A. Woonruimteverdeling (huisvestingsvergunning):

- `huisvestingsvergunning_plichtig` (ja/nee) voor bepaalde huursegmenten (meestal sociale huur tot liberalisatiegrens, soms middenhuur) in aangewezen wijken/buurten.[web:414][web:417][web:415]
- `criteria_toewijzing`: o.a. inkomensgrenzen, passendheidscriteria, voorrangsgroepen (urgentiecategorieën, lokale binding, aandachtsgroepen).[web:414][web:417]
- `maximale_duur_verordening` (4 jaar, verlengbaar) en `motivering_schaarste` (wet vereist onderbouwing van woningmarktschaarste).[web:414][web:420]

B. Wijzigingen woonruimtevoorraad (art. 21 Hw):

- `vergunningplicht_onttrekking`: of onttrekken van woonruimte (bijv. toeristische verhuur, kantoren, short stay) vergunningplichtig is.[web:415][web:411][web:418]
- `vergunningplicht_omzetting/verkamering`: omzetting van zelfstandige naar onzelfstandige woonruimte (kamers) en de criteria (fysiek, leefbaarheid, maximumaantallen).[web:411][web:412][web:418]
- `vergunningplicht_splitsing/woningvorming`: eisen bij splitsen in appartementsrechten of woningvorming (bijv. minimale oppervlaktes, behoud betaalbare voorraad).[web:411][web:415]

C. Opkoopbescherming (tijdelijke regeling in de Hw):

- `opkoopbescherming_gebied` (ja/nee) per wijk/buurt: aangewezen gebieden waar recent aangeschafte koopwoningen niet zonder vergunning mogen worden verhuurd gedurende max. 4 jaar na levering.[web:409][web:410][web:421]
- `segmentgrens`: WOZ‑ of koopprijzen waarbinnen woningen onder opkoopbescherming vallen (meestal goedkoop/midden, vaak gekoppeld aan NHG‑grens).[web:409][web:413][web:419]
- `vergunning_uitzonderingen`: wettelijk verplichte uitzonderingen (familie in eerste/tweede graad, tijdelijke verhuur eigen woning, combinatie met bedrijfsruimte) en lokale uitzonderingen (bijv. corporaties, zorgaanbieders).[web:410][web:421][web:422]

#### Bronnen & automatisering

- Huisvestingsverordeningen in CVDR via lokaleregelgeving.overheid.nl, vaak inclusief bijlagen met kaarten van aangewezen gebieden en segmentafbakening.[file:1][web:411][web:417]
- Toelichtingen en onderbouwingen (bijv. “Plan van aanpak opkoopbescherming”, memorie van toelichting, onderbouwing schaarste en leefbaarheid) als extra context voor criteria en gebiedsafbakening.[web:415][web:416][web:420]
- Achtergrondkaders: Aedes/VNG‑documentatie over Huisvestingswet 2014, opkoopbescherming en jurisprudentie rond omzettingsvergunning/leefbaarheidscriterium.[web:414][web:408][web:412][web:418]

Automatisering:

- KOOP SRU‑ingest van huisvestingsverordeningen uit CVDR (werkt al voor 5 seed‑gemeenten; uitrol naar 342 is grotendeels configuratie).[file:1][web:417]
- AI‑parser die per verordening:
  - aangewezen **wijken/buurten** en segmenten voor woonruimteverdeling, voorraadbeheer en opkoopbescherming extraheert;
  - vergunningcategorieën en weigerings-/toetsingsgronden (fysiek, leefbaarheid, schaarste) structureert;
  - kaarten koppelt aan geometrie (wijkpolygonen) via referenties naar CBS‑wijken of gemeentelijke wijkindeling.[web:411][web:415][web:416]

#### Business-regels / productlogica

- **Huisvestings-badge** op perceelpagina:
  - “Ligt in gebied met opkoopbescherming (WOZ ≤ X); verhuur na aankoop vergunningplichtig.”
  - “Omzetting naar kamerverhuur/onttrekking/splitsing vergunningplichtig; streng leefbaarheid/voorraad‑kader.”[file:1][web:409][web:411][web:415]
- In het due‑diligence rapport een sectie “Huisvestingsverordening & woningvoorraadbeheer” met:
  - overzicht van relevante vergunningplichten (huisvesting, omzetting, onttrekking, splitsing, opkoop);
  - korte duiding van risico’s voor het beoogde scenario (buy‑to‑let, verkamering, transformatie, splitsing).[web:414][web:418][web:421]
- Potentie-/Risicoscore: verhoogd risico bij buy‑to‑let in opkoopbeschermingsgebieden of bij plannen die zwaar leunen op verkamering/onttrekking in streng gereguleerde wijken; neutraal waar geen huisvestingsverordening of alleen lichte regels gelden.[file:1][web:409][web:415]

#### Risico’s / edge cases

- De Huisvestingswet vereist dat verordeningen **schaarste en noodzaak** onderbouwen; waar de onderbouwing zwak is, kan jurisprudentie bepalingen onverbindend verklaren (zoals bij sommige omzettingsvergunningen).[web:414][web:412][web:418] Propdex moet daarom de datum en status tonen en waar mogelijk jurisprudentie‑alerts koppelen.
- Niet elke gemeente heeft een huisvestingsverordening; in die gevallen gelden geen extra huisvestingsvergunningen of opkoopbescherming, behalve wat via andere instrumenten is geregeld.[web:415][web:417]
- Veel verordeningen bevatten complexe gebiedsafbakening en segmentcriteria; Propdex moet conservatief zijn (geen pseudo‑precisie) en waar nodig “nader juridisch onderzoek aanbevolen” aangeven.[web:411][web:420]

#### Concreet actieplan (dev/data)

1. Bestaande huisvestingsverordenings‑ingest (seed 5 gemeenten) uitbreiden naar 342 gemeenten via KOOP SRU, met focus op verordeningen die gebruik maken van opkoopbescherming en voorraadbeheer.[file:1][web:417]
2. Datamodellen `huisvestingsgebied` en `huisvestingsregel` opzetten met velden: `gemeente_id`, `gebied_id`, `type_regime` (verdeling/voorraad/opkoop), `segment`, `vergunningplicht` (ja/nee), `kerncriteria`.[file:1][web:411][web:415]
3. Parser‑templates trainen op representatieve verordeningen (grote steden + middelgrote gemeenten) voor robuuste extractie van gebiedsafbakening, vergunningplichten en opkoopbeschermingsparameters.[web:409][web:411][web:416][web:421]
4. UI‑component “Huisvestingsverordening” integreren in Propdex, met duidelijke legenda (geen / licht / middel / zwaar regime) en koppeling aan scenario’s (buy‑to‑let, kamerverhuur, transformatie, splitsing).[file:1][web:414][web:409]

### 4.6 Vergunning-klimaat — vergunning-klimaat

#### Korte beschrijving

Vergunning‑klimaat is géén afzonderlijk beleidsdocument, maar een **afgeleide indicator** die Propdex zelf berekent op basis van alle omgevingsvergunning‑bekendmakingen per gemeente in de afgelopen 12 maanden.[file:1] Deze indicator geeft o.a. het goedkeuringspercentage, de gemiddelde doorlooptijd en het volume van vergunningsbesluiten weer en draait live op de dataset **Officiële bekendmakingen** via het SRU‑koppelvlak van overheid.nl.[file:1][web:429][web:426][web:435][web:432][web:436]

#### Inhoudelijke scope voor Propdex

- Geeft per gemeente een **feitelijke “temperatuur”** van het vergunningenbeleid: hoe snel en hoe vaak vergunningen worden verleend of geweigerd (omgevingsvergunning, omgevingsplanactiviteit/bouw, andere relevante besluiten).[file:1][web:424][web:425]
- Helpt ontwikkelaars en investeerders onderscheid maken tussen gemeenten met een relatief **coöperatief en voorspelbaar vergunning‑klimaat** en gemeenten waar procedures langer duren of vaker stranden.[file:1][web:427][web:430]

#### Datavelden die we afleiden

Voor een glijdend venster van bijvoorbeeld 12 maanden per gemeente:

- `aantal_bekendmakingen_vergunningen`: totaal aantal relevante bekendmakingen (verleend, geweigerd, ontwerpbesluiten) m.b.t. omgevingsvergunningen.[file:1][web:429][web:436]
- `goedkeuringspercentage`: aandeel verleende t.o.v. alle definitieve besluiten (verleend + geweigerd).[file:1][web:425][web:431]
- `gemiddelde_doorlooptijd`: gemiddelde tijd tussen ontvangst aanvraag (indien beschikbaar in publicatie) en bekendmaking van het besluit.[file:1][web:424][web:427]
- Optioneel: `aandeel_weigeringen` en `aandeel_ontwerpbesluiten` als extra signaal voor juridisch/planologisch spanningsveld.[file:1][web:425][web:437]

#### Bronnen & automatisering

- **Officiële bekendmakingen** (Staatscourant, Gemeenteblad, Provincieblad etc.) via de SRU‑interface van overheid.nl (collectie “officiële publicaties”).[file:1][web:429][web:426][web:435][web:432][web:436]
- Interne Propdex‑parser voor het herkennen en classificeren van omgevingsvergunning‑gerelateerde bekendmakingen (verleend, geweigerd, ontwerp, ingetrokken, etc.).[file:1][web:425][web:430]

Automatisering:

- SRU‑queries per gemeente (bevoegd gezag) en tijdvenster (bijv. `dt.publication >= now‑12m`) om alle omgevingsvergunning‑publicaties als XML op te halen.[web:426][web:429][web:435]
- Klassificatie van publicaties naar type besluit (verleend/weigering/ontwerp) op basis van titel en samenvatting.[web:425][web:431][web:430]
- Aggregatie tot gemeentelijke statistieken (volume, doorlooptijd, goedkeuringspercentage) in een rolling window (bijv. laatste 12 maanden). CBS‑methodiek voor “verleende vergunningen” biedt referentie voor datadefinities.[web:424]

#### Business-regels / productlogica

- **Vergunning‑klimaatbadge** op gemeente‑pagina:
  - “Goedkeuringspercentage laatste 12 maanden: X% (Y vergunningen, gemiddelde doorlooptijd Z dagen).”[file:1]
- In rapporten een korte paragraaf “Vergunning‑klimaat gemeente” die aangeeft:
  - of de gemeente relatief snel/langzaam en soepel/streng lijkt t.o.v. landelijke of regionale gemiddelden;
  - dat dit gebaseerd is op feitelijke bekendmakingen, niet op reputatie.[file:1][web:424][web:433]
- Potentie-/Risicoscore: hogere score bij gemeenten met hoog goedkeuringspercentage én redelijke doorlooptijd; extra risicofactor waar weigeringen frequent zijn of procedures structureel lang duren.[file:1][web:425][web:427]

#### Risico’s / edge cases

- Niet alle aspecten van een vergunningprocedure zijn zichtbaar in de publicatie; ontwerpbesluiten, aanhoudingsbesluiten en intrekkingen kunnen moeilijker te classificeren zijn.[web:425][web:437]
- Wijzigingen in publicatiepraktijk (bijv. alleen elektronische bekendmaking, gewijzigde sjablonen) kunnen invloed hebben op de meetbaarheid; Propdex moet SRU‑filters en tekstclassificatie periodiek valideren.[web:427][web:432][web:433]
- Indicator is **relatief en historisch**: een hoog goedkeuringspercentage betekent niet dat elk nieuw plan kansrijk is; context (bijv. grote reeks kleine dakkapellen) kan de cijfers vertekenen. UI moet dit als signaal, niet als garantie presenteren.[file:1][web:430]

#### Concreet actieplan (dev/data)

1. SRU‑koppeling naar collectie Officiële publicaties configureren (zoek.officielebekendmakingen.nl/sru) met filters op bevoegd gezag (gemeente), periode en omgevingsvergunning‑relevante zoektermen.[web:426][web:429][web:435]
2. Een classificatiemodule bouwen (regex + AI) die bekendmakingen labelt als “verleend”, “geweigerd”, “ontwerpbesluit” of “overig” en waar mogelijk de datum van aanvraag en besluit uit de tekst extraheert.[web:425][web:431][web:430]
3. Aggregatielaag `vergunning_klimaat` per gemeente implementeren met rolling 12‑maands statistieken (volume, goedkeuringspercentage, gemiddelde doorlooptijd).[file:1][web:424]
4. UI‑visualisatie op gemeente‑ en rapportniveau toevoegen met badge, korte toelichting en een link naar een lijst van recente individuele bekendmakingen voor detail‑inspectie.[file:1][web:433]

### 4.7 Jurisprudentie AI-analyse — jurisprudentie

#### Korte beschrijving

Dit is een **afgeleide bron**: Propdex leest uitspraken van rechtbanken en de Afdeling bestuursrechtspraak (Raad van State) over omgevingsrecht en omgevingsvergunningen en analyseert deze met AI.[file:1] De Rechtspraak stelt daarvoor gepseudonimiseerde uitspraken en ECLI‑metadata beschikbaar via een RESTful open‑data webservice en dataset “Uitspraken rechtspraak.nl”.[web:438][web:441][web:450][web:451] Propdex filtert op omgevingsrechtelijke zaken (omgevingsvergunningen, omgevingsplan, natuur/stikstof) en koppelt uitspraken aan gemeenten.

#### Inhoudelijke scope voor Propdex

- Geeft per gemeente inzicht in **hoe vaak en waarom** omgevingsvergunning‑besluiten sneuvelen of standhouden bij de rechter (o.a. parkeernormen, stikstof, geluid, welstand, belangenafweging).[file:1][web:440][web:442][web:445]
- Ondersteunt ontwikkelaars bij **risico-inschatting**: welke bezwaar‑ en beroepsgronden hebben in de recente jurisprudentie kans van slagen, en waar zitten structurele kwetsbaarheden in gemeentelijke besluitvorming.[file:1][web:440][web:448]

#### Datavelden die we afleiden

Per uitspraak (ECLI) en geaggregeerd per gemeente:

- `ECLI`, `instantie`, `datum_uitspraak`, `rechtsgebied` (omgevingsrecht), `procedure_type` (beroep, hoger beroep, voorlopige voorziening), `gemeente`.[web:441][web:438][web:450]
- `type_besluit`: omgevingsvergunning (bouwen/afwijken/activiteiten), omgevingsplan, handhaving, natuurvergunning, etc.[web:440][web:442][web:445]
- `uitkomst`: beroep gegrond/ongegrond, vernietiging/bevestiging vergunningbesluit, voorlopige voorziening toegewezen/afgewezen.[web:440][web:442][web:443][web:449]
- `dominante_argumenten`: door AI geclassificeerde hoofdgronden (bijv. parkeren, stikstof/Natura 2000, geluid, welstand/beeldkwaliteit, goede ruimtelijke ordening/evenwichtige toedeling, bevoegd gezag/procedurefout).[web:440][web:442][web:446]

Geaggregeerde indicatoren (rolling window, bijv. 3 jaar):

- `aantal_omgevingsrechtuitspraken_met_gemeente` (volume).
- `aandeel_vernietigingen` vs. bevestigingen van besluiten.[web:440][web:442][web:445]
- `top_3_bezwaargronden` waarop besluiten het vaakst sneuvelen.[file:1][web:440][web:448]

#### Bronnen & automatisering

- Open‑data webservice van de Rechtspraak (dataset “Uitspraken rechtspraak.nl”) voor ECLI‑index en uitspraakteksten in XML.[web:438][web:441][web:444]
- Publieke portals rechtspraak.nl/uitspraken en Raad van State voor validatie en sampling.[web:450][web:451][web:442]

Automatisering:

- Periodieke query op open‑data API met filters op rechtsgebied (omgevingsrecht / bestuursrecht), relevante instanties en datum, gevolgd door ophalen van de bijbehorende uitspraakdocumenten.[web:438][web:441][web:444]
- NLP/AI‑pipeline die:
  - gemeente en besluittype uit de tekst herkent;
  - de kern van het geschil (bezwaargronden) samenvat;
  - de uitkomst (gegrond/ongegrond, vernietigd/bevestigd) structureert.[file:1][web:440][web:442]

#### Business-regels / productlogica

- **Jurisprudentie-badge** op gemeente‑pagina:
  - “Laatste 12 maanden: X omgevingsrechtuitspraken, Y% bevestiging, Z% vernietiging; meest voorkomende onderwerpen: stikstof/parkeren/geluid/…”[file:1][web:440][web:442]
- In rapporten een blok “Jurisprudentie & risico’s” dat:
  - relevante recente uitspraken met vergelijkbare casus (bijv. woningbouw met stikstof, parkeernormen, welstand) in dezelfde gemeente of regio aanhaalt;
  - aangeeft welke typen argumenten in vergelijkbare zaken wel/niet slagen.[web:440][web:442][web:446][web:449]
- Potentie-/Risicoscore: extra risicofactor voor gemeenten waar de combinatie van bepaald beleid (bijv. heel strikte parkeereisen, ruimhartig stikstofbeleid) herhaaldelijk bij de rechter sneuvelt.[file:1][web:440][web:448]

#### Risico’s / edge cases

- Niet alle uitspraken worden gepubliceerd; openbaar gemaakte uitspraken zijn een selectie en kunnen **selectiebias** bevatten (belangrijke/complexe zaken).[web:438][web:441][web:450]
- AI‑classificatie van “dominante argumenten” blijft interpretatie; Propdex moet dit expliciet als indicatieve analyse tonen en gebruikers naar de brontekst laten doorklikken voor detail.[file:1][web:440][web:444]
- Overgangsrecht en veranderende wetgeving (van Wabo/Wro naar Omgevingswet/Bkl/Bbl) kunnen maken dat oudere uitspraken minder direct toepasbaar zijn; Propdex moet jaargang en toepasselijk recht expliciet markeren.[web:440][web:448][web:445]

#### Concreet actieplan (dev/data)

1. Open‑data koppeling met de Rechtspraak API implementeren en een filterset definiëren voor omgevingsrecht en relevante instanties (Rb, ABRvS, eventueel voorzieningenrechters).[web:438][web:441][web:444]
2. Datamodel `jurisprudentie_omgevingsrecht` opzetten met velden: `ECLI`, `instantie`, `datum`, `gemeente`, `besluittype`, `uitkomst`, `dominante_argumenten`.[file:1][web:441][web:440]
3. AI‑pipeline trainen op gelabelde voorbeelden om bezwaargronden (parkeren, stikstof, geluid, welstand, GOR/ETFL, procedurele fouten) betrouwbaar te herkennen.[web:440][web:442][web:446]
4. UI‑component “Jurisprudentie gemeente” toevoegen op gemeente‑ en rapportniveau, met samenvattende statistiek plus deeplinks naar individuele uitspraken.[file:1][web:451][web:450]

### 4.8 Raadsinformatie — raadsinformatie

#### Korte beschrijving

Raadsinformatie omvat **agenda’s, vergaderstukken, besluiten, moties, amendementen en stemuitslagen** van de gemeenteraad en haar commissies.[file:1][web:454][web:460] Via het project **Open Raadsinformatie / Open Besluitvorming** worden deze gegevens als open data beschikbaar gemaakt voor ruim 300 gemeenten, provincies en waterschappen.[file:1][web:453][web:459] Propdex gebruikt deze stroom om continu te volgen welke politieke besluiten, moties en discussies relevant zijn voor wonen, bouwen, grondbeleid, mobiliteit en duurzaamheid in elke gemeente.

#### Inhoudelijke scope voor Propdex

- Biedt per gemeente een **“beleid in beweging”‑feed** op raadsniveau: aangenomen moties, besluiten en discussiestukken over woningbouw, grondbeleid, parkeernormen, energietransitie, stikstof, erfgoed, etc.[file:1][web:453][web:459]
- Geeft context aan individuele percelen en projecten: raadsbesluiten of moties over specifieke locaties, gebiedsontwikkelingen of beleidswijzigingen worden zichtbaar naast de formele plannen en verordeningen.[file:1][web:454][web:466]

#### Datavelden die we extraheren

A. Raadsdocumenten en besluiten:

- `document_type`: raadsvoorstel, besluit, motie, amendement, schriftelijke vraag, toezegging, informatienota.[web:453][web:454][web:463]
- `onderwerp/thema`: wonen, ruimtelijke ontwikkeling, grondbeleid, parkeernormen, huisvesting, stikstof, mobiliteit, duurzaamheid, erfgoed.[web:453][web:459][web:466]
- `status`: aangenomen, verworpen, ingetrokken, in behandeling; bij voorstellen: besluit genomen ja/nee.[web:460][web:463]

B. Politieke richting en impact:

- `impact_type`: beleidskader (bijv. vaststelling nota grondbeleid), opdracht/motie (college krijgt opdracht X), signaal/uitspraak (raad spreekt zich uit over stikstof/woonopgave), proces (startnotitie, participatieplan).[web:460][web:466]
- `relevantie_propdev` (boolean/score): door AI geclassificeerd op relevantie voor vastgoed/bouw (bijv. motie over kostenneutraal bouwen, reservering voor woningbouwlocatie, motie over parkeerbeleid).[web:466][web:457]

C. Technische metadata:

- `vergadering`, `agendapunt`, `datum`, `fractie`, `stemverhouding` (waar beschikbaar via ORI/Open Raadsinformatie).[web:453][web:459][web:455]

#### Bronnen & automatisering

- **Open Raadsinformatie / Open Besluitvorming** API (Open State + VNG Realisatie) voor raadsdocumenten, vergadergegevens en metagegevens van meer dan 300 gemeenten.[file:1][web:453][web:462][web:465]
- Raadsinformatiesystemen/portalen van gemeenten voor aanvullende documenten en, waar nog niet aangesloten op ORI, directe scraping (tijdelijke oplossing).[web:458][web:461]

Automatisering:

- Elastic/REST‑queries op de Open Raadsinformatie API (bijv. `api.openraadsinformatie.nl`) met filters op gemeente, datum en zoektermen (wonen, woningbouw, grond, parkeren, stikstof, energie, erfgoed).[web:453][web:455][web:462]
- AI‑classifier die documenten labelt op thema, impacttype en relevantie voor Propdex (vastgoed/bouw). Moties en besluiten met directe impact op woningbouwlocaties of regels krijgen hogere prioriteit.[file:1][web:466][web:457]

#### Business-regels / productlogica

- **Raadsinformatie-feed** op de gemeentepagina: tijdlijn met recente moties, besluiten en voorstellen die direct relevant zijn voor woningbouw, grondbeleid, mobiliteit en duurzaamheid (“beleid in beweging” lokaal).[file:1][web:453][web:459]
- In rapporten een kort blok “Raadsdynamiek & besluiten” met:
  - relevante recente moties/besluiten die het project of het beleidsterrein raken (bijv. motie ‘Kostenneutraal bouwen’ of motie over grondbeleid / lokale voorrang / opkoopbescherming);
  - status (aangenomen/verworpen) en kernopdracht aan het college.[web:466][web:460]
- Potentie-/Risicoscore: extra pluspunten waar raad expliciet woningbouw- of versnellingsmoties aanneemt, en extra politieke risico-index waar veel moties tegen bouwprojecten of weerstand in de raad zichtbaar is.[file:1][web:457][web:460]

#### Risico’s / edge cases

- Dekking is (nog) niet 100%: ongeveer 270–300 gemeenten zijn aangesloten op Open Raadsinformatie; voor overige gemeenten zijn aparte koppelingen nodig.[file:1][web:453][web:462]
- Raadsinformatie is politiek en soms weinig concreet; moties kunnen breed of symbolisch zijn. Propdex moet duidelijk aangeven dat dit **politieke signalen**, geen harde juridische kaders zijn.[web:459][web:457]
- Verschillen in kwaliteit en structuur van raadsdata tussen gemeenten kunnen parsing en classificatie bemoeilijken; periodieke tuning van zoektermen en AI‑modellen blijft nodig.[web:453][web:455][web:464]

#### Concreet actieplan (dev/data)

1. Open Raadsinformatie API integreren (Elastic/REST) en indices per deelnemende gemeente configureren.[file:1][web:453][web:455][web:462]
2. Datamodel `raadsdocument` en `raads_event` opzetten met velden: `gemeente_id`, `document_type`, `onderwerp`, `datum`, `status`, `impact_type`, `relevantie_propdev`.[file:1]
3. AI‑classifier trainen op een set gelabelde raadsdocumenten (moties/voorstellen over woningbouw, grondbeleid, parkeren, stikstof, energie, erfgoed) om relevante stukken automatisch te herkennen.[web:466][web:457][web:453]
4. UI‑component “Raadsinformatie & moties” toevoegen op gemeentepagina en in rapporten, gekoppeld aan specifieke thema’s (wonen, grond, mobiliteit, duurzaamheid) en eventueel aan percelen/gebieden.[file:1][web:459]

### 4.9 Leegstandsverordening — leegstandsverordening

#### Korte beschrijving

De leegstandsverordening is een **optioneel gemeentelijk instrument** op basis van de Leegstandwet waarmee de raad een meldplicht en aanpak kan regelen voor leegstaande woningen, kantoren en ander vastgoed.[file:1][web:474][web:477] Eigenaren moeten leegstand na een bepaalde periode (vaak 6 maanden) melden; vervolgens kan de gemeente in leegstandoverleg afspraken maken, een leegstandsbeschikking nemen en in uiterste geval een boete opleggen of de eigenaar verplichten het pand in gebruik te nemen.[web:468][web:470][web:481]

#### Inhoudelijke scope voor Propdex

- Geeft per perceel aan of er een **meldplicht leegstand** geldt (en voor welke categorieën: wonen, kantoor, winkel, maatschappelijk vastgoed).[file:1][web:468][web:480]
- Signaleert kansen voor **transformatie- en herontwikkelingsprojecten**: gemeentes met een actieve leegstandsverordening en leegstandsoverleggen staan vaak meer open voor gesprekken over herbestemming van kantoren/winkels en langdurig leegstaande woningen.[file:1][web:469][web:472][web:474]

#### Datavelden die we extraheren

A. Reikwijdte en meldplicht:

- `werkingsgebied`: geografische afbakening (hele gemeente vs. aangewezen gebieden/wijken).[web:468][web:470][web:471]
- `categorie_gebouwen`: woonruimte, kantoren, winkels/bedrijfsruimten, overige niet‑woonruimte waarop de verordening van toepassing is.[web:468][web:480][web:477]
- `meldplicht_na_maanden`: termijn waarna leegstand gemeld moet worden (meestal 6 maanden; soms varianten 6–12 maanden of korter in experimenten).[web:468][web:470][web:476]

B. Procedure en sancties:

- `leegstandsoverleg_verplicht` (ja/nee): of de gemeente na melding verplicht een leegstandsoverleg voert met de eigenaar.[web:468][web:471][web:480]
- `leegstandsbeschikking_mogelijk` (ja/nee): of de gemeente in een beschikking mag bepalen of een pand geschikt is/geschikt te maken is voor gebruik en eventueel een gebruiker voordragen.[web:474][web:477][web:481]
- `boete_maximum`: maximale bestuurlijke boete bij niet‑melden of onjuiste melding (vaak tot ca. € 7.500–9.000, met differentiatie tussen particuliere en professionele eigenaren).[web:468][web:473][web:476][web:481]

C. Nieuwe bevoegdheden (ontwikkeling):

- In pilots/nieuwe wetsvoorstellen (via Chw en aangekondigde wetswijzigingen) kunnen gemeenten extra bevoegdheden krijgen, zoals **verplichte ingebruikname** binnen een termijn en vaststelling van een maximale huurprijs in de leegstandsbeschikking.[web:478][web:472][web:477]
- Propdex houdt dit als **statusveld** bij (klassieke vs. uitgebreide leegstandsverordening) i.v.m. de verwachte uitrol richting 2026+.[web:478][web:129]

#### Bronnen & automatisering

- Leegstandsverordeningen in CVDR via lokaleregelgeving.overheid.nl + toelichtingen/raadsvoorstellen (bijv. Amsterdam, diverse middelgrote steden).[file:1][web:468][web:470][web:471]
- VNG‑Model leegstandverordening en Raadgever Leegstand als referentie voor structuur en artikelen (meldplicht, leegstandsbeschikking, boete).[web:474][web:479]
- VolkshuisvestingNederland‑pagina over Leegstandwet voor nationale kaders en toelichting.[web:477][web:472]

Automatisering:

- KOOP SRU‑title search op “Leegstandverordening” in CVDR; beperkte aantallen (±30 gemeenten nu, verwacht groei door nieuwe volkshuisvestingsinstrumenten).[file:1][web:468][web:470][web:479]
- AI‑parser die per verordening:
  - werkingsgebied en gebouwcategorieën;
  - meldtermijn, overlegverplichtingen;
  - boetehoogte en eventuele verplichting tot ingebruikname extraheert.[web:468][web:470][web:473][web:481]

#### Business-regels / productlogica

- **Leegstand-badge** op perceel-/projectpagina:
  - “Binnen leegstandsverordening: meldplicht na X maanden voor [categorie]; boete max. €Y bij niet melden; leegstandsoverleg en leegstandsbeschikking mogelijk.”[file:1][web:468][web:470][web:473]
- In rapporten een blok “Leegstand & transformatieruimte” dat:
  - aangeeft of leegstand gemeld moet worden bij uitpond/renovatie of tijdelijke leegstand;
  - duidt of gemeente actief inzet op aanpak leegstand (kans voor transformatie‑deal) of nog onderzoekend/afwezig is.[web:469][web:472][web:480]
- Potentie-/Risicoscore:
  - extra **kansfactor** waar leegstandverordening + actief beleid transformatie stimuleren;
  - extra **operationeel risico** voor beleggers met langdurig leegstaande voorraad (meldplicht, boetes, druk tot ingebruikname).[file:1][web:473][web:481]

#### Risico’s / edge cases

- Slechts een deel van de gemeenten heeft een leegstandsverordening; elders gelden alleen algemene Leegstandwet‑mogelijkheden (tijdelijke verhuur) maar geen meldplicht.[web:477][web:474]
- Instrument is in ontwikkeling: experimenten (Amsterdam/Utrecht) en nieuw wetsvoorstel kunnen bevoegdheden veranderen (van voordrachtsrecht naar verplicht ingebruikname en huurprijsmaximering); Propdex moet versies en datum van verordening en wet expliciet tonen.[web:478][web:472][web:129]
- Werkingsgebieden en categorieën verschillen sterk per gemeente; Propdex moet zorgvuldig omgaan met de afbakening (geen aannames buiten expliciet aangewezen gebieden).[web:468][web:480][web:471]

#### Concreet actieplan (dev/data)

1. CVDR‑auto‑ingest voor bestaande leegstandsverordeningen activeren (±30 gemeenten) en deze koppelen aan gemeentelijke gebieden/categorieën.[file:1][web:468][web:470][web:479]
2. Datamodel `leegstandsregime` opzetten met velden: `gemeente_id`, `gebied_id`, `categorie`, `meldtermijn_maanden`, `leegstandsoverleg`, `boete_max`, `verplichte_ingebruikname_flag`.[web:468][web:473][web:481]
3. Monitoren van wetsontwikkelingen (Leegstandwet‑aanpassing, Wet versterking regie volkshuisvesting) en nieuwe modelverordening, zodat parser/veldnamen tijdig kunnen worden geüpdatet.[web:472][web:478][web:129]
4. UI‑component “Leegstand & meldplicht” integreren op perceel- en rapportniveau, gekoppeld aan transformatie‑ en investeringsscenario’s.[file:1][web:474][web:477]

### 4.10 Gemeentelijke subsidies — gemeentelijke-subsidies

#### Korte beschrijving

Gemeenten hebben eigen **subsidies en leningen** voor o.a. verduurzaming, transformatie, starters, gevelverbetering, klimaatadaptatie en leefbaarheid.[file:1][web:486][web:494] Voorbeelden zijn duurzaamheids- en isolatiesubsidies, subsidies voor groene/gevelmaatregelen, startersleningen (vaak via SVn), transformatiesubsidies en fondsbijdragen voor centrumvernieuwing.[web:482][web:484][web:487][web:493] Er is geen landelijke, volledige openbare databank; commerciële aggregators (zoals Vindsubsidies) en themaloketten (Energiesubsidiewijzer) vullen dit gat.[file:1][web:483][web:488][web:491]

#### Inhoudelijke scope voor Propdex

- Geeft per perceel/propositie een overzicht van **gemeentelijke regelingen** die direct relevant zijn voor vastgoedontwikkelaars, beleggers en eigenaren (renovatie/transformatie, verduurzaming, openbare ruimte/gevel, starters/koop).[file:1][web:482][web:484][web:492]
- Voegt deze lokale regelingen samen met landelijke (RVO) en provinciale subsidies, zodat je per case een compleet beeld van de **financieringsmix** (subsidies en leningen) hebt.[file:1][web:483][web:289][web:485]

#### Datavelden die we extraheren

A. Regeling-metadata:

- `regeling_naam` (bijv. “Subsidie Groene Gevel”, “Subsidieregeling Stimulering verduurzaming vastgoed Maastricht”, “Gevelverbeteringssubsidie centrum”, “Starterslening gemeente X”).[web:484][web:492][web:487][web:489]
- `type`: subsidie, laagrentende lening, fondsbijdrage, starterslening, stimuleringsregeling.[web:485][web:486][web:494]
- `doelgroep`: particuliere woningeigenaren, VvE’s, beleggers/ondernemers, maatschappelijke organisaties, ontwikkelaars.[web:482][web:486][web:492]

B. Financiële parameters:

- `subsidiepercentage` en `max_bedrag`: bijv. 30–50% van de kosten tot een plafond (zoals € 1.500–€ 10.000 voor groene gevels, € 2.500 voor verduurzaming maatschappelijk vastgoed).[web:484][web:482][web:490]
- `lening_min/max`: onder- en bovengrens voor leningen (bijv. € 10.000–€ 250.000 voor verduurzamingsleningen).[web:485][web:493]
- `budget`/`pot`: totaal beschikbaar budget en “op is op”-karakter waar genoemd.[web:490][web:487][web:482]

C. Inhoudelijke criteria:

- `maatregeltypen`: isolatie, warmte‑/koelsystemen, groene/gevelmaatregelen, klimaatadaptatie, asbestsanering, herbestemming/transformatie, starterskoop, buurtinitiatieven.[web:482][web:484][web:486][web:492]
- `gebiedsgericht`: of de regeling beperkt is tot bepaalde wijken/gebieden (bijv. centrumgebieden, kwetsbare wijken, aardbevings-/krimpregio’s).[web:484][web:493][web:492]

#### Bronnen & automatisering

- Gemeentelijke subsidieportalen en themapagina’s (duurzaamheid, wonen & bouwen, centrumontwikkeling), plus lokale subsidieloketten (bijv. Den Haag, Deventer, Boxtel, Maastricht).[web:486][web:494][web:484][web:487][web:492]
- Regionale uitvoeringsorganisaties en loketten (bijv. SNN voor Drentse gemeentelijke regelingen, regionale programma’s rond isolatiesubsidies).[web:493][web:482]
- Commerciële aggregators zoals **Vindsubsidies** en adviespartijen voor decentrale overheden (zoals Subsidiebureau Nederland) voor brede dekking.[file:1][web:291][web:488]

Automatisering:

- Voor een eigen crawler is 342 × 10+ regelingen nauwelijks onderhoudbaar; Propdex richt zich daarom op:
  - een **partnership/API** met een subsidie‑aggregator (bijv. Vindsubsidies) voor gemeentelijke/provinciale vastgoed- en verduurzamingsregelingen;
  - plus selectieve scraping van grote gemeenten/regionale loketten voor cross‑check en aanvullende zichtbaarheid.[file:1][web:488][web:291]
- AI‑parser die per regeling in de feed:
  - type, doelgroep, maatregel, budget en einddatum extraheert;
  - geo‑/wijkfocus en mogelijke stapelingsrestricties signaleert.[web:482][web:484][web:492]

#### Business-regels / productlogica

- **Gemeentelijke subsidie‑badge** op perceel-/projectpagina:
  - “Er zijn X gemeentelijke regelingen van toepassing (bijv. groene/gevelsubsidies, transformatiesubsidies, startersleningen) met een geschatte bandbreedte van €Y–Z per woning/pand.”[file:1][web:484][web:487][web:492]
- In rapporten een blok “Lokale subsidies & leningen” dat:
  - de belangrijkste 3–5 regelingen toont met naam, doelgroep, maatregeltype, max. bedrag/percentage en looptijd;
  - aangeeft of de pot nog open is en of stapeling met RVO/provinciale subsidies mogelijk lijkt (indicatief, met link naar brontekst).[web:482][web:486][web:485][web:491]
- Integratie met financiële module: gemeentelijke subsidies en leningen als **reductie van de onrendabele top** of als kapitaalbron in de capex‑/financieringssheet.[file:1][web:492][web:485]

#### Risico’s / edge cases

- Er bestaat geen volledige, open landelijke databank; beschikbaarheid en actualiteit verschillen sterk per gemeente en thema.[file:1][web:491][web:483]
- Veel regelingen zijn **tijdelijk en “op is op”** en bevatten specifieke voorwaarden (doelgroepen, maatregelpakketten, inkomensgrenzen); Propdex kan alleen een eerste selectie tonen en moet duidelijk verwijzen naar de officiële regelingstekst.[web:482][web:490][web:493]
- Stapelbaarheid met andere (RVO/provinciale) subsidies is vaak complex en soms expliciet uitgesloten; Propdex moet stapeling alleen indicatief duiden en benadrukken dat definitieve beoordeling bij subsidieadviseur/uitvoerder ligt.[web:486][web:291][web:491]

#### Concreet actieplan (dev/data)

1. Data‑partnership of API‑koppeling met een subsidie‑aggregator (zoals Vindsubsidies) verkennen gericht op gemeentelijke en regionale vastgoed/duurzaamheidsregelingen.[file:1][web:488][web:291]
2. Datamodel `gemeentelijke_regeling` opzetten met velden: `gemeente_id`, `regeling_naam`, `type`, `doelgroep`, `maatregeltypen`, `subsidiepercentage`, `max_bedrag`, `looptijd`, `gebiedsgericht`.[file:1][web:492][web:484]
3. Voor de top‑50 grootste gemeenten een beperkte eigen scraping/invoer doen van belangrijke regelingen (transformatie, gevel, verduurzaming) ter validatie en verrijking van de aggregatorfeed.[file:1][web:486][web:487][web:492]
4. UI‑component “Lokale subsidies & leningen” integreren op perceel-/projectpagina en in rapporten, gekoppeld aan de RVO- en provinciale subsidieblokken.[file:1][web:483][web:485]

### 4.11 Grondprijsbeleid — grondprijsbeleid

#### Korte beschrijving

Elke gemeente publiceert jaarlijks een **grondprijzenbrief** of beleidsnotitie met richtprijzen per bestemming: sociale huur, middenhuur, vrije sector, kantoren, bedrijfsterreinen, maatschappelijk vastgoed, etc.[file:1] Deze richtprijzen vormen de basis voor grondbiedingen bij uitgifte in eigendom of erfpacht en zijn cruciaal voor de grondexploitatie en residuele berekeningen van ontwikkelaars.[file:1]

#### Inhoudelijke scope voor Propdex

- Bepaalt per perceel wat de **indicatieve gemeentelijke grondprijs** is voor een bepaald programma (sociaal/midden/vrij; woning, kantoor, bedrijventerrein), gegeven de bestemming/functie.[file:1]
- Helpt ontwikkelaars de **onderhandelingsruimte** inschatten in gesprekken met gemeenten: als Propdex de actuele bandbreedte per bestemming kent, kan de businesscase snel worden gespiegeld aan gemeentelijke grondprijsverwachtingen.[file:1]

#### Datavelden die we extraheren

A. Richtprijzen per bestemming:

- `grondprijs_sociaal_huur` (€/m² BVO of €/m² uitgeefbaar), vaak lager dan kostprijs om sociale woningbouw mogelijk te maken.[file:1]
- `grondprijs_middenhuur` en `grondprijs_vrije_sector_wonen` met mogelijke bandbreedte (bijv. binnenstad vs. schil vs. buitengebied).[file:1]
- `grondprijs_kantoren`, `grondprijs_bedrijfsterrein`, `grondprijs_winkel/centrum`, `grondprijs_maatschappelijk_vastgoed` waar opgenomen.[file:1]

B. Systematiek en indexering:

- `prijsbasis`: of prijzen zijn opgegeven in €/m² BVO, €/m² GBO, €/m² uitgeefbaar, of per woningtype.[file:1]
- `horizon_jaar` en `indexatie`: jaargang van de grondprijzenbrief (bijv. “Grondprijzen 2025”) en eventuele indexatieformule (bijv. gekoppeld aan inflatie of bouwkostenindex).[file:1]
- `gebiedsdifferentiatie`: aparte prijzen voor centrum, schil, kernen, uitleglocaties, bedrijventerreinen, etc.[file:1]

C. Beleidsruimte:

- `afwijkingsbeleid`: ruimte om af te wijken (bijv. bij uitzonderlijke maatschappelijke meerwaarde of complexe binnenstedelijke herstructurering).[file:1]
- `relatie_met_woonbeleid`: of grondprijzen bewust gedifferentieerd worden om sociale/middenhuur te stimuleren of bepaalde doelgroepen te huisvesten.[file:1]

#### Bronnen & automatisering

- Grondprijzenbrieven en notities grondbeleid in CVDR en op gemeentelijke websites (PDF), vaak jaarlijks geactualiseerd in januari/februari.[file:1]
- Soms integrale nota grondbeleid waarin de grondprijssystematiek is opgenomen, met jaarlijkse bijlage met concrete bedragen.[file:1]

Automatisering:

- KOOP SRU‑ingest op titelwoorden als “grondprijzenbrief”, “grondprijsbeleid”, “nota grondprijzen” in CVDR; aanvullende scraping van gemeentelijke websites voor gemeenten waar dit niet in CVDR staat.[file:1]
- AI‑parser die tabellen met richtprijzen per bestemming/gebied inleest, de gebruikte eenheden herkent (€/m² BVO vs. uitgeefbaar) en omzet naar een gestandaardiseerd intern formaat.[file:1]

#### Business-regels / productlogica

- **Grondprijs-badge** op perceel-/projectpagina:
  - “Indicatieve gemeentelijke grondprijs (jaar X): sociaal €A/m², middenhuur €B/m², vrije sector €C/m² voor deze locatie/zone.”[file:1]
- In de financiële module een blok “Gemeentelijke grondprijzen” dat:
  - deze richtprijzen als input gebruikt in residuele berekeningen en scenario’s (bijv. wat als gemeente bereid is naar onderkant/bovenkant bandbreedte te gaan);
  - verschillen tussen gemeentelijke richtprijs en markt- of residuele waarde laat zien.[file:1]
- In rapporten een korte paragraaf “Grondbeleid & prijsniveau” die de jaargang, bandbreedte en eventuele beleidsaccenten (sturen op sociaal/middenhuur) samenvat.[file:1]

#### Risico’s / edge cases

- Dekking in CVDR is beperkt (ca. 25–40%); veel grondprijzenbrieven staan alleen op gemeentelijke websites of in begrotingsstukken. Voor een landelijk beeld is handmatige upload voor de top‑50 gemeenten noodzakelijk.[file:1]
- Een grondprijzenbrief is **beleidsmatig uitgangspunt**, geen harde garantie; feitelijke grondprijs kan in onderhandelingen afwijken (bijv. bij complexe binnenstedelijke locaties). Propdex moet dit expliciet als richtlijn tonen, niet als harde prijs.[file:1]
- Verschillende rekeneenheden (€/m² BVO vs. uitgeefbaar vs. woning) kunnen tot misinterpretatie leiden; binnen Propdex is een strikte normalisatie en duidelijke labeling per eenheid nodig.[file:1]

#### Concreet actieplan (dev/data)

1. CVDR‑auto‑ingest op grondprijzenbrieven en nota’s grondprijzen inrichten; voor de top‑50 grootste gemeenten aanvullend handmatig uploaden indien nodig.[file:1]
2. Datamodel `grondprijs_richtlijn` opzetten met velden: `gemeente_id`, `jaar`, `bestemming`, `gebied`, `prijs_per_eenheid`, `eenheidtype` (BVO/GBO/uitgeefbaar/woning), `bron_document`.[file:1]
3. Normalisatie‑laag bouwen die grondprijzen waar mogelijk omzet naar een vergelijkbare maat (bijv. €/m² uitgeefbaar) ten behoeve van vergelijking en residuele rekenmodellen.[file:1]
4. UI‑component “Grondprijsbeleid” integreren in Propdex, gekoppeld aan perceelbestemming, woonvisie/woonprogramma en financiële scenario’s.[file:1]

### 4.12 Duurzaamheidsbeleid (TVW, klimaatadaptatie, MPG+) — duurzaamheidsbeleid

#### Korte beschrijving

Duurzaamheidsbeleid op gemeentelijk niveau bestaat meestal uit een bundel van **transitievisie warmte, klimaatadaptatiestrategie/‑beleidsregels, circulariteitsbeleid en aanvullende duurzaam-bouwenrichtlijnen**.[file:1][web:495][web:498][web:496] Gemeenten stapelen daarbovenop extra eisen ten opzichte van landelijke BENG‑, MPG‑ en TOjuli‑normen (bijvoorbeeld strengere MPG‑grenzen, gasloos vanaf extra vroege datum, verplichte klimaatadaptieve maatregelen, GPR‑scores) en leggen die vast in beleidsregels, convenanten en soms het omgevingsplan.[web:495][web:496][web:498][web:501][web:507]

#### Inhoudelijke scope voor Propdex

- Maakt per gemeente/perceel inzichtelijk **welke extra duurzaamheids- en klimaatadaptatie-eisen** gelden bovenop landelijke Bbl/BENG/MPG‑regels (gasloos, strengere MPG, groene daken/gevels, bergings- en infiltratie-eisen, hittestressmaatregelen).[file:1][web:496][web:498][web:507]
- Verbindt de **Transitievisie Warmte (TVW)** en andere energie-/klimaatdocumenten met concrete ontwikkellocaties, zodat duidelijk is wanneer een wijk van het gas af gaat en welke warmteopties kansrijk zijn.[web:495][web:336][web:500][web:503]

#### Datavelden die we extraheren

A. Energie & warmtetransitie (TVW):

- `TVW_aanwezig` (ja/nee) en `TVW_horizon`: of gemeente een Transitievisie Warmte heeft en voor welke periode (meestal tot 2030).[web:495][web:336][web:500]
- `wijkplanning_aardgasvrij`: indicatie wanneer een wijk naar verwachting wordt verduurzaamd/aardgasvrij gemaakt (bijv. “voor 2030”, “na 2030”, nog onbekend) en welke warmteoptie (warmtenet, all‑electric, hybride) kansrijk is.[web:495][web:336][web:503]
- `aanvullende_eisen_energie`: lokale aanscherpingen bovenop BENG, zoals strengere EPC/BENG‑ambities voor eigen projecten of tenders; Propdex registreert deze op hoog niveau (ambitie‑label).[web:497][web:499][web:502]

B. Materiaal & circulariteit (MPG+/GPR):

- `MPG_grenswaarde_lokaal`: of de gemeente strengere MPG‑eisen hanteert dan landelijk (bijv. MPG ≤ 0,5 i.p.v. landelijke 0,8/1,0) in eigen tenders of beleidsregels.[web:497][web:502][web:508]
- `GPR_score_eis` of vergelijkbare duurzaam-bouwenrating waar expliciet benoemd.[web:505]
- `circulair_bouwen_eisen`: kwalitatieve eisen (hergebruik materialen, losmaakbaarheid) waar verwoord in beleid of tenderkaders.[web:501][web:507]

C. Klimaatadaptatie & natuur-inclusief:

- `klimaatadaptief_bouwen_beleid` (ja/nee) en eventuele beleidsregels (bijv. “Beleidsregel Klimaatadaptief Bouwen bij nieuwbouw en herstructurering”).[web:496][web:498][web:501][web:507]
- `waterberging_eis`: prestatie-eisen voor regenwater (bijv. 100% berging/infiltratie op eigen terrein tot een bepaalde bui, minimale m³/ha).[web:496][web:498][web:504]
- `groen/blauwe_eisen`: eisen voor groen‑ en schaduwpercentages, groene daken/gevels, bomen, hittestressreductie.[web:496][web:498][web:507]
- `natuurinclusief_bouwen_eisen`: bijv. nestkasten, biodiversiteitsmaatregelen, waar als gemeentelijk beleid opgenomen.[web:501][web:507]

#### Bronnen & automatisering

- Gemeentelijke **Transitievisies Warmte** (TVW’s) en aanverwante documenten (Wijkuitvoeringsplannen) op gemeentelijke websites en via PBL‑overzicht.[web:495][web:336][web:500][web:503]
- Beleidsregels klimaatadaptief bouwen, klimaatadaptatiestrategieën en duurzaam-bouwenleidraden in CVDR en op gemeentelijke sites (bijv. Beleidsregel Klimaatadaptief Bouwen, convenanten Duurzaam Bouwen).[web:496][web:498][web:507]
- Landelijke kaders: RVO‑pagina’s over klimaatadaptatie gebouwde omgeving en maatlat klimaatadaptief bouwen, kennisdossiers over klimaatadaptief bouwen en MPG/BENG/TOjuli‑samenhang.[web:498][web:499][web:502][web:505][web:508]

Automatisering:

- Handmatige ingest voor top‑20 grootste gemeenten (hoogste impact en vaak het verst met duurzaamheidsbeleid), omdat titulatuur en formats sterk variëren.[file:1][web:496][web:507]
- AI‑parser die per document:
  - TVW‑wijkindeling en globale tijdspaden naar aardgasvrij extraheert;
  - expliciete prestatie-eisen voor klimaatadaptatie (water, groen, hittestress) en eventuele extra MPG/BENG‑ambities herkent;
  - de belangrijkste duurzaamheids-“pluspunten” t.o.v. het landelijke minimum in tags vastlegt.[web:495][web:496][web:498][web:499]

#### Business-regels / productlogica

- **Duurzaamheidsbadge** op perceel-/projectpagina:
  - “Ligt in wijk die volgens TVW vóór/na 2030 aardgasvrij wordt; warmte-optie: warmtenet/all‑electric (indicatief).”[web:495][web:336][web:500]
  - “Extra lokale eisen: klimaatadaptief bouwen (waterberging X, groen/gevel/dak), mogelijk strengere MPG/directies in tenders.”[web:496][web:498][web:507]
- In rapporten een blok “Lokale duurzaamheids- en klimaatadaptatie-eisen” dat:
  - samenvat welke extra eisen gelden bovenop BENG/MPG (gasloosdatum, MPG‑ambitie, klimaatadaptatieprestatie);
  - de impact op ontwerp en bouwkosten duidt (meer groen, grotere waterberging, extra materiaalkwaliteit).[web:496][web:498][web:502]
- Potentie-/Risicoscore:
  - positieve factor waar duidelijke TVW‑planning en duurzaamheidsbeleid voorspelbaarheid en toekomstbestendige waarde bieden;
  - extra complexiteits-/kostenfactor waar zware lokale eisen (strenge MPG, zware klimaatadaptatie‑eisen) substantieel extra investering vragen.[file:1][web:499][web:507]

#### Risico’s / edge cases

- Duurzaamheidsbeleid is **sterk gefragmenteerd** over meerdere documenten (TVW, klimaatadaptatiestrategie, beleidsregels, convenanten, tenderleidraden); Propdex moet duidelijke prioriteit geven aan formele beleidsregels en TVW.[file:1][web:495][web:496][web:503]
- Eisen zijn vaak niet rechtlijnig juridisch afdwingbaar, maar via tenders, anterieure overeenkomsten en maatwerkafspraken; Propdex moet ze als “verwachting/ambitie” labelen, niet als absolute norm (behalve als expliciet in omgevingsplan opgenomen).[web:496][web:501][web:507]
- Spanningsveld tussen BENG‑ en MPG‑optimalisatie maakt dat detailimpact per ontwerp sterk verschilt; Propdex kan alleen richtinggevend zijn en geen detail-engineering vervangen.[web:499][web:502][web:508]

#### Concreet actieplan (dev/data)

1. Voor de top‑20 gemeenten Transitievisies Warmte en belangrijkste duurzaamheids-/klimaatadaptatiedocumenten verzamelen en inlezen (handmatige ingest).[file:1][web:500][web:503][web:496]
2. Datamodel `duurzaamheidskader_gemeente` opzetten met velden: `gemeente_id`, `TVW_status`, `aardgasvrij_planning`, `warmte_optie_hoofdlijn`, `klimaatadaptatie_eisen` (water/groen/hitte), `MPG_ambitie`, `overige_ambities`.[web:495][web:496][web:498][web:497]
3. Parser‑templates trainen om prestatie-eisen (waterberging, groenpercentages, MPG‑grenzen, BENG‑plus) uit beleidsregels/tenders te extraheren naar gestandaardiseerde tags.[web:496][web:498][web:499][web:502]
4. UI‑component “Duurzaamheid & klimaatadaptatie” integreren op perceel-/gemeentepagina en in rapporten, gekoppeld aan BENG/EP‑Online, RES en provinciale klimaat-/duurzaamheidslagen.[file:1][web:332][web:507]
### 4.13 Beschermd erfgoed (rijksmonumenten & gezichten) — beschermd-erfgoed

#### Korte beschrijving

Beschermd erfgoed op rijksniveau bestaat uit **rijksmonumenten** en **rijksbeschermde stads- en dorpsgezichten**.[file:1][web:513][web:519] Deze objecten en gebieden worden beheerd door de Rijksdienst voor het Cultureel Erfgoed (RCE); de status bepaalt welke verbouw, sloop en nieuwbouw zijn toegestaan en opent toegang tot specifieke instandhoudingssubsidies en laagrentende leningen.[file:1][web:511][web:522] Propdex gebruikt de RCE Linked Data‑/API‑dataset om per perceel direct te tonen of het om een rijksmonument gaat en/of binnen een beschermd gezicht ligt.[file:1][web:512][web:518]

#### Inhoudelijke scope voor Propdex

- Geeft per perceel weer **of het een rijksmonument is** en/of in een rijksbeschermd stads- of dorpsgezicht ligt, inclusief basisinformatie (monumentnummer, type, naam, bouwjaar).[file:1][web:512][web:509]
- Verbindt de monumentstatus aan **bouw- en vergunningsconsequenties** (minder vergunningsvrije activiteiten, strengere toetsen) en aan erfgoedfinanciering (instandhoudingssubsidies Sim/voormalig Brim, laagrentende leningen).[web:510][web:513][web:516][web:511][web:520][web:522]

#### Datavelden die we extraheren

A. Rijksmonumenten:

- `is_rijksmonument` (ja/nee), `rijksmonumentnummer`, `naam`, `objectcategorie` (bijv. woonhuis, kerk, fabrieksgebouw, militair, groen/archeologisch).[web:512][web:518][web:515]
- Basiskenmerken: `oorspronkelijke_functie`, `bouwjaar/globale datering`, `beschrijving_kernwaarden` (korte samenvatting uit RCE‑beschrijving).[web:512][web:518]
- Erfgoedfinanciering (indicatief): verwijzing naar **Subsidieregeling instandhouding monumenten (Sim)** en laagrentende leningen Nationaal Restauratiefonds; voor niet‑woonhuis monumenten doorgaans 30–50% subsidie op reguliere onderhoudskosten in 6‑jarige plannen.[web:511][web:514][web:520][web:522]

B. Rijksbeschermde stads- en dorpsgezichten:

- `is_beschermd_gezicht` (ja/nee) met `gezicht_naam` en `gezichtsnummer`.[web:512][web:518][web:519]
- Type: rijksbeschermd stads‑ of dorpsgezicht (ca. 470 gebieden met bijzonder cultuurhistorisch karakter).[web:510][web:513][web:519]
- Locatie/belangen: ligging van het perceel binnen de begrenzing; in beschermde gezichten gelden striktere regels: minder bouwactiviteiten vergunningsvrij, strengere eisen voor sloop en verandering van straatbeeld.[web:510][web:513][web:516][web:519]

C. Relatie met lokaal beleid:

- `gemeentelijk_beschermd_gezicht_flag` wordt niet uit RCE gehaald, maar via gemeentelijke erfgoedverordeningen (valt onder 4.14 Erfgoedverordening); Propdex markeert alleen dat rijksbeschermde gezichten in het omgevingsplan extra bescherming moeten krijgen.[web:513][web:521]

#### Bronnen & automatisering

- **RCE Linked Data & API** (linkeddata.cultureelerfgoed.nl en REST‑endpoint) als primaire bron voor rijksmonumenten en rijksbeschermde stads-/dorpsgezichten.[file:1][web:512][web:518][web:509]
- RCE‑informatiepagina’s en kaarten over beschermde gezichten, plus algemene uitleg over wat een beschermd stads-/dorpsgezicht is en welke regels gelden.[web:510][web:513][web:519][web:516]
- Achtergrondinformatie over instandhoudingssubsidies Sim (opvolger Brim) en andere financieringsopties voor monumenteigenaren.[web:511][web:514][web:520][web:522]

Automatisering:

- Bestaande Propdex‑integratie met de RCE Linked Data API (al live); deze haalt per BAG‑verblijfsobject (pand/perceel) de monumentstatus op.[file:1][web:512][web:518][web:515]
- Periodieke synchronisatie met de RCE High Value Dataset (rijksmonumenten en gezichten) zodat nieuwe aanwijzingen en statuswijzigingen snel worden verwerkt.[web:512][web:519]

#### Business-regels / productlogica

- **Erfgoedbadge rijksniveau** op perceelpagina:
  - “Rijksmonument (nr. X, type Y)” en/of “Binnen rijksbeschermd stads-/dorpsgezicht [naam]”.[file:1][web:512][web:513][web:519]
- In rapporten een blok “Rijksmonumenten & beschermde gezichten” met:
  - monumentstatus, kernrestricties (minder vergunningsvrij bouwen, vergunningplicht voor sloop/ingrijpende wijziging, erfgoedcommissie/advies);
  - indicatieve verwijzing naar instandhoudingssubsidies en laagrentende leningen voor onderhoud/duurzame ingrepen.[web:510][web:513][web:516][web:511][web:522]
- Potentie-/Risicoscore:
  - extra **complexiteits- en kostenfactor** door erfgoedbeperkingen;
  - maar ook **waardepotentieel** (iconische locaties, subsidies voor onderhoud en verduurzaming, toeristische/identiteitswaarde).[file:1][web:514][web:520]

#### Risico’s / edge cases

- RCE‑dataset dekt rijksmonumenten en rijksbeschermde gezichten, maar géén volledige set van gemeentelijke/provinciale monumenten; die worden via BRK‑PB of lokale registers ontsloten (afgevangen in 4.14 Erfgoedverordening).[web:509][web:512][web:521]
- Monumentstatus op adresniveau kan incidenteel mismatchen met BAG‑registratie; Propdex moet daarom RCE‑data als leidend tonen maar eventuele discrepanties loggen en waar nodig handmatig laten controleren.[web:509][web:515]
- Rijksbeschermde gezichten krijgen bescherming via omgevingsplan en welstand; de precieze bouwregels zitten daar en in gemeentelijke verordeningen. Propdex moet duidelijk maken dat de erfgoedbadge een signaal is, geen volledige juridische uitputting.[web:513][web:516][web:519]

#### Concreet actieplan (dev/data)

1. Bestaande RCE‑Linked‑Data integratie benutten en uitbreiden met expliciete velden `is_rijksmonument`, `rijksmonumentnummer`, `is_beschermd_gezicht`, `gezicht_naam` per perceel.[file:1][web:512][web:518][web:515]
2. Een lightweight mapping van RCE‑objecten naar BAG‑verblijfsobjecten/panden onderhouden om adres‑/perceelqueries robuust te beantwoorden.[web:509][web:515]
3. Datamodel `rijks_erfgoed_status` opnemen in Propdex‑database en koppelen aan Potentie-/Risicoscore en subsidie‑/financieringsblokken.[file:1][web:511][web:522]
4. UI‑component “Beschermd erfgoed (rijks)” integreren op perceelpagina en in rapporten, afgestemd met toekomstige gemeentelijke erfgoedverordeningen (4.14) voor een compleet erfgoedbeeld.[file:1][web:519][web:513]

### 4.14 Erfgoedverordening — erfgoedverordening

#### Korte beschrijving

De erfgoedverordening regelt op gemeentelijk niveau de **aanwijzing, registratie en bescherming van gemeentelijke monumenten, gemeentelijke stads- en dorpsgezichten en vaak ook archeologische waarden**.[file:1][web:524][web:525][web:528] Daarmee vult zij de rijkslaag aan: waar 4.13 vooral rijksmonumenten en rijksbeschermde gezichten dekt, zorgt de erfgoedverordening voor bescherming van lokaal erfgoed dat niet in het rijksregister staat.[web:524][web:530] Onder de Omgevingswet verschuift de formele bescherming van gemeentelijke monumenten in principe naar het omgevingsplan, maar bestaande aanwijzingen en veel verordeningsregels werken via overgangsrecht nog door.[web:527][web:531]

#### Inhoudelijke scope voor Propdex

- Geeft per perceel weer of er sprake is van een **gemeentelijk monument**, een gemeentelijk beschermd stads- of dorpsgezicht of een lokaal archeologisch regime dat extra onderzoek/vergunbaarheid beïnvloedt.[file:1][web:525][web:528][web:532]
- Voorkomt verrassingen in due diligence: veel ontwikkelaars zien rijksmonumenten wel, maar lopen gemeentelijke monumenten of archeologische beschermingslagen pas tegen bij de vergunningaanvraag aan.[file:1][web:530][web:526]

#### Datavelden die we extraheren

A. Gemeentelijke monumenten:

- `is_gemeentelijk_monument` (ja/nee), `gemeentelijk_monumentnummer` of lokaal registratienummer, `naam/objecttype`, `datum_aanwijzing`.[web:525][web:528][web:533]
- `beschrijving_beschermde_waarden`: korte samenvatting van waarom het object is aangewezen (schoonheid, cultuurhistorische waarde, wetenschappelijke betekenis).[web:524][web:527]
- `voorbescherming` (ja/nee) waar de verordening tijdelijke bescherming tijdens aanwijzingsprocedure kent.[web:527][web:531]

B. Gemeentelijke beschermde gezichten:

- `is_gemeentelijk_beschermd_gezicht` (ja/nee), `gebiedsnaam`, `begrenzing`, `datum_aanwijzing`.[web:525][web:528]
- `extra_toetsingskader`: of wijzigingen aan panden/straatbeeld binnen het gebied aan aanvullende erfgoedcriteria zijn gebonden.[web:525][web:527]

C. Archeologie:

- `archeologische_waarde_zone` of koppeling naar archeologische beleidskaart / dubbelbestemming `Waarde - Archeologie`.[web:526][web:529][web:532]
- `onderzoeksplicht`: indicatie vanaf welke ingreep/oppervlakte/diepte archeologisch onderzoek nodig is.[web:526][web:532]
- `behoud_in_situ_voorkeur`: waar de verordening/regels aangeven dat behoud ter plaatse uitgangspunt is.[web:532]

#### Bronnen & automatisering

- Erfgoedverordeningen in CVDR via lokaleregelgeving.overheid.nl, vaak inclusief bepalingen over aanwijzing, registratie op gemeentelijke monumentenlijst en adviescommissie.[file:1][web:524][web:525][web:528]
- Gemeentelijke open-data monumentenregisters of lijsten in bijlagen/raadsbesluiten voor de daadwerkelijke objectregistratie.[file:1][web:525][web:533]
- Archeologische beleidskaarten en planregels/dubbelbestemmingen in omgevingsplan/bestemmingsplan als aanvulling voor de ruimtelijke laag.[web:526][web:529][web:532]

Automatisering:

- KOOP SRU‑ingest voor erfgoedverordeningen met title‑filters op “erfgoedverordening” en “monumentenverordening”.[file:1][web:524][web:528]
- Aanvullende koppeling per gemeente naar open-data monumentenlijsten of bijlagen, zodat niet alleen de verordening maar ook de **daadwerkelijke lijst met objecten en gebieden** op perceelniveau beschikbaar komt.[file:1][web:525][web:533]
- Parser die aanwijzingsregels, beschermingsvormen en archeologische verwijzingen uit de verordening structureert, en de objectlijsten geocodeert naar percelen/panden.[web:524][web:527][web:532]

#### Business-regels / productlogica

- **Erfgoedbadge lokaal** op perceelpagina:
  - “Gemeentelijk monument” of “Binnen gemeentelijk beschermd gezicht”;
  - “Archeologische zone aanwezig; onderzoek mogelijk nodig bij bodemverstoring.”[web:525][web:528][web:526][web:532]
- In rapporten een blok “Lokaal erfgoed & archeologie” met:
  - beschermingsstatus, kernwaarden en verwachte gevolgen voor verbouw/sloop/nieuwbouw;
  - indicatie of aanvullende onderzoeken, advies commissie omgevingskwaliteit of archeologisch vooronderzoek nodig zijn.[web:527][web:532][web:530]
- Potentie-/Risicoscore: extra complexiteitsfactor bij gemeentelijke monumenten en archeologische dubbelbestemmingen; mogelijk ook waardepotentieel bij karaktervolle objecten/gebieden.[file:1][web:526][web:527]

#### Risico’s / edge cases

- Onder de Omgevingswet is de systematiek in overgang: nieuwe aanwijzingen horen uiteindelijk via het omgevingsplan te lopen, terwijl veel gemeenten nog met de erfgoedverordening werken of daarop terugvallen tot eind 2031.[web:531][web:527] Propdex moet daarom de **juridische status** van de bescherming tonen: oude verordening, overgangsrecht of al omgevingsplan-regime.
- Niet elke gemeente publiceert een machineleesbare monumentenlijst; soms staat de lijst in PDF-bijlagen of losse registers. Daardoor is objectdekking lastiger dan de verordening zelf.[file:1][web:525]
- Archeologische bescherming zit vaak deels in de erfgoedverordening en deels in planregels/dubbelbestemmingen; Propdex moet beide lagen combineren om geen vals-negatieve signalen te geven.[web:526][web:529][web:532]

#### Concreet actieplan (dev/data)

1. CVDR‑auto‑ingest voor erfgoedverordeningen activeren, inclusief oude titelvariant “monumentenverordening”.[file:1][web:524][web:528]
2. Datamodel `gemeentelijk_erfgoed_status` opzetten met velden: `gemeente_id`, `object_id`, `type` (monument/gezicht/archeologie), `status`, `datum_aanwijzing`, `bronlijst`, `kernwaarden`.[file:1][web:525][web:533]
3. Per gemeente een koppeling maken naar monumentenlijsten / open data / bijlagen en deze geocoderen naar BAG/perceelobjecten.[file:1][web:525]
4. UI‑component “Gemeentelijk erfgoed & archeologie” integreren op perceelpagina en in rapporten, gekoppeld aan 4.13 Beschermd erfgoed, welstandsnota en omgevingsplanregels.[file:1][web:526][web:531]

### 4.15 Bekendmakingen monitoring — bekendmakingen

#### Korte beschrijving

Bekendmakingen monitoring is een **live signaleringslaag** die alle officiële publicaties op officielebekendmakingen.nl per gemeente volgt en vertaalt naar bruikbare gebeurtenissen voor Propdex.[file:1][web:429][web:436][web:438] Daaronder vallen vergunningverleningen, ontwerpbesluiten, weigeringen, verordeningswijzigingen en andere relevante gemeentelijke bekendmakingen.[file:1][web:425][web:427][web:431] Deze laag voedt zowel het vergunning-klimaat als de gemeente-feed, zodat nieuwe signalen vrijwel realtime zichtbaar zijn.[file:1][web:429][web:437]

#### Inhoudelijke scope voor Propdex

- Geeft per gemeente een **vroegsignaal** van nieuwe vergunningen, weigeringen en beleidswijzigingen die impact hebben op bouw-, ontwikkel- en transformatiekansen.[file:1][web:425][web:430][web:437]
- Ondersteunt de andere lagen: vergunningsbesluiten kunnen het vergunning-klimaat actualiseren, verordeningswijzigingen kunnen onmiddellijk worden doorgezet naar gemeentelijke regels, en ontwerpbesluiten kunnen wijzen op aankomende projecten of weerstand.[file:1][web:425][web:431][web:437]

#### Datavelden die we extraheren

A. Publicatiegegevens:

- `publicatie_type`: vergunningverlening, weigering, ontwerpbesluit, verordening-wijziging, intrekking, kennisgeving, voornemen.[web:425][web:431][web:434]
- `gemeente`, `publicatiedatum`, `publicatienummer`, `bekendmaking_id`.[web:429][web:436]
- `onderwerp` of `titel_trefwoord`: omgevingsvergunning, bouw, sloop, wonen, huisvesting, parkeren, erfgoed, stikstof, enzovoort.[web:425][web:437]

B. Inhoudelijke classificatie:

- `relevantie_propdev`: score of boolean die aangeeft of de bekendmaking direct relevant is voor vastgoed, ontwikkeling of beleid in Propdex.[file:1]
- `besluitstatus`: verleend, geweigerd, ontwerp, in behandeling, vastgesteld.[web:425][web:431][web:434]
- `locatieverwijzing`: adres, perceel, wijk of projectnaam waar mogelijk uit de tekst gehaald.[web:425][web:431]

C. Doorwerking naar andere modules:

- `update_vergunning_klimaat`: of de publicatie meetelt in de rolling 12-maands-statistiek.[file:1]
- `update_regelset`: of de publicatie een nieuwe of gewijzigde verordening bevat die naar de beleidslaag moet worden doorgezet.[web:429][web:437]
- `signalering_raads_feed`: optionele link naar politieke of beleidsmatige context als het om een groot project gaat.[web:454][web:460]

#### Bronnen & automatisering

- Officiële bekendmakingen via de SRU-interface van overheid.nl / officielebekendmakingen.nl als primaire bron.[file:1][web:429][web:435][web:436]
- Publieke bekendmakingspagina’s en PDF’s voor validatie of als fallback wanneer de SRU-samenvatting beperkt is.[web:425][web:431][web:434]

Automatisering:

- Volledig automatische SRU-query per gemeente, met periodieke polling en verwerking zodra een nieuwe publicatie beschikbaar is.[web:429][web:435][web:436]
- Klassificatie op basis van titel, samenvatting en type publicatie, met onderscheid tussen vergunning, ontwerpbesluit, weigering en wijziging van regelgeving.[web:425][web:431][web:434]
- Doorlevering naar vergunning-klimaat, raadsinformatie en gemeentelijke beleidsfeeds, zodat één publicatie meerdere productlagen kan voeden.[file:1][web:429][web:437]

#### Business-regels / productlogica

- **Bekendmakingen-feed** op gemeente- en wijkpagina: een chronologische lijst van recente publicaties met labels als “vergunning verleend”, “weigering”, “ontwerpbesluit”, “verordening gewijzigd”.[file:1][web:425][web:430]
- In rapporten een kort blok “Recente officiële bekendmakingen” met de belangrijkste gebeurtenissen en hun mogelijke invloed op de haalbaarheid of timing van een project.[web:425][web:431][web:437]
- Potentie-/Risicoscore: positieve of negatieve signalen kunnen worden doorgerekend, bijvoorbeeld bij een toestemmingspatroon in de buurt of juist een reeks weigeringen.[file:1][web:425][web:427]

#### Risico’s / edge cases

- Publicatieteksten verschillen sterk in kwaliteit en structuur; classificatie blijft deels heuristisch en moet met regelmatige steekproeven worden gevalideerd.[web:425][web:427][web:430]
- Niet elke relevante gebeurtenis is juridisch even zwaar: een kennisgeving of voornemen is niet hetzelfde als een definitief besluit. Propdex moet deze status helder onderscheiden.[web:431][web:434][web:437]
- Sommige gemeenten publiceren aanvullend op eigen websites of in lokale systemen; bij gaten in SRU kan een beperkte fallback via gemeentelijke portalen nodig zijn.[web:427][web:430][web:433]

#### Concreet actieplan (dev/data)

1. SRU-collector per gemeente configureren op officielebekendmakingen.nl en een pollinginterval instellen dat past bij de publicatiefrequentie.[web:429][web:435][web:436]
2. Datamodel `bekendmaking_event` uitbreiden met `publicatie_type`, `status`, `gemeente`, `locatie`, `relevantie_propdev` en `koppeling_vergunning_klimaat`.[file:1]
3. Een classifier bouwen die publicaties labelt als vergunning, ontwerpbesluit, weigering of regelgeving en de inhoud naar de juiste downstream-modules routeert.[web:425][web:431][web:434]
4. UI-feed op gemeente- en perceelniveau toevoegen als realtime signaallaag naast raadsinformatie en jurisprudentie.[file:1][web:429][web:437]

### 4.16 Nieuws & beleidsmonitoring — nieuws-monitoring

#### Korte beschrijving

Nieuws- en beleidsmonitoring is een **aanvullende signaallaag** die lokale nieuwsberichten, gemeentelijke RSS-feeds en beleidsnieuws samenbrengt om politieke of maatschappelijke beweging vroeg te signaleren.[file:1][web:540][web:543][web:545] Deze laag is niet juridisch bindend, maar helpt wel om te zien waar weerstand, steun, participatiecampagnes of bestuurlijke omkeringen ontstaan die een bouw- of transformatieproject kunnen versnellen of vertragen.[web:534][web:535][web:542]

#### Inhoudelijke scope voor Propdex

- Geeft per gemeente een **contextfeed** van nieuws over woningbouw, protest, coalitieafspraken, wethoudersuitspraken, participatie en lokale beleidsontwikkelingen.[file:1][web:534][web:536][web:546]
- Signaleert thema’s die vaak niet direct in formele besluiten zitten, maar wel de uitvoerbaarheid beïnvloeden: bezwaarprocedures, buurtprotest, politieke kenteringen, of juist steun voor versnelling van woningbouw.[web:534][web:535][web:547]

#### Datavelden die we extraheren

A. Nieuwsbronnen:

- `bron_type`: gemeentelijke RSS, lokale media, beleidsplatform, nieuwsartikel, persbericht.[web:539][web:544][web:540]
- `publicatiedatum`, `bron_naam`, `url`, `onderwerp`.[web:540][web:545][web:546]
- `gemeente/regio` en eventuele locatieverwijzing als artikel daar expliciet over gaat.[web:534][web:536][web:546]

B. Inhoudelijke classificatie:

- `thema`: woningbouw, bezwaar/protest, bestuur/coalitie, duurzaamheid, mobiliteit, erfgoed, participatie, beleidswijziging.[web:534][web:535][web:542]
- `sentiment/signalering`: positief, neutraal, negatief; of een simpel signaal als steun/weerstand/onzekerheid.[web:534][web:535][web:540]
- `relevantie_propdev`: score die aangeeft of het nieuws iets zegt over ontwikkelkansen, vergunningrisico of beleidsrichting.[file:1]

C. Koppeling aan andere modules:

- `update_raadsinformatie`: link naar een gerelateerde motie of raadsbrief als die bestaat.[web:539][web:454]
- `update_vergunning_klimaat`: optionele correctie of waarschuwing bij toenemende bezwaren of lokale weerstand.[web:534][web:535][web:538]
- `update_perceel_feed`: als een artikel een specifiek gebied of project noemt, verschijnt het in de perceelcontext.[web:546][web:536]

#### Bronnen & automatisering

- Gemeentelijke RSS-feeds en nieuwssecties, waar beschikbaar, voor officiële communicatie en raads- of projectnieuws.[web:539][web:544]
- Lokale en regionale media voor bredere publieke signalen over bezwaar, protest, woningbouw en bestuurlijke koers.[web:534][web:535][web:542][web:547]
- Beleidsmonitoringsdiensten of nieuwsaggregators zoals BeleidsRadar als commerciële of externe feedbron.[web:540][web:543][web:545]

Automatisering:

- RSS-aggregator per gemeente opzetten, aangevuld met trefwoordfilters voor woningbouw, parkeren, stikstof, protest, transformatie, duurzaamheid en erfgoed.[web:539][web:544][web:545]
- AI-classifier die nieuwsartikelen indeelt op thema, sentiment en potentiële impact op Propdex-scores.[file:1][web:534][web:535][web:543]
- Prioriteren van bronnen met hoge lokale relevantie en lage onderhoudslast; complexe media-integratie pas in latere fase.[web:542][web:547]

#### Business-regels / productlogica

- **Nieuwsfeed** op gemeente- en perceelniveau: een korte lijst met recente artikelen en beleidsberichten die de lokale context schetsen.[file:1][web:540][web:545]
- In rapporten een blok “Lokale signalen & context” met waarschuwingen zoals:
  - groeiende bezwaarbereidheid in de gemeente;
  - coalitie- of wethoudersuitspraken die woningbouw versnellen;
  - buurtprotest of participatiedruk die de planning kan beïnvloeden.[web:534][web:535][web:546]
- Potentie-/Risicoscore: lichte correctie op basis van structureel positieve of negatieve signalen, maar altijd lager gewogen dan formele juridische bronnen.[file:1][web:534][web:542]

#### Risico’s / edge cases

- Nieuws is vluchtig en kan overdreven of incompleet zijn; Propdex moet nieuws als **contextsignaal**, niet als feitelijk juridisch kader presenteren.[web:534][web:538][web:540]
- Lokale media hebben ongelijke dekking; in kleinere gemeenten kan veel via huis-aan-huisbladen of lokale omroepen lopen, wat technisch lastiger te automatiseren is.[web:542][web:547]
- Dubbeltellingen tussen nieuws, raadsinformatie en bekendmakingen moeten worden vermeden; één gebeurtenis kan via meerdere bronnen binnenkomen.[web:539][web:540][web:454]

#### Concreet actieplan (dev/data)

1. Start met gemeentelijke RSS-feeds en een beperkt aantal lokale nieuwsbronnen per gemeente als minimaal bruikbare feed.[web:539][web:544]
2. Datamodel `nieuws_signaal` inrichten met `bron`, `datum`, `thema`, `sentiment`, `relevantie_propdev`, `koppeling_gemeente/perceel`.[file:1]
3. AI-classifier trainen op woningbouw- en beleidsartikelen, met aandacht voor protest, bezwaar, coalitie, wethouderuitspraken en projectvertraging.[web:534][web:535][web:538]
4. In de UI alleen een compacte contextfeed tonen en deze duidelijk scheiden van juridische en formele beleidslagen.[file:1][web:542][web:547]

---

## 5. Externe data- en API-bronnen

Deze laag bevat de object-, omgevings-, milieudata en partners die Propdex direct op perceel- en projectniveau verrijken. In tegenstelling tot beleidsdocumenten zijn dit grotendeels live of semi-live datasets die de feitelijke situatie objectiveren en de juridische of financiële analyses onderbouwen.

### 5.1 Perceel- en objectdata

#### BAG
De BAG is de basis voor adressen, gebouwen, panden en verblijfsobjecten en vormt de primaire sleutel voor perceel- en objectmatching in Propdex. De Kadaster BAG API levert near-realtime actuele data via REST en wordt in de praktijk als open data aangeboden; de data zijn bedoeld voor gecontroleerde toegang en zijn doorgaans direct beschikbaar tenzij onderhoud loopt.[web:549][web:550][web:551] Propdex koppelt BAG-objecten aan beleidslagen, vergunningen, energielabels en 3D-modellen zodat elk perceel een uniforme objectidentiteit heeft.

- **Datavelden:** adres, pand-id, verblijfsobject-id, gebruiksdoel, oppervlakte, bouwjaar, status, geometrie, koppeling naar BAG-objecten.
- **Koppeling:** primaire sleutel voor alle perceel-, wijk- en objectanalyses; gebruikt voor address matching en geometrische overlay.
- **Updatefrequentie:** near-realtime / dagelijkse mutaties; dienstverlening en API-updates zijn operationeel nabij realtime.[web:549][web:551]

#### 3DBAG
3DBAG levert open 3D gebouwmodellen van Nederland en is geschikt voor volumeberekeningen, schaduw/zichtanalyse en massastudies. De dataset wordt periodiek vernieuwd op basis van BAG en geactualiseerde bronvector- en pointcloudgegevens; release notes tonen recente updates met nieuwe BAG- en AHN-input.[web:559][web:556][web:561] Propdex gebruikt 3DBAG om bouwmassa, hoogte-inschatting en ruimtelijke impact op perceel- en wijkniveau beter te visualiseren.

- **Datavelden:** 3D-gebouwgeometrie, level of detail, gebouwhoogte, footprint, volume, bouwmassa-attributen.
- **Koppeling:** gekoppeld op BAG-object of pand-ID; gebruikt in 3D-visualisatie en massastudies.
- **Updatefrequentie:** periodieke releases; in de praktijk enkele keren per jaar, afhankelijk van bronupdates.[web:556][web:559]

#### Kadaster / BRK
Kadaster- en BRK-data leveren eigendoms- en kadastrale context, zoals kadastrale aanduiding, perceelgrenzen, rechten en transactiedata. Kadaster biedt zowel open als betaalde API-producten; onder meer objectinformatie, koopsom en transactieproducten zijn beschikbaar via API of productdiensten, met actuele informatie vaak beschikbaar na inschrijving van de akte.[web:578][web:585][web:584][web:588][web:577] Propdex gebruikt BRK voor eigendomscontext, perceelafbakening en koppeling aan transactiewaarde.

- **Datavelden:** kadastrale aanduiding, perceeloppervlakte, eigendomsrechten, bijzondere rechten, koopsom, transactiedatum, rechtssituatie.
- **Koppeling:** via perceel-ID of adres; essentieel voor eigendom, hypotheek- en transactiemodellen.
- **Updatefrequentie:** transactiedata maandelijks / na inschrijving akte; objectinformatie near-realtime of regelmatig bijgewerkt.[web:587][web:588][web:585]

#### EP-Online
EP-Online ontsluit geregistreerde energielabels en gerelateerde bestandsoverzichten; de public API en totaalbestanden zijn beschikbaar met API-key. RVO vermeldt dat actuele labels via de webservice of totaalbestanden kunnen worden opgehaald, waarbij een API-key vereist is voor geautomatiseerd gebruik.[web:554][web:557][web:199] Propdex gebruikt EP-Online om het energielabel van een object, verduurzamingsopgave en labelhistorie op perceelniveau te tonen.

- **Datavelden:** energielabel, labeldatum, geldigheid, objecttype, referentiedatum, labelklasse.
- **Koppeling:** via adres/BAG-object; gebruikt in verduurzamingsanalyse en subsidie-eligibility.
- **Updatefrequentie:** continu bijgewerkt via webservice/totaalbestanden; in de praktijk near-realtime of periodiek afhankelijk van mutaties.[web:554][web:557][web:199]

#### RCE monumentenregister
De RCE Linked Data/API levert actuele monumentstatussen en beschermde gezichten op perceel- en objectniveau. De RCE-datasets en API-documentatie tonen open toegang tot monumenten- en beschermde-gezichtsdata, die Propdex gebruikt voor erfgoedflags en vergunningrisico’s.[web:512][web:518][web:513][web:519] Dit is de primaire bron voor rijksmonumenten en rijksbeschermde stads- en dorpsgezichten.

- **Datavelden:** rijksmonumentstatus, monumentnummer, objecttype, beschrijving, beschermd gezicht, geometrie.
- **Koppeling:** via BAG/adres of geometrie; direct op perceel/objectniveau.
- **Updatefrequentie:** realtime of dataset-updates volgens RCE publicatiecyclus.[web:512][web:518][web:519]

### 5.2 Omgevings- en milieudata

#### Natura2000
Natura2000-data zijn beschikbaar als WFS/open data en geven de grenzen van Natura 2000-gebieden en relevante habitatkartering weer. De PDOK/Nationaal Georegister-datasets tonen dat de begrenzingen en statusinformatie periodiek worden geactualiseerd; AERIUS-gebruikelijke datasets leveren relevante habitatkartering voor stikstofbeoordelingen.[web:566][web:562][web:564][web:570] Propdex gebruikt deze laag voor stikstof- en natuurrisico’s op perceel- en projectniveau.

- **Datavelden:** gebiedsgrens, status, habitattype, relevant habitat, beleidsstatus.
- **Koppeling:** geometrische overlay op perceel/projectlocatie.
- **Updatefrequentie:** periodiek; grenswijzigingen en datasetversies volgen beleids- en datasetuitgiftes.[web:566][web:562][web:564]

#### Geluid
Geluiddata worden gebruikt om geluidsbelasting en beperkingen voor bouw of functiewijziging inzichtelijk te maken. De relevante kaart- en berekeningsdata zijn onderdeel van overheids- en regionale datasets, waaronder CIMLK en regionale kaartservices; deze tonen wegverkeer, bronnen en rekenresultaten voor geluid en omgeving.[web:573] Propdex gebruikt deze data om een geluidsrisico- of geluidsbelastinglaag toe te voegen aan percelen en projecten.

- **Datavelden:** geluidsbelasting, bron (weg/spoor/industrie), rekenpunt of kaartcel, normoverschrijding.
- **Koppeling:** via perceelgeometrie of meet-/rekenpunten.
- **Updatefrequentie:** periodiek, afhankelijk van modelactualisatie en bronbeheer.[web:573]

#### Luchtkwaliteit
Luchtkwaliteitsdata komen uit RIVM/NSL-achtige bronnen en regionale kaartservices; voor fijnstof, NO2 en andere indicatoren zijn open kaartlagen en actuele indexen beschikbaar. RIVM publiceert open data en kaarten, en sommige kaarten worden zelfs per uur geactualiseerd, zoals de actuele luchtkwaliteitsindex.[web:567][web:570][web:576] Propdex gebruikt deze laag om milieukwaliteit en mogelijke gezondheid-/vergunningsrisico’s te tonen.

- **Datavelden:** PM10, PM2.5, NO2, O3, luchtkwaliteitsindex, kaartcel/meetpunt.
- **Koppeling:** geospatiale overlay op perceel/wijk.
- **Updatefrequentie:** van uurwaarden tot jaarlijkse modelkaarten, afhankelijk van bron.[web:567][web:576][web:570]

#### Bodemrisico’s
Bodemdata zijn beschikbaar via de Bodemkaart/BRO, met landelijke dekking op schaalniveau 1:50.000 en informatie over opbouw, bodemtypen en kwetsbaarheid. De Bodemkaart van Nederland beschrijft bodemopbouw tot 1,20 meter en is geschikt voor ruimtelijke planvorming, bodemgeschiktheid en kwetsbaarheidsanalyses.[web:571][web:574][web:568] Propdex gebruikt deze laag voor funderings-, geschiktheids- en risicobepaling bij bouwen en herontwikkeling.

- **Datavelden:** bodemtype, profiel, grondsoort, verstoringen, kwetsbaarheid, diepte-opbouw.
- **Koppeling:** geospatiale overlay; vaak per grid/cel of kaartvlak.
- **Updatefrequentie:** periodiek; versiegebonden datasetupdates.[web:571][web:574][web:568]

#### DSO / omgevingsplan-API’s
DSO- en omgevingsplan-API’s ontsluiten planregels, geometrie en juridische planinformatie die direct relevant is voor vergunningen en ruimtelijke toetsing. De DSO-infrastructuur wordt gebruikt voor plansets, regels op de kaart en juridische verankering van omgevingsplanregels; Propdex koppelt deze laag aan perceeldata voor directe juridische duiding. Hoewel updatefrequentie per gemeente verschilt, is de bron in de praktijk continu of bij wijzigingspublicaties actueel.

- **Datavelden:** planregel, geometrie, functieaanduiding, dubbelbestemming, gebruiksregels, vergunningregels.
- **Koppeling:** ruimtelijke overlay op perceel of gebied.
- **Updatefrequentie:** bij planpublicatie of wijziging; vaak continu via bronpublicaties.

### 5.3 Commerciële partners

#### Vindsubsidies.nl
Vindsubsidies is een commerciële aggregatiebron voor decentrale subsidies en regelingen, en wordt in Propdex gebruikt als partnerbron voor gemeentelijke en provinciale subsidies. De rationale uit het interne document is dat een eigen landelijke dekking van honderden gemeenten en tientallen regelingen per gemeente operationeel zwaar is, terwijl een partneraggregator dit al commercieel ontsluit.[file:1] Propdex gebruikt dit voor lokale, provinciale en thematische subsidie-informatie.

- **Datavelden:** regelingnaam, doelgroep, bedrag, openstelling, voorwaarden, deadline, regio.
- **Koppeling:** gekoppeld aan gemeente, perceel of projecttype.
- **Updatefrequentie:** afhankelijk van openstellingen; doorgaans kwartaal of ad hoc.

#### NVM / Kadaster transactiedata & VON-prijsvoorspelling
Voor transactie- en marktinformatie zijn Kadaster-transactieproducten en NVM/brainbay-dataproducten relevant. Kadaster levert koopsominformatie en transactie-API’s, terwijl brainbay/NVM marktinformatie en prijsontwikkeling-API’s aanbiedt op basis van de NVM-database.[web:584][web:588][web:583][web:586] Propdex gebruikt deze partnerdata voor marktcontext, waardering en VON-prijsvoorspelling.

- **Datavelden:** koopsom, transactiedatum, objectkenmerken, referentieobjecten, prijsindex, marktindicatoren.
- **Koppeling:** adres- of perceelniveau, vaak via betaalde API of datalicentie.
- **Updatefrequentie:** maandelijks of near-realtime afhankelijk van product en licentie.[web:587][web:588][web:583][web:586]

## 6. Strategische samenvatting voor investeerders

### 6.1 Wat vandaag draait

Propdex heeft volgens het interne overzicht de cascade-infrastructuur, AI-parser, versiebeheer, admin-UI en automatische KOOP SRU-ingest operationeel.[file:1] Vandaag draaien 6 gemeentelijke bronnen volledig live, plus 1 landelijke bron, en daarnaast onafhankelijke perceel-/wijk-API’s zoals BAG, CBS, DSO, 3DBAG, RCE-monumenten, EP-Online, Natura2000, geluid, luchtkwaliteit en bodemrisico’s.[file:1] De live kern bestaat daarmee uit een werkende datalaag die al productie-output levert en direct bruikbaar is voor perceel-, gemeente- en rapportpagina’s.[file:1]

### 6.2 Kortste weg naar 50% extra dekking

De snelste uitbreidingsroute is configuratie-uitrol van bestaande ingest-paden, vooral voor omgevingsvisie en huisvestingsverordening, van 5 naar 342 gemeenten.[file:1] Daarna kunnen vier extra bronnen met dezelfde technische lijn worden toegevoegd: welstandsnota, provinciale omgevingsverordening, provinciale omgevingsvisie en leegstandsverordening.[file:1] Dit betekent dat de grootste dekkingstoename niet uit nieuwe architectuur komt, maar uit het hergebruiken van bestaande KOOP SRU-, parser- en cascade-logica.[file:1]

### 6.3 Wat handmatig moet

Handmatige datavulling blijft nodig voor bronnen met lage standaardisatie of matige CVDR-dekking, zoals woonvisies, parkeerbeleid, grondprijsbeleid, duurzaamheidsbeleid en welstandsnota’s buiten CVDR.[file:1] Het interne document geeft aan dat de beste aanpak is om te richten op de 50 grootste gemeenten, waar een beperkte set uploads al een groot deel van de marktwaarde afdekt.[file:1] Voor investeerders betekent dit dat een vendor-admin workflow, niet extra engineering, de bottleneck vormt in de korte termijn-uitrol.[file:1]

### 6.4 Partnerships die we niet zelf bouwen

Drie partnerlijnen zijn volgens het document strategisch slimmer dan zelf bouwen: Vindsubsidies voor gemeentelijke en provinciale subsidies, NVM/brainbay of Kadaster voor transactiedata en prijsinformatie, en Kadaster BRK-achtige eigendomsinformatie via bestaande API-koppelingen.[file:1] Deze keuzes zijn logisch omdat ze hoge onderhoudslast, licentiecomplexiteit en brede gemeentelijke variatie vermijden.[file:1] Daardoor kan Propdex zich concentreren op het combineren, verrijken en scoren van data in plaats van op het volledig zelf produceren van iedere bron.[file:1]

### 6.5 Investeringslogica en roadmap

De kern van de investeringscase is dat de infrastructuur al staat; de komende groei zit in uitrol, bronvulling en data-partnerships.[file:1] Dat maakt de roadmap relatief voorspelbaar: eerst brede gemeentelijke dekking op de bestaande ingest-paden, daarna verrijking met externe datasets en commerciële feeds, en vervolgens verfijning van scoremodellen en signalering.[file:1] De strategische waarde ligt dus minder in “meer bouw” en meer in “meer dekking, betere normalisatie en snellere interpretatie” van een groeiend aantal bronnen.[file:1]

## Bronnenlijst

### Landelijke wet- en beleidsbronnen
- Rijksoverheid. (z.d.). *Omgevingswet en onderliggende besluiten (Bbl, Bal, Bkl).* wetten.overheid.nl / KOOP BWB API.[web:549][web:551]
- Informatiepunt Leefomgeving (IPLO). (z.d.). *Ladder voor duurzame verstedelijking.* iplo.nl.[web:14][web:389]
- Rijksoverheid. (z.d.). *Nationale Woon- en Bouwagenda.* rijksoverheid.nl.[web:7][web:12]
- Rijksoverheid. (z.d.). *Woningwet en corporatieregels.* wetten.overheid.nl / KOOP BWB.[web:7][web:93]
- Rijksoverheid. (z.d.). *Asbest- en sloopregels.* wetten.overheid.nl / Ascert.[web:8][web:522]
- Rijksdienst voor Ondernemend Nederland (RVO). (z.d.). *Subsidies en financiering voor vastgoed en verduurzaming.* rvo.nl / data.overheid.nl.[web:9][web:488]
- RVO. (z.d.). *BENG en energieprestatie.* rvo.nl.[web:10][web:498]
- Rijksoverheid / AERIUS / RIVM / BIJ12. (z.d.). *Stikstof en Natura 2000.* aerius.nl, rivm.nl, bij12.nl.[web:11][web:566]
- Rijksoverheid. (z.d.). *Rijksbeleid monitoring.* rijksoverheid.nl / Tweede Kamer open data.[web:13][web:540]

### Provinciale bronnen
- Lokale wet- en regelgeving. (z.d.). *Provinciale omgevingsverordening.* lokaleregelgeving.overheid.nl / CVDR.[web:15][web:528]
- Lokale wet- en regelgeving. (z.d.). *Provinciale omgevingsvisie.* lokaleregelgeving.overheid.nl / CVDR.[web:16]
- Rijksoverheid. (z.d.). *Woondeals en woningbouwafspraken.* rijksoverheid.nl / volkshuisvestingnederland.nl.[web:17]
- Provinciale subsidieportalen. (z.d.). *Provinciale subsidies.* diverse provinciale loketten / Vindsubsidies.[web:18][web:488]
- Provincies / NNN / WFS-kaarten. (z.d.). *Natuur en stikstof provinciaal.* provinciale beleidsnota’s en kaartlagen.[web:19][web:562]
- Provinciale erfgoedatlassen. (z.d.). *Provinciaal erfgoed.* provinciale cultuurhistorische waardenkaarten.[web:20]

### Gemeentelijke bronnen
- Lokale wet- en regelgeving. (z.d.). *Omgevingsvisie.* lokaleregelgeving.overheid.nl / CVDR.[web:24]
- Lokale wet- en regelgeving. (z.d.). *Welstandsnota.* lokaleregelgeving.overheid.nl / CVDR en gemeentelijke websites.[web:25]
- Lokale wet- en regelgeving. (z.d.). *Woonvisie.* lokaleregelgeving.overheid.nl / CVDR en gemeentelijke websites.[web:26]
- Lokale wet- en regelgeving. (z.d.). *Parkeerbeleid / parkeerverordening.* lokaleregelgeving.overheid.nl / CVDR en CROW-publicatie 381.[web:27]
- Lokale wet- en regelgeving. (z.d.). *Huisvestingsverordening.* lokaleregelgeving.overheid.nl / CVDR.[web:28]
- Officiële bekendmakingen. (z.d.). *Vergunning-klimaat / bekendmakingen monitoring.* officielebekendmakingen.nl.[web:29][web:38]
- Rechtspraak. (z.d.). *Jurisprudentie AI-analyse.* uitspraken.rechtspraak.nl / Rechtspraak open data.[web:30][web:438]
- Open Raadsinformatie. (z.d.). *Raadsinformatie.* openraadsinformatie.nl / VNG / OpenState.[web:31][web:453]
- Lokale wet- en regelgeving. (z.d.). *Leegstandsverordening.* lokaleregelgeving.overheid.nl / CVDR.[web:32][web:474]
- Gemeentelijke subsidieportalen. (z.d.). *Gemeentelijke subsidies.* gemeentelijke websites, CVDR, Vindsubsidies.[web:33][web:488]
- Lokale wet- en regelgeving. (z.d.). *Grondprijsbeleid.* gemeentelijke grondprijzenbrieven en CVDR.[web:34]
- Gemeentewebsites / beleidsnota’s. (z.d.). *Duurzaamheidsbeleid.* klimaatvisies, TVW, beleidsregels.[web:35][web:495]
- Rijksdienst voor het Cultureel Erfgoed (RCE). (z.d.). *Beschermd erfgoed / rijksmonumenten.* linkeddata.cultureelerfgoed.nl / RCE API.[web:36][web:512]
- Lokale wet- en regelgeving. (z.d.). *Erfgoedverordening.* lokaleregelgeving.overheid.nl / CVDR.[web:37][web:524]
- Officiële bekendmakingen. (z.d.). *Bekendmakingen monitoring.* officielebekendmakingen.nl.[web:38][web:429]
- Gemeente RSS / lokale media / BeleidsRadar. (z.d.). *Nieuws & beleidsmonitoring.* diverse RSS-feeds en nieuwsbronnen.[web:39][web:543]

### Externe data- en API-bronnen
- Kadaster / PDOK. (z.d.). *BAG dataset en BAG API.* kadaster.nl / pdok.nl.[web:549][web:551][web:558]
- 3DBAG. (z.d.). *3DBAG API en release notes.* api.3dbag.nl / docs.3dbag.nl.[web:559][web:556]
- Kadaster. (z.d.). *BRK, koopsom- en transactiediensten.* kadaster.nl.[web:578][web:584][web:588]
- RVO. (z.d.). *EP-Online webservice / geregistreerde energielabels.* ep-online.nl / data.overheid.nl / RVO-handleiding.[web:554][web:199][web:557]
- RCE. (z.d.). *Linked Data API RCE en beschermde gezichten.* cultureelerfgoed.nl / linkeddata.cultureelerfgoed.nl.[web:512][web:518][web:519]
- AERIUS / RIVM / NGR. (z.d.). *Natura2000, habitatkaarten en stikstofdata.* aeriusproducten.nl / rivm.nl / nationaalgeoregister.nl.[web:562][web:564][web:570]
- RIVM / IPLO / regionale GIS-portalen. (z.d.). *Luchtkwaliteit en geluid.* rivm.nl / iplo.nl / regionale geoportalen.[web:573][web:576][web:567]
- BRO / WUR / Overheid.nl. (z.d.). *Bodemkaart en bodemdata.* pdok.nl / wur.nl / data.overheid.nl.[web:571][web:574][web:568]
- DSO / Omgevingsloket. (z.d.). *Omgevingsplan-API’s en planregels op de kaart.* DSO / gemeente- en provinciale planportalen.[web:526][web:529]
- Vindsubsidies. (z.d.). *Subsidie-aggregatie voor gemeenten en provincies.* vindsubsidies.nl.[web:488][web:489]
- Brainbay / NVM / Kadaster. (z.d.). *Transactie- en marktinformatie / prijsontwikkeling.* brainbay.nl / NVM-producten / Kadaster-producten.[web:583][web:586][web:584]

### Methodiek en bronvermelding
- Scribbr. (z.d.). *Opmaak van je APA-literatuurlijst.* scribbr.nl.[web:592]
- Universiteit van Tilburg / RU / UvA en andere bibliotheekgidsen voor APA-richtlijnen en referentielijsten.[web:593][web:594][web:595][web:604]

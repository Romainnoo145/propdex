# M055 — Ruimtelijk: Omgevingsvisie + Ladder + Geo-overlay — Doc context

5 cascade-documenten voor M055. Gebruik bij planning van M055-slices.

Index: `.planning/CASCADE-DOCUMENT-MAPPING.md`

---

## GEM-01 — Omgevingsvisie (gemeente) → `beleidsalignement` (S02)

**Beschrijving:** De gemeentelijke omgevingsvisie is de integrale langetermijnvisie van de gemeente op de fysieke leefomgeving. Verplicht onder de Omgevingswet; zelfbindend voor de gemeente. Bevat gemeentelijke ambities voor wonen, mobiliteit, groen/blauw, economie, klimaat, erfgoed en de ruimtelijke vertaling daarvan naar gebieden en thema's.

**Rol in Propdex:** Beleidsalignement per perceel/plan: sluit een project aan bij de gemeentelijke visie op dit gebied (groeikans, transformatiezone, behoud) of botst het ermee? Vertaalt abstract beleid naar een concrete "windrichting" voor een specifieke locatie.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `gebiedskarakter` | string | Bijv. "woonwijk versterken", "transformatiegebied", "behoud en versterking" |
| `woningbouwprioriteit` | enum | Hoog / gemiddeld / laag / niet benoemd |
| `transformatie_kansgebied` | bool | Gebied expliciet aangewezen voor transformatie |
| `functiemenging_richting` | string | Meer wonen / meer werken / menging |
| `klimaat_ambities` | string[] | Klimaatadaptatie, hittestress, waterberging |
| `mobiliteitsstrategie` | string | Knooppuntgericht / auto-arm / fiets first |
| `tijdshorizon` | int | Jaar van visie (bijv. 2040) |
| `visie_niveau` | enum | Gemeente / regio / thematisch |
| `prestatieafspraken_relevantie` | string | Koppeling met Woningwet-prestatieafspraken |

**Primaire bronnen:** CVDR en gemeentelijke beleidspagina's. Zoek op "omgevingsvisie", "structuurvisie" (legacy), "toekomstvisie". Let op: sommige gemeenten werken regionaal + lokaal of verwerken thema's in omgevingsvisie + apart woonprogramma.

**Business-regels:**
- Beleidsalignement-badge: "Gemeente ziet dit gebied als [karakter]; project sluit [wel/niet] aan bij visie"
- Rapportparagraaf "Gemeentelijke visie": kernambities voor het gebied + mate van aansluiting project
- Score-effect: sterk positief bij expliciet transformatie-/woningbouwkansgebied; risico bij "behoud en versterking" zones

**Edge cases:**
- Omgevingsvisie is zelfbindend voor gemeente maar niet voor burgers/ontwikkelaars — labelen als "beleidsrichting gemeente", niet als hard recht
- Detailniveau verschilt sterk: sommige visies hebben gebiedsprofielen per wijk, andere zijn abstract — "niet gespecificeerd voor dit gebied" tonen waar nodig
- Naam varieert: "omgevingsvisie", "structuurvisie" (oud), "toekomstvisie" — breed zoeken in CVDR

---

## LAND-02 — Ladder duurzame verstedelijking → `ladder_risico` (S03)

**Beschrijving:** De Ladder voor duurzame verstedelijking (artikel 5.129g Bkl) verplicht bij nieuwe stedelijke ontwikkelingen tot een onderbouwing van de behoefte en een ruimtelijke afweging van de locatiekeuze. Instructieregel in het Bkl; moet worden toegepast bij omgevingsplannen en vergunningen voor stedelijke ontwikkelingen.

**Rol in Propdex:** Geeft per plan aan of de ontwikkeling Ladder-plichtig is en waar de risico's in de motivering zitten (behoefte, locatieafweging). Biedt een RvS-risico-indicator via jurisprudentieanalyse. Verbindt landelijke Ladder-regel met regionale/gemeentelijke beleidsdocumenten (Woondeals, woonvisies, omgevingsplannen).

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `is_stedelijke_ontwikkeling` | bool | Op basis van omvang/functie |
| `binnen_bestaand_stedelijk_gebied` | bool | BSG-definitie/kaart |
| `ladder_plichtig` | bool | Afgeleid veld |
| `type_behoefte` | enum | Kwantitatief / kwalitatief |
| `bron_behoefte` | string[] | Woondeals, woonvisie, marktstudies |
| `mate_behoefte_onderbouwing` | enum sterk/matig/zwak | Afgeleid uit jurisprudentiepatronen |
| `risico_trede1` | enum laag/midden/hoog | |
| `beschouwing_alternatieve_locaties` | bool | |
| `bereikbaarheid_milieu_afgewogen` | bool | |
| `risico_trede2` | enum laag/midden/hoog | |

**Primaire bronnen:** Artikel 5.129g Bkl via BWB, InfoMil/IPLO-handreiking, Rechtspraak.nl (Ladder-filter op bestaande jurisprudentie-feed).

**Business-regels:**
- Ladder-badge bij plannen: "Ladder-plichtig (indicatief)" of "waarschijnlijk niet Ladder-plichtig" op basis van programma/omvang/locatie
- Rapportblok "Ladder duurzame verstedelijking": trede 1+2 samenvatting + jurisprudentie-snippet (x zaken, y% vernietigd, topredenen)
- Ladder-risicoscore koppelen aan Potentie-/Risicoscore: hoog bij zwakke behoefte/locatieonderbouwing + ongunstige jurisprudentie

**Edge cases:**
- Ladder gaat over nieuwe stedelijke ontwikkeling — ook binnen bestaand stedelijk gebied kan Ladder-plichtig zijn; niet alleen "buiten BSG"
- Niet elke planwijziging is Ladder-plichtig — altijd disclaimers ("indicatie, geen juridisch oordeel")
- Behoefte-onderbouwing kan verouderen — datum/jaargang van gebruikte Primos-cijfers altijd tonen

---

## PROV-01 — Omgevingsverordening → verfijnt bestemming + hard limits (S04)

**Beschrijving:** Elke provincie heeft precies één omgevingsverordening voor haar grondgebied. Bundelt voormalige provinciale milieu-, water- en landschapsverordeningen. Bevat zowel direct werkende regels (grondwaterbeschermingsgebieden, stiltegebieden) als instructieregels voor gemeenten en waterschappen.

**Rol in Propdex:** Bepaalt of een plan planologisch mogelijk gemaakt mag worden door de gemeente. Provinciale regels kunnen bouwmogelijkheden begrenzen in stiltegebieden, grondwaterbeschermingszones of landschappelijk waardevolle gebieden. Stuurt via instructieregels de inhoud van omgevingsplannen.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `grondwaterbeschermingsgebied_type` | enum | Waterwingebied / grondwaterbeschermingsgebied / boringsvrije zone |
| `stiltegebied` | bool | Beperkingen op lawaaiige functies |
| `reserveringszone_weg_spoor` | bool + int | Breedte (bijv. 15m) + verbod nieuwe bouwwerken |
| `instructieregel_omgevingsplan` | string[] | Verplichtingen voor gemeenten (reserveringszones, grondwaterbescherming) |
| `instructieregel_programma` | string[] | Instructies voor programma's en waterschapsregels |
| `provinciaal_belang` | bool | Regel gebaseerd op provinciaal belang → gemeente móet volgen |
| `direct_werkende_regel` | bool | Bindt burgers/ontwikkelaars direct (vs. via omgevingsplan) |

**Primaire bronnen:** 12 provinciale omgevingsverordeningen via CVDR/lokaleregelgeving.overheid.nl, IPLO-kennispagina's over grondwater/geluid/instructieregels.

**Business-regels:**
- Perceelbadge "Provinciale zones": toon welke zones het perceel raken + kernbeperking
- Rapportparagraaf "Provinciale randvoorwaarden": zones, instructieregels, impact op vergunnings- en planologische haalbaarheid
- Score-effect: negatief in streng beschermde zones, positief in aangewezen ontwikkelcorridors

**Edge cases:**
- Verordeningen verschillen sterk per provincie — parser moet generiek genoeg zijn voor variatie in structuur en terminologie
- Direct werkende regel vs. instructieregel: onderscheid moet helder in UI (anders lijkt instructieregel "harder" dan hij is)
- Periodieke herziening (2–4 jaar groot + tussentijdse amendementen) — altijd via CVDR-versioning de geldende versie pakken

---

## PROV-02 — Provinciale omgevingsvisie → `beleidsalignement_provincie` (S02, gecombineerd)

**Beschrijving:** De provinciale omgevingsvisie is de integrale langetermijnvisie van de provincie op de kwaliteit en gewenste ontwikkeling van de fysieke leefomgeving. Provinciale Staten stellen één omgevingsvisie vast; zelfbindend, strategisch kader voor omgevingsverordening, provinciale programma's en regionale gebiedsprocessen.

**Rol in Propdex:** Bepaalt welke regio's groeikansen krijgen (stedelijke netwerken, woningbouwcorridors, logistieke knooppunten) en welke gebieden voor natuur/landbouw/landschap worden gereserveerd. Legt provinciale woningbouw- en infrastructuurambities neer die richtinggevend zijn voor gemeentelijke omgevingsvisies en -plannen.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `ontwikkelregio` | string[] | Naam van stedelijke netwerken/ontwikkelregio's |
| `woningbouwcorridors` | string[] | Prioritaire ontwikkelgebieden (bijv. corridors, knooppunten) |
| `landelijk_beperkingsgebied` | bool | Provincie legt beperkingen op verstedelijking in dit gebied |
| `woningbouwopgave_per_regio` | string | Indicatieve aantallen woningen waar in visie benoemd |
| `infrastructuur_opgaven` | string[] | OV-knooppunten, hoofdwegen, energie-infrastructuur |
| `thema_prioriteiten` | string[] | Per regio: verstedelijking, natuurversterking, energietransitie, klimaatadaptatie |
| `stedelijk_beleid` | string | Concentratie rond OV-knooppunten / binnenstedelijk vs. buitengebied |
| `hoofdambities_per_thema` | object | Wonen, economie, mobiliteit, energie/klimaat, natuur, water, erfgoed |

**Primaire bronnen:** Provinciale omgevingsvisies via CVDR/lokaleregelgeving.overheid.nl, IPLO, provinciale websites voor kaarten en thematische bijlagen. KOOP SRU-ingest parallel aan omgevingsverordeningen (12 provincies).

**Business-regels:**
- Badge op gemeente-/perceelpagina: "Ligt in provinciale ontwikkelregio X / woningbouwcorridor Y"
- Rapportsectie "Provinciale ontwikkelrichting": past project in provinciale concentratiestrategie of botst het?
- Koppeling met Woondeals (PROV-03): omgevingsvisie = ruimtelijk kader, Woondeals = kwantitatieve afspraken — beide tonen

**Edge cases:**
- Omgevingsvisie is beleidsrichting, géén harde norm (die zit in omgevingsverordening/omgevingsplan) — altijd als zodanig labelen
- Detailniveau verschilt per provincie: sommige hebben expliciete aantallen, andere zijn abstracter — "onbekend/niet gespecificeerd" tonen waar nodig
- Overgang van oude structuurvisies: via CVDR-datering altijd de actuele omgevingsvisie pakken, niet oude strategiedocumenten vermengen

---

## PROV-03 — Woondeals & woningbouwafspraken → `woondeal_boost` (S05)

**Beschrijving:** Woondeals zijn regionale afspraken tussen Rijk, provincies, gemeenten, corporaties en andere partijen over de woningbouwopgave tot en met 2030 in 35 woondealregio's. Concretiseren de landelijke ambitie van 900.000+ woningen in aantallen per regio/gemeente, inclusief segmentverdeling (sociaal, midden, vrij) en aandacht voor betaalbaarheid.

**Rol in Propdex:** Kwantitatief regionaal kader — hoeveel woningen moeten er waar bij komen, welk aandeel betaalbaar, welke doelgroepen. Helpt beoordelen of projecten in lijn zijn met regionale afspraken en daarmee meer kans hebben op bestuurlijke steun, versnelling en rijksbijdragen (Woningbouwimpuls).

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `woondeal_regio_naam` | string | Bijv. MRA, SRBT, U10, Foodvalley |
| `woningbouwopgave_regio_2030` | int | Aantal extra woningen per regio |
| `woningbouwopgave_per_provincie` | int | Optellend tot ~900.000 |
| `aandeel_betaalbaar` | float | Streef ~2/3 betaalbaar |
| `aandeel_sociaal` | float | ~30% sociale huur |
| `aandeel_midden` | float | ~40% middeninkomens (regionale variatie) |
| `doelgroepen` | string[] | Aandachtsgroepen, ouderen, studenten, arbeidsmigranten |
| `opgave_per_gemeente` | object | Aantallen per gemeente binnen regio |
| `sleutelprojecten` | string[] | Benoemde gebiedsontwikkelingen en versnellingslocaties |

**Primaire bronnen:** Rijk/VolkshuisvestingNederland overzichtspagina Woondeals, 35 regionale Woondeals (PDF) op rijksoverheid.nl, Datawonen "Woondealregio"-databank.

**Business-regels:**
- Regiobadge op gemeente-/perceelpagina: "Ligt in Woondealregio X met opgave Y woningen tot 2030, waarvan Z% betaalbaar"
- Rapportblok "Regionale woningbouwafspraken (Woondeal)": hoe draagt project bij aan kwantitatieve en kwalitatieve opgave van de regio
- Potentie-score verhogen in regio's waar opgave groot is, realisatie achterblijft, en project in gewenst segment/doelgroep valt

**Edge cases:**
- Woondeals zijn bestuurlijke afspraken, geen formeel juridisch bindende normen — presenteren als beleidskader, niet als harde verplichting
- Opgaven kunnen worden herijkt (bijv. Brabant) — altijd jaargang en versie tonen
- Overlap met woonvisies en omgevingsvisies — Woondeals zijn regionaler en kwantitatiever; beide lagen combineren maar onderscheiden in behoefte/segment-analyse

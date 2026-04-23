# M056 — Erfgoed + Natuur verdieping — Doc context

4 cascade-documenten voor M056. Gebruik bij planning van M056-slices.

Index: `.planning/CASCADE-DOCUMENT-MAPPING.md`

---

## GEM-14 — Erfgoedverordening → verfijnt monument (gemeentelijk) (S01)

**Beschrijving:** Juridische regelbron achter lokale erfgoedbescherming. Bevat doorgaans procedures voor aanwijzing, voorbescherming, vergunningplichten, instandhoudingsplichten, beschermde categorieën en de rol van de adviescommissie. Onder de Omgevingswet mogen onderdelen die de fysieke leefomgeving wijzigen nog in de overgangsperiode in een erfgoedverordening staan, maar moeten richting 2032 in het omgevingsplan worden verwerkt.

**Rol in Propdex:** Verfijnt de monument-factor: niet alleen of iets beschermd is (GEM-13 objectlaag), maar hoe die bescherming bestuurlijk werkt — welke vergunningplichten gelden, hoe de aanwijzingsprocedure werkt, en welke instandhoudingsverplichtingen er zijn. Cruciaal onderscheid: regel vs. register.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `erfgoedcategorie` | string[] | Gemeentelijk monument / beeldbepalend pand / beschermd gezicht |
| `aanwijzingsprocedure` | string | Termijnen, bezwaar, rechtsbescherming |
| `voorbescherming_termijn` | int | Weken/maanden na melding aanwijzingsvoornemen |
| `vergunningplicht_type` | string[] | Sloop / verbouw / gebruik / reliëfwijziging |
| `uitzonderingen` | string[] | Vergunningvrije gevallen |
| `instandhoudingsplicht` | bool | |
| `adviescommissie_verplicht` | bool | |
| `juridische_basis` | string | Artikelverwijzing Omgevingswet / gemeentelijke verordening |

**Primaire bronnen:** CVDR (bijna altijd als decentrale regeling geconsolideerd). Koppel tekstlaag altijd aan objectlaag GEM-13.

**Business-regels:**
- Vergunningplicht-overzicht bij gemeentelijk monument: welke ingrepen zijn vergunningplichtig?
- Instandhoudingssignaal: eigenaar heeft actieve onderhoudsplicht — relevant voor renovatie-businesscase
- Adviescommissie-doorlooptijd: verplicht advies → langere procedure dan reguliere omgevingsvergunning

**Edge cases:**
- Erfgoedverordening zegt niet welke objecten op de monumentenlijst staan — daarvoor separate objectbron (GEM-13) nodig
- Overgangsrecht Omgevingswet: verordening kan gedeeltelijk in omgevingsplan zijn opgenomen — altijd controleren welke versie actueel is

---

## PROV-06 — Provinciaal erfgoed → verfijnt monument (provinciaal) (S02)

**Beschrijving:** Provincies hebben eigen cultuurhistorische waardenkaarten/atlassen waarop zij belangrijke cultuurhistorische structuren, landschappen en ensembles aanwijzen, naast rijks- en gemeentelijke monumenten. Tonen historische verkavelingspatronen, cultuurhistorische landschappen, linies, kastelen/buitenplaatsen, historische infrastructuur en gebieden met hoge archeologische verwachtingswaarde.

**Rol in Propdex:** Laat zien of een perceel in een provinciaal erfgoedgebied ligt, wat tot aanvullende ruimtelijke kwaliteitseisen en beperkingen kan leiden bovenop rijks- en gemeentelijk erfgoed. Context voor gebiedsontwikkelingen: projecten binnen provinciale erfgoedzones vragen nadrukkelijker aandacht voor inpassing en behoud van cultuurhistorische kwaliteiten.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `erfgoedgebied_type` | string | Cultuurhistorische hoofdstructuur / kroonjuweel / historische verkaveling / militair erfgoed / etc. |
| `erfgoedgebied_naam` | string | Bijv. "Brabantse zandontginningslandschap" |
| `kernwaarde` | string | Korte omschrijving cultuurhistorische kernwaarde |
| `provinciaal_belang` | bool | Erfgoed van specifiek provinciaal belang |
| `waarderingsniveau` | enum | Hoog / gemiddeld / basis |
| `sturingsrichting` | string | Bijv. "behoud en versterken" / "zorgvuldig inpassen" / "ruimte voor ontwikkeling" |
| `geometrie` | polygon | Via WFS/WMS provinciale geoportalen of BIJ12 |

**Primaire bronnen:** Provinciale cultuurhistorische kaarten/atlassen (CHW Noord-Brabant, CHS Zuid-Holland, CHAT Utrecht, Atlas Limburg), RCE-overzicht provinciale waardenkaarten, BIJ12 landelijke cultuurhistorische waardenkaart (IMNa_IKN) als basislaag.

**Business-regels:**
- Erfgoedbadge provinciaal op perceelpagina: "Ligt in provinciaal erfgoedgebied [naam] (type). Richting: behoud en versterking van cultuurhistorische kwaliteiten"
- Rapportblok "Provinciale erfgoedcontext": welke waarden spelen + impliciete inpassingsconsequenties (zichtlijnen, kavelstructuur, landschapsprofiel)
- Score-effect: verhoogde complexiteit/risico bij intensieve verdichting in kwetsbare erfgoedgebieden; extra kwaliteitspotentieel bij herbestemming/landschappelijke versterking

**Edge cases:**
- Provinciale kaarten verschillen sterk in detail, thematiek en waarderingsschaal — generiek datamodel met variatie toelaten (niet elke provincie kent "kroonjuwelen")
- Overlap met NNN, Natura2000, omgevingsverordening, gemeentelijk erfgoed — duidelijk markeren dat dit een extra kwaliteitslaag is, geen zelfstandig verbodsregime (tenzij verankerd via verordening/omgevingsplan)
- Sommige kaarten zijn indicatief; juridisch bindende bescherming loopt via omgevingsverordening/omgevingsplannen en monumentenregisters — onderscheid duidelijk in UI

---

## PROV-05 — Natuur & stikstof (prov.) → `stikstof_risico`, verfijnt natura2000 (S03)

**Beschrijving:** Provinciale uitwerking van het nationale stikstofkader (LAND-08). Elke provincie heeft een eigen gebiedsproces (Nationaal Programma Landelijk Gebied / NPLG opvolger) met concrete maatregelen voor stikstofreductie, natuurherstel en gebiedsgerichte aanpak. Provincies wijzen Natura2000-gebieden aan, stellen instandhoudingsdoelstellingen vast, en geven natuurvergunningen af voor projecten met depositie boven de drempel.

**Rol in Propdex:** Verfijnt de stikstof-risicokaart van LAND-08 met provinciale specifics: welke Natura2000-gebieden zijn in deze provincie aangewezen, wat zijn de provinciale stikstofreductiedoelen, en zijn er specifieke gebiedsprocessen die de beschikbare stikstofruimte beïnvloeden? Geeft aan bij welke provincie de natuurvergunning moet worden aangevraagd.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `bevoegd_gezag_natuurvergunning` | string | Provincie (naam) — voor dit perceel |
| `natura2000_gebieden_provincie` | string[] | Aangewezen gebieden in provincie |
| `stikstofreductiedoel_2030` | float | Provinciaal reductiedoel in mol/ha/jaar |
| `gebiedsproces_actief` | bool | Actief NPLG/gebiedsproces in omgeving |
| `stikstofregistratiesysteem_ruimte` | string | Beschikbare ruimte via PAS/SKAS of vervangende systemen |
| `provinciale_drempelwaarde` | float | Eventueel strengere drempel dan landelijk (0,005 mol/ha/jaar) |
| `natura2000_beheerplan` | string | Actueel beheerplan en herstelmaatregelen |

**Primaire bronnen:** Provinciale omgevingsverordening (aanwijzing Natura2000), NPLG/gebiedsplannen per provincie, provinciale AERIUS-toepassingen, BIJ12 voor Natura2000-beheerplannen.

**Business-regels:**
- Bevoegd-gezag-badge: "Natuurvergunning aan te vragen bij provincie [naam]"
- Verfijning van LAND-08 risicokaart: provinciale specifics tonen naast landelijke AERIUS-drempel
- Gebiedsproces-signaal: actief gebiedsproces kan stikstofruimte doen afnemen of juist vrijmaken via saldering

**Edge cases:**
- Provinciale beleidsdynamiek hoog: gebiedsprocessen, rechtszaken en politieke besluiten kunnen snel de beschikbare ruimte wijzigen — altijd datum tonen
- Vergunningbevoegdheid: in sommige gevallen is het Rijk bevoegd gezag (grote rijksprojecten) — altijd checken
- Combinatie met LAND-08: beide lagen samen tonen voor volledig beeld; PROV-05 verfijnt, vervangt LAND-08 niet

---

## LAND-08 — Stikstof & Natura2000 (landelijk) → referentie-context voor PROV-05 (S03, gecombineerd)

**Beschrijving:** Stikstofregels beschermen kwetsbare natuur in Natura 2000-gebieden tegen overmatige stikstofdepositie (NOx en NH₃) op basis van Europese natuurwetgeving. Na de PAS-uitspraak (2019) en de Porthos-uitspraak (2022) moet bij elk project met mogelijke extra stikstofdepositie worden beoordeeld of een natuurvergunning nodig is; de bouwvrijstelling is vervallen. AERIUS Calculator is het officiële rekeninstrument; bijdrage ≤ 0,005 mol/ha/jaar = onder drempel, geen natuurvergunning nodig.

**Rol in Propdex:** Per perceel en plan inzichtelijk maken of er stikstofrisico's zijn: nabijheid van stikstofgevoelige Natura 2000-gebieden + kans dat natuurvergunning nodig is. Verbindt landelijk stikstofkader (Wet stikstofreductie) met AERIUS-kaartlagen en provinciaal beleid voor indicatieve risico-inschatting. Dient als referentie-context voor PROV-05 (provinciale uitwerking).

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `afstand_tot_dichtsbijzijnde_natura2000` | float | In km |
| `is_binnen_bufferzone` | bool | Bijv. < 7 km / < 1 km |
| `is_stikstofgevoelig_gebied` | bool | Niet alle Natura2000-gebieden zijn stikstofgevoelig |
| `drempel_vergunningvrij` | float | 0,005 mol/ha/jaar extra depositie |
| `heeft_aerius_000_scenario` | bool | Conservatieve aannames → verwacht 0,00 mol/ha/jaar |
| `vergunningplicht_waarschijnlijk` | enum laag/midden/hoog | Op basis van afstand, omvang, type plan, verkeersgeneratie |
| `ruimte_voor_intern_salderen` | enum ja/nee/onbekend | Bij vervangende bouw/renovatie vs. uitbreiding |
| `externe_saldering_nodig` | bool | Indicatie bij netto toename depositie |

**Primaire bronnen:** AERIUS-kaartlagen (WMS/WFS), Wet natuurbescherming / Wet stikstofreductie en natuurverbetering, VolkshuisvestingNederland "Stikstof", handreiking "woningbouw en AERIUS" (vuistregels 0,00 mol/ha/jaar scenario's).

**Business-regels:**
- Stikstof-badge op plan/perceel: "Ligt binnen X km van stikstofgevoelig Natura2000-gebied; natuurvergunning waarschijnlijk nodig tenzij AERIUS aantoont ≤ 0,005 mol/ha/jaar"
- Risicoscore-factor "Stikstof / Natura2000": hoger bij grote plannen dichtbij gevoelige gebieden
- Rapportsectie "Stikstof en natuurvergunning": afstand/gevoeligheid, indicatie vergunningplicht, mitigerende routes (intern/extern salderen, ADC-route), advies specialistische AERIUS-berekening

**Edge cases:**
- Porthos-arrest: bouwvrijstelling vervallen → ook bouwfase-emissies toetsen, niet alleen gebruiksfase
- Vuistregels (bijv. 0,00 mol/ha/jaar bij 50 woningen op ≥ 7 km) zijn indicatief zonder juridische status — altijd labelen als "indicatie, echte toets = AERIUS"
- Stikstofbeleid blijft politiek en juridisch volatiel — altijd datum/jaargang van gebruikte datasets tonen, geen schijnzekerheid over toekomstige wijzigingen

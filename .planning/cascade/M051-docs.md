# M051 — Financieel: Subsidies — Doc context

3 cascade-documenten voor M051. Gebruik bij planning van M051-slices.

Index: `.planning/CASCADE-DOCUMENT-MAPPING.md`

---

## GEM-10 — Gemeentelijke subsidies → `subsidie_potentie` (S01/S02)

**Beschrijving:** Bestaat uit twee lagen: een algemene subsidieverordening en daaronder specifieke subsidieregelingen of leningsverordeningen. Voor Propdex relevant: woningisolatie, monumenten, duurzaamheidsleningen, startersleningen, funderingsherstel, woningverbetering en gebiedsgerichte woon- of verduurzamingssubsidies. Gemeenten werken vaak samen met SVn voor leningsproducten.

**Rol in Propdex:** Subsidie-potentie per perceel/project: welke gemeentelijke regelingen zijn beschikbaar voor dit type object en ingreep? Voedt de financiële module als mogelijke dekking voor onrendabele top.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `regeling_type` | enum | Subsidie / lening / garantie |
| `doelgroep` | string[] | Eigenaar-bewoners, VvE's, corporaties, marktpartijen |
| `objecttype` | string[] | Monument, woning, maatschappelijk vastgoed |
| `maatregelenlijst` | string[] | Isolatie, zonnepanelen, funderingsherstel, etc. |
| `max_bedrag` | float | |
| `max_percentage` | float | |
| `subsidieplafond` | float | |
| `aanvraagtermijn` | string | |
| `gebiedsbeperking` | string | Wijk/buurt/gemeente-breed |
| `combinatie_toegestaan` | bool | Stapeling met andere regelingen |
| `status` | enum | Open / gesloten / binnenkort |

**Primaire bronnen:** CVDR (algemene subsidieverordening), gemeentelijke subsidiepagina's (specifieke regelingen), SVn-leningzoeker voor leningsproducten per gemeente.

**Business-regels:**
- Subsidie-overzicht per project: "Voor dit type project zijn in gemeente X de volgende regelingen relevant"
- Financiële module: gemeentelijke subsidies + provinciale subsidies (PROV-04) + RVO (LAND-06) gecombineerd tonen
- Status-indicator: open/gesloten/binnenkort prominent tonen

**Edge cases:**
- Budgetten, plafonds en voorwaarden wijzigen sneller dan verordeningen — actuele statuslaag naast juridische regeling bijhouden
- Stapeling met provinciale/rijkssubsidies soms uitgesloten — altijd combinatieregel tonen

---

## PROV-04 — Provinciale subsidies → `subsidie_potentie` (S02, gecombineerd)

**Beschrijving:** Provincies hebben eigen subsidie- en bijdrageregelingen voor woningbouwversnelling, gebiedsgerichte aanpak wonen, verduurzaming van vastgoed, natuurherstel en mobiliteit. Vullen landelijke subsidies (RVO) en gemeentelijke subsidies aan; meestal gekoppeld aan provinciale beleidsagenda's en Woondeals.

**Rol in Propdex:** Per project/regio inzicht in welke provinciale subsidies beschikbaar zijn, met doelgroep, thema en indicatieve subsidiehoogte. Plaatst projecten in context van gebiedsprogramma's en Woondeals — projecten die passen binnen provinciale opgave kunnen rekenen op versnellingsregelingen of gebiedsgerichte subsidies.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `regeling_naam` | string | Bijv. "Gebiedsgerichte Aanpak Wonen Zeeland" |
| `provincie` | string | |
| `woondeal_regio` | string | Indien van toepassing |
| `doelgroep` | string[] | Gemeenten, corporaties, marktpartijen, VvE's |
| `thema` | string[] | Woningbouwversnelling, verduurzaming, natuurherstel, leefbaarheid |
| `subsidiabel_percentage` | float | Bijv. max. 50% van subsidiabele kosten |
| `max_subsidie_per_project` | float | Bijv. €50k–€750k of hoger |
| `min_subsidie` | float | |
| `totaal_budget` | float | |
| `openstellingsperiode_start` | date | |
| `openstellingsperiode_eind` | date | |
| `projecttypes` | string[] | Renovatie, transformatie, herstructurering, nieuwbouw |
| `randvoorwaarden` | string[] | Relatie met provinciaal beleid/Woondeal, betaalbaar, duurzaamheid |
| `woondeal_koppeling` | bool | Expliciet aan Woondeal gekoppeld |

**Primaire bronnen:** Provinciale subsidieportalen + CVDR (Algemene subsidiebesluiten + specifieke hoofdstukken), BIJ12 voor natuursubsidies, Vindsubsidies.nl als aggregator.

**Business-regels:**
- Provinciaal subsidie-blok naast landelijke RVO-regelingen: "In provincie X zijn voor dit type project de volgende regelingen relevant"
- Financiële module: provinciale subsidies als mogelijke dekking voor onrendabele top bij binnenstedelijke transformaties
- Koppeling met Woondeals: markeer regelingen die expliciet aan de regionale Woondeal zijn gekoppeld

**Edge cases:**
- Subsidies zijn tijdelijk en tender-gedreven — openstellingen, budgetten en voorwaarden veranderen regelmatig en kunnen snel sluiten
- 12 provincies met eigen scrapers is onderhoudsintensief — aggregator/partner (Vindsubsidies) is efficiënter en actueler
- Overlappende doelen (wonen + leefbaarheid + duurzaamheid) — helder aangeven of stapeling mogelijk is of uitgesloten

---

## GEM-11 — Grondprijsbeleid → `grondwaarde_fit` (S04)

**Beschrijving:** Grondprijsbeleid zit meestal in een grondprijzenbrief en/of bredere nota grondbeleid. De gemeente legt vast welke methodiek zij hanteert voor uitgifte van grond, erfpacht of snippergroen en welke prijzen of prijsbanden daarbij horen. Relevant waar de gemeente zelf grond uitgeeft, een actieve gebiedsontwikkelingsrol neemt of prijsbeleid koppelt aan doelen zoals sociale huur of maatschappelijke voorzieningen.

**Rol in Propdex:** Grondwaarde-fit per project: past de beoogde grondprijs bij de gemeentelijke methodiek en bandbreedtes? Signaleert of een residuele grondwaarde reëel is gegeven gemeentelijke grondprijsnormen. In private herontwikkelingen zonder gemeentelijke gronduitgifte: context, geen direct werkend kader.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `grondproduct` | string | Bijv. bouwkavel wonen, bedrijventerrein, maatschappelijk |
| `functiecategorie` | string | Sociaal / midden / vrij / commercieel |
| `prijs_per_m2` | float | |
| `prijsgrondslag` | enum | Residueel / comparatief / vaste prijs |
| `prijsjaar` | int | |
| `residueel_ja_nee` | bool | |
| `erfpacht_mogelijk` | bool | |
| `snippergroen_prijs` | float | |
| `sociale_huur_afwijking` | string | Bijzondere prijsstelling voor sociale huur |
| `grondbeleidstype` | enum | Actief / faciliterend / passief |

**Primaire bronnen:** Grondprijzenbrief, nota grondbeleid, erfpachtbeleid via CVDR of college-/raadsstukken. Zoek op "grondprijzenbrief", "nota grondbeleid", "erfpachtbeleid", "snippergroen".

**Business-regels:**
- Grondwaarde-fit: vergelijk residuele grondwaarde in businesscase met gemeentelijk prijsniveau voor functiecategorie
- Erfpacht-signaal: gemeente biedt erfpacht aan als alternatief voor koop
- Context-label: duidelijk aangeven of gemeente actieve grondeigenaar is of faciliterende rol speelt

**Edge cases:**
- Grondprijzenbrief is jaarlijks geïndexeerd — altijd prijsjaar tonen
- In private herontwikkeling zonder gemeentelijke grond: document is context, geen normstellend kader
- Sociale huur krijgt vaak afwijkende (lagere) grondprijs — apart tonen

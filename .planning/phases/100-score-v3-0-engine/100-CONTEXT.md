# Phase 100: Score v3.0 Engine - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Overhaul `compute_opportunity_score()` from a 5-factor vacancy-heavy model (v2.1) to a dual-subscore model: Potentie Score (+ kansen) and Risico Score (- waarschuwingen), integrating all data sources accumulated since v10.0. Backend-only phase — frontend types updated but UI is Phase 93.1.

</domain>

<decisions>
## Implementation Decisions

### Factor Selection & Weights

#### Potentie (kansen) — 8 factoren, totaal 80 punten

| Factor | Gewicht (van 100) | Motivering |
|--------|-------------------|------------|
| **Vrije grond / onderbenutting** | 12 | PBL en VU tonen aan dat 35-75% van woningbehoefte tot 2050 gerealiseerd kan worden in leegstaande panden en on(der)benutte locaties binnen de bestaande stad. Bij hoog groeiscenario gaat het om ruim 500.000 extra woningen. Onderbenutte percelen hebben grote ontwikkelpotentie. |
| **Optoppotentie (lagen/hoogte headroom)** | 10 | Het Rijk stimuleert optoppen als oplossing voor woningnood. Landelijke aanpak ingericht, provincies bieden subsidies, diverse overheden werken samen om technische en juridische belemmeringen weg te nemen. MinBZK, provincies en woningcorporaties werken aan opschaling. Gebouwen met voldoende hoogte-headroom hebben duidelijk voordeel. |
| **Bestemming compatibiliteit (wonen direct mogelijk)** | 12 | Als perceel reeds woonbestemming heeft, kan direct gebouwd worden; bij andere bestemming moet bestemmingsplanwijziging worden aangevraagd. Procedure vereist formele aanvraag, beoordeling door gemeente en inspraak, duurt vaak maanden tot jaren. |
| **Leegstand (acquisitiekans)** | 8 | Leegstaande of onbewoonde gebouwen zijn gemakkelijker te verwerven. PBL-onderzoek geeft aan dat leegstaande panden substantieel aandeel vormen van binnenstedelijke ontwikkelpotentie. |
| **Funda-frictie / gemotiveerde verkoper** | 5 | Lange tijd op Funda of meerdere prijsverlagingen wijst op gemotiveerde verkoper. Langdurige advertentieduur en prijsdaling bieden onderhandelingskans. Middelmatig gewicht omdat het voornamelijk indicatie van onderhandelkracht is. |
| **Perceelgrootte (schaal)** | 12 | In NL bestemmingsplannen geldt maximaal bebouwingspercentage. Groot perceel met laag bebouwingspercentage biedt ruimte om extra te bouwen of te splitsen; direct meer waard. Slimme beleggers zoeken actief naar percelen met onbenutte ontwikkelruimte. |
| **Demografie (CBS: bevolkingsgroei, inkomen, voorzieningen)** | 8 | Woningvraag gedreven door bevolkings- en huishoudensgroei. Sinds 2015 groeide aantal huishoudens jaarlijks met gemiddeld 76.000, vooral door immigratie en individualisering. Groei houdt aan tot 2039. Regio's met sterke groei (Flevoland +22,4%; Randstad +9-15%) bieden meer ontwikkelkansen. |
| **Vergunnings-succeskans (juridisch klimaat)** | 13 | Gunstig juridisch klimaat vergroot kans dat bouw-/verbouwplannen worden goedgekeurd. Onderzoek rangschikt approvals risk als een van vijf belangrijkste risicofactoren voor projectontwikkeling. Gemeenten verschillen sterk in afwijzingspercentages. |

**Totaal potentiepunten = 80** (genormaliseerd naar 0-100 schaal)

#### Risico (waarschuwingen) — 9 factoren, totaal 67 punten

| Factor | Gewicht (van 100) | Motivering |
|--------|-------------------|------------|
| **Funderingsrisico** | 15 | ABN AMRO waarschuwt dat droogte en dalende grondwaterstanden houten palen laten rotten; voor bijna 900.000 woningen wordt risico hoog ingeschat en herstel kost €30.000-€80.000. Deltares schat dat ~425.000 gebouwen resterende levensduur <15 jaar hebben wegens funderingsproblemen. |
| **Asbest-risico** | 6 | Asbest werd in NL tot 1993 veel gebruikt. Bij renovatie/sloop van gebouwen vóór 1994 moet asbestinventarisatie plaatsvinden en verwijdering door gecertificeerde bedrijven; overtreding kan leiden tot boetes tot €30.000. |
| **Bodemverontreiniging** | 7 | Bij bouw op verontreinigde grond moet bodem worden onderzocht en indien nodig gesaneerd. Vervuilde grond moet worden verwijderd of afgedekt met schone laag van één meter. Noodzaak tot sanering kan ontwikkelkosten fors verhogen. |
| **Monument-/erfgoedstatus** | 5 | Gebouwen met nationale, provinciale of gemeentelijke monumentstatus mogen niet zomaar worden verbouwd of gesloopt; er is meestal omgevingsvergunning nodig en er gelden strikte regels. Status beperkt ontwikkelmogelijkheden aanzienlijk. |
| **Bestemmingswijziging nodig** | 8 | Als huidige bestemming geen woningbouw toestaat, is bestemmingsplanwijziging nodig. Formeel gemeentelijk traject met inspraak en toetsing kan maanden tot jaren duren. Risico dat wijziging wordt afgewezen of vertraagd is reëel. |
| **Constructieve staat (bouwjaar < 1940 / energie-indicatie)** | 7 | Energie-index en leeftijd geven indicatie voor staat van onderhoud: woningen met label A-B zijn vaak in goede staat, renovatiepanden doorgaans label E of lager. Huizen vóór 1940 hebben vaak achterstallig onderhoud en lagere energieprestaties. |
| **Juridisch klimaat ongunstig (hoge afwijzing / lange procedure)** | 8 | Approvals risk en political risk zijn belangrijke risicofactoren met hoge gemiddelde risicoscores. Gemeenten met veel afgewezen vergunningaanvragen of lange bezwaarprocedures leveren groter risico voor ontwikkelaars. |
| **Criminaliteit in de wijk** | 6 | Criminaliteitsniveaus beïnvloeden woningmarkt direct; hoge criminaliteit fungeert als vroegtijdige indicator van veranderende buurt en wordt snel verdisconteerd in woningprijzen. Verhoogd criminaliteitsniveau vermindert verkoop-/verhuurpotentie en verhoogt risico op leegstand. |
| **Maximale bouwhoogte bereikt** | 5 | Wanneer gebouw het toegestane maximum heeft bereikt, is er geen ruimte voor optoppen of verticale uitbreiding. Beperkt ontwikkelingspotentie. |

**Totaal risicopunten = 67** (genormaliseerd naar 0-100 schaal)

### Ontbrekende Data Strategie

Combinatie van drie strategieën:

1. **Neutraal scoren (standaard)** — Ontbrekende factor krijgt neutrale score (gemiddelde over alle percelen). Eenvoudig, geen kunstmatige penalty.

2. **Lichte penalty voor kritische risicofactoren** — Ontbrekende data voor funderingsrisico, asbestrisico en bodemverontreiniging: -10% van maximale puntental van de factor. Stimuleert dat gegevens worden aangevuld; voorkomt onderschatting van risico's.

3. **Gewicht herverdelen bij >20% ontbrekend** — Als meer dan 20% van de factoren in een categorie (potentie of risico) ontbreken, wordt het totale gewicht evenredig verdeeld over de beschikbare factoren. Totaalscore blijft representatief.

### Score Output Structuur

Drie scores per perceel:
- **`potentie_score`** (0-100): gewogen som van potentiefactoren na normalisatie
- **`risico_score`** (0-100): gewogen som van risicofactoren, hoger = meer risico. Kan omgekeerd worden getoond als "veiligheidsscore" (100 - risico) in frontend.
- **`overall`**: potentie_score − risico_score (kan negatief zijn; frontend normaliseert naar 0-100 schaal)

### Score Breakdown JSON Shape

```json
{
  "scores": {
    "potentie": 72.5,
    "risico": 35.0,
    "overall": 37.5
  },
  "score_breakdown": {
    "perceelgrootte": {
      "waarde": 400,
      "genormaliseerde_score": 0.8,
      "gewicht": 12,
      "bijdrage": 9.6,
      "categorie": "potentie",
      "toelichting_kort": "Groot perceel (400m²) — ruimte voor uitbreiding of splitsing",
      "toelichting_lang": "Dit perceel heeft een oppervlakte van 400m², wat boven het gemiddelde ligt voor deze wijk. Gezien het huidige bebouwingspercentage biedt dit ruimte voor uitbreiding of splitsing in meerdere kavels. De perceelgrootte draagt positief bij aan de ontwikkelpotentie.",
      "data_bronnen": ["Kadaster", "BAG"]
    },
    "funderingsrisico": {
      "waarde": 0.9,
      "genormaliseerde_score": 0.9,
      "gewicht": 15,
      "bijdrage": 13.5,
      "categorie": "risico",
      "toelichting_kort": "Hoog funderingsrisico — houten palen op kleibodem",
      "toelichting_lang": "Het gebouw (bouwjaar 1923) staat in een gebied met kleibodem en hoog funderingsrisico. De combinatie van bouwjaar vóór 1970 en slappe ondergrond wijst op waarschijnlijk houten paalfundering. Herstelkosten worden geschat op €30.000-€80.000. Aanbevolen wordt een funderingsonderzoek uit te voeren voordat een investeringsbeslissing wordt genomen.",
      "data_bronnen": ["PDOK Funderingsrisicogebieden", "BAG", "Bodemdata.nl"]
    }
  }
}
```

Elke factor bevat:
- `waarde`: ruwe gemeten waarde (bouwjaar, percentage, m², etc.)
- `genormaliseerde_score`: waarde na normalisatie naar 0-1 schaal
- `gewicht`: het gewicht zoals hierboven geadviseerd
- `bijdrage`: product van genormaliseerde_score × gewicht
- `categorie`: "potentie" of "risico"

### Normalisatie

- Continue variabelen (perceeloppervlakte): log-schaal of percentiel-benadering om uitschieters te beperken
- Binaire variabelen (monument ja/nee): 0/1
- Definieer voor elke factor een duidelijke schaal (0-1) voordat gewichten worden toegepast

### Backfill & Data Strategie

**Pre-cachen (scan pipeline)** — Statische/semi-statische data:
- Funderingsrisico en bodemverontreiniging (historische gegevens)
- Monumentstatus
- Bestemmingsplan (PLU)
- Periodiek verversen (bijv. maandelijks)

**On-demand met caching** — Dynamische data:
- Leegstand (vacature status)
- Funda-frictie (advertentieduur, prijswijzigingen)
- Actuele criminaliteitscijfers
- Recente demografische cijfers op wijkniveau
- Caching op vraag: perceel_id + datumsleutel

**Hybride aanpak**: Cache statische datasets, haal dynamische data real-time op. Als externe call faalt, pas ontbrekende-data-strategie toe (zie hierboven).

### Scan Pipeline Uitbreiding

De volgende databronnen worden momenteel on-demand opgehaald maar moeten in de scan pipeline worden geïntegreerd zodat alle data beschikbaar is bij het scoren en bij het browsen op de kaart:

| Data | Bron | Huidig | Wordt |
|------|------|--------|-------|
| Energielabel | EP-Online API (per VBO-id) | On-demand bij rapport | Pre-cached in scan |
| WOZ waarde | WOZ Waardeloket (per nummeraanduiding) | On-demand bij rapport | Pre-cached in scan |
| Vergunningen | SRU Bekendmakingen API (per adres) | On-demand bij panel open (7d cache) | Pre-cached in scan |
| Bodem/bodemtype | Bodemloket + BRO WMS (per coördinaat) | On-demand bij risico-tab | Pre-cached in scan |
| Funderingsrisico | PDOK WFS (per postcode) | On-demand bij risico-tab | Pre-cached in scan |

**BRK eigendom blijft on-demand** — Kadaster licentie verbiedt caching. Wordt gekoppeld aan een popup-modal achter de "pand in gebruik" knop op het parcel detail panel (zie Deferred Ideas).

Door deze data in de scan pipeline te trekken:
1. Scoring v3.0 heeft alle factoren direct beschikbaar op het moment van scoren
2. Map-browsing is instant — geen wachten bij openen parcel panel
3. Rapport generatie wordt sneller (meeste data al gecached)
4. De huidige `aggregate_property_data()` (property_aggregator.py) hoeft straks geen externe calls meer te doen — alles zit al in de scan data
5. Dit maakt de weg vrij voor een toekomstige phase waarin "Genereer Rapport" wordt herschreven als pure template-render op pre-cached scan data + score narratieven (geen on-demand API calls meer)

### Per-Factor Narratief (Rapport-Ready)

De scoring engine moet per factor niet alleen een getal maar ook een **gestructureerde toelichting** genereren. Dit dient twee doelen:
1. **Frontend** — korte weergave per factor in de Potentie/Risico tabs
2. **Rapport** — uitgebreide onderbouwing voor het gegenereerde perceelrapport ("Genereer Rapport" knop)

Per factor levert de engine:
- `toelichting_kort`: 1-zin samenvatting voor de dashboard cards (bijv. "42% vrije grond — geschikt voor zelfstandige nieuwbouw")
- `toelichting_lang`: Alinea voor het rapport met context, onderbouwing en aanbeveling (bijv. "Dit perceel heeft 42% onbebouwde ruimte (185m²). Gezien de woonbestemming en het bebouwingspercentage is zelfstandige nieuwbouw naast het bestaande gebouw realistisch. Aanbevolen wordt een haalbaarheidsonderzoek uit te voeren voor...")
- `data_bronnen`: Lijst van gebruikte bronnen voor deze factor (bijv. ["BAG", "Kadaster", "PLU WMS"])

Dit zijn **template-based** narratieven (geen AI-calls), vergelijkbaar met de huidige `narrativeVrijeGrond()` / `narrativeOptoppotentie()` functies in de frontend PotentieLayer.tsx. De templates worden naar de backend verplaatst zodat zowel de frontend als het rapport dezelfde teksten gebruiken.

De `toelichting_lang` per factor vormt samen het "Analyse" hoofdstuk van het gegenereerde rapport — alle factor-toelichtingen achter elkaar geven een compleet beeld van waarom dit perceel wel of niet interessant is.

### Claude's Discretion

- Exact normalisatiealgorithme per factor (log-schaal vs percentiel vs lineair)
- Implementatie van gewichtsherverdeling bij ontbrekende data
- Database schema keuzes (nieuwe kolommen vs JSONB)
- Backfill tool implementatie details
- Performance optimalisatie van de scoring functie
- Exacte template-teksten per factor (mits ze de juiste context/onderbouwing/aanbeveling structuur volgen)

</decisions>

<specifics>
## Specific Ideas

- De totalen van potentie (80pt) en risico (67pt) worden genormaliseerd naar 0-100 schaal
- De risicototalen zijn hoger dan bij potentie omdat meerdere risicofactoren cumulatief kunnen optreden
- Overall score = potentie - risico; kan negatief zijn, frontend normaliseert
- "Veiligheidsscore" (100 - risico) als alternatieve weergave in de frontend
- Periodiek valideren en bijstellen van gewichten met lokale projectontwikkelaars/makelaars
- Narratief-templates verhuizen van frontend (PotentieLayer.tsx) naar backend scoring service
- `toelichting_kort` + `toelichting_lang` + `data_bronnen` per factor in score_breakdown
- Template-based (geen AI-calls) — deterministische, instant teksten
- Alle factor-toelichtingen samen vormen het "Analyse" hoofdstuk van het perceelrapport

</specifics>

<deferred>
## Deferred Ideas

- Expert validatie van gewichten met lokale projectontwikkelaars — na eerste release
- Phase 98 (Gemeente Bouwregels) zal de optoppotentie factor verbeteren met betere dekking
- Energielabel als aparte factor (nu onderdeel van constructieve staat) — toekomstige verfijning
- **BRK eigendom popup-modal** — "Pand in gebruik" knop op parcel detail panel opent modal met verse BRK-fetch (eigenaar, zakelijk gerechtigden, etc.). Geen caching (Kadaster compliance). Eigen UI-phase.
- **Rapport v2.0 herschrijving** — Na 93.2 zit alle data in de scan. "Genereer Rapport" wordt dan een pure template-render op pre-cached scan data + score narratieven. Geen `aggregate_property_data()` meer, geen on-demand API calls. Eigen phase.

</deferred>

---

*Phase: 100-score-v3-0-engine*
*Context gathered: 2026-03-11*

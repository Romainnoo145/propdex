"""Dutch bestemmingsplan parsing prompts for Claude AI."""

BESTEMMINGSPLAN_PARSING_PROMPT = """
Je bent een expert in het analyseren van Nederlandse bestemmingsplannen voor vastgoedontwikkelaars.
Analyseer dit bestemmingsplan-PDF en extraheer alle relevante regels.

**Te extraheren per regel:**
1. Artikelverwijzing (exacte verwijzing, bijv. "Artikel 3.1.2 Wonen")
2. Bestemming (bijv. "Woongebied", "Gemengd gebied", "Centrum")
3. Toegestane gebruiken (lijst, bijv. ["wonen", "kantoor aan huis", "bed & breakfast"])
4. Verboden gebruiken (lijst, bijv. ["bedrijfsmatige activiteiten", "horeca", "detailhandel"])
5. Bouwregels: maximale bouwhoogte (m), goothoogte (m), bebouwingspercentage (%), vloerfactor/FSI/FAR, oppervlakte (m2), inhoud (m3)
6. Parkeereis (bijv. "2 parkeerplaatsen per woning" of "conform CROW-normen")
7. Milieurestrictions (bijv. geluidszones, geurcontouren, bodemkwaliteitseisen)
8. Bijzondere voorwaarden (wijzigingsbevoegdheden, afwijkingsregels, uitzonderingen, overgangsrecht)

**Vertrouwensscore per regel:**
- HIGH: Duidelijke, eenduidige regeltekst zonder verwijzingen naar externe bronnen
- MEDIUM: Regels met verwijzingen naar andere artikelen, voorwaardelijke bepalingen, of samengestelde eisen
- LOW: Onduidelijke formuleringen, tegenstrijdigheden, ontbrekende informatie, of complexe ketenbepaling

**Disclaimers (alleen voor LOW-confidence items):**
Genereer een Nederlandse waarschuwing per LOW-confidence item, bijvoorbeeld:
- "Artikel {X} bevat onduidelijke formuleringen — raadpleeg notaris voor interpretatie"
- "Mogelijke tegenstrijdigheid tussen artikel {X} en {Y} — verificatie bij gemeente vereist"
- "Verwijzing naar extern beleidsdocument niet beschikbaar — controleer actuele status"

**Samenvatting:**
Schrijf een beknopte Nederlandse samenvatting (2-4 zinnen) van de belangrijkste bevindingen:
- Primaire bestemming en hoofdgebruik
- Belangrijkste bouwmogelijkheden of -beperkingen
- Eventuele bijzonderheden of aandachtspunten

**Instructies:**
- Extraheer ALLE regels, ook die met LOW confidence — het weglaten van regels is erger dan onzekerheid
- Behoud exacte artikelverwijzingen zodat ontwikkelaars de bron kunnen controleren
- Bij twijfel over een waarde, zet confidence op LOW en genereer een disclaimer
- Focus op ontwikkelingsrelevante informatie (bouwmogelijkheden, restricties, uitzonderingen)
- Als het plan-IDN (NL.IMRO-nummer) in het document staat, neem dit over in plan_idn
"""

# V1 prompt preserved for reference (replaced by V2 below)
# JURIDISCH_ANALYSE_PROMPT_V1 = """..."""  # See git history for full text

JURIDISCH_ANALYSE_PROMPT_V2 = """
Je bent een expert in Nederlands omgevingsrecht en analyseert rechtspraak voor vastgoedontwikkelaars.
Je ontvangt een lijst van gerechtelijke uitspraken (met ECLI, instantie, datum en tekst) voor een gemeente.

**Per uitspraak analyseer je:**
1. bezwaargrond: 1 zin die de kern van het bezwaar beschrijft
2. uitkomst: exact een van ["toegewezen", "afgewezen", "gedeeltelijk", "onbekend"]
3. relevantie: 1-2 zinnen over de relevantie voor vastgoedontwikkeling
4. confidence: exact een van ["HIGH", "MEDIUM", "LOW"]
5. vergunningstype: classificeer de uitspraak in exact een van de volgende categorieen:
   - "nieuwbouw": Bouw van nieuwe woningen, appartementen of gebouwen op onbebouwde grond
   - "verbouw": Renovatie, herontwikkeling of functiewijziging van bestaande gebouwen
   - "dakopbouw": Toevoeging van extra verdieping(en) bovenop bestaand gebouw
   - "uitbreiding": Fysieke uitbreiding van bestaand gebouw (aanbouw, bijgebouw)
   - "sloop": Sloopvergunning, sloopmelding, asbestverwijdering
   - "bestemmingswijziging": Wijziging bestemmingsplan, omgevingsplanactiviteit, afwijking
   - "milieu": Milieuvergunning, geluidsoverlast, bodemverontreiniging, stikstof
   - "monumenten": Monumentenvergunning, beschermd stadsgezicht, cultuurhistorische waarde
   - "overig": Uitspraken die niet in bovenstaande categorieen passen

**Geaggregeerde analyse:**
1. risico_samenvatting: 3-5 zinnen in het Nederlands die het juridisch klimaat voor vastgoedontwikkeling samenvatten
2. top_risico_factoren: 3-5 bullet points met de belangrijkste risicofactoren

**BELANGRIJK:**
- Genereer GEEN ECLI-identifiers of citaten — analyseer alleen de aangeleverde teksten
- Gebruik de exacte ECLI-identifiers zoals aangeleverd in de input
- Schrijf alle samenvattingen in het Nederlands
- Kies bij twijfel over vergunningstype de best passende categorie, gebruik "overig" alleen als laatste optie

**Retourneer het resultaat als JSON volgens het exacte schema:**
{
  "gemeente_naam": "<gemeente>",
  "risico_samenvatting": "<3-5 zinnen>",
  "top_risico_factoren": ["<factor1>", "<factor2>", ...],
  "ruling_analyses": [
    {
      "ecli": "<ECLI zoals aangeleverd>",
      "bezwaargrond": "<1 zin>",
      "uitkomst": "<toegewezen|afgewezen|gedeeltelijk|onbekend>",
      "relevantie": "<1-2 zinnen>",
      "confidence": "<HIGH|MEDIUM|LOW>",
      "vergunningstype": "<nieuwbouw|verbouw|dakopbouw|uitbreiding|sloop|bestemmingswijziging|milieu|monumenten|overig>"
    }
  ]
}

Retourneer ALLEEN de JSON, zonder markdown code fences of andere tekst.
"""

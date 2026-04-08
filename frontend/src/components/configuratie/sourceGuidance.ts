/**
 * Configuratie source guidance data.
 *
 * Context, relevance and checklist per document source. Used by
 * SourceGuidanceCard to render an explainer block. Extracted from
 * configuratie.tsx during M044/S02 so the data can be imported from
 * anywhere in the app without pulling in the giant route file.
 *
 * Sources are grouped by level (gemeente, provincie, landelijk) and
 * keyed by their sourceKey (matches the key used in the configuratie
 * source catalog).
 */

export interface SourceGuidance {
  explainer: string;
  relevance: string;
  checklist: string[];
}

export const SOURCE_GUIDANCE: Record<string, SourceGuidance> = {
  // ── Gemeente (10) ──
  omgevingsvisie: {
    explainer:
      "De omgevingsvisie beschrijft de langetermijnvisie van de gemeente op de fysieke leefomgeving. Het document schetst gewenste ontwikkelrichtingen voor wonen, werken, natuur en mobiliteit tot minimaal 2040.",
    relevance:
      "Bepaalt welke gebieden de gemeente aanwijst voor transformatie, verdichting of juist behoud — essentieel voor haalbaarheidsanalyses van herontwikkeling.",
    checklist: [
      "Welke gebieden zijn aangewezen als transformatie- of ontwikkellocatie?",
      "Wat is de gewenste woningdichtheid per deelgebied?",
      "Zijn er restricties op bouwhoogtes of stedenbouwkundige eisen?",
      "Welke functiemenging wordt nagestreefd (wonen, werken, voorzieningen)?",
      "Zijn er specifieke duurzaamheidseisen per ontwikkelgebied?",
    ],
  },
  welstandsnota: {
    explainer:
      "De welstandsnota bevat criteria waaraan het uiterlijk van bouwwerken moet voldoen. Per gebied gelden specifieke eisen voor materiaalgebruik, kleurstelling, dakvormen en gevelindeling.",
    relevance:
      "Beïnvloedt direct het ontwerp en de kosten van nieuwbouw- en renovatieprojecten. Vroegtijdig inzicht voorkomt afwijzingen bij de welstandscommissie.",
    checklist: [
      "In welk welstandsgebied valt de locatie (bijv. beschermd, regulier, vrij)?",
      "Welke materiaal- en kleureisen gelden voor gevels en daken?",
      "Zijn er specifieke eisen voor reclame-uitingen of luifels?",
      "Gelden er aanvullende criteria voor hoekpanden of zichtlocaties?",
      "Is er een sneltoetskader beschikbaar voor kleine ingrepen?",
    ],
  },
  woonvisie: {
    explainer:
      "De woonvisie beschrijft het gemeentelijk woonbeleid: woningbouwambities, doelgroepen, betaalbaarheid en prestatieafspraken met corporaties. Het document geeft richting aan de programmering van nieuwbouw.",
    relevance:
      "Bepaalt de gewenste woningtypemix en prijssegmenten. Projecten die aansluiten bij de woonvisie krijgen vaak voorrang in planprocedures.",
    checklist: [
      "Hoeveel woningen wil de gemeente bouwen en in welke segmenten?",
      "Welk percentage sociale huur, middenhuur en koop wordt verlangd?",
      "Zijn er specifieke doelgroepen benoemd (starters, senioren, arbeidsmigranten)?",
      "Welke prestatieafspraken zijn gemaakt met woningcorporaties?",
      "Is er een zelfbewoningsplicht of anti-speculatiebeding?",
    ],
  },
  parkeerbeleid: {
    explainer:
      "Het parkeerbeleid legt de parkeernormen vast voor nieuwbouw en functiewijzigingen. Per functie en locatie bepaalt het hoeveel parkeerplaatsen gerealiseerd moeten worden.",
    relevance:
      "Parkeernormen hebben directe impact op de financiële haalbaarheid: elke parkeerplaats kost €25.000–€50.000. Lage normen in binnenstedelijk gebied verbeteren de business case.",
    checklist: [
      "Welke parkeernorm geldt per woningtype en zone?",
      "Is er een mogelijkheid tot dubbelgebruik of deelmobiliteit?",
      "Welke afkoopregeling geldt als parkeren op eigen terrein niet lukt?",
      "Zijn er fietsparkeernormen voor de ontwikkeling?",
      "Gelden er afwijkende normen bij OV-knooppunten?",
    ],
  },
  leegstandsverordening: {
    explainer:
      "De leegstandsverordening regelt de meldplicht en aanpak van leegstaande panden. Eigenaren zijn verplicht leegstand te melden en mee te werken aan herbestemming of tijdelijk gebruik.",
    relevance:
      "Relevant bij aankoop van leegstaande panden voor herontwikkeling. De verordening kan tijdelijk gebruik faciliteren tijdens de planfase maar ook verplichtingen opleggen.",
    checklist: [
      "Geldt er een meldplicht voor leegstand en na hoeveel maanden?",
      "Welke sancties staan op langdurige leegstand?",
      "Zijn er mogelijkheden voor tijdelijke verhuur via een leegstandsvergunning?",
      "Faciliteert de gemeente actief herbestemming van leegstaande panden?",
    ],
  },
  "gemeentelijke-subsidies": {
    explainer:
      "Dit overzicht bundelt gemeentelijke subsidie- en stimuleringsregelingen voor vastgoedontwikkeling, verduurzaming en gebiedsontwikkeling. Regelingen variëren van directe subsidies tot leningen en fiscale voordelen.",
    relevance:
      "Subsidies kunnen de onrendabele top van projecten verkleinen. Vroegtijdig aanvragen — vaak vóór bouwstart — is cruciaal voor toekenning.",
    checklist: [
      "Welke subsidies zijn beschikbaar voor nieuwbouw of transformatie?",
      "Zijn er verduurzamingssubsidies voor bestaande bouw?",
      "Wat zijn de aanvraagdeadlines en -voorwaarden?",
      "Is er een plafond per project of per woning?",
      "Zijn subsidies stapelbaar met rijks- of provinciale regelingen?",
    ],
  },
  grondprijsbeleid: {
    explainer:
      "De grondprijzenbrief of het grondprijsbeleid beschrijft hoe de gemeente grondprijzen vaststelt bij uitgifte van gemeentelijke grond. Prijzen variëren per functie, locatie en marktsituatie.",
    relevance:
      "Bepaalt de verwervingskosten bij gemeentelijke gronduitgifte. Residuele grondwaardeberekeningen bepalen of een project financieel haalbaar is.",
    checklist: [
      "Hanteert de gemeente vaste grondprijzen of residuele grondwaarde?",
      "Welke grondprijs geldt per functie (wonen, kantoor, commercieel)?",
      "Zijn er kortingen voor sociale woningbouw of maatschappelijke functies?",
      "Hoe vaak worden grondprijzen herzien?",
      "Welke anti-speculatiebepalingen gelden bij gronduitgifte?",
    ],
  },
  duurzaamheidsbeleid: {
    explainer:
      "Het duurzaamheidsbeleid beschrijft gemeentelijke ambities voor energietransitie, klimaatadaptatie en circulair bouwen. Het kan bovenwettelijke eisen bevatten die verder gaan dan het Bouwbesluit.",
    relevance:
      "Bovenwettelijke duurzaamheidseisen beïnvloeden bouwkosten en ontwerp. Tegelijkertijd kunnen duurzaamheidsmaatregelen subsidies en versnelde vergunningverlening opleveren.",
    checklist: [
      "Welke energieprestatie-eisen gelden bovenop het Bouwbesluit (bijv. BENG+)?",
      "Zijn er eisen voor klimaatadaptatie (waterberging, hittestress)?",
      "Gelden er circulaire bouw- of sloopverplichtingen?",
      "Is aansluiting op een warmtenet verplicht of gewenst?",
      "Welke duurzaamheidscertificering wordt verlangd (GPR, BREEAM)?",
    ],
  },
  erfgoedverordening: {
    explainer:
      "De erfgoedverordening regelt de bescherming van gemeentelijke monumenten en beschermde stadsgezichten. Het beschrijft procedures voor wijzigingen aan beschermde objecten en gebieden.",
    relevance:
      "Ontwikkeling in of nabij beschermd erfgoed vereist extra vergunningen en kan het ontwerp sterk beïnvloeden. Vroegtijdig overleg met de erfgoedcommissie voorkomt vertraging.",
    checklist: [
      "Valt het pand of de locatie binnen een beschermd stadsgezicht?",
      "Is het pand aangewezen als gemeentelijk monument?",
      "Welke instandhoudingsverplichtingen gelden voor monumenten?",
      "Is er een vereenvoudigd regime voor inpandige wijzigingen?",
      "Welke subsidies zijn beschikbaar voor monumentenonderhoud?",
    ],
  },
  "nieuws-monitoring": {
    explainer:
      "Nieuws-monitoring bundelt recente nieuwsberichten, raadsbesluiten en beleidsontwikkelingen die relevant zijn voor de gemeente. Dit geeft actueel inzicht in politieke verschuivingen en nieuwe regelgeving.",
    relevance:
      "Actuele ontwikkelingen kunnen lopende projecten beïnvloeden: nieuwe bestemmingsplannen, gewijzigde parkeernormen of politieke koerswijzigingen.",
    checklist: [
      "Zijn er recente raadsbesluiten die het bestemmingsplan wijzigen?",
      "Zijn er nieuwe bouwprojecten aangekondigd in het gebied?",
      "Zijn er politieke discussies over woningbouw of verdichting?",
      "Zijn er wijzigingen in gemeentelijke verordeningen op komst?",
    ],
  },

  // ── Provincie (8) ──
  omgevingsverordening: {
    explainer:
      "De provinciale omgevingsverordening bevat bindende regels voor ruimtegebruik, bouwhoogtes, beschermde gebieden en milieuzonering. Deze regels werken door in gemeentelijke omgevingsplannen.",
    relevance:
      "Provinciale regels kunnen beperkingen opleggen die gemeentelijke bestemmingsplannen niet kunnen opheffen — essentieel om vroeg te checken.",
    checklist: [
      "Valt de locatie binnen een provinciaal beschermd gebied?",
      "Gelden er aanvullende bouwhoogte- of dichtheidsbeperkingen?",
      "Is er een Ladder-toets nodig voor het project?",
      "Welke milieuzonering geldt in het gebied?",
    ],
  },
  "ruimtelijke-visie": {
    explainer:
      "De provinciale omgevingsvisie beschrijft de langetermijnstrategie voor ruimtelijke ontwikkeling, verstedelijking en landschapsbeheer in de provincie.",
    relevance:
      "Geeft inzicht in welke regio's de provincie prioriteit geeft aan woningbouw en welke gebieden beschermd worden.",
    checklist: [
      "Ligt de locatie in een verstedelijkingsgebied of juist in een te beschermen landschap?",
      "Welke woningbouwtaakstellingen gelden voor de regio?",
      "Zijn er knooppuntontwikkelingsgebieden aangewezen?",
      "Welke duurzaamheidsambities stelt de provincie?",
    ],
  },
  woondeals: {
    explainer:
      "Woondeals zijn bestuurlijke afspraken tussen Rijk, provincie en gemeenten over woningbouwaantallen, versnellingslocaties en betaalbaarheid per regio.",
    relevance:
      "Projecten in woondeal-versnellingslocaties hebben vaak voorrang bij subsidies en vergunningverlening.",
    checklist: [
      "Hoeveel woningen moeten er in de regio worden gebouwd?",
      "Welke locaties zijn aangewezen als versnellingslocatie?",
      "Welke afspraken gelden over betaalbare woningen?",
      "Is er een regionaal woningbouwprogramma?",
    ],
  },
  "provinciale-subsidies": {
    explainer:
      "Subsidies vanuit de provincie voor verduurzaming, transformatie, woningbouw en herstructurering. Aanvullend op gemeentelijke en landelijke regelingen.",
    relevance:
      "Provinciale subsidies worden vaak over het hoofd gezien maar kunnen aanzienlijke bijdragen leveren aan transformatie- en verduurzamingsprojecten.",
    checklist: [
      "Welke provinciale subsidies zijn beschikbaar voor het projecttype?",
      "Zijn er regionale ontwikkelingsmaatschappij (ROM) fondsen?",
      "Welke aanvraagprocedures en deadlines gelden?",
      "Zijn provinciale subsidies combineerbaar met gemeentelijke en landelijke regelingen?",
    ],
  },
  "natuur-stikstof": {
    explainer:
      "Provinciale regels rond Natura 2000-gebieden, stikstofbeleid en beperkingen voor bouwactiviteiten nabij beschermde natuurgebieden.",
    relevance:
      "Stikstofproblematiek kan bouwprojecten vertragen of blokkeren — vroegtijdig een AERIUS-berekening laten maken is essentieel.",
    checklist: [
      "Ligt de locatie nabij een Natura 2000-gebied?",
      "Is een AERIUS-berekening nodig voor het project?",
      "Gelden er provinciale beperkingen op de stikstofdepositie?",
      "Is een ecologisch onderzoek vereist?",
    ],
  },
  "erfgoed-provinciaal": {
    explainer:
      "Provinciale monumentenlijst en cultuurhistorische waardenkaart. Aanvullend op rijksmonumenten en gemeentelijke monumenten.",
    relevance:
      "Provinciale monumentenstatus legt extra beperkingen op bij verbouwing en kan aanvullende subsidies opleveren voor restauratie.",
    checklist: [
      "Staat het pand op de provinciale monumentenlijst?",
      "Ligt de locatie in een cultuurhistorisch waardevol gebied?",
      "Welke aanvullende eisen gelden bij verbouwing?",
      "Zijn er provinciale restauratiesubsidies beschikbaar?",
    ],
  },
  "energie-transitie": {
    explainer:
      "Regionale energiestrategie (RES), zoekgebieden voor wind en zon, warmtenetten en de transitie naar aardgasvrij. Beïnvloedt energievoorziening van nieuwbouwprojecten.",
    relevance:
      "Bepaalt welke energieoplossingen beschikbaar zijn voor het project en welke duurzaamheidseisen gelden.",
    checklist: [
      "Ligt de locatie in een warmtenetwerkgebied?",
      "Welke RES-doelstellingen gelden voor de regio?",
      "Is aansluiting op een collectief warmtesysteem verplicht?",
      "Welke energieprestatie-eisen gelden bovenop het Bbl?",
    ],
  },
  mobiliteit: {
    explainer:
      "Provinciaal mobiliteitsbeleid: OV-knooppunten, bereikbaarheid, parkeerbeleid en mobiliteitstransitie per regio.",
    relevance:
      "Bereikbaarheid en OV-nabijheid beïnvloeden de verkoopbaarheid en parkeernormen van het project.",
    checklist: [
      "Hoe is de OV-bereikbaarheid van de locatie?",
      "Gelden er afwijkende parkeernormen bij OV-knooppunten?",
      "Zijn er provinciale mobiliteitsprojecten gepland in het gebied?",
      "Welke fiets- en deelmobiliteitsvoorzieningen zijn beschikbaar?",
    ],
  },

  // ── Landelijk (6) ──
  "ladder-verstedelijking": {
    explainer:
      "De Ladder voor duurzame verstedelijking is een verplichte motivering bij bestemmingsplanwijzigingen voor nieuwe stedelijke ontwikkelingen buiten bestaand stedelijk gebied.",
    relevance:
      "Als het project buiten bestaand stedelijk gebied ligt, moet de Ladder-toets worden doorlopen — dit kan plannen vertragen of blokkeren.",
    checklist: [
      "Ligt het project binnen of buiten bestaand stedelijk gebied?",
      "Is er een regionale behoefte aan het programma?",
      "Kan de behoefte binnen bestaand stedelijk gebied worden opgelost?",
      "Is de locatiekeuze gemotiveerd in het bestemmingsplan?",
    ],
  },
  "nationale-woonagenda": {
    explainer:
      "Het Volkshuisvestingsprogramma en nationale woningbouwtargets: 900.000 woningen tot 2030, versnellingsafspraken met provincies en gemeenten, betaalbaarheidsnormen.",
    relevance:
      "Nationale targets creëren urgentie bij gemeenten om mee te werken aan woningbouwplannen — nuttig als drukmiddel in bestuurlijk overleg.",
    checklist: [
      "Hoe verhoudt het project zich tot de nationale bouwopgave?",
      "Past het programma binnen de betaalbaarheidsnormen (2/3 betaalbaar)?",
      "Kan het project profiteren van versnellingsregelingen?",
      "Zijn er nationale prestatieafspraken die het project ondersteunen?",
    ],
  },
  woningwet: {
    explainer:
      "De Woningwet regelt de sociale huursector: DAEB/niet-DAEB scheiding, markttoets bij corporatiebouw, en prestatieafspraken tussen gemeenten en corporaties.",
    relevance:
      "Bij projecten met sociale huurwoningen of corporatiebetrokkenheid bepaalt de Woningwet wat wel en niet mag.",
    checklist: [
      "Bevat het project sociale huurwoningen (DAEB)?",
      "Is een markttoets nodig voor niet-DAEB activiteiten?",
      "Zijn er prestatieafspraken met lokale corporaties?",
      "Past het project binnen de DAEB/niet-DAEB scheiding?",
    ],
  },
  "asbest-sloop": {
    explainer:
      "Regels voor asbestinventarisatie en -sanering bij renovatie, transformatie en sloop. Verplicht bij gebouwen van voor 1994.",
    relevance:
      "Asbestsanering kan aanzienlijke kosten en vertraging opleveren — vroegtijdig inventariseren is essentieel voor de business case.",
    checklist: [
      "Is het gebouw van voor 1994 (asbestverdacht)?",
      "Is er een asbestinventarisatie type A of B nodig?",
      "Wat zijn de geschatte saneringskosten?",
      "Is een sloopmelding vereist bij de gemeente?",
    ],
  },
  "beng-energieprestatie": {
    explainer:
      "BENG-eisen (Bijna Energieneutrale Gebouwen) gelden voor nieuwbouw: energiebehoefte, primair fossiel energiegebruik, en aandeel hernieuwbare energie.",
    relevance:
      "BENG-eisen beïnvloeden direct het ontwerp en de bouwkosten van nieuwbouwprojecten.",
    checklist: [
      "Welke BENG-indicatoren gelden voor het gebouwtype?",
      "Is het gebouw BENG-1, BENG-2 en BENG-3 haalbaar?",
      "Welke energielabel-eisen gelden bij verkoop of verhuur?",
      "Zijn er aanvullende gemeentelijke duurzaamheidseisen?",
    ],
  },
  "stikstof-nationaal": {
    explainer:
      "Nationaal stikstofbeleid: PAS-meldingen, AERIUS-berekening, bouwvrijstelling status en procedures voor vergunningverlening nabij Natura 2000-gebieden.",
    relevance:
      "Stikstofproblematiek is de belangrijkste externe blokkade voor bouwprojecten in Nederland — kennis van de actuele regelgeving is essentieel.",
    checklist: [
      "Is een AERIUS-berekening nodig voor de bouwfase?",
      "Is een AERIUS-berekening nodig voor de gebruiksfase?",
      "Geldt de bouwvrijstelling voor dit project?",
      "Is er een PAS-melding nodig of al ingediend?",
    ],
  },
};

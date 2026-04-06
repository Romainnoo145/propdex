import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  MapPin,
  Landmark,
  ExternalLink,
  X,
} from 'lucide-react'

/* ── Animation variants ────────────────────────────────────── */

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
}

/* ── Types ─────────────────────────────────────────────────── */

type DataStatus = 'live' | 'beschikbaar' | 'roadmap' | 'innovatie'

interface DataField {
  naam: string
  beschrijving: string
}

interface DataSource {
  naam: string
  /** Short card description */
  beschrijving: string
  /** Extended client-facing explanation for the modal */
  uitleg: string
  bron: string
  bronUrl?: string
  status: DataStatus
  velden: DataField[]
}

interface ViewTab {
  key: string
  label: string
  icon: typeof Building2
  bronnen: DataSource[]
}

/* ── Status config — green/amber palette only ──────────────── */

const STATUS: Record<DataStatus, { label: string; color: string }> = {
  live: { label: 'Live', color: '#22c55e' },
  beschikbaar: { label: 'Beschikbaar', color: '#f59e0b' },
  roadmap: { label: 'Roadmap', color: '#0E1111' },
  innovatie: { label: 'Innovatie', color: '#94a3b8' },
}

/* ══════════════════════════════════════════════════════════════
   CATALOG DATA
   ══════════════════════════════════════════════════════════════ */

const VIEWS: ViewTab[] = [
  {
    key: 'gemeente',
    label: 'Gemeente',
    icon: Landmark,
    bronnen: [
      // ── Live ──
      {
        naam: 'Vergunning-klimaat',
        beschrijving: 'Hoe soepel of streng is deze gemeente met vergunningen?',
        uitleg: 'We analyseren alle bekendmakingen (vergunningbesluiten) van een gemeente over het afgelopen jaar. Daaruit berekenen we het goedkeuringspercentage, het gemiddeld aantal dagen dat een vergunningaanvraag duurt, en hoeveel aanvragen er per maand binnenkomen. Dit geeft u in één oogopslag een beeld: is dit een gemeente waar vergunningen soepel verlopen, of moet u rekening houden met lange trajecten en meer afwijzingen?',
        bron: 'Officiële Bekendmakingen',
        bronUrl: 'https://www.officielebekendmakingen.nl',
        status: 'live',
        velden: [
          { naam: 'Klimaatlabel', beschrijving: 'Gunstig, Gemiddeld, Ongunstig of Zeer ongunstig' },
          { naam: 'Goedkeuringspercentage', beschrijving: 'Percentage verleende vergunningen' },
          { naam: 'Afwijzingspercentage', beschrijving: 'Percentage geweigerde vergunningen' },
          { naam: 'Gemiddelde doorlooptijd', beschrijving: 'Hoeveel dagen duurt een vergunningtraject gemiddeld' },
          { naam: 'Activiteit', beschrijving: 'Aantal bekendmakingen afgelopen 30, 90 en 365 dagen' },
          { naam: 'Verdeling per type', beschrijving: 'Welke soorten vergunningen worden het meest aangevraagd' },
          { naam: 'Datadekking', beschrijving: 'Hoeveel bekendmakingen zijn geanalyseerd (betrouwbaarheid)' },
        ],
      },
      {
        naam: 'Jurisprudentie & AI-analyse',
        beschrijving: 'Wat zeggen rechters over vergunningszaken in deze gemeente?',
        uitleg: 'We doorzoeken alle gepubliceerde rechtszaken op Rechtspraak.nl die betrekking hebben op omgevingsrecht in deze gemeente. Per zaak analyseren we met AI (Claude) de uitkomst, de bezwaargrond en de relevantie voor vastgoedontwikkeling. U krijgt een "juridisch klimaat"-score die aangeeft hoe vaak bezwaren slagen, hoe lang procedures duren, en hoe groot uw kans op een succesvolle vergunning is op basis van precedenten.',
        bron: 'Rechtspraak.nl + Claude AI',
        bronUrl: 'https://www.rechtspraak.nl',
        status: 'live',
        velden: [
          { naam: 'Uitspraken', beschrijving: 'Lijst van relevante rechtszaken met datum en uitkomst' },
          { naam: 'Win/verlies', beschrijving: 'Verhouding toegewezen vs afgewezen bezwaren' },
          { naam: 'Doorlooptijd per type', beschrijving: 'Hoe lang duren procedures per vergunningstype' },
          { naam: 'AI klimaatanalyse', beschrijving: 'Per zaak: bezwaargrond, uitkomst, relevantie (door AI beoordeeld)' },
          { naam: 'Succeskans', beschrijving: 'Geschatte kans dat uw vergunningaanvraag slaagt' },
        ],
      },
      {
        naam: 'Raadsinformatie',
        beschrijving: 'Wat bespreekt de gemeenteraad over bouw en ontwikkeling?',
        uitleg: 'Via Open Raadsinformatie (ORI) doorzoeken we vergaderstukken van de gemeenteraad op termen als "omgevingsvergunning", "bestemmingsplan", "woningbouw" en "transformatie". U ziet welke moties, raadsbrieven en besluiten er recent zijn genomen die invloed kunnen hebben op uw project. Niet elke gemeente is aangesloten bij ORI — als dat zo is, melden we dat.',
        bron: 'Open Raadsinformatie',
        bronUrl: 'https://www.openraadsinformatie.nl',
        status: 'live',
        velden: [
          { naam: 'Dekking', beschrijving: 'Is deze gemeente aangesloten bij ORI?' },
          { naam: 'Raadsstukken', beschrijving: 'Titel, datum, type (motie/raadsbrief), samenvatting en link' },
        ],
      },
      {
        naam: 'Huisvestingsverordening',
        beschrijving: 'Zijn er regels voor woningsplitsing en kamerverhuur?',
        uitleg: 'Veel gemeenten hebben een huisvestingsverordening die extra regels oplegt voor het splitsen van woningen, omzetting naar kamerverhuur, of onttrekking aan de woningvoorraad. We controleren via de Officiële Bekendmakingen of deze gemeente zo\'n verordening heeft, en linken direct naar het document zodat u de exacte voorwaarden kunt lezen.',
        bron: 'Officiële Bekendmakingen',
        bronUrl: 'https://www.officielebekendmakingen.nl',
        status: 'live',
        velden: [
          { naam: 'Heeft verordening', beschrijving: 'Ja of nee' },
          { naam: 'Titel en link', beschrijving: 'Naam van de verordening met link naar het document' },
        ],
      },
      {
        naam: 'Beschermd erfgoed',
        beschrijving: 'Zijn er beschermde stads- of dorpsgezichten?',
        uitleg: 'Beschermde gezichten zijn gebieden waar extra regels gelden voor verbouwing, sloop en nieuwbouw. We halen deze informatie op bij de Rijksdienst voor het Cultureel Erfgoed (RCE). Als uw project in zo\'n gebied valt, moet u rekening houden met strengere welstandseisen en langere vergunningstrajecten.',
        bron: 'RCE',
        bronUrl: 'https://www.cultureelerfgoed.nl',
        status: 'live',
        velden: [
          { naam: 'Beschermde gezichten', beschrijving: 'Naam, type (stads-/dorpsgezicht), aanwijzingsjaar, oppervlakte' },
        ],
      },
      {
        naam: 'Subsidies (landelijk)',
        beschrijving: 'Welke landelijke subsidies zijn er voor bouw en verduurzaming?',
        uitleg: 'We tonen landelijke subsidies van de Rijksdienst voor Ondernemend Nederland (RVO) die relevant zijn voor vastgoedontwikkeling — denk aan verduurzamingssubsidies, stimuleringsregelingen voor woningbouw, en innovatiesubsidies. Dit zijn nationale regelingen, geen gemeente-specifieke subsidies.',
        bron: 'RVO',
        bronUrl: 'https://www.rvo.nl',
        status: 'live',
        velden: [
          { naam: 'Regelingen', beschrijving: 'Titel, beschrijving, link, sectoren en doelgroepen' },
        ],
      },
      {
        naam: 'Bekendmakingen monitoring',
        beschrijving: 'Automatisch bijgehouden vergunningaanvragen, gekoppeld aan uw percelen.',
        uitleg: 'We monitoren dagelijks de Officiële Bekendmakingen voor alle gemeenten die u volgt. Nieuwe vergunningaanvragen en -besluiten worden automatisch opgehaald, het adres wordt via PDOK geocoding op de kaart geplaatst, en als het adres overeenkomt met een van uw opgeslagen percelen wordt de melding direct gekoppeld. U ziet precies wat er in uw buurt gebeurt zonder zelf te hoeven zoeken.',
        bron: 'KOOP SRU + PDOK',
        bronUrl: 'https://www.officielebekendmakingen.nl',
        status: 'live',
        velden: [
          { naam: 'Meldingen', beschrijving: 'Chronologische feed met titel, datum, categorie en adres' },
          { naam: 'Perceelkoppeling', beschrijving: 'Automatische match via geocoding en spatial lookup' },
          { naam: 'Gelezen/ongelezen', beschrijving: 'Per melding bijgehouden of u het al bekeken heeft' },
        ],
      },
      {
        naam: 'Vergunning-checklists',
        beschrijving: 'Wat heb ik nodig om een vergunning aan te vragen?',
        uitleg: 'Per ontwikkelstrategie (optoppen, splitsen, transformatie, nieuwbouw) krijgt u een complete checklist met alle benodigde documenten, onderzoeken en vergunningen — inclusief geschatte kosten. Dit is het 8e tabblad in de rapportweergave (/rapport). Per strategie ziet u alle voorbereidingsstappen met kostenindicatie en een label "verplicht" of "aanbevolen", zodat u precies weet wat u moet regelen en wat het gaat kosten.',
        bron: 'Propdex kennisbank',
        status: 'live',
        velden: [
          { naam: 'Checklist-items', beschrijving: 'Categorie, titel, beschrijving, verplicht/optioneel, geschatte kosten' },
        ],
      },
      {
        naam: 'Verkenner AI Chat',
        beschrijving: 'Stel vragen in gewoon Nederlands en krijg direct antwoord.',
        uitleg: 'De Verkenner bevat een AI-chatinterface waarmee u in gewoon Nederlands vragen kunt stellen over uw percelen, gemeenten en wijken. De chat classificeert uw vraag automatisch naar het juiste type (zoeken, perceeldetails, favorieten, rapportlijst) en voert de bijbehorende actie uit. U kunt percelen zoeken, details opvragen, favorieten beheren en rapporten raadplegen — allemaal via een gesprek. De resultaten worden direct in de chatinterface getoond met klikbare links naar de betreffende percelen of rapporten.',
        bron: 'Propdex + Claude AI',
        status: 'live',
        velden: [
          { naam: 'Intent-classificatie', beschrijving: 'Automatische herkenning van uw vraagtype (zoeken, details, favorieten, etc.)' },
          { naam: 'Zoekresultaten', beschrijving: 'Percelen zoeken op adres, postcode of plaats met directe links' },
          { naam: 'Perceeldetails', beschrijving: 'Score, bestemming, oppervlakte en andere kerndata per perceel' },
          { naam: 'Favorieten', beschrijving: 'Uw opgeslagen percelen bekijken en beheren via chat' },
          { naam: 'Rapportlijst', beschrijving: 'Overzicht van gegenereerde rapporten met directe links' },
        ],
      },
      // ── Roadmap ──
      {
        naam: 'Gemeentelijke subsidies',
        beschrijving: 'Welke subsidies biedt deze specifieke gemeente?',
        uitleg: 'Anders dan de landelijke RVO-subsidies zijn gemeentelijke subsidies per gemeente verschillend en er bestaat geen centrale API. We onderzoeken de mogelijkheid om via de KOOP/SRU route (dezelfde bron als de huisvestingsverordening) ook subsidieregelingen op te halen. Alternatief is de betaalde Vindsubsidies.nl API. Dit is nog in onderzoek.',
        bron: 'Vindsubsidies / KOOP SRU',
        status: 'roadmap',
        velden: [
          { naam: 'Subsidies per gemeente', beschrijving: 'Gemeente-specifieke regelingen met voorwaarden en bedragen' },
        ],
      },
      {
        naam: 'Welstandsnota',
        beschrijving: 'Hoe streng is het welstandsbeleid?',
        uitleg: 'De welstandsnota bepaalt hoe een gebouw eruit mag zien — materiaalgebruik, kleurschema, dakvormen. Dit is cruciaal bij verbouw en nieuwbouw maar elke gemeente publiceert het als PDF zonder standaard-API. We onderzoeken of AI-parsing van deze PDF\'s haalbaar is om automatisch de belangrijkste eisen per gebied samen te vatten.',
        bron: 'Gemeente websites + AI',
        status: 'roadmap',
        velden: [
          { naam: 'Welstandseisen', beschrijving: 'Samenvatting per gebied: materiaal, kleur, bouwhoogte, daktype' },
        ],
      },
      {
        naam: 'Grondprijsbeleid',
        beschrijving: 'Wat vraagt de gemeente voor gemeentegrond?',
        uitleg: 'Gemeenten publiceren jaarlijks een grondprijzenbrief met richtprijzen per bestemming (wonen, bedrijf, maatschappelijk). Dit is alleen beschikbaar als PDF. Net als bij de welstandsnota onderzoeken we AI-parsing om de belangrijkste prijzen automatisch te extraheren.',
        bron: 'Gemeente websites + AI',
        status: 'roadmap',
        velden: [
          { naam: 'Grondprijzen', beschrijving: 'Richtprijzen per bestemming en locatieklasse' },
        ],
      },
      {
        naam: 'Nieuws & beleidsmonitoring',
        beschrijving: 'Blijf op de hoogte van relevante ontwikkelingen.',
        uitleg: 'Een "nieuwsradar" die automatisch relevante beleidswijzigingen signaleert — denk aan wijzigingen in stikstofbeleid, energiebeleid, woonvisies of coalitieakkoorden. Concurrenten zoals OPENRED bieden dit al met CRM-functionaliteit. Mogelijke bronnen: Overheid.nl, gemeentelijke nieuwsfeeds, Tweede Kamer documenten.',
        bron: 'Overheid.nl + nieuwsbronnen',
        status: 'roadmap',
        velden: [
          { naam: 'Nieuwsfeed', beschrijving: 'Beleidswijzigingen, raadsbesluiten, coalitieakkoorden' },
        ],
      },
      {
        naam: 'Omgevingsvisie',
        beschrijving: 'Wat is de langetermijnvisie van de gemeente op de leefomgeving?',
        uitleg: 'Sinds de Omgevingswet (2024) is elke gemeente verplicht een omgevingsvisie op te stellen. Dit strategisch document beschrijft de gewenste ontwikkelrichting per gebied — waar mag gebouwd worden, waar komt groen, welke functies zijn gewenst. Voor vastgoedontwikkelaars is dit cruciaal: een project dat past binnen de omgevingsvisie heeft een grotere kans op medewerking van de gemeente. De visie is openbaar maar wordt als PDF gepubliceerd zonder standaard-API.',
        bron: 'Gemeente websites + AI',
        status: 'roadmap',
        velden: [
          { naam: 'Ontwikkelgebieden', beschrijving: 'Waar wil de gemeente groeien en welke functies zijn gewenst' },
          { naam: 'Ambities', beschrijving: 'Speerpunten: verdichting, duurzaamheid, leefbaarheid, mobiliteit' },
        ],
      },
      {
        naam: 'Woonvisie',
        beschrijving: 'Hoeveel en welke woningen wil de gemeente erbij bouwen?',
        uitleg: 'De woonvisie beschrijft het woningbouwprogramma: hoeveel woningen tot welk jaar, welke segmenten (sociaal, midden, vrij), voor welke doelgroepen (starters, senioren, gezinnen). Als uw project aansluit bij de woonvisie — bijvoorbeeld betaalbare huurwoningen in een gemeente die daar tekort aan heeft — vergroot dat de kans op medewerking en mogelijke subsidies. De woonvisie is openbaar als PDF maar verschilt sterk per gemeente.',
        bron: 'Gemeente websites + AI',
        status: 'roadmap',
        velden: [
          { naam: 'Woningbouwprogramma', beschrijving: 'Aantallen per segment: sociaal, midden, vrije sector' },
          { naam: 'Doelgroepen', beschrijving: 'Starters, senioren, gezinnen, arbeidsmigranten' },
          { naam: 'Prioriteitsgebieden', beschrijving: 'Wijken of gebieden waar de gemeente actief wil bouwen' },
        ],
      },
      {
        naam: 'Parkeerbeleid',
        beschrijving: 'Hoeveel parkeerplaatsen moet u realiseren bij nieuwbouw?',
        uitleg: 'Parkeernormen bepalen hoeveel parkeerplaatsen u moet realiseren per woning of per m² kantoor/winkel. Dit kan een project maken of breken: in stedelijke gebieden zijn parkeernormen vaak 0,3–0,6 per woning (en soms 0 bij OV-knooppunten), in landelijke gebieden 1,5–2,0. De normen zijn gebaseerd op CROW-publicatie 381 maar worden per gemeente vastgesteld. Hoge parkeernormen verhogen bouwkosten significant (€15.000–40.000 per plek ondergronds).',
        bron: 'Gemeente websites + CROW',
        status: 'roadmap',
        velden: [
          { naam: 'Parkeernormen', beschrijving: 'Norm per woningtype en per stedelijkheidszone' },
          { naam: 'Uitzonderingen', beschrijving: 'Vrijstellingen bij OV-knooppunten, autoluwe zones, deelmobiliteit' },
        ],
      },
      {
        naam: 'Duurzaamheidsbeleid',
        beschrijving: 'Welke extra duurzaamheidseisen stelt de gemeente?',
        uitleg: 'Bovenop de landelijke eisen uit het Bouwbesluit stellen veel gemeenten aanvullende duurzaamheidseisen — denk aan gasloos bouwen, minimale BENG-scores, groene daken, klimaatadaptatie (waterberging), en circulair bouwen. Deze eisen variëren sterk per gemeente en kunnen significant impact hebben op bouwkosten en ontwerp. We onderzoeken of deze eisen gestructureerd uit gemeentelijke beleidsdocumenten geëxtraheerd kunnen worden.',
        bron: 'Gemeente websites + AI',
        status: 'roadmap',
        velden: [
          { naam: 'Energienormen', beschrijving: 'Gasloos, BENG-eisen, EPC-normen boven bouwbesluit' },
          { naam: 'Klimaatadaptatie', beschrijving: 'Waterberging, groene daken, hittestress-maatregelen' },
          { naam: 'Circulair bouwen', beschrijving: 'MPG-eisen, hergebruik materialen, sloopprotocol' },
        ],
      },
      {
        naam: 'Leegstandsverordening',
        beschrijving: 'Zijn er regels voor leegstaande panden — en kansen voor transformatie?',
        uitleg: 'Gemeenten met een leegstandsverordening kunnen eigenaren verplichten leegstand te melden en actie te ondernemen. Voor vastgoedontwikkelaars is dit interessant: leegstaande kantoren en winkels zijn potentiële transformatielocaties, en gemeenten met een actief leegstandsbeleid zijn vaak ontvankelijker voor transformatie-initiatieven. De verordening is via de Officiële Bekendmakingen te vinden, vergelijkbaar met de huisvestingsverordening.',
        bron: 'Officiële Bekendmakingen',
        status: 'roadmap',
        velden: [
          { naam: 'Heeft verordening', beschrijving: 'Ja of nee — en sinds wanneer' },
          { naam: 'Meldplicht', beschrijving: 'Na hoeveel maanden leegstand moet de eigenaar melden' },
          { naam: 'Leegstandstax', beschrijving: 'Boete of heffing bij langdurige leegstand' },
        ],
      },
      {
        naam: 'Erfgoedverordening',
        beschrijving: 'Zijn er lokale monumenten naast de rijksmonumenten?',
        uitleg: 'Naast rijksmonumenten (die we al tonen via RCE) kunnen gemeenten eigen lokale monumenten aanwijzen via een erfgoedverordening. Deze gemeentelijke monumenten hebben vergelijkbare beperkingen voor verbouw en sloop, maar vallen onder een ander vergunningregime. Het is belangrijk om dit te weten vóór aankoop: een gemeentelijk monument kan net zo beperkend zijn als een rijksmonument, maar is minder zichtbaar in de standaard registers.',
        bron: 'Gemeente websites + Erfgoedregister',
        status: 'roadmap',
        velden: [
          { naam: 'Heeft verordening', beschrijving: 'Ja of nee' },
          { naam: 'Gemeentelijke monumenten', beschrijving: 'Aantal en lijst van lokaal beschermde panden' },
          { naam: 'Beschermingsregime', beschrijving: 'Welke regels gelden voor verbouw en onderhoud' },
        ],
      },
      // ── Innovatie ──
      {
        naam: 'Sociaal draagvlak monitor',
        beschrijving: 'Hoe staat de buurt tegenover bouwprojecten?',
        uitleg: 'Geen enkele concurrent biedt dit. Het idee is om bezwaarhistorie, participatieprocessen en mogelijk sentiment uit openbare bronnen te analyseren. Dit geeft inzicht in politieke en sociale risico\'s voordat u investeert. De haalbaarheid hangt af van beschikbare databronnen.',
        bron: 'Gemeentedata + eigen analyse',
        status: 'innovatie',
        velden: [
          { naam: 'Draagvlakindicatoren', beschrijving: 'Bezwaarhistorie, participatieprocessen, buurtsentiment' },
        ],
      },
    ],
  },
  {
    key: 'wijk',
    label: 'Wijk',
    icon: MapPin,
    bronnen: [
      // ── Live ──
      {
        naam: 'Demografie',
        beschrijving: 'Wie woont hier? Gezinnen, alleenstaanden, ouderen?',
        uitleg: 'Via het CBS halen we per wijk het aantal inwoners, de verdeling koop/huur, huishoudenssamenstelling (eenpersoons, gezinnen) en leeftijdsopbouw op. Dit vertelt u direct welk type woning hier kansrijk is: een wijk met veel 65-plussers heeft behoefte aan doorstroomwoningen, een wijk met jonge werkenden aan huurappartementen.',
        bron: 'CBS',
        bronUrl: 'https://www.cbs.nl',
        status: 'live',
        velden: [
          { naam: 'Inwoners', beschrijving: 'Totaal aantal inwoners in de wijk' },
          { naam: 'Koopwoningen %', beschrijving: 'Aandeel koop vs huur — indicatie van markttype' },
          { naam: 'Huishoudens', beschrijving: 'Eenpersoons, zonder kinderen, met kinderen, gemiddelde grootte' },
          { naam: 'Leeftijdsverdeling', beschrijving: 'Vijf leeftijdsgroepen: 0–14, 15–24, 25–44, 45–64, 65+' },
        ],
      },
      {
        naam: 'Inkomen',
        beschrijving: 'Wat is de koopkracht in deze wijk?',
        uitleg: 'Het CBS publiceert inkomensgegevens per wijk. We tonen het gestandaardiseerde inkomen (gecorrigeerd voor huishoudensgrootte), en de verdeling: hoeveel procent zit in de laagste 40% vs hoogste 20%? Hoog inkomen = meer koopkracht = ruimte voor duurdere woningen.',
        bron: 'CBS',
        bronUrl: 'https://www.cbs.nl',
        status: 'live',
        velden: [
          { naam: 'Gestandaardiseerd inkomen', beschrijving: 'Gemiddeld inkomen gecorrigeerd voor huishoudensgrootte' },
          { naam: 'Inkomensverdeling', beschrijving: 'Percentage in laagste 40% en hoogste 20%' },
        ],
      },
      {
        naam: 'WOZ-waarde',
        beschrijving: 'Wat zijn woningen hier waard?',
        uitleg: 'De gemiddelde WOZ-waarde per wijk geeft een indicatie van het prijsniveau. Vergelijk dit met uw aankoopprijs om rendementspotentieel te beoordelen. Hoge WOZ = duur gebied maar ook hogere verkoopprijzen na ontwikkeling.',
        bron: 'CBS',
        bronUrl: 'https://www.cbs.nl',
        status: 'live',
        velden: [
          { naam: 'Gemiddelde WOZ', beschrijving: 'Gemiddelde WOZ-waarde in de wijk (€)' },
        ],
      },
      {
        naam: 'Stedelijkheid',
        beschrijving: 'Hoe stedelijk of landelijk is dit gebied?',
        uitleg: 'Het CBS classificeert wijken in vijf stedelijkheidsklassen op basis van adressendichtheid. Zeer stedelijk = meer concurrentie maar ook meer vraag. Landelijk = meer ruimte, lagere grondprijzen. Dit helpt bij het kiezen van de juiste ontwikkelstrategie.',
        bron: 'CBS',
        bronUrl: 'https://www.cbs.nl',
        status: 'live',
        velden: [
          { naam: 'Stedelijkheidsklasse', beschrijving: '1 (zeer sterk) t/m 5 (niet stedelijk) met label' },
          { naam: 'Adressendichtheid', beschrijving: 'Aantal adressen per km²' },
        ],
      },
      {
        naam: 'Criminaliteit',
        beschrijving: 'Hoe veilig is deze wijk?',
        uitleg: 'Misdrijfcijfers per wijk uit het CBS — totaal en per categorie (vermogensdelicten, vernieling, geweld). Lage criminaliteit maakt een wijk aantrekkelijker voor kopers en huurders. Dit is ook relevant voor financieringsaanvragen bij banken.',
        bron: 'CBS',
        bronUrl: 'https://www.cbs.nl',
        status: 'live',
        velden: [
          { naam: 'Totaal misdrijven', beschrijving: 'Geregistreerde misdrijven en per 1.000 inwoners' },
          { naam: 'Categorieën', beschrijving: 'Vermogensdelicten, vernieling, geweldsdelicten' },
        ],
      },
      {
        naam: 'Voorzieningen',
        beschrijving: 'Hoe ver is het naar de supermarkt, school, huisarts?',
        uitleg: 'Het CBS berekent de gemiddelde afstand vanuit een wijk naar zes soorten voorzieningen. Goede bereikbaarheid van voorzieningen verhoogt de marktwaarde van woningen en maakt een locatie aantrekkelijker voor kopers.',
        bron: 'CBS',
        bronUrl: 'https://www.cbs.nl',
        status: 'live',
        velden: [
          { naam: 'Afstanden', beschrijving: 'Supermarkt, huisarts, basisschool, kinderopvang, treinstation, OV-knooppunt (km)' },
        ],
      },
      {
        naam: 'Bouwjaar distributie',
        beschrijving: 'Uit welke periode stammen de woningen?',
        uitleg: 'De verdeling van woningen naar bouwjaarklasse vertelt veel over de wijk: veel pre-1970 woningen = potentieel funderingsproblemen maar ook optopmogelijkheden. Veel nieuwbouw = weinig transformatiekansen maar wel een actieve markt.',
        bron: 'CBS',
        bronUrl: 'https://www.cbs.nl',
        status: 'live',
        velden: [
          { naam: 'Bouwjaarklassen', beschrijving: 'Verdeling woningen per bouwperiode' },
        ],
      },
      // ── Beschikbaar ──
      {
        naam: 'Funda marktdata',
        beschrijving: 'Hoe lang staan woningen te koop en hoe vaak zakken prijzen?',
        uitleg: 'We verzamelen dagelijks snapshots van Funda-aanbod. Daaruit berekenen we de gemiddelde looptijd (hoe lang staat een woning te koop?) en het aantal prijsmutaties (hoe vaak wordt de vraagprijs verlaagd?). In het wijkpaneel ziet u een samenvattingskaart met de gemiddelde looptijd en prijsmutaties via het funda-summary endpoint. Let op: de data is alleen beschikbaar voor wijken waar de funda-enrichment is uitgevoerd.',
        bron: 'Funda',
        bronUrl: 'https://www.funda.nl',
        status: 'live',
        velden: [
          { naam: 'Looptijd', beschrijving: 'Gemiddeld aantal dagen dat een woning te koop staat' },
          { naam: 'Prijsmutaties', beschrijving: 'Aantal keer dat de vraagprijs is gewijzigd' },
        ],
      },
      // ── Roadmap ──
      {
        naam: 'VON-prijs voorspelling',
        beschrijving: 'Wat brengt een woning hier op als je het verkoopt?',
        uitleg: 'Op basis van historische transactiedata (Kadaster/NVM) een model bouwen dat de verwachte vrij-op-naam prijs per woningtype voorspelt. OPENRED biedt dit al — het helpt om de financiële haalbaarheid van een project te bepalen voordat u koopt. Implementatie: backend API-integratie met Kadaster/NVM + predictive model, nieuwe kaartcomponent in WijkDetailView + tile in WijkMapPanel. Automatisch berekend — geen handmatige configuratie nodig.',
        bron: 'Kadaster / NVM (betaald)',
        status: 'roadmap',
        velden: [
          { naam: 'VON-prijs', beschrijving: 'Verwachte verkoopprijs per woningtype en oppervlakte' },
          { naam: 'Prijsontwikkeling', beschrijving: 'Trend over afgelopen jaren (stijgend/dalend/stabiel)' },
        ],
      },
      {
        naam: 'Latente marktvraag',
        beschrijving: 'Is er vraag naar nieuwe woningen in dit gebied?',
        uitleg: 'Door CBS-demografie, migratiedata en woningvoorraad te combineren kunnen we berekenen hoeveel woningen er per type (gezinswoning, appartement, seniorenwoning) tekort zijn. Dat voorspelt of uw project goed verkoopbaar is. Implementatie: backend berekening op basis van bestaande CBS data + woningvoorraadcijfers, nieuwe kaartcomponent in WijkDetailView. Automatisch berekend — geen handmatige configuratie nodig.',
        bron: 'CBS + Kadaster',
        status: 'roadmap',
        velden: [
          { naam: 'Vraagmodel', beschrijving: 'Woningbehoefte per type op basis van demografie en migratie' },
          { naam: 'Tekort per segment', beschrijving: 'Aantal woningen tekort: sociaal, midden, vrije sector' },
        ],
      },
      {
        naam: 'Leefbaarheidsindex',
        beschrijving: 'Hoe prettig is het om hier te wonen?',
        uitleg: 'Een integrale score die criminaliteit, luchtkwaliteit, geluidsoverlast, groen en sociale cohesie combineert. De Atlas Leefomgeving biedt hiervoor openbare data. Een hoge leefbaarheidsscore = hogere verkoopprijzen. Implementatie: gewogen berekening over bestaande CBS-velden (criminaliteit, voorzieningen) + Atlas Leefomgeving API, getoond als score-kaart in WijkDetailView. Automatisch berekend — geen handmatige configuratie nodig.',
        bron: 'Atlas Leefomgeving + CBS',
        status: 'roadmap',
        velden: [
          { naam: 'Leefbaarheid', beschrijving: 'Gewogen score over veiligheid, milieu en voorzieningen' },
          { naam: 'Deelscores', beschrijving: 'Score per categorie: veiligheid, voorzieningen, groen, milieu' },
        ],
      },
      {
        naam: 'Transactiecijfers',
        beschrijving: 'Hoeveel woningen worden hier verkocht en tegen welke prijs?',
        uitleg: 'NVM en Kadaster bieden transactiedata (verkoopprijzen, aantallen, verkooptijden) maar dit zijn betaalde API\'s. Met deze data kunt u de marktdynamiek per wijk analyseren: stijgende of dalende prijzen, verkoopsnelheid, prijsverschillen per woningtype. Implementatie: backend API-integratie met NVM/Kadaster, nieuwe kaartcomponent in WijkDetailView + tile in WijkMapPanel. Automatisch opgehaald — geen handmatige configuratie nodig.',
        bron: 'NVM / Kadaster (betaald)',
        status: 'roadmap',
        velden: [
          { naam: 'Transacties', beschrijving: 'Verkoopprijzen, aantallen, verkooptijden per wijk' },
          { naam: 'Marktdynamiek', beschrijving: 'Stijgend/dalend/stabiel met percentage per kwartaal' },
        ],
      },
      {
        naam: 'Leegstandsmonitor',
        beschrijving: 'Hoeveel panden staan hier leeg?',
        uitleg: 'Leegstand is een sterke indicator voor transformatiekansen — leegstaande kantoren of winkels zijn potentiële woningbouwlocaties. Er is geen landelijke API; sommige gemeenten publiceren eigen leegstandsmonitoren. Implementatie: BAG-statusveld analyse (panden met status "niet in gebruik") + eventueel gemeentelijke open data. Automatisch berekend — geen handmatige configuratie nodig.',
        bron: 'BAG / Gemeente',
        status: 'roadmap',
        velden: [
          { naam: 'Leegstand', beschrijving: 'Vacaturecijfers per type vastgoed' },
          { naam: 'Transformatiekansen', beschrijving: 'Leegstaande kantoren/winkels met oppervlakte en bestemming' },
        ],
      },
      // ── Innovatie ──
      {
        naam: 'Klimaatadaptatie',
        beschrijving: 'Hoe kwetsbaar is dit gebied voor hitte en wateroverlast?',
        uitleg: 'Hittestress, waterbergingsopgave en overstromingsrisico worden steeds relevanter voor vastgoedontwikkeling. De Klimaateffectatlas biedt deze data openbaar. Geen concurrent integreert dit structureel, maar het wordt steeds vaker gevraagd bij vergunningaanvragen en ESG-rapportages. Implementatie: Klimaateffectatlas API-integratie, kaartcomponent in WijkDetailView. Automatisch — geen configuratie.',
        bron: 'Klimaateffectatlas',
        bronUrl: 'https://www.klimaateffectatlas.nl',
        status: 'innovatie',
        velden: [
          { naam: 'Klimaatrisico\'s', beschrijving: 'Hittestress, wateroverlast, droogte per locatie' },
        ],
      },
      {
        naam: 'Bereikbaarheid & netcapaciteit',
        beschrijving: 'Is er genoeg stroom en OV voor een nieuw project?',
        uitleg: 'Netcongestie (vol elektriciteitsnet) blokkeert steeds vaker nieuwbouwprojecten. Door data van netbeheerders (Liander, Enexis) te combineren met OV-bereikbaarheid krijgt u inzicht in de infrastructurele haalbaarheid. Geen concurrent biedt dit. Implementatie: Liander/Enexis capaciteitskaart API + CROW OV-data, kaartcomponent in WijkDetailView. Automatisch — geen configuratie.',
        bron: 'CROW + Liander/Enexis',
        status: 'innovatie',
        velden: [
          { naam: 'Infrastructuur', beschrijving: 'OV-score, netcapaciteit, wachtlijst netaansluiting' },
        ],
      },
      {
        naam: 'Verkeers- & parkeerdruk',
        beschrijving: 'Is er ruimte voor extra auto\'s en verkeer?',
        uitleg: 'Extra woningen = extra auto\'s en verkeer. Door CROW-normen en CBS autobezitdata te combineren berekenen we de parkeerdruk per wijk. Dit is relevant voor parkeernormen bij vergunningaanvragen. Implementatie: berekening op CBS autobezit + CROW-normen, kaartcomponent in WijkDetailView. Automatisch — geen configuratie.',
        bron: 'CROW + CBS',
        status: 'innovatie',
        velden: [
          { naam: 'Parkeerdruk', beschrijving: 'Huidige bezetting en impact van extra woningen' },
        ],
      },
    ],
  },
  {
    key: 'perceel',
    label: 'Perceel',
    icon: Building2,
    bronnen: [
      // ── Live ──
      {
        naam: 'BAG Basisgegevens',
        beschrijving: 'Adres, oppervlakte, bouwjaar en type gebruik van het gebouw.',
        uitleg: 'De Basisregistratie Adressen en Gebouwen (BAG) is dé officiële bron voor gebouwinformatie in Nederland. We halen hier het adres, de gebruiksoppervlakte, het bouwjaar, het gebruiksdoel (wonen, kantoor, winkel) en de pandstatus op. Dit is het fundament onder alle andere analyses.',
        bron: 'Kadaster BAG',
        bronUrl: 'https://www.kadaster.nl',
        status: 'live',
        velden: [
          { naam: 'Adres', beschrijving: 'Straat, huisnummer, postcode, woonplaats' },
          { naam: 'Gebruiksdoel', beschrijving: 'Woon-, kantoor-, winkel-, industriefunctie etc.' },
          { naam: 'Oppervlakte & bouwjaar', beschrijving: 'Gebruiksoppervlakte (m²) en oorspronkelijk bouwjaar' },
        ],
      },
      {
        naam: 'Bestemmingsplan',
        beschrijving: 'Wat mag er gebouwd worden op dit perceel?',
        uitleg: 'Via de DSO API (Digitaal Stelsel Omgevingswet) halen we het geldende bestemmingsplan op: welke functies zijn toegestaan (wonen, bedrijf, gemengd), wat is de maximale bouwhoogte, hoeveel lagen mag u bouwen, en waar mag het bouwvlak liggen. Als de API geen data levert, parseert onze AI (Claude) automatisch de bestemmingsplan-PDF. Dit is cruciaal voor elke haalbaarheidscheck.',
        bron: 'DSO + Claude AI',
        bronUrl: 'https://developer.overheid.nl',
        status: 'live',
        velden: [
          { naam: 'Bestemming', beschrijving: 'Wonen, Bedrijf, Gemengd, Agrarisch etc.' },
          { naam: 'Bouwhoogte & lagen', beschrijving: 'Maximum bouwhoogte en aantal bouwlagen' },
          { naam: 'Bouwvlak & functies', beschrijving: 'Waar mag gebouwd worden en welke functies zijn toegestaan' },
        ],
      },
      {
        naam: 'Kadaster Eigendom',
        beschrijving: 'Van wie is dit perceel, en wat is er betaald?',
        uitleg: 'Via de Kadaster BRK API zien we wie de eigenaar is (particulier of rechtspersoon), wanneer het voor het laatst is overgedragen, voor welk bedrag, en of er een hypotheek op rust. Dit helpt bij het inschatten of de eigenaar bereid is te verkopen en wat een realistisch bod zou zijn.',
        bron: 'Kadaster BRK',
        bronUrl: 'https://www.kadaster.nl',
        status: 'live',
        velden: [
          { naam: 'Eigenaar', beschrijving: 'Naam en type (particulier of bedrijf)' },
          { naam: 'Laatste transactie', beschrijving: 'Aankoopprijs en datum' },
          { naam: 'Hypotheek', beschrijving: 'Bedrag en verstrekker' },
        ],
      },
      {
        naam: 'WOZ-waarde',
        beschrijving: 'Wat vindt de gemeente dat dit pand waard is?',
        uitleg: 'De WOZ-waarde is de officiële taxatie door de gemeente, gebruikt voor belastingheffing. Het geeft een onafhankelijke indicatie van de waarde. Vergelijk het met de aankoopprijs en de verwachte verkoopwaarde na ontwikkeling.',
        bron: 'WOZ Waardeloket',
        bronUrl: 'https://www.wozwaardeloket.nl',
        status: 'live',
        velden: [
          { naam: 'WOZ-waarde', beschrijving: 'Meest recente taxatie met peildatum' },
        ],
      },
      {
        naam: 'Energielabel',
        beschrijving: 'Hoe energiezuinig is het gebouw?',
        uitleg: 'Het energielabel (A++++ t/m G) geeft aan hoe energiezuinig een gebouw is. Een slecht label (D–G) kan een kans zijn: na verduurzaming stijgt de waarde significant. Bij verhuur bepaalt het label mede de maximale huur via het Woningwaarderingstelsel.',
        bron: 'EP-Online (RVO)',
        bronUrl: 'https://www.ep-online.nl',
        status: 'live',
        velden: [
          { naam: 'Label', beschrijving: 'Energielabel A++++ t/m G met registratiedatum' },
        ],
      },
      {
        naam: 'Monument / Erfgoed',
        beschrijving: 'Is dit een monument of ligt het in een beschermd gezicht?',
        uitleg: 'We controleren bij de Rijksdienst voor het Cultureel Erfgoed of het pand een rijksmonument is, en of het in een beschermd stads- of dorpsgezicht ligt. Monumentstatus beperkt wat u mag verbouwen, maar biedt ook subsidiekansen (BRIM, provinciale restauratiefondsen).',
        bron: 'RCE',
        bronUrl: 'https://www.cultureelerfgoed.nl',
        status: 'live',
        velden: [
          { naam: 'Monumentstatus', beschrijving: 'Rijksmonument ja/nee, met nummer en beschrijving' },
          { naam: 'Beschermd gezicht', beschrijving: 'Ligt het in een beschermd stads-/dorpsgezicht?' },
        ],
      },
      {
        naam: 'Fysiek Risicoprofiel',
        beschrijving: 'Hoe groot is het risico op funderingsproblemen, asbest en vervuiling?',
        uitleg: 'We combineren vier risicofactoren: funderingsrisico (bouwjaar × bodemtype), bodemtype (klei/veen/zand), asbestrisico (bouwjaar × gebruiksdoel) en bodemverontreiniging (historisch gebruik). Elk risico krijgt een label (HOOG/MIDDEL/LAAG) en het gecombineerde risico toont de worst case. Let op: dit zijn indicatieve scores op basis van publieke data, geen vervanging voor professioneel onderzoek.',
        bron: 'BAG + BRO + KCAF',
        status: 'live',
        velden: [
          { naam: 'Funderingsrisico', beschrijving: 'Heuristiek op basis van bouwjaar en bodemtype' },
          { naam: 'Bodemtype', beschrijving: 'Klei, veen, zand of leem' },
          { naam: 'Asbest & verontreiniging', beschrijving: 'Indicatief risico op basis van bouwjaar en gebruik' },
        ],
      },
      {
        naam: '3D Gebouwmodel',
        beschrijving: 'Hoe hoog is het gebouw werkelijk en hoeveel lagen heeft het?',
        uitleg: 'Via de 3D BAG (TU Delft) halen we de werkelijke gebouwhoogte en het aantal bouwlagen op, gemeten met LiDAR. Dit is essentieel voor optoppen: het verschil tussen de werkelijke hoogte en de maximaal toegestane hoogte bepaalt hoeveel u erbij kunt bouwen.',
        bron: '3D BAG (TU Delft)',
        bronUrl: 'https://3dbag.nl',
        status: 'live',
        velden: [
          { naam: 'Gebouwhoogte', beschrijving: 'Werkelijke hoogte in meters (LiDAR-meting)' },
          { naam: 'Bouwlagen', beschrijving: 'Werkelijk aantal bouwlagen' },
        ],
      },
      {
        naam: 'Opportunity Score',
        beschrijving: 'Hoe kansrijk is dit perceel voor ontwikkeling?',
        uitleg: 'Onze eigen scoringsengine beoordeelt elk perceel op 21 factoren — van bestemming en oppervlakte tot eigendomstype en funderingsrisico. U krijgt een totaalscore (0–100) plus een aparte score per ontwikkelstrategie: optoppen, splitsen, transformatie en nieuwbouw. Zo ziet u in één oogopslag welke strategie hier het beste past.',
        bron: 'Propdex score_v3',
        status: 'live',
        velden: [
          { naam: 'Totaalscore', beschrijving: 'Gewogen score 0–100 over 21 factoren' },
          { naam: 'Use-case scores', beschrijving: 'Per strategie: optoppen, splitsen, transformatie, nieuwbouw' },
          { naam: 'Factor breakdown', beschrijving: 'Alle 21 factoren met individuele score en weging' },
        ],
      },
      {
        naam: 'Ontwikkel-dossier',
        beschrijving: 'Hoeveel kan hier nog gebouwd worden en wat zijn de vergunningskansen?',
        uitleg: 'We berekenen de "buildability delta" — het verschil tussen wat er nu staat en wat het bestemmingsplan maximaal toelaat. Hoeveel extra m², hoeveel extra lagen, hoeveel extra woningen? Daarnaast checken we de Wet kwaliteitsborging (Wkb) gevolgklasse en zoeken we vergelijkbare vergunningbesluiten in dezelfde gemeente als referentie.',
        bron: 'BAG + DSO + KOOP',
        status: 'live',
        velden: [
          { naam: 'Buildability delta', beschrijving: 'Extra m², lagen en woningen die het bestemmingsplan toelaat' },
          { naam: 'Wkb precheck', beschrijving: 'Gevolgklasse A of B — bepaalt het vergunningstraject' },
          { naam: 'Vergunningsprecedent', beschrijving: 'Vergelijkbare vergunningen in dezelfde gemeente' },
        ],
      },
      {
        naam: 'Bekendmakingen per perceel',
        beschrijving: 'Welke vergunningen zijn er aangevraagd of verleend voor dit adres?',
        uitleg: 'We doorzoeken de Officiële Bekendmakingen specifiek voor dit perceel — zowel via automatische monitoring als via on-demand SRU-enrichment. U ziet alle historische vergunningaanvragen, -besluiten en bestemmingsplanwijzigingen op dit adres.',
        bron: 'KOOP SRU',
        bronUrl: 'https://www.officielebekendmakingen.nl',
        status: 'live',
        velden: [
          { naam: 'Vergunninghistorie', beschrijving: 'Titel, datum, status, categorie per bekendmaking' },
        ],
      },
      {
        naam: 'Actievoorstellen',
        beschrijving: 'Wat moet u doen om dit perceel te kunnen ontwikkelen?',
        uitleg: 'Op basis van alle verzamelde data genereert Propdex concrete actiepunten per ontwikkelstrategie. Denk aan: "Funderingsonderzoek uitvoeren (€3.000–8.000)" of "Splitsingsvergunning aanvragen bij gemeente". De acties zijn geprioriteerd (hoog/gemiddeld/laag) en geven een kostenindicatie.',
        bron: 'Propdex',
        status: 'live',
        velden: [
          { naam: 'Acties', beschrijving: 'Per use-case: prioriteit, categorie, titel, beschrijving, kosten' },
        ],
      },
      {
        naam: 'PDF Rapporten',
        beschrijving: 'Exporteer een compleet dossier als PDF voor investeerders of banken.',
        uitleg: 'U kunt twee typen PDF-rapporten genereren: een Locatie Due Diligence Dossier (volledige analyse) en een Risicobeoordeling Startdossier (voor de kwaliteitsborger bij Wkb). Beide worden gegenereerd met alle actuele data en zijn direct presenteerbaar aan banken, investeerders of samenwerkingspartners.',
        bron: 'Propdex (WeasyPrint)',
        status: 'live',
        velden: [
          { naam: 'Due Diligence Dossier', beschrijving: 'Volledige locatie-analyse als PDF' },
          { naam: 'Startdossier', beschrijving: 'Risicobeoordeling voor kwaliteitsborger (Wkb)' },
        ],
      },
      // ── Roadmap ──
      {
        naam: 'Programmamix-tool',
        beschrijving: 'Welke mix van woningen levert het meeste op?',
        uitleg: 'Per perceel meerdere scenario\'s doorrekenen: hoeveel appartementen, hoeveel rijwoningen, hoeveel zorgwoningen? Wat zijn de bouwkosten per variant en wat is de verwachte opbrengst? OPENRED biedt dit al. Vereist VON-prijsdata en bouwkostendata. Implementatie: backend rekentool die bestemmingsplan-capaciteit combineert met marktdata (VON-prijzen, bouwkosten), interactieve frontend tool in het perceelrapport waar de gebruiker scenario\'s kan vergelijken. Automatisch berekend op basis van perceeldata — geen handmatige configuratie.',
        bron: 'Propdex + marktdata',
        status: 'roadmap',
        velden: [
          { naam: 'Scenario\'s', beschrijving: 'Woningtypen, aantallen, kosten en opbrengsten per variant' },
          { naam: 'Optimale mix', beschrijving: 'Aanbevolen programmering op basis van markt en bestemmingsplan' },
        ],
      },
      {
        naam: 'WWS Huurpunten',
        beschrijving: 'Hoeveel huur mag u vragen volgens het puntensysteem?',
        uitleg: 'Het Woningwaarderingstelsel (WWS) bepaalt de maximale huurprijs voor sociale en middenhuur. Door automatisch de punten te berekenen op basis van oppervlakte, energielabel, WOZ-waarde en voorzieningen weet u direct of een woning in het vrije of gereguleerde segment valt. Implementatie: deterministische berekening in backend op basis van al beschikbare perceeldata (oppervlakte uit BAG, energielabel uit EP-Online, WOZ uit waardeloket), nieuwe sectie in het perceelrapport. Volledig automatisch — geen configuratie nodig.',
        bron: 'WWS puntentabel',
        status: 'roadmap',
        velden: [
          { naam: 'WWS-punten', beschrijving: 'Puntentotaal en maximale huurprijs' },
          { naam: 'Segment', beschrijving: 'Sociaal, middenhuur of vrije sector op basis van puntentotaal' },
        ],
      },
      {
        naam: 'Rendementscalculator',
        beschrijving: 'Wat levert deze investering netto op?',
        uitleg: 'Bruto- en netto-rendement berekenen op basis van aankoopprijs, verwachte huur, financieringsvorm (Box 1/Box 3/BV), belastingen en kosten. Inclusief terugverdientijd. Vergelijkbare tools bestaan al voor particuliere beleggers (bijv. RendementTool), maar geïntegreerd met onze data wordt het veel krachtiger. Implementatie: backend berekening met deels automatische input (WOZ, WWS-punten, energielabel) en deels gebruikersinvoer (aankoopprijs, financiering), interactieve calculator in het perceelrapport. Semi-automatisch — basisberekening automatisch, fine-tuning door gebruiker.',
        bron: 'Eigen berekening',
        status: 'roadmap',
        velden: [
          { naam: 'Rendement', beschrijving: 'Bruto/netto rendement, belasting, terugverdientijd' },
          { naam: 'Scenario vergelijking', beschrijving: 'Koop+verhuur vs koop+verkoop vs transformatie' },
        ],
      },
      {
        naam: 'Kostencalculator',
        beschrijving: 'Wat kost het om dit project te realiseren?',
        uitleg: 'Alle kosten op een rij: aankoopprijs, overdrachtsbelasting (10,4% / 2%), notariskosten, bouwkosten (regionaal), financieringskosten, onderhoud, verzekering. Vergelijkbaar met wat u in de meegeleverde voorbeeldanalyse ziet maar dan automatisch ingevuld met actuele data. Implementatie: backend berekening met regionale bouwkostendata (BDB) + perceelspecifieke inputs (oppervlakte, bouwlagen, bestemming), nieuwe sectie in perceelrapport. Automatisch voorgevuld — gebruiker kan parameters aanpassen.',
        bron: 'Regionale bouwkostendata',
        status: 'roadmap',
        velden: [
          { naam: 'Kostenposten', beschrijving: 'Alle kosten van aankoop tot oplevering' },
          { naam: 'Regionale bouwkosten', beschrijving: 'Bouwkosten per m² op basis van regio en woningtype' },
        ],
      },
      // ── Innovatie ──
      {
        naam: 'Energienet-capaciteit',
        beschrijving: 'Kan dit project worden aangesloten op het stroomnet?',
        uitleg: 'Netcongestie blokkeert steeds vaker nieuwbouwprojecten — het stroomnet zit vol. Door data van Liander/Enexis te integreren kunt u vóór aankoop checken of er capaciteit is. Geen concurrent biedt dit. Implementatie: backend API-integratie met netbeheerder capaciteitskaarten (Liander, Enexis, Stedin publiceren open data), nieuwe sectie in perceelrapport met kaartvisualisatie. Automatisch op basis van locatie — geen configuratie.',
        bron: 'Liander / Enexis',
        status: 'innovatie',
        velden: [
          { naam: 'Netcapaciteit', beschrijving: 'Beschikbare capaciteit en wachtlijst' },
          { naam: 'Netbeheerder', beschrijving: 'Welke netbeheerder en welk station' },
        ],
      },
      {
        naam: 'CO₂-footprint',
        beschrijving: 'Wat is de milieu-impact van dit gebouw?',
        uitleg: 'Embodied carbon (CO₂ in bouwmaterialen) en operationele CO₂-uitstoot berekenen. Steeds relevanter voor ESG-rapportages en duurzame financiering. De Nationale Milieudatabase (NMD) biedt referentiedata. Implementatie: backend berekening op basis van bouwjaar, oppervlakte, energielabel + NMD referentiewaarden, nieuwe sectie in perceelrapport. Automatisch berekend — geen configuratie.',
        bron: 'NMD + eigen berekening',
        status: 'innovatie',
        velden: [
          { naam: 'Carbon footprint', beschrijving: 'CO₂-emissie bestaand vs na renovatie/nieuwbouw' },
          { naam: 'MPG-score', beschrijving: 'Milieuprestatie Gebouwen indicatie' },
        ],
      },
      {
        naam: 'Stikstofdepositie (AERIUS)',
        beschrijving: 'Veroorzaakt dit project stikstofdepositie op Natura2000?',
        uitleg: 'Bouw- en gebruiksactiviteiten veroorzaken stikstofuitstoot. Als er een Natura2000-gebied in de buurt is, kan dit uw vergunning blokkeren. AERIUS is de officiële rekentool van de overheid. Integratie voorkomt verrassingen laat in het vergunningstraject. Implementatie: AERIUS Connect API-integratie op basis van perceellocatie + bouwomvang, nieuwe sectie in perceelrapport + waarschuwing in checklist. Automatisch berekend — geen configuratie.',
        bron: 'AERIUS',
        bronUrl: 'https://www.aerius.nl',
        status: 'innovatie',
        velden: [
          { naam: 'Depositie', beschrijving: 'Stikstofberekening voor bouw- en gebruiksfase' },
          { naam: 'Natura2000 impact', beschrijving: 'Welke gebieden geraakt en overschrijding ja/nee' },
        ],
      },
      {
        naam: 'Verduurzaming modellering',
        beschrijving: 'Wat kost verduurzaming en wat levert het op?',
        uitleg: 'Per gebouw berekenen welke verduurzamingsmaatregelen (isolatie, zonnepanelen, warmtepomp) zinvol zijn, wat ze kosten, hoeveel energie ze besparen, en welke subsidies beschikbaar zijn. Milieu Centraal en RVO bieden referentiedata. Implementatie: backend berekening op basis van bouwjaar, energielabel, oppervlakte + Milieu Centraal referentiewaarden + RVO subsidie-API, interactieve tool in perceelrapport. Automatisch voorgevuld — gebruiker kan maatregelen aan/uitzetten.',
        bron: 'Milieu Centraal + RVO',
        status: 'innovatie',
        velden: [
          { naam: 'Maatregelen', beschrijving: 'Kosten, besparing, terugverdientijd per maatregel + subsidies' },
          { naam: 'Labelsprong', beschrijving: 'Verwacht energielabel na maatregelen' },
        ],
      },
    ],
  },
]

/* ── Sub-components ────────────────────────────────────────── */

function SourceDetailModal({ source, onClose }: { source: DataSource; onClose: () => void }) {
  const c = STATUS[source.status]

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose() }
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="catalog-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[calc(100vh-80px)] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-8 pt-7 pb-4 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.color }}>{c.label}</span>
              </div>
              <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                {source.naam}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                {source.bronUrl ? (
                  <a
                    href={source.bronUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-aura-amber hover:underline"
                  >
                    {source.bron}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400">{source.bron}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB] ml-4 mt-0.5"
              aria-label="Sluiten"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
            {/* Explanation */}
            <p className="text-[13px] text-slate-600 leading-relaxed mb-6">
              {source.uitleg}
            </p>

            {/* Fields */}
            <h3
              className="text-[10px] font-black text-slate-400 uppercase mb-3"
              style={{ letterSpacing: '0.2em' }}
            >
              Beschikbare data
            </h3>
            <div className="space-y-0">
              {source.velden.map((v, i) => (
                <div
                  key={v.naam}
                  className={`py-3 ${i < source.velden.length - 1 ? 'border-b border-[#EAEFEF]' : ''}`}
                >
                  <span className="text-[13px] font-bold text-[#0E1111] block">{v.naam}</span>
                  <span className="text-[12px] text-slate-500 block mt-0.5 leading-relaxed">{v.beschrijving}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

function SourceCard({ source, onOpen }: { source: DataSource; onOpen: () => void }) {
  const c = STATUS[source.status]

  return (
    <motion.button
      variants={fadeUp}
      type="button"
      onClick={onOpen}
      className="flex flex-col justify-between rounded-[24px] border border-[#EAEFEF] bg-white p-5 text-left transition-all duration-200 hover:shadow-md hover:border-[#DDE3E3] cursor-pointer h-full"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Top: status dot + bron */}
      <div className="flex items-center justify-between w-full mb-3">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
        <span className="text-[9px] font-semibold text-slate-400">{source.bron}</span>
      </div>

      {/* Name */}
      <h4 className="text-[14px] font-bold text-[#0E1111] leading-snug mb-1">{source.naam}</h4>

      {/* Description */}
      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 flex-1">{source.beschrijving}</p>

      {/* Bottom: field count */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#EAEFEF]">
        <span className="text-[10px] text-slate-400 font-medium">
          {source.velden.length} {source.velden.length === 1 ? 'veld' : 'velden'}
        </span>
        <span className="text-[10px] text-slate-300 font-medium">Bekijk →</span>
      </div>
    </motion.button>
  )
}

/* ── Progress ring ─────────────────────────────────────────── */

function ProgressRing({ count, total, color }: { count: number; total: number; color: string }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? count / total : 0

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg viewBox="0 0 48 48" className="h-12 w-12" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <motion.circle
          cx="24" cy="24" r={r} fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - pct * circ }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        />
      </svg>
      <span className="absolute text-[12px] font-black tabular-nums" style={{ color }}>
        {count}
      </span>
    </div>
  )
}

/* ── Main component ────────────────────────────────────────── */

export function DataCatalog() {
  const [activeView, setActiveView] = useState('gemeente')
  const [openSource, setOpenSource] = useState<DataSource | null>(null)

  const view = VIEWS.find((v) => v.key === activeView)!
  const total = view.bronnen.length

  // Group by status
  const groups: { status: DataStatus; items: DataSource[] }[] = (
    ['live', 'beschikbaar', 'roadmap', 'innovatie'] as DataStatus[]
  )
    .map((s) => ({ status: s, items: view.bronnen.filter((b) => b.status === s) }))
    .filter((g) => g.items.length > 0)

  return (
    <div>
      {/* ── View toggle — full width ──────────────────── */}
      <div className="flex items-center bg-[#F2F6F3] rounded-[18px] p-1 mb-6">
        {VIEWS.map((v) => {
          const active = activeView === v.key
          const Icon = v.icon
          return (
            <button
              key={v.key}
              onClick={() => setActiveView(v.key)}
              className={`relative flex-1 flex items-center justify-center gap-2.5 py-3 rounded-[14px] text-[14px] font-bold transition-all duration-200 ${
                active
                  ? 'bg-[#0E1111] text-white shadow-lg'
                  : 'text-slate-500 hover:text-[#0E1111]'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
              <span>{v.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Source groups — 3-col card grid ─────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {groups.map((group) => {
            const c = STATUS[group.status]
            return (
              <div key={group.status} className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <ProgressRing count={group.items.length} total={total} color={c.color} />
                  <h3
                    className="text-[11px] font-black uppercase tracking-[0.15em]"
                    style={{ color: c.color }}
                  >
                    {c.label}
                  </h3>
                  <div className="h-px flex-1 bg-[#EAEFEF]" />
                </div>

                <motion.div
                  className="grid grid-cols-3 gap-2"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  {group.items.map((source) => (
                    <SourceCard
                      key={source.naam}
                      source={source}
                      onOpen={() => setOpenSource(source)}
                    />
                  ))}
                </motion.div>
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>

      {/* ── Detail modal ───────────────────────────────── */}
      {openSource && (
        <SourceDetailModal source={openSource} onClose={() => setOpenSource(null)} />
      )}
    </div>
  )
}

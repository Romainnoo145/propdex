/**
 * Curated subsidies dataset — woningbouw & verduurzaming subsidies
 * that are NOT available via the RVO open data API.
 *
 * Sources: RVO.nl, provincial/municipal subsidy portals.
 * Last updated: 2026-03-26
 */

export type SubsidieNiveau = 'landelijk' | 'provinciaal' | 'gemeentelijk'
export type SubsidieStatus = 'open' | 'gesloten' | 'doorlopend'

export interface CuratedSubsidie {
  id: string
  title: string
  niveau: SubsidieNiveau
  regio?: string // province or municipality name
  doelgroep: string
  beschrijving: string
  voorwaarden: string
  budget?: string
  maxBedrag?: string
  status: SubsidieStatus
  deadline?: string
  url?: string
}

export const CURATED_SUBSIDIES: CuratedSubsidie[] = [
  // ── Landelijk ──────────────────────────────────────────────
  {
    id: 'wbi',
    title: 'Woningbouwimpuls (WBI)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Specifieke uitkering voor gemeenten die het tekort aan betaalbare woningen willen oplossen voor starters en lage/middeninkomens. Dekt max 50% van het publiek financieel tekort bij woningbouwprojecten van ≥200 woningen.',
    voorwaarden:
      'Min. 200 woningen, ≥50% betaalbaar (sociale huur, middenhuur of koop tot €420.000). Bouw nog niet gestart, eerste woningen binnen 3 jaar, laatste binnen 10 jaar. Gemeente dekt overige 50% tekort. Aanvraag via eHerkenning niveau 2+.',
    budget: '€95 mln (8e ronde)',
    maxBedrag: 'Geen maximum per aanvraag',
    status: 'gesloten',
    deadline: '19 maart 2026',
    url: 'https://www.rvo.nl/subsidies-financiering/woningbouwimpuls',
  },
  {
    id: 'realisatiestimulans',
    title: 'Realisatiestimulans',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Vaste bijdrage van €7.000 per betaalbare woning die in het voorgaande jaar in aanbouw is genomen. Onderdeel van het programma "Meer woningen" met totaalbudget van ±€2,5 miljard (2026–2030).',
    voorwaarden:
      'Betaalbare woning moet in aanbouw zijn genomen in het voorgaande kalenderjaar. Niet combineerbaar met WBI voor dezelfde woningen.',
    budget: '±€2,5 mrd (2026–2030)',
    maxBedrag: '€7.000 per woning',
    status: 'doorlopend',
    url: 'https://www.rvo.nl/subsidies-financiering/realisatiestimulans',
  },
  {
    id: 'vhf',
    title: 'Volkshuisvestingsfonds (VHF)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Subsidie voor verbetering en transformatie van bestaande bebouwing in kwetsbare gebieden — splitsen, optoppen, slopen/nieuwbouw. Gericht op leefbaarheidsverbetering in aandachtswijken.',
    voorwaarden:
      'Min. 100 woningen stedelijk (50 buiten stedelijk). Gemeente dekt 30% van het tekort. Start binnen twee jaar na toekenning.',
    budget: 'Meerdere rondes per jaar',
    status: 'doorlopend',
    url: 'https://www.rvo.nl/subsidies-financiering/volkshuisvestingsfonds',
  },
  {
    id: 'sseb',
    title: 'Stimuleringsregeling Schoon en Emissieloos Bouwmaterieel (SSEB)',
    niveau: 'landelijk',
    doelgroep: 'Aannemers / verhuurders',
    beschrijving:
      'Subsidie voor aanschaf of lease van nieuwe emissievrije bouwmachines. Onderdeel van de transitie naar schone bouwplaatsen conform Schone Lucht Akkoord.',
    voorwaarden:
      'Machines moeten nieuw zijn en op de "Lijst Bouwmachines SSEB" staan. Aanvrager wordt eigenaar na lease en moet juiste SBI-code hebben.',
    budget: '€50 mln (2026)',
    status: 'open',
    url: 'https://www.rvo.nl/subsidies-financiering/sseb',
  },
  {
    id: 'szgw',
    title: 'Stimuleringsregeling Zorggeschikte Woningen (SZGW)',
    niveau: 'landelijk',
    doelgroep: 'Woningcorporaties, zorgorganisaties',
    beschrijving:
      'Subsidie voor bouw of transformatie van sociale huurwoningen geschikt voor ouderen en zorgbehoevenden. Draagt bij aan het scheiden van wonen en zorg.',
    voorwaarden:
      'Min. 15% woningen voor Wlz-profielen. Transformatie vanaf €40.000 per woning. Start binnen 3 jaar, afronding binnen 5 jaar na toekenning.',
    status: 'doorlopend',
    url: 'https://www.rvo.nl/subsidies-financiering/szgw',
  },
  {
    id: 'rthf',
    title: 'Regeling tegemoetkoming herplaatsing flexwoningen (RTHF)',
    niveau: 'landelijk',
    doelgroep: 'Investeerders in flexwoningen',
    beschrijving:
      'Garandeert verplaatsing en compenseert de onrendabele top wanneer nieuwe flexwoningen (sociale huur) na 10–20 jaar moeten worden verplaatst of verkocht. Vermindert investeringsrisico voor flexwoning-exploitanten.',
    voorwaarden:
      'Woning moet nieuw en energie-efficiënt zijn met min. levensduur van 25 jaar (verplaatsbaar) of 50 jaar (permanent).',
    status: 'doorlopend',
    url: 'https://www.rvo.nl/subsidies-financiering/rthf',
  },
  {
    id: 'hggv',
    title: 'Huisvesting grote gezinnen vergunninghouders (HGGV)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Financiering voor aanpassing of transformatie van gebouwen voor grote statushoudersgezinnen (≥6 personen). Ondersteunt de wettelijke huisvestingstaak van gemeenten.',
    voorwaarden:
      'Max €35.000 (6–9 personen) of €50.000 (≥10 personen) per project. Afronding binnen één jaar na toekenning.',
    maxBedrag: '€35.000 – €50.000 per project',
    status: 'doorlopend',
    url: 'https://www.rvo.nl/subsidies-financiering/hggv',
  },
  {
    id: 'soo',
    title: 'Stimuleringsregeling ontmoetingsruimten in ouderenhuisvesting (SOO)',
    niveau: 'landelijk',
    doelgroep: 'Corporaties, zorginstellingen, bewoners',
    beschrijving:
      'Subsidie voor (ver)bouw van ontmoetingsruimten in wooncomplexen voor 55-plussers. Bestrijdt eenzaamheid en bevordert gemeenschapsvorming.',
    voorwaarden:
      'Bouw mag niet starten vóór subsidie-toekenning. Start binnen 3 jaar, afronding binnen 7 jaar.',
    maxBedrag: '€2.500 per m²',
    status: 'doorlopend',
    url: 'https://www.rvo.nl/subsidies-financiering/soo',
  },
  {
    id: 'rha',
    title: 'Regeling huisvesting aandachtsgroepen (RHA)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Subsidie voor huisvesting van studenten, statushouders, arbeidsmigranten en daklozen. Onderdeel van het programma "Een thuis voor iedereen".',
    voorwaarden:
      'Max €9.000 per woning en €5 mln per gemeente. Woningen binnen 5 jaar gerealiseerd, min. 10 jaar voor doelgroep beschikbaar.',
    budget: '€60 mln (2025-ronde)',
    maxBedrag: '€9.000 per woning, max €5 mln per gemeente',
    status: 'doorlopend',
    url: 'https://www.rvo.nl/subsidies-financiering/rha',
  },
  {
    id: 'sft',
    title: 'Stimuleringsregeling flex- en transformatiewoningen (SFT)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten, woningcorporaties',
    beschrijving:
      'Specifieke uitkering voor realisatie van flexwoningen, transformatiewoningen, optoppen en splitsing. Gericht op snelle toevoeging van betaalbare sociale huurwoningen voor kwetsbare doelgroepen.',
    voorwaarden:
      'Min. 10 jaar sociale huur. 30% gereserveerd voor statushouders/ontheemden/spoedzoekers. Aantoonbaar financieel tekort. Niet combineerbaar met andere rijksuitkeringen voor zelfde project.',
    budget: 'Budget 2026–2027',
    status: 'open',
    deadline: '31 december 2027',
    url: 'https://www.rvo.nl/subsidies-financiering/sft',
  },

  // ── Provinciaal ────────────────────────────────────────────
  {
    id: 'nb-woningbouwversnelling',
    title: 'Subsidieregeling woningbouwversnelling',
    niveau: 'provinciaal',
    regio: 'Noord-Brabant',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Versnellen van pre-ontwikkeling (vergunningen, planvorming) bij woningbouwprojecten. Budget voor flexpool om extra ambtelijke capaciteit in te huren bij gemeenten.',
    voorwaarden:
      'Derde tranche april 2025. Extra middelen voor "Een thuis voor iedereen" en "Wonen en zorg voor ouderen". Aanvraag via provincie.',
    status: 'open',
    url: 'https://www.brabant.nl/subsidy/subsidieregeling-woningbouwversnelling',
  },
  {
    id: 'ut-woningbouw',
    title: 'Subsidieregeling Versnelling Woningbouw 2025–2028',
    niveau: 'provinciaal',
    regio: 'Utrecht',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Ondersteunt gemeenten bij het versnellen van bestaande woningbouwprojecten door knelpunten op te lossen — externe expertise of dekking onrendabele top.',
    voorwaarden:
      'Open van 31 december 2025 tot 31 december 2028. Aanvraag bij Gedeputeerde Staten.',
    budget: '€25 mln totaal',
    status: 'open',
    deadline: '31 december 2028',
    url: 'https://www.provincie-utrecht.nl/subsidie/versnelling-woningbouw',
  },
  {
    id: 'limburg-duurzaam-thuis',
    title: 'Duurzaam Thuis-lening',
    niveau: 'provinciaal',
    regio: 'Limburg',
    doelgroep: 'Woningeigenaren, VvE\'s',
    beschrijving:
      'Rentekortinglening tot €25.000 voor energiebesparende maatregelen (isolatie, warmtepomp, zonnepanelen). Vult het gat waar Limburgse gemeenten geen eigen regelingen hebben.',
    voorwaarden:
      'Eigenaar-bewoner of VvE in Limburg. Min. twee maatregelen uit de lijst. Lening via SVn met lage rente.',
    maxBedrag: '€25.000 per woning',
    status: 'doorlopend',
    url: 'https://www.limburg.nl/onderwerpen/wonen/duurzaam-thuis',
  },
  {
    id: 'limburg-starterslening',
    title: 'Starterslening Limburg',
    niveau: 'provinciaal',
    regio: 'Limburg',
    doelgroep: 'Starters op de woningmarkt',
    beschrijving:
      'Aanvulling op de hypotheek voor eerste koopwoningen via rentekortinglening (SVn). Beschikbaar in de meeste Limburgse gemeenten. Overbrugt het verschil tussen maximale hypotheek en koopsom.',
    voorwaarden:
      'Eerste koopwoning, inkomen onder grens, woning onder maximale koopsom. Per gemeente kunnen aanvullende voorwaarden gelden.',
    status: 'doorlopend',
    url: 'https://www.svn.nl/starterslening',
  },

  // ── Gemeentelijk ───────────────────────────────────────────
  {
    id: 'emmen-betaalbaar',
    title: 'Subsidieregeling Betaalbare Woningbouw 2025',
    niveau: 'gemeentelijk',
    regio: 'Emmen',
    doelgroep: 'Ontwikkelaars, corporaties, bewoners',
    beschrijving:
      'Subsidie om betaalbare woningen te bouwen of de woningvoorraad te verbeteren. Onderdeel van Woondeal-afspraken.',
    voorwaarden:
      'Min. 4 woningen per project, binnen bebouwde kom. Minstens 30% sociale huur, middenhuur of betaalbare koop. Moet deel uitmaken van Woondeal.',
    status: 'open',
  },
  {
    id: 'venlo-monumenten',
    title: 'Monumenten- en erfgoedsubsidie',
    niveau: 'gemeentelijk',
    regio: 'Venlo',
    doelgroep: 'Eigenaren van gemeentelijke monumenten',
    beschrijving:
      'Incidentele subsidies of goedkope leningen voor onderhoud en restauratie van gemeentelijke monumenten. Aanvragen via afdeling erfgoed gemeente Venlo.',
    voorwaarden:
      'Pand moet gemeentelijk monument of beeldbepalend zijn. Voor woningbouw verwijst Venlo naar provinciale en landelijke regelingen.',
    status: 'doorlopend',
  },
  {
    id: 'limburg-gemeenten-erfgoed',
    title: 'Erfgoed- en gevelsubsidies (diverse gemeenten)',
    niveau: 'gemeentelijk',
    regio: 'Diverse Limburgse gem.',
    doelgroep: 'Eigenaren van monumenten, panden in beschermd gezicht',
    beschrijving:
      'Incidentele subsidies voor restauratie van rijks- of gemeentelijke monumenten en gevelrenovatie in beschermde stads- of dorpsgezichten.',
    voorwaarden:
      'Verschilt per gemeente. Raadpleeg de gemeentelijke website of neem contact op met de afdeling wonen/vergunningen. Regelingen wijzigen regelmatig.',
    status: 'doorlopend',
  },
]

/** Group subsidies by niveau */
export function groupByNiveau(items: CuratedSubsidie[]): Map<SubsidieNiveau, CuratedSubsidie[]> {
  const map = new Map<SubsidieNiveau, CuratedSubsidie[]>()
  for (const item of items) {
    const list = map.get(item.niveau) ?? []
    list.push(item)
    map.set(item.niveau, list)
  }
  return map
}

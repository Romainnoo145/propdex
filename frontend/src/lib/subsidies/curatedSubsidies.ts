/**
 * Curated subsidies dataset — woningbouw & verduurzaming subsidies
 * that are NOT available via the RVO open data API.
 *
 * Sources: RVO.nl, provincial/municipal subsidy portals.
 * Last updated: 2026-03-25
 */

export type SubsidieNiveau = 'landelijk' | 'provinciaal' | 'gemeentelijk'

export interface CuratedSubsidie {
  id: string
  title: string
  niveau: SubsidieNiveau
  regio?: string // province or municipality name
  doelgroep: string
  beschrijving: string
  voorwaarden: string
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
      'Subsidie voor bouwprojecten van ≥200 woningen waarbij minstens 50% betaalbaar is. Dekt maximaal 50% van het financiële tekort.',
    voorwaarden:
      'Project mag nog niet gestart zijn en moet binnen drie jaar starten. Minimaal 200 woningen, waarvan ≥50% betaalbaar.',
    url: 'https://www.rvo.nl/subsidies-financiering/woningbouwimpuls',
  },
  {
    id: 'realisatiestimulans',
    title: 'Realisatiestimulans',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Vaste bijdrage van €7.000 per betaalbare woning die in het voorgaande jaar in aanbouw is genomen. Totaalbudget ±€2,5 mrd (2026–2030).',
    voorwaarden:
      'Betaalbare woning moet in aanbouw zijn genomen in het voorgaande kalenderjaar.',
    url: 'https://www.rvo.nl/subsidies-financiering/realisatiestimulans',
  },
  {
    id: 'vhf',
    title: 'Volkshuisvestingsfonds (VHF)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Subsidie voor verbetering en transformatie van bestaande bebouwing in kwetsbare gebieden — splitsen, optoppen, slopen/nieuwbouw.',
    voorwaarden:
      'Minimaal 100 woningen stedelijk (50 buiten stedelijk). Gemeente dekt 30% van het tekort. Start binnen twee jaar.',
    url: 'https://www.rvo.nl/subsidies-financiering/volkshuisvestingsfonds',
  },
  {
    id: 'sseb',
    title: 'Stimuleringsregeling Schoon en Emissieloos Bouwmaterieel (SSEB)',
    niveau: 'landelijk',
    doelgroep: 'Aannemers / verhuurders',
    beschrijving:
      'Subsidie (2026: €50 mln) voor aanschaf of lease van nieuwe emissievrije bouwmachines.',
    voorwaarden:
      'Machines moeten nieuw zijn en op de "Lijst Bouwmachines SSEB" staan. Aanvrager wordt eigenaar na lease en moet juiste SBI-code hebben.',
    url: 'https://www.rvo.nl/subsidies-financiering/sseb',
  },
  {
    id: 'szgw',
    title: 'Stimuleringsregeling Zorggeschikte Woningen (SZGW)',
    niveau: 'landelijk',
    doelgroep: 'Woningcorporaties en zorgorganisaties',
    beschrijving:
      'Subsidie voor bouw of transformatie van sociale huurwoningen geschikt voor ouderen en zorgbehoevenden.',
    voorwaarden:
      'Minimaal 15% van de woningen voor Wlz-profielen. Transformatie vanaf €40.000 per woning. Start binnen drie jaar, afronding binnen vijf jaar.',
    url: 'https://www.rvo.nl/subsidies-financiering/szgw',
  },
  {
    id: 'rthf',
    title: 'Regeling tegemoetkoming herplaatsing flexwoningen (RTHF)',
    niveau: 'landelijk',
    doelgroep: 'Investeerders in flexwoningen',
    beschrijving:
      'Garandeert verplaatsing en compenseert de onrendabele top wanneer nieuwe flexwoningen (sociale huur) na 10–20 jaar moeten worden verplaatst of verkocht.',
    voorwaarden:
      'Woning moet nieuw en energie-efficiënt zijn met minimale levensduur van 25 (verplaatsbaar) of 50 jaar.',
    url: 'https://www.rvo.nl/subsidies-financiering/rthf',
  },
  {
    id: 'hggv',
    title: 'Huisvesting grote gezinnen vergunninghouders (HGGV)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Financiering voor aanpassing of transformatie van gebouwen voor grote statushoudersgezinnen (≥6 personen).',
    voorwaarden:
      'Max €35.000 (6–9 personen) of €50.000 (≥10 personen) per project. Afronding binnen één jaar.',
    url: 'https://www.rvo.nl/subsidies-financiering/hggv',
  },
  {
    id: 'soo',
    title: 'Stimuleringsregeling ontmoetingsruimten in ouderenhuisvesting (SOO)',
    niveau: 'landelijk',
    doelgroep: 'Woningcorporaties, zorginstellingen, bewonersinitiatieven',
    beschrijving:
      'Max €2.500 per m² voor (ver)bouw van ontmoetingsruimten in wooncomplexen voor 55-plussers.',
    voorwaarden:
      'Bouw mag niet starten vóór subsidie-toekenning. Start binnen drie jaar, afronding binnen zeven jaar.',
    url: 'https://www.rvo.nl/subsidies-financiering/soo',
  },
  {
    id: 'rha',
    title: 'Regeling huisvesting aandachtsgroepen (RHA)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Budget van €60 mln (2025-ronde) voor huisvesting van studenten, statushouders, arbeidsmigranten en daklozen.',
    voorwaarden:
      'Max €9.000 per woning en €5 mln per gemeente. Woningen binnen vijf jaar gerealiseerd, minstens tien jaar voor doelgroep beschikbaar.',
    url: 'https://www.rvo.nl/subsidies-financiering/rha',
  },
  {
    id: 'sft',
    title: 'Stimuleringsregeling flex- en transformatiewoningen (SFT)',
    niveau: 'landelijk',
    doelgroep: 'Gemeenten, woningcorporaties',
    beschrijving:
      'Subsidie voor realisatie van flexwoningen en transformatie van bestaande gebouwen naar woningen. Onderdeel van programma "Meer woningen".',
    voorwaarden:
      'Zie RVO voor actuele voorwaarden per ronde.',
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
      'Versnellen van pre-ontwikkeling (vergunningen, planvorming) bij woningbouwprojecten. Budget voor flexpool om extra capaciteit in te huren.',
    voorwaarden:
      'Continuatie van "Bijdrageregeling Stimulering woningbouw 2023". Derde tranche april 2025. Extra middelen voor "Een thuis voor iedereen" en "Wonen en zorg voor ouderen".',
    url: 'https://www.brabant.nl/subsidy/subsidieregeling-woningbouwversnelling',
  },
  {
    id: 'ut-woningbouw',
    title: 'Subsidieregeling Versnelling Woningbouw 2025–2028',
    niveau: 'provinciaal',
    regio: 'Utrecht',
    doelgroep: 'Gemeenten',
    beschrijving:
      'Ondersteunt gemeenten bij het versnellen van bestaande woningbouwprojecten door knelpunten op te lossen.',
    voorwaarden:
      'Open van 31 december 2025 tot 31 december 2028. Totaalbudget €25 mln. Voor externe expertise of dekking onrendabele top.',
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
      'Eigenaar-bewoner of VvE in Limburg. Minimaal twee maatregelen uit de lijst. Lening via SVn met lage rente.',
    url: 'https://www.limburg.nl/onderwerpen/wonen/duurzaam-thuis',
  },
  {
    id: 'limburg-starterslening',
    title: 'Starterslening Limburg',
    niveau: 'provinciaal',
    regio: 'Limburg',
    doelgroep: 'Starters op de woningmarkt',
    beschrijving:
      'Aanvulling op de hypotheek voor eerste koopwoningen. Geen subsidie maar een rentekortinglening via SVn. Beschikbaar in de meeste Limburgse gemeenten.',
    voorwaarden:
      'Eerste koopwoning, inkomen onder grens, woning onder maximale koopsom. Per gemeente kunnen aanvullende voorwaarden gelden.',
    url: 'https://www.svn.nl/starterslening',
  },

  // ── Gemeentelijk ───────────────────────────────────────────
  {
    id: 'emmen-betaalbaar',
    title: 'Subsidieregeling Betaalbare Woningbouw 2025',
    niveau: 'gemeentelijk',
    regio: 'Emmen',
    doelgroep: 'Projectontwikkelaars, woningcorporaties, bewonersinitiatieven',
    beschrijving:
      'Subsidie om betaalbare woningen te bouwen of de woningvoorraad te verbeteren.',
    voorwaarden:
      'Minimaal vier woningen per project, binnen bebouwde kom. Minstens 30% sociale huur, middenhuur of betaalbare koop. Moet deel uitmaken van Woondeal.',
  },
  {
    id: 'venlo-monumenten',
    title: 'Monumenten- en erfgoedsubsidie',
    niveau: 'gemeentelijk',
    regio: 'Venlo',
    doelgroep: 'Eigenaren van gemeentelijke monumenten en beeldbepalende panden',
    beschrijving:
      'Incidentele subsidies of goedkope leningen voor onderhoud en restauratie van gemeentelijke monumenten. Aanvragen via afdeling erfgoed.',
    voorwaarden:
      'Pand moet gemeentelijk monument of beeldbepalend zijn. Geen aparte Venlo-specifieke bouwsubsidie — voor woningbouw verwijst Venlo naar provinciale en landelijke regelingen.',
  },
  {
    id: 'limburg-gemeenten-erfgoed',
    title: 'Erfgoed- en gevelsubsidies (diverse Limburgse gemeenten)',
    niveau: 'gemeentelijk',
    regio: 'Maastricht, Heerlen, Sittard-Geleen, Roermond, Weert, Venray',
    doelgroep: 'Eigenaren van monumenten, panden in beschermd gezicht',
    beschrijving:
      'Incidentele subsidies voor restauratie van rijks- of gemeentelijke monumenten en gevelrenovatie in beschermde stads- of dorpsgezichten. Per gemeente verschillende voorwaarden.',
    voorwaarden:
      'Verschilt per gemeente. Raadpleeg de gemeentelijke website of neem contact op met de afdeling wonen/vergunningen. Regelingen wijzigen regelmatig.',
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

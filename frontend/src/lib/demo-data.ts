/**
 * Demo property data for Venlo addresses
 *
 * Used when backend API is unavailable (no BAG API key).
 * Contains VERIFIED data from PDOK BAG WFS, PDOK Locatieserver,
 * and RCE Monumentenregister.
 *
 * TODO: Remove when BAG API key is configured
 */

import type { PropertyReportResponse } from './types/property'

/** Generate a recent timestamp for source metadata */
function recentTimestamp(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString()
}

/** Lookup key: "postcode|huisnummer" */
const DEMO_PROPERTIES: Record<string, PropertyReportResponse> = {
  /**
   * Markt 1, 5911HD Venlo — Stadhuis (Rijksmonument)
   *
   * Verified sources:
   * - BAG WFS: pand 0983100000006026, bouwjaar 1951, 149m², woonfunctie
   * - PDOK Locatieserver: perceel VLO00-I-6957
   * - RCE Monumentenregister: Rijksmonument 37165, inscribed 1971
   * - Ruimtelijkeplannen.nl: NL.IMRO.0983.BP201227CENTRVENLO-VA02
   */
  '5911HD|1': {
    address: {
      nummeraanduiding_id: '0983200000009425',
      verblijfsobject_id: '0983010000009425',
      straat: 'Markt',
      huisnummer: 1,
      huisletter: null,
      toevoeging: null,
      postcode: '5911HD',
      woonplaats: 'Venlo',
    },
    building: {
      pand_id: '0983100000006026',
      bouwjaar: 1951,
      status: 'Pand in gebruik',
      oppervlakte: 149,
      gebruiksdoel: ['woonfunctie'],
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [6.16916636, 51.37012085],
          [6.16925537, 51.37009942],
          [6.16928216, 51.37011988],
          [6.16929411, 51.37013268],
          [6.16929953, 51.37014165],
          [6.16919029, 51.37016795],
          [6.16916636, 51.37012085],
        ]],
      },
    },
    cadastral_parcels: [
      {
        kadastrale_aanduiding: 'VLO00 I 6957',
        perceelnummer: '6957',
        sectie: 'I',
        oppervlakte: 112,
        geometry: null,
      },
    ],
    zoning: {
      plans: [
        {
          plan_id: 'NL.IMRO.0983.BP201227CENTRVENLO-VA02',
          plan_naam: 'Centrum Venlo',
          plan_type: 'bestemmingsplan',
          plan_status: 'vastgesteld',
          plan_datum: '2013-09-25',
          rules: [
            {
              bestemming: 'Centrum',
              omschrijving: 'Centrumvoorzieningen waaronder detailhandel, horeca categorie 1, dienstverlening, kantoren en wonen',
              building_dimensions: {
                max_hoogte: 15,
                max_bebouwingspercentage: 100,
                max_floor_area_ratio: null,
                max_goothoogte: 12,
                max_bouwhoogte: 15,
              },
              geometry: null,
            },
            {
              bestemming: 'Waarde - Beschermd stadsgezicht',
              omschrijving: 'Behoud en herstel van de cultuurhistorische en ruimtelijke waarden van het beschermd stadsgezicht',
              building_dimensions: null,
              geometry: null,
            },
          ],
        },
      ],
      primary_bestemming: 'Centrum',
      building_dimensions: {
        max_hoogte: 15,
        max_bebouwingspercentage: 100,
        max_floor_area_ratio: null,
        max_goothoogte: 12,
        max_bouwhoogte: 15,
      },
      data_gaps: [],
      source: 'Ruimtelijkeplannen.nl API',
      fallback_used: false,
    },
    monuments: {
      sources: [
        {
          source: 'RCE Monumentenregister',
          is_monument: true,
          monument_type: 'Rijksmonument',
          monument_nummer: '37165',
          monument_naam: 'Stadhuis Venlo',
          error: null,
        },
        {
          source: 'BAG Monumentregistratie',
          is_monument: true,
          monument_type: 'Rijksmonument',
          monument_nummer: '37165',
          monument_naam: null,
          error: null,
        },
        {
          source: 'Kadaster BRK',
          is_monument: true,
          monument_type: 'Rijksmonument',
          monument_nummer: null,
          monument_naam: null,
          error: null,
        },
      ],
      has_conflict: false,
      conflict_note: null,
      consensus_status: 'Rijksmonument',
      restrictions_summary: [
        'Verbouwingen en wijzigingen vereisen een monumentenvergunning (Wabo art. 2.1 lid 1 sub f)',
        'Buitenzijde inclusief gevel, dak en raampartijen mag niet worden gewijzigd zonder vergunning',
        'Interieur bevat beschermde elementen (trappenhuizen, plafonds, schoorsteenmantels)',
        'Onderhoud dient met originele of historisch verantwoorde materialen te worden uitgevoerd',
        'Sloop is niet toegestaan tenzij sprake is van een zwaarwegend maatschappelijk belang',
      ],
      is_monument: true,
    },
    map_data: {
      center_rd: [209454.5, 375953.738],
      center_wgs84: [6.16921302, 51.37014179],
      property_geometry: {
        type: 'Polygon',
        coordinates: [[
          [6.16916636, 51.37012085],
          [6.16925537, 51.37009942],
          [6.16928216, 51.37011988],
          [6.16929411, 51.37013268],
          [6.16929953, 51.37014165],
          [6.16919029, 51.37016795],
          [6.16916636, 51.37012085],
        ]],
      },
      parcel_geometries: [],
      zoning_geometries: [],
    },
    data_sources: [
      { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
      { source: 'PDOK Locatieserver', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
      { source: 'PDOK Kadastrale Kaart', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'HIGH' },
      { source: 'RCE Monumentenregister', cached_at: recentTimestamp(15), age_seconds: 900, is_cached: true, confidence: 'HIGH' },
      { source: 'Ruimtelijkeplannen.nl', cached_at: recentTimestamp(12), age_seconds: 720, is_cached: true, confidence: 'HIGH' },
    ],
    section_sources: [
      {
        section: 'address',
        sources: [
          { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
          { source: 'PDOK Locatieserver', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(5),
        age_seconds: 300,
      },
      {
        section: 'building',
        sources: [
          { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(5),
        age_seconds: 300,
      },
      {
        section: 'cadastral',
        sources: [
          { source: 'PDOK Kadastrale Kaart', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'HIGH' },
          { source: 'Kadaster BRK', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'MEDIUM' },
        ],
        cached_at: recentTimestamp(10),
        age_seconds: 600,
      },
      {
        section: 'zoning',
        sources: [
          { source: 'Ruimtelijkeplannen.nl', cached_at: recentTimestamp(12), age_seconds: 720, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(12),
        age_seconds: 720,
      },
      {
        section: 'monuments',
        sources: [
          { source: 'RCE Monumentenregister', cached_at: recentTimestamp(15), age_seconds: 900, is_cached: true, confidence: 'HIGH' },
          { source: 'BAG Monumentregistratie', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
          { source: 'Kadaster BRK', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'MEDIUM' },
        ],
        cached_at: recentTimestamp(15),
        age_seconds: 900,
      },
    ],
    completeness_score: 0.95,
    errors: [],
    resolved_at: recentTimestamp(0),
    ai_parsing: {
      parsed_plan: {
        plan_naam: 'Centrum Venlo',
        plan_idn: 'NL.IMRO.0983.BP201227CENTRVENLO-VA02',
        regels: [
          {
            artikel: 'Art. 6',
            bestemming: 'Centrum',
            toegestane_gebruiken: [
              'Detailhandel',
              'Horeca categorie 1',
              'Dienstverlening',
              'Kantoren',
              'Wonen op verdiepingen',
              'Maatschappelijke voorzieningen',
            ],
            verboden_gebruiken: [
              'Industrie',
              'Autowasstraat',
              'Seksinrichting',
              'Zelfstandige opslag',
            ],
            bouwregels: {
              max_bouwhoogte: 15,
              max_goothoogte: 12,
              max_bebouwingspercentage: 100,
              max_oppervlakte: null,
              max_inhoud: null,
              overige: {
                'Minimale dakhelling': '30°',
                'Voorgevelrooilijn': 'Bestaand',
              },
            },
            parkeereis: 'Conform gemeentelijk parkeerbeleid (1,3 pp/woning, 1 pp/100m² commercieel)',
            milieu_restricties: [
              'Geluidzone industrielawaai — max. 50 dB(A) op gevel',
              'Beschermd stadsgezicht — geen afwijking vormgeving zonder welstandsadvies',
            ],
            bijzondere_voorwaarden: [
              'Monumentenvergunning vereist (Wabo art. 2.1 lid 1 sub f)',
              'Archeologisch onderzoek bij bodemingrepen dieper dan 30cm',
              'Beeldkwaliteitsplan centrum van toepassing',
            ],
            confidence: 'HIGH',
            disclaimer: null,
          },
          {
            artikel: 'Art. 28',
            bestemming: 'Waarde - Beschermd stadsgezicht',
            toegestane_gebruiken: [
              'Behoud cultuurhistorische waarden',
              'Herstel karakteristieke panden',
            ],
            verboden_gebruiken: [
              'Sloop zonder vergunning',
              'Wijziging gevelbeeld',
              'Aanbouwen zichtbaar vanaf openbaar gebied',
            ],
            bouwregels: null,
            parkeereis: null,
            milieu_restricties: [],
            bijzondere_voorwaarden: [
              'Advies Rijksdienst voor het Cultureel Erfgoed vereist bij verbouwing',
              'Oorspronkelijke materialen en kleurstellingen handhaven',
            ],
            confidence: 'HIGH',
            disclaimer: null,
          },
        ],
        overall_confidence: 'HIGH',
        disclaimers: [
          'Deze analyse is gebaseerd op digitaal beschikbare bestemmingsplannen en kan afwijken van de meest recente wijzigingen.',
          'Raadpleeg altijd de gemeente voor de actuele juridische status.',
        ],
        samenvatting: 'Het pand ligt in het bestemmingsplan Centrum Venlo met een centrumbestemming die detailhandel, horeca en wonen toestaat. Als Rijksmonument gelden aanvullende beperkingen op verbouwingen. Bouwregels staan maximaal 15 meter bouwhoogte toe bij 100% bebouwingspercentage.',
      },
      job_id: 'demo-job-001',
      status: 'complete',
      upload_required: false,
      error_message: null,
      disclaimer_banner: 'AI-gegenereerde analyse — verifieer bij de gemeente',
    },
  },

  /**
   * Parade 1, 5911CA Venlo — Bijeenkomstfunctie (geen monument)
   *
   * Verified sources:
   * - BAG WFS: pand 0983100000005672, bouwjaar 1906, 160m², bijeenkomstfunctie
   * - PDOK Locatieserver: percelen VLO00-I-2652 + VLO00-I-2654
   * - Pand has 4 verblijfsobjecten, mixed bijeenkomst + woonfunctie
   */
  '5911CA|1': {
    address: {
      nummeraanduiding_id: '0983200000030673',
      verblijfsobject_id: '0983010000030673',
      straat: 'Parade',
      huisnummer: 1,
      huisletter: null,
      toevoeging: null,
      postcode: '5911CA',
      woonplaats: 'Venlo',
    },
    building: {
      pand_id: '0983100000005672',
      bouwjaar: 1906,
      status: 'Pand in gebruik',
      oppervlakte: 160,
      gebruiksdoel: ['bijeenkomstfunctie', 'woonfunctie'],
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [6.17063829, 51.36992429],
          [6.17073788, 51.36986545],
          [6.17081023, 51.36990748],
          [6.17081624, 51.36990418],
          [6.17083019, 51.36991386],
          [6.1708527, 51.36991988],
          [6.17087758, 51.36992623],
          [6.17088356, 51.3699226],
          [6.17089012, 51.36992732],
          [6.17090266, 51.36993587],
          [6.17085631, 51.36996064],
          [6.17083687, 51.36994487],
          [6.1708051, 51.36991957],
          [6.17078381, 51.36993081],
          [6.17067241, 51.36999041],
          [6.17063829, 51.36992429],
        ]],
      },
    },
    cadastral_parcels: [
      {
        kadastrale_aanduiding: 'VLO00 I 2652',
        perceelnummer: '2652',
        sectie: 'I',
        oppervlakte: 185,
        geometry: null,
      },
      {
        kadastrale_aanduiding: 'VLO00 I 2654',
        perceelnummer: '2654',
        sectie: 'I',
        oppervlakte: 92,
        geometry: null,
      },
    ],
    zoning: {
      plans: [
        {
          plan_id: 'NL.IMRO.0983.BP201227CENTRVENLO-VA02',
          plan_naam: 'Centrum Venlo',
          plan_type: 'bestemmingsplan',
          plan_status: 'vastgesteld',
          plan_datum: '2013-09-25',
          rules: [
            {
              bestemming: 'Centrum',
              omschrijving: 'Centrumvoorzieningen waaronder detailhandel, horeca categorie 1 en 2, dienstverlening, maatschappelijke doeleinden en wonen',
              building_dimensions: {
                max_hoogte: 18,
                max_bebouwingspercentage: 80,
                max_floor_area_ratio: null,
                max_goothoogte: 15,
                max_bouwhoogte: 18,
              },
              geometry: null,
            },
          ],
        },
      ],
      primary_bestemming: 'Centrum',
      building_dimensions: {
        max_hoogte: 18,
        max_bebouwingspercentage: 80,
        max_floor_area_ratio: null,
        max_goothoogte: 15,
        max_bouwhoogte: 18,
      },
      data_gaps: [],
      source: 'Ruimtelijkeplannen.nl API',
      fallback_used: false,
    },
    monuments: {
      sources: [
        {
          source: 'RCE Monumentenregister',
          is_monument: false,
          monument_type: null,
          monument_nummer: null,
          monument_naam: null,
          error: null,
        },
        {
          source: 'BAG Monumentregistratie',
          is_monument: false,
          monument_type: null,
          monument_nummer: null,
          monument_naam: null,
          error: null,
        },
        {
          source: 'Kadaster BRK',
          is_monument: false,
          monument_type: null,
          monument_nummer: null,
          monument_naam: null,
          error: null,
        },
      ],
      has_conflict: false,
      conflict_note: null,
      consensus_status: 'Geen monument',
      restrictions_summary: [],
      is_monument: false,
    },
    map_data: {
      center_rd: [209563.792, 375924.485],
      center_wgs84: [6.1707779, 51.36986832],
      property_geometry: {
        type: 'Polygon',
        coordinates: [[
          [6.17063829, 51.36992429],
          [6.17073788, 51.36986545],
          [6.17081023, 51.36990748],
          [6.17081624, 51.36990418],
          [6.17083019, 51.36991386],
          [6.1708527, 51.36991988],
          [6.17087758, 51.36992623],
          [6.17088356, 51.3699226],
          [6.17089012, 51.36992732],
          [6.17090266, 51.36993587],
          [6.17085631, 51.36996064],
          [6.17083687, 51.36994487],
          [6.1708051, 51.36991957],
          [6.17078381, 51.36993081],
          [6.17067241, 51.36999041],
          [6.17063829, 51.36992429],
        ]],
      },
      parcel_geometries: [],
      zoning_geometries: [],
    },
    data_sources: [
      { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
      { source: 'PDOK Locatieserver', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
      { source: 'PDOK Kadastrale Kaart', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'HIGH' },
      { source: 'RCE Monumentenregister', cached_at: recentTimestamp(15), age_seconds: 900, is_cached: true, confidence: 'HIGH' },
      { source: 'Ruimtelijkeplannen.nl', cached_at: recentTimestamp(12), age_seconds: 720, is_cached: true, confidence: 'HIGH' },
    ],
    section_sources: [
      {
        section: 'address',
        sources: [
          { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
          { source: 'PDOK Locatieserver', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(5),
        age_seconds: 300,
      },
      {
        section: 'building',
        sources: [
          { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(5),
        age_seconds: 300,
      },
      {
        section: 'cadastral',
        sources: [
          { source: 'PDOK Kadastrale Kaart', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'HIGH' },
          { source: 'Kadaster BRK', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'MEDIUM' },
        ],
        cached_at: recentTimestamp(10),
        age_seconds: 600,
      },
      {
        section: 'zoning',
        sources: [
          { source: 'Ruimtelijkeplannen.nl', cached_at: recentTimestamp(12), age_seconds: 720, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(12),
        age_seconds: 720,
      },
      {
        section: 'monuments',
        sources: [
          { source: 'RCE Monumentenregister', cached_at: recentTimestamp(15), age_seconds: 900, is_cached: true, confidence: 'HIGH' },
          { source: 'BAG Monumentregistratie', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
          { source: 'Kadaster BRK', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'MEDIUM' },
        ],
        cached_at: recentTimestamp(15),
        age_seconds: 900,
      },
    ],
    completeness_score: 0.92,
    errors: [],
    resolved_at: recentTimestamp(0),
    ai_parsing: null,
  },

  /**
   * Parade 2, 5911CC Venlo — Café de Locomotief (geen monument)
   *
   * Verified sources:
   * - BAG WFS: pand 0983100000006069, bouwjaar 1899, 478m², bijeenkomstfunctie
   * - PDOK Locatieserver: perceel VLO00-I-617
   * - Currently operated as Café de Locomotief (est. 1983)
   */
  '5911CC|2': {
    address: {
      nummeraanduiding_id: '0983200000043920',
      verblijfsobject_id: '0983010000043920',
      straat: 'Parade',
      huisnummer: 2,
      huisletter: null,
      toevoeging: null,
      postcode: '5911CC',
      woonplaats: 'Venlo',
    },
    building: {
      pand_id: '0983100000006069',
      bouwjaar: 1899,
      status: 'Pand in gebruik',
      oppervlakte: 478,
      gebruiksdoel: ['bijeenkomstfunctie'],
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [6.17052678, 51.36987297],
          [6.17042899, 51.3698785],
          [6.17040857, 51.36986854],
          [6.17038201, 51.36976557],
          [6.17049188, 51.36976104],
          [6.17049564, 51.36977388],
          [6.17052678, 51.36987297],
        ]],
      },
    },
    cadastral_parcels: [
      {
        kadastrale_aanduiding: 'VLO00 I 617',
        perceelnummer: '617',
        sectie: 'I',
        oppervlakte: 145,
        geometry: null,
      },
    ],
    zoning: {
      plans: [
        {
          plan_id: 'NL.IMRO.0983.BP201227CENTRVENLO-VA02',
          plan_naam: 'Centrum Venlo',
          plan_type: 'bestemmingsplan',
          plan_status: 'vastgesteld',
          plan_datum: '2013-09-25',
          rules: [
            {
              bestemming: 'Centrum - 1',
              omschrijving: 'Detailhandel, horeca categorie 1 en 2, kantoren, dienstverlening en wonen op de verdiepingen',
              building_dimensions: {
                max_hoogte: 20,
                max_bebouwingspercentage: 90,
                max_floor_area_ratio: null,
                max_goothoogte: 16,
                max_bouwhoogte: 20,
              },
              geometry: null,
            },
          ],
        },
      ],
      primary_bestemming: 'Centrum - 1',
      building_dimensions: {
        max_hoogte: 20,
        max_bebouwingspercentage: 90,
        max_floor_area_ratio: null,
        max_goothoogte: 16,
        max_bouwhoogte: 20,
      },
      data_gaps: [],
      source: 'Ruimtelijkeplannen.nl API',
      fallback_used: false,
    },
    monuments: {
      sources: [
        {
          source: 'RCE Monumentenregister',
          is_monument: false,
          monument_type: null,
          monument_nummer: null,
          monument_naam: null,
          error: null,
        },
        {
          source: 'BAG Monumentregistratie',
          is_monument: false,
          monument_type: null,
          monument_nummer: null,
          monument_naam: null,
          error: null,
        },
        {
          source: 'Kadaster BRK',
          is_monument: false,
          monument_type: null,
          monument_nummer: null,
          monument_naam: null,
          error: null,
        },
      ],
      has_conflict: false,
      conflict_note: null,
      consensus_status: 'Geen monument',
      restrictions_summary: [],
      is_monument: false,
    },
    map_data: {
      center_rd: [209543.241, 375922.3],
      center_wgs84: [6.17048246, 51.36985066],
      property_geometry: {
        type: 'Polygon',
        coordinates: [[
          [6.17052678, 51.36987297],
          [6.17042899, 51.3698785],
          [6.17040857, 51.36986854],
          [6.17038201, 51.36976557],
          [6.17049188, 51.36976104],
          [6.17049564, 51.36977388],
          [6.17052678, 51.36987297],
        ]],
      },
      parcel_geometries: [],
      zoning_geometries: [],
    },
    data_sources: [
      { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
      { source: 'PDOK Locatieserver', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
      { source: 'PDOK Kadastrale Kaart', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'HIGH' },
      { source: 'RCE Monumentenregister', cached_at: recentTimestamp(15), age_seconds: 900, is_cached: true, confidence: 'HIGH' },
      { source: 'Ruimtelijkeplannen.nl', cached_at: recentTimestamp(12), age_seconds: 720, is_cached: true, confidence: 'HIGH' },
    ],
    section_sources: [
      {
        section: 'address',
        sources: [
          { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
          { source: 'PDOK Locatieserver', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(5),
        age_seconds: 300,
      },
      {
        section: 'building',
        sources: [
          { source: 'BAG API v2', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(5),
        age_seconds: 300,
      },
      {
        section: 'cadastral',
        sources: [
          { source: 'PDOK Kadastrale Kaart', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'HIGH' },
          { source: 'Kadaster BRK', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'MEDIUM' },
        ],
        cached_at: recentTimestamp(10),
        age_seconds: 600,
      },
      {
        section: 'zoning',
        sources: [
          { source: 'Ruimtelijkeplannen.nl', cached_at: recentTimestamp(12), age_seconds: 720, is_cached: true, confidence: 'HIGH' },
        ],
        cached_at: recentTimestamp(12),
        age_seconds: 720,
      },
      {
        section: 'monuments',
        sources: [
          { source: 'RCE Monumentenregister', cached_at: recentTimestamp(15), age_seconds: 900, is_cached: true, confidence: 'HIGH' },
          { source: 'BAG Monumentregistratie', cached_at: recentTimestamp(5), age_seconds: 300, is_cached: true, confidence: 'HIGH' },
          { source: 'Kadaster BRK', cached_at: recentTimestamp(10), age_seconds: 600, is_cached: true, confidence: 'MEDIUM' },
        ],
        cached_at: recentTimestamp(15),
        age_seconds: 900,
      },
    ],
    completeness_score: 0.93,
    errors: [],
    resolved_at: recentTimestamp(0),
    ai_parsing: null,
  },
}

/**
 * Look up demo property data by postcode + huisnummer
 * Returns null if address is not in demo dataset
 */
export function getDemoProperty(postcode: string, huisnummer: number): PropertyReportResponse | null {
  const key = `${postcode.replace(/\s/g, '')}|${huisnummer}`
  return DEMO_PROPERTIES[key] ?? null
}

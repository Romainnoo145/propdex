/**
 * Gemeente Intelligence — complete data model
 *
 * Covers ALL municipality-level data sources for the gemeente context panel
 * and drill-down modals. Sources range from fully integrated (CBS, jurisprudentie)
 * to placeholder (welstandsnota, parkeernormen).
 *
 * Each source has an `_integration` field indicating current status:
 *   - 'live'        — API integrated, data flowing
 *   - 'stub'        — Backend endpoint exists, returns mock/empty
 *   - 'placeholder'  — Frontend slot only, no backend yet
 *
 * This file is the single source of truth for gemeente-level intelligence types.
 */

// ---------------------------------------------------------------------------
// Integration status
// ---------------------------------------------------------------------------

export type IntegrationStatus = 'live' | 'stub' | 'placeholder'

// ---------------------------------------------------------------------------
// 1. CBS Demografie (LIVE — CBS OData v4, 100% dekking)
// ---------------------------------------------------------------------------

export interface CbsDemografie {
  _integration: 'live'
  inwoners: number | null
  woz_gemiddeld: number | null
  stedelijkheid: string | null // 'Zeer sterk stedelijk' → 'Niet stedelijk'
  leeftijdsverdeling: AgeDistribution | null
  inkomen: IncomeStats | null
  huishoudens: HouseholdStats | null
  criminaliteit: CrimeStats | null
  nabijheid: ProximityStats | null
}

export interface AgeDistribution {
  pct_0_14: number
  pct_15_24: number
  pct_25_44: number
  pct_45_64: number
  pct_65_plus: number
}

export interface IncomeStats {
  mediaan_inkomen: number | null
  pct_laag_inkomen: number | null
  pct_hoog_inkomen: number | null
}

export interface HouseholdStats {
  totaal: number | null
  pct_eenpersoons: number | null
  pct_gezin_met_kinderen: number | null
  pct_huurwoning: number | null
  pct_koopwoning: number | null
}

export interface CrimeStats {
  totaal_per_1000: number | null
  vermogen_per_1000: number | null
  vernieling_per_1000: number | null
}

export interface ProximityStats {
  afstand_supermarkt_km: number | null
  afstand_school_km: number | null
  afstand_huisarts_km: number | null
  afstand_station_km: number | null
}

// ---------------------------------------------------------------------------
// 2. Juridisch Klimaat (LIVE — Rechtspraak.nl, ~90% dekking)
// ---------------------------------------------------------------------------

export interface JuridischKlimaat {
  _integration: 'live'
  win_ratio: number | null // 0-1
  loss_ratio: number | null
  gem_doorlooptijd_dagen: number | null
  totaal_zaken: number | null
  recente_uitspraken: JurisprudentieItem[]
}

export interface JurisprudentieItem {
  id: string
  ecli: string
  datum: string // ISO 8601
  rechtsgrond: string | null
  uitkomst: 'gegrond' | 'ongegrond' | 'deels_gegrond' | 'niet_ontvankelijk' | null
  samenvatting: string | null
  url: string
}

// ---------------------------------------------------------------------------
// 3. Meldingen / Bekendmakingen (LIVE — SRU + monitoring)
// ---------------------------------------------------------------------------

export interface GemeenteMeldingen {
  _integration: 'live'
  totaal_recent: number // last 30 days
  ongelezen: number
  recente_meldingen: MeldingItem[]
}

export interface MeldingItem {
  id: string
  type: string
  titel: string
  datum: string
  adres: string | null
  gemeente_naam: string
  parcel_id: string | null
}

// ---------------------------------------------------------------------------
// 4. Raadsinformatie (STUB — Open Raadsinformatie ElasticSearch, 77% dekking)
//
// API: https://api.openraadsinformatie.nl/v1/elastic/
// Auth: none
// Filter: organization_name, keyword search, date range
// ---------------------------------------------------------------------------

export interface Raadsinformatie {
  _integration: 'stub'
  dekking: boolean // true als gemeente in ORI zit
  recente_stukken: Raadsstuk[]
  woningbouw_besluiten: Raadsstuk[] // pre-filtered op woningbouw keywords
}

export interface Raadsstuk {
  id: string
  titel: string
  type: RaadsstukType
  datum: string // ISO 8601
  status: 'aangenomen' | 'verworpen' | 'ingetrokken' | 'behandeld' | null
  onderwerp: string | null
  vergadering: string | null // meeting reference
  personen: string[] // proposing council members
  bron_url: string // link to original document
  samenvatting: string | null // AI-generated or OCR extract
  has_bijlagen: boolean
}

export type RaadsstukType =
  | 'motie'
  | 'amendement'
  | 'raadsbesluit'
  | 'raadsinformatiebrief'
  | 'collegebesluit'
  | 'agendapunt'
  | 'beleidsstuk'
  | 'overig'

// ---------------------------------------------------------------------------
// 5. Huisvestingsverordening (STUB — CVDR/lokaleregelgeving.overheid.nl, 100%)
//
// Source: https://lokaleregelgeving.overheid.nl/
// Contains splitsingsregels, kamerverhuur, urgentie
// Machine-readable: XML/HTML text search
// ---------------------------------------------------------------------------

export interface Huisvestingsverordening {
  _integration: 'stub'
  heeft_verordening: boolean | null
  splitsing: SplitsingsRegels | null
  kamerverhuur: KamerverhuurRegels | null
  bron_url: string | null // link to verordening on lokaleregelgeving
  laatst_bijgewerkt: string | null
}

export interface SplitsingsRegels {
  vergunning_nodig: boolean | null
  min_oppervlakte_m2: number | null // minimum per unit after split
  max_splits_per_pand: number | null
  voorwaarden: string[] // extracted conditions
}

export interface KamerverhuurRegels {
  vergunning_nodig: boolean | null
  max_kamers: number | null
  min_oppervlakte_kamer_m2: number | null
  quotum_van_toepassing: boolean | null
}

// ---------------------------------------------------------------------------
// 6. Subsidies (STUB — RVO API + CKAN + provincial registers)
//
// National: https://www.rvo.nl/api/v1/opendata/subsidies
// Provincial: https://subsidieregister.zuid-holland.nl/api/ (only ZH has REST)
// Municipal: data.overheid.nl CKAN per-gemeente datasets
// ---------------------------------------------------------------------------

export interface GemeenteSubsidies {
  _integration: 'stub'
  nationale_regelingen: Subsidie[] // SFT, Woningbouwimpuls, VHF, ISDE, etc.
  provinciale_regelingen: Subsidie[]
  gemeentelijke_regelingen: Subsidie[]
}

export interface Subsidie {
  id: string
  naam: string
  beschrijving: string | null
  categorie: SubsidieCategorie
  bedrag_min: number | null
  bedrag_max: number | null
  bedrag_per_eenheid: string | null // e.g. "€14.000 per woning"
  status: 'open' | 'gesloten' | 'binnenkort' | null
  deadline: string | null // ISO 8601
  looptijd: string | null // e.g. "2026-2027"
  doelgroep: string | null // e.g. "gemeenten", "woningcorporaties", "particulieren"
  scope: 'nationaal' | 'provinciaal' | 'gemeentelijk'
  url: string | null
}

export type SubsidieCategorie =
  | 'optoppen'
  | 'splitsen'
  | 'transformatie'
  | 'verduurzaming'
  | 'nieuwbouw'
  | 'sloop_nieuwbouw'
  | 'flexwoningen'
  | 'overig'

// ---------------------------------------------------------------------------
// 7. STTR Vergunningsplicht (STUB — DSO Toepasbare Regels API, ~60% dekking)
//
// API: https://service.omgevingswet.overheid.nl/publiek/toepasbare-regels/api/
// Auth: API key via DSO developer portal
// ---------------------------------------------------------------------------

export interface SttrVergunningsplicht {
  _integration: 'stub'
  gemeente_dekking: boolean // true als gemeente STTR heeft gepubliceerd
  activiteiten: SttrActiviteit[]
}

export interface SttrActiviteit {
  activiteit: string // e.g. "dakkapel plaatsen", "woning splitsen"
  vergunning_nodig: boolean | null
  melding_nodig: boolean | null
  informatieplicht: boolean | null
  voorwaarden: string[] // key conditions
  bron_url: string | null
}

// ---------------------------------------------------------------------------
// 8. Erfgoed & Beschermd Stadsgezicht (STUB — RCE WMS + gemeente registers)
//
// Rijksmonumenten: LIVE via rce_monuments.py (per parcel)
// Beschermd stadsgezicht: RCE WMS kaartlaag (nationwide)
// Gemeentelijk erfgoed: NO central API — per-gemeente scraping
// ---------------------------------------------------------------------------

export interface GemeenteErfgoed {
  _integration: 'stub'
  aantal_rijksmonumenten: number | null
  beschermd_stadsgezicht: BeschermdStadsgezicht[]
  gemeentelijke_monumenten: number | null // count if available
  erfgoedverordening_url: string | null
}

export interface BeschermdStadsgezicht {
  naam: string
  type: 'stadsgezicht' | 'dorpsgezicht'
  datum_aanwijzing: string | null
  oppervlakte_ha: number | null
}

// ---------------------------------------------------------------------------
// 9. Welstandsnota (PLACEHOLDER — ~20% gedigitaliseerd, geen API)
//
// Per gemeente PDF + interactive map
// Relevant: gebiedstype, welstandsniveau, architectonische criteria
// ---------------------------------------------------------------------------

export interface Welstandsnota {
  _integration: 'placeholder'
  beschikbaar: boolean | null
  welstandsniveau: WelstandsNiveau | null // gemeente-breed default
  bron_url: string | null // link to gemeente website/PDF
  laatst_bijgewerkt: string | null
}

export type WelstandsNiveau =
  | 'welstandsvrij'
  | 'licht'
  | 'regulier'
  | 'bijzonder'
  | 'beschermd'

// ---------------------------------------------------------------------------
// 10. Parkeernormen (PLACEHOLDER — geen API, CROW referentie + gemeente docs)
//
// CROW is de industry standard, maar geen open API
// Gemeenten publiceren Nota Parkeernormen op hun website
// ---------------------------------------------------------------------------

export interface Parkeernormen {
  _integration: 'placeholder'
  beschikbaar: boolean | null
  norm_per_woning: number | null // e.g. 1.5 parkeerplaatsen
  norm_per_kamer: number | null // for kamerverhuur
  zone: string | null // centrum/schil/buitengebied
  bron_url: string | null
}

// ---------------------------------------------------------------------------
// 11. Omgevingsvisie & Woonvisie (PLACEHOLDER — verplicht, maar alleen PDF)
//
// Strategische documenten over ontwikkelrichting gemeente
// Alle gemeenten moeten publiceren onder Omgevingswet
// ---------------------------------------------------------------------------

export interface OmgevingsvisieWoonvisie {
  _integration: 'placeholder'
  omgevingsvisie: VisieSamenvatting | null
  woonvisie: VisieSamenvatting | null
}

export interface VisieSamenvatting {
  titel: string
  datum: string | null
  samenvatting: string | null // AI-extracted from PDF
  woningbouw_doelstelling: number | null // target # woningen
  focus_gebieden: string[] // e.g. "Centrum", "Stationsgebied"
  prioriteiten: string[] // e.g. "verdichting", "betaalbaar", "duurzaam"
  bron_url: string | null
}

// ---------------------------------------------------------------------------
// 12. Verduurzamingsverplichtingen (PLACEHOLDER — versnipperd)
//
// National: energielabel C kantoren (mandatory since 2023)
// Municipal: varies per gemeente verordening
// ---------------------------------------------------------------------------

export interface Verduurzamingsverplichtingen {
  _integration: 'placeholder'
  energielabel_c_kantoren: boolean // altijd true (landelijk)
  gemeentelijke_verplichtingen: string[] // extracted from verordening
  subsidie_verduurzaming_beschikbaar: boolean | null
  bron_url: string | null
}

// ---------------------------------------------------------------------------
// MASTER TYPE — Complete gemeente intelligence profile
// ---------------------------------------------------------------------------

export interface GemeenteIntelligence {
  gemeente_code: string
  gemeente_naam: string
  laatst_bijgewerkt: string // ISO 8601

  // LIVE — already integrated
  cbs: CbsDemografie
  juridisch: JuridischKlimaat
  meldingen: GemeenteMeldingen

  // STUB — backend endpoint exists, integration in progress
  raadsinformatie: Raadsinformatie
  huisvestingsverordening: Huisvestingsverordening
  subsidies: GemeenteSubsidies
  sttr: SttrVergunningsplicht
  erfgoed: GemeenteErfgoed

  // PLACEHOLDER — frontend slot, no backend yet
  welstandsnota: Welstandsnota
  parkeernormen: Parkeernormen
  visie: OmgevingsvisieWoonvisie
  verduurzaming: Verduurzamingsverplichtingen
}

// ---------------------------------------------------------------------------
// Helper — check if a section has real data
// ---------------------------------------------------------------------------

export function hasData(section: { _integration: IntegrationStatus }): boolean {
  return section._integration === 'live'
}

export function isStub(section: { _integration: IntegrationStatus }): boolean {
  return section._integration === 'stub'
}

export function isPlaceholder(section: { _integration: IntegrationStatus }): boolean {
  return section._integration === 'placeholder'
}

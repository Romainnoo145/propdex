/**
 * Score weight types for per-org score customization
 *
 * Mirrors backend app/schemas/score_weights.py
 */

export interface ScoreWeightsConfig {
  preset: string
  potentie_risico_balance: number // 0.0-1.0
  potentie_weights: Record<string, number> // factor -> weight 0-10
  risico_weights: Record<string, number>
  score_threshold: number // 0-100, minimum score to show on map
}

export interface ScoreWeightsResponse {
  weights: ScoreWeightsConfig
  is_custom: boolean
  job_id: string | null
}

export interface SaveScoreWeightsRequest {
  preset: string
  potentie_risico_balance: number
  potentie_weights: Record<string, number>
  risico_weights: Record<string, number>
  score_threshold: number
}

export interface RescoreJobStatus {
  status: 'queued' | 'in_progress' | 'complete' | 'failed'
  processed: number
  up_count: number
  down_count: number
  unchanged_count: number
  avg_delta: number
}

// Factor metadata for UI display
export interface FactorMeta {
  key: string
  label: string
  description: string
  categorie: 'potentie' | 'risico'
}

// All potentie factors with Dutch labels
export const POTENTIE_FACTORS: FactorMeta[] = [
  {
    key: 'vrije_grond',
    label: 'Vrije grond',
    description: 'Onbebouwd perceeloppervlak',
    categorie: 'potentie',
  },
  {
    key: 'optoppotentie',
    label: 'Optoppotentie',
    description: 'Hoogteverschil tussen bestaand en maximaal',
    categorie: 'potentie',
  },
  {
    key: 'bestemming',
    label: 'Bestemming',
    description: 'Bestemmingsplan geschiktheid',
    categorie: 'potentie',
  },
  {
    key: 'leegstand',
    label: 'Leegstand',
    description: 'Leegstandsindicatie gebouw',
    categorie: 'potentie',
  },
  {
    key: 'funda_frictie',
    label: 'Funda frictie',
    description: 'Woningmarkt spanning in het gebied',
    categorie: 'potentie',
  },
  {
    key: 'perceelgrootte',
    label: 'Perceelgrootte',
    description: 'Schaalvoordeel bij grotere percelen',
    categorie: 'potentie',
  },
  {
    key: 'demografie',
    label: 'Demografie',
    description: 'Bevolkingsgroei en huishoudenssamenstelling',
    categorie: 'potentie',
  },
  {
    key: 'vergunning_succeskans',
    label: 'Vergunning succeskans',
    description: 'Historische vergunningsslaagkans in de wijk',
    categorie: 'potentie',
  },
]

// All risico factors with Dutch labels
export const RISICO_FACTORS: FactorMeta[] = [
  {
    key: 'funderingsrisico',
    label: 'Funderingsrisico',
    description: 'Houten palen risico bij oudere panden',
    categorie: 'risico',
  },
  {
    key: 'asbest',
    label: 'Asbest',
    description: 'Asbestverdachte materialen',
    categorie: 'risico',
  },
  {
    key: 'bodemverontreiniging',
    label: 'Bodemverontreiniging',
    description: 'Bekende bodemvervuiling',
    categorie: 'risico',
  },
  {
    key: 'monument',
    label: 'Monument',
    description: 'Monumentstatus beperkingen',
    categorie: 'risico',
  },
  {
    key: 'bestemmingswijziging',
    label: 'Bestemmingswijziging',
    description: 'Noodzaak tot bestemmingsplanwijziging',
    categorie: 'risico',
  },
  {
    key: 'constructieve_staat',
    label: 'Constructieve staat',
    description: 'Bouwkundige staat van het pand',
    categorie: 'risico',
  },
  {
    key: 'juridisch_klimaat',
    label: 'Juridisch klimaat',
    description: 'Bezwaarhistorie in de gemeente',
    categorie: 'risico',
  },
  {
    key: 'criminaliteit',
    label: 'Criminaliteit',
    description: 'Veiligheidscijfers wijk',
    categorie: 'risico',
  },
  {
    key: 'max_hoogte_bereikt',
    label: 'Max hoogte bereikt',
    description: 'Bouwhoogte limiet al benut',
    categorie: 'risico',
  },
  {
    key: 'natura2000',
    label: 'Natura2000',
    description: 'Nabijheid beschermd natuurgebied',
    categorie: 'risico',
  },
  {
    key: 'overstromingsrisico',
    label: 'Overstromingsrisico',
    description: 'Ligging in overstromingsgebied',
    categorie: 'risico',
  },
  {
    key: 'geluid',
    label: 'Geluid',
    description: 'Geluidbelasting op de locatie',
    categorie: 'risico',
  },
  {
    key: 'luchtkwaliteit',
    label: 'Luchtkwaliteit',
    description: 'NO2/PM10 concentraties',
    categorie: 'risico',
  },
]

// Default weights matching backend DEFAULT_WEIGHTS
export const DEFAULT_WEIGHTS: ScoreWeightsConfig = {
  preset: 'standaard',
  potentie_risico_balance: 0.7,
  score_threshold: 60,
  potentie_weights: {
    vrije_grond: 12,
    optoppotentie: 10,
    bestemming: 12,
    leegstand: 8,
    funda_frictie: 5,
    perceelgrootte: 12,
    demografie: 8,
    vergunning_succeskans: 13,
  },
  risico_weights: {
    funderingsrisico: 15,
    asbest: 6,
    bodemverontreiniging: 7,
    monument: 5,
    bestemmingswijziging: 8,
    constructieve_staat: 7,
    juridisch_klimaat: 8,
    criminaliteit: 6,
    max_hoogte_bereikt: 5,
    natura2000: 5,
    overstromingsrisico: 6,
    geluid: 5,
    luchtkwaliteit: 4,
  },
}

// Preset definitions
export interface PresetDef {
  id: string
  name: string
  description: string
  config: ScoreWeightsConfig
}

// prettier-ignore
export const PRESETS: PresetDef[] = [
  { id: 'standaard', name: 'Standaard', description: 'Gebalanceerde weging voor algemeen gebruik', config: DEFAULT_WEIGHTS },
  {
    id: 'snel_kansen', name: 'Snel kansen', description: 'Nadruk op ontwikkelkansen en vrije ruimte',
    config: {
      preset: 'snel_kansen', potentie_risico_balance: 0.85, score_threshold: 60,
      potentie_weights: { vrije_grond: 20, optoppotentie: 8, bestemming: 10, leegstand: 13, funda_frictie: 7, perceelgrootte: 16, demografie: 6, vergunning_succeskans: 10 },
      risico_weights: { funderingsrisico: 10, asbest: 4, bodemverontreiniging: 5, monument: 4, bestemmingswijziging: 6, constructieve_staat: 5, juridisch_klimaat: 6, criminaliteit: 4, max_hoogte_bereikt: 3, natura2000: 4, overstromingsrisico: 4, geluid: 3, luchtkwaliteit: 3 },
    },
  },
  {
    id: 'risico_averse', name: 'Risico-avers', description: 'Due diligence focus — risico zwaarder gewogen',
    config: {
      preset: 'risico_averse', potentie_risico_balance: 0.5, score_threshold: 60,
      potentie_weights: { vrije_grond: 10, optoppotentie: 8, bestemming: 10, leegstand: 6, funda_frictie: 4, perceelgrootte: 10, demografie: 6, vergunning_succeskans: 10 },
      risico_weights: { funderingsrisico: 21, asbest: 8, bodemverontreiniging: 11, monument: 6, bestemmingswijziging: 10, constructieve_staat: 9, juridisch_klimaat: 10, criminaliteit: 7, max_hoogte_bereikt: 6, natura2000: 9, overstromingsrisico: 8, geluid: 8, luchtkwaliteit: 6 },
    },
  },
  {
    id: 'stedelijke_transformatie', name: 'Stedelijke transformatie', description: 'Optimaal voor herontwikkeling in stedelijk gebied',
    config: {
      preset: 'stedelijke_transformatie', potentie_risico_balance: 0.65, score_threshold: 60,
      potentie_weights: { vrije_grond: 10, optoppotentie: 16, bestemming: 16, leegstand: 10, funda_frictie: 6, perceelgrootte: 10, demografie: 8, vergunning_succeskans: 18 },
      risico_weights: { funderingsrisico: 12, asbest: 6, bodemverontreiniging: 8, monument: 7, bestemmingswijziging: 10, constructieve_staat: 8, juridisch_klimaat: 9, criminaliteit: 5, max_hoogte_bereikt: 10, natura2000: 4, overstromingsrisico: 5, geluid: 5, luchtkwaliteit: 4 },
    },
  },
]

// ── Use-case scoring types ──────────────────────────────────────

export interface UseCaseScore {
  use_case: string
  label: string
  score: number
  category: 'Hoog' | 'Gemiddeld' | 'Laag'
  top_factors: string[]
  description: string
}

export type UseCaseScores = Record<'optoppen' | 'splitsen' | 'transformatie' | 'nieuwbouw', UseCaseScore>

/** Colors per use case for UI consistency */
export const USE_CASE_COLORS: Record<string, string> = {
  optoppen: '#8b5cf6',      // violet
  splitsen: '#0ea5e9',      // sky
  transformatie: '#f59e0b',  // amber
  nieuwbouw: '#22c55e',     // green
}

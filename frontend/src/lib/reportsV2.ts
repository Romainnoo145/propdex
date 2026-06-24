import { apiFetch } from '@/lib/api'

export interface PerceelFeiten {
  parcel_id: string
  adres: string | null
  gemeente_code: string | null
  buurt_code: string | null
  oppervlakte_m2: number | null
  bouwjaar: number | null
  bestemmingen: string[]
}

export interface BeleidBlok {
  vergunningplichten: string[]
  samenvatting: string
  randvoorwaarden: string[]
  bron_geldig_van: string | null
  bron_geldig_tot: string | null
  confidence: number
}

export interface JurisprudentieCase {
  ecli: string
  verbouwingstype: string
  gemeente_code: string | null
  instantie: string
  datum: string
  themas: string[]
  uitkomst: 'toegekend' | 'geweigerd' | 'vernietigd' | 'gemengd'
  duiding: string
  bron_url: string
}

export interface SplitsingReport {
  perceel: PerceelFeiten
  beleid: BeleidBlok | null
  jurisprudentie: JurisprudentieCase[]
  aandachtspunten: string[]
  aanvraag_url: string
  disclaimers: string[]
}

export async function fetchSplitsingReport(
  parcelId: string,
  accessToken: string | null,
): Promise<SplitsingReport> {
  return apiFetch<SplitsingReport>(`/api/reports-v2/splitsing/${parcelId}`, {
    method: 'GET',
    accessToken,
  })
}

export interface VergunningOordeel {
  achterdakvlak: string
  voor_zijdakvlak: string
  bepalende_factoren: string[]
}

export interface WelstandBlok {
  samenvatting: string
  beschermd_gezicht: boolean
  bron_geldig_van: string | null
  bron_geldig_tot: string | null
  confidence: number
}

export interface DakkapelReport {
  perceel: PerceelFeiten
  oordeel: VergunningOordeel
  welstand: WelstandBlok | null
  jurisprudentie: JurisprudentieCase[]
  onzekerheden: string[]
  bronnen: string[]
  geldigheidsdatum: string
  aanvraag_url: string
  disclaimers: string[]
}

export async function fetchDakkapelReport(
  parcelId: string,
  accessToken: string | null,
): Promise<DakkapelReport> {
  return apiFetch<DakkapelReport>(`/api/reports-v2/dakkapel/${parcelId}`, {
    method: 'GET',
    accessToken,
  })
}

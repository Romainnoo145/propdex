/**
 * mapBrkError — centralised mapping of BRK persist/read HTTP errors to
 * Dutch user-facing copy.
 *
 * Source-of-truth: M050/S06 ENG-PLAN §"Backend-error-mapping" failure registry.
 * The backend raises 6 typed Python exceptions and ApiError carries the HTTP
 * status; this util is the SINGLE place where status → user copy translation
 * lives. Consumers (BrkPersistPanel + ContactPhaseView in Plan 08-03) read
 * { title, body, retryable } and never branch on raw status themselves.
 *
 * | status | exception              | retryable |
 * |--------|------------------------|-----------|
 * | 401    | unauth                 | n/a (axios interceptor redirects)
 * | 403    | CrossOrgParcelAccess   | no  (masked as 404 copy — no existence leak)
 * | 404    | ParcelNotFound         | no
 * | 422    | ValidationError        | no
 * | 502    | GovernmentAPIError     | yes (Kadaster upstream transient)
 * | 503    | FeatureDisabled        | no  (DPA in afhandeling)
 * | 503    | CredentialNotConfigured| no  (admin must configure)
 *
 * 503 disambiguation: backend uses the same status for both 503 variants;
 * we inspect the `detail` substring per ENG-PLAN guidance.
 */

export interface BrkErrorView {
  title: string
  body: string
  retryable: boolean
}

const FALLBACK: BrkErrorView = {
  title: 'Verbinding verloren — probeer opnieuw',
  body: 'Er ging iets mis met het ophalen van Kadaster-data. Probeer het zo opnieuw.',
  retryable: true,
}

export function mapBrkError(
  status: number | undefined,
  detail?: string | null,
): BrkErrorView {
  // Auth: redirect handled by axios/apiFetch interceptor (token refresh).
  // Consumers shouldn't see 401 here, but be defensive.
  if (status === 401) {
    return {
      title: 'Sessie verlopen',
      body: 'Log opnieuw in om Kadaster-data op te halen.',
      retryable: false,
    }
  }

  // 403 + 404 both render as "not in portfolio" to avoid existence leak.
  if (status === 403 || status === 404) {
    return {
      title: 'Perceel niet in jouw portfolio',
      body: 'Dit perceel staat niet in jouw opgeslagen percelen, of is verwijderd.',
      retryable: false,
    }
  }

  if (status === 422) {
    return {
      title: 'Ongeldige perceel-identificatie',
      body: 'De perceel-identificatie kon niet worden gevalideerd. Controleer de URL.',
      retryable: false,
    }
  }

  if (status === 502) {
    return {
      title: 'Kadaster tijdelijk niet beschikbaar',
      body: 'De Kadaster-service reageert niet. Probeer het over enkele minuten opnieuw.',
      retryable: true,
    }
  }

  if (status === 503) {
    // Disambiguate via detail substring per ENG-PLAN §Backend-error-mapping.
    const lower = (detail ?? '').toLowerCase()
    if (lower.includes('credential')) {
      return {
        title: 'Kadaster credential ontbreekt — admin configureren',
        body: 'Vraag een beheerder om de Kadaster BRK Bevragen credential te configureren.',
        retryable: false,
      }
    }
    return {
      title: 'BRK is nog niet beschikbaar (DPA in afhandeling)',
      body: 'BRK eigendomsdata staat tijdelijk uit. We zetten dit aan zodra de DPA met Kadaster rond is.',
      retryable: false,
    }
  }

  return FALLBACK
}

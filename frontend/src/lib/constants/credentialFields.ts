/**
 * Manual TS mirror of backend/app/services/credential_fields.py
 * CREDENTIAL_FIELDS registry. Eng-review locked 2026-05-16.
 *
 * Update both files in lockstep. Backend validates POST input against
 * this registry, so frontend MUST not render fields not in the Python
 * dict — otherwise users see 422s.
 */
import type { CredentialField } from '@/lib/types/integration-credentials'

export const CREDENTIAL_FIELDS: Record<string, CredentialField[]> = {
  brk: [
    { name: 'api_key', label: 'API Key', input_type: 'password' },
    {
      name: 'client_cert',
      label: 'Client Certificate (PEM)',
      input_type: 'textarea',
    },
  ],
  vindsubsidies: [
    { name: 'api_key', label: 'API Key', input_type: 'password' },
    { name: 'endpoint_url', label: 'Endpoint URL', input_type: 'url' },
  ],
  nvm: [
    { name: 'client_secret', label: 'Client Secret', input_type: 'password' },
    { name: 'endpoint_url', label: 'Endpoint URL', input_type: 'url' },
  ],
}

export const TYPE_C_SOURCE_KEYS = Object.keys(CREDENTIAL_FIELDS) as Array<
  keyof typeof CREDENTIAL_FIELDS
>

/**
 * Catalog row source_keys (long kebab-case) → credential provider (short).
 * Backend mirror: `SOURCE_KEY_TO_PROVIDER` in
 * backend/app/services/credential_fields.py. Keep both in lockstep.
 */
export const SOURCE_KEY_TO_PROVIDER: Record<string, string> = {
  'brk-eigendom': 'brk',
  'brk-hypotheken': 'brk',
  'brk-beslagen': 'brk',
  'nvm-transactiedata': 'nvm',
  'vindsubsidies-database': 'vindsubsidies',
}

export function providerFor(sourceKey: string): string {
  return SOURCE_KEY_TO_PROVIDER[sourceKey] ?? sourceKey
}

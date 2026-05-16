/**
 * TS-mirror of backend admin/integration_credentials_schemas.py.
 * Manual twin — keep field names + casing in sync with the Pydantic models.
 *
 * Backend source of truth:
 *   backend/app/admin/integration_credentials_schemas.py
 *   backend/app/services/credential_fields.py
 *
 * NEVER add the ciphertext or plaintext fields to CredentialEntryRead — that
 * shape defends TEST-03c regression (GET response must never leak secrets).
 */

export interface CredentialEntryRead {
  id: string
  source_key: string
  credential_name: string
  configured: boolean
  configured_at: string | null
  last_rotated_at: string | null
}

export interface CredentialCreate {
  source_key: string
  credential_name: string
  value: string
}

export type CredentialInputType = 'password' | 'textarea' | 'url' | 'text'

export interface CredentialField {
  name: string
  label: string
  input_type: CredentialInputType
}

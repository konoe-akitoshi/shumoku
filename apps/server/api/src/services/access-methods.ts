// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Access methods — the ways Shumoku can reach a device to read it directly.
 *
 * A method is data: an id, a label, and the fields its credential
 * takes. The credential table stores those fields as JSON, and the UI draws its
 * form from this list, so adding a method (SSH, an HTTP API) is one entry here
 * plus a reader — no schema change and no per-method branch in the API or the
 * web app.
 */

export interface AccessField {
  key: string
  label: string
  /** A secret is never returned by the API; it can only be written. */
  secret: boolean
  required: boolean
  placeholder?: string
}

export interface AccessMethod {
  id: string
  label: string
  fields: AccessField[]
}

export const ACCESS_METHODS: AccessMethod[] = [
  {
    id: 'snmp',
    label: 'SNMP',
    fields: [
      {
        key: 'community',
        label: 'Community',
        secret: true,
        required: true,
        placeholder: 'SNMP v2c community',
      },
    ],
  },
]

export function getAccessMethod(id: string): AccessMethod | undefined {
  return ACCESS_METHODS.find((m) => m.id === id)
}

export type CredentialParams = Record<string, string>

/**
 * Check a credential's parameters against its method. `current` is the stored
 * value on an update: an omitted or empty field then keeps what is stored, so
 * a secret never has to be sent back to be preserved.
 */
export function normalizeParams(
  method: AccessMethod,
  input: Readonly<Record<string, unknown>> | undefined,
  current?: Readonly<CredentialParams>,
): { params: CredentialParams } | { error: string } {
  const params: CredentialParams = {}
  for (const field of method.fields) {
    const raw = input?.[field.key]
    if (raw !== undefined && typeof raw !== 'string') {
      return { error: `${field.label} must be a string` }
    }
    const value = typeof raw === 'string' ? raw.trim() : ''
    const kept = value !== '' ? value : (current?.[field.key] ?? '')
    if (field.required && kept === '') return { error: `${field.label} is required` }
    if (kept !== '') params[field.key] = kept
  }
  return { params }
}

/**
 * Split full parameters into the non-secret part and the secret part, by the
 * method's `secret` flags. They are stored in separate columns so that a
 * listing never has to read a secret.
 */
export function splitParams(
  method: AccessMethod,
  params: Readonly<CredentialParams>,
): { params: CredentialParams; secret: CredentialParams } {
  const secretKeys = new Set(method.fields.filter((f) => f.secret).map((f) => f.key))
  const open: CredentialParams = {}
  const secret: CredentialParams = {}
  for (const [key, value] of Object.entries(params)) {
    if (secretKeys.has(key)) secret[key] = value
    else open[key] = value
  }
  return { params: open, secret }
}

/** Whether two full parameter sets say the same thing for this method. */
export function sameParams(
  method: AccessMethod,
  a: Readonly<CredentialParams>,
  b: Readonly<CredentialParams>,
): boolean {
  return method.fields.every((f) => (a[f.key] ?? '') === (b[f.key] ?? ''))
}

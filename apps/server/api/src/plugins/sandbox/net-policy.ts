// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Network egress policy for a sandboxed plugin instance. The host derives it
 * from the data source's own config — a plugin may only reach the endpoints
 * its operator typed into `format: 'uri'` fields.
 */
export interface NetPolicy {
  readonly allowedOrigins: readonly string[]
}

type SchemaNode = { format?: unknown; properties?: Record<string, SchemaNode> }

export function buildNetPolicy(configSchema: unknown, config: unknown): NetPolicy {
  return { allowedOrigins: collectUriOrigins(configSchema as SchemaNode | undefined, config, []) }
}

function collectUriOrigins(
  schema: SchemaNode | undefined,
  values: unknown,
  path: readonly string[],
): string[] {
  const properties = schema?.properties ?? {}
  const record = (values ?? {}) as Record<string, unknown>
  return Object.entries(properties).flatMap(([key, field]) => {
    const value = record[key]
    const fieldPath = [...path, key]
    // '' is an optional field left blank (the Web UI saves a cleared text field as '').
    const own =
      field.format === 'uri' && typeof value === 'string' && value !== ''
        ? [originOf(fieldPath, value)]
        : []
    const nested = field.properties ? collectUriOrigins(field, value, fieldPath) : []
    return [...own, ...nested]
  })
}

function originOf(fieldPath: readonly string[], value: string): string {
  if (!URL.canParse(value)) {
    throw new Error(`Config field "${fieldPath.join('.')}" is not a valid URL: ${value}`)
  }
  return new URL(value).origin
}

const ALLOWED_PROTOCOLS: readonly string[] = ['http:', 'https:']

/** Whether `url`'s origin (scheme + host + port) exactly matches one the policy allows. */
export function isOriginAllowed(policy: NetPolicy, url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return false
    return policy.allowedOrigins.includes(parsed.origin)
  } catch {
    return false
  }
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { PluginConfigProperty, PluginConfigSchema } from '../plugin-types.js'

/**
 * Pure validation of a plugin config / options object against its schema.
 *
 * Lives in core (not the server) so the API, the web form, and external
 * plugins all validate through *one* implementation —描画・検証・実行 derive
 * from a single schema. The server returns 400 on `{ ok: false }`; the web
 * form renders the same errors client-side.
 *
 * Semantics:
 * - Unknown keys are ignored (open config — `config_json` may carry extras
 *   or host-injected, `serverSupplied` values).
 * - A field whose `visibleWhen` is not satisfied is "not applicable": it is
 *   neither required nor type-checked (a hidden field can't be filled in).
 * - "Provided" means non-null and non-empty (`''` / `[]` / `{}` are absent),
 *   matching the merge model's `hasValue`.
 */

export interface SchemaError {
  /** Dotted path to the offending field (e.g. `customMetrics.inOctets`). */
  path: string
  message: string
}

export type ValidationResult = { ok: true } | { ok: false; errors: SchemaError[] }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Non-null and non-empty, mirroring the resolver's `hasValue`. */
function hasValue(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.length > 0
  if (Array.isArray(v)) return v.length > 0
  if (isPlainObject(v)) return Object.keys(v).length > 0
  return true
}

type Condition = { field: string; equals: string | number | boolean }

/** A `visibleWhen`-style gate: absent gate ⇒ always on. */
function gateOpen(gate: Condition | undefined, siblings: Record<string, unknown>): boolean {
  if (!gate) return true
  return siblings[gate.field] === gate.equals
}

/** A `requiredWhen`-style trigger: absent trigger ⇒ never forces required. */
function triggerFires(trigger: Condition | undefined, siblings: Record<string, unknown>): boolean {
  if (!trigger) return false
  return siblings[trigger.field] === trigger.equals
}

export function validateAgainstSchema(
  schema: PluginConfigSchema,
  value: unknown,
): ValidationResult {
  const errors: SchemaError[] = []
  validateObject(schema, value, '', errors)
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

function validateObject(
  schema: PluginConfigSchema,
  value: unknown,
  base: string,
  errors: SchemaError[],
): void {
  if (!isPlainObject(value)) {
    errors.push({ path: base || '(root)', message: 'expected an object' })
    return
  }
  const required = new Set(schema.required ?? [])
  for (const [key, prop] of Object.entries(schema.properties)) {
    const path = base ? `${base}.${key}` : key
    // Field hidden by its visibleWhen → not applicable; skip entirely.
    if (!gateOpen(prop.visibleWhen, value)) continue
    if (!hasValue(value[key])) {
      if (required.has(key) || triggerFires(prop.requiredWhen, value)) {
        errors.push({ path, message: 'is required' })
      }
      continue
    }
    validateProperty(prop, value[key], path, errors)
  }
}

function validateProperty(
  prop: PluginConfigProperty,
  val: unknown,
  path: string,
  errors: SchemaError[],
): void {
  switch (prop.type) {
    case 'string': {
      if (typeof val !== 'string') {
        errors.push({ path, message: 'expected a string' })
        return
      }
      if (prop.format === 'uri' && !/^https?:\/\//i.test(val)) {
        errors.push({ path, message: 'must be an http(s) URL' })
      }
      if (prop.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errors.push({ path, message: 'must be an email address' })
      }
      checkChoice(prop, val, path, errors)
      break
    }
    case 'number': {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        errors.push({ path, message: 'expected a number' })
        return
      }
      if (prop.minimum != null && val < prop.minimum) {
        errors.push({ path, message: `must be ≥ ${prop.minimum}` })
      }
      if (prop.maximum != null && val > prop.maximum) {
        errors.push({ path, message: `must be ≤ ${prop.maximum}` })
      }
      checkChoice(prop, val, path, errors)
      break
    }
    case 'boolean': {
      if (typeof val !== 'boolean') errors.push({ path, message: 'expected a boolean' })
      break
    }
    case 'array': {
      if (!Array.isArray(val)) {
        errors.push({ path, message: 'expected an array' })
        return
      }
      const itemType = prop.items?.type ?? 'string'
      for (const [i, item] of val.entries()) {
        if (typeof item !== itemType) {
          errors.push({ path: `${path}[${i}]`, message: `expected ${itemType}` })
        }
      }
      break
    }
    case 'object': {
      if (prop.properties) {
        validateObject(
          { type: 'object', required: prop.required, properties: prop.properties },
          val,
          path,
          errors,
        )
      } else if (!isPlainObject(val)) {
        errors.push({ path, message: 'expected an object' })
      }
      break
    }
  }
}

function checkChoice(
  prop: PluginConfigProperty,
  val: string | number,
  path: string,
  errors: SchemaError[],
): void {
  const allowed = prop.oneOf ? prop.oneOf.map((o) => o.const) : prop.enum
  if (allowed && !allowed.includes(val)) {
    errors.push({ path, message: `must be one of: ${allowed.join(', ')}` })
  }
}

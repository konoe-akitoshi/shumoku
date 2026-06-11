// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { pluginRegistry } from './registry.js'

/**
 * Parse a topology source's stored `optionsJson` for a sync call, dropping any
 * field the plugin's options schema marks as a scope dimension (`prop.scope`).
 *
 * Scope moved to the topology level (`topology_scope_criteria`, enforced
 * post-merge by `resolve()`). A scope value left behind in per-source options
 * would silently pre-filter the observation at fetch time — the topology Scope
 * UI then looks like a no-op because the narrowing already happened upstream,
 * and clearing the Scope can't widen a snapshot that was never observed.
 * Schema-driven: no per-plugin branches.
 */
export function parseSyncOptions(
  pluginType: string,
  optionsJson?: string | null,
): Record<string, unknown> | undefined {
  if (!optionsJson) return undefined
  let opts: Record<string, unknown>
  try {
    opts = JSON.parse(optionsJson) as Record<string, unknown>
  } catch {
    return undefined
  }
  const schema = pluginRegistry.getInfo(pluginType)?.optionsSchema
  if (!schema) return opts
  const out = { ...opts }
  for (const [name, prop] of Object.entries(schema.properties)) {
    if (prop.scope && name in out) delete out[name]
  }
  return out
}

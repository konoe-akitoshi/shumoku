// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { DiscoveredMetric } from '../plugin-types.js'

/**
 * Flatten an arbitrary upstream record into `DiscoveredMetric[]` for the
 * plugin "All metrics" passthrough panel.
 *
 * This is the generic dumper every `HostsCapable` plugin should use instead
 * of hand-enumerating fields (which is how zabbix ended up coercing every
 * value to a number and dropping categorical attributes). Walk the object:
 * - object children join into the metric name with `_`
 *   (`{ a: { b: 1 } }` with prefix `p` → `p_a_b`),
 * - array-of-primitives emits a `<name>_count`,
 * - array-of-objects emits a `<name>_count` then expands each element with a
 *   `<key>_index` label,
 * - null / undefined / empty-string / non-finite leaves are skipped as noise.
 *
 * Lifted verbatim (behavior-preserving) from the aruba-instant-on plugin,
 * which had the only correct generic implementation.
 */
export function flattenObject(
  obj: unknown,
  prefix: string,
  labels: Record<string, string> = {},
): DiscoveredMetric[] {
  if (obj == null || typeof obj !== 'object') return []
  const out: DiscoveredMetric[] = []
  for (const [key, value] of Object.entries(obj)) {
    const name = `${prefix}_${key}`
    if (value == null) continue
    if (Array.isArray(value)) {
      // Array of primitives → emit count only. Array of objects → count plus
      // one expansion per element, index pinned to a label.
      if (value.every((v) => typeof v !== 'object' || v === null)) {
        out.push({ name: `${name}_count`, value: value.length, labels })
        continue
      }
      out.push({ name: `${name}_count`, value: value.length, labels })
      for (const [i, child] of value.entries()) {
        out.push(...flattenObject(child, name, { ...labels, [`${key}_index`]: String(i) }))
      }
      continue
    }
    if (typeof value === 'object') {
      out.push(...flattenObject(value, name, labels))
      continue
    }
    if (typeof value === 'string' && value.length === 0) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    out.push({ name, value: value as number | string | boolean, labels })
  }
  return out
}

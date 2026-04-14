// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NodeSpec } from '@shumoku/core'
import type { CatalogEntry } from './types.js'

/**
 * Device and service catalog.
 *
 * Supports:
 * - Registration and lookup by ID
 * - Property inheritance via `extends`
 * - Search by query string, kind, vendor, or tag
 */
export class Catalog {
  private entries = new Map<string, CatalogEntry>()
  /** Reverse index: "vendor/model" → entry ID (for shorthand lookup) */
  private byVendorModel = new Map<string, string>()

  /** Register a catalog entry. */
  register(entry: CatalogEntry): void {
    this.entries.set(entry.id, entry)
    // Build reverse index from vendor+model for shorthand lookup
    const spec = entry.spec
    if (spec.kind === 'hardware' || spec.kind === 'compute') {
      const model = 'model' in spec ? spec.model : 'platform' in spec ? spec.platform : undefined
      if (spec.vendor && model) {
        this.byVendorModel.set(`${spec.vendor}/${model}`, entry.id)
      }
    }
  }

  /** Register multiple entries at once. */
  registerAll(entries: CatalogEntry[]): void {
    for (const entry of entries) {
      this.register(entry)
    }
  }

  /** Look up by ID or vendor/model shorthand, resolving `extends` inheritance. */
  lookup(id: string): CatalogEntry | undefined {
    let entry = this.entries.get(id)
    // Fallback: try vendor/model reverse index (handles 3-level IDs like cisco/catalyst-3560cx/ws-...)
    if (!entry) {
      const fullId = this.byVendorModel.get(id)
      if (fullId) entry = this.entries.get(fullId)
    }
    if (!entry) return undefined
    if (!entry.extends) return entry
    return this.resolve(entry)
  }

  /** Get raw entry without inheritance resolution. */
  getRaw(id: string): CatalogEntry | undefined {
    return this.entries.get(id)
  }

  /** List all entries. */
  list(): CatalogEntry[] {
    return [...this.entries.values()]
  }

  /** Filter entries by kind. */
  listByKind(kind: NodeSpec['kind']): CatalogEntry[] {
    return this.list().filter((e) => e.spec.kind === kind)
  }

  /** Filter entries by vendor. */
  listByVendor(vendor: string): CatalogEntry[] {
    const v = vendor.toLowerCase()
    return this.list().filter((e) => e.spec.vendor?.toLowerCase() === v)
  }

  /** Filter entries that have a specific tag. */
  listByTag(tag: string): CatalogEntry[] {
    const t = tag.toLowerCase()
    return this.list().filter((e) => e.tags.some((et) => et.toLowerCase() === t))
  }

  /** Search entries by query string (matches id, label, tags, vendor). */
  search(query: string): CatalogEntry[] {
    const q = query.toLowerCase()
    return this.list().filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        (e.spec.vendor?.toLowerCase().includes(q) ?? false),
    )
  }

  /** Number of registered entries. */
  get size(): number {
    return this.entries.size
  }

  /**
   * Resolve an entry by merging parent properties via `extends` chain.
   * Protects against circular references.
   */
  private resolve(entry: CatalogEntry): CatalogEntry {
    const chain: CatalogEntry[] = [entry]
    const visited = new Set<string>([entry.id])

    let current = entry
    while (current.extends) {
      if (visited.has(current.extends)) break // circular guard
      const parent = this.entries.get(current.extends)
      if (!parent) break
      visited.add(current.extends)
      chain.push(parent)
      current = parent
    }

    // Merge from root to leaf (parent first, child overrides)
    chain.reverse()
    let merged = chain[0] as CatalogEntry
    for (const item of chain.slice(1)) {
      merged = mergeEntries(merged, item)
    }
    return merged
  }
}

/** Deep merge two catalog entries (parent + child). Child wins on conflict. */
function mergeEntries(parent: CatalogEntry, child: CatalogEntry): CatalogEntry {
  return {
    id: child.id,
    label: child.label,
    spec: child.spec.kind === parent.spec.kind ? { ...parent.spec, ...child.spec } : child.spec,
    extends: child.extends,
    tags: [...new Set([...parent.tags, ...child.tags])],
    properties: deepMerge(parent.properties, child.properties),
  }
}

/** Recursive shallow merge for plain objects. Arrays are replaced, not merged. */
// biome-ignore lint/suspicious/noExplicitAny: recursive merge over unknown shapes
function deepMerge(a: any, b: any): any {
  if (b === undefined || b === null) return a
  if (a === undefined || a === null) return b
  if (typeof a !== 'object' || typeof b !== 'object') return b
  if (Array.isArray(a) || Array.isArray(b)) return b

  const result = { ...a }
  for (const key of Object.keys(b)) {
    result[key] = deepMerge(a[key], b[key])
  }
  return result
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * YAML catalog loader — reads .yaml files from a directory tree
 * and converts them into CatalogEntry objects.
 */

import yaml from 'js-yaml'
import type { CatalogEntry } from './types.js'

/**
 * Parse a single YAML string into a CatalogEntry.
 * Performs minimal validation (id and spec.kind are required).
 */
export function parseCatalogYaml(content: string): CatalogEntry {
  // biome-ignore lint/suspicious/noExplicitAny: YAML parse returns unknown shape
  const raw = yaml.load(content) as any
  if (!raw?.id) throw new Error('Catalog entry missing "id"')
  if (!raw?.spec?.kind) throw new Error(`Catalog entry "${raw.id}" missing "spec.kind"`)

  return {
    id: raw.id,
    label: raw.label ?? raw.id,
    spec: raw.spec,
    extends: raw.extends,
    tags: raw.tags ?? [],
    properties: raw.properties ?? {},
  }
}

/**
 * Parse multiple YAML documents (separated by ---) from a single string.
 */
export function parseCatalogYamlMulti(content: string): CatalogEntry[] {
  // biome-ignore lint/suspicious/noExplicitAny: YAML parse returns unknown shape
  const docs = yaml.loadAll(content) as any[]
  return docs.filter(Boolean).map((raw) => {
    if (!raw?.id) throw new Error('Catalog entry missing "id"')
    if (!raw?.spec?.kind) throw new Error(`Catalog entry "${raw.id}" missing "spec.kind"`)
    return {
      id: raw.id,
      label: raw.label ?? raw.id,
      spec: raw.spec,
      extends: raw.extends,
      tags: raw.tags ?? [],
      properties: raw.properties ?? {},
    }
  })
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from './index.js'
import type { Structure } from './types.js'

/** Reads written YAML and derives its structure. For tests and scripts. */
export function structureOfYaml(text: string): Structure {
  return deriveStructure(readNetworkModel(text).config)
}

/**
 * A network of nodes and plain links from `a-b b-c`, with the rest of the YAML (groups, node
 * fields, redundancy, segments) written by the caller. Nodes named in the links or in `alone`
 * are written; `place` puts nodes in groups.
 */
export function plainNetwork(opts: {
  links: string
  alone?: string
  place?: Record<string, string>
  nodeFields?: Record<string, string>
  rest?: string
}): string {
  const ids = new Set<string>(opts.alone?.split(/\s+/).filter(Boolean))
  const links: string[] = []
  for (const pair of opts.links.split(/\s+/).filter(Boolean)) {
    const [a, b] = pair.split('-')
    if (a === undefined || b === undefined) throw new Error(`bad link ${pair}`)
    ids.add(a)
    ids.add(b)
    links.push(`  - endpoints: [{ node: ${a} }, { node: ${b} }]`)
  }
  const nodes = [...ids].map((id) => {
    const fields = [`id: ${id}`]
    const group = opts.place?.[id]
    if (group) fields.push(`group: ${group}`)
    const extra = opts.nodeFields?.[id]
    if (extra) fields.push(extra)
    return `  - { ${fields.join(', ')} }`
  })
  return `${opts.rest ?? ''}\nnodes:\n${nodes.join('\n')}\nlinks:\n${links.join('\n') || '  []'}\n`
}

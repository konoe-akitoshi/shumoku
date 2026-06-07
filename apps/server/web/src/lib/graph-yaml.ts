// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Best-effort `NetworkGraph` → YAML serializer for the text editor's YAML tab.
 * Walks the graph's top-level shape; anything not enumerated here round-trips
 * through the JSON tab instead. Parsing back is `YamlParser` from `@shumoku/core`.
 */
export function graphToYaml(graph: Record<string, unknown>): string {
  const lines: string[] = []
  if (graph['name']) lines.push(`name: ${graph['name']}`)
  if (graph['version']) lines.push(`version: "${graph['version']}"`)
  if (graph['description']) lines.push(`description: ${graph['description']}`)
  lines.push('')
  lines.push('nodes:')
  const nodes = (graph['nodes'] as Array<Record<string, unknown>>) || []
  for (const node of nodes) {
    lines.push(`  - id: ${node['id']}`)
    if (node['label']) lines.push(`    label: ${node['label']}`)
    if (node['type']) lines.push(`    type: ${node['type']}`)
    if (node['vendor']) lines.push(`    vendor: ${node['vendor']}`)
    if (node['model']) lines.push(`    model: ${node['model']}`)
    if (node['parent']) lines.push(`    parent: ${node['parent']}`)
  }
  lines.push('')
  lines.push('links:')
  const links = (graph['links'] as Array<Record<string, unknown>>) || []
  for (const link of links) {
    const from = link['from'] as string | { node: string; port?: string }
    const to = link['to'] as string | { node: string; port?: string }
    if (typeof from === 'string') lines.push(`  - from: ${from}`)
    else {
      lines.push(`  - from:`)
      lines.push(`      node: ${from.node}`)
      if (from.port) lines.push(`      port: ${from.port}`)
    }
    if (typeof to === 'string') lines.push(`    to: ${to}`)
    else {
      lines.push(`    to:`)
      lines.push(`      node: ${to.node}`)
      if (to.port) lines.push(`      port: ${to.port}`)
    }
    if (link['bandwidth']) lines.push(`    bandwidth: ${link['bandwidth']}`)
  }
  const subgraphs = graph['subgraphs'] as Array<Record<string, unknown>> | undefined
  if (subgraphs && subgraphs.length > 0) {
    lines.push('')
    lines.push('subgraphs:')
    for (const sg of subgraphs) {
      lines.push(`  - id: ${sg['id']}`)
      if (sg['label']) lines.push(`    label: ${sg['label']}`)
      if (sg['parent']) lines.push(`    parent: ${sg['parent']}`)
    }
  }
  return lines.join('\n')
}

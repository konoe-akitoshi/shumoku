// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * NetworkGraph → authoring YAML, the inverse of `YamlParser.parse()`.
 */

import yaml from 'js-yaml'
import type { NetworkGraph, Node, NodeSpec, Subgraph } from '../models/types.js'

/**
 * Drop `undefined`-valued keys so the dump doesn't emit `key: null` for every
 * optional field the model leaves unset. Arrays and plain objects are walked;
 * everything else passes through untouched.
 */
function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => pruneUndefined(v)) as unknown as T
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue
    out[key] = pruneUndefined(v)
  }
  return out as T
}

/**
 * `Node.spec` / `Subgraph.spec` back to the FLAT keys the parser reads.
 *
 * The parser builds `spec` from top-level `type` / `vendor` / `model` /
 * `service` / `resource` / `icon` (see `buildNodeSpec`); a nested `spec:` block
 * in YAML is ignored. Emitting the model shape verbatim would therefore drop
 * every device type on the way back in.
 *
 * `kind: 'compute'` has no authoring form — the parser only ever builds
 * `hardware` or `service` — so its `platform` cannot round-trip and the node
 * comes back as hardware. Only sources that mint compute specs directly (not
 * YAML) can hold one, so this affects nothing that was authored as YAML.
 */
function specToAuthoring(spec: NodeSpec | undefined): Record<string, unknown> {
  if (!spec) return {}
  if (spec.kind === 'service') {
    return { service: spec.service, vendor: spec.vendor, resource: spec.resource, icon: spec.icon }
  }
  if (spec.kind === 'compute') {
    return { type: spec.type, vendor: spec.vendor, icon: spec.icon }
  }
  return { type: spec.type, vendor: spec.vendor, model: spec.model, icon: spec.icon }
}

function nodeToAuthoring(node: Node): Record<string, unknown> {
  const { spec, ...rest } = node
  return { ...rest, ...specToAuthoring(spec) }
}

function subgraphToAuthoring(subgraph: Subgraph): Record<string, unknown> {
  const { spec, ...rest } = subgraph
  return { ...rest, ...specToAuthoring(spec) }
}

/**
 * Serialize a graph to YAML that `YamlParser.parse()` reads back without loss,
 * so `parse(dumpGraph(g))` is a fixed point over the authoring schema.
 *
 * Hand-rolling this as string concatenation is not safe: any label carrying a
 * newline (a two-line segment name, say) has to be quoted or the document it
 * produces is invalid YAML — and a value the writer forgets to emit is simply
 * gone the next time the text is parsed. Both failure modes are silent. This
 * delegates quoting and escaping to js-yaml and emits whatever the graph
 * carries, so a field added to the parser needs no change here.
 *
 * `lineWidth: -1` disables line folding: folded output re-parses to the same
 * value, but it makes hand-editing the result confusing.
 */
export function dumpGraph(graph: NetworkGraph): string {
  const authoring = {
    version: graph.version,
    name: graph.name,
    description: graph.description,
    nodes: graph.nodes?.map(nodeToAuthoring),
    links: graph.links,
    subgraphs: graph.subgraphs?.map(subgraphToAuthoring),
    settings: graph.settings,
    pins: graph.pins,
  }
  return yaml.dump(pruneUndefined(authoring), { lineWidth: -1, noRefs: true })
}

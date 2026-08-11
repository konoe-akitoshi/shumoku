// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * NetworkGraph → authoring YAML, the inverse of `YamlParser.parse()`.
 */

import yaml from 'js-yaml'
import type { Link, LinkEndpoint, NetworkGraph, Node, NodeSpec, Subgraph } from '../models/types.js'

/**
 * Drop `undefined`-valued keys so the dump doesn't emit `key: null` for every
 * optional field the model leaves unset. Arrays and plain objects are walked;
 * everything else passes through untouched.
 *
 * `Map` / `Set` values are dropped rather than walked. `Object.entries()` on a
 * `Map` yields nothing, so walking one would turn it into `{}` — emitting an
 * empty-looking key whose contents vanished, which is worse than not emitting
 * it: the whole point of spreading the graph is that what survives is visible
 * in the document. `NetworkGraph.sheets` is the one such field today; it has no
 * authoring form either way (see `dumpGraph`).
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
    if (v instanceof Map || v instanceof Set) continue
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
 * `LinkEndpoint.plug` back to the `module` key the parser reads.
 *
 * A link-level `standard` or an endpoint `module` is normalized into
 * `plug.module` on the way in (`parseLinkEndpoint` → `plugFromStandard`), and
 * `plug` has no authoring form — so emitting it verbatim would drop the
 * transceiver standard and SKU on the way back. A plug carrying only a `cage`
 * (picked in the editor, no module yet) has no authoring key at all and cannot
 * round-trip.
 */
function endpointToAuthoring(endpoint: LinkEndpoint): Record<string, unknown> {
  const { plug, ...rest } = endpoint
  if (!plug?.module) return rest
  return { ...rest, module: { standard: plug.module.standard, sku: plug.module.sku } }
}

/**
 * `speedBps` back to the human `speed` spelling the parser reads (`10G`,
 * `2500M`, ...). Falls back to the raw bits/sec number when no suffix divides
 * it cleanly — both spellings re-parse to the same value.
 */
function speedToAuthoring(bps: number): string | number {
  for (const [unit, suffix] of [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'K'],
  ] as const) {
    if (bps >= unit && bps % unit === 0) return `${bps / unit}${suffix}`
  }
  return bps
}

function linkToAuthoring(link: Link): Record<string, unknown> {
  const { speedBps, ...rest } = link
  return {
    ...rest,
    from: endpointToAuthoring(link.from),
    to: endpointToAuthoring(link.to),
    ...(speedBps !== undefined ? { speed: speedToAuthoring(speedBps) } : {}),
  }
}

/**
 * Serialize a graph to authoring YAML, the inverse of `YamlParser.parse()`:
 * `parse(dumpGraph(g))` is a fixed point over the schema the parser reads.
 *
 * Hand-rolling this as string concatenation is not safe: any label carrying a
 * newline (a two-line segment name, say) has to be quoted or the document it
 * produces is invalid YAML — and a value the writer forgets to emit is simply
 * gone the next time the text is parsed. Both failure modes are silent. So this
 * delegates quoting and escaping to js-yaml, and spreads the graph rather than
 * listing keys: enumerating is what silently drops a field when the model gains
 * one. Only the three shapes the parser stores differently from how it reads
 * them are converted (`spec` on nodes and subgraphs, `plug` on link endpoints).
 *
 * The fixed point holds over the schema the parser reads, which is NARROWER
 * than the model. Everything else is written to the document — nothing is
 * dropped here — but is lost the next time that text is parsed:
 *
 * - graph: `terminations`, `exclusions`, `attachments`
 * - node: `presence`, `attachments`, `suppressedAttachments`, `entityId`,
 *   `position`, `size`, `termination`, `productId`, `provenance`, `fieldSources`
 * - link: `via`, `bends`, `presence`, `provenance`, `entityId`
 * - subgraph: `entityId`, `bounds`, `pinPositions`
 *
 * `presence` and `attachments` are the ones that bite: an `'anchor'` node comes
 * back as a `'scoop'` (resolve then keeps a device alive that was only meant to
 * carry identity) and a metrics binding is simply gone. So anything a source
 * mints beyond the authoring schema — the editor, the resolver, the entity
 * registry — must not be round-tripped through the YAML pane.
 *
 * Keep this list honest against the parser. A field the parser stopped reading
 * (or never read) does not announce itself: `subgraph.identity` was absent here
 * and unread, so an exported region came back without the key `resolve()`
 * clusters regions by — one region became two same-labelled boxes with the
 * members split between them, from a document that looked correct.
 *
 * `sheets` is the exception that is NOT written: it is a `Map`, which cannot be
 * expressed here without inventing an authoring form for it (see
 * `pruneUndefined`).
 *
 * `lineWidth: -1` disables line folding: folded output re-parses to the same
 * value, but it makes hand-editing the result confusing.
 */
export function dumpGraph(graph: NetworkGraph): string {
  const authoring = {
    ...graph,
    nodes: graph.nodes?.map(nodeToAuthoring),
    links: graph.links?.map(linkToAuthoring),
    subgraphs: graph.subgraphs?.map(subgraphToAuthoring),
  }
  return yaml.dump(pruneUndefined(authoring), { lineWidth: -1, noRefs: true })
}

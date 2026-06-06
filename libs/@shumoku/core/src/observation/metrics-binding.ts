// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Metrics binding = axis-2 dependency field, modeled as a
 * `metrics-binding` attachment on the resolved node (host binding) or
 * NodePort (link/interface binding). This module bridges that
 * attachment representation to the legacy `MetricsMapping` shape that
 * the metrics-plugin contract (`pollMetrics`) still consumes.
 *
 * The binding is the durable truth (identity-keyed, folded by resolve so
 * it follows re-sync). `MetricsMapping` is a *derived, transient* view of
 * it produced per read/poll — never stored. See
 * `apps/server/docs/design/topology-composition-store.md § 1`.
 */

import type { MetricsBindingAttachment, NetworkGraph, NodePort } from '../models/types.js'
import type { LinkMetricsMapping, MetricsMapping, NodeMetricsMapping } from '../plugin-types.js'

/**
 * The metrics-binding attachment on an element, if any. When `activeSourceIds`
 * is given, only a binding whose `sourceId` is active counts — so a binding left
 * behind by a detached/removed metrics source stops driving the mapping.
 */
export function metricsBindingOf(
  attachments: { kind: string }[] | undefined,
  activeSourceIds?: ReadonlySet<string>,
): MetricsBindingAttachment | undefined {
  return attachments?.find(
    (a): a is MetricsBindingAttachment =>
      a.kind === 'metrics-binding' &&
      (!activeSourceIds || activeSourceIds.has((a as MetricsBindingAttachment).sourceId)),
  )
}

/**
 * The best name to hand the plugin for an interface binding. Identity
 * (`ifName`) is the durable key; `interfaceName` is the migration / label
 * fallback. The poll-time resolution layer may refine this against the
 * source's live interface list, but a name is always derivable here.
 */
export function bindingInterfaceName(b: MetricsBindingAttachment): string | undefined {
  return b.interfaceIdentity?.ifName ?? b.interfaceName
}

/**
 * Derive a legacy `MetricsMapping` from a resolved graph's bindings.
 *
 * - Node host binding → `mapping.nodes[node.id]`.
 * - Link interface binding lives on a `NodePort`; we attribute it to the
 *   link whose endpoint references that port, keyed `link.id || link-${i}`
 *   to match the rest of the server (server.ts / topologies.ts).
 *
 * Pure; never mutates the input.
 */
export function deriveMappingFromGraph(
  graph: NetworkGraph,
  activeSourceIds?: ReadonlySet<string>,
): MetricsMapping {
  const nodes: Record<string, NodeMetricsMapping> = {}
  const links: Record<string, LinkMetricsMapping> = {}

  for (const node of graph.nodes ?? []) {
    const b = metricsBindingOf(node.attachments, activeSourceIds)
    if (!b) continue
    nodes[node.id] = {
      ...(b.hostId !== undefined ? { hostId: b.hostId } : {}),
      ...(b.hostName !== undefined ? { hostName: b.hostName } : {}),
    }
  }

  // (nodeId, portId) → its port binding, so a link endpoint can find it. The
  // separator is a tab, which never appears in generated node/port ids.
  const portKey = (nodeId: string, portId: string) => `${nodeId}\t${portId}`
  const portBindings = new Map<
    string,
    { nodeId: string; port: NodePort; binding: MetricsBindingAttachment }
  >()
  for (const node of graph.nodes ?? []) {
    for (const port of node.ports ?? []) {
      const b = metricsBindingOf(port.attachments, activeSourceIds)
      if (b) portBindings.set(portKey(node.id, port.id), { nodeId: node.id, port, binding: b })
    }
  }

  // NOTE: a link endpoint references a port by id, and that id matches the
  // folded port when the binding and the endpoint come from the same
  // contribution (the only case today — link bindings are authored as a single
  // overlay). Cross-contribution port folding can renumber the folded port id
  // away from the endpoint's reference; remapping endpoint port refs through the
  // port cluster in resolve() is the proper fix and lands with the link write
  // path (port identity), which doesn't exist yet — so exact match is correct
  // for every binding that can currently be produced.
  graph.links?.forEach((link, i) => {
    const linkId = link.id || `link-${i}`
    for (const ep of [link.from, link.to]) {
      const hit = portBindings.get(portKey(ep.node, ep.port))
      if (!hit) continue
      const name = bindingInterfaceName(hit.binding)
      links[linkId] = {
        monitoredNodeId: hit.nodeId,
        ...(name !== undefined ? { interface: name } : {}),
        ...(hit.binding.bandwidth !== undefined ? { bandwidth: hit.binding.bandwidth } : {}),
      }
      break
    }
  })

  return { nodes, links }
}

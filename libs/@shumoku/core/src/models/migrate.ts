// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * NetworkGraph normalization helpers.
 *
 * Runtime invariant: every link endpoint references an existing
 * `NodePort.id`. Hand-written YAML and historical save files often
 * reference port names without pre-declaring them on the node — this
 * pass walks the graph and materializes a stub `NodePort` (label =
 * referenced id) for every endpoint that points at a missing port.
 */

import type { Link, LinkEndpoint, NetworkGraph, Node, NodePort } from './types.js'

let portCounter = 0
function newPortId(): string {
  portCounter += 1
  return `port-mig-${Date.now().toString(36)}-${portCounter.toString(36)}`
}

function ensureNodePort(node: Node, init: Partial<NodePort> = {}): NodePort {
  const port: NodePort = {
    id: init.id ?? newPortId(),
    label: init.label ?? '',
    source: init.source ?? 'custom',
    ...init,
  }
  node.ports = [...(node.ports ?? []), port]
  return port
}

function findPort(node: Node | undefined, portId: string): NodePort | undefined {
  return node?.ports?.find((p) => p.id === portId)
}

function normalizeEndpoint(ep: LinkEndpoint, nodes: Map<string, Node>): LinkEndpoint {
  const node = nodes.get(ep.node)
  let portId = ep.port
  let port: NodePort | undefined

  if (portId) {
    port = findPort(node, portId)
    // Endpoint references a port id but the node doesn't have it — create
    // a stub carrying that id; default label to the referenced id (that's
    // what the human author wrote, e.g. `port: eth0` → label "eth0").
    if (!port && node) {
      port = ensureNodePort(node, { id: portId, label: portId })
    }
  } else if (node) {
    // Endpoint has no port reference — append a fresh anonymous port.
    port = ensureNodePort(node)
    portId = port.id
  }

  return {
    node: ep.node,
    port: portId ?? '',
    ip: ep.ip,
    pin: ep.pin,
  }
}

/**
 * Walk the graph and ensure every link endpoint references an existing
 * `NodePort`. Idempotent — graphs that already comply pass through
 * unchanged (modulo deep-copy).
 */
export function ensurePorts(graph: NetworkGraph): NetworkGraph {
  const nodes = new Map<string, Node>()
  for (const n of graph.nodes) {
    nodes.set(n.id, { ...n, ports: n.ports ? [...n.ports] : undefined })
  }

  const links: Link[] = graph.links.map((link) => ({
    ...link,
    from: normalizeEndpoint(link.from, nodes),
    to: normalizeEndpoint(link.to, nodes),
  }))

  return {
    ...graph,
    nodes: [...nodes.values()],
    links,
  }
}

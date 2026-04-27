// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * NetworkGraph normalization helpers.
 *
 * The runtime invariant is "every link endpoint has a port (a slot on the
 * node) and a plug (the cable end)". Old data — YAML written before the
 * model was tightened, or .neted.json snapshots saved by earlier editor
 * versions — may carry portless endpoints. These helpers materialize the
 * missing pieces so downstream layout/render code can rely on the invariant.
 */

import {
  defaultMediumForLink,
  isPluggableConnector,
  normalizePortConnector,
} from './port-compatibility.js'
import type {
  Link,
  LinkEndpoint,
  LinkMedium,
  NetworkGraph,
  Node,
  NodePort,
  PlugSpec,
  PortConnector,
} from './types.js'

let portCounter = 0
function newPortId(): string {
  portCounter += 1
  return `port-mig-${Date.now().toString(36)}-${portCounter.toString(36)}`
}

/**
 * Best-effort plug connector inference from link bandwidth + medium.
 * Returns undefined when there isn't enough signal — callers leave the plug
 * connector empty in that case.
 */
function inferPlugConnector(
  bandwidth: Link['bandwidth'],
  medium: LinkMedium | undefined,
): PortConnector | undefined {
  const cableConn = normalizePortConnector(medium?.connector)
  if (cableConn) return cableConn
  const kind = medium?.kind
  if (kind === 'twisted-pair') return 'rj45'
  // Bandwidth-driven guess for fiber/dac/aoc — coarse but stable.
  if (kind === 'fiber' || kind === 'dac' || kind === 'aoc') {
    if (typeof bandwidth === 'string') {
      const b = bandwidth.toLowerCase()
      if (b.startsWith('100g')) return 'qsfp28'
      if (b.startsWith('40g')) return 'qsfp+'
      if (b.startsWith('25g')) return 'sfp28'
      if (b.startsWith('10g')) return 'sfp+'
      return 'sfp'
    }
  }
  return undefined
}

function inferPlugSpeed(bandwidth: Link['bandwidth']): string | undefined {
  if (typeof bandwidth === 'string') return bandwidth.toLowerCase()
  return undefined
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

/**
 * Materialize port + plug for one endpoint. The node map is mutated in place
 * (callers pass the working map). Returns the canonical endpoint.
 */
function normalizeEndpoint(
  ep: LinkEndpoint,
  nodes: Map<string, Node>,
  link: Link,
  cageHint: PortConnector | undefined,
): LinkEndpoint {
  const node = nodes.get(ep.node)
  let portId = ep.port
  let port: NodePort | undefined

  if (portId) {
    port = findPort(node, portId)
    // The endpoint references a port id but the node doesn't have it yet
    // (typical for hand-written YAML / older saves where ports weren't
    // snapshotted). Create a stub carrying that id; default the label to
    // the id itself, since that's what the human author actually wrote
    // (e.g. `port: eth0` → label "eth0"). An empty label here would
    // silently strip the only port name the file contained.
    if (!port && node) {
      port = ensureNodePort(node, { id: portId, label: portId })
    }
  } else if (node) {
    // No port reference at all — create a fresh anonymous port. Label
    // stays empty; the renderer hides labelless ports.
    port = ensureNodePort(node, { cage: cageHint })
    portId = port.id
  }

  const inferredConnector = inferPlugConnector(link.bandwidth, link.medium)
  const plug: PlugSpec = {
    connector: ep.plug?.connector ?? inferredConnector ?? port?.cage,
    speed: ep.plug?.speed ?? inferPlugSpeed(link.bandwidth) ?? port?.speed,
    transceiver: ep.plug?.transceiver,
  }

  return {
    node: ep.node,
    port: portId ?? '',
    plug,
    ip: ep.ip,
    pin: ep.pin,
  }
}

/**
 * Pick a sensible cage hint for a freshly-created port based on the other
 * endpoint and the link's medium. We prefer to mirror the partner cage so
 * that compatibility checks don't fire spurious warnings on legacy data.
 */
function cageHintFor(partnerPort: NodePort | undefined, link: Link): PortConnector | undefined {
  const partnerCage = normalizePortConnector(partnerPort?.cage)
  if (partnerCage) return partnerCage
  const inferred = inferPlugConnector(link.bandwidth, link.medium)
  if (inferred) return inferred
  return undefined
}

/**
 * Walk the graph and ensure every link endpoint has a port reference and
 * a plug spec. Missing ports are appended to the target node. Missing
 * plugs are filled from link.bandwidth / link.medium / port.cage.
 *
 * This is idempotent: graphs that already satisfy the invariant pass
 * through unchanged (modulo deep-copy semantics).
 */
export function ensurePortAndPlug(graph: NetworkGraph): NetworkGraph {
  // Work on a shallow node copy so we can append ports without aliasing
  // callers' node objects.
  const nodes = new Map<string, Node>()
  for (const n of graph.nodes) {
    nodes.set(n.id, { ...n, ports: n.ports ? [...n.ports] : undefined })
  }

  const links: Link[] = graph.links.map((link) => {
    const fromNode = nodes.get(link.from?.node ?? '')
    const toNode = nodes.get(link.to?.node ?? '')
    const fromExisting = link.from?.port ? findPort(fromNode, link.from.port) : undefined
    const toExisting = link.to?.port ? findPort(toNode, link.to.port) : undefined

    const from = normalizeEndpoint(
      link.from ?? { node: '', port: '', plug: {} },
      nodes,
      link,
      cageHintFor(toExisting, link),
    )
    const to = normalizeEndpoint(
      link.to ?? { node: '', port: '', plug: {} },
      nodes,
      link,
      cageHintFor(fromExisting, link),
    )

    // If the link had no medium, infer a default from the now-known ports
    // and plugs so the existing default-medium UX doesn't regress.
    const medium =
      link.medium ??
      (() => {
        const fp = findPort(nodes.get(from.node), from.port)
        const tp = findPort(nodes.get(to.node), to.port)
        const inferred = defaultMediumForLink(fp, tp, from.plug, to.plug)
        return inferred.kind ? inferred : undefined
      })()

    return { ...link, from, to, medium }
  })

  return {
    ...graph,
    nodes: [...nodes.values()],
    links,
  }
}

/**
 * Re-export so callers that need the cage-vs-plug compat utility don't have
 * to know whether it lives in port-compatibility or here.
 */
export { isPluggableConnector }

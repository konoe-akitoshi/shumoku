// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * PoE budget analysis for the editor.
 * Uses @shumoku/catalog to resolve device specs and compute power budgets.
 */

import type { Catalog, HardwareProperties, PowerProperties } from '@shumoku/catalog'
import type { Link, Node } from '@shumoku/core'

export interface PoEPassthrough {
  nodeId: string
  nodeLabel: string
  draw_w: number
}

export interface PoELinkDraw {
  linkId: string
  fromPort: string
  toNodeId: string
  toNodeLabel: string
  toPort: string
  draw_w: number
  /** Downstream devices powered via passthrough */
  passthrough?: PoEPassthrough[]
}

export interface PoEBudget {
  nodeId: string
  nodeLabel: string
  budget_w: number
  used_w: number
  remaining_w: number
  utilization_pct: number
  links: PoELinkDraw[]
}

function catalogId(node: Node): string | undefined {
  const s = node.spec
  if (!s || s.kind !== 'hardware' || !s.vendor || !s.model) return undefined
  return `${s.vendor}/${s.model}`
}

function getPower(node: Node, catalog: Catalog): PowerProperties | undefined {
  const id = catalogId(node)
  if (!id) return undefined
  const entry = catalog.lookup(id)
  if (!entry || entry.spec.kind !== 'hardware') return undefined
  return (entry.properties as HardwareProperties).power
}

function linkEndpointNode(ep: string | { node: string }): string {
  return typeof ep === 'string' ? ep : ep.node
}

/**
 * Compute PoE budgets for all PoE source (PSE) nodes in the network.
 */
export function analyzePoE(nodes: Node[], links: Link[], catalog: Catalog): PoEBudget[] {
  const nodeMap = new Map<string, Node>()
  for (const node of nodes) nodeMap.set(node.id, node)

  // Build adjacency: nodeId → [{ peerId, linkId, localPort, peerPort }]
  interface AdjEntry {
    peerId: string
    linkId: string
    localPort: string
    peerPort: string
  }
  const adj = new Map<string, AdjEntry[]>()
  for (const link of links) {
    const from = linkEndpointNode(link.from)
    const to = linkEndpointNode(link.to)
    const id = link.id ?? `${from}-${to}`
    const fromPort = typeof link.from === 'object' ? (link.from.port ?? '') : ''
    const toPort = typeof link.to === 'object' ? (link.to.port ?? '') : ''

    const fl = adj.get(from) ?? []
    fl.push({ peerId: to, linkId: id, localPort: fromPort, peerPort: toPort })
    adj.set(from, fl)

    const tl = adj.get(to) ?? []
    tl.push({ peerId: from, linkId: id, localPort: toPort, peerPort: fromPort })
    adj.set(to, tl)
  }

  const budgets: PoEBudget[] = []

  for (const node of nodes) {
    const power = getPower(node, catalog)
    if (!power?.poe_out?.budget_w) continue

    const neighbors = adj.get(node.id) ?? []
    const poeLinks: PoELinkDraw[] = []
    let totalUsed = 0

    for (const { peerId, linkId, localPort, peerPort } of neighbors) {
      const peer = nodeMap.get(peerId)
      if (!peer) continue

      const peerPower = getPower(peer, catalog)
      if (!peerPower?.poe_in) continue // only PoE consumers (PD with poe_in)

      const ownDraw = peerPower.poe_in.max_draw_w ?? peerPower.max_draw_w ?? 0
      if (ownDraw <= 0) continue

      // Passthrough: if peer also has poe_out, collect downstream consumption
      let passthroughDraw = 0
      const passthroughDevices: PoEPassthrough[] = []
      if (peerPower.poe_out) {
        for (const { peerId: dsId } of adj.get(peerId) ?? []) {
          if (dsId === node.id) continue
          const ds = nodeMap.get(dsId)
          if (!ds) continue
          const dsPower = getPower(ds, catalog)
          if (dsPower?.poe_in) {
            const dsDraw = dsPower.poe_in.max_draw_w ?? dsPower.max_draw_w ?? 0
            passthroughDraw += dsDraw
            const dsLabel = Array.isArray(ds.label) ? ds.label[0] : ds.label
            passthroughDevices.push({ nodeId: dsId, nodeLabel: dsLabel, draw_w: dsDraw })
          }
        }
      }

      const totalDraw = ownDraw + passthroughDraw
      const peerLabel = Array.isArray(peer.label) ? peer.label[0] : peer.label
      poeLinks.push({
        linkId,
        fromPort: localPort,
        toNodeId: peerId,
        toNodeLabel: peerLabel,
        toPort: peerPort,
        draw_w: totalDraw,
        passthrough: passthroughDevices.length > 0 ? passthroughDevices : undefined,
      })
      totalUsed += totalDraw
    }

    if (poeLinks.length > 0) {
      const budget = power.poe_out.budget_w
      const label = Array.isArray(node.label) ? node.label[0] : node.label
      budgets.push({
        nodeId: node.id,
        nodeLabel: label,
        budget_w: budget,
        used_w: Math.round(totalUsed * 10) / 10,
        remaining_w: Math.round((budget - totalUsed) * 10) / 10,
        utilization_pct: Math.round((totalUsed / budget) * 1000) / 10,
        links: poeLinks,
      })
    }
  }

  return budgets
}

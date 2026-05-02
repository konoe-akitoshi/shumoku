// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * PoE budget analysis for the editor.
 *
 * Calculation is based on IEEE 802.3 class-based reservation (the conservative
 * design default): a PSE reserves a fixed wattage per port based on the PD's
 * classification — regardless of the PD's actual instantaneous draw. Planning
 * against `max_draw_w` alone understates the PSE's consumption and can cause
 * PoE negotiation to fail in practice.
 *
 * Each link yields two values:
 *   - `reserved_w` — watts the PSE commits to the port (the budget accounting value)
 *   - `draw_w`    — catalog's informational max_draw_w (what the PD actually draws)
 *
 * Limitations (tracked in GH issue #119):
 *   - Static class-based only. LLDP dynamic allocation and UPOE are not modeled.
 *   - PSE budget is treated as a single value per entry. Conditional budgets
 *     (PSU model / PSU count / external adapter) are represented by picking
 *     the conservative (smallest) value in the catalog.
 *   - PD per-class draw matrix (`poe_in.by_class`) is captured but not yet used
 *     in draw_w reporting; draw_w uses `poe_in.max_draw_w` (the max-class value).
 */

import {
  type Catalog,
  classReservationW,
  effectivePoeClass,
  type HardwareProperties,
  type PowerProperties,
} from '@shumoku/catalog'
import type { Link, Node } from '@shumoku/core'

export interface PoEPassthrough {
  nodeId: string
  nodeLabel: string
  draw_w: number
  reserved_w: number
}

export type PoEViolationKind = 'over-budget' | 'over-port-max' | 'min-class-unmet'

export interface PoEViolation {
  kind: PoEViolationKind
  message: string
  linkId?: string
}

export interface PoELinkDraw {
  linkId: string
  fromPort: string
  toNodeId: string
  toNodeLabel: string
  toPort: string
  /** Watts the PSE reserves for this port (budget accounting). */
  reserved_w: number
  /** Watts the PD typically draws (informational, not summed into budget). */
  draw_w: number
  /** Effective negotiated PoE class (after min(PD, PSE) downgrade). */
  effective_class?: number
  /** Per-link violations (e.g. reservation exceeds PSE max_per_port_w, min_class unmet). */
  violations?: PoEViolation[]
  /** Downstream devices powered via passthrough (informational, not summed). */
  passthrough?: PoEPassthrough[]
}

export interface PoEBudget {
  nodeId: string
  nodeLabel: string
  budget_w: number
  /** Sum of reserved_w across all outgoing PoE links (the budget-accounting value). */
  reserved_w: number
  /** Sum of draw_w across all outgoing PoE links (informational, typically < reserved). */
  draw_w: number
  remaining_w: number
  utilization_pct: number
  links: PoELinkDraw[]
  violations: PoEViolation[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function nodeLabelOf(node: Node | undefined, fallbackId: string): string {
  if (!node) return fallbackId
  const label = Array.isArray(node.label) ? node.label[0] : node.label
  return label ?? fallbackId
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

function displayPort(nodeMap: Map<string, Node>, nodeId: string, portId: string): string {
  if (!portId) return ''
  const port = nodeMap.get(nodeId)?.ports?.find((p) => p.id === portId)
  if (!port) return portId
  return port.label || port.cage || 'unnamed port'
}

/**
 * Compute the watts the PSE reserves for a port given both sides' capabilities,
 * and the PD's informational draw. Returns undefined if the PD is not a PoE consumer.
 */
function computePortPower(
  pdPower: PowerProperties,
  psePower: PowerProperties,
): {
  reserved_w: number
  draw_w: number
  effective_class?: number
  violations: PoEViolation[]
} | null {
  if (!pdPower.poe_in) return null
  const violations: PoEViolation[] = []

  const effectiveClass = effectivePoeClass(pdPower.poe_in.class, psePower.poe_out?.standard)
  const classReserved = classReservationW(effectiveClass)

  // Prefer class-based reservation; fall back to PD's declared draw when class unknown.
  const reserved_w = classReserved ?? pdPower.poe_in.max_draw_w ?? pdPower.max_draw_w ?? 0

  const draw_w = pdPower.poe_in.max_draw_w ?? pdPower.max_draw_w ?? 0

  // Per-port max check: PSE per-port cap vs this reservation.
  const perPortMax = psePower.poe_out?.max_per_port_w
  if (perPortMax !== undefined && reserved_w > perPortMax) {
    violations.push({
      kind: 'over-port-max',
      message: `Reserved ${reserved_w}W exceeds PSE per-port max ${perPortMax}W`,
    })
  }

  // min_class check: PD may refuse to boot below a required class.
  const minClass = pdPower.poe_in.min_class
  if (minClass !== undefined && effectiveClass !== undefined && effectiveClass < minClass) {
    violations.push({
      kind: 'min-class-unmet',
      message: `Device requires Class ${minClass}+ but link negotiates Class ${effectiveClass}`,
    })
  }

  return { reserved_w, draw_w, effective_class: effectiveClass, violations }
}

/**
 * Compute PoE budgets for every PSE node in the network.
 *
 * Each PSE's accounting uses class-based reservation. Passthrough devices (PDs
 * with both `poe_in` and `poe_out`) are NOT double-counted against the upstream
 * PSE — they generate their own separate budget entry. Downstream draws from a
 * passthrough device are surfaced as informational sub-rows.
 */
export function analyzePoE(nodes: Node[], links: Link[], catalog: Catalog): PoEBudget[] {
  const nodeMap = new Map<string, Node>()
  for (const node of nodes) nodeMap.set(node.id, node)

  interface AdjEntry {
    peerId: string
    linkId: string
    localPort: string
    peerPort: string
  }
  const adj = new Map<string, AdjEntry[]>()
  for (const link of links) {
    const from = link.from.node
    const to = link.to.node
    const id = link.id ?? `${from}-${to}`
    const fromPort = link.from.port
    const toPort = link.to.port

    const fl = adj.get(from) ?? []
    fl.push({ peerId: to, linkId: id, localPort: fromPort, peerPort: toPort })
    adj.set(from, fl)

    const tl = adj.get(to) ?? []
    tl.push({ peerId: from, linkId: id, localPort: toPort, peerPort: fromPort })
    adj.set(to, tl)
  }

  const budgets: PoEBudget[] = []

  for (const node of nodes) {
    const pse = getPower(node, catalog)
    if (!pse?.poe_out?.budget_w) continue

    const neighbors = adj.get(node.id) ?? []
    const poeLinks: PoELinkDraw[] = []
    const nodeViolations: PoEViolation[] = []
    let totalReserved = 0
    let totalDraw = 0

    for (const { peerId, linkId, localPort, peerPort } of neighbors) {
      const peer = nodeMap.get(peerId)
      if (!peer) continue

      const peerPower = getPower(peer, catalog)
      if (!peerPower) continue

      const port = computePortPower(peerPower, pse)
      if (!port) continue

      // Informational passthrough: surface what the PD forwards downstream.
      const passthrough: PoEPassthrough[] = []
      if (peerPower.poe_out?.budget_w !== undefined) {
        for (const ds of adj.get(peerId) ?? []) {
          if (ds.peerId === node.id) continue
          const dsNode = nodeMap.get(ds.peerId)
          if (!dsNode) continue
          const dsPower = getPower(dsNode, catalog)
          if (!dsPower) continue
          const dsPort = computePortPower(dsPower, peerPower)
          if (!dsPort) continue
          passthrough.push({
            nodeId: ds.peerId,
            nodeLabel: nodeLabelOf(dsNode, ds.peerId),
            draw_w: dsPort.draw_w,
            reserved_w: dsPort.reserved_w,
          })
        }
      }

      const linkViolations = port.violations.map((v) => ({ ...v, linkId }))
      nodeViolations.push(...linkViolations)

      poeLinks.push({
        linkId,
        fromPort: displayPort(nodeMap, node.id, localPort),
        toNodeId: peerId,
        toNodeLabel: nodeLabelOf(peer, peerId),
        toPort: displayPort(nodeMap, peerId, peerPort),
        reserved_w: round1(port.reserved_w),
        draw_w: round1(port.draw_w),
        effective_class: port.effective_class,
        violations: linkViolations.length > 0 ? linkViolations : undefined,
        passthrough: passthrough.length > 0 ? passthrough : undefined,
      })
      totalReserved += port.reserved_w
      totalDraw += port.draw_w
    }

    if (poeLinks.length === 0) continue

    const budget = pse.poe_out.budget_w
    if (totalReserved > budget) {
      nodeViolations.push({
        kind: 'over-budget',
        message: `Reserved ${round1(totalReserved)}W exceeds PSE budget ${budget}W`,
      })
    }

    budgets.push({
      nodeId: node.id,
      nodeLabel: nodeLabelOf(node, node.id),
      budget_w: budget,
      reserved_w: round1(totalReserved),
      draw_w: round1(totalDraw),
      remaining_w: round1(budget - totalReserved),
      utilization_pct: Math.round((totalReserved / budget) * 1000) / 10,
      links: poeLinks,
      violations: nodeViolations,
    })
  }

  return budgets
}

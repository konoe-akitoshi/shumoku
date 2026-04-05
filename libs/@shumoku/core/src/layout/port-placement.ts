// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Port Placement
 *
 * Determines the absolute position of each port on a node, based on:
 * - Which side of the node the port is on (top/bottom/left/right)
 * - How many ports are on that side (evenly distributed)
 * - The node's absolute position and size
 *
 * Port side assignment rules (for TB direction):
 * - Normal links: source ports → bottom, destination ports → top
 * - HA/redundancy links: source ports → right, destination ports → left
 * - For LR direction: source → right, destination → left (normal);
 *   HA → bottom/top
 */

import type { Link, LinkEndpoint, Position } from '../models/types.js'
import type { ResolvedNode, ResolvedPort } from './resolved-types.js'

/** Default port visual size */
const PORT_SIZE = { width: 8, height: 8 }

type Side = 'top' | 'bottom' | 'left' | 'right'
type Direction = 'TB' | 'BT' | 'LR' | 'RL'

interface PortAssignment {
  nodeId: string
  portName: string
  side: Side
}

function getNodeId(endpoint: string | LinkEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.node
}

function getPortName(endpoint: string | LinkEndpoint): string | undefined {
  return typeof endpoint === 'string' ? undefined : endpoint.port
}

/**
 * Detect HA pairs from links with redundancy field.
 */
function detectHAPairs(links: Link[]): Set<string> {
  const pairs = new Set<string>()
  for (const link of links) {
    if (!link.redundancy) continue
    const from = getNodeId(link.from)
    const to = getNodeId(link.to)
    pairs.add([from, to].sort().join(':'))
  }
  return pairs
}

/**
 * Get the source/destination sides for normal links based on layout direction.
 */
function getNormalSides(direction: Direction): { sourceSide: Side; destSide: Side } {
  switch (direction) {
    case 'TB':
      return { sourceSide: 'bottom', destSide: 'top' }
    case 'BT':
      return { sourceSide: 'top', destSide: 'bottom' }
    case 'LR':
      return { sourceSide: 'right', destSide: 'left' }
    case 'RL':
      return { sourceSide: 'left', destSide: 'right' }
  }
}

/**
 * Get the source/destination sides for HA links based on layout direction.
 * HA pairs should be laid out perpendicular to the main flow.
 */
function getHASides(direction: Direction): { sourceSide: Side; destSide: Side } {
  switch (direction) {
    case 'TB':
    case 'BT':
      return { sourceSide: 'right', destSide: 'left' }
    case 'LR':
    case 'RL':
      return { sourceSide: 'bottom', destSide: 'top' }
  }
}

/**
 * Assign each port to a side of its node based on link connections.
 */
function assignPortSides(
  links: Link[],
  direction: Direction,
): PortAssignment[] {
  const haPairs = detectHAPairs(links)
  const assignments: PortAssignment[] = []
  const seen = new Set<string>() // "nodeId:portName" dedup

  const normalSides = getNormalSides(direction)
  const haSides = getHASides(direction)

  for (const link of links) {
    const fromNode = getNodeId(link.from)
    const toNode = getNodeId(link.to)
    const fromPort = getPortName(link.from)
    const toPort = getPortName(link.to)

    const isHA = haPairs.has([fromNode, toNode].sort().join(':'))
    const sides = isHA ? haSides : normalSides

    if (fromPort) {
      const key = `${fromNode}:${fromPort}`
      if (!seen.has(key)) {
        seen.add(key)
        assignments.push({ nodeId: fromNode, portName: fromPort, side: sides.sourceSide })
      }
    }

    if (toPort) {
      const key = `${toNode}:${toPort}`
      if (!seen.has(key)) {
        seen.add(key)
        assignments.push({ nodeId: toNode, portName: toPort, side: sides.destSide })
      }
    }
  }

  return assignments
}

/**
 * Compute the absolute position of a port on a given side of a node.
 *
 * Ports are evenly distributed along the side edge.
 * For example, 3 ports on the bottom of a 120px-wide node:
 *   positions at x = 30, 60, 90 (= width * 1/4, 2/4, 3/4)
 */
function computePortPosition(
  node: ResolvedNode,
  side: Side,
  index: number,
  total: number,
): Position {
  const { x: cx, y: cy } = node.position
  const halfW = node.size.width / 2
  const halfH = node.size.height / 2

  // Distribute evenly: position = (index + 1) / (total + 1)
  const ratio = (index + 1) / (total + 1)

  switch (side) {
    case 'top':
      return { x: cx - halfW + node.size.width * ratio, y: cy - halfH }
    case 'bottom':
      return { x: cx - halfW + node.size.width * ratio, y: cy + halfH }
    case 'left':
      return { x: cx - halfW, y: cy - halfH + node.size.height * ratio }
    case 'right':
      return { x: cx + halfW, y: cy - halfH + node.size.height * ratio }
  }
}

/**
 * Place all ports with absolute coordinates.
 *
 * @param nodes - Positioned nodes (from node placement step)
 * @param links - Link definitions (determine which ports exist and their sides)
 * @param direction - Layout direction (affects port side assignment)
 * @returns Map of portId → ResolvedPort with absolute positions
 */
export function placePorts(
  nodes: Map<string, ResolvedNode>,
  links: Link[],
  direction: Direction = 'TB',
): Map<string, ResolvedPort> {
  const assignments = assignPortSides(links, direction)

  // Group by node+side to determine order and count
  const bySide = new Map<string, PortAssignment[]>()
  for (const a of assignments) {
    const key = `${a.nodeId}:${a.side}`
    const list = bySide.get(key)
    if (list) {
      list.push(a)
    } else {
      bySide.set(key, [a])
    }
  }

  // Compute absolute positions
  const ports = new Map<string, ResolvedPort>()

  for (const [_key, sideAssignments] of bySide) {
    const first = sideAssignments[0]
    if (!first) continue
    const nodeId = first.nodeId
    const side = first.side
    const node = nodes.get(nodeId)
    if (!node) continue

    for (let i = 0; i < sideAssignments.length; i++) {
      const a = sideAssignments[i]
      if (!a) continue
      const portId = `${a.nodeId}:${a.portName}`
      const absolutePosition = computePortPosition(node, side, i, sideAssignments.length)

      ports.set(portId, {
        id: portId,
        nodeId: a.nodeId,
        label: a.portName,
        absolutePosition,
        side,
        size: PORT_SIZE,
      })
    }
  }

  return ports
}

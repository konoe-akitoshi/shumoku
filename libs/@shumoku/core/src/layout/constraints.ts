// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout constraint registry — the single declarative source of the
 * engine's geometric PROHIBITIONS (#481 / #482).
 *
 * Interference avoidance used to live as ~20 scattered mechanisms in three
 * styles (constructive gaps, after-the-fact repairs, score penalties), and
 * every new pass re-opened the same holes — invariants.ts's own lesson
 * ("every visual defect was a silently unchecked invariant violation").
 * This registry declares each prohibition ONCE; verification derives from
 * the same definitions, so the spec and the check cannot drift.
 *
 * Enforcement levels (honest, per current engine capability):
 *  - 'blocking'   — guaranteed by the engine today; a violation is a BUG.
 *                   Asserted after every layout in dev/test.
 *  - 'warn'       — measured and reported; enforcement lands with the VPSC
 *                   projection stage (#483).
 *  - 'score-only' — currently only weighted in the search cost; promotion
 *                   tracked by its own issue (#485 for piercing).
 *
 * Aesthetics (crossings, wire length, aspect) are deliberately NOT here —
 * they are soft objectives owned by the search cost, never prohibitions.
 */

import { resolveNodeSize } from './engine/index.js'
import {
  type BoxBounds,
  type BoxSpec,
  type CollinearOverlap,
  type ContainerOverlap,
  type ContainerSpec,
  type ContainmentViolation,
  type EdgeNodePierce,
  findCollinearOverlaps,
  findContainerOverlaps,
  findContainmentViolations,
  findEdgeNodePiercing,
  findNodeOverlaps,
  findPortClutter,
  type NodeOverlap,
  type PierceLineSpec,
  type PolylineSpec,
  type PortClutter,
} from './invariants.js'
import type { ResolvedLayout } from './resolved-types.js'

export type ConstraintLevel = 'blocking' | 'warn' | 'score-only'

export type ConstraintId =
  | 'node-overlap'
  | 'containment'
  | 'container-overlap'
  | 'collinear-track'
  | 'port-clutter'
  | 'edge-pierce'

export interface ConstraintSpec {
  id: ConstraintId
  title: string
  level: ConstraintLevel
  /** What currently enforces (or is meant to enforce) it. */
  enforcedBy: string
  /** Tunable parameters — the one place their values are defined. */
  params: Record<string, number>
}

/**
 * THE registry. Levels are promoted as enforcement lands:
 * #483 (VPSC projection) → container-overlap / collinear-track / port-clutter
 * to 'blocking'; #485 (obstacle-avoiding router) → edge-pierce.
 */
export const LAYOUT_CONSTRAINTS: readonly ConstraintSpec[] = [
  {
    id: 'node-overlap',
    title: 'Node boxes never overlap',
    level: 'blocking',
    enforcedBy: 'zone row layout + resolveRow separation + band packing',
    params: { margin: 0 },
  },
  {
    id: 'containment',
    title: 'A member node sits inside its parent container box',
    level: 'blocking',
    enforcedBy:
      'parent-zone seating (#474/#478), final-extent box sizing + containment re-pack (#478), outer-face label reservation (#480)',
    params: { pad: 0, slack: 2 },
  },
  {
    id: 'container-overlap',
    title: 'Non-nested container boxes are disjoint',
    level: 'blocking',
    enforcedBy:
      'band packing with true box extents + post-search feasibility rounds (gap widening until disjoint, search.ts step 6)',
    params: {},
  },
  {
    id: 'collinear-track',
    title: 'No two wires share a track (parallel within their stroke widths)',
    level: 'warn',
    enforcedBy: 'router lane allocation; scored (×8) — preventive allocation lands with #483',
    params: { minSegmentLength: 13, minSharedLength: 12, clearance: 0.5 },
  },
  {
    id: 'port-clutter',
    title: 'Port boxes / labels never collide (with each other or foreign nodes)',
    level: 'warn',
    enforcedBy: 'port-demand feedback + label corridors; scored (×40) — full enforcement with #483',
    params: {},
  },
  {
    id: 'edge-pierce',
    title: 'A wire never runs through a foreign node box',
    level: 'score-only',
    enforcedBy: 'search cost penalty (×20) only — preventive routing is #485',
    params: { inflate: 2 },
  },
]

export interface ConstraintViolations {
  nodeOverlaps: NodeOverlap[]
  containmentViolations: ContainmentViolation[]
  containerOverlaps: ContainerOverlap[]
  collinearOverlaps: CollinearOverlap[]
  portClutter: PortClutter[]
  edgePierces: EdgeNodePierce[]
}

export interface ConstraintReport {
  violations: ConstraintViolations
  /** Count per constraint id. */
  counts: Record<ConstraintId, number>
  /** Violated constraints whose level is 'blocking'. */
  blockingViolations: ConstraintId[]
  ok: boolean
}

const specOf = (id: ConstraintId): ConstraintSpec => {
  const spec = LAYOUT_CONSTRAINTS.find((s) => s.id === id)
  if (!spec) throw new Error(`unknown layout constraint: ${id}`)
  return spec
}

/**
 * Verify a ResolvedLayout against the registry. Every check derives its
 * parameters from the specs above — no second source of truth.
 */
export function verifyLayoutConstraints(layout: ResolvedLayout): ConstraintReport {
  const nodeBoxes: BoxSpec[] = []
  for (const [id, node] of layout.nodes) {
    if (!node.position) continue
    const size = resolveNodeSize(node)
    nodeBoxes.push({
      id,
      x: node.position.x,
      y: node.position.y,
      width: size.width,
      height: size.height,
    })
  }

  const members = new Map<string, string[]>()
  for (const [id, node] of layout.nodes) {
    if (!node.parent) continue
    const list = members.get(node.parent)
    if (list) list.push(id)
    else members.set(node.parent, [id])
  }
  const containers: ContainerSpec[] = []
  const containerBoxes: BoxBounds[] = []
  for (const [id, sg] of layout.subgraphs) {
    if (!sg.bounds) continue
    containerBoxes.push({ id, bounds: sg.bounds, parent: sg.parent })
    const memberIds = members.get(id)
    if (memberIds && memberIds.length > 0) containers.push({ id, bounds: sg.bounds, memberIds })
  }

  const trackLines: PolylineSpec[] = []
  const pierceLines: PierceLineSpec[] = []
  const busOf = new Map<string, string>()
  for (const [id, edge] of layout.edges) {
    // Couplings (HA glasses bridges) are not wires — same exclusion the
    // routed score applies; the prohibition and the score share one
    // definition of "wire".
    if (edge.coupling) continue
    const points = edge.route?.points ?? edge.points
    if (points.length < 2) continue
    trackLines.push({ id, points, halfWidth: Math.max(0.5, edge.width / 2) })
    pierceLines.push({ id, points, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId })
    if (edge.route?.kind === 'bus') busOf.set(id, edge.route.busId)
  }

  const collinearParams = specOf('collinear-track').params
  const violations: ConstraintViolations = {
    nodeOverlaps: findNodeOverlaps(nodeBoxes, specOf('node-overlap').params['margin'] ?? 0),
    containmentViolations: findContainmentViolations(
      nodeBoxes,
      containers,
      specOf('containment').params['pad'] ?? 0,
    ),
    containerOverlaps: findContainerOverlaps(containerBoxes),
    collinearOverlaps: findCollinearOverlaps(trackLines, {
      minSegmentLength: collinearParams['minSegmentLength'],
      minSharedLength: collinearParams['minSharedLength'],
      clearance: collinearParams['clearance'],
      // comb siblings SHARE the trunk by design — same-bus pairs are the
      // org-chart grammar, not a violation (parity with the routed score)
    }).filter((o) => {
      const ba = busOf.get(o.a)
      return ba === undefined || ba !== busOf.get(o.b)
    }),
    portClutter: findPortClutter([...layout.ports.values()], nodeBoxes),
    edgePierces: findEdgeNodePiercing(
      pierceLines,
      nodeBoxes,
      specOf('edge-pierce').params['inflate'] ?? 2,
    ),
  }

  const counts: Record<ConstraintId, number> = {
    'node-overlap': violations.nodeOverlaps.length,
    containment: violations.containmentViolations.length,
    'container-overlap': violations.containerOverlaps.length,
    'collinear-track': violations.collinearOverlaps.length,
    'port-clutter': violations.portClutter.length,
    'edge-pierce': violations.edgePierces.length,
  }

  const blockingViolations = LAYOUT_CONSTRAINTS.filter(
    (s) => s.level === 'blocking' && counts[s.id] > 0,
  ).map((s) => s.id)

  return {
    violations,
    counts,
    blockingViolations,
    ok: blockingViolations.length === 0,
  }
}

/**
 * Standing-fixture gate (engine-v3-migration.md §B4, finally wired):
 * verify after a layout and — when a BLOCKING constraint is violated —
 * throw under `NODE_ENV=test` (CI fixtures pin the guarantee), log an
 * error otherwise. A runtime layout must NEVER fail to render because of
 * the gate: Bun defaults NODE_ENV to 'development', and throwing there
 * turned a constraint report into "no diagram at all" (the flat-tree path
 * on a 1.5k-node graph violates massively — that's a finding for #481,
 * not a reason to refuse the bake).
 */
export function assertLayoutConstraints(layout: ResolvedLayout, context = 'layout'): void {
  const report = verifyLayoutConstraints(layout)
  if (report.ok) return
  const detail = report.blockingViolations.map((id) => `${id}=${report.counts[id]}`).join(', ')
  const message = `[layout-constraints] BLOCKING violation after ${context}: ${detail}`
  const env =
    typeof process !== 'undefined' && typeof process.env !== 'undefined'
      ? process.env['NODE_ENV']
      : undefined
  if (env === 'test') {
    throw new Error(message)
  }
  console.error(message)
}

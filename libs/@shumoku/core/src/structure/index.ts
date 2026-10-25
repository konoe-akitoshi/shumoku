// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { analysisGraph, routingDomainRef, segmentRef } from './analysis-graph.js'
import { sorted } from './keys.js'
import { boundaryCandidates, orientPlanes } from './orientation.js'
import { derivePlanes } from './planes.js'
import type { Stages, VertexRef } from './stage-types.js'
import type { Plane, Structure, Vertex } from './types.js'
import { deriveUnits, unitRef } from './units.js'

/** What the reader tells the derivation. */
export interface DeriveOptions {
  /**
   * The boundary points: ids of nodes, segments or routing domains where the network's cables
   * meet what lies beyond. The orientation is measured from them; without them it is empty.
   */
  readonly boundary?: readonly string[]
}

/** Runs the stages and keeps what each one made. The working data, not the structure. */
export function deriveStages(network: input.Network, options: DeriveOptions = {}): Stages {
  const analysis = analysisGraph(network)
  const units = deriveUnits(network)
  const planes = derivePlanes(network, analysis, units)
  const candidates = boundaryCandidates(planes)
  const boundary = boundaryOf(options.boundary ?? [], analysis, units)
  const orientations = orientPlanes(planes, boundary)
  return { analysis, units, planes, candidates, boundary, orientations }
}

/** The vertices the given ids name: a node by its unit, a segment or a routing domain. */
function boundaryOf(
  ids: readonly string[],
  analysis: Stages['analysis'],
  units: Stages['units'],
): VertexRef[] {
  const unitOfNode = new Map(units.units.flatMap((u) => u.members.map((m) => [m, u.id] as const)))
  const known = new Set(analysis.vertices.map((v) => v.ref))
  return sorted(
    new Set(
      ids.map((id) => {
        const unit = unitOfNode.get(id)
        if (unit !== undefined) return unitRef(unit)
        for (const ref of [segmentRef(id), routingDomainRef(id)]) if (known.has(ref)) return ref
        throw new Error(`boundary: no node, segment or routing domain on a line is named ${id}`)
      }),
    ),
  )
}

function vertexOf(ref: VertexRef): Vertex {
  const at = ref.indexOf(':')
  const id = ref.slice(at + 1)
  const kind = ref.slice(0, at)
  if (kind === 'segment') return { segment: id }
  if (kind === 'routingDomain') return { routingDomain: id }
  return { unit: id }
}

const vertices = (refs: readonly VertexRef[]): Vertex[] => refs.map(vertexOf)

/** The structure a set of stages makes: the ids of the configuration and nothing else. */
export function structureOf(stages: Stages): Structure {
  const nodes: Record<string, { unit: string }> = {}
  for (const u of stages.units.units) {
    for (const m of u.members) if (m !== u.id) nodes[m] = { unit: u.id }
  }
  const pairs = (ps: readonly (readonly [VertexRef, VertexRef])[]) =>
    ps.map(([a, b]): [Vertex, Vertex] => [vertexOf(a), vertexOf(b)])
  const planes = stages.planes.map(
    (p, i): Plane => ({
      plane: p.plane,
      side: p.side,
      flows: pairs(stages.orientations[i]?.flows ?? []),
      even: pairs(stages.orientations[i]?.even ?? []),
    }),
  )
  return {
    nodes,
    candidates: vertices(stages.candidates),
    boundary: vertices(stages.boundary),
    planes,
  }
}

/**
 * The structure a written network implies. A network is the `config` of a read model
 * (`readNetworkModel(yaml).config`); the result refers to it by its written ids.
 */
export function deriveStructure(network: input.Network, options: DeriveOptions = {}): Structure {
  return structureOf(deriveStages(network, options))
}

export { analysisGraph } from './analysis-graph.js'
export { setKey } from './keys.js'
export { boundaryCandidates, orientPlanes } from './orientation.js'
export { derivePlanes } from './planes.js'
export type {
  AnalysisGraph,
  Orientation,
  PlaneGraph,
  Side,
  Stages,
  Units,
  VertexRef,
} from './stage-types.js'
export type {
  GroupId,
  NodeId,
  Plane,
  RedundancyId,
  RoutingDomainId,
  SegmentId,
  Structure,
  UnitId,
  Vertex,
} from './types.js'
export { deriveUnits } from './units.js'

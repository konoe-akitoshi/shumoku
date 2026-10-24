// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { analysisGraph } from './analysis-graph.js'
import { findBranches } from './branches.js'
import { decompose } from './decompose.js'
import { findEntrances } from './entrances.js'
import { findGroupEdges } from './group-edges.js'
import { derivePlanes } from './planes.js'
import { rankBranches } from './ranks.js'
import { deriveShapes } from './shapes.js'
import type { Beyond, PlaneStage, RankedBranch, Stages, VertexRef } from './stage-types.js'
import { findTrunk } from './trunk.js'
import { findTwins } from './twins.js'
import type { Block, Branch, Edge, Plane, ShapePiece, Structure, Vertex } from './types.js'
import { deriveUnits } from './units.js'

/** Runs the stages and keeps what each one made. The working data, not the structure. */
export function deriveStages(network: input.Network): Stages {
  const analysis = analysisGraph(network)
  const units = deriveUnits(network)
  const planes: PlaneStage[] = derivePlanes(network, analysis, units).map((graph) => ({
    ...graph,
    decomposition: decompose(graph),
    twins: findTwins(graph),
  }))
  const shapes = deriveShapes(network, analysis, units, planes)
  const main = planes.find((p) => p.plane === 'default')
  const entrances = findEntrances(analysis, units, main)
  const trunk = main && findTrunk(main.decomposition, entrances)
  const branches = rankBranches(
    network,
    analysis,
    main,
    shapes,
    main ? findBranches(main.decomposition, trunk) : [],
  )
  const edges = findGroupEdges(network, analysis, units, main)
  return {
    analysis,
    units,
    planes,
    shapes,
    entrances,
    ...(trunk ? { trunk } : {}),
    branches,
    edges,
  }
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
  const planes: Plane[] = stages.planes.map((p) => ({
    plane: p.plane,
    blocks: p.decomposition.blocks
      .filter((b) => b.vertices.length >= 3)
      .map(
        (b): Block => ({
          members: vertices(b.vertices),
          shape: (b.spqr?.nodes ?? []).map((n): ShapePiece => {
            const vs = vertices(n.vertices)
            if (n.kind === 'S') return { S: vs }
            if (n.kind === 'R') return { R: vs }
            return { P: [vs[0] as Vertex, vs[1] as Vertex] }
          }),
        }),
      ),
    twins: p.twins.map((t) => ({
      members: vertices(t.members),
      with: vertices(t.neighbours),
      adjacent: t.adjacent,
    })),
  }))
  const same = stages.shapes.same.map((c) => c.groups)
  const branch = (b: RankedBranch): Branch => ({
    at: vertexOf(b.at),
    via: vertices(b.via),
    order: b.order,
    holds: b.holds,
    branches: b.branches.map(branch),
  })
  const beyond = (b: Beyond) => ('group' in b ? b : vertexOf(b.vertex))
  const edges = stages.edges.map(
    (e): Edge => ({
      group: e.group,
      unit: e.unit,
      toward: e.toward.map(beyond),
      ...(e.members
        ? { members: e.members.map((m) => ({ node: m.node, toward: m.toward.map(beyond) })) }
        : {}),
    }),
  )
  return {
    nodes,
    planes,
    same,
    entrances: stages.entrances.map((e) => ({
      vertex: vertexOf(e.vertex),
      toward: vertices(e.toward),
    })),
    ...(stages.trunk
      ? {
          trunk: {
            vertices: vertices(stages.trunk.vertices),
            blocks: stages.trunk.blocks.filter((b) => b.length >= 3).map(vertices),
          },
        }
      : {}),
    branches: stages.branches.map(branch),
    edges,
  }
}

/**
 * The structure a written network implies. A network is the `config` of a read model
 * (`readNetworkModel(yaml).config`); the result refers to it by its written ids.
 */
export function deriveStructure(network: input.Network): Structure {
  return structureOf(deriveStages(network))
}

export { analysisGraph } from './analysis-graph.js'
export { decompose } from './decompose.js'
export { setKey } from './keys.js'
export { derivePlanes } from './planes.js'
export { canonicalForm, deriveShapes, SHAPE_LIMIT } from './shapes.js'
export type {
  AnalysisGraph,
  Beyond,
  Decomposition,
  PlaneGraph,
  PlaneStage,
  Shapes,
  Stages,
  TwinSet,
  Units,
  VertexRef,
} from './stage-types.js'
export { findTwins } from './twins.js'
export type {
  Block,
  Branch,
  Destination,
  Edge,
  Entrance,
  GroupId,
  NodeId,
  Plane,
  RedundancyId,
  RoutingDomainId,
  SegmentId,
  ShapePiece,
  Structure,
  Trunk,
  Twins,
  UnitId,
  Vertex,
} from './types.js'
export { deriveUnits } from './units.js'

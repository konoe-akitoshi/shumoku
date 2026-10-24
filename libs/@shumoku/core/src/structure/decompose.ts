// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { segmentRef } from './analysis-graph.js'
import { compare, setKey, sorted } from './keys.js'
import { splitBlock } from './spqr.js'
import type {
  AnalysisEdge,
  AnalysisGraph,
  Block,
  CutVertex,
  Decomposition,
  End,
  SpqrEdge,
  SpqrNode,
  UnitEdge,
  Units,
  VertexRef,
} from './types.js'
import { unitRef } from './units.js'

/** The unit graph: units and the segments lines end at, joined by the lines between them. */
export function unitGraph(
  analysis: AnalysisGraph,
  units: Units,
): { vertices: VertexRef[]; edges: UnitEdge[] } {
  const unitOfNode = new Map<string, string>()
  for (const u of units.units) for (const m of u.members) unitOfNode.set(m, u.id)
  const refOf = (end: End): VertexRef | undefined => {
    if ('segment' in end) return segmentRef(end.segment)
    const unit = unitOfNode.get(end.node)
    return unit === undefined ? undefined : unitRef(unit)
  }
  const vertices = [
    ...units.units.map((u) => unitRef(u.id)),
    ...analysis.vertices.filter((v) => v.kind === 'segment').map((v) => v.ref),
  ].sort(compare)

  const pairs = new Map<string, { a: VertexRef; b: VertexRef; lines: AnalysisEdge[] }>()
  for (const edge of analysis.edges) {
    const x = refOf(edge.ends[0])
    const y = refOf(edge.ends[1])
    if (x === undefined || y === undefined || x === y) continue
    const [a, b] = compare(x, y) <= 0 ? [x, y] : [y, x]
    const key = `${a}\0${b}`
    const pair = pairs.get(key) ?? { a, b, lines: [] }
    pair.lines.push(edge)
    pairs.set(key, pair)
  }
  const edges = [...pairs.entries()]
    .sort(([x], [y]) => compare(x, y))
    .map(([, p]) => ({
      a: p.a,
      b: p.b,
      multiplicity: p.lines.reduce((n, l) => n + l.multiplicity, 0),
      lines: p.lines,
    }))
  return { vertices, edges }
}

/**
 * Stage 3. The block-cut tree of the unit graph, and the SPQR tree of each block of three or
 * more vertices.
 */
export function decompose(analysis: AnalysisGraph, units: Units): Decomposition {
  const { vertices, edges } = unitGraph(analysis, units)
  const index = new Map(vertices.map((v, i) => [v, i]))
  const adj: { to: number; edge: number }[][] = vertices.map(() => [])
  for (const [i, e] of edges.entries()) {
    const a = index.get(e.a) ?? 0
    const b = index.get(e.b) ?? 0
    adj[a]?.push({ to: b, edge: i })
    adj[b]?.push({ to: a, edge: i })
  }

  // Biconnected components, by the edges they hold.
  const depth: number[] = vertices.map(() => -1)
  const low: number[] = vertices.map(() => 0)
  const edgeStack: number[] = []
  const groups: number[][] = []
  const visit = (v: number, viaEdge: number, d: number): void => {
    depth[v] = d
    low[v] = d
    for (const { to, edge } of adj[v] ?? []) {
      if (edge === viaEdge) continue
      if ((depth[to] ?? -1) < 0) {
        edgeStack.push(edge)
        visit(to, edge, d + 1)
        low[v] = Math.min(low[v] ?? d, low[to] ?? d)
        if ((low[to] ?? 0) >= d) {
          const group: number[] = []
          for (let e = edgeStack.pop(); e !== undefined; e = edgeStack.pop()) {
            group.push(e)
            if (e === edge) break
          }
          groups.push(group)
        }
      } else if ((depth[to] ?? 0) < d) {
        edgeStack.push(edge)
        low[v] = Math.min(low[v] ?? d, depth[to] ?? d)
      }
    }
  }
  for (const [v] of vertices.entries()) if ((depth[v] ?? -1) < 0) visit(v, -1, 0)

  const blocks: Block[] = []
  const inBlock = new Map<VertexRef, VertexRef[][]>()
  const addBlock = (block: Block) => {
    blocks.push(block)
    for (const v of block.vertices) inBlock.set(v, [...(inBlock.get(v) ?? []), [...block.vertices]])
  }
  const touched = new Set<VertexRef>()
  for (const group of groups) {
    const es = group
      .map((i) => edges[i])
      .filter((e): e is UnitEdge => e !== undefined)
      .sort((x, y) => compare(`${x.a}\0${x.b}`, `${y.a}\0${y.b}`))
    const vs = sorted(new Set(es.flatMap((e) => [e.a, e.b])))
    for (const v of vs) touched.add(v)
    const spqr = vs.length >= 3 ? { nodes: spqrNodes(vs, es) } : undefined
    addBlock({ vertices: vs, edges: es, ...(spqr ? { spqr } : {}) })
  }
  for (const v of vertices) if (!touched.has(v)) addBlock({ vertices: [v], edges: [] })
  blocks.sort((x, y) => compare(setKey(x.vertices), setKey(y.vertices)))

  const cutVertices: CutVertex[] = []
  for (const [vertex, list] of inBlock) {
    if (list.length < 2) continue
    cutVertices.push({
      vertex,
      blocks: list.sort((x, y) => compare(setKey(x), setKey(y))),
    })
  }
  cutVertices.sort((x, y) => compare(x.vertex, y.vertex))
  return { vertices, edges, blocks, cutVertices }
}

function spqrNodes(vs: readonly VertexRef[], es: readonly UnitEdge[]): SpqrNode[] {
  const at = new Map(vs.map((v, i) => [v, i]))
  const lines = es.map((e) => [at.get(e.a) ?? 0, at.get(e.b) ?? 0] as const)
  const { pieces, partner } = splitBlock(vs.length, lines)

  const nodes = pieces.map((p) => {
    const refs = p.vertices.map((i) => vs[i] as VertexRef)
    let ordered: VertexRef[]
    if (p.kind === 'S') ordered = cycleOrder(p.edges, vs)
    else ordered = sorted(refs)
    return { piece: p, ordered, key: `${p.kind}:${ordered.join('\0')}` }
  })
  const owner = new Map<number, string>()
  for (const n of nodes) for (const e of n.piece.edges) owner.set(e.id, n.key)

  return nodes
    .map((n) => {
      const spqrEdges: SpqrEdge[] = n.piece.edges
        .map((e): SpqrEdge => {
          const a = vs[Math.min(e.a, e.b)] as VertexRef
          const b = vs[Math.max(e.a, e.b)] as VertexRef
          const other = partner.get(e.id)
          const to = other === undefined ? undefined : owner.get(other)
          return to === undefined ? { kind: 'real', a, b } : { kind: 'virtual', a, b, to }
        })
        .sort((x, y) =>
          compare(
            `${x.a}\0${x.b}\0${x.kind === 'virtual' ? x.to : ''}`,
            `${y.a}\0${y.b}\0${y.kind === 'virtual' ? y.to : ''}`,
          ),
        )
      return { key: n.key, kind: n.piece.kind, vertices: n.ordered, edges: spqrEdges }
    })
    .sort((x, y) => compare(x.key, y.key))
}

/** The vertices of a cycle in the order round it, starting low and going towards the lower side. */
function cycleOrder(
  edges: readonly { a: number; b: number }[],
  vs: readonly VertexRef[],
): VertexRef[] {
  const next = new Map<number, number[]>()
  for (const e of edges) {
    next.set(e.a, [...(next.get(e.a) ?? []), e.b])
    next.set(e.b, [...(next.get(e.b) ?? []), e.a])
  }
  const name = (i: number) => vs[i] as VertexRef
  const start = [...next.keys()].sort((x, y) => compare(name(x), name(y)))[0]
  if (start === undefined) return []
  const around = (next.get(start) ?? []).sort((x, y) => compare(name(x), name(y)))
  let prev = start
  let cur = around[0] ?? start
  const order = [name(start)]
  while (cur !== start) {
    order.push(name(cur))
    const following = (next.get(cur) ?? []).find((x) => x !== prev) ?? start
    prev = cur
    cur = following
  }
  return order
}

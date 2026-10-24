// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The SPQR tree of one biconnected block, found by taking every separation pair the plain way:
 * a block holds tens of vertices, so trying each vertex and its cut vertices is enough. The
 * result does not depend on which pair is split first.
 */

export interface SpqrPieceEdge {
  readonly a: number
  readonly b: number
  readonly id: number
}

export interface SpqrPiece {
  readonly kind: 'S' | 'P' | 'R'
  readonly vertices: readonly number[]
  readonly edges: readonly SpqrPieceEdge[]
}

interface Piece {
  vertices: number[]
  edges: SpqrPieceEdge[]
}

/** The pieces of a block of `size` vertices (numbered from 0), 3 or more, with simple edges. */
export function splitBlock(
  size: number,
  lines: readonly (readonly [number, number])[],
): { pieces: SpqrPiece[]; partner: Map<number, number> } {
  const partner = new Map<number, number>()
  let nextId = lines.length
  const terminals: SpqrPiece[] = []
  const stack: Piece[] = [
    {
      vertices: Array.from({ length: size }, (_, i) => i),
      edges: lines.map(([a, b], id) => ({ a, b, id })),
    },
  ]

  while (true) {
    const piece = stack.pop()
    if (!piece) break
    const n = piece.vertices.length
    if (n === 2) {
      terminals.push({ kind: 'P', ...piece })
      continue
    }
    if (isCycle(piece)) {
      terminals.push({ kind: 'S', ...piece })
      continue
    }
    const pair = findSeparation(piece)
    if (!pair) {
      terminals.push({ kind: 'R', ...piece })
      continue
    }
    const [a, b] = pair
    const classes = separationClasses(piece, a, b)
    const alone = classes.filter((c) => c.length === 1 && isBetween(c[0], a, b))
    const large = classes.filter((c) => !(c.length === 1 && isBetween(c[0], a, b)))
    const around = (cls: SpqrPieceEdge[], standIn: number): Piece => {
      const vs = new Set<number>([a, b])
      for (const e of cls) {
        vs.add(e.a)
        vs.add(e.b)
      }
      return {
        vertices: [...vs].sort((x, y) => x - y),
        edges: [...cls, { a, b, id: standIn }],
      }
    }
    const [first, second] = large
    if (alone.length === 0 && large.length === 2 && first && second) {
      // Two pieces face each other across the pair: their stand-ins are each other's.
      const x = nextId++
      const y = nextId++
      partner.set(x, y)
      partner.set(y, x)
      stack.push(around(first, x), around(second, y))
      continue
    }
    const bond: SpqrPieceEdge[] = alone.map((c) => c[0] as SpqrPieceEdge)
    for (const cls of large) {
      const here = nextId++
      const there = nextId++
      partner.set(here, there)
      partner.set(there, here)
      stack.push(around(cls, here))
      bond.push({ a, b, id: there })
    }
    terminals.push({ kind: 'P', vertices: [a, b], edges: bond })
  }

  return { pieces: mergeLike(terminals, partner), partner }
}

const isBetween = (e: SpqrPieceEdge | undefined, a: number, b: number) =>
  e !== undefined && ((e.a === a && e.b === b) || (e.a === b && e.b === a))

function isCycle(piece: Piece): boolean {
  if (piece.edges.length !== piece.vertices.length) return false
  const degree = new Map<number, number>()
  for (const e of piece.edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1)
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1)
  }
  return piece.vertices.every((v) => degree.get(v) === 2)
}

function adjacency(piece: Piece, skip: readonly number[]): Map<number, number[]> {
  const adj = new Map<number, number[]>()
  for (const v of piece.vertices) if (!skip.includes(v)) adj.set(v, [])
  for (const e of piece.edges) {
    if (skip.includes(e.a) || skip.includes(e.b)) continue
    adj.get(e.a)?.push(e.b)
    adj.get(e.b)?.push(e.a)
  }
  return adj
}

/** A separation pair of the piece, when it has one. */
function findSeparation(piece: Piece): readonly [number, number] | undefined {
  const mult = new Map<string, number>()
  for (const e of piece.edges) {
    const key = e.a < e.b ? `${e.a},${e.b}` : `${e.b},${e.a}`
    mult.set(key, (mult.get(key) ?? 0) + 1)
  }
  const vertices = [...piece.vertices].sort((x, y) => x - y)
  for (const a of vertices) {
    const cuts = articulationPoints(adjacency(piece, [a]))
    for (const b of vertices) {
      if (b === a) continue
      const [lo, hi] = a < b ? [a, b] : [b, a]
      if (cuts.has(b) || (mult.get(`${lo},${hi}`) ?? 0) >= 2) return [lo, hi]
    }
  }
  return undefined
}

function articulationPoints(adj: ReadonlyMap<number, readonly number[]>): Set<number> {
  const found = new Set<number>()
  const depth = new Map<number, number>()
  const low = new Map<number, number>()
  const visit = (v: number, parent: number | undefined, d: number): void => {
    depth.set(v, d)
    low.set(v, d)
    let children = 0
    for (const w of adj.get(v) ?? []) {
      const dw = depth.get(w)
      if (dw === undefined) {
        children++
        visit(w, v, d + 1)
        low.set(v, Math.min(low.get(v) ?? d, low.get(w) ?? d))
        if (parent !== undefined && (low.get(w) ?? 0) >= d) found.add(v)
      } else if (w !== parent) {
        low.set(v, Math.min(low.get(v) ?? d, dw))
      }
    }
    if (parent === undefined && children > 1) found.add(v)
  }
  for (const v of adj.keys()) if (!depth.has(v)) visit(v, undefined, 0)
  return found
}

/** The edges of the piece grouped by what is left when the pair is taken out. */
function separationClasses(piece: Piece, a: number, b: number): SpqrPieceEdge[][] {
  const adj = adjacency(piece, [a, b])
  const comp = new Map<number, number>()
  let count = 0
  for (const v of adj.keys()) {
    if (comp.has(v)) continue
    const work = [v]
    comp.set(v, count)
    for (let w = work.pop(); w !== undefined; w = work.pop()) {
      for (const x of adj.get(w) ?? []) {
        if (comp.has(x)) continue
        comp.set(x, count)
        work.push(x)
      }
    }
    count++
  }
  const classes: SpqrPieceEdge[][] = Array.from({ length: count }, () => [])
  const alone: SpqrPieceEdge[][] = []
  for (const e of piece.edges) {
    const ea = e.a === a || e.a === b
    const eb = e.b === a || e.b === b
    if (ea && eb) alone.push([e])
    else classes[comp.get(ea ? e.b : e.a) ?? 0]?.push(e)
  }
  return [...classes, ...alone]
}

/** Joins neighbouring pieces of the same kind, S with S and P with P. */
function mergeLike(terminals: readonly SpqrPiece[], partner: Map<number, number>): SpqrPiece[] {
  let pieces = terminals.map((p) => ({ ...p, edges: [...p.edges], vertices: [...p.vertices] }))
  while (true) {
    const owner = new Map<number, number>()
    for (const [i, p] of pieces.entries()) for (const e of p.edges) owner.set(e.id, i)
    let merged = false
    for (const [i, p] of pieces.entries()) {
      if (p.kind === 'R') continue
      for (const e of p.edges) {
        const other = partner.get(e.id)
        if (other === undefined) continue
        const j = owner.get(other)
        if (j === undefined || j === i || pieces[j]?.kind !== p.kind) continue
        const q = pieces[j] as SpqrPiece
        const edges = [...p.edges, ...q.edges].filter((x) => x.id !== e.id && x.id !== other)
        const vertices = [...new Set([...p.vertices, ...q.vertices])].sort((x, y) => x - y)
        partner.delete(e.id)
        partner.delete(other)
        pieces = pieces.filter((_, k) => k !== i && k !== j)
        pieces.push({ kind: p.kind, vertices, edges })
        merged = true
        break
      }
      if (merged) break
    }
    if (!merged) return pieces
  }
}

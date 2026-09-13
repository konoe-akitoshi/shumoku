import { nodeBoundaryPoint, segmentHits } from './tmp-test6-v7-boundary-routing.mjs'

export { nodeBoundaryPoint } from './tmp-test6-v7-boundary-routing.mjs'

const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)

// Internal wires and node-to-boundary stubs, clipped to the displayed node boxes.
// Fixed-terminal tail lengths make the ordering objective use complete link lengths.
export function groupInteriorMetrics(nodes, members, internal, terminals, positions) {
  const segments = []
  let squaredLength = 0
  for (const l of internal) {
    const a = positions[l.a],
      b = positions[l.b]
    squaredLength += (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    segments.push({
      a: nodeBoundaryPoint(nodes, positions, l.a, b),
      b: nodeBoundaryPoint(nodes, positions, l.b, a),
      ends: [l.a, l.b],
    })
  }
  for (const t of terminals) {
    const p = positions[t.node]
    squaredLength += (Math.hypot(p.x - t.x, p.y - t.y) + (t.tailLength ?? 0)) ** 2
    segments.push({ a: nodeBoundaryPoint(nodes, positions, t.node, t), b: t, ends: [t.node] })
  }
  let crossings = 0,
    nodeHits = 0,
    overlaps = 0
  for (const [i, s] of segments.entries()) {
    for (const n of members) {
      if (s.ends.includes(n)) continue
      const p = positions[n],
        box = nodes[n]
      if (
        segmentHits(s.a, s.b, {
          left: p.x - box.w / 2,
          right: p.x + box.w / 2,
          top: p.y - box.h / 2,
          bottom: p.y + box.h / 2,
        })
      )
        nodeHits++
    }
    for (const t of segments.slice(0, i)) {
      if (
        orient(s.a, s.b, t.a) * orient(s.a, s.b, t.b) < -1e-6 &&
        orient(t.a, t.b, s.a) * orient(t.a, t.b, s.b) < -1e-6
      )
        crossings++
      if (Math.abs(orient(s.a, s.b, t.a)) > 1e-6 || Math.abs(orient(s.a, s.b, t.b)) > 1e-6) continue
      const axis = Math.abs(s.a.x - s.b.x) > Math.abs(s.a.y - s.b.y) ? 'x' : 'y'
      const length =
        Math.min(Math.max(s.a[axis], s.b[axis]), Math.max(t.a[axis], t.b[axis])) -
        Math.max(Math.min(s.a[axis], s.b[axis]), Math.min(t.a[axis], t.b[axis]))
      if (length > 1e-6) overlaps++
    }
  }
  return { crossings, nodeHits, overlaps, squaredLength }
}

export function interiorMetrics(nodes, groups, links, positions, terminals) {
  const reports = groups.map((g, gi) => ({
    id: g.id,
    ...groupInteriorMetrics(
      nodes,
      g.members,
      links.filter((l) => l.ga === gi && l.gb === gi),
      terminals.filter((t) => t.g === gi),
      positions,
    ),
  }))
  return {
    internalCrossings: reports.reduce((s, r) => s + r.crossings, 0),
    internalNodeHits: reports.reduce((s, r) => s + r.nodeHits, 0),
    internalOverlaps: reports.reduce((s, r) => s + r.overlaps, 0),
    groups: reports,
  }
}

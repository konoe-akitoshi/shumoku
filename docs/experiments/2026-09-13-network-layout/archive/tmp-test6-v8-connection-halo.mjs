import { areaHalo, haloPairs } from './tmp-test6-v8-area-halo.mjs'

const emptyCounts = () => ({ left: 0, right: 0, top: 0, bottom: 0 })
export function endpointSide(rect, point) {
  if (!point) throw new Error('Missing node endpoint')
  const distances = [
    ['left', Math.abs(point.x - (rect.x - rect.w / 2))],
    ['right', Math.abs(point.x - (rect.x + rect.w / 2))],
    ['top', Math.abs(point.y - (rect.y - rect.h / 2))],
    ['bottom', Math.abs(point.y - (rect.y + rect.h / 2))],
  ].sort((a, b) => a[1] - b[1])
  if (distances[0][1] > 1e-5) throw new Error('Endpoint is not on the node boundary')
  return distances[0][0]
}

export function connectionCounts(nodes, groups, links, terminals) {
  const nodeCounts = nodes.map(emptyCounts),
    groupCounts = groups.map(emptyCounts)
  for (const l of links) {
    nodeCounts[l.a][endpointSide(nodes[l.a], l.points[0])]++
    nodeCounts[l.b][endpointSide(nodes[l.b], l.points.at(-1))]++
  }
  // One boundary terminal per external link end. Internal links add nothing here.
  // Parallel link records count separately even when they share a node midpoint.
  for (const t of terminals) {
    if (!(t.side in groupCounts[t.g])) throw new Error('Invalid terminal side')
    groupCounts[t.g][t.side]++
  }
  return { nodeCounts, groupCounts }
}

export function directionalHalo(rect, stroke, ratio, counts) {
  const base = areaHalo(rect, stroke, ratio)
  if (
    !['left', 'right', 'top', 'bottom'].every(
      (side) => Number.isInteger(counts[side]) && counts[side] >= 0,
    )
  )
    throw new Error('Invalid connection count')
  const count = Object.values(counts).reduce((s, n) => s + n, 0)
  const effectiveRatio = ratio * Math.sqrt(1 + count)
  const w = rect.w + stroke,
    h = rect.h + stroke
  const bandArea = effectiveRatio * w * h,
    extraArea = bandArea - base.bandArea
  // Keep the isotropic base band. Distribute only the connection-derived surplus
  // by per-side count / edge length. Solve the corner-inclusive area exactly.
  const weights = {
    left: counts.left / h,
    right: counts.right / h,
    top: counts.top / w,
    bottom: counts.bottom / w,
  }
  const sx = weights.left + weights.right,
    sy = weights.top + weights.bottom
  const c = base.h * sx + base.w * sy,
    q = sx * sy
  const t =
    extraArea > 0 && c > 0 ? (2 * extraArea) / (Math.sqrt(c * c + 4 * q * extraArea) + c) : 0
  const sides = Object.fromEntries(
    Object.entries(weights).map(([side, weight]) => [side, base.thickness + t * weight]),
  )
  return {
    ...rect,
    x: rect.x + (sides.right - sides.left) / 2,
    y: rect.y + (sides.bottom - sides.top) / 2,
    w: w + sides.left + sides.right,
    h: h + sides.top + sides.bottom,
    sides,
    baseThickness: base.thickness,
    bandArea,
    effectiveRatio,
    count,
    counts: { ...counts },
  }
}

export function connectionHalos(nodes, groups, links, terminals, nodeStroke, frameStroke, ratio) {
  const { nodeCounts, groupCounts } = connectionCounts(nodes, groups, links, terminals)
  return {
    nodes: nodes.map((n, i) => directionalHalo(n, nodeStroke, ratio, nodeCounts[i])),
    groups: groups.map((g, i) => directionalHalo(g, frameStroke, ratio, groupCounts[i])),
  }
}

export function measureConnectionHaloSpacing(
  nodes,
  groups,
  links,
  terminals,
  nodeStroke,
  frameStroke,
  ratio,
) {
  const halos = connectionHalos(nodes, groups, links, terminals, nodeStroke, frameStroke, ratio)
  const n = haloPairs(nodes, nodeStroke, ratio, halos.nodes),
    g = haloPairs(groups, frameStroke, ratio, halos.groups)
  return {
    nodeHaloPenalty: n.penalty,
    groupHaloPenalty: g.penalty,
    nodeHaloPairs: n.pairs.length,
    groupHaloPairs: g.pairs.length,
    nodeContactPairs: n.contactPairs,
    groupContactPairs: g.contactPairs,
    nodeMinVisibleGap: n.minVisibleGap,
    groupMinVisibleGap: g.minVisibleGap,
    nodeHaloThickness: n.thickness,
    groupHaloThickness: g.thickness,
  }
}

export function haloProfiles(halos) {
  return Object.fromEntries(
    Object.entries(halos).map(([kind, items]) => [
      kind,
      items.map((h) => ({
        id: h.id,
        connections: h.count,
        sideCounts: h.counts,
        effectiveRatio: h.effectiveRatio,
        bandArea: h.bandArea,
        baseThickness: h.baseThickness,
        sides: h.sides,
      })),
    ]),
  )
}

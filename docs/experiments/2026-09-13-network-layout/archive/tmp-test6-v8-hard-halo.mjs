import { boundaryTerminals } from './tmp-test6-v7-boundary-search.mjs'
import { connectionHalos } from './tmp-test6-v8-connection-halo.mjs'
import { nodeSideMidpoint } from './tmp-test6-v8-node-attachments.mjs'

const seq = (n) => Array.from({ length: n }, (_, i) => i)
export function haloOverlapPairs(items, tolerance = 1e-6) {
  const pairs = []
  for (const [i, a] of items.entries())
    for (const j of seq(i)) {
      const b = items[j]
      const x = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)
      const y = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2)
      if (x > tolerance && y > tolerance) pairs.push({ i, j, x, y })
    }
  return pairs
}

// External routing cannot change the selected node attachment sides. Compute
// those exact endpoints cheaply during projection; fully reroute before scoring.
export function endpointGeometry(nodes, groups, links) {
  const terminals = boundaryTerminals(groups, links, nodes)
  const lookup = new Map(terminals.map((t) => [`${t.li}:${t.end}`, t]))
  return {
    terminals,
    links: links.map((l, li) => ({
      ...l,
      points: [
        nodeSideMidpoint(nodes, nodes, l.a, l.ga === l.gb ? nodes[l.b] : lookup.get(`${li}:a`)),
        nodeSideMidpoint(nodes, nodes, l.b, l.ga === l.gb ? nodes[l.a] : lookup.get(`${li}:b`)),
      ],
    })),
  }
}

export function projectHardHalos(
  input,
  {
    groups,
    links,
    insets,
    root,
    nodeStroke,
    frameStroke,
    areaRatio,
    fitFrames,
    maxPasses = 128,
    onPass = () => {},
    rigidInteriors = false,
    endpointProvider = endpointGeometry,
  },
) {
  let nodes = input.map((n) => ({ ...n }))
  const groupOf = new Map(groups.flatMap((g, gi) => g.members.map((i) => [i, gi])))
  const rootGroup = groupOf.get(root)
  const envelopes = { nodes: [], groups: [] }
  const axes = new Map()
  const initialGroups = fitFrames(groups, input, insets)
  let corrections = 0
  const refresh = () => {
    const boxes = fitFrames(groups, nodes, insets)
    const routing = endpointProvider(nodes, boxes, links)
    const requiredHalos = connectionHalos(
      nodes,
      boxes,
      routing.links,
      routing.terminals,
      nodeStroke,
      frameStroke,
      areaRatio,
    )
    const halos = Object.fromEntries(
      ['nodes', 'groups'].map((kind) => [
        kind,
        requiredHalos[kind].map((h, i) => {
          const old = envelopes[kind][i] ?? h.sides
          const sides = Object.fromEntries(
            Object.keys(h.sides).map((s) => [s, Math.max(old[s], h.sides[s])]),
          )
          envelopes[kind][i] = sides
          const r = kind === 'nodes' ? nodes[i] : boxes[i],
            stroke = kind === 'nodes' ? nodeStroke : frameStroke
          return {
            ...h,
            sides,
            x: r.x + (sides.right - sides.left) / 2,
            y: r.y + (sides.bottom - sides.top) / 2,
            w: r.w + stroke + sides.left + sides.right,
            h: r.h + stroke + sides.top + sides.bottom,
          }
        }),
      ]),
    )
    return { groups: boxes, halos, requiredHalos }
  }
  const shift = (members, dx, dy) => {
    const set = new Set(members)
    nodes = nodes.map((n, i) => (set.has(i) ? { ...n, x: n.x + dx, y: n.y + dy } : n))
  }
  const split = (ma, mb, dx, dy) => {
    const fa = ma.includes(root) ? 0 : mb.includes(root) ? 1 : 0.5
    const fb = mb.includes(root) ? 0 : ma.includes(root) ? 1 : 0.5
    shift(ma, dx * fa, dy * fa)
    shift(mb, -dx * fb, -dy * fb)
    return { fa, fb }
  }
  const separate = (boxes, i, j, ma, mb) => {
    const a = boxes[i],
      b = boxes[j]
    const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x)
    const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y)
    if (ox <= 1e-6 || oy <= 1e-6) return boxes
    const sameGroup = groupOf.get(ma[0]) === groupOf.get(mb[0])
    const ia = sameGroup ? ma[0] : groupOf.get(ma[0]),
      ib = sameGroup ? mb[0] : groupOf.get(mb[0])
    const referenceA = sameGroup ? input[ia] : initialGroups[ia],
      referenceB = sameGroup ? input[ib] : initialGroups[ib]
    const sx = Math.sign(referenceA.x - referenceB.x || ia - ib)
    const sy =
      sameGroup && referenceA.depth !== referenceB.depth
        ? Math.sign(referenceA.depth - referenceB.depth)
        : Math.sign(referenceA.y - referenceB.y || ia - ib)
    const tx = sx > 0 ? b.x + b.w / 2 - (a.x - a.w / 2) : a.x + a.w / 2 - (b.x - b.w / 2)
    const ty = sy > 0 ? b.y + b.h / 2 - (a.y - a.h / 2) : a.y + a.h / 2 - (b.y - b.h / 2)
    const key = `${sameGroup ? 'nodes' : 'groups'}:${Math.min(ia, ib)}:${Math.max(ia, ib)}`
    const axis = axes.get(key) ?? (tx < ty ? 'x' : 'y')
    axes.set(key, axis)
    const dx = axis === 'x' ? sx * tx : 0
    const dy = axis === 'y' ? sy * ty : 0
    let fa, fb
    if (sameGroup) ({ fa, fb } = split(ma, mb, dx, dy))
    else {
      // Ordered one-sided propagation avoids slowly shuttling a deficit back
      // and forth along a chain. Restore the absolute anchor after the pass.
      fa = (axis === 'x' ? sx : sy) > 0 ? 1 : 0
      fb = 1 - fa
      shift(ma, dx * fa, dy * fa)
      shift(mb, -dx * fb, -dy * fb)
    }
    corrections++
    return boxes.map((box, index) =>
      index === i
        ? { ...a, x: a.x + dx * fa, y: a.y + dy * fa }
        : index === j
          ? { ...b, x: b.x - dx * fb, y: b.y - dy * fb }
          : box,
    )
  }
  for (const pass of seq(maxPasses)) {
    let geometry = refresh()
    let nodeBoxes = geometry.halos.nodes.map((n) => ({ ...n }))
    // Interior corrections act on nodes; cross-group corrections act on their
    // complete groups, so group membership and interior geometry stay coherent.
    for (const { i, j } of haloOverlapPairs(nodeBoxes)) {
      const ga = groupOf.get(i),
        gb = groupOf.get(j)
      if (ga === gb && !rigidInteriors) nodeBoxes = separate(nodeBoxes, i, j, [i], [j])
    }
    // Restore existing depth order after node projection. No new rows or folds.
    for (const g of groups)
      for (const i of g.members)
        for (const j of g.members) {
          if (nodes[i].depth >= nodes[j].depth) continue
          const deficit = nodes[i].y + nodes[i].h / 2 + nodeStroke - (nodes[j].y - nodes[j].h / 2)
          if (deficit > 1e-6 && !rigidInteriors) {
            split([i], [j], 0, -deficit)
            corrections++
          }
        }
    geometry = refresh()
    let groupBoxes = geometry.halos.groups.map((g) => ({ ...g }))
    for (const { i, j } of haloOverlapPairs(groupBoxes))
      groupBoxes = separate(groupBoxes, i, j, groups[i].members, groups[j].members)
    shift(seq(nodes.length), input[root].x - nodes[root].x, input[root].y - nodes[root].y)
    geometry = refresh()
    // Occasionally a high-degree node band extends beyond its own frame band.
    for (const { i, j } of haloOverlapPairs(geometry.halos.nodes)) {
      const ga = groupOf.get(i),
        gb = groupOf.get(j)
      if (ga !== gb) {
        const boxes = geometry.halos.nodes.map((n) => ({ ...n }))
        separate(boxes, i, j, groups[ga].members, groups[gb].members)
        shift(seq(nodes.length), input[root].x - nodes[root].x, input[root].y - nodes[root].y)
        geometry = refresh()
      }
    }
    let ordered = true
    for (const g of groups)
      for (const i of g.members)
        for (const j of g.members)
          if (
            nodes[i].depth < nodes[j].depth &&
            nodes[i].y + nodes[i].h / 2 + nodeStroke > nodes[j].y - nodes[j].h / 2 + 1e-6
          )
            ordered = false
    onPass({
      pass,
      ordered,
      nodePairs: haloOverlapPairs(geometry.requiredHalos.nodes),
      groupPairs: haloOverlapPairs(geometry.requiredHalos.groups),
    })
    if (
      ordered &&
      !haloOverlapPairs(geometry.requiredHalos.nodes).length &&
      !haloOverlapPairs(geometry.requiredHalos.groups).length
    ) {
      if (
        nodes[root].x !== input[root].x ||
        nodes[root].y !== input[root].y ||
        rootGroup === undefined
      )
        throw new Error('Lost Internet anchor')
      return { nodes, groups: geometry.groups, corrections, haloProjectionPasses: pass + 1 }
    }
  }
  return null // Never accept an unresolved band overlap as a cheaper diagram.
}

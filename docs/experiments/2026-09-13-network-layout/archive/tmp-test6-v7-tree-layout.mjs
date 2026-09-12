// Display hierarchy from topology only. No width cap, folding, role tiers, or glyph scaling.
const seq = (n) => Array.from({ length: n }, (_, i) => i)
export function deriveRootedTreeSizes(nodes, groups, links, explicitRoot) {
  const adjacency = nodes.map(() => new Set())
  for (const l of links) {
    adjacency[l.a].add(l.b)
    adjacency[l.b].add(l.a)
  }
  const distance = new Array(nodes.length).fill(Infinity)
  distance[explicitRoot] = 0
  const queue = [explicitRoot]
  for (const i of queue)
    for (const j of adjacency[i])
      if (!Number.isFinite(distance[j])) {
        distance[j] = distance[i] + 1
        queue.push(j)
      }
  if (distance.some((d) => !Number.isFinite(d)))
    throw new Error('Unreachable node from explicit root')
  return groups.map((g) => {
    // Compress unused depths locally: preserve order, do not insert empty rows.
    const ranks = [...new Set(g.members.map((i) => distance[i]))].sort((a, b) => a - b)
    const levels = ranks.map((rank) => g.members.filter((i) => distance[i] === rank))
    const depth = Object.fromEntries(levels.flatMap((row, d) => row.map((i) => [i, d])))
    const parents = Object.fromEntries(
      g.members.map((i) => [
        i,
        [...adjacency[i]].filter((j) => g.members.includes(j) && distance[j] < distance[i]),
      ]),
    )
    const widths = levels.map(
      (row) => row.reduce((s, i) => s + nodes[i].w, 0) + 18 * (row.length - 1),
    )
    const heights = levels.map((row) => Math.max(...row.map((i) => nodes[i].h)))
    return {
      ...g,
      w: Math.max(...widths, g.label.length * 7) + 48,
      h: heights.reduce((a, b) => a + b, 0) + 20 * (levels.length - 1) + 68,
      hierarchy: {
        roots: g.members.filter((i) => parents[i].length === 0),
        levels,
        widths,
        heights,
        depth,
        parents,
        // Compatibility field only; all dependencies remain in parents and links.
        parent: Object.fromEntries(
          g.members.filter((i) => parents[i].length).map((i) => [i, parents[i][0]]),
        ),
        rootDistances: Object.fromEntries(g.members.map((i) => [i, distance[i]])),
      },
    }
  })
}
export function deriveTreeSizes(nodes, groups, links, explicitRoot) {
  const adjacency = nodes.map(() => new Set())
  for (const l of links)
    if (l.ga === l.gb) {
      adjacency[l.a].add(l.b)
      adjacency[l.b].add(l.a)
    }
  return groups.map((g, gi) => {
    const roots = g.members.includes(explicitRoot)
      ? [explicitRoot]
      : [
          ...new Set(
            links
              .filter((l) => l.ga !== l.gb)
              .flatMap((l) => (l.ga === gi ? [l.a] : l.gb === gi ? [l.b] : [])),
          ),
        ]
    const depth = new Map(roots.map((i) => [i, 0]))
    const parent = new Map()
    const queue = [...roots]
    for (const i of queue)
      for (const j of [...adjacency[i]].sort((a, b) => a - b)) {
        if (depth.has(j)) continue
        depth.set(j, depth.get(i) + 1)
        parent.set(j, i)
        queue.push(j)
      }
    if (g.members.some((i) => !depth.has(i)))
      throw new Error(`No boundary-rooted hierarchy for ${g.label}`)
    const levels = seq(Math.max(...depth.values()) + 1).map((d) =>
      g.members.filter((i) => depth.get(i) === d),
    )
    const widths = levels.map(
      (row) => row.reduce((s, i) => s + nodes[i].w, 0) + 18 * (row.length - 1),
    )
    const heights = levels.map((row) => Math.max(...row.map((i) => nodes[i].h)))
    return {
      ...g,
      w: Math.max(...widths, g.label.length * 7) + 48,
      h: heights.reduce((a, b) => a + b, 0) + 20 * (levels.length - 1) + 68,
      hierarchy: {
        roots,
        levels,
        widths,
        heights,
        depth: Object.fromEntries(depth),
        parent: Object.fromEntries(parent),
      },
    }
  })
}
function permutations(xs) {
  if (xs.length < 2) return [[...xs]]
  return xs.flatMap((v, i) =>
    permutations(xs.filter((_, j) => j !== i)).map((rest) => [v, ...rest]),
  )
}
export function placeTree(nodes, group, internal, terminals) {
  const { hierarchy: h } = group
  let order = h.levels.map((row) => [...row])
  function place(rows) {
    const positions = new Map()
    let top = group.y - group.h / 2 + 44
    for (const [level, row] of rows.entries()) {
      let x = group.x - h.widths[level] / 2
      for (const i of row) {
        positions.set(i, { x: x + nodes[i].w / 2, y: top + h.heights[level] / 2 })
        x += nodes[i].w + 18
      }
      top += h.heights[level] + 20
    }
    let cost = 0
    for (const l of internal) {
      const a = positions.get(l.a),
        b = positions.get(l.b)
      cost += (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    }
    for (const t of terminals) {
      const p = positions.get(t.node)
      cost += (p.x - t.x) ** 2 + (p.y - t.y) ** 2
    }
    return { positions, cost }
  }
  let best = place(order)
  for (const _sweep of seq(2))
    for (const level of seq(order.length)) {
      for (const row of permutations(order[level])) {
        const trial = order.map((xs, i) => (i === level ? row : xs))
        const result = place(trial)
        if (result.cost < best.cost - 1e-6) {
          best = result
          order = trial
        }
      }
    }
  return { ...best, levels: order }
}

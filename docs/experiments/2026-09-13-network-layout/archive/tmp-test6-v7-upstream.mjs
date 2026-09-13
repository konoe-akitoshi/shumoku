// Explicit user root determines only the exterior upstream/downstream arrangement.
const seq = (n) => Array.from({ length: n }, (_, i) => i)
export function upstreamContext(
  groups,
  links,
  nodeCount,
  rootNode,
  rootGroup,
  previous,
  enforceGroupOrder = true,
) {
  const adjacency = Array.from({ length: nodeCount }, () => new Set())
  for (const l of links) {
    adjacency[l.a].add(l.b)
    adjacency[l.b].add(l.a)
  }
  const distances = new Array(nodeCount).fill(Infinity)
  distances[rootNode] = 0
  const queue = [rootNode]
  for (const i of queue)
    for (const j of adjacency[i])
      if (!Number.isFinite(distances[j])) {
        distances[j] = distances[i] + 1
        queue.push(j)
      }
  if (distances.some((d) => !Number.isFinite(d)))
    throw new Error('Some nodes are unreachable from the user-selected upstream root')
  const rank = groups.map((g) => Math.min(...g.members.map((i) => distances[i])))
  const parents = groups.map(() => new Set())
  for (const l of links) {
    if (l.ga === l.gb || rank[l.ga] === rank[l.gb]) continue
    if (rank[l.ga] < rank[l.gb]) parents[l.gb].add(l.ga)
    else parents[l.ga].add(l.gb)
  }
  const order = seq(groups.length).sort(
    (a, b) => rank[a] - rank[b] || previous[2 * a] - previous[2 * b] || a - b,
  )
  const gap = 20.001 // Existing two-sided exterior-route clearance, not a fixed level height.
  function project(input) {
    const z = input.slice()
    z[2 * rootGroup] = 0
    z[2 * rootGroup + 1] = 0
    for (const g of order) {
      if (g === rootGroup) continue
      let minimum = (groups[rootGroup].h + groups[g].h) / 2 + gap
      for (const p of enforceGroupOrder ? parents[g] : [])
        minimum = Math.max(minimum, z[2 * p + 1] + (groups[p].h + groups[g].h) / 2 + gap)
      z[2 * g + 1] = Math.max(z[2 * g + 1], minimum)
    }
    return z
  }
  const initial = previous.slice()
  initial[2 * rootGroup] = 0
  initial[2 * rootGroup + 1] = 0
  const placed = [rootGroup]
  for (const g of order) {
    if (g === rootGroup) continue
    let y = (groups[rootGroup].h + groups[g].h) / 2 + gap
    for (const p of enforceGroupOrder ? parents[g] : [])
      y = Math.max(y, initial[2 * p + 1] + (groups[p].h + groups[g].h) / 2 + gap)
    initial[2 * g + 1] = y
    const occupied = placed.filter(
      (p) => Math.abs(initial[2 * p + 1] - y) < (groups[p].h + groups[g].h) / 2 + gap,
    )
    const target = previous[2 * g]
    const xs = [
      target,
      ...occupied.flatMap((p) => [
        initial[2 * p] - (groups[p].w + groups[g].w) / 2 - gap,
        initial[2 * p] + (groups[p].w + groups[g].w) / 2 + gap,
      ]),
    ].sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
    const x = xs.find((x) =>
      occupied.every(
        (p) => Math.abs(initial[2 * p] - x) >= (groups[p].w + groups[g].w) / 2 + gap - 1e-6,
      ),
    )
    if (x === undefined) throw new Error('No upstream initial placement')
    initial[2 * g] = x
    placed.push(g)
  }
  function violations(z) {
    let count = 0
    for (const g of order) {
      if (g === rootGroup) continue
      if (z[2 * g + 1] < (groups[rootGroup].h + groups[g].h) / 2 + gap - 1e-6) count++
      for (const p of enforceGroupOrder ? parents[g] : [])
        if (z[2 * g + 1] < z[2 * p + 1] + (groups[p].h + groups[g].h) / 2 + gap - 1e-6) count++
    }
    return count
  }
  return { initial, project, violations, distances, rank, parents: parents.map((ps) => [...ps]) }
}

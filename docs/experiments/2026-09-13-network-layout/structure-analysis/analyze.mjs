// Read-only structural analysis: no roles, coordinates, or selected root.
export function adjacencyOf(graph) {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set()]))
  for (const link of graph.links) {
    const a = adjacency.get(link.from.node)
    const b = adjacency.get(link.to.node)
    if (!a || !b) throw new Error('Unknown link endpoint')
    if (link.from.node === link.to.node) continue
    a.add(link.to.node)
    b.add(link.from.node)
  }
  return adjacency
}

function distances(adjacency, root, removed = new Set()) {
  const result = new Map([[root, 0]])
  const queue = [root]
  for (const id of queue) {
    for (const peer of adjacency.get(id) ?? []) {
      if (removed.has(peer) || result.has(peer)) continue
      result.set(peer, result.get(id) + 1)
      queue.push(peer)
    }
  }
  return result
}

function components(adjacency, allowed) {
  const unseen = new Set(allowed)
  const result = []
  while (unseen.size) {
    const root = unseen.values().next().value
    const queue = [root]
    unseen.delete(root)
    for (const id of queue) {
      for (const peer of adjacency.get(id)) {
        if (!unseen.has(peer)) continue
        unseen.delete(peer)
        queue.push(peer)
      }
    }
    result.push(queue.sort())
  }
  return result
}

export function analyze(graph) {
  const adjacency = adjacencyOf(graph)
  const ids = [...adjacency.keys()].sort()
  const leaves = ids.filter((id) => adjacency.get(id).size === 1)
  const allDistances = new Map(ids.map((id) => [id, distances(adjacency, id)]))
  const pairs = leaves.flatMap((a, i) =>
    leaves
      .slice(i + 1)
      .filter((b) => allDistances.get(a).has(b))
      .map((b) => [a, b]),
  )
  const rows = ids.map((id) => {
    const sources = leaves.filter((leaf) => allDistances.get(leaf).has(id))
    const neighbors = [...adjacency.get(id)]
    const strict = sources.filter((leaf) => {
      const d = allDistances.get(leaf)
      return neighbors.every((peer) => d.get(peer) < d.get(id))
    }).length
    const weak = sources.filter((leaf) => {
      const d = allDistances.get(leaf)
      return neighbors.every((peer) => d.get(peer) <= d.get(id))
    }).length
    const dominators = sources.length
      ? ids.filter(
          (other) =>
            other !== id &&
            sources.every((leaf) => {
              const d = allDistances.get(leaf)
              return d.has(other) && d.get(other) >= d.get(id)
            }) &&
            sources.some(
              (leaf) => allDistances.get(leaf).get(other) > allDistances.get(leaf).get(id),
            ),
        )
      : []
    return {
      id,
      degree: neighbors.length,
      neighbors: neighbors.sort(),
      sources: sources.length,
      strict,
      weak,
      dominators,
      shortestLeafPairsThrough: pairs.filter(
        ([a, b]) =>
          id !== a &&
          id !== b &&
          allDistances.get(a).get(id) + allDistances.get(b).get(id) === allDistances.get(a).get(b),
      ).length,
    }
  })
  // A deliberately explicit hypothesis: maximal chains of degree-two nodes.
  // This is not claimed to represent all redundant regions or upstream domains.
  const chains = components(
    adjacency,
    ids.filter((id) => adjacency.get(id).size === 2),
  )
  const regions = chains.map((members) => {
    const removed = new Set(members)
    const after = new Map(leaves.map((leaf) => [leaf, distances(adjacency, leaf, removed)]))
    const boundary = [
      ...new Set(
        members.flatMap((id) => [...adjacency.get(id)].filter((peer) => !removed.has(peer))),
      ),
    ].sort()
    const remaining = components(
      adjacency,
      ids.filter((id) => !removed.has(id)),
    )
    return {
      members,
      boundary,
      boundaryAdjacent: boundary.length === 2 && adjacency.get(boundary[0]).has(boundary[1]),
      disconnectedLeafPairs: pairs.filter(([a, b]) => !after.get(a).has(b)).length,
      lengthenedLeafPairs: pairs.filter(
        ([a, b]) => after.get(a).has(b) && after.get(a).get(b) > allDistances.get(a).get(b),
      ).length,
      remainingComponents: remaining.map((part) => ({
        nodes: part.length,
        leaves: part.filter((id) => leaves.includes(id)).length,
      })),
    }
  })
  return {
    nodes: ids.length,
    links: graph.links.length,
    leaves,
    connectedLeafPairs: pairs.length,
    components: components(adjacency, ids),
    rows,
    regions,
  }
}

if (import.meta.main) {
  const graph = await Bun.file(
    new URL('../archive/tmp-test6-complete-upstream-to-ap.json', import.meta.url),
  ).json()
  const withoutInternet = {
    nodes: graph.nodes.filter((node) => node.id !== 'test:internet'),
    links: graph.links.filter(
      (link) => link.from.node !== 'test:internet' && link.to.node !== 'test:internet',
    ),
  }
  const report = { original: analyze(graph), withoutInternet: analyze(withoutInternet) }
  await Bun.write(new URL('./report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`)
  for (const [name, result] of Object.entries(report)) {
    const interesting = new Set([
      'test:internet',
      'test:isp-a',
      'test:isp-b',
      'discovered:13',
      'discovered:15',
      'discovered:17',
    ])
    console.log(
      JSON.stringify(
        {
          name,
          leaves: result.leaves.length,
          pairs: result.connectedLeafPairs,
          rows: result.rows.filter((row) => interesting.has(row.id)),
          regions: result.regions.filter((region) =>
            region.members.some((id) => interesting.has(id)),
          ),
          strictCommon: result.rows
            .filter((row) => row.sources > 0 && row.strict === row.sources)
            .map((row) => row.id),
          nonLeafParetoMaxima: result.rows
            .filter((row) => row.sources > 0 && row.degree > 1 && !row.dominators.length)
            .map((row) => row.id),
        },
        null,
        2,
      ),
    )
  }
}

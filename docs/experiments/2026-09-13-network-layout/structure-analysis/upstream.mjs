import { adjacencyOf } from './analyze.mjs'

// Rank non-leaf nodes by strict distance-maxima votes, one vote per unique
// attachment of degree-one endpoints. Keep all positive top ties per component.
// Scores measure structural agreement, not semantic certainty or probability.
export function detectUpstream(graph) {
  const adjacency = adjacencyOf(graph)
  const ids = [...adjacency.keys()].sort()
  const distancesFrom = (sources) => {
    const distance = new Map(sources.map((id) => [id, 0]))
    const queue = [...sources]
    for (const id of queue)
      for (const peer of adjacency.get(id))
        if (!distance.has(peer)) {
          distance.set(peer, distance.get(id) + 1)
          queue.push(peer)
        }
    return distance
  }
  const unseen = new Set(ids)
  const components = []
  for (const id of ids) {
    if (!unseen.has(id)) continue
    const members = [...distancesFrom([id]).keys()].sort()
    for (const member of members) unseen.delete(member)
    const endpoints = members.filter((member) => adjacency.get(member).size === 1)
    const attachments = new Map()
    for (const endpoint of endpoints) {
      const attachment = adjacency.get(endpoint).values().next().value
      const attached = attachments.get(attachment) ?? []
      attachments.set(attachment, [...attached, endpoint])
    }
    const sourceGroups = [...attachments.keys()].sort().map((attachment) => ({
      attachment,
      endpoints: attachments.get(attachment),
    }))
    const distances = sourceGroups.map(({ attachment }) => distancesFrom([attachment]))
    const candidates = members
      .filter((member) => adjacency.get(member).size > 1)
      .map((member) => {
        const supportingAttachments = sourceGroups
          .filter((_group, index) => {
            const d = distances[index]
            return [...adjacency.get(member)].every((peer) => d.get(peer) < d.get(member))
          })
          .map((group) => group.attachment)
        return {
          id: member,
          votes: supportingAttachments.length,
          total: sourceGroups.length,
          score: sourceGroups.length ? supportingAttachments.length / sourceGroups.length : 0,
          supportingAttachments,
        }
      })
      .sort((a, b) => b.votes - a.votes || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const bestVotes = candidates[0]?.votes ?? 0
    const roots =
      bestVotes > 0
        ? candidates
            .filter((candidate) => candidate.votes === bestVotes)
            .map((candidate) => candidate.id)
        : []
    const reason = roots.length
      ? null
      : !sourceGroups.length
        ? 'no-endpoints'
        : !candidates.length
          ? 'no-non-leaf-candidates'
          : 'no-positive-votes'
    components.push({ members, endpoints, sourceGroups, candidates, bestVotes, roots, reason })
  }
  const roots = components.flatMap((component) => component.roots).sort()
  const distance = distancesFrom(roots)
  return {
    method: 'attachment-balanced-strict-maxima-ranking',
    roots,
    components,
    unresolved: components.filter((component) => !component.roots.length),
    distances: Object.fromEntries(ids.map((id) => [id, distance.get(id) ?? null])),
  }
}

export function dependencyUpstream(baseline) {
  const graph = {
    nodes: baseline.nodes,
    links: baseline.links.map((link) => ({
      from: { node: baseline.nodes[link.a]?.id },
      to: { node: baseline.nodes[link.b]?.id },
    })),
  }
  // 上流未定は描画不能ではない。未解決成分の距離は null のまま返し、
  // 配置側で上下依存項だけを省く。架空の上流や距離0を補完しない。
  // 不正なリンクなどの入力エラーは握りつぶさず adjacencyOf から伝播する。
  return detectUpstream(graph)
}

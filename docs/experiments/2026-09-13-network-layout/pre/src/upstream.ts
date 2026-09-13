import { LayoutError } from './errors'
import { mapValue } from './utils/collections'

/**
 * Structural upstream detection.
 *
 * Every non-leaf node is scored by attachment votes. Degree-one endpoints are grouped by the node they
 * hang from, and each such attachment casts one vote for every node that is a strict local maximum of
 * the hop distance from that attachment. All top-scoring candidates with at least one vote become
 * upstream roots of their connected component. Node names, roles and coordinates are never consulted.
 *
 * A component without endpoints, without non-leaf nodes, or whose best candidate has zero votes stays
 * unresolved: its distances are `null` rather than an invented root.
 */

export interface UpstreamGraph {
  readonly nodes: readonly { readonly id: string }[]
  readonly links: readonly { readonly source: string; readonly target: string }[]
}

export interface AttachmentGroup {
  /** The non-leaf node the endpoints hang from. */
  readonly attachment: string
  readonly endpoints: readonly string[]
}

export interface UpstreamCandidate {
  readonly id: string
  readonly votes: number
  readonly total: number
  /** `votes / total`: structural agreement, not a probability. */
  readonly score: number
  readonly supportingAttachments: readonly string[]
}

export type UnresolvedReason = 'no-endpoints' | 'no-non-leaf-candidates' | 'no-positive-votes'

export interface UpstreamComponent {
  readonly members: readonly string[]
  readonly endpoints: readonly string[]
  readonly attachments: readonly AttachmentGroup[]
  /** Sorted by votes (descending), then id. */
  readonly candidates: readonly UpstreamCandidate[]
  readonly bestVotes: number
  readonly roots: readonly string[]
  readonly unresolvedReason: UnresolvedReason | null
}

export interface UpstreamAnalysis {
  readonly method: 'attachment-balanced-strict-maxima-ranking'
  readonly roots: readonly string[]
  readonly components: readonly UpstreamComponent[]
  readonly unresolved: readonly UpstreamComponent[]
  /** Hop distance from the nearest root; `null` inside unresolved components. */
  readonly distances: Readonly<Record<string, number | null>>
}

type Adjacency = ReadonlyMap<string, ReadonlySet<string>>

export function detectUpstream(graph: UpstreamGraph): UpstreamAnalysis {
  const adjacency = buildAdjacency(graph)
  const ids = [...adjacency.keys()].sort()
  const unvisited = new Set(ids)
  const components: UpstreamComponent[] = []
  for (const id of ids) {
    if (!unvisited.has(id)) continue
    const members = [...hopDistances(adjacency, [id]).keys()].sort()
    for (const member of members) unvisited.delete(member)
    components.push(analyzeComponent(adjacency, members))
  }
  const roots = components.flatMap((component) => component.roots).sort()
  const fromRoots = hopDistances(adjacency, roots)
  return {
    method: 'attachment-balanced-strict-maxima-ranking',
    roots,
    components,
    unresolved: components.filter((component) => component.roots.length === 0),
    distances: Object.fromEntries(ids.map((id) => [id, fromRoots.get(id) ?? null])),
  }
}

function analyzeComponent(adjacency: Adjacency, members: readonly string[]): UpstreamComponent {
  const endpoints = members.filter((member) => neighborsOf(adjacency, member).size === 1)
  const attachments = groupEndpointsByAttachment(adjacency, endpoints)
  const distancesByAttachment = attachments.map(({ attachment }) =>
    hopDistances(adjacency, [attachment]),
  )

  const candidates = members
    .filter((member) => neighborsOf(adjacency, member).size > 1)
    .map((member): UpstreamCandidate => {
      const supportingAttachments = attachments
        .filter((_, index) => {
          const distance = distancesByAttachment[index]
          if (distance === undefined) return false
          const own = mapValue(distance, member)
          return [...neighborsOf(adjacency, member)].every((peer) => mapValue(distance, peer) < own)
        })
        .map((group) => group.attachment)
      return {
        id: member,
        votes: supportingAttachments.length,
        total: attachments.length,
        score: attachments.length > 0 ? supportingAttachments.length / attachments.length : 0,
        supportingAttachments,
      }
    })
    .sort((a, b) => b.votes - a.votes || compareCodeUnits(a.id, b.id))

  const bestVotes = candidates[0]?.votes ?? 0
  const roots =
    bestVotes > 0
      ? candidates.filter((candidate) => candidate.votes === bestVotes).map(({ id }) => id)
      : []
  return {
    members,
    endpoints,
    attachments,
    candidates,
    bestVotes,
    roots,
    unresolvedReason: unresolvedReasonOf(roots, attachments, candidates),
  }
}

function groupEndpointsByAttachment(
  adjacency: Adjacency,
  endpoints: readonly string[],
): AttachmentGroup[] {
  const byAttachment = new Map<string, string[]>()
  for (const endpoint of endpoints) {
    const [attachment] = neighborsOf(adjacency, endpoint)
    if (attachment === undefined) continue
    byAttachment.set(attachment, [...(byAttachment.get(attachment) ?? []), endpoint])
  }
  return [...byAttachment.keys()]
    .sort()
    .map((attachment) => ({ attachment, endpoints: mapValue(byAttachment, attachment) }))
}

function unresolvedReasonOf(
  roots: readonly string[],
  attachments: readonly AttachmentGroup[],
  candidates: readonly UpstreamCandidate[],
): UnresolvedReason | null {
  if (roots.length > 0) return null
  if (attachments.length === 0) return 'no-endpoints'
  if (candidates.length === 0) return 'no-non-leaf-candidates'
  return 'no-positive-votes'
}

/** Undirected, unweighted adjacency. Parallel links collapse and self-loops are ignored. */
function buildAdjacency(graph: UpstreamGraph): Map<string, Set<string>> {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]))
  for (const link of graph.links) {
    const source = adjacency.get(link.source)
    const target = adjacency.get(link.target)
    if (source === undefined || target === undefined) throw new LayoutError('Unknown link endpoint')
    if (link.source === link.target) continue
    source.add(link.target)
    target.add(link.source)
  }
  return adjacency
}

/** Multi-source breadth-first hop distances within the sources' components. */
function hopDistances(adjacency: Adjacency, sources: readonly string[]): Map<string, number> {
  const distance = new Map(sources.map((id) => [id, 0]))
  const queue = [...sources]
  for (const id of queue) {
    const next = mapValue(distance, id) + 1
    for (const peer of neighborsOf(adjacency, id))
      if (!distance.has(peer)) {
        distance.set(peer, next)
        queue.push(peer)
      }
  }
  return distance
}

function neighborsOf(adjacency: Adjacency, id: string): ReadonlySet<string> {
  return mapValue(adjacency, id)
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

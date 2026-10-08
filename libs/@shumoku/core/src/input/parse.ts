import yaml from 'js-yaml'
import type { z } from 'zod'
import { type Group, Network, type Rate } from './schema'

/** One thing wrong with the input, at a path such as `links[2].endpoints[0]`. */
export interface InputIssue {
  path: string
  message: string
}

export type InputResult = { ok: true; network: Network } | { ok: false; issues: InputIssue[] }

/**
 * Reads the input from YAML text. Every issue is reported at once, so a writer who knows the
 * format only from an example can fix them in one pass; the shape is checked first, and the
 * references between items once the shape holds.
 */
export function parseNetworkInput(source: string): InputResult {
  let data: unknown
  try {
    // js-yaml refuses a key written twice, which would otherwise drop the first silently.
    data = yaml.load(source)
  } catch (e) {
    return {
      ok: false,
      issues: [{ path: '', message: e instanceof Error ? e.message : String(e) }],
    }
  }
  return readNetworkInput(data)
}

/** Reads the input from already-parsed data, such as JSON. */
export function readNetworkInput(data: unknown): InputResult {
  const shaped = Network.safeParse(data, { error: message })
  if (!shaped.success) return { ok: false, issues: shaped.error.issues.map(toIssue) }
  const issues = crossCheck(shaped.data)
  return issues.length > 0 ? { ok: false, issues } : { ok: true, network: shaped.data }
}

/** Every group with the one it is written inside, outermost first. */
export function flattenGroups(
  groups: readonly Group[],
  parent?: string,
): { group: Group; parent?: string }[] {
  return groups.flatMap((group) => [
    { group, ...(parent && { parent }) },
    ...flattenGroups(group.groups ?? [], group.id),
  ])
}

/** One address is written bare and several as a list; readers take both as a list. */
export function addressList(written: string | readonly string[] | undefined): string[] {
  if (written === undefined) return []
  return typeof written === 'string' ? [written] : [...written]
}

/** The rate as a number, so rates can be compared and traffic set against them. */
export function bitsPerSecond(rate: Rate): number {
  const unit = { M: 1e6, G: 1e9, T: 1e12 }[rate.slice(-1) as 'M' | 'G' | 'T']
  return Number.parseFloat(rate) * unit
}

function message(issue: z.core.$ZodRawIssue): string | undefined {
  // An empty value reads as a fact; what is not known is not written.
  if (issue.input === null) return 'empty; leave it out when it is not known'
  if (issue.code === 'unrecognized_keys') {
    // A writer who knows the format only from an example guesses names; the list ends the guessing.
    const shape = (issue.inst as { _zod?: { def?: { shape?: object } } } | undefined)?._zod?.def
      ?.shape
    const allowed = shape ? `; the fields here are ${Object.keys(shape).join(', ')}` : ''
    return `unknown field ${issue.keys.join(', ')}${allowed}`
  }
  if (issue.code === 'too_small' && issue.origin === 'array' && issue.minimum === 1)
    return 'empty; leave it out'
  if (issue.code === 'too_small' && issue.origin === 'string') return 'expected non-empty string'
  if ((issue.code === 'too_big' || issue.code === 'too_small') && issue.origin === 'array') {
    const at = issue.path?.at(-1)
    if (at === 'endpoints')
      return 'a link has exactly 2 ends; write one link for each pair, or a segment for a shared network'
    if (at === 'nodes' || at === 'members') return `expected at least ${issue.minimum}`
  }
  if (issue.code === 'invalid_value' && issue.values.includes(true))
    return 'expected true or omitted'
  // Writers copy "AS64500" from where the number is usually written.
  if (issue.path?.at(-1) === 'asn') return 'expected 1-4294967295, written without AS'
  return undefined
}

function toIssue(issue: z.core.$ZodIssue): InputIssue {
  return { path: formatPath(issue.path), message: issue.message }
}

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((step, i) =>
      typeof step === 'number' ? `[${step}]` : `${i === 0 ? '' : '.'}${String(step)}`,
    )
    .join('')
}

function crossCheck(network: Network): InputIssue[] {
  const issues: InputIssue[] = []
  const report = (path: string, text: string) => issues.push({ path, message: text })
  const { nodes, links } = network
  const segments = network.segments ?? []
  const redundancy = network.redundancy ?? []
  const places = flattenGroups(network.groups ?? [])

  const unique = (items: readonly { id: string }[], kind: string, at: string) => {
    const ids = new Set<string>()
    for (const { id } of items) {
      if (ids.has(id)) report(at, `duplicate ${kind} id: ${id}`)
      ids.add(id)
    }
    return ids
  }
  const groupIds = unique(
    places.map((p) => p.group),
    'group',
    'groups',
  )
  const domainIds = unique(network.routingDomains ?? [], 'routing domain', 'routingDomains')
  const connectionIds = unique(network.connections ?? [], 'connection', 'connections')
  const segmentIds = unique(segments, 'segment', 'segments')
  const nodeIds = unique(nodes, 'node', 'nodes')
  // Segment addresses are keyed by node or by redundancy set, so the two share one namespace.
  const holderIds = unique([...nodes, ...redundancy], 'node or redundancy', 'redundancy')

  for (const [i, segment] of segments.entries()) {
    const at = `segments[${i}]`
    if (segment.routingDomain && !domainIds.has(segment.routingDomain))
      report(`${at}.routingDomain`, `unknown routing domain ${segment.routingDomain}`)
    if (segment.group && !groupIds.has(segment.group))
      report(`${at}.group`, `unknown group ${segment.group}; list it under groups`)
    for (const holder of Object.keys(segment.addresses ?? {})) {
      if (!holderIds.has(holder))
        report(`${at}.addresses.${holder}`, `unknown node or redundancy ${holder}`)
    }
  }
  for (const [i, set] of redundancy.entries()) {
    if (new Set(set.nodes).size !== set.nodes.length)
      report(`redundancy[${i}].nodes`, 'a node is listed twice')
    for (const node of set.nodes) {
      if (!nodeIds.has(node)) report(`redundancy[${i}].nodes`, `unknown node ${node}`)
    }
  }
  for (const [i, node] of nodes.entries()) {
    const at = `nodes[${i}]`
    if (node.group && !groupIds.has(node.group))
      report(`${at}.group`, `unknown group ${node.group}; list it under groups`)
    if (node.host && !holderIds.has(node.host)) report(`${at}.host`, `unknown host ${node.host}`)
    if (node.members && new Set(node.members).size !== node.members.length)
      report(`${at}.members`, 'a member is listed twice')
    const { address } = node
    if (address && segments.some((s) => addressList(s.addresses?.[node.id]).includes(address)))
      report(`${at}.address`, `${address} is in a segment; drop node.address`)
  }
  for (const id of hostCycles(nodes, redundancy))
    report(`nodes[${nodes.findIndex((n) => n.id === id)}].host`, 'host cycle')

  // Writers reach for links to say "attached to"; name what the id is and where it goes instead.
  const notANode = (id: string) => {
    if (segmentIds.has(id)) return `${id} is a segment; write this end as { segment: ${id} }`
    if (domainIds.has(id))
      return `${id} is a routing domain; write this end as { routingDomain: ${id} }`
    if (redundancy.some((r) => r.id === id))
      return `${id} is a redundancy set, not a node; link to one of its nodes`
    return `unknown node ${id}`
  }
  for (const [i, link] of links.entries()) {
    const at = `links[${i}]`
    for (const [j, end] of link.endpoints.entries()) {
      const endAt = `${at}.endpoints[${j}]`
      if ('segment' in end) {
        if (!segmentIds.has(end.segment)) report(endAt, `unknown segment ${end.segment}`)
      } else if ('routingDomain' in end) {
        if (!domainIds.has(end.routingDomain))
          report(endAt, `unknown routing domain ${end.routingDomain}`)
      } else if (!nodeIds.has(end.node)) report(endAt, notANode(end.node))
    }
    const [a, b] = link.endpoints
    const nodeToNode = 'node' in a && 'node' in b
    if (!('node' in a) && !('node' in b)) report(at, 'a link needs a node on at least one end')
    if ('node' in a && 'node' in b && a.node === b.node) report(at, `both ends on ${a.node}`)
    if (link.connection && !connectionIds.has(link.connection))
      report(`${at}.connection`, `unknown connection ${link.connection}`)
    if (link.segments && !nodeToNode)
      report(`${at}.segments`, 'only a link between two nodes carries segments')
    for (const s of link.segments ?? []) {
      if (!segmentIds.has(s)) report(`${at}.segments`, `unknown segment ${s}`)
    }
    if (link.virtual && (link.cable || link.length)) report(at, 'a virtual link has no cable')
    if (link.speed && link.bandwidth && bitsPerSecond(link.bandwidth) >= bitsPerSecond(link.speed))
      report(`${at}.bandwidth`, 'not below the speed; leave it out')
  }
  return issues
}

/**
 * Nested virtualization is real, so hosts may chain, but no choice of host may lead back to where
 * it started. A set may run its guest on any of its nodes, so it leads to each of them. Returns
 * the node each cycle was found from.
 */
function hostCycles(
  nodes: readonly Network['nodes'][number][],
  redundancy: readonly NonNullable<Network['redundancy']>[number][],
): string[] {
  const runsOn = (id: string): string[] =>
    redundancy.find((r) => r.id === id)?.nodes ??
    [nodes.find((n) => n.id === id)?.host ?? []].flat()
  const settled = new Set<string>()
  const found: string[] = []
  const visit = (id: string, path: string[]): boolean => {
    if (path.includes(id)) return true
    if (settled.has(id)) return false
    const looped = runsOn(id).some((next) => visit(next, [...path, id]))
    settled.add(id)
    return looped
  }
  for (const node of nodes) {
    if (!settled.has(node.id) && visit(node.id, [])) found.push(node.id)
  }
  return found
}

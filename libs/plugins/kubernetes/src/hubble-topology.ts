import type { SourceNetwork } from '@shumoku/core'
import type { HubbleFlow, HubbleSample } from './hubble.js'
import type { Inventory } from './types.js'

/** Match only the current Pod incarnation and local cluster; never use IP as device identity. */
export function addHubbleTopology(
  base: SourceNetwork,
  inventory: Inventory,
  sample: HubbleSample,
  clusterName: string,
): SourceNetwork {
  const pods = new Map(
    inventory.pods.map((pod) => [`${pod.metadata.namespace}/${pod.metadata.name}`, pod]),
  )
  const podToNode = new Map<string, string>()
  const labels = new Map(base.network.nodes.map((node) => [node.id, node.label ?? node.id]))
  for (const pod of inventory.pods) {
    if (labels.has(`k8s:${pod.metadata.uid}`))
      podToNode.set(pod.metadata.uid, `k8s:${pod.metadata.uid}`)
  }
  for (const [nodeId, observation] of Object.entries(base.observation?.nodes ?? {})) {
    const members = observation.metadata?.['Pods']
    if (!Array.isArray(members)) continue
    for (const member of members) {
      if (!member || typeof member !== 'object' || !('Name' in member)) continue
      const pod = pods.get(`${observation.metadata?.['Namespace']}/${member.Name}`)
      if (pod) podToNode.set(pod.metadata.uid, nodeId)
    }
  }
  function endpoint(
    flow: HubbleFlow,
    side: 'source' | 'destination',
    time: number,
  ): string | undefined {
    const endpoint = flow[side]
    if (!endpoint?.pod_name || endpoint.cluster_name !== clusterName) return
    const pod = pods.get(`${endpoint.namespace}/${endpoint.pod_name}`)
    if (!pod) return
    const created = Date.parse(pod.metadata.creationTimestamp ?? '')
    if (!Number.isFinite(created) || time < created) return
    // If both are available, require IP corroboration as an additional reuse guard.
    if (flow.IP?.[side] && pod.status?.podIP && flow.IP[side] !== pod.status.podIP) return
    return podToNode.get(pod.metadata.uid)
  }
  const groups = new Map<
    string,
    {
      from: string
      to: string
      protocol: string
      port: number | string
      verdict: string
      reason: string
      count: number
    }
  >()
  const seen = new Set<string>()
  let unmapped = 0
  let duplicates = 0
  let outsideWindow = 0
  for (const flow of sample.flows) {
    if (flow.uuid && seen.has(flow.uuid)) {
      duplicates++
      continue
    }
    if (flow.uuid) seen.add(flow.uuid)
    const time = Number(flow.time?.seconds) * 1000 + (flow.time?.nanos ?? 0) / 1000000
    if (!Number.isFinite(time) || time < sample.since || time > sample.until) {
      outsideWindow++
      continue
    }
    const from = endpoint(flow, 'source', time)
    const to = endpoint(flow, 'destination', time)
    if (!from || !to) {
      unmapped++
      continue
    }
    const protocol = Object.keys(flow.l4 ?? {})[0] ?? 'Unknown'
    const port =
      flow.l4?.TCP?.destination_port ??
      flow.l4?.UDP?.destination_port ??
      flow.l4?.SCTP?.destination_port ??
      '—'
    const verdict = String(flow.verdict ?? 'VERDICT_UNKNOWN')
    const reason = verdict === 'DROPPED' ? (flow.drop_reason_desc ?? 'Unknown') : '—'
    const key = JSON.stringify([from, to, protocol, port, verdict, reason])
    const entry = groups.get(key) ?? { from, to, protocol, port, verdict, reason, count: 0 }
    entry.count++
    groups.set(key, entry)
  }
  const entries = [...groups]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 500)
  const nodes = { ...base.observation?.nodes }
  const links = { ...base.observation?.links }
  const trafficRows = new Map<string, Array<Record<string, string | number>>>()
  const observedLinks = []
  const pairs = new Map<
    string,
    {
      from: string
      to: string
      counts: Map<string, number>
      rows: Array<Record<string, string | number>>
    }
  >()
  for (const [, entry] of entries) {
    const row = {
      From: labels.get(entry.from) ?? entry.from,
      To: labels.get(entry.to) ?? entry.to,
      Protocol: entry.protocol,
      'Destination port': entry.port,
      Verdict: entry.verdict,
      'Drop reason': entry.reason,
      Events: entry.count,
    }
    for (const node of new Set([entry.from, entry.to]))
      trafficRows.set(node, [...(trafficRows.get(node) ?? []), row])
    const pairKey = JSON.stringify([entry.from, entry.to])
    const pair = pairs.get(pairKey) ?? {
      from: entry.from,
      to: entry.to,
      counts: new Map<string, number>(),
      rows: [],
    }
    pair.counts.set(entry.verdict, (pair.counts.get(entry.verdict) ?? 0) + entry.count)
    pair.rows.push(row)
    pairs.set(pairKey, pair)
  }
  for (const [key, pair] of pairs) {
    // Keep one observed edge per direction; ephemeral reply ports belong in details.
    const linkId = `hubble:${key}`
    observedLinks.push({
      id: linkId,
      endpoints: [{ node: pair.from }, { node: pair.to }] as const,
      virtual: true as const,
      description: `observed: ${[...pair.counts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([verdict, count]) => `${count} ${verdict}`)
        .join(', ')} events`,
    })
    links[linkId] = {
      metadata: {
        relation: 'observed-hubble-flow',
        From: labels.get(pair.from) ?? pair.from,
        To: labels.get(pair.to) ?? pair.to,
        flows: pair.rows,
        since: sample.since,
        until: sample.until,
      },
    }
  }
  const quality =
    sample.error ??
    [
      'Recent ring-buffer sample; absence is not proof of no traffic. Events are not packets, requests or bytes.',
      `Lost events: ${sample.lostEvents}; unavailable nodes: ${sample.unavailableNodes}; capped: ${sample.truncated}; unmapped: ${unmapped}; duplicate UUIDs: ${duplicates}; outside window: ${outsideWindow}; omitted groups: ${Math.max(0, groups.size - 500)}.`,
    ].join(' ')
  for (const node of base.network.nodes)
    nodes[node.id] = {
      ...nodes[node.id],
      metadata: {
        ...nodes[node.id]?.metadata,
        'Data basis':
          'Kubernetes relationships are configured. Observed flow rows are Hubble event samples, not bandwidth or proof of application success.',
        'Hubble observation': quality,
        'Hubble window': `${new Date(sample.since).toISOString()} – ${new Date(sample.until).toISOString()}`,
        'Observed flows': trafficRows.get(node.id) ?? [],
      },
    }
  return {
    ...base,
    network: {
      ...base.network,
      description:
        'Configured Kubernetes topology with separately labeled Hubble event observations.',
      groups: base.network.groups?.map((group) =>
        group.id === 'k8s:cluster'
          ? { ...group, label: 'Kubernetes cluster — configuration + Hubble observations' }
          : group,
      ),
      links: [...base.network.links, ...observedLinks],
    },
    observation: { ...base.observation, nodes, links },
  }
}

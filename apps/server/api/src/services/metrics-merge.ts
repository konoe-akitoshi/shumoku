import type {
  LinkMetricObservation,
  LinkMetricSample,
  LinkMetrics,
  MetricsData,
  MetricsObservationSource,
  MetricsRedundancy,
  MetricsStatus,
  MonitoringHealth,
  NodeMetricObservation,
  NodeMetricSample,
  NodeMetrics,
} from '../types.js'

export interface MetricsSourcePoll {
  source: MetricsObservationSource
  data: MetricsData
}

function median(values: Array<number | undefined>): number | undefined {
  const sorted = values
    .filter((value): value is number => value !== undefined && Number.isFinite(value))
    .sort((a, b) => a - b)
  if (sorted.length === 0) return undefined
  const middle = Math.floor(sorted.length / 2)
  const atMiddle = sorted[middle]
  if (atMiddle === undefined) return undefined
  if (sorted.length % 2 === 1) return atMiddle
  const beforeMiddle = sorted[middle - 1]
  return beforeMiddle === undefined ? atMiddle : (beforeMiddle + atMiddle) / 2
}

function latest(values: Array<number | undefined>): number | undefined {
  const present = values.filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  )
  return present.length > 0 ? Math.max(...present) : undefined
}

function nodeSample(metrics: NodeMetrics): NodeMetricSample {
  const { observations: _observations, redundancy: _redundancy, ...sample } = metrics
  return sample
}

function linkSample(metrics: LinkMetrics): LinkMetricSample {
  const { observations: _observations, ...sample } = metrics
  return sample
}

function aggregateNodeStatus(samples: readonly NodeMetricSample[]): MetricsStatus {
  const statuses = new Set(samples.map((sample) => sample.status))
  // A current positive observation proves reachability even when another
  // monitoring path is stale or reports a conflicting negative observation.
  if (statuses.has('up')) return 'up'
  if (statuses.has('warning')) return 'warning'
  if (statuses.has('degraded')) return 'degraded'
  if (statuses.has('down')) return 'down'
  return 'unknown'
}

function aggregateLinkStatus(samples: readonly LinkMetricSample[]): MetricsStatus {
  const statuses = new Set(samples.map((sample) => sample.status))
  // Opposite-end or independent-source disagreement is a degraded link, not a
  // reason to discard either observation.
  if (statuses.has('up') && statuses.has('down')) return 'degraded'
  if (statuses.has('warning')) return 'warning'
  if (statuses.has('degraded')) return 'degraded'
  if (statuses.has('up')) return 'up'
  if (statuses.has('down')) return 'down'
  return 'unknown'
}

function summarizeRedundancy(observations: readonly NodeMetricObservation[]): {
  monitoring?: MonitoringHealth
  monitoringError?: string
  redundancy: MetricsRedundancy
} {
  const count = (health: MonitoringHealth) =>
    observations.filter((observation) => observation.sample.monitoring === health).length
  const healthySources = count('healthy')
  const failingSources = count('failing')
  const pendingSources = count('pending')
  const pausedSources = count('paused')
  const degradedSources = count('degraded')
  const reportingSources =
    healthySources + failingSources + pendingSources + pausedSources + degradedSources

  let monitoring: MonitoringHealth | undefined
  if (healthySources > 0 && failingSources + pendingSources + degradedSources > 0) {
    monitoring = 'degraded'
  } else if (healthySources > 0) {
    monitoring = 'healthy'
  } else if (degradedSources > 0) {
    monitoring = 'degraded'
  } else if (failingSources > 0) {
    monitoring = 'failing'
  } else if (pendingSources > 0) {
    monitoring = 'pending'
  } else if (pausedSources > 0) {
    monitoring = 'paused'
  }

  const statuses = new Set(observations.map((observation) => observation.sample.status))
  let agreement: MetricsRedundancy['agreement'] = 'unknown'
  if (statuses.has('up') && statuses.has('down')) {
    agreement = 'conflicting'
  } else if (observations.length === 1) {
    agreement = 'single'
  } else if (monitoring === 'degraded' || failingSources > 0) {
    agreement = 'degraded'
  } else if (statuses.size === 1 && !statuses.has('unknown')) {
    agreement = 'confirmed'
  }

  const errors = observations
    .filter((observation) => observation.sample.monitoringError)
    .map(
      (observation) =>
        `${observation.source.name}: ${observation.sample.monitoringError ?? 'monitoring failed'}`,
    )

  return {
    monitoring,
    monitoringError: errors.length > 0 ? errors.join('; ') : undefined,
    redundancy: {
      totalSources: observations.length,
      reportingSources,
      healthySources,
      failingSources,
      pendingSources,
      pausedSources,
      agreement,
    },
  }
}

function aggregateNode(observations: NodeMetricObservation[]): NodeMetrics {
  const sorted = [...observations].sort(
    (a, b) => a.source.id.localeCompare(b.source.id) || a.source.name.localeCompare(b.source.name),
  )
  const samples = sorted.map((observation) => observation.sample)
  const monitoring = summarizeRedundancy(sorted)
  return {
    status: aggregateNodeStatus(samples),
    monitoring: monitoring.monitoring,
    monitoringError: monitoring.monitoringError,
    cpu: median(samples.map((sample) => sample.cpu)),
    memory: median(samples.map((sample) => sample.memory)),
    lastSeen: latest(samples.map((sample) => sample.lastSeen)),
    observations: sorted,
    redundancy: monitoring.redundancy,
  }
}

function aggregateLink(observations: LinkMetricObservation[]): LinkMetrics {
  const sorted = [...observations].sort(
    (a, b) => a.source.id.localeCompare(b.source.id) || a.source.name.localeCompare(b.source.name),
  )
  const samples = sorted.map((observation) => observation.sample)
  return {
    status: aggregateLinkStatus(samples),
    utilization: median(samples.map((sample) => sample.utilization)),
    inUtilization: median(samples.map((sample) => sample.inUtilization)),
    outUtilization: median(samples.map((sample) => sample.outUtilization)),
    inBps: median(samples.map((sample) => sample.inBps)),
    outBps: median(samples.map((sample) => sample.outBps)),
    observations: sorted,
  }
}

/**
 * Aggregate all attached-source observations at once. The result is
 * commutative with respect to source order: no datasource is selected as the
 * winner, and every raw observation remains available for UI and history.
 */
export function aggregateMetricsData(polls: readonly MetricsSourcePoll[]): MetricsData {
  const nodes = new Map<string, NodeMetricObservation[]>()
  const links = new Map<string, LinkMetricObservation[]>()
  const warnings: string[] = []

  for (const poll of polls) {
    for (const [nodeId, metrics] of Object.entries(poll.data.nodes)) {
      const observation: NodeMetricObservation = {
        source: poll.source,
        timestamp: poll.data.timestamp,
        sample: nodeSample(metrics),
      }
      const current = nodes.get(nodeId)
      if (current) current.push(observation)
      else nodes.set(nodeId, [observation])
    }
    for (const [linkId, metrics] of Object.entries(poll.data.links)) {
      const observation: LinkMetricObservation = {
        source: poll.source,
        timestamp: poll.data.timestamp,
        sample: linkSample(metrics),
      }
      const current = links.get(linkId)
      if (current) current.push(observation)
      else links.set(linkId, [observation])
    }
    for (const warning of poll.data.warnings ?? []) {
      warnings.push(`${poll.source.name}: ${warning}`)
    }
  }

  return {
    nodes: Object.fromEntries(
      [...nodes].map(([nodeId, values]) => [nodeId, aggregateNode(values)]),
    ),
    links: Object.fromEntries(
      [...links].map(([linkId, values]) => [linkId, aggregateLink(values)]),
    ),
    timestamp: Math.max(0, ...polls.map((poll) => poll.data.timestamp)),
    warnings: warnings.length > 0 ? [...new Set(warnings)].sort() : undefined,
  }
}

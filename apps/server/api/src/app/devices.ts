import { ACCESS_METHODS } from '../services/access-methods.js'
import { listCredentialsForTopology, topologyClock } from '../services/credentials.js'
import { planDeepRead, runDeepRead } from '../services/deep-read-service.js'
import { deriveDeviceState, listDeviceAccess, setDeviceAccess } from '../services/device-access.js'
import type { ObservationsService } from '../services/observations.js'
import type { TopologyService } from '../services/topology.js'
import type { DeviceApplicationService, DeviceResult, DeviceView } from './services.js'

function failure(status: 400 | 404 | 409 | 500, error: string): DeviceResult<never> {
  return { ok: false, status, error }
}

export function createDeviceApplicationService(dependencies: {
  topologies: TopologyService
  observations: ObservationsService
}): DeviceApplicationService {
  const { topologies, observations } = dependencies
  return {
    async list(topologyId) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      const parsed = await topologies.getParsed(topologyId)
      const access = listDeviceAccess(topologyId)
      const clock = topologyClock(topologyId)
      const devices: DeviceView[] = []
      for (const node of parsed?.graph.nodes ?? []) {
        const row = access.get(node.id)
        const attrs = parsed?.record.attributes[node.id]
        const spec = node.spec
        const label = Array.isArray(node.label) ? node.label.join(' ') : node.label
        devices.push({
          id: node.id,
          label,
          enabled: row?.enabled ?? true,
          state: deriveDeviceState({ mgmtIp: attrs?.address }, row, clock),
          ...(attrs?.address ? { mgmtIp: attrs.address } : {}),
          ...(attrs?.sysName ? { sysName: attrs.sysName } : {}),
          ...(attrs?.chassisId ? { chassisId: attrs.chassisId } : {}),
          ...(spec?.vendor ? { vendor: spec.vendor } : {}),
          ...(spec?.kind === 'hardware' && spec.model ? { model: spec.model } : {}),
          ...(row?.credentialId ? { credentialId: row.credentialId } : {}),
          ...(row?.lastReadAt != null ? { lastReadAt: row.lastReadAt } : {}),
          ...(row?.lastStatus ? { lastStatus: row.lastStatus } : {}),
          ...(row?.lastError ? { lastError: row.lastError } : {}),
          ...(row?.triedAt != null ? { triedAt: row.triedAt } : {}),
          ...(row?.assignedBy ? { assignedBy: row.assignedBy } : {}),
        })
      }
      return {
        ok: true,
        value: {
          methods: ACCESS_METHODS,
          credentials: listCredentialsForTopology(topologyId),
          devices,
        },
      }
    },

    assign(topologyId, entityIds, patch) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      const result = setDeviceAccess(topologyId, entityIds, patch)
      if ('error' in result) return failure(result.status, result.error)
      return { ok: true, value: result }
    },

    async read(topologyId, entityIds, options) {
      if (!topologies.get(topologyId)) return failure(404, 'Topology not found')
      try {
        if (options?.dryRun) {
          const plan = await planDeepRead(topologyId, entityIds, topologies)
          if (!plan) return failure(404, 'Topology not found')
          return {
            ok: true,
            value: {
              plan,
              trial: { tried: 0, matched: 0, silent: 0 },
              observation: null,
              outcomes: [],
            },
          }
        }
        const run = await runDeepRead(topologyId, entityIds, topologies, observations)
        if (!run) return failure(404, 'Topology not found')
        if (run.observation?.contributionChanged) {
          topologies.clearCacheEntry(topologyId)
          topologies.precompute(topologyId)
        }
        return {
          ok: true,
          value: {
            plan: run.plan,
            trial: run.trial,
            observation: run.observation,
            outcomes: run.outcomes,
          },
        }
      } catch (error) {
        return failure(500, error instanceof Error ? error.message : String(error))
      }
    },
  }
}

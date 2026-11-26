import { type Probe, probeDevices, probeSnmp } from '../discovery/credential-trial.js'
import { ACCESS_METHODS, getAccessMethod, normalizeParams } from '../services/access-methods.js'
import {
  createCredential,
  deleteCredential,
  listCredentialsAdmin,
  loadCredentialParams,
  pickTestSample,
  topologyExists,
  updateCredential,
} from '../services/credentials.js'
import { topologiesWithReadings, withdrawUnreadable } from '../services/deep-read-service.js'
import { deviceNodes, listDeviceAccess } from '../services/device-access.js'
import type { ObservationsService } from '../services/observations.js'
import type { TopologyService } from '../services/topology.js'
import type { CredentialApplicationService, CredentialResult } from './services.js'

function failure(status: 400 | 404 | 409 | 500, error: string): CredentialResult<never> {
  return { ok: false, status, error }
}

export function createCredentialApplicationService(dependencies: {
  topologies: TopologyService
  observations: ObservationsService
  /** Injectable so the test path can be exercised without a network. */
  probe?: Probe
}): CredentialApplicationService {
  const { topologies, observations, probe = probeSnmp } = dependencies

  /** A credential that no longer reads a device takes that device's reading out of the drawing. */
  async function withdraw(): Promise<void> {
    for (const topologyId of topologiesWithReadings()) {
      if (await withdrawUnreadable(topologyId, observations)) {
        topologies.clearCacheEntry(topologyId)
        topologies.precompute(topologyId)
      }
    }
  }

  return {
    list() {
      return { ok: true, value: { methods: ACCESS_METHODS, credentials: listCredentialsAdmin() } }
    },

    create(input) {
      const result = createCredential(input)
      if ('error' in result) return failure(result.status, result.error)
      return { ok: true, value: result }
    },

    async update(id, patch) {
      const result = updateCredential(id, patch)
      if ('error' in result) return failure(result.status, result.error)
      await withdraw()
      return { ok: true, value: result }
    },

    async delete(id) {
      const result = deleteCredential(id)
      if (!result) return failure(404, 'Credential not found')
      await withdraw()
      return { ok: true, value: result }
    },

    async test(input) {
      if (!topologyExists(input.topologyId)) return failure(404, 'Topology not found')
      const method = getAccessMethod(input.method)
      if (!method) return failure(400, `unknown access method: ${input.method}`)
      if (method.id !== 'snmp') return failure(400, `${method.label} cannot be tested yet`)
      let stored: Record<string, string> | undefined
      if (input.credentialId !== undefined) {
        const credential = loadCredentialParams(input.credentialId)
        if (!credential) return failure(404, 'Credential not found')
        if (credential.method !== method.id)
          return failure(400, 'method does not match the credential')
        stored = credential.params
      }
      // The secret comes from the request when given, else from the stored credential.
      const normalized = normalizeParams(method, input.params, stored)
      if ('error' in normalized) return failure(400, normalized.error)
      const community = normalized.params['community']
      if (!community) return failure(400, 'Community is required')

      const parsed = await topologies.getParsed(input.topologyId)
      if (!parsed) return failure(404, 'Topology not found')
      const sample = pickTestSample({
        nodes: deviceNodes(parsed),
        access: listDeviceAccess(input.topologyId),
        ...(input.credentialId !== undefined ? { credentialId: input.credentialId } : {}),
        ...(input.entityIds ? { entityIds: input.entityIds } : {}),
      })
      if (sample.length === 0) return { ok: true, value: { sent: 0, answered: 0, silent: 0 } }
      const result = await probeDevices(sample, community, probe)
      return {
        ok: true,
        value: {
          sent: sample.length,
          answered: result.answered.length,
          silent: result.silent.length,
        },
      }
    },
  }
}

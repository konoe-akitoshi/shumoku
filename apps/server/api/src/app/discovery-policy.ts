import {
  bulkSetDeepReadConfig,
  listDeepReadConfigs,
  upsertDeepReadConfig,
} from '../services/deep-read-config.js'
import type { TopologyService } from '../services/topology.js'
import type { DiscoveryPolicyApplicationService } from './services.js'

export function createDiscoveryPolicyApplicationService(
  topologies: TopologyService,
): DiscoveryPolicyApplicationService {
  return {
    getTopology: (id) => topologies.get(id),
    getParsed: async (id) => {
      const parsed = await topologies.getParsed(id)
      return parsed ? { graph: parsed.graph, record: parsed.record } : null
    },
    clearCache: (id) => topologies.clearCacheEntry(id),
    readOverlay: (id) => topologies.readProjectOverlay(id),
    writeOverlay: async (id, overlay) => {
      await topologies.writeProjectOverlay(id, overlay)
    },
    listConfigs: listDeepReadConfigs,
    bulkSetConfig: bulkSetDeepReadConfig,
    upsertConfig: upsertDeepReadConfig,
  }
}

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
    getParsedGraph: async (id) => (await topologies.getParsed(id))?.graph ?? null,
    clearCache: (id) => topologies.clearCacheEntry(id),
    readOverlay: (id) => topologies.readProjectOverlay(id),
    writeOverlay: async (id, graph) => {
      await topologies.writeProjectOverlay(id, graph)
    },
    listConfigs: listDeepReadConfigs,
    bulkSetConfig: bulkSetDeepReadConfig,
    upsertConfig: upsertDeepReadConfig,
  }
}

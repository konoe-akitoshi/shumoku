/**
 * Mapping Store
 * Shared state for topology node/link mapping across pages
 */

import { NODE_MATCH_THRESHOLD, nodeNameMatchScore } from '@shumoku/core'
import { derived, get, writable } from 'svelte/store'
import { api } from '$lib/api'
import type { Host, HostItem, MetricsMapping } from '$lib/types'

interface MappingState {
  topologyId: string | null
  mapping: MetricsMapping
  hosts: Host[]
  // Interfaces per host (hostId -> interfaces)
  hostInterfaces: Record<string, HostItem[]>
  hostInterfacesLoading: Record<string, boolean>
  loading: boolean
  hostsLoading: boolean
  error: string | null
  metricsSourceId: string | null
}

const initialState: MappingState = {
  topologyId: null,
  mapping: { nodes: {}, links: {} },
  hosts: [],
  hostInterfaces: {},
  hostInterfacesLoading: {},
  loading: false,
  hostsLoading: false,
  error: null,
  metricsSourceId: null,
}

function createMappingStore() {
  const { subscribe, set, update } = writable<MappingState>(initialState)

  return {
    subscribe,

    /**
     * Load mapping data for a topology
     */
    load: async (topologyId: string, forceReload = false) => {
      const current = get({ subscribe })

      // Skip if already loaded for this topology (unless force reload)
      if (!forceReload && current.topologyId === topologyId && !current.loading) {
        return
      }

      update((s) => ({ ...s, loading: true, error: null, topologyId }))

      try {
        const [topo, sources] = await Promise.all([
          api.topologies.get(topologyId),
          api.topologies.sources.list(topologyId),
        ])

        // Parse mapping
        let mapping: MetricsMapping = { nodes: {}, links: {} }
        if (topo.mappingJson) {
          try {
            mapping = JSON.parse(topo.mappingJson)
          } catch {
            // Ignore parse error
          }
        }

        // Find metrics source
        const metricsSource = sources.find((s) => s.purpose === 'metrics')
        const metricsSourceId = metricsSource?.dataSourceId || null

        update((s) => ({
          ...s,
          mapping,
          metricsSourceId,
          loading: false,
        }))

        // Load hosts if metrics source is available
        if (metricsSourceId) {
          update((s) => ({ ...s, hostsLoading: true }))
          try {
            const hosts = await api.dataSources.getHosts(metricsSourceId)
            update((s) => ({ ...s, hosts, hostsLoading: false }))
          } catch {
            update((s) => ({ ...s, hostsLoading: false }))
          }
        }
      } catch (e) {
        update((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load mapping',
        }))
      }
    },

    /**
     * Update a single node mapping
     */
    updateNode: async (nodeId: string, hostMapping: { hostId?: string; hostName?: string }) => {
      const current = get({ subscribe })
      if (!current.topologyId) return

      // Optimistic update
      update((s) => {
        const nodes = { ...s.mapping.nodes }
        if (hostMapping.hostId) {
          nodes[nodeId] = hostMapping
        } else {
          delete nodes[nodeId]
        }
        return { ...s, mapping: { ...s.mapping, nodes } }
      })

      // Save to backend
      try {
        await api.topologies.updateNodeMapping(current.topologyId, nodeId, hostMapping)
      } catch (e) {
        // Revert on error
        update((s) => ({
          ...s,
          error: e instanceof Error ? e.message : 'Failed to save mapping',
        }))
      }
    },

    /**
     * Update a single link mapping
     */
    updateLink: (
      linkId: string,
      linkMapping: {
        monitoredNodeId?: string
        interface?: string
        capacity?: number
      } | null,
    ) => {
      update((s) => {
        const links = { ...s.mapping.links }
        if (
          linkMapping &&
          (linkMapping.monitoredNodeId || linkMapping.interface || linkMapping.capacity)
        ) {
          links[linkId] = { ...links[linkId], ...linkMapping }
        } else {
          delete links[linkId]
        }
        return { ...s, mapping: { ...s.mapping, links } }
      })
    },

    /**
     * Load interfaces for a specific host
     */
    loadHostInterfaces: async (hostId: string) => {
      const current = get({ subscribe })
      if (!current.metricsSourceId) return

      // Skip if already loaded or loading
      if (current.hostInterfaces[hostId] || current.hostInterfacesLoading[hostId]) {
        return
      }

      update((s) => ({
        ...s,
        hostInterfacesLoading: { ...s.hostInterfacesLoading, [hostId]: true },
      }))

      try {
        const items = await api.dataSources.getHostItems(current.metricsSourceId, hostId)
        // Filter to unique interface names (remove :in/:out suffix)
        const interfaceNames = new Set<string>()
        const interfaces: HostItem[] = []
        for (const item of items) {
          // Use structured interfaceName field if available, fall back to regex extraction
          let ifName: string
          if (item.interfaceName) {
            ifName = item.interfaceName
          } else {
            const match = item.name.match(/^(.+?)\s*-\s*(Inbound|Outbound)$/i)
            ifName = match ? match[1].trim() : item.name
          }
          if (!interfaceNames.has(ifName)) {
            interfaceNames.add(ifName)
            interfaces.push({
              ...item,
              id: ifName,
              name: ifName,
            })
          }
        }
        update((s) => ({
          ...s,
          hostInterfaces: { ...s.hostInterfaces, [hostId]: interfaces },
          hostInterfacesLoading: { ...s.hostInterfacesLoading, [hostId]: false },
        }))
      } catch {
        update((s) => ({
          ...s,
          hostInterfacesLoading: { ...s.hostInterfacesLoading, [hostId]: false },
        }))
      }
    },

    /**
     * Save full mapping to backend
     */
    save: async () => {
      const current = get({ subscribe })
      if (!current.topologyId) return

      try {
        await api.topologies.updateMapping(current.topologyId, current.mapping)
      } catch (e) {
        update((s) => ({
          ...s,
          error: e instanceof Error ? e.message : 'Failed to save mapping',
        }))
        throw e
      }
    },

    /**
     * Auto-map specific nodes by matching names with hosts
     */
    autoMapNodes: (
      nodeList: Array<{ id: string; label?: string | string[] }>,
      options: { overwrite?: boolean } = {},
    ) => {
      const current = get({ subscribe })
      if (current.hosts.length === 0) return { matched: 0, total: nodeList.length }

      let matched = 0
      const nodes = { ...current.mapping.nodes }

      for (const node of nodeList) {
        if (!options.overwrite && nodes[node.id]?.hostId) continue

        const nodeLabel = Array.isArray(node.label) ? node.label[0] : node.label
        if (!nodeLabel) continue

        // Find best matching host by score
        let bestHost: Host | null = null
        let bestScore = 0
        for (const host of current.hosts) {
          const score = nodeNameMatchScore(nodeLabel, host.name, host.displayName)
          if (score > bestScore) {
            bestScore = score
            bestHost = host
          }
        }

        if (bestHost && bestScore >= NODE_MATCH_THRESHOLD) {
          nodes[node.id] = {
            hostId: bestHost.id,
            hostName: bestHost.name,
          }
          matched++
        }
      }

      update((s) => ({ ...s, mapping: { ...s.mapping, nodes } }))

      return { matched, total: nodeList.length }
    },

    /**
     * Clear all node mappings
     */
    clearAllNodes: () => {
      update((s) => ({
        ...s,
        mapping: { ...s.mapping, nodes: {} },
      }))
    },

    /**
     * Clear error
     */
    clearError: () => {
      update((s) => ({ ...s, error: null }))
    },

    /**
     * Reset store
     */
    reset: () => {
      set(initialState)
    },
  }
}

export const mappingStore = createMappingStore()

// Derived stores for convenience
export const mappingLoading = derived(mappingStore, ($s) => $s.loading)
export const mappingError = derived(mappingStore, ($s) => $s.error)
export const nodeMapping = derived(mappingStore, ($s) => $s.mapping.nodes)
export const linkMapping = derived(mappingStore, ($s) => $s.mapping.links)
export const mappingHosts = derived(mappingStore, ($s) => $s.hosts)
export const hostInterfaces = derived(mappingStore, ($s) => $s.hostInterfaces)
export const hostInterfacesLoading = derived(mappingStore, ($s) => $s.hostInterfacesLoading)

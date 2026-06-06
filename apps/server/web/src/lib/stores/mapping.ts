/**
 * Mapping Store
 * Shared state for topology node/link mapping across pages.
 *
 * A topology can have multiple `metrics`-purpose data sources attached.
 * Each plugin uses its own host-id namespace (Zabbix host ids, Aruba
 * serials, NetBox device ids, …) so they partition naturally — a host
 * id is unambiguous about which source owns it. The store keeps each
 * loaded host tagged with its `sourceId` so the mapping UI can:
 *
 * 1. group dropdowns by source for the operator,
 * 2. resolve which source to ask for a given host's interfaces.
 *
 * The persisted mapping shape (`MetricsMapping` from `@shumoku/core`)
 * is intentionally source-agnostic — see `docs/plugin-authoring.md`'s
 * "core defines the display contract" principle.
 */

import type { Identity } from '@shumoku/core'
import { derived, get, writable } from 'svelte/store'
import { api } from '$lib/api'
import { matchNodeToHost } from '$lib/auto-mapping'
import { topologies } from '$lib/stores/topologies'
import type {
  Host,
  HostItem,
  InterfaceNeighbor,
  MetricsMapping,
  Topology,
  TopologyDataSource,
} from '$lib/types'

/**
 * A `Host` annotated with its origin data source. Web-local — does not
 * leak into the persisted mapping shape, which stays plugin-agnostic.
 */
export interface MappingHost extends Host {
  /** Data source this host came from. */
  sourceId: string
  /** Human-readable source name for UI grouping (`<optgroup>` label). */
  sourceName: string
}

interface MetricsSourceInfo {
  id: string
  name: string
  /** Higher precedence wins on metrics merge conflicts. Lower number = higher precedence. */
  priority: number
}

interface MappingState {
  topologyId: string | null
  mapping: MetricsMapping
  /** Flat list of hosts across all metrics sources, each tagged with its source. */
  hosts: MappingHost[]
  /** Metrics sources for this topology (id + display name). Empty when none configured. */
  metricsSources: MetricsSourceInfo[]
  // Interfaces per host (hostId -> interfaces)
  hostInterfaces: Record<string, HostItem[]>
  hostInterfacesLoading: Record<string, boolean>
  // LLDP/CDP neighbours per host (hostId -> neighbours), for link auto-map
  hostNeighbors: Record<string, InterfaceNeighbor[]>
  loading: boolean
  hostsLoading: boolean
  error: string | null
}

const initialState: MappingState = {
  topologyId: null,
  mapping: { nodes: {}, links: {} },
  hosts: [],
  metricsSources: [],
  hostInterfaces: {},
  hostInterfacesLoading: {},
  hostNeighbors: {},
  loading: false,
  hostsLoading: false,
  error: null,
}

/**
 * Look up which metrics source owns a host. Plugin host-id namespaces
 * are structurally disjoint in practice (Zabbix numbers vs Aruba
 * serials vs NetBox ids), so the first match wins. Returns undefined
 * if the host isn't currently in the loaded set.
 */
function sourceIdForHost(hosts: MappingHost[], hostId: string): string | undefined {
  return hosts.find((h) => h.id === hostId)?.sourceId
}

async function loadHostsForSources(sources: MetricsSourceInfo[]): Promise<MappingHost[]> {
  // Fetch every source in parallel. A single source failing must not
  // block the others — the UI shows whatever loaded successfully.
  const results = await Promise.allSettled(
    sources.map(async (src) => {
      const hosts = await api.dataSources.getHosts(src.id)
      return hosts.map<MappingHost>((h) => ({
        ...h,
        sourceId: src.id,
        sourceName: src.name,
      }))
    }),
  )
  const out: MappingHost[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') out.push(...r.value)
  }
  return out
}

/** Extract the `metrics`-purpose sources, resolved + priority-sorted. */
function metricsSourcesOf(sources: TopologyDataSource[]): MetricsSourceInfo[] {
  return (
    sources
      .filter((s) => s.purpose === 'metrics')
      .map((s) => ({
        id: s.dataSourceId,
        name: s.dataSource?.name ?? s.dataSourceId,
        priority: s.priority,
      }))
      // Sort by priority ascending (lower number = higher precedence) so the
      // UI presents sources in operator-defined order.
      .sort((a, b) => a.priority - b.priority)
  )
}

function createMappingStore() {
  const { subscribe, set, update } = writable<MappingState>(initialState)

  return {
    subscribe,

    /**
     * Hydrate from already-fetched topology + sources. Use this when the
     * caller has already fetched the data (avoids duplicate API calls).
     * Triggers host loading in the background.
     */
    hydrate: (topologyId: string, _topo: Topology, sources: TopologyDataSource[]) => {
      const metricsSources = metricsSourcesOf(sources)

      update((s) => ({
        ...s,
        topologyId,
        mapping: { nodes: {}, links: {} },
        metricsSources,
        loading: false,
        error: null,
      }))

      // Fetch the RESOLVED mapping (bindings ∪ residual), not topo.mappingJson —
      // node bindings live as attachments and would be missed (and stripped on
      // save) if we parsed the blob. Guard against a topology switch mid-flight:
      // only apply if the store is still on this topology.
      api.topologies
        .getMapping(topologyId)
        .then((mapping) => update((s) => (s.topologyId === topologyId ? { ...s, mapping } : s)))
        .catch(() => {
          /* leave the empty mapping; a transient resolve failure isn't fatal */
        })

      if (metricsSources.length > 0) {
        update((s) => ({ ...s, hostsLoading: true }))
        loadHostsForSources(metricsSources)
          .then((hosts) => update((s) => ({ ...s, hosts, hostsLoading: false })))
          .catch(() => update((s) => ({ ...s, hostsLoading: false })))
      }
    },

    /**
     * Load mapping data for a topology (fetches topology + sources itself).
     * Prefer `hydrate()` when the caller already has the data.
     */
    load: async (topologyId: string, forceReload = false) => {
      const current = get({ subscribe })

      // Skip if already loaded for this topology (unless force reload)
      if (!forceReload && current.topologyId === topologyId && !current.loading) {
        return
      }

      update((s) => ({ ...s, loading: true, error: null, topologyId }))

      try {
        // The RESOLVED mapping (bindings ∪ residual), not topo.mappingJson.
        const [mapping, sources] = await Promise.all([
          api.topologies.getMapping(topologyId),
          api.topologies.sources.list(topologyId),
        ])

        const metricsSources = metricsSourcesOf(sources)

        update((s) => ({
          ...s,
          mapping,
          metricsSources,
          loading: false,
        }))

        if (metricsSources.length > 0) {
          update((s) => ({ ...s, hostsLoading: true }))
          try {
            const hosts = await loadHostsForSources(metricsSources)
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
        const result = await api.topologies.updateNodeMapping(
          current.topologyId,
          nodeId,
          hostMapping,
        )
        topologies.upsert(result.topology)
      } catch (e) {
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
        bandwidth?: number
      } | null,
    ) => {
      update((s) => {
        const links = { ...s.mapping.links }
        if (
          linkMapping &&
          (linkMapping.monitoredNodeId || linkMapping.interface || linkMapping.bandwidth)
        ) {
          links[linkId] = { ...links[linkId], ...linkMapping }
        } else {
          delete links[linkId]
        }
        return { ...s, mapping: { ...s.mapping, links } }
      })
    },

    /**
     * Load interfaces for a specific host. Picks the source the host
     * was loaded from (recorded in the `MappingHost` tag) — important
     * because the host-id namespace is plugin-defined.
     */
    loadHostInterfaces: async (hostId: string) => {
      const current = get({ subscribe })
      const sourceId = sourceIdForHost(current.hosts, hostId)
      if (!sourceId) return

      // Skip if already loaded or loading
      if (current.hostInterfaces[hostId] || current.hostInterfacesLoading[hostId]) {
        return
      }

      update((s) => ({
        ...s,
        hostInterfacesLoading: { ...s.hostInterfacesLoading, [hostId]: true },
      }))

      try {
        // Fetch interfaces and LLDP/CDP neighbours together so both are ready
        // when this resolves — link auto-map prefers the neighbour (which local
        // interface faces the peer) and falls back to name matching. A neighbour
        // fetch failure must not fail interface loading.
        const [items, neighbors] = await Promise.all([
          api.dataSources.getHostItems(sourceId, hostId),
          api.dataSources.getInterfaceNeighbors(sourceId, hostId).catch(() => []),
        ])
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
            ifName = match?.[1] ? match[1].trim() : item.name
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
          hostNeighbors: { ...s.hostNeighbors, [hostId]: neighbors },
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
        const updated = await api.topologies.updateMapping(current.topologyId, current.mapping)
        topologies.upsert(updated)
      } catch (e) {
        update((s) => ({
          ...s,
          error: e instanceof Error ? e.message : 'Failed to save mapping',
        }))
        throw e
      }
    },

    /**
     * Auto-map nodes to hosts via composite identity + name matching
     * (see `matchNodeToHost`). Returns a per-strategy breakdown so the UI can
     * show how confident the matches were.
     */
    autoMapNodes: (
      nodeList: Array<{ id: string; label?: string | string[]; identity?: Identity }>,
      options: { overwrite?: boolean } = {},
    ) => {
      const current = get({ subscribe })
      if (current.hosts.length === 0)
        return { matched: 0, total: nodeList.length, byIdentity: 0, byName: 0 }

      let byIdentity = 0
      let byName = 0
      const nodes = { ...current.mapping.nodes }

      for (const node of nodeList) {
        if (!options.overwrite && nodes[node.id]?.hostId) continue

        const match = matchNodeToHost(node, current.hosts)
        if (!match) continue

        nodes[node.id] = { hostId: match.host.id, hostName: match.host.name }
        if (match.via === 'identity') byIdentity++
        else byName++
      }

      update((s) => ({ ...s, mapping: { ...s.mapping, nodes } }))

      return { matched: byIdentity + byName, total: nodeList.length, byIdentity, byName }
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

    clearAllLinks: () => {
      update((s) => ({
        ...s,
        mapping: { ...s.mapping, links: {} },
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
export const metricsSources = derived(mappingStore, ($s) => $s.metricsSources)
export const hostInterfaces = derived(mappingStore, ($s) => $s.hostInterfaces)
export const hostInterfacesLoading = derived(mappingStore, ($s) => $s.hostInterfacesLoading)
export const hostNeighbors = derived(mappingStore, ($s) => $s.hostNeighbors)

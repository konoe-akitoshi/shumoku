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

import { type Identity, nodeIdentityKeys } from '@shumoku/core'
import { derived, get, writable } from 'svelte/store'
import { api } from '$lib/api'
import { NODE_MATCH_THRESHOLD, nodeNameMatchScore } from '$lib/auto-mapping'
import { topologies } from '$lib/stores/topologies'
import type { Host, HostItem, MetricsMapping, Topology, TopologyDataSource } from '$lib/types'

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

/**
 * Index hosts by every identity key they expose (`kind:value`) for
 * deterministic node→host matching. A key resolving to exactly one host is a
 * confident match; a key shared by several hosts is ambiguous and skipped in
 * favour of the next-priority key (or, ultimately, fuzzy name matching).
 */
function buildHostIdentityIndex(hosts: MappingHost[]): Map<string, MappingHost[]> {
  const index = new Map<string, MappingHost[]>()
  for (const host of hosts) {
    for (const key of nodeIdentityKeys(host.identity)) {
      const k = `${key.kind}:${key.value}`
      const bucket = index.get(k)
      if (bucket) bucket.push(host)
      else index.set(k, [host])
    }
  }
  return index
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
    hydrate: (topologyId: string, topo: Topology, sources: TopologyDataSource[]) => {
      let mapping: MetricsMapping = { nodes: {}, links: {} }
      if (topo.mappingJson) {
        try {
          mapping = JSON.parse(topo.mappingJson)
        } catch {
          // Ignore parse error
        }
      }

      const metricsSources = metricsSourcesOf(sources)

      update((s) => ({
        ...s,
        topologyId,
        mapping,
        metricsSources,
        loading: false,
        error: null,
      }))

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
        const items = await api.dataSources.getHostItems(sourceId, hostId)
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
     * Auto-map nodes to hosts. Tries deterministic identity matching first
     * (mgmtIp / chassisId / sysName / vendorId, in priority order) and falls
     * back to fuzzy name matching. Returns a per-strategy breakdown so the UI
     * can show how confident the match was.
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
      const identityIndex = buildHostIdentityIndex(current.hosts)

      for (const node of nodeList) {
        if (!options.overwrite && nodes[node.id]?.hostId) continue

        // 1. Deterministic identity match, in priority order. The first key
        //    that resolves to exactly one host wins; ambiguous keys (shared by
        //    multiple hosts, e.g. a duplicated mgmtIp) fall through.
        let chosen: MappingHost | null = null
        for (const key of nodeIdentityKeys(node.identity)) {
          const candidates = identityIndex.get(`${key.kind}:${key.value}`)
          if (candidates && candidates.length === 1) {
            chosen = candidates[0] ?? null
            break
          }
        }
        if (chosen) byIdentity++

        // 2. Fall back to fuzzy name matching (the previous behaviour). Ties
        //    are broken by source priority via the order of `current.hosts`.
        if (!chosen) {
          const nodeLabel = Array.isArray(node.label) ? node.label[0] : node.label
          if (nodeLabel) {
            let bestHost: MappingHost | null = null
            let bestScore = 0
            for (const host of current.hosts) {
              const score = nodeNameMatchScore(nodeLabel, host.name, host.displayName)
              if (score > bestScore) {
                bestScore = score
                bestHost = host
              }
            }
            if (bestHost && bestScore >= NODE_MATCH_THRESHOLD) {
              chosen = bestHost
              byName++
            }
          }
        }

        if (chosen) {
          nodes[node.id] = { hostId: chosen.id, hostName: chosen.name }
        }
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

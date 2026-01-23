/**
 * Zabbix Poller
 * Periodically fetches metrics from Zabbix and updates topology data
 */

import type { ZabbixConfig, MetricsData, TopologyInstance } from '../types.js'
import { ZabbixClient } from './client.js'
import { ZabbixMapper, type ResolvedNodeMapping, type ResolvedLinkMapping } from './mapper.js'

export class ZabbixPoller {
  private client: ZabbixClient
  private mapper: ZabbixMapper
  private config: ZabbixConfig
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private nodeMappings: Map<string, Map<string, ResolvedNodeMapping>> = new Map()
  private linkMappings: Map<string, Map<string, ResolvedLinkMapping>> = new Map()
  private isPolling = false

  constructor(config: ZabbixConfig) {
    this.config = config
    this.client = new ZabbixClient(config)
    this.mapper = new ZabbixMapper(this.client)
  }

  /**
   * Initialize the poller and resolve mappings for a topology
   */
  async initialize(instance: TopologyInstance): Promise<void> {
    // Test connection first
    const connected = await this.client.testConnection()
    if (!connected) {
      throw new Error('Failed to connect to Zabbix')
    }

    // Load mapping file if configured
    if (instance.config.mapping) {
      this.mapper.loadMappingFile(instance.config.mapping)
    }

    // Resolve node mappings
    const nodeMappings = await this.mapper.resolveNodeMappings(instance.graph)
    this.nodeMappings.set(instance.name, nodeMappings)

    // Resolve link mappings
    const linkMappings = await this.mapper.resolveLinkMappings(instance.graph, nodeMappings)
    this.linkMappings.set(instance.name, linkMappings)

    console.log(
      `[Poller] Initialized for ${instance.name}: ` +
        `${nodeMappings.size} nodes, ${linkMappings.size} links`,
    )
  }

  /**
   * Poll metrics for a topology instance
   */
  async poll(instance: TopologyInstance): Promise<MetricsData> {
    const nodeMappings = this.nodeMappings.get(instance.name)
    const linkMappings = this.linkMappings.get(instance.name)

    const metrics: MetricsData = {
      nodes: {},
      links: {},
      timestamp: Date.now(),
    }

    // Poll node metrics
    if (nodeMappings) {
      for (const [nodeId, mapping] of nodeMappings) {
        try {
          const isAvailable = await this.client.getHostAvailability(mapping.hostId)
          metrics.nodes[nodeId] = {
            status: isAvailable ? 'up' : 'down',
            lastSeen: isAvailable ? Date.now() : undefined,
          }
        } catch (err) {
          console.error(`[Poller] Failed to poll node ${nodeId}:`, err)
          metrics.nodes[nodeId] = { status: 'unknown' }
        }
      }
    }

    // Fill in unknown status for unmapped nodes
    for (const node of instance.graph.nodes) {
      if (!metrics.nodes[node.id]) {
        metrics.nodes[node.id] = { status: 'unknown' }
      }
    }

    // Poll link metrics
    if (linkMappings) {
      for (const [linkId, mapping] of linkMappings) {
        try {
          let inBps = 0
          let outBps = 0

          if (mapping.inItemId || mapping.outItemId) {
            const itemIds = [mapping.inItemId, mapping.outItemId].filter(Boolean) as string[]
            const items = await this.client.getItemsByIds(itemIds)

            for (const item of items) {
              const value = Number.parseFloat(item.lastvalue) || 0
              if (item.itemid === mapping.inItemId) {
                inBps = value
              } else if (item.itemid === mapping.outItemId) {
                outBps = value
              }
            }
          }

          // Calculate utilization as percentage of capacity
          const maxBps = Math.max(inBps, outBps)
          const utilization = mapping.capacity > 0 ? (maxBps / mapping.capacity) * 100 : 0

          metrics.links[linkId] = {
            status: utilization > 0 ? 'up' : 'unknown',
            utilization: Math.round(utilization * 10) / 10,
            inBps,
            outBps,
          }
        } catch (err) {
          console.error(`[Poller] Failed to poll link ${linkId}:`, err)
          metrics.links[linkId] = { status: 'unknown' }
        }
      }
    }

    // Fill in unknown status for unmapped links
    for (let i = 0; i < instance.graph.links.length; i++) {
      const linkId = instance.graph.links[i].id || `link-${i}`
      if (!metrics.links[linkId]) {
        metrics.links[linkId] = { status: 'unknown' }
      }
    }

    return metrics
  }

  /**
   * Start periodic polling for a list of instances
   */
  start(
    instances: TopologyInstance[],
    onUpdate: (name: string, metrics: MetricsData) => void,
  ): void {
    if (this.pollInterval) {
      this.stop()
    }

    const pollAll = async () => {
      if (this.isPolling) return
      this.isPolling = true

      try {
        for (const instance of instances) {
          try {
            const metrics = await this.poll(instance)
            onUpdate(instance.name, metrics)
          } catch (err) {
            console.error(`[Poller] Failed to poll ${instance.name}:`, err)
          }
        }
      } finally {
        this.isPolling = false
      }
    }

    // Initial poll
    pollAll()

    // Schedule periodic polling
    this.pollInterval = setInterval(pollAll, this.config.pollInterval)
    console.log(`[Poller] Started polling every ${this.config.pollInterval}ms`)
  }

  /**
   * Stop periodic polling
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
      console.log('[Poller] Stopped polling')
    }
  }
}

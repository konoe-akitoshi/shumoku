/**
 * Zabbix Mapper
 * Maps network topology elements to Zabbix hosts and items
 */

import * as fs from 'node:fs'
import * as yaml from 'js-yaml'
import type { Link, NetworkGraph } from '@shumoku/core'
import type { ZabbixMapping } from '../types.js'
import { getBandwidthCapacity } from '../bandwidth.js'
import type { ZabbixClient } from './client.js'

/**
 * Extract node ID and port from a link endpoint
 */
function parseEndpoint(endpoint: Link['from'] | Link['to']): { node: string; port?: string } {
  if (typeof endpoint === 'string') {
    const parts = endpoint.split(':')
    return { node: parts[0], port: parts[1] }
  }
  return { node: endpoint.node, port: endpoint.port }
}

export interface ResolvedNodeMapping {
  nodeId: string
  hostId: string
  hostName: string
}

export interface ResolvedLinkMapping {
  linkId: string
  inItemId?: string
  outItemId?: string
  capacity: number
}

export class ZabbixMapper {
  private client: ZabbixClient
  private mapping: ZabbixMapping | null = null

  constructor(client: ZabbixClient) {
    this.client = client
  }

  /**
   * Load mapping from a YAML file
   */
  loadMappingFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      console.warn(`[Mapper] Mapping file not found: ${filePath}`)
      return
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    this.mapping = yaml.load(content) as ZabbixMapping
    console.log(`[Mapper] Loaded mapping from ${filePath}`)
  }

  /**
   * Resolve node mappings for a graph
   * Uses explicit mapping or falls back to hostname matching
   */
  async resolveNodeMappings(graph: NetworkGraph): Promise<Map<string, ResolvedNodeMapping>> {
    const result = new Map<string, ResolvedNodeMapping>()

    for (const node of graph.nodes) {
      const explicit = this.mapping?.nodes?.[node.id]

      if (explicit?.hostId) {
        // Explicit host ID
        const host = await this.client.getHostById(explicit.hostId)
        if (host) {
          result.set(node.id, {
            nodeId: node.id,
            hostId: host.hostid,
            hostName: host.host,
          })
        }
      } else if (explicit?.hostName) {
        // Explicit host name
        const host = await this.client.getHostByName(explicit.hostName)
        if (host) {
          result.set(node.id, {
            nodeId: node.id,
            hostId: host.hostid,
            hostName: host.host,
          })
        }
      } else {
        // Try to match by node ID or label
        const labelToTry = Array.isArray(node.label) ? node.label[0] : node.label
        const namesToTry = [node.id, labelToTry].filter(Boolean)

        for (const name of namesToTry) {
          const host = await this.client.getHostByName(name)
          if (host) {
            result.set(node.id, {
              nodeId: node.id,
              hostId: host.hostid,
              hostName: host.host,
            })
            break
          }
        }
      }
    }

    console.log(`[Mapper] Resolved ${result.size}/${graph.nodes.length} node mappings`)
    return result
  }

  /**
   * Resolve link mappings for a graph
   * Uses explicit mapping or falls back to interface name matching
   */
  async resolveLinkMappings(
    graph: NetworkGraph,
    nodeMappings: Map<string, ResolvedNodeMapping>,
  ): Promise<Map<string, ResolvedLinkMapping>> {
    const result = new Map<string, ResolvedLinkMapping>()

    for (let i = 0; i < graph.links.length; i++) {
      const link = graph.links[i]
      const linkId = link.id || `link-${i}`
      const explicit = this.mapping?.links?.[linkId]

      // Default capacity based on bandwidth
      const capacity = explicit?.capacity || getBandwidthCapacity(link.bandwidth)

      if (explicit?.in || explicit?.out) {
        // Explicit item IDs
        result.set(linkId, {
          linkId,
          inItemId: explicit.in,
          outItemId: explicit.out,
          capacity,
        })
      } else {
        // Try to resolve from node/interface
        const from = parseEndpoint(link.from)
        const fromNodeId = from.node
        const fromInterface = from.port || explicit?.interface

        const nodeMapping = nodeMappings.get(fromNodeId)
        if (nodeMapping && fromInterface) {
          const traffic = await this.client.getInterfaceTraffic(nodeMapping.hostId, fromInterface)
          result.set(linkId, {
            linkId,
            inItemId: traffic.in?.itemid,
            outItemId: traffic.out?.itemid,
            capacity,
          })
        } else if (nodeMapping) {
          // Try to get any interface traffic
          const traffic = await this.client.getInterfaceTraffic(nodeMapping.hostId)
          result.set(linkId, {
            linkId,
            inItemId: traffic.in?.itemid,
            outItemId: traffic.out?.itemid,
            capacity,
          })
        }
      }
    }

    console.log(`[Mapper] Resolved ${result.size}/${graph.links.length} link mappings`)
    return result
  }

  /**
   * Get bandwidth capacity in bps
   */
}

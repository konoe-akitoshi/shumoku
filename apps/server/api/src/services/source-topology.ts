import type { DataSourcePlugin, Host, NetworkGraph, TopologyCapable } from '@shumoku/core'
import { hasHostsCapability, hasMetricsCapability } from '../plugins/types.js'

/** Opt-in binding from a source's own topology IDs to its own host IDs.
 * Instance IDs come from the server; plugin type names never identify bindings.
 * Human overrides/suppressions remain authoritative in the entity-keyed mapping store. */
export function bindSourceHosts(
  graph: NetworkGraph,
  hosts: Host[],
  sourceId: string,
): NetworkGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const matches = hosts.filter((h) => h.id === node.id)
      const host = matches.length === 1 ? matches[0] : undefined
      if (!host) return node
      const attachments = node.attachments ?? []
      const bound = attachments.some((a) => a.kind === 'metrics-binding' && a.sourceId === sourceId)
      return {
        ...node,
        attachments: bound
          ? attachments
          : [
              ...attachments,
              {
                kind: 'metrics-binding' as const,
                sourceId,
                hostId: host.id,
                hostName: host.name,
              },
            ],
        ports: node.ports?.map((port) => {
          const name = port.identity?.ifName ?? port.interfaceName
          if (
            !name ||
            port.attachments?.some((a) => a.kind === 'metrics-binding' && a.sourceId === sourceId)
          )
            return port
          return {
            ...port,
            attachments: [
              ...(port.attachments ?? []),
              {
                kind: 'metrics-binding' as const,
                sourceId,
                interfaceName: name,
                interfaceIdentity: port.identity,
              },
            ],
          }
        }),
      }
    }),
  }
}

export async function fetchSourceTopology(
  plugin: DataSourcePlugin & TopologyCapable,
  sourceId: string,
  options?: Record<string, unknown>,
): Promise<NetworkGraph> {
  const graph = await plugin.fetchTopology(options)
  if (
    options?.['autoBindMetrics'] !== true ||
    !hasHostsCapability(plugin) ||
    !hasMetricsCapability(plugin)
  )
    return graph
  return bindSourceHosts(graph, await plugin.getHosts(), sourceId)
}

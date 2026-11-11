import {
  type Attachment,
  buildIdentity,
  type DataSourcePlugin,
  type Host,
  type ObservationLayer,
  type SourceNetwork,
  type TopologyCapable,
} from '@shumoku/core'
import { hasHostsCapability, hasMetricsCapability } from '../plugins/types.js'

type NodeObservationEntry = NonNullable<ObservationLayer['nodes']>[string]

const boundTo = (attachments: readonly Attachment[] | undefined, sourceId: string) =>
  attachments?.some((a) => a.kind === 'metrics-binding' && a.sourceId === sourceId) ?? false

/** Opt-in binding from a source's own topology IDs to its own host IDs.
 * Instance IDs come from the server; plugin type names never identify bindings.
 * Human overrides/suppressions remain authoritative in the entity-keyed mapping store. */
export function bindSourceHosts(
  source: SourceNetwork,
  hosts: Host[],
  sourceId: string,
): SourceNetwork {
  const observed: Record<string, NodeObservationEntry> = { ...source.observation?.nodes }
  for (const node of source.network.nodes) {
    const matches = hosts.filter((h) => h.id === node.id)
    const host = matches.length === 1 ? matches[0] : undefined
    if (!host) continue
    const entry = observed[node.id] ?? {}
    // Every port the source names: written on the node, or seen in its observation.
    const written = new Map(node.ports?.map((p) => [p.name, p]))
    const names = new Set([...written.keys(), ...Object.keys(entry.ports ?? {})])
    const ports = Object.fromEntries(
      [...names].map((name) => {
        const port = entry.ports?.[name] ?? {}
        if (boundTo(port.attachments, sourceId)) return [name, port]
        // The port's name is its interface name; the binding keys on it (plus the port's MAC
        // and the source's ifIndex, so a provider-side rename still re-resolves).
        const interfaceIdentity = buildIdentity({
          ifName: name,
          mac: written.get(name)?.mac,
          ifIndex: port.ifIndex,
        })
        const binding: Attachment = {
          kind: 'metrics-binding',
          sourceId,
          interfaceName: written.get(name)?.interfaceName ?? name,
          ...(interfaceIdentity && { interfaceIdentity }),
        }
        return [name, { ...port, attachments: [...(port.attachments ?? []), binding] }]
      }),
    )
    const binding: Attachment = {
      kind: 'metrics-binding',
      sourceId,
      hostId: host.id,
      hostName: host.name,
    }
    observed[node.id] = {
      ...entry,
      attachments: boundTo(entry.attachments, sourceId)
        ? (entry.attachments ?? [])
        : [...(entry.attachments ?? []), binding],
      ...(Object.keys(ports).length > 0 && { ports }),
    }
  }
  return { ...source, observation: { ...source.observation, nodes: observed } }
}

export async function fetchSourceTopology(
  plugin: DataSourcePlugin & TopologyCapable,
  sourceId: string,
  options?: Record<string, unknown>,
): Promise<SourceNetwork> {
  const source = await plugin.fetchTopology(options)
  if (
    options?.['autoBindMetrics'] !== true ||
    !hasHostsCapability(plugin) ||
    !hasMetricsCapability(plugin)
  )
    return source
  return bindSourceHosts(source, await plugin.getHosts(), sourceId)
}

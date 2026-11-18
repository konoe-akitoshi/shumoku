import type { inputModel, SourceNetwork } from '@shumoku/core'
import { buildTopology } from './topology.js'
import type { Inventory, Resource } from './types.js'

const id = (resource: Resource) => `k8s:${resource.metadata.uid}`
const name = (resource: Resource) => `${resource.metadata.namespace}/${resource.metadata.name}`
const basis = 'Configured Kubernetes backends. Traffic, latency and drops are not collected.'

/** Resolve only observed controller UIDs; never infer a Deployment by stripping Pod name suffixes. */
export function buildWorkloadTopology(inventory: Inventory): SourceNetwork {
  const podTopology = buildTopology(inventory)
  const controllers = new Map((inventory.workloads ?? []).map((item) => [item.metadata.uid, item]))
  const ownerOf = (resource: Resource): Resource => {
    let current = resource
    const seen = new Set([resource.metadata.uid])
    for (;;) {
      const ref = current.metadata.ownerReferences?.find((owner) => owner.controller === true)
      if (!ref) return current
      const owner = controllers.get(ref.uid)
      if (
        !owner ||
        owner.metadata.namespace !== resource.metadata.namespace ||
        owner.metadata.name !== ref.name ||
        owner.kind !== ref.kind
      )
        return current
      if (seen.has(ref.uid)) return resource
      seen.add(ref.uid)
      current = owner
    }
  }
  const owners = new Map<string, Resource>()
  const podsByOwner = new Map<string, Resource[]>()
  const podOwners = new Map<string, string>()
  for (const controller of controllers.values()) {
    const owner = ownerOf(controller)
    owners.set(id(owner), owner)
  }
  for (const pod of inventory.pods) {
    const owner = ownerOf(pod)
    const ownerId = id(owner)
    owners.set(ownerId, owner)
    podsByOwner.set(ownerId, [...(podsByOwner.get(ownerId) ?? []), pod])
    podOwners.set(id(pod), ownerId)
  }
  const pods = new Map(inventory.pods.map((pod) => [id(pod), pod]))
  const services = new Map(inventory.services.map((service) => [id(service), service]))
  const namespaces = [
    ...new Set([...owners.values(), ...services.values()].map((r) => r.metadata.namespace ?? '')),
  ].sort()
  const group = (resource: Resource) => `k8s:namespace:${resource.metadata.namespace ?? ''}`
  const nodes: inputModel.Node[] = []
  const observed: Record<
    string,
    NonNullable<NonNullable<SourceNetwork['observation']>['nodes']>[string]
  > = {}
  const backends = new Map<string, Array<Record<string, string>>>()
  const serviceNames = new Map<string, Set<string>>()
  const aggregate = new Map<
    string,
    { serviceId: string; ownerId: string; pods: Set<string>; conditions: Set<string> }
  >()
  for (const link of podTopology.network.links) {
    const first = link.endpoints[0]
    const second = link.endpoints[1]
    const serviceId = first && 'node' in first ? first.node : undefined
    const podId = second && 'node' in second ? second.node : undefined
    if (!serviceId || !podId) continue
    const ownerId = podOwners.get(podId)
    const pod = pods.get(podId)
    const service = services.get(serviceId)
    const owner = ownerId ? owners.get(ownerId) : undefined
    if (!ownerId || !pod || !service || !owner) continue
    const linkId = `backend:${service.metadata.uid}:${owner.metadata.uid}`
    const entry = aggregate.get(linkId) ?? {
      serviceId,
      ownerId,
      pods: new Set<string>(),
      conditions: new Set<string>(),
    }
    entry.pods.add(podId)
    const conditions =
      podTopology.observation?.links?.[link.id ?? '']?.metadata?.['endpointConditions']
    const state = Array.isArray(conditions)
      ? conditions.filter((v): v is string => typeof v === 'string')
      : []
    for (const condition of state) entry.conditions.add(condition)
    aggregate.set(linkId, entry)
    backends.set(serviceId, [
      ...(backends.get(serviceId) ?? []),
      {
        Pod: name(pod),
        Workload: `${owner.kind ?? 'Pod'}: ${name(owner)}`,
        Node: pod.spec?.nodeName ?? 'Unscheduled',
        'Endpoint state': state.join('; '),
      },
    ])
    const names = serviceNames.get(ownerId) ?? new Set<string>()
    names.add(name(service))
    serviceNames.set(ownerId, names)
  }
  for (const [ownerId, owner] of owners) {
    const members = (podsByOwner.get(ownerId) ?? []).sort((a, b) => name(a).localeCompare(name(b)))
    const kind = owner.kind ?? 'Pod'
    nodes.push({
      id: ownerId,
      label: `${kind}: ${name(owner)}`,
      type: 'container',
      group: group(owner),
      description: `${members.length} Pods; ${members.filter((pod) => pod.status?.phase === 'Running').length} Running`,
    })
    observed[ownerId] = {
      vendorIds: { 'kubernetes-uid': owner.metadata.uid },
      metadata: {
        'Data basis': basis,
        Kind: kind,
        Namespace: owner.metadata.namespace ?? '',
        Services: [...(serviceNames.get(ownerId) ?? [])].sort(),
        Pods: members.map((pod) => ({
          Name: pod.metadata.name,
          Phase: pod.status?.phase ?? 'Unknown',
          Node: pod.spec?.nodeName ?? 'Unscheduled',
          IP: pod.status?.podIP ?? 'Unknown',
        })),
      },
    }
  }
  for (const [serviceId, service] of services) {
    const original = podTopology.network.nodes.find((node) => node.id === serviceId)
    if (!original) continue
    nodes.push({ ...original, group: group(service) })
    observed[serviceId] = {
      vendorIds: { 'kubernetes-uid': service.metadata.uid },
      metadata: {
        'Data basis': basis,
        Kind: 'Service',
        Namespace: service.metadata.namespace ?? '',
        'Service type': service.spec?.type ?? 'ClusterIP',
        'Cluster IP': service.spec?.clusterIP ?? 'Unknown',
        Backends: (backends.get(serviceId) ?? []).sort((a, b) =>
          (a['Pod'] ?? '').localeCompare(b['Pod'] ?? ''),
        ),
      },
    }
  }
  return {
    network: {
      name: 'Kubernetes service map',
      description: basis,
      groups: [
        {
          id: 'k8s:cluster',
          label: 'Kubernetes cluster — configured backends',
          groups: namespaces.map((namespace) => ({
            id: `k8s:namespace:${namespace}`,
            label: `Namespace: ${namespace}`,
          })),
        },
      ],
      nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
      links: [...aggregate]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([linkId, entry]) => ({
          id: linkId,
          endpoints: [{ node: entry.serviceId }, { node: entry.ownerId }],
          virtual: true,
          description: `${entry.pods.size} backend ${entry.pods.size === 1 ? 'Pod' : 'Pods'}`,
        })),
    },
    observation: {
      nodes: observed,
      links: Object.fromEntries(
        [...aggregate].map(([linkId, entry]) => [
          linkId,
          {
            metadata: {
              relation: 'configured-service-backend',
              backendPodCount: entry.pods.size,
              endpointConditions: [...entry.conditions].sort(),
            },
          },
        ]),
      ),
    },
  }
}

import type { inputModel, SourceNetwork } from '@shumoku/core'
import type { Inventory, Resource } from './types.js'

const id = (resource: Resource) => `k8s:${resource.metadata.uid}`
const key = (resource: Resource) => `${resource.metadata.namespace}/${resource.metadata.name}`

export function buildTopology(inventory: Inventory): SourceNetwork {
  const nodes: inputModel.Node[] = []
  const observedNodes: Record<
    string,
    NonNullable<NonNullable<SourceNetwork['observation']>['nodes']>[string]
  > = {}
  const clusterId = 'k8s:cluster'
  const nodeNames = new Map(inventory.nodes.map((node) => [node.metadata.name, id(node)]))
  // Placement frames keep backend endpoints on the Pod cards. The generic host
  // layout otherwise projects guest links onto the host's outer edge.
  const groups: inputModel.Group[] = [
    {
      id: clusterId,
      label: 'Kubernetes cluster',
      groups: inventory.nodes.map((node) => ({
        id: id(node),
        label: `Node: ${node.metadata.name}`,
      })),
    },
  ]
  const podsByUid = new Map(inventory.pods.map((pod) => [pod.metadata.uid, pod]))
  const services = new Map(inventory.services.map((service) => [key(service), service]))
  const addNode = (resource: Resource, type: string, description: string, group = clusterId) => {
    const namespace = resource.metadata.namespace
    nodes.push({
      id: id(resource),
      label: `${type}: ${namespace ? `${namespace}/` : ''}${resource.metadata.name}`,
      type: type === 'Service' ? 'load-balancer' : 'container',
      description,
      group,
    })
    // IPs can be reused and hostNetwork Pods share their Node's IP. Do not use them
    // as device identity: the API object's UID distinguishes replacement workloads.
    observedNodes[id(resource)] = { vendorIds: { 'kubernetes-uid': resource.metadata.uid } }
  }
  for (const pod of inventory.pods) {
    addNode(
      pod,
      'Pod',
      `Phase: ${pod.status?.phase ?? 'unknown'}; IP: ${pod.status?.podIP ?? 'unknown'}` +
        `; Node: ${pod.spec?.nodeName ?? 'unscheduled'}`,
      pod.spec?.nodeName ? nodeNames.get(pod.spec.nodeName) : undefined,
    )
  }
  for (const service of inventory.services) {
    addNode(
      service,
      'Service',
      `${service.spec?.type ?? 'ClusterIP'}; ` +
        (service.spec?.type === 'ExternalName'
          ? `DNS alias: ${service.spec.externalName ?? 'unknown'}`
          : `Cluster IP: ${service.spec?.clusterIP ?? 'unknown'}`),
    )
  }
  const memberships = new Map<
    string,
    { service: Resource; pod: Resource; conditions: Set<string> }
  >()
  for (const slice of inventory.slices) {
    const namespace = slice.metadata.namespace
    const serviceName = slice.metadata.labels?.['kubernetes.io/service-name']
    const service = services.get(`${namespace}/${serviceName}`)
    if (!service || service.spec?.type === 'ExternalName') continue
    for (const endpoint of slice.endpoints ?? []) {
      const ref = endpoint.targetRef
      if (ref?.kind !== 'Pod' || !ref.uid) continue
      const pod = podsByUid.get(ref.uid)
      if (
        !pod ||
        pod.metadata.namespace !== namespace ||
        (ref.namespace && ref.namespace !== namespace) ||
        (ref.name && ref.name !== pod.metadata.name)
      )
        continue
      const linkId = `backend:${service.metadata.uid}:${pod.metadata.uid}`
      const entry = memberships.get(linkId) ?? { service, pod, conditions: new Set<string>() }
      const conditions = endpoint.conditions
      entry.conditions.add(
        `ready=${conditions?.ready ?? true}, serving=${conditions?.serving ?? true}, terminating=${conditions?.terminating ?? false}`,
      )
      memberships.set(linkId, entry)
    }
  }
  const links: inputModel.Link[] = [...memberships]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([linkId, entry]) => ({
      id: linkId,
      endpoints: [{ node: id(entry.service) }, { node: id(entry.pod) }],
      virtual: true,
      description: 'backend',
    }))
  return {
    network: {
      name: 'Kubernetes cluster',
      groups,
      description:
        'Node placement and configured Service backends; not traffic flows or reachability.',
      nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
      links,
    },
    observation: {
      nodes: observedNodes,
      links: Object.fromEntries(
        [...memberships].map(([linkId, entry]) => [
          linkId,
          {
            metadata: {
              relation: 'configured-service-backend',
              endpointConditions: [...entry.conditions].sort(),
            },
          },
        ]),
      ),
    },
  }
}

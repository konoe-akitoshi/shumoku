import type { inputModel, SourceNetwork } from '@shumoku/core'
import type { Condition, Inventory, ObjectRef, Resource } from './types.js'

const API = 'gateway.networking.k8s.io'
const id = (resource: Resource) => `k8s:${resource.metadata.uid}`
const name = (resource: Resource) => `${resource.metadata.namespace}/${resource.metadata.name}`
const refName = (ref: ObjectRef, namespace?: string) => `${ref.namespace ?? namespace}/${ref.name}`
const basis =
  'Configured Gateway API references, not observed traffic. Conditions are reported by the controller.'

function conditions(values: Condition[] | undefined, generation?: number): string {
  return values?.length
    ? values
        .map(
          (c) =>
            `${c.type}=${c.status}${c.reason ? ` (${c.reason})` : ''}${generation !== undefined && c.observedGeneration !== generation ? ' [stale or unverified generation]' : ''}`,
        )
        .join('; ')
    : 'Unknown (controller status not reported)'
}
function sameParent(a: ObjectRef, b: ObjectRef, namespace?: string): boolean {
  return (
    refName(a, namespace) === refName(b, namespace) &&
    (a.group ?? API) === (b.group ?? API) &&
    (a.kind ?? 'Gateway') === (b.kind ?? 'Gateway') &&
    a.sectionName === b.sectionName &&
    a.port === b.port
  )
}

/** Adds declared routing relations; never presents controller acceptance as traffic evidence. */
export function addGatewayTopology(base: SourceNetwork, inventory: Inventory): SourceNetwork {
  const nodes = [...base.network.nodes]
  const links = [...base.network.links]
  const observed = { ...base.observation?.nodes }
  const observedLinks = { ...base.observation?.links }
  const gateways = new Map((inventory.gateways ?? []).map((r) => [name(r), r]))
  const services = new Map(inventory.services.map((r) => [name(r), r]))
  const namespaceGroups = new Map<string, inputModel.Group>()
  const groupFor = (r: Resource) => {
    // Dedicated groups also work with the Node-placement view, without duplicate frame IDs.
    const groupId = `k8s:gateway-namespace:${r.metadata.namespace ?? ''}`
    namespaceGroups.set(groupId, {
      id: groupId,
      label: `Gateway API: ${r.metadata.namespace ?? ''}`,
    })
    return groupId
  }
  const connect = (
    from: Resource,
    to: Resource,
    suffix: string,
    description: string,
    metadata: Record<string, string | number>,
  ) => {
    const linkId = `gateway:${from.metadata.uid}:${to.metadata.uid}:${suffix}`
    links.push({
      id: linkId,
      endpoints: [{ node: id(from) }, { node: id(to) }],
      virtual: true,
      description,
    })
    observedLinks[linkId] = { metadata: { relation: 'configured-gateway-reference', ...metadata } }
  }
  for (const gateway of gateways.values()) {
    nodes.push({
      id: id(gateway),
      label: `Gateway: ${name(gateway)}`,
      type: 'router',
      group: groupFor(gateway),
      description: conditions(gateway.status?.conditions, gateway.metadata.generation),
    })
    observed[id(gateway)] = {
      vendorIds: { 'kubernetes-uid': gateway.metadata.uid },
      metadata: {
        'Data basis': basis,
        Kind: 'Gateway',
        Namespace: gateway.metadata.namespace ?? '',
        Class: gateway.spec?.gatewayClassName ?? 'Unknown',
        Addresses: gateway.status?.addresses?.map((a) => a.value) ?? [],
        Conditions: conditions(gateway.status?.conditions, gateway.metadata.generation),
        Listeners:
          gateway.spec?.listeners?.map((l) => ({
            Name: l.name,
            Protocol: l.protocol,
            Port: l.port,
            Hostname: l.hostname ?? '*',
            'Allowed namespaces': l.allowedRoutes?.namespaces?.from ?? 'Same',
          })) ?? [],
      },
    }
  }
  for (const route of inventory.routes ?? []) {
    const parents: Array<Record<string, string>> = []
    const backends: Array<Record<string, string | number>> = []
    const matches: Array<Record<string, string>> = []
    for (const [index, ref] of (route.spec?.parentRefs ?? []).entries()) {
      const status = route.status?.parents?.filter((p) =>
        sameParent(p.parentRef, ref, route.metadata.namespace),
      )
      const state = status?.length
        ? status
            .map(
              (p) => `${p.controllerName}: ${conditions(p.conditions, route.metadata.generation)}`,
            )
            .join('; ')
        : conditions(undefined)
      const supported = (ref.group ?? API) === API && (ref.kind ?? 'Gateway') === 'Gateway'
      const gateway = supported ? gateways.get(refName(ref, route.metadata.namespace)) : undefined
      const listener = gateway?.spec?.listeners?.some(
        (l) =>
          (!ref.sectionName || ref.sectionName === l.name) &&
          (ref.port === undefined || ref.port === l.port),
      )
      const resolution = !supported
        ? 'Unsupported parent kind'
        : !gateway
          ? 'Not found in selected scope'
          : !listener
            ? 'Listener not found'
            : 'Reference found; see controller conditions'
      parents.push({
        Gateway: refName(ref, route.metadata.namespace),
        Listener: ref.sectionName ?? '*',
        Port: String(ref.port ?? '*'),
        Reference: resolution,
        Conditions: state,
      })
      if (gateway)
        connect(
          gateway,
          route,
          `parent-${index}`,
          `configured attachment: ${ref.sectionName ?? '*'}; ${state}`,
          { reference: resolution, conditions: state },
        )
    }
    for (const [ruleIndex, rule] of (route.spec?.rules ?? []).entries()) {
      const ruleName = rule.name ?? `rule ${ruleIndex + 1}`
      for (const match of rule.matches ?? [{}])
        matches.push({
          Rule: ruleName,
          Method: match.method ?? '*',
          'Path type': match.path?.type ?? 'PathPrefix',
          Path: match.path?.value ?? '/',
        })
      for (const [backendIndex, ref] of (rule.backendRefs ?? []).entries()) {
        const namespace = ref.namespace ?? route.metadata.namespace
        const supported = (ref.group ?? '') === '' && (ref.kind ?? 'Service') === 'Service'
        const crossNamespace = namespace !== route.metadata.namespace
        const inScope = (inventory.grants ?? []).filter((g) => g.metadata.namespace === namespace)
        const granted =
          !crossNamespace ||
          inScope.some(
            (g) =>
              g.spec?.from?.some(
                (f) =>
                  f.group === API &&
                  f.kind === 'HTTPRoute' &&
                  f.namespace === route.metadata.namespace,
              ) &&
              g.spec?.to?.some(
                (t) => t.group === '' && t.kind === 'Service' && (!t.name || t.name === ref.name),
              ),
          )
        const service =
          supported && granted ? services.get(refName(ref, route.metadata.namespace)) : undefined
        const resolution = !supported
          ? 'Unsupported backend kind'
          : !granted
            ? 'No matching ReferenceGrant observed in selected scope'
            : !service
              ? 'Not found in selected scope'
              : 'Reference found; see parent ResolvedRefs'
        const weight = ref.weight ?? 1
        backends.push({
          Rule: ruleName,
          Service: refName(ref, route.metadata.namespace),
          Port: ref.port ?? 'Unspecified',
          Weight: weight,
          Reference: resolution,
          ReferenceGrant: crossNamespace ? (granted ? 'Matched' : 'Not observed') : 'Not required',
        })
        if (service)
          connect(
            route,
            service,
            `rule-${ruleIndex}-backend-${backendIndex}`,
            `configured: ${ruleName}, port ${ref.port ?? '?'}, weight ${weight}${weight === 0 ? ' (disabled)' : ''}`,
            { reference: resolution, port: ref.port ?? 'Unspecified', weight, rule: ruleName },
          )
      }
    }
    nodes.push({
      id: id(route),
      label: `HTTPRoute: ${name(route)}`,
      type: 'load-balancer',
      group: groupFor(route),
      description: (route.spec?.hostnames ?? ['*']).join(', '),
    })
    observed[id(route)] = {
      vendorIds: { 'kubernetes-uid': route.metadata.uid },
      metadata: {
        'Data basis': basis,
        Kind: 'HTTPRoute',
        Namespace: route.metadata.namespace ?? '',
        Hostnames: route.spec?.hostnames ?? ['*'],
        Parents: parents,
        Matches: matches,
        Backends: backends,
        'Match details':
          'Only path and method are summarized. Header/query matches, filters and non-Service backends are not modeled.',
      },
    }
  }
  const groups = (base.network.groups ?? []).map((g) =>
    g.id === 'k8s:cluster'
      ? { ...g, groups: [...(g.groups ?? []), ...namespaceGroups.values()] }
      : g,
  )
  return {
    ...base,
    network: { ...base.network, nodes, links, groups },
    observation: { ...base.observation, nodes: observed, links: observedLinks },
  }
}

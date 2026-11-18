/** Only the fields used by the topology converter; never persist full Pod specs. */
export interface Metadata {
  uid: string
  name: string
  namespace?: string
  creationTimestamp?: string
  generation?: number
  labels?: Record<string, string>
  ownerReferences?: Array<{ uid: string; name: string; kind: string; controller?: boolean }>
}
export interface Resource {
  metadata: Metadata
  kind?: string
  spec?: {
    gatewayClassName?: string
    listeners?: Array<{
      name: string
      port: number
      protocol: string
      hostname?: string
      allowedRoutes?: { namespaces?: { from?: string } }
    }>
    hostnames?: string[]
    parentRefs?: ObjectRef[]
    rules?: Array<{
      name?: string
      matches?: Array<{ path?: { type?: string; value?: string }; method?: string }>
      backendRefs?: Array<ObjectRef & { weight?: number }>
    }>
    from?: Array<{ group: string; kind: string; namespace: string }>
    to?: Array<{ group: string; kind: string; name?: string }>
    nodeName?: string
    type?: string
    clusterIP?: string
    externalName?: string
  }
  status?: {
    phase?: string
    podIP?: string
    conditions?: Condition[]
    addresses?: Array<{ type?: string; value: string }>
    parents?: Array<{ parentRef: ObjectRef; controllerName: string; conditions?: Condition[] }>
  }
  endpoints?: Array<{
    targetRef?: { kind?: string; namespace?: string; name?: string; uid?: string }
    conditions?: { ready?: boolean; serving?: boolean; terminating?: boolean }
  }>
}
export interface Inventory {
  nodes: Resource[]
  pods: Resource[]
  services: Resource[]
  slices: Resource[]
  gateways?: Resource[]
  routes?: Resource[]
  grants?: Resource[]
  workloads?: Resource[]
}

export interface ObjectRef {
  name: string
  namespace?: string
  group?: string
  kind?: string
  sectionName?: string
  port?: number
}
export interface Condition {
  type: string
  status: string
  reason?: string
  observedGeneration?: number
}

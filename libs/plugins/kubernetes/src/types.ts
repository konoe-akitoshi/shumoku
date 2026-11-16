/** Only the fields used by the topology converter; never persist full Pod specs. */
export interface Metadata {
  uid: string
  name: string
  namespace?: string
  labels?: Record<string, string>
}
export interface Resource {
  metadata: Metadata
  spec?: {
    nodeName?: string
    type?: string
    clusterIP?: string
    externalName?: string
  }
  status?: { phase?: string; podIP?: string }
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
}

export interface Network {
  name?: string
  description?: string
  groups?: Group[]
  routingDomains?: RoutingDomain[]
  connections?: Connection[]
  segments?: Segment[]
  redundancy?: Redundancy[]
  nodes: Node[]
  links: Link[]
}

export interface RoutingDomain {
  id: string
  label?: string
  prefix?: string | string[]
}

export interface Connection {
  id: string
  label?: string
}

export interface Group {
  id: string
  label?: string
  parent?: string
}

export interface Segment {
  id: string
  label?: string
  vlan?: number
  prefix?: string | string[]
  routingDomain?: string
  group?: string
  addresses?: Record<string, string | string[]>
}

export interface Node {
  id: string
  label?: string
  type?: string
  product?: string
  software?: string
  address?: string
  asn?: number
  description?: string
  group?: string
  assumed?: true
  host?: string
  members?: string[]
}

export interface Redundancy {
  id: string
  label?: string
  nodes: string[]
  assumed?: true
}

export const speeds = [
  '10M',
  '100M',
  '1G',
  '2.5G',
  '5G',
  '10G',
  '25G',
  '40G',
  '50G',
  '100G',
  '200G',
  '400G',
  '800G',
  '1.6T',
] as const
export type Speed = (typeof speeds)[number]

export interface Link {
  endpoints: [Endpoint, Endpoint]
  speed?: Speed
  cable?: string
  length?: string
  segments?: string[]
  description?: string
  connection?: string
  assumed?: true
  virtual?: true
}

export type Endpoint = NodeEnd | SegmentEnd | RoutingDomainEnd
export interface NodeEnd {
  node: string
  port?: string
}
export interface SegmentEnd {
  segment: string
}
export interface RoutingDomainEnd {
  routingDomain: string
}

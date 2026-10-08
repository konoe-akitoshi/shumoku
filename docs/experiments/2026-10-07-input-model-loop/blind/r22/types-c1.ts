type Id<Kind extends string> = string & { readonly kind: Kind }
export type GroupId = Id<'group'>
export type RoutingDomainId = Id<'routingDomain'>
export type ConnectionId = Id<'connection'>
export type SegmentId = Id<'segment'>
export type NodeId = Id<'node'>
export type RedundancyId = Id<'redundancy'>

type OneOrMore<T> = T | [T, ...T[]]
type TwoOrMore<T> = [T, T, ...T[]]

export type Prefix = `${string}/${number}`
export type Address = string | Prefix
export type Maker = string
export type Product = Maker | `${Maker | '?'}/${string}`
export type Length = `${number}${'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft'}`
export type Speed =
  | '10M'
  | '100M'
  | '1G'
  | '2.5G'
  | '5G'
  | '10G'
  | '25G'
  | '40G'
  | '50G'
  | '100G'
  | '200G'
  | '400G'
  | '800G'
  | '1.6T'

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

export interface Group {
  id: GroupId
  label?: string
  parent?: GroupId
}

export interface RoutingDomain {
  id: RoutingDomainId
  label?: string
  prefix?: OneOrMore<Prefix>
}

export interface Connection {
  id: ConnectionId
  label?: string
}

export interface Segment {
  id: SegmentId
  label?: string
  vlan?: number
  prefix?: OneOrMore<Prefix>
  routingDomain?: RoutingDomainId
  group?: GroupId
  addresses?: Partial<Record<NodeId | RedundancyId, OneOrMore<Address>>>
}

export interface Node {
  id: NodeId
  label?: string
  type?: string
  product?: Product
  software?: string
  addressInUnknownSegment?: Address
  asn?: number
  description?: string
  group?: GroupId
  existenceUnconfirmed?: true
  host?: NodeId | RedundancyId
  members?: TwoOrMore<string>
}

export interface Redundancy {
  id: RedundancyId
  label?: string
  nodes: TwoOrMore<NodeId>
  pairingUnconfirmed?: true
}

export type Link = NodeToNode | NodeToSegment | NodeToRoutingDomain

interface LinkCommon {
  description?: string
  connection?: ConnectionId
  existenceUnconfirmed?: true
}

type Medium =
  | { virtual?: never; speed?: Speed; cable?: string; length?: Length }
  | { virtual: true; speed?: Speed; cable?: never; length?: never }

export type NodeToNode = LinkCommon &
  Medium & {
    endpoints: [NodeEnd, NodeEnd]
    segments?: SegmentId[]
  }

export type NodeToSegment = LinkCommon &
  Medium & {
    endpoints: [NodeEnd, { segment: SegmentId }]
  }

export type NodeToRoutingDomain = LinkCommon &
  Medium & {
    endpoints: [NodeEnd, { routingDomain: RoutingDomainId }]
  }

export interface NodeEnd {
  node: NodeId
  port?: string
}

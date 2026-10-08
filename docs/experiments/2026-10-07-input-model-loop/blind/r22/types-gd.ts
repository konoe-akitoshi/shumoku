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

/**
 * What is written is known, and anything not written is unknown, not absent: a link without
 * `segments` may still carry some, and a node without links may still be connected somewhere.
 * A link that lists its segments carries those and no others. Other lists, such as a segment's
 * addresses, may be partial.
 */
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

/** A place: site, building, room. */
export interface Group {
  id: GroupId
  label?: string
  groups?: Group[]
}

/**
 * A separate routing domain that segments belong to, such as a VPC, a cloud virtual network or
 * a VRF. Write one only when such a domain is known; a network with a single routing
 * table has none, and a subnet, a place or an autonomous system is not one (see a node's asn).
 */
export interface RoutingDomain {
  id: RoutingDomainId
  label?: string
  prefix?: OneOrMore<Prefix>
}

/** One logical connection made of several links, such as a VPN made of two tunnels. */
export interface Connection {
  id: ConnectionId
  label?: string
}

/**
 * A shared network that any number of links can carry, such as a VLAN, a handoff segment or a
 * cloud subnet. A node is in a segment when it has an address there, when a link carrying the
 * segment ends at it, or when a link joins it to the segment itself.
 */
export interface Segment {
  id: SegmentId
  label?: string
  vlan?: number
  prefix?: OneOrMore<Prefix>
  routingDomain?: RoutingDomainId
  /** The place the segment is confined to, such as an availability zone. Most VLANs span places. */
  group?: GroupId
  /** An address belongs to a node's presence in a segment, not to a port. A set's shared virtual address is written under the set. */
  addresses?: Partial<Record<NodeId | RedundancyId, OneOrMore<Address>>>
}

export interface Node {
  id: NodeId
  /** The node's name, left out when not known. */
  label?: string
  type?: string
  /** From the maker down to as specific as is known: `juniper`, `juniper/ex4400`, `?/ex4400-48p`. */
  product?: Product
  /** Such as its operating system or hypervisor. */
  software?: string
  addressInUnknownSegment?: Address
  asn?: number
  description?: string
  group?: GroupId
  existenceUnconfirmed?: true
  /** The node this one runs on, such as a VM's host; a redundancy set when it is one of the set's nodes, not known which. */
  host?: NodeId | RedundancyId
  /** The devices this node stands for when their links are not told apart, such as stack units. */
  members?: TwoOrMore<string>
}

/** Separate nodes that stand in for one another, such as a VRRP pair or an HA cluster. */
export interface Redundancy {
  id: RedundancyId
  label?: string
  nodes: TwoOrMore<NodeId>
  pairingUnconfirmed?: true
}

/**
 * Undirected. Two nodes may have several links, such as parallel cables or the two tunnels of one
 * VPN. A virtual link has no cable of its own, such as a VPN tunnel, a VM's adapter in a port
 * group, or a BGP session across a shared LAN; a link whose way is not known is neither.
 */
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

/** The node is in the segment, such as a gateway attached through a subnet or a VM's adapter in a port group. */
export type NodeToSegment = LinkCommon &
  Medium & {
    endpoints: [NodeEnd, { segment: SegmentId }]
  }

/** The node is attached to the domain as a whole, such as an internet gateway attached to a VPC. */
export type NodeToRoutingDomain = LinkCommon &
  Medium & {
    endpoints: [NodeEnd, { routingDomain: RoutingDomainId }]
  }

export interface NodeEnd {
  node: NodeId
  port?: string
}

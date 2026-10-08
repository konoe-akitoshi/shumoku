/**
 * The input: the network as it is known now. What is written is known, and anything not written
 * is unknown, not absent: a link without `segments` may still carry some, and a node without
 * links may still be connected somewhere. A written node or link is known to exist unless it is
 * marked assumed. A link that lists its segments carries those and no others. Other lists, such
 * as a segment's addresses, may be partial.
 */

export type GroupId = string
export type RoutingDomainId = string
export type ConnectionId = string
export type SegmentId = string
export type NodeId = string
export type RedundancyId = string

/** One value is written bare and several as a list, which is never empty. */
export type OneOrMore<T> = T | readonly [T, ...T[]]

/** A rate: a number and its unit, such as 100M, 2.5G or 50M. */
export type Rate = `${number}${'M' | 'G' | 'T'}`

/** A cable's length with its unit, such as 3m. */
export type Length = `${number}${'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft'}`

/**
 * A product path from its maker down to as specific as is known, such as `juniper`,
 * `juniper/ex4400` or `juniper/ex4400/ex4400-48p`. An unknown maker is `?`, as in `?/ex4400-48p`.
 */
export type Product = string

/** A place: site, building, room. A group written inside another is a place within it. */
export interface Group {
  readonly id: GroupId
  readonly label?: string
  readonly groups?: readonly Group[]
}

/**
 * A separate routing domain that segments belong to, such as a VPC, a cloud virtual network or
 * a VRF. Written only when such a domain is known; a network with a single routing table has
 * none, and a subnet, a place or an autonomous system is not one (see a node's asn).
 */
export interface RoutingDomain {
  readonly id: RoutingDomainId
  readonly label?: string
  readonly prefix?: OneOrMore<string>
}

/** One logical connection made of several links, such as a VPN made of two tunnels. */
export interface Connection {
  readonly id: ConnectionId
  readonly label?: string
}

/**
 * A shared network that any number of links can carry, such as a VLAN, a handoff segment or a
 * cloud subnet. A node is in a segment when it has an address there, when a link carrying the
 * segment ends at it, or when a link joins it to the segment itself.
 */
export interface Segment {
  readonly id: SegmentId
  readonly label?: string
  /** 1 to 4094. */
  readonly vlan?: number
  readonly prefix?: OneOrMore<string>
  readonly routingDomain?: RoutingDomainId
  /** The place the segment is confined to, such as an availability zone. */
  readonly group?: GroupId
  /**
   * The addresses nodes have in the segment, by node. An address belongs to a node's presence in
   * the segment rather than to a port. A redundancy set's shared address is written under the set.
   */
  readonly addresses?: Readonly<Record<NodeId | RedundancyId, OneOrMore<string>>>
}

export interface Node {
  readonly id: NodeId
  /** The node's name, left out when it is not known; the id is then only a handle. */
  readonly label?: string
  readonly type?: string
  readonly product?: Product
  /** The software it runs, such as its operating system or hypervisor. */
  readonly software?: string
  /** An address whose segment is not known; once it is, the address goes in the segment. */
  readonly address?: string
  /** The autonomous system it is in, such as a router's local AS. */
  readonly asn?: number
  readonly description?: string
  readonly group?: GroupId
  /** Its existence is not confirmed. Details that are not known are left out instead. */
  readonly assumed?: true
  /** What it runs on: a node, or a redundancy set when which of its nodes is not known. */
  readonly host?: NodeId | RedundancyId
  /** The devices it stands for when their links are not told apart, such as stack units. */
  readonly members?: readonly string[]
}

/** Separate nodes that stand in for one another, such as a VRRP pair or an HA cluster. */
export interface Redundancy {
  readonly id: RedundancyId
  readonly label?: string
  /** Two or more. */
  readonly nodes: readonly NodeId[]
  /** The pairing is believed but not confirmed. */
  readonly assumed?: true
}

/**
 * One end of a link: a node (and its port when known), a segment the node is in, or a routing
 * domain the node is attached to as a whole.
 */
export interface NodeEnd {
  readonly node: NodeId
  readonly port?: string
}
export interface SegmentEnd {
  readonly segment: SegmentId
}
export interface RoutingDomainEnd {
  readonly routingDomain: RoutingDomainId
}
export type Endpoint = NodeEnd | SegmentEnd | RoutingDomainEnd

/**
 * Undirected: the two ends have no order. Two nodes may have several links, such as parallel
 * cables or the two tunnels of one VPN.
 */
export interface Link {
  readonly endpoints: readonly [Endpoint, Endpoint]
  /** The rate the link runs at. */
  readonly speed?: Rate
  /** A lower rate than the link runs at, that traffic over it is held to. */
  readonly bandwidth?: Rate
  /** The cable's type, such as cat6, mmf-om4, smf or dac. */
  readonly cable?: string
  readonly length?: Length
  /** The segments the link carries. Both ends are in each of them. */
  readonly segments?: readonly SegmentId[]
  readonly description?: string
  /** The connection this link is one part of. */
  readonly connection?: ConnectionId
  /** Its existence is not confirmed. Unknown ports or segments are left out instead. */
  readonly assumed?: true
  /**
   * It has no cable of its own, such as a VPN tunnel, a VM's adapter in a port group, or a BGP
   * session across a shared LAN. A link whose way is not known is neither virtual nor cabled.
   */
  readonly virtual?: true
}

export interface Network {
  readonly name?: string
  readonly description?: string
  readonly groups?: readonly Group[]
  readonly routingDomains?: readonly RoutingDomain[]
  readonly connections?: readonly Connection[]
  readonly segments?: readonly Segment[]
  readonly redundancy?: readonly Redundancy[]
  readonly nodes: readonly Node[]
  readonly links: readonly Link[]
}

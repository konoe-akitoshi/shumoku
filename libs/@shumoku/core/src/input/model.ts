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
export type LinkId = string

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
  /** Unique among groups; nodes and segments name their group by it. */
  readonly id: GroupId
  /** The place's name, such as `Tokyo DC` or `Rack A1`. */
  readonly label?: string
  /** The places within it. */
  readonly groups?: readonly Group[]
}

/**
 * A separate routing domain that segments belong to, such as a VPC, a cloud virtual network or
 * a VRF. Written only when such a domain is known; a network with a single routing table has
 * none, and a subnet, a place or an autonomous system is not one (see a node's asn).
 */
export interface RoutingDomain {
  /** Unique among routing domains; segments name theirs by it. */
  readonly id: RoutingDomainId
  /** Its name, such as the VPC's or the VRF's. */
  readonly label?: string
  /** The address ranges it holds, such as a VPC's CIDR blocks. */
  readonly prefix?: OneOrMore<string>
}

/** One logical connection made of several links, such as a VPN made of two tunnels. */
export interface Connection {
  /** Unique among connections; each of its links names it by this. */
  readonly id: ConnectionId
  /** Its name, such as the VPN's. */
  readonly label?: string
}

/**
 * A shared network that any number of links can carry, such as a VLAN, a handoff segment or a
 * cloud subnet. A node is in a segment when it has an address there, when a link carrying the
 * segment ends at it, or when a link joins it to the segment itself.
 */
export interface Segment {
  /** Unique among segments; links name the segments they carry by it. */
  readonly id: SegmentId
  /** Its name, such as `mgmt` or `users-a`. */
  readonly label?: string
  /** Its VLAN ID, 1 to 4094. */
  readonly vlan?: number
  /** Its subnets, such as `10.0.10.0/24`, or one for each address family. */
  readonly prefix?: OneOrMore<string>
  /** The routing domain it belongs to, when it is a separate one such as a VPC or a VRF. */
  readonly routingDomain?: RoutingDomainId
  /** The place the segment is confined to, such as an availability zone. */
  readonly group?: GroupId
  /**
   * The addresses nodes have in the segment, by node. An address belongs to a node's presence in
   * the segment rather than to a port. A redundancy set's shared address is written under the set.
   */
  readonly addresses?: Readonly<Record<NodeId | RedundancyId, OneOrMore<string>>>
}

/** A device, a virtual machine or a service: one thing links end at. */
export interface Node {
  /** Unique among nodes; links, segments and redundancy sets name the node by it. */
  readonly id: NodeId
  /** The node's name, left out when it is not known; the id is then only a handle. */
  readonly label?: string
  /** What kind of node it is, such as router, l3-switch, firewall, server or access-point. */
  readonly type?: string
  /** What it is, from its maker down to its model, as far as is known. */
  readonly product?: Product
  /** The software it runs, such as its operating system or hypervisor. */
  readonly software?: string
  /** An address whose segment is not known; once it is, the address goes in the segment. */
  readonly address?: string
  /** The autonomous system it is in, such as a router's local AS. */
  readonly asn?: number
  /** Anything else worth knowing about it, in words. */
  readonly description?: string
  /** The place it is in. */
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
  /** Unique among redundancy sets; a node's host or a segment address can name the set by it. */
  readonly id: RedundancyId
  /** Its name, such as the cluster's. */
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
  /** The node the link ends at. */
  readonly node: NodeId
  /** The port's name as the device calls it, such as `ge-0/0/1`; left out when not known. */
  readonly port?: string
}
/** A link end at a segment: the node at the other end is joined to the segment as a whole. */
export interface SegmentEnd {
  /** The segment the node is joined to. */
  readonly segment: SegmentId
}
/** A link end at a routing domain: the node at the other end is attached to it as a whole. */
export interface RoutingDomainEnd {
  /** The routing domain the node is attached to. */
  readonly routingDomain: RoutingDomainId
}
export type Endpoint = NodeEnd | SegmentEnd | RoutingDomainEnd

/**
 * Undirected: the two ends have no order. Two nodes may have several links, such as parallel
 * cables or the two tunnels of one VPN.
 */
export interface Link {
  /** Written only when something refers to the link, such as its layout or its cable run. */
  readonly id?: LinkId
  /** Its two ends, in either order. */
  readonly endpoints: readonly [Endpoint, Endpoint]
  /** The rate the link runs at. */
  readonly speed?: Rate
  /** A lower rate than the link runs at, that traffic over it is held to. */
  readonly bandwidth?: Rate
  /** The cable's type, such as cat6, mmf-om4, smf or dac. */
  readonly cable?: string
  /** The cable's length. */
  readonly length?: Length
  /** The segments the link carries. Both ends are in each of them. */
  readonly segments?: readonly SegmentId[]
  /** Anything else worth knowing about it, in words. */
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

/** The whole YAML document: one network. */
export interface Network {
  /** The network's name. */
  readonly name?: string
  /** What the network is, in words. */
  readonly description?: string
  /** Its places, written nested: sites, buildings, rooms, racks. */
  readonly groups?: readonly Group[]
  /** Its separate routing domains, such as VPCs and VRFs. */
  readonly routingDomains?: readonly RoutingDomain[]
  /** Logical connections made of several links. */
  readonly connections?: readonly Connection[]
  /** Its shared networks, such as VLANs and subnets. */
  readonly segments?: readonly Segment[]
  /** Its redundancy sets, such as VRRP pairs and HA clusters. */
  readonly redundancy?: readonly Redundancy[]
  /** Its devices, virtual machines and services. */
  readonly nodes: readonly Node[]
  /** Its links, each between two nodes or between a node and a segment or routing domain. */
  readonly links: readonly Link[]
}

/**
 * What is written is known, and anything not written is unknown, not absent: a link without
 * `segments` may still carry some, and a node without links may still be connected somewhere.
 * A written node or link is known to exist unless it is marked assumed. A link that lists its
 * segments carries those and no others. Other lists, such as a segment's addresses, may be partial.
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

/**
 * A separate routing domain that segments belong to, such as a VPC, a cloud virtual network or
 * a VRF. Write one only when such a domain is known; a network with a single routing
 * table has none, and a subnet, a place or an autonomous system is not one (see a node's asn).
 */
export interface RoutingDomain {
  id: string
  label?: string
  /** The domain's prefixes, such as a VPC's IPv4 and IPv6 ranges. A single one may be written bare. */
  prefix?: string | string[]
}

/** One logical connection made of several links, such as a VPN made of two tunnels. */
export interface Connection {
  id: string
  label?: string
}

/** A place: site, building, room. A group written inside another is a place within it. */
export interface Group {
  id: string
  label?: string
  groups?: Group[]
}

/**
 * A shared network that any number of links can carry, such as a VLAN, a handoff segment or a
 * cloud subnet. A node is in a segment when it has an address there, when a link carrying the
 * segment ends at it, or when a link joins it to the segment itself.
 */
export interface Segment {
  id: string
  label?: string
  vlan?: number
  /** The segment's prefixes, such as one IPv4 and one IPv6. A single prefix may be written without the list. */
  prefix?: string | string[]
  /** The routing domain the segment belongs to. */
  routingDomain?: string
  /** The place the segment is confined to, such as an availability zone. Most VLANs span places. */
  group?: string
  /**
   * The addresses nodes have in the segment, by node. An address belongs to a node's presence in a segment
   * rather than to a port, so a trunk carries one per VLAN and an SVI needs no port at all.
   * A node can be in a segment without a known link into it.
   * A virtual address shared by a redundancy set is written under the set's id.
   * A single address may be written without the list.
   */
  addresses?: Record<string, string | string[]>
}

export interface Node {
  id: string
  /** The node's name. Left out when the name is not known; the id is then only a handle. */
  label?: string
  type?: string
  /**
   * The product this node is one of, whether that product is a box, a virtual appliance or a
   * cloud service: a path from its maker down to as specific as is known, such as `juniper`,
   * `juniper/ex4400` or `juniper/ex4400/ex4400-48p`. When the maker is not known, it is written
   * `?`, such as `?/ex4400-48p`.
   */
  product?: string
  /** The software this node runs, such as its operating system or hypervisor. */
  software?: string
  /**
   * An address whose segment is not known. Once the segment is known, write the address
   * in that segment instead.
   */
  address?: string
  /** The autonomous system number this node is in, such as a router's local AS. */
  asn?: number
  description?: string
  group?: string
  /**
   * True when whether the node exists at all is not confirmed. Details that are not known are
   * left out, not marked assumed.
   */
  assumed?: true
  /**
   * The node this one runs on, such as the host of a VM. A redundancy set's id means it runs on
   * one of the set's nodes, and which one is not known.
   */
  host?: string
  /**
   * Names of the devices one node stands for when their links are not told apart,
   * such as the units of a stack. A link to the node lands on a member nobody can name.
   */
  members?: string[]
}

/** Separate nodes that stand in for one another, such as a VRRP pair or an HA cluster. */
export interface Redundancy {
  id: string
  label?: string
  nodes: string[]
  /** True when the pairing is believed but not confirmed. */
  assumed?: true
}

/** A rate: a number and its unit, such as 100M, 2.5G or 50M. */
export type Speed = `${number}${'M' | 'G' | 'T'}`

/**
 * Undirected: the two endpoints have no order. Two nodes may have several links, such as
 * parallel cables or the two tunnels of one VPN.
 */
export interface Link {
  endpoints: [Endpoint, Endpoint]
  /** The link's speed. */
  speed?: Speed
  /** The cable's type, such as cat6, mmf-om4, smf or dac. */
  cable?: string
  /** The cable's length with its unit, such as 3m. */
  length?: string
  /** The segments the link carries. Both ends of the link are in each of them. */
  segments?: string[]
  description?: string
  /** The connection this link is one part of. */
  connection?: string
  /**
   * True when whether the connection exists at all is not confirmed. Unknown ports or segments
   * are left out, not marked assumed.
   */
  assumed?: true
  /**
   * True when the connection has no cable of its own, such as a VPN tunnel, a VM's adapter in a
   * port group, or a BGP session between two routers across a shared LAN. A link whose way is
   * not known is neither virtual nor given a cable.
   */
  virtual?: true
}

/**
 * One end of a link. A link joins a node to one of:
 * - another node. A port is optional, because many sources know only which nodes are connected.
 * - a segment. The node is in that segment, such as a gateway attached through a subnet or a VM's
 *   adapter in a port group.
 * - a routing domain. The node is attached to the domain as a whole, such as an internet gateway
 *   attached to a VPC.
 */
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

/**
 * Anything not written is unknown, not absent: a link without `segments` may still carry some,
 * and a node without links may still be connected somewhere. A link that lists its segments
 * carries those and no others. Other lists, such as a segment's addresses, may be partial.
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
 * A separate routing domain that segments and nodes belong to, such as a VPC, a cloud virtual
 * network or a VRF. Write one only when such a domain is known; a network with a single routing
 * table has none, and a subnet or a place is not one.
 */
export interface RoutingDomain {
  id: string
  label?: string
  prefix?: string
}

/** One logical connection made of several links, such as a VPN made of two tunnels. */
export interface Connection {
  id: string
  label?: string
}

/** A place: site, building, room. Nested through `parent`. */
export interface Group {
  id: string
  label?: string
  parent?: string
}

/**
 * A shared network that any number of links can carry, such as a VLAN, a handoff segment or a
 * cloud subnet. A link that carries a segment puts both of its ends in it.
 */
export interface Segment {
  id: string
  label?: string
  vlan?: number
  prefix?: string
  /** The routing domain the segment belongs to. */
  routingDomain?: string
  /** The place the segment is confined to, such as an availability zone. Most VLANs span places. */
  group?: string
  /**
   * Every address a node has, by node. An address belongs to a node's presence in a segment
   * rather than to a port, so a trunk carries one per VLAN and an SVI needs no port at all.
   * A node can be in a segment without a known link into it.
   * A virtual address shared by a redundancy set is written under the set's id.
   * A single address may be written without the list.
   */
  addresses?: Record<string, string | string[]>
}

export interface Node {
  id: string
  label?: string
  type?: string
  /**
   * The product this node is one of, whether that product is a box, a virtual appliance or a
   * cloud service: a path from its maker down to as specific as is known, such as `juniper`,
   * `juniper/ex4400` or `juniper/ex4400/ex4400-48p`.
   */
  product?: string
  /** The software this node runs, such as its operating system or hypervisor. */
  software?: string
  /**
   * An address whose segment is not known. Once the segment is known, write the address
   * in that segment instead.
   */
  address?: string
  description?: string
  group?: string
  /** True when the node is believed to exist but not confirmed. */
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

export const speeds = ['100M', '1G', '2.5G', '10G', '25G', '40G', '100G', '400G'] as const
export type Speed = (typeof speeds)[number]

/**
 * Undirected: the two endpoints have no order. Two nodes may have several links, such as
 * parallel cables or the two tunnels of one VPN.
 */
export interface Link {
  endpoints: [Endpoint, Endpoint]
  speed?: Speed
  /** The segments the link carries. Both ends of the link are in each of them. */
  segments?: string[]
  description?: string
  /** The connection this link is one part of. */
  connection?: string
  /** True when the connection is believed to exist but not confirmed. */
  assumed?: true
  /**
   * True when the connection is not a cable, such as a VPN tunnel or a VM's adapter in a port
   * group.
   */
  virtual?: true
}

/**
 * One end of a link: a node (a port is optional, because many sources know only which nodes are
 * connected), or a segment, when a node is attached to a shared network and what is on the other
 * side is not a single node, such as a gateway attached through a subnet or a VM's adapter in a
 * port group. A link to a segment puts the node in that segment. The far end can also be a routing
 * domain, when the node is attached to the domain as a whole, such as an internet gateway attached
 * to a VPC. A node in a segment is already in that segment's domain.
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

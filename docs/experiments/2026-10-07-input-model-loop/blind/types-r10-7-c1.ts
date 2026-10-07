/**
 * Anything not written is unknown, not absent: a link without `segments` may still carry some,
 * and a node without links may still be connected somewhere. A link that lists its segments
 * carries those and no others. Other lists, such as a segment's addresses, may be partial.
 */
export interface Network {
  name?: string
  description?: string
  groups?: Group[]
  segments?: Segment[]
  redundancy?: Redundancy[]
  nodes: Node[]
  links: Link[]
}

/** A place: site, building, room. Nested through `parent`. */
export interface Group {
  id: string
  label?: string
  parent?: string
}

/**
 * A shared network that any number of links can carry, such as a VLAN, a handoff segment or a
 * cloud subnet. The VPC or virtual network that routes between cloud subnets is written as a node
 * in each of its subnets, the way a router is.
 */
export interface Segment {
  id: string
  label?: string
  vlan?: number
  prefix?: string
  /** The place the segment is confined to, such as an availability zone. Most VLANs span places. */
  group?: string
  /**
   * Every address a node has, by node. An address belongs to a node's presence in a segment
   * rather than to a port, so a trunk carries one per VLAN and an SVI needs no port at all.
   * A node can be in a segment without a known link into it.
   * A virtual address shared by a redundancy set is written under the set's id.
   * A single address may be written without the list. A node known to be in the segment
   * whose address is not known is written with an empty list.
   */
  addresses?: Record<string, string[]>
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
  /** An address range the node holds as a whole rather than per segment, such as a VPC's. */
  prefix?: string
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
  segments?: string[]
  description?: string
  /** True when the connection is believed to exist but not confirmed. */
  assumed?: true
  /**
   * True when the connection is not a cable, such as a VPN tunnel. A VM's network adapter is not
   * a link: write the VM in the segment its adapter is on.
   */
  virtual?: true
}

/** A port is optional because many sources know only which nodes are connected. */
export interface Endpoint {
  node: string
  port?: string
}

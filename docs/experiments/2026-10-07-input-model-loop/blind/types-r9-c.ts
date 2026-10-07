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

/** A shared L2 network that any number of links can carry, such as a VLAN or a handoff segment. */
export interface Segment {
  id: string
  label?: string
  vlan?: number
  prefix?: string
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
  vendor?: string
  /** Meaningful only with `vendor`, because the catalog is keyed by both. */
  model?: string
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

/** Undirected: the two endpoints have no order. */
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

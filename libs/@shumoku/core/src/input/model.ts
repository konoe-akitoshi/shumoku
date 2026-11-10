/**
 * The input: the network as it is known now. What is written is known, and anything not written
 * is unknown, not absent: a link without `segments` may still carry some, and a node without
 * links may still be connected somewhere. A written node or link is known to exist unless it is
 * marked assumed. A link that lists its segments carries those and no others. Other lists, such
 * as a segment's addresses, may be partial.
 *
 * A network is read only as written: a field not described here, a value of the wrong shape or
 * an id nothing defines is refused, and the reader lists every such issue with where it is, such
 * as `nodes[3].lable: unknown field; did you mean label?`.
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

/**
 * A port of a node: what the device calls it, and what is known of the receptacle. A link end
 * names the port by its name; a port is written here when something more than the name is known,
 * or when the node has ports no link uses.
 */
export interface Port {
  /**
   * Its name as the device calls it, such as `ge-0/0/1`; unique among the node's ports. A port
   * known only by its hardware address is named by that address.
   */
  readonly name: string
  /** The name it is shown with, when it differs from `name`, such as `Gi1/0/1`. */
  readonly label?: string
  /** The full interface name the operating system reports, such as `GigabitEthernet1/0/1`. */
  readonly interfaceName?: string
  /** Other names it goes by, for matching. */
  readonly aliases?: readonly string[]
  /** What it is for, such as downlink, uplink, wan, lan, management, power or console. */
  readonly role?: string
  /** The marking on the faceplate, such as `1`, when it differs from the name. */
  readonly faceplateLabel?: string
  /** The rate the port is made for, such as 1G or 10G. */
  readonly speed?: string
  /**
   * The receptacles it has, such as rj45, sfp+ or qsfp28; two or more when they share the port
   * and only one is in use at a time (a combo port).
   */
  readonly connectors?: readonly string[]
  /** Whether it can power the device at the other end (PoE). */
  readonly poe?: boolean
  /** Where the port's description came from: the product's catalog entry, or written by hand. */
  readonly source?: 'catalog' | 'custom'
  /** Anything else worth knowing about it, in words. */
  readonly notes?: string
}

/** A device, a virtual machine or a service: one thing links end at. */
export interface Node {
  /** Unique among nodes; links, segments and redundancy sets name the node by it. */
  readonly id: NodeId
  /** The node's name, left out when it is not known; the id is then only a handle. */
  readonly label?: string
  /**
   * What kind of node it is, such as router, l3-switch, firewall, server, virtual-machine
   * or access-point.
   */
  readonly type?: string
  /** What it is, from its maker down to its model, as far as is known. */
  readonly product?: Product
  /**
   * The product in the project's own library that this node is, by that product's id. A
   * different thing from `product`, which names the maker and model.
   */
  readonly productId?: string
  /** For a virtual machine, what runs it, such as ec2, esxi or proxmox. */
  readonly platform?: string
  /** For a managed service, the service's name within its provider, such as lambda or s3. */
  readonly service?: string
  /** For a managed service, the kind of resource within the service, such as function or bucket. */
  readonly resource?: string
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
  /**
   * What it runs on: a node, or a redundancy set when which of its nodes is not known.
   * This is a hosting relationship, not a network link; communication is written in links.
   * A host alone does not identify a VM: services and other workloads can also be hosted.
   * The drawing draws a host as a box holding what runs on it, its own card at the top; a
   * redundancy set named as a host becomes a frame round its nodes and its guests. A node that
   * names a group other than its host's stays in that group.
   */
  readonly host?: NodeId | RedundancyId
  /** The devices it stands for when their links are not told apart, such as stack units. */
  readonly members?: readonly string[]
  /** Its ports, when more than their names is known or the node has ports no link uses. */
  readonly ports?: readonly Port[]
}

/** Separate nodes that stand in for one another, such as a VRRP pair or an HA cluster. */
export interface Redundancy {
  /** Unique among redundancy sets; a node's host or a segment address can name the set by it. */
  readonly id: RedundancyId
  /** Its name, such as the cluster's. */
  readonly label?: string
  /** Two or more. */
  readonly nodes: readonly NodeId[]
  /**
   * How they stand in for one another, such as ha (VRRP, HSRP), vc (a virtual chassis), vss,
   * vpc, mlag or stack.
   */
  readonly kind?: string
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
  /** What is plugged into the port at this end. */
  readonly plug?: Plug
}

/** What is plugged into a port at one end of a link: the cable's plug, and the transceiver in it. */
export interface Plug {
  /**
   * The form the plug presents, such as rj45, sfp+ or qsfp28. Left out when the port's
   * connectors or the module's standard already say it.
   */
  readonly cage?: string
  /** The transceiver in the plug, for a pluggable cage. An RJ45 plug, a DAC or an AOC has none. */
  readonly module?: Module
}

/** A transceiver in a plug. */
export interface Module {
  /** The standard it implements, such as 10GBASE-SR, 1000BASE-T or 100GBASE-LR4. */
  readonly standard: string
  /** Its part number, such as SFP-10G-SR-S. */
  readonly sku?: string
  /** The product in the project's own library that this module is, by that product's id. */
  readonly productId?: string
}

/** A cable, when more than its type is known. Written bare, a cable is its type. */
export interface Cable {
  /**
   * Its type: a grade, such as cat6, om4 or os2, or a medium, such as twisted-pair, mmf, smf,
   * dac or aoc.
   */
  readonly type?: string
  /** The product in the project's own library that this cable is, by that product's id. */
  readonly productId?: string
}

/**
 * A passive point a cable runs through on its way between two nodes: a wall outlet, a riser
 * (EPS) or a patch panel. Links name the terminations they pass in `via`. Where a termination
 * sits on a floor plan is not part of the network.
 */
export interface Termination {
  /** Unique among terminations; links name it by this. */
  readonly id: string
  /** Its name, such as `Outlet 1F-03`. */
  readonly label?: string
  /** What it is: a wall outlet, a riser (eps) or a patch panel. */
  readonly role: 'outlet' | 'eps' | 'panel'
  /**
   * Written on an outlet a routing dialog made for one link's run through one riser, as
   * `<link id>:<riser id>`, so the outlet goes when that run does.
   */
  readonly autoFor?: string
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
  /** Written only when something refers to the link, such as its drawing or its cable run. */
  readonly id?: LinkId
  /** Its two ends, in either order. */
  readonly endpoints: readonly [Endpoint, Endpoint]
  /** The rate the link runs at. */
  readonly speed?: Rate
  /** A lower rate than the link runs at, that traffic over it is held to. */
  readonly bandwidth?: Rate
  /** The cable: its type, such as cat6, om4, smf or dac, written bare; or the cable in full. */
  readonly cable?: string | Cable
  /** The cable's length. */
  readonly length?: Length
  /** The terminations the cable passes, in order from the first end to the second. */
  readonly via?: readonly string[]
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
  /** The passive points its cables run through: outlets, risers, patch panels. */
  readonly terminations?: readonly Termination[]
}

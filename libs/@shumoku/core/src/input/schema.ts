/**
 * The input: the network as it is known now. What is written is known, and anything not written
 * is unknown, not absent: a link without `segments` may still carry some, and a node without
 * links may still be connected somewhere. A written node or link is known to exist unless it is
 * marked assumed. A link that lists its segments carries those and no others. Other lists, such
 * as a segment's addresses, may be partial.
 *
 * The shape is settled in docs/experiments/2026-10-07-input-model-loop (README.md has the reasons,
 * and its fixtures are copied to ./fixtures). Rules that span several items, such as references
 * between ids, are checked in ./parse.ts.
 */
import { z } from 'zod'

const id = <Kind extends string>() => z.string().min(1).brand<Kind>()
export const GroupId = id<'GroupId'>()
export const RoutingDomainId = id<'RoutingDomainId'>()
export const ConnectionId = id<'ConnectionId'>()
export const SegmentId = id<'SegmentId'>()
export const NodeId = id<'NodeId'>()
export const RedundancyId = id<'RedundancyId'>()
export type GroupId = z.infer<typeof GroupId>
export type RoutingDomainId = z.infer<typeof RoutingDomainId>
export type ConnectionId = z.infer<typeof ConnectionId>
export type SegmentId = z.infer<typeof SegmentId>
export type NodeId = z.infer<typeof NodeId>
export type RedundancyId = z.infer<typeof RedundancyId>

const text = z.string().min(1)

/** One value is written bare and several as a list, which is never empty. */
const oneOrMore = <T extends z.ZodType>(item: T) =>
  z.union([item, z.array(item).nonempty().readonly()])

/** Only `true` is written; leaving the field out already means the opposite. */
const flag = z.literal(true)

/** A rate: a number and its unit, such as 100M, 2.5G or 50M. */
export type Rate = `${number}${'M' | 'G' | 'T'}`
export const Rate = z.custom<Rate>(
  (v) => typeof v === 'string' && /^\d+(\.\d+)?[MGT]$/.test(v) && Number.parseFloat(v) > 0,
  { error: 'expected a number and M, G or T, such as 2.5G' },
)

/** A cable's length with its unit, such as 3m. */
export type Length = `${number}${'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft'}`
export const Length = z.custom<Length>(
  (v) => typeof v === 'string' && /^\d+(\.\d+)?\s?(mm|cm|m|km|in|ft)$/.test(v),
  { error: 'expected a number and a unit, such as 3m' },
)

/**
 * A product path from its maker down to as specific as is known, such as `juniper`,
 * `juniper/ex4400` or `juniper/ex4400/ex4400-48p`. An unknown maker is `?`, as in `?/ex4400-48p`.
 */
export const Product = text
  .refine((p) => p.split('/').every((step) => step !== ''), 'empty step in the path')
  .refine((p) => {
    const [maker, ...rest] = p.split('/')
    return !rest.includes('?') && (maker !== '?' || rest.length > 0)
  }, 'only the maker may be ?, and a model must follow it')

/** A place: site, building, room. A group written inside another is a place within it. */
export interface Group {
  readonly id: GroupId
  readonly label?: string
  readonly groups?: readonly Group[]
}
export const Group: z.ZodType<Group> = z
  .strictObject({
    id: GroupId,
    label: text.optional(),
    get groups() {
      return z.array(Group).readonly().optional()
    },
  })
  .readonly()

/**
 * A separate routing domain that segments belong to, such as a VPC, a cloud virtual network or
 * a VRF. Written only when such a domain is known; a network with a single routing table has
 * none, and a subnet, a place or an autonomous system is not one (see a node's asn).
 */
export const RoutingDomain = z
  .strictObject({ id: RoutingDomainId, label: text.optional(), prefix: oneOrMore(text).optional() })
  .readonly()
  // "Routing domain" also names an AS in routing, and writers reach for it to hold one.
  .refine((d) => ![d.id, d.label].some((name) => name && /^as[\s_-]?\d+$/i.test(name)), {
    error: 'an AS is not a routing domain; write its number as asn on its nodes',
  })
export type RoutingDomain = z.infer<typeof RoutingDomain>

/** One logical connection made of several links, such as a VPN made of two tunnels. */
export const Connection = z.strictObject({ id: ConnectionId, label: text.optional() }).readonly()
export type Connection = z.infer<typeof Connection>

/**
 * A shared network that any number of links can carry, such as a VLAN, a handoff segment or a
 * cloud subnet. A node is in a segment when it has an address there, when a link carrying the
 * segment ends at it, or when a link joins it to the segment itself.
 */
export const Segment = z
  .strictObject({
    id: SegmentId,
    label: text.optional(),
    vlan: z.int().min(1).max(4094).optional(),
    prefix: oneOrMore(text).optional(),
    routingDomain: RoutingDomainId.optional(),
    /** The place the segment is confined to, such as an availability zone. */
    group: GroupId.optional(),
    /**
     * The addresses nodes have in the segment, by node. An address belongs to a node's presence in
     * the segment rather than to a port. A redundancy set's shared address is written under the set.
     */
    addresses: z
      .record(z.union([NodeId, RedundancyId]), oneOrMore(text))
      .readonly()
      .optional(),
  })
  .readonly()
export type Segment = z.infer<typeof Segment>

export const Node = z
  .strictObject({
    id: NodeId,
    /** The node's name, left out when it is not known; the id is then only a handle. */
    label: text.optional(),
    type: text.optional(),
    product: Product.optional(),
    /** The software it runs, such as its operating system or hypervisor. */
    software: text.optional(),
    /** An address whose segment is not known; once it is, the address goes in the segment. */
    address: text.optional(),
    /** The autonomous system it is in, such as a router's local AS. */
    asn: z.int().min(1).max(4294967295).optional(),
    description: text.optional(),
    group: GroupId.optional(),
    /** Its existence is not confirmed. Details that are not known are left out instead. */
    assumed: flag.optional(),
    /** What it runs on: a node, or a redundancy set when which of its nodes is not known. */
    host: z.union([NodeId, RedundancyId]).optional(),
    /** The devices it stands for when their links are not told apart, such as stack units. */
    members: z.array(text).min(2).readonly().optional(),
  })
  .readonly()
export type Node = z.infer<typeof Node>

/** Separate nodes that stand in for one another, such as a VRRP pair or an HA cluster. */
export const Redundancy = z
  .strictObject({
    id: RedundancyId,
    label: text.optional(),
    nodes: z.array(NodeId).min(2).readonly(),
    /** The pairing is believed but not confirmed. */
    assumed: flag.optional(),
  })
  .readonly()
export type Redundancy = z.infer<typeof Redundancy>

/**
 * One end of a link: a node (and its port when known), a segment the node is in, or a routing
 * domain the node is attached to as a whole.
 */
export const NodeEnd = z.strictObject({ node: NodeId, port: text.optional() }).readonly()
export const SegmentEnd = z.strictObject({ segment: SegmentId }).readonly()
export const RoutingDomainEnd = z.strictObject({ routingDomain: RoutingDomainId }).readonly()
export const Endpoint = z.union([NodeEnd, SegmentEnd, RoutingDomainEnd])
export type NodeEnd = z.infer<typeof NodeEnd>
export type Endpoint = z.infer<typeof Endpoint>

/**
 * Undirected: the two ends have no order. Two nodes may have several links, such as parallel
 * cables or the two tunnels of one VPN.
 */
export const Link = z
  .strictObject({
    endpoints: z.tuple([Endpoint, Endpoint]).readonly(),
    /** The rate the link runs at. */
    speed: Rate.optional(),
    /** A lower rate than the link runs at, that traffic over it is held to. */
    bandwidth: Rate.optional(),
    /** The cable's type, such as cat6, mmf-om4, smf or dac. */
    cable: text.optional(),
    length: Length.optional(),
    /** The segments the link carries. Both ends are in each of them. */
    segments: z.array(SegmentId).readonly().optional(),
    description: text.optional(),
    /** The connection this link is one part of. */
    connection: ConnectionId.optional(),
    /** Its existence is not confirmed. Unknown ports or segments are left out instead. */
    assumed: flag.optional(),
    /**
     * It has no cable of its own, such as a VPN tunnel, a VM's adapter in a port group, or a BGP
     * session across a shared LAN. A link whose way is not known is neither virtual nor cabled.
     */
    virtual: flag.optional(),
  })
  .readonly()
export type Link = z.infer<typeof Link>

export const Network = z
  .strictObject({
    name: text.optional(),
    description: text.optional(),
    groups: z.array(Group).readonly().optional(),
    routingDomains: z.array(RoutingDomain).readonly().optional(),
    connections: z.array(Connection).readonly().optional(),
    segments: z.array(Segment).readonly().optional(),
    redundancy: z.array(Redundancy).readonly().optional(),
    nodes: z.array(Node).readonly(),
    links: z.array(Link).readonly(),
  })
  .readonly()
export type Network = z.infer<typeof Network>

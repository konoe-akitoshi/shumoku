-- The structure of model.ts, without ports, labels or facts that cannot clash.
-- `run` asks whether a state of knowledge can be written at all; a missing instance means
-- the rules forbid something real. `check` asks whether something unwanted can be written;
-- a counterexample is a question for the model, not automatically a bug.

sig Addr {}

-- Written one inside another, so `parent` is a tree by construction; the fact below restates it.
sig Group { parent: lone Group }

-- A separate routing domain such as a VPC or a VRF; segments and nodes belong to it.
sig RoutingDomain {}

sig Node {
  group: lone Group,
  -- An address whose segment is not known.
  address: lone Addr,
  -- What it runs on: a node, or a redundancy set when which of its nodes is not known.
  host: lone (Node + Redundancy),
}

-- Separate nodes that stand in for one another; a shared virtual address is keyed by the set.
sig Redundancy { nodes: some Node }

-- `present` holds whoever is known to be in the segment, with or without a known address.
sig Segment {
  present: set (Node + Redundancy),
  addresses: (Node + Redundancy) -> Addr,
  -- The place the segment is confined to, such as an availability zone.
  group: lone Group,
  domain: lone RoutingDomain,
}

-- `b` may be a segment or a routing domain: the node at `a` is attached to it.
sig Link {
  a: one Node,
  b: one (Node + Segment + RoutingDomain),
  carries: set Segment,
}

fact parser {
  no g: Group | g in g.^parent
  all n: Node, s: Segment | some n.address implies n.address not in s.addresses[n]
  all l: Link | l.a != l.b
  all r: Redundancy | #r.nodes > 1
  all s: Segment | s.addresses.Addr in s.present
  all l: Link | l.b in Segment implies l.a in l.b.present
  -- Following hosts (a set stands for its nodes) never comes back to where it started.
  no n: Node | n in n.^(host.(iden + ~nodes))
}

fun runsOn: Node -> Node { host.(iden + ~nodes) & Node -> Node }

-- States of knowledge the loop has met (fixtures/pass).

run addressNetworkUnknown {
  some n: Node | some n.address and no Segment.addresses[n]
} for 3

run addressWithoutLink {
  some s: Segment, n: Node | some s.addresses[n] and no l: Link | s in l.carries and n in l.a + l.b
} for 3

run trunkAddressPerVlan {
  some l: Link, disj s1, s2: l.carries | some s1.addresses[l.b] and some s2.addresses[l.b]
} for 3

run twoAddressesOneSegment {
  some s: Segment, n: Node | #s.addresses[n] > 1
} for 3

run redundancyVirtualAddressNoInterconnect {
  some r: Redundancy, s: Segment | some s.addresses[r] and no l: Link | l.a + l.b in r.nodes
} for 3

run vmOnKnownHost {
  some vm: Node, s: Segment | vm.host in Node and some s.addresses[vm]
    and no l: Link | vm in l.a + l.b
} for 3

run vmOnClusterHostUnknown {
  some vm: Node | vm.host in Redundancy
} for 3

run segmentMemberAddressUnknown {
  some s: Segment, n: Node | n in s.present and no s.addresses[n]
} for 3

run nestedVm {
  some n: Node | some n.host.host
} for 3

-- A VPC's subnets in two zones, and a gateway attached to the VPC without a subnet.
run vpcAcrossZones {
  some v: RoutingDomain, disj s1, s2: Segment, g: Node | s1.domain = v and s2.domain = v
    and some s1.group and some s2.group and s1.group != s2.group
    and (some l: Link | l.a = g and l.b = v) and no s: Segment | g in s.present
} for 3

-- A router in a VRF and in the main table: present in segments of two domains, or of one and none.
run routerInVrf {
  some r: Node, disj s1, s2: Segment | r in s1.present & s2.present and s1.domain != s2.domain
} for 3

-- A gateway attached through a subnet, with no address and no node on the far side.
run attachedThroughSubnet {
  some l: Link | l.b in Segment and no l.b.addresses[l.a]
} for 3

-- Decided: a node may sit in several sets (B1 over B2, no data for a limit), and links need
-- two different nodes (parser rejects; the check holds).

check nodeInOneRedundancy {
  all n: Node | lone nodes.n
} for 3

check noRunsOnSelf {
  no n: Node | n in n.^runsOn
} for 4

check noSelfLink {
  no l: Link | l.a = l.b
} for 3

-- Shapes the loop has not decided on yet.

check addressUniqueInSegment {
  all s: Segment, disj m, n: Node | no s.addresses[m] & s.addresses[n]
} for 3

check addressUniqueOverall {
  all disj m, n: Node | no (m.address + Segment.addresses[m]) & (n.address + Segment.addresses[n])
} for 3

-- A VRRP address owner uses its own address as the virtual one, so this is allowed on purpose.
check virtualAddressNotAlsoAMember {
  all s: Segment, r: Redundancy | no s.addresses[r] & s.addresses[r.nodes]
} for 3

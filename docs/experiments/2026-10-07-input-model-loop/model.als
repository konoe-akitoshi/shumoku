-- The structure of model.ts, without ports, labels or facts that cannot clash.
-- `run` asks whether a state of knowledge can be written at all; a missing instance means
-- the rules forbid something real. `check` asks whether something unwanted can be written;
-- a counterexample is a question for the model, not automatically a bug.

sig Addr {}

sig Group { parent: lone Group }

sig Node {
  group: lone Group,
  -- An address whose segment is not known.
  address: lone Addr,
}

sig Segment { addresses: Node -> Addr }

sig Link {
  a, b: one Node,
  carries: set Segment,
}

fact parser {
  no g: Group | g in g.^parent
  all n: Node, s: Segment | some n.address implies n.address not in s.addresses[n]
}

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

-- Shapes the loop has not decided on yet.

check noSelfLink {
  no l: Link | l.a = l.b
} for 3

check addressUniqueInSegment {
  all s: Segment, disj m, n: Node | no s.addresses[m] & s.addresses[n]
} for 3

check addressUniqueOverall {
  all disj m, n: Node | no (m.address + Segment.addresses[m]) & (n.address + Segment.addresses[n])
} for 3

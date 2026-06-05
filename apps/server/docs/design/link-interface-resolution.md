# Link → interface resolution

How a topology **link** binds to the **interface counter** a metrics source
exposes, so the weathermap can colour the link by utilization.

This is the link-level analogue of node→host identity matching
(`matchNodeToHost`). It exists because mapping by interface *name* alone is
brittle: every system names the same physical port differently (TTDB speed
codes `hg-1/0/49`, Cisco `GigabitEthernet1/0/49`, Juniper `et-0/0/0`, AlaxalA
`port1.26`, Zabbix SNMP truncations `HundredGigabitEther 1/0/49`). Chasing that
with a synonym table is endless.

## The problem decomposes into two joins

A topology link is `A:portX ↔ B:portY`. With nodes already mapped to hosts
(`A → hostA`, `B → hostB`, by identity — see `topology-foundation-identity.md`):

1. **Node join** — topology node → metrics host. Solved by identity
   (mgmtIp / chassisId / sysName).
2. **Port join** — topology port → metrics interface, *on that device*. This doc.

The port join is the hard part: it is a correspondence between two naming /
identity systems for the **same device's** interfaces.

## Key insight: a link already knows its peer

The current fuzzy matcher scores `portX`'s *name* against hostA's interface
names in isolation — and throws away the fact that we know the link goes to **B**.
The peer is the strongest disambiguator we have. Two mechanisms exploit it:

- **LLDP neighbour table** — the device itself reports, per local interface, the
  neighbour it sees (`lldp.rem.sysname[<localIf>]`, `lldp.rem.port.id[...]`).
  For link `A↔B` we look up the local interface on A whose neighbour is B. No
  port-name matching at all.
- **Port identity** — if the topology port carries `ifName` / `ifIndex` / `mac`,
  it joins to the metrics interface deterministically (both sides speak SNMP).

## Tiered resolution algorithm

For a link `A:portX ↔ B:portY`, try each endpoint (A first, then B); within an
endpoint, take the highest tier that resolves:

```
T0  Port identity      portX.identity.ifIndex|ifName|mac == an interface on hostA  (exact)
T1  LLDP + remote port hostA LLDP: neighbour ≈ B AND remotePortId ≈ portY → localIf
T2  LLDP single        exactly one hostA interface faces B → that one
T3  Name fuzzy         normalizeInterfaceName(portX) vs hostA interface names,
                       with the cross-vocabulary number fallback (last resort)
```

- **T1 before T2** so parallel links / LAGs (A and B joined by N cables) are
  disambiguated by the *remote* port, not left ambiguous.
- **T3** is the current `findBestInterfaceMatch` (speed-prefix synonyms +
  unique-number fallback). It stays as the floor for sources with no identity
  and no LLDP.
- Resolution yields `(host, ifName)`; persist that, plus the **orientation**
  (see Failure modes B1).

### Why this generalises across metrics sources

| Source | Port identity | LLDP | Counter |
| --- | --- | --- | --- |
| Zabbix (SNMP) | ifName (key bracket), ifIndex | `lldp.rem.*[localIf]` | bps **or raw octets** (template-dependent) |
| Prometheus (snmp_exporter) | `ifName` / `ifIndex` / `ifDescr` labels | lldp module | raw counter → `rate()` |
| Aruba Instant On | port number only | usually none | API value |
| NetBox (topology source) | explicit interface-level **cables** | — | n/a |

The unifying move: **stamp port identity (ifName/ifIndex/mac) onto the topology
link's endpoints at discovery time**, the way nodes carry `Identity`. Core
already has `NodePort.identity` and `portIdentityKeys`. Then T0 resolves on every
metrics source by the same key and fuzzy name matching becomes a degenerate
fallback. NetBox cables and SNMP/LLDP discovery already know connectivity at the
interface level; TTDB is the outlier that emits abstract port names only.

## Evidence (ShowNet, live Zabbix)

`mx301.noc` (Juniper) — 4 topology links, all resolved by T1 with **zero** name
matching, despite the TTDB ↔ Juniper vocabulary gap:

```
fhg-0-0-22  peer cisco8711-32fh.noc   → et-0/0/22   (LLDP neighbour)
hg-0-0-1    peer thunder7465-1.noc    → et-0/0/1
fhg-0-0-12  peer ptx10002-36qdd.noc   → et-0/0/12
xg-0-0-14   peer thunder7465-2.noc    → xe-0/0/14
```

LLDP also reports the remote port (`Ethernet 25`, `FourHundredGigE0/0/0/12`),
which feeds T1's parallel-link disambiguation. The same device's `ifAlias`
independently encodes the peer (`hg-25.thunder7465-1.noc`) — a secondary signal
where LLDP is absent. Fuzzy T3 alone resolved 37/140 links on this topology
(see `feat(mapping): SNMP interface keys …`, PR #351); T1 is expected to lift
the LLDP-covered subset to near-complete.

## Failure modes / contract (must address before relying on link metrics)

| # | Issue | Severity | Mitigation |
| --- | --- | --- | --- |
| B1 | **Direction polarity** — picking A's interface vs B's flips in/out; the weathermap arrow can point the wrong way | High | Orient by `link.from`; store the chosen side + an inversion flag, or always emit in/out relative to link direction |
| B2 | **Counter vs rate** — `ifHCInOctets` is sometimes a raw octet counter, not bps; reading `lastvalue` as bps then explodes utilization. (Verified bps on this Zabbix, but template/Prometheus-dependent) | High | Inspect units; accept only rate items, else convert counter→rate. Metrics contract: **links return directional bps** |
| B3 | **Sub-interfaces / logical units** (`et-0/0/0.211`, `bme0.0`) inflate the candidate set, defeating the unique-number fallback and risking a logical-IF match | Medium | Prefer physical interfaces; drop `.`/`:` logical units or fold by base port |
| B4 | **LAG / parallel links** — logical (`ae`/`Po`) vs member double-counting; T2 ambiguity | Medium | Use T1 remote-port; prefer the logical aggregate when the link is the aggregate |
| B5 | **ifIndex instability** across reboots (see identity doc) | Medium | ifIndex for same-scan joins; ifName for cross-time / cross-rescan |
| B6 | **LLDP remote id formats** — chassisId as MAC vs string, sysName FQDN vs short | Low | Reuse node identity matching to normalise the remote id |
| B7 | **No LLDP on the peer** (servers/appliances) | Low | Fall through to T3 |

## Status / next

- T3 (fuzzy + speed-prefix + number fallback) — **shipped** (PR #351).
- T1 (LLDP) — **validated** on live data (above); not yet implemented. Highest
  value next step; the Zabbix plugin already parses LLDP for topology
  (`zabbix-lldp-topology.md`), so the neighbour table is in reach.
- T0 (port identity) — needs sources to stamp `NodePort.identity`; blocked on
  TTDB (and any abstract-port source) emitting ifName/ifIndex.
- Before wiring link metrics broadly, fix the **polarity (B1)** and
  **counter/rate (B2)** contract.

---
---

fix(plugin-huawei-nce-campus): give unmanaged LLDP peers an identity they can merge on

Link Management (`/rest/openapi/network/link`) is the preferred link source, but it
carries no MAC field at all, pins `zneip` to `0.0.0.0`, and reports the switch *model* as
the peer name — so every unmanaged peer built from it looked identical. On a live tenant
that produced sixteen distinct switches all identified as `IS230-10TP-AC(V1)`, none of
which could merge with the same switch seen by a wired source, and any match on that name
would have collapsed all sixteen into one entity.

The per-device LLDP tables do carry each peer's chassis MAC, and on the live tenant that
MAC is exactly the address the switch answers ARP with. They are now always fetched
rather than only when Link Management comes back empty — links from one call, identities
from the other — and the peer's chassis MAC is merged onto the Link Management peer.

Managed devices had the mirror-image problem: their `mgmtIp` came from the device list's
`ip`, which is the address the *controller* sees the device from — behind NAT, one shared
public address for the whole site (38 of the tenant's 39 APs reported `103.26.27.187`).
Link Management's per-endpoint `aneip`/`zneip` is the device's own management address and
is unique, so it now wins when present.

Finally, a `sysName` or `mgmtIp` value claimed by two or more nodes is dropped from
identity — a colliding key is worse than a missing one, since it tells the resolver to
merge devices that are not the same. The value survives as the node's label. A node whose
only key collides keeps it, which would otherwise leave it failing the identity contract.

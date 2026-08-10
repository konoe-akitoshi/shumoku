---
---

feat(plugin-network-scan): harvest MACs so a credential-free sweep produces mergeable devices

The reachability pass could already find hosts without any SNMP credential, but the nodes
it produced carried an address and nothing else. An address is a weak key — it moves with
DHCP, and it is usually not what another source knows the device by. A wireless
controller reports the switches its APs uplink into as an LLDP chassis MAC with no
address at all, so those two descriptions of one switch could never meet.

The probes already force ARP resolution for every on-link address, so the kernel's
neighbour cache holds the missing half of the mapping by the time the sweep finishes.
Reading it back needs no privileges (sending ARP ourselves would need a raw socket) and
gives each reachable host its MAC. Measured against a live segment, this turned five
switches that a Huawei NCE tenant knew only by chassis MAC into nodes carrying both that
MAC and a management address.

Hosts whose MAC is locally administered — phones and laptops randomising per network —
are dropped by default, since they are not part of the topology and churn on every scan;
`includeClients` keeps them, and however many were dropped is always reported in the
snapshot warnings rather than applied silently.

The limit is inherent: ARP is link-local, so hosts reached through a router stay
MAC-less. That argues for a collector per segment, not for a workaround.

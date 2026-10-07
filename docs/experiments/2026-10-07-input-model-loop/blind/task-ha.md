A data center.

- Two routers, rt-1 and rt-2 (Juniper MX204), back each other up with VRRP on VLAN 100
  (10.0.0.0/24). They share the virtual address 10.0.0.1. rt-1's own address on VLAN 100 is
  10.0.0.2 and rt-2's is 10.0.0.3.
- rt-1 and rt-2 are also cabled directly to each other, et-0/0/1 to et-0/0/1, for keepalive.
- rt-1 connects to port 1 of a switch, sw-1, and rt-2 to port 2 of sw-1. Both cables carry VLAN 100.
- Two firewalls, fw-a and fw-b, are described by the operator as an active/standby HA pair, but
  nobody has confirmed that they are actually paired. fw-a connects to port 3 of sw-1. Nobody
  knows how fw-b is connected.
- A core switch, known as "core", is a stack of two units, core-1 and core-2. It connects to
  port 4 of sw-1, but nobody knows which unit that cable lands on.

A small branch, and how its diagram should look.

The network:
- onu (an ONU) connects by a 2m fiber to rt-1 (a router) port lan2.
- rt-1 port lan3 connects to sw-1 (a switch) port xe-0/2/3 at 10G; the cable carries VLAN 10
  (office) and VLAN 20 (voice).
- sw-1 port ge-0/0/1 connects to srv-1 (a server) at 1G on VLAN 10.
- rt-1 has an IPsec tunnel to hq-rt at headquarters.
- rt-1, sw-1 and srv-1 take power from pdu-1 (outlets 1, 2 and 3).

How the diagram should look (the person drawing it asked for this):
- Every power cable gray.
- Every link that carries VLAN 10 blue.
- The ONU-to-router cable magenta, because the person likes it that way.
- The tunnel drawn dashed.
- rt-1 drawn with the icon https://example.com/rt.svg.

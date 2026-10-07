A company has a head office and a branch.

Head office, server room:
- Two firewalls, fw-1 and fw-2 (Palo Alto PA-3220), run as an HA pair. They share 192.168.1.1 on
  VLAN 10 (staff, 192.168.1.0/24); fw-1 itself is 192.168.1.2 and fw-2 is 192.168.1.3.
- A core switch, core, is a stack of two units, sw-a and sw-b. Its management address is 10.99.0.2,
  but nobody has written down which network that address is on.
- fw-1's port ethernet1/1 connects to core at 10G. The cable carries VLAN 10 and VLAN 20 (voice).
  fw-2 connects to core too, but nobody knows the ports or which VLANs that cable carries.
- A virtualization host, esx-1, connects to core at 25G on VLAN 10. A VM, web-1, runs on esx-1 and is
  attached to its virtual switch vSwitch0 on VLAN 10, with address 192.168.1.20.

Branch, 2nd floor:
- A router, br-rt, connects to the head office firewalls over an IPsec tunnel (tun0 on both sides,
  to fw-1).
- An access point is believed to be on the 2nd floor, but nobody has confirmed it exists.

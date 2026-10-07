A small branch office.

- A router (Yamaha RTX1300) connects its lan1 port to port 1 of a switch, sw-1, at 1G. That cable
  carries VLAN 10 (staff, 192.168.10.0/24) and VLAN 20 (guest, 192.168.20.0/24). The router is
  192.168.10.1 on VLAN 10 and 192.168.20.1 on VLAN 20.
- sw-1 can be reached at 192.168.10.2.
- A second switch, sw-2, is connected to port 2 of sw-1. Nobody has checked which VLANs that cable
  carries.
- A printer is connected to sw-2. Its address is 192.168.10.50.
- There is also a NAS at 10.0.0.5. Nobody knows which network it is on or what it is connected to.
- The router's wan port connects to the ISP.

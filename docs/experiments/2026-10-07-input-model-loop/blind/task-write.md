An office building has a server room and a 2nd floor.

In the server room there is a firewall (Fortinet FortiGate-60F) and a core switch (Cisco C9300).
The core switch is really a stack of two units, core-1 and core-2, but nobody can tell which cable
goes to which unit.

On the 2nd floor there are two access switches, sw-2a and sw-2b, and a Wi-Fi access point.

- The firewall's port1 connects to the core switch's Gi1/0/1 at 10G. That cable is a trunk carrying
  VLAN 10 (users, 10.10.0.0/24) and VLAN 99 (management, 10.99.0.0/24). The firewall has
  10.10.0.1/24 on VLAN 10 and 10.99.0.1/24 on VLAN 99.
- The core switch's Gi1/0/2 connects to sw-2a's Gi0/1 at 1G, carrying VLAN 10 and VLAN 99.
- sw-2b is connected to the core switch, but nobody knows which ports, and the connection has not
  been confirmed.
- The access point is connected to sw-2a's Gi0/5 and is on VLAN 10 only.
- Management addresses: sw-2a is 10.99.0.3 and sw-2b is 10.99.0.4.
- The firewall's wan port probably connects to an ONU from the ISP, but nobody has confirmed that
  the ONU exists.

A rack in a server room.

- rt-1 (a router) connects from its port lan3 to sw-1 (a switch) port xe-0/2/3 with a 3 m
  10GBASE-SR multimode fiber (OM4) cable at 10G.
- sw-1 port ge-0/0/1 connects to srv-1 (a server) port eth0 with a 2 m Cat6 copper cable at 1G.
- sw-1 port xe-0/1/0 connects to sw-2 port xe-0/1/0 with a 1 m 10G direct-attach copper cable
  (DAC).
- rt-1, sw-1 and srv-1 each take power from the PDU pdu-1: rt-1's power inlet goes to pdu-1
  outlet 4, sw-1's to outlet 5, srv-1's to outlet 6.

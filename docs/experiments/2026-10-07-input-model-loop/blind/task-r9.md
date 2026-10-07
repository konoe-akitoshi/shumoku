A company runs virtual machines in its server room.

- A core switch, core, connects at 25G to each of three virtualization hosts, esx-1, esx-2 and esx-3
  (VMware ESXi). Each of those cables carries VLAN 10 (staff, 192.168.1.0/24) and VLAN 30 (database,
  192.168.3.0/24) and nothing else. The ports are not known.
- esx-1, esx-2 and esx-3 form a vSphere HA cluster named prod: when a host fails, its VMs restart on
  another host of the cluster.
- A VM, web-1, runs on esx-1. Its network adapter is in the port group for VLAN 10, with address
  192.168.1.20.
- A VM, db-1, runs in the prod cluster, but nobody knows on which host at the moment. Its network
  adapter is in the port group for VLAN 30. Its address has not been written down.
- A VM, mon-1, is known only from the monitoring system: its address is 10.99.0.50. Nobody knows
  which host or cluster it runs on, or which network that address belongs to.

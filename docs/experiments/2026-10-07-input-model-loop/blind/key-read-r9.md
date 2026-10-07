Expected answers for read-r9.yaml with types-r9-c.ts (written before the runs).
1. Which host does web-1 run on? esx-1.
2. Which host does db-1 run on? One of esx-1, esx-2, esx-3; which one is not known.
3. Is db-1 on VLAN 30, and what is its address there? Yes; the address is not known.
4. Which host does mon-1 run on? Not known (nothing says it runs on any host, nor that it doesn't).
5. Is mon-1's address 10.99.0.50 on the staff network (VLAN 10)? Not known (its network is not known).
6. Does the cable from core to esx-2 carry VLAN 20? No (the list is complete).
7. Is there a cable between web-1 and esx-1? No: web-1 runs on esx-1; its adapter is in VLAN 10, not cabled.

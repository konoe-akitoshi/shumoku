Variants A and B (written before the runs).
A: no field for "runs on". Honest: web-1 virtual link to esx-1 carrying [staff] with its address in
   staff; db-1 cannot be tied to any host without inventing one -> expect loss (no link) or
   invention (link to esx-1/2/3). Cluster prod: redundancy set [esx-1, esx-2, esx-3] fits the doc
   ("HA cluster"). db-1's VLAN 30 membership without address has no honest place except a link -> loss.
B: host: esx-1 / host: prod. web-1 attachment: address in staff (with or without a virtual link).
   db-1 VLAN 30 membership: a link needs a host endpoint, and the host is not known -> loss or
   invention, unless a writer puts db-1 under staff/database addresses with something made up.
Checks h1-h6 as in key-r9-c.yaml.

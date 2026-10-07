Key for round 10 test 6 (written before the runs). Task task-r10-2.md. H0 = model as adopted;
H1 rewords Node.host as "the machine this one runs on" and says a VPC is not a host.
Expected: host only on fw-v (hv-1) and app-1 (prod). Counts: host on cloud nodes (web-c, db-c,
igw-1 -> main); plus regressions elsewhere (igw link, VPC prefix, tunnels, inventions).

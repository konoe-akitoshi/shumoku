Tallies use the YAML where prose contradicts it; counts are writers unless stated otherwise.

(a) Address holders: JPIX—mx204 3, switch 1, as290 2; DIX-IE—mx204 2, switch 2, as290 2; JPNAP—ncs57c3 3, wrong mx204 1, as290 2; BBIX—cisco8712 3, wrong mx204 1, as290 2. All four correct by path: **1/6 (W9)**, explicitly inferred; none omitted.
(b) Dual stack: **prefix list 6/6; two segments 0; other 0**. W5 nevertheless duplicates the JPIX address key.
(c) Segment carriage to border: **yes 1/6 (W9, JPIX/DIX-IE/BBIX); no 5/6**. W3/W5 annotate only downstream links.
(d) JPNAP reach: **plain 1 (W5); virtual 1 (W2); invented path 3 (W1/W3/W4); omitted 1 (W9)**. W4 also adds plain/virtual direct segment attachments; W9’s virtual route-server session supplies no access path.
(e) AS routing domains: **AS290 4/6 (W1–W4); none 2/6; other ASes 0**. W3 claims omission but includes it.
(f) Inventions: optical paths W1/W3/W4; extra gateway→IX links W1; unsupported JPIX route server W1/W3/W4; aggregate peer devices W1/W3/W4, with false ASN290 W4; wrong address ownership W2/W3/W5; BBIX→JPNAP route-server link W1. No invented provider ASNs or cable specifications.

Reported-confusion clusters, counting each writer once per cluster; overlap allowed:

- Unknown optical path / intermediary reach / segment carriage: **6/6**.
- Unnamed peer counts: **6/6**.
- IX/provider as node versus segment, AS versus routing domain: **5/6** (W1–W5).
- Transit/peering roles and route-server/session representation: **4/6** (W1/W2/W4/W5).
- AS-address ownership versus required node owner: **3/6** (W1/W2/W9).
- Endpoint tuple limitation: **1/6** (W5).

Prediction: dual-stack improvement achieved; ownership and carriage improved only in W9; plain JPNAP reach only in W5. Parse-success prediction remains unverified.
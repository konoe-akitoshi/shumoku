1. A 10GBASE-SR multimode fiber (OM4) cable, 3 m long.
2. The links from rt-1 to pdu-1, sw-1 to pdu-1, and srv-1 to pdu-1 are described as power connections.
3. Cannot tell. The links are undirected, and the format does not say whether a power connection carries network traffic.
4. A 10G direct-attach copper (DAC) cable, 1 m long.

Confusing or underspecified:
- The format permits omitted details to be unknown, so missing `segments` does not establish that links carry no segments.
- It does not define how to distinguish power links from data links beyond descriptions; `Link` has no connection-kind field.
- It does not specify whether links described as power connections can also carry network traffic.
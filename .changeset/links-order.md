---
'@shumoku/core': patch
---

The drawing no longer depends on the order the `links` are written in. Before, the links were numbered by where they stood in the file, and that number broke ties in the layout: listing the same links in another order could move most of the boxes of a larger network (26 of 30 in a generated test network). The links are now numbered by what they say, so the same network gives the same drawing however its links are listed. This matters most where the links come from a data source whose order is not fixed.

Networks whose layout had a tie decided by the link order are drawn once differently. Among the examples this is `full-featured.yaml`; the crossings and other checked rules come out the same.

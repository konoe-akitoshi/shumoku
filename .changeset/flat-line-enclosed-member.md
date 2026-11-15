---
'@shumoku/core': patch
---

Draw networks that stopped the layout with "no way through the corridors". A line between two items on the same row that ends at a member of a redundancy set standing between two other members (the middle host of a three-node cluster, cabled to a switch level with the cluster) left by the member's left or right side, where the corridors give no door, so no way was found and the whole drawing failed. Such a line now leaves by the bottom and runs under the row, as one from a sealed group already does.

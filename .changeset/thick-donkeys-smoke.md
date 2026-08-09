---
'@shumoku/core': patch
---

Stop treating link bandwidth as a hierarchy signal when every link runs at the
same speed. On a uniform fabric — a campus access layer where each AP has an
identical 1G uplink — the "most peripheral end of the fattest trunk" rule
selected every node and then resolved to a leaf, seeding the rank root at an
access point and rendering switches below or beside the APs they serve. The
rule now requires the fat-trunk set to actually be a subset of the candidates;
otherwise the device-tier rule decides, which already refuses to root at a leaf.

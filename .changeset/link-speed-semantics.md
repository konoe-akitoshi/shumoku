---
'@shumoku/core': patch
'shumoku-plugin-netbox': patch
'shumoku-plugin-huawei-nce-campus': patch
'shumoku-plugin-arista-cv-cue': patch
---

Rename `Link.rateBps` to `speedBps`, and give the nominal-speed claim an authoring form.

`rateBps` was documented as "instantaneous link rate set by metrics providers" — which nothing ever did. Every real producer (NetBox interface speed, NCE link tables, CV-CUE uplinks) wrote the *nominal* speed into it, and every consumer (layout width, trunk detection, mock capacity) read it as nominal speed. The YAML schema, faithfully following the fictional docs, excluded it as "a measurement" — so the one field carrying real inventory data could not survive a YAML round trip, and losing it broke layout hierarchy on import.

The rename makes the name, the docs and the reality agree: `speedBps` is the nominal capacity claim, outranked by a declared Ethernet `standard`, and now authorable in YAML as `speed: 10G` / `2.5G` / `100M` (or raw bits/sec) — for exactly the case where a trunk's rate is known but its physical medium is unproven. A malformed speed is a parse error, not a silent drop. No compatibility shim: `rateBps` is gone from the model.

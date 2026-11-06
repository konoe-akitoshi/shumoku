---
'@shumoku/core': patch
'@shumoku/renderer': patch
'@shumoku/cli': patch
---

Draw hosting as containment: a host is drawn as one box holding the VMs on it (its own card as the heading, the VMs in a grid below), and a cluster named as a host as a frame round its nodes and those VMs, as vSphere, Proxmox and cloud diagrams do. The host is still the node: its ports sit on the box's edge.

---
'@shumoku/core': patch
'shumoku-plugin-netbox': patch
---

NetBox topologies now render as a proper top-down dependency hierarchy.

- **netbox**: stamp `metadata.location` (site/location slug) on device nodes. The
  composite layout keys its zones off `metadata.location`, so NetBox topologies
  previously never qualified and fell back to the flat-tree engine even though
  NetBox knows each device's site/location. Matches the Zabbix plugin.
- **core (composite layout, role-driven / typed graphs only)**: place nodes and
  subgraphs by their wiring (link) dependency.
  - Apex = the most peripheral boundary device (WAN edge router), chosen by BFS
    eccentricity instead of the device-type tier table (which ranked firewall
    above router and inverted the hierarchy). NetBox cables are undirected, so
    the root is the only orientation input.
  - Grow the tree from the root with each parent centred over its subtree
    (tidy-tree), so the apex sits centre-top instead of being left-anchored.
  - Spread tiers horizontally (drop the square-aspect row/band wraps) so the
    hierarchy reads wide instead of being squeezed into a tall column.
  - Band sibling zones by their real BFS depth (not the sink-bumped depth), so
    buildings at the same tier sit side by side instead of one being stranded a
    band higher.

  Untyped (discovered/TTDB) graphs are unchanged — every new path is gated behind
  a "typed inventory" check.

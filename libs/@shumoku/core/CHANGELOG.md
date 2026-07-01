# @shumoku/core

## 0.3.0

### Minor Changes

- 38b4086: Add a first-class `secret` flag to plugin config schemas.

  `PluginConfigProperty` gains `secret?: boolean`, and `@shumoku/core/plugin-kit`
  exports `isSecretProp`. Secret-ness is declared once on the schema
  (`secret: true`; `format: 'password'` is still honoured for back-compat), so the
  host can render token/password fields masked with a show/hide reveal toggle and
  suppress password-manager autofill from a single definition — no per-plugin
  branches, no hard-coded field-name lists.

  Bundled plugins mark their token/password/webhook-secret fields with
  `secret: true`.

### Patch Changes

- b19c2ec: Add a layout problem IR, semantic diagnostics for role-driven layout invariants, and routing intents that gate peer ramps, gutters, and bus grammars.
- 3764162: NetBox topologies now render as a proper top-down dependency hierarchy.

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

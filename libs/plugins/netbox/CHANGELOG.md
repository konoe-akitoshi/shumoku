# shumoku-plugin-netbox

## 0.2.26

### Patch Changes

- 93cf51c: **netbox**: style circuit links from the real leg cable instead of a hardcoded
  `smf`. The circuit-termination API embeds only an abbreviated cable reference
  (no `type`), so the builder now joins it by id against the already-fetched
  cable list; when the type genuinely can't be resolved the link is left
  unstyled rather than pretending the fiber type is known.
- ba3d39e: **netbox**: import circuits (provider-supplied transport) that the plain
  cable-walker dropped. A device interface cabled to a circuit-termination rather
  than to another device was skipped entirely, so dark fibers between sites and
  uplinks to providers were invisible.

  - Fetch `/api/circuits/circuits/` + `/api/circuits/circuit-terminations/` and
    join each circuit back to the device interface it lands on.
  - A circuit whose both ends land on owned devices becomes a device↔device link
    (the provider/CID is the label, the port speed the rate).
  - A circuit with only one owned end synthesizes a single provider boundary node
    (`DeviceType.Internet`) per provider and links the device to it.
  - Non-active circuits (e.g. `planned`) render dashed.
  - Circuits are optional: instances without the circuits app, or a token without
    access, degrade to the device/cable graph without failing the sync.

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

- bc172fb: **netbox**: derive link bandwidth from the interface _type_ when the operating
  `speed` field is unset. NetBox's `speed` officially records the operating
  speed and is rarely populated; the nominal capacity lives in `type`, a
  required, NetBox-maintained enum whose Ethernet entries follow IEEE 802.3
  naming (`100gbase-x-qsfp28` = 100 Gb/s). Explicit `speed` still wins; a link
  runs at the lower of its two ends; entries with no fixed rate (virtual / lag /
  wireless / SONET…) stay unrated. This lights up bandwidth-proportional link
  widths and utilization denominators across the whole topology instead of only
  on circuit links.
- 30a6763: **netbox**: synthesized provider boundary nodes now expose one handoff port per
  circuit landing on them, and circuit links reference that port. Previously the
  provider side of an uplink was a portless endpoint (`port: ''`), so two uplinks
  to the same provider converged on the bare node — violating the LinkEndpoint
  contract ("must reference an existing port") and the 1-port-=-1-link invariant.
  Port id = the circuit's `cid` (stable across rescans; `ifName` defaults to it
  on ingest, satisfying the identity contract).
- dcf0925: **netbox**: place synthesized provider boundary nodes in an "Upstream" region so
  they survive scoped resolution. A parentless node is dropped under the deployed
  default `scope_mode: auto` (which closes the world to the topology source's
  regions and drops any node outside one), so upstream provider nodes and their
  uplink links vanished on a real deployment even though they rendered fine under
  `open` scope. The provider node now parents into a source-emitted `upstream`
  subgraph, making it a member of a closed region — and grouping upstream
  providers together, matching how a physical diagram draws them.
- a8457bf: Populate `Host.identity` in `getHosts()` so node auto-mapping can bind a
  topology node to a monitored host by a stable key (mgmtIp > chassisId >
  sysName > vendorId) instead of only fuzzy name matching. Previously only the
  zabbix plugin filled host identity (the original PoC was Zabbix-only), so
  mapping e.g. a NetBox topology onto Prometheus/SNMP hosts matched nothing —
  the hosts were named by IP/hostname while the nodes were named by device
  name, and with no shared identity key auto-map produced zero matches.

  - **prometheus**: derive identity from the `instance` label — an IPv4 target
    (bare or `IP:port`, e.g. an SNMP target) becomes `mgmtIp`; a hostname
    becomes `sysName`.
  - **netbox**: mirror the topology-node identity (`mgmtIp` from `primary_ip`,
    `sysName` from device name) on the host side too.
  - **aruba-instant-on**: `mgmtIp` from `ipAddress`, `mac` from `macAddress`,
    and `{ 'aruba-serial': … }` in `vendorIds`; the operator-editable `name`
    stays a `displayName`, never `sysName`.

- 38b4086: Add a first-class `secret` flag to plugin config schemas.

  `PluginConfigProperty` gains `secret?: boolean`, and `@shumoku/core/plugin-kit`
  exports `isSecretProp`. Secret-ness is declared once on the schema
  (`secret: true`; `format: 'password'` is still honoured for back-compat), so the
  host can render token/password fields masked with a show/hide reveal toggle and
  suppress password-manager autofill from a single definition — no per-plugin
  branches, no hard-coded field-name lists.

  Bundled plugins mark their token/password/webhook-secret fields with
  `secret: true`.

- Updated dependencies [1be13c4]
- Updated dependencies [d9625fb]
- Updated dependencies [e60404d]
- Updated dependencies [14db853]
- Updated dependencies [d2b560c]
- Updated dependencies [b19c2ec]
- Updated dependencies [caf0c50]
- Updated dependencies [d943f92]
- Updated dependencies [3764162]
- Updated dependencies [d2051be]
- Updated dependencies [e5c79a4]
- Updated dependencies [caf0c50]
- Updated dependencies [caf0c50]
- Updated dependencies [38b4086]
  - @shumoku/core@0.3.0

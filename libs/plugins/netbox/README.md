# shumoku-plugin-netbox

[NetBox](https://netbox.dev/) data source plugin for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Builds topology from DCIM/IPAM — devices, virtual machines, interfaces, and cables — and lists hosts, with rich filtering by site, tag, role, and location.

## Capabilities

| Capability | What it provides |
|------------|------------------|
| `topology` | A `NetworkGraph` from devices + VMs + cables, grouped and with cross-location links |
| `hosts` | Devices and virtual machines, with interface lookup |

It also exposes dynamic candidates (sites, tags, roles) for the filter dropdowns via `getConfigOptions`.

## Configuration

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `url` | string (uri) | ✅ | — | NetBox base URL |
| `token` | string (password) | ✅ | — | API token |
| `insecure` | boolean | | `false` | Skip TLS verification. Self-signed certs in trusted networks only |

## Topology options

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `groupBy` | `tag` \| `site` \| `location` \| `prefix` \| `none` | `tag` | How to nest nodes |
| `siteFilter` | string[] | — | Include only these sites (candidates from NetBox) |
| `tagFilter` | string[] | — | Include only these tags |
| `roleFilter` | string[] | — | Include only these device roles |
| `excludeRoleFilter` | string[] | — | Exclude these roles |
| `excludeTagFilter` | string[] | — | Exclude these tags |

## Usage

Bundled with [`apps/server`](../../../apps/server). To register elsewhere:

```typescript
import { register } from 'shumoku-plugin-netbox'
register(pluginRegistry)
```

### As a library

The NetBox API client and converters are exported for standalone use:

```typescript
import { NetBoxClient, convertToSourceNetwork, toYaml } from 'shumoku-plugin-netbox'

const client = new NetBoxClient({ url: 'https://netbox.example.com', token })
const { devices, interfaces, cables } = await client.fetchAll()

// What NetBox knows, as a SourceNetwork (network + observation + drawing)
const source = convertToSourceNetwork(devices, interfaces, cables, { groupBy: 'site' })

// Or the network YAML
const yaml = toYaml(devices, interfaces, cables, { groupBy: 'site' })
```

The YAML uses the network format, with links written as `endpoints`:

```yaml
name: Network Topology
description: Generated from NetBox
groups:
  - id: core-switch
    label: Core Switch
segments:
  - id: vlan-10
    vlan: 10
nodes:
  - id: core-sw1
    label: core-sw1
    type: l3-switch
    address: 10.0.0.1
    group: core-switch
  - id: edge-sw1
    label: edge-sw1
    type: l2-switch
    address: 10.0.0.2
    group: core-switch
links:
  - id: link-0
    endpoints:
      - node: core-sw1
        port: xe-0/0/1
      - node: edge-sw1
        port: xe-0/0/48
    speed: 10G
    cable: cat6
    segments:
      - vlan-10
```

To draw virtual machines too, pass `{ includeVMs: true, groupVMsByCluster: true }` and the VM list as the last argument: `convertToSourceNetwork(devices, interfaces, cables, options, circuitData, { vms })`.

Other exports: `NetBoxPlugin`, mapping constants (`ROLE_TO_TYPE`, `CABLE_COLORS`, `CABLE_STYLES`, `DEFAULT_TAG_MAPPING`, `getVlanColor`, `convertSpeedToBandwidth`), and the full set of `NetBox*` response types.

Depends on [`@shumoku/core`](../../@shumoku/core) and [`@shumoku/plugin-sdk`](../../@shumoku/plugin-sdk). See [Plugin Authoring](../../../docs/plugin-authoring.md).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.

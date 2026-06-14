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
import { NetBoxClient, convertToNetworkGraph, toYaml } from 'shumoku-plugin-netbox'

const client = new NetBoxClient({ url: 'https://netbox.example.com', token })
const graph = await convertToNetworkGraph(/* fetched devices + cables */)
```

Other exports: `NetBoxPlugin`, `convertToHierarchicalYaml`, `convertToNetworkGraphWithVMs`, mapping constants (`ROLE_TO_TYPE`, `CABLE_COLORS`, `CABLE_STYLES`, `DEFAULT_TAG_MAPPING`, `getVlanColor`, `convertSpeedToBandwidth`), and the full set of `NetBox*` response types.

Depends on [`@shumoku/core`](../../@shumoku/core) and [`@shumoku/plugin-sdk`](../../@shumoku/plugin-sdk). See [Plugin Authoring](../../../docs/plugin-authoring.md).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.

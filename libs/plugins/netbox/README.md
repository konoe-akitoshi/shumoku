# shumoku-plugin-netbox

[NetBox](https://netbox.dev/) data source plugin for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Reads DCIM, IPAM, circuits, VPN, virtualization and wireless data and maps it into the network input model, and lists hosts. The design and the reason for each choice are in [`docs/plugins/netbox-mapping.md`](../../../docs/plugins/netbox-mapping.md).

Targets NetBox 4.2 and later (the generic circuit-termination and cluster `scope` shapes).

## Capabilities

| Capability | What it provides |
|------------|------------------|
| `topology` | A `SourceNetwork`: nodes, links, segments, groups and redundancy from the data below; NetBox's own ids ride in the observation's `vendorIds` |
| `hosts` | Devices, with interface lookup; keyed the same as their topology nodes |

It also exposes dynamic candidates (sites, tags, roles, cluster types) for the option fields via `getConfigOptions`.

## What is mapped

| NetBox | Input model |
|--------|-------------|
| Site, location (nested), rack | `groups` (depth set by `groupDepth`) |
| Device | `Node`: `type` from its role, `product` = `maker/device-type`, `software` = platform, `asn` from a one-AS site on routers, firewalls and L3 switches |
| Virtual machine | `Node` of type `virtual-machine`, `host` = its device, its cloud, or its hypervisor cluster |
| Cabled path (`connected_endpoints`, through patch panels and circuits) | `Link` with `speed`; `cable` and `length` only when the path is one cable |
| LAG | `Connection` shared by the member links |
| Circuit to a provider network / provider | `external` node (with the provider's ASN) and a link on a port named for the circuit |
| Tunnel, tunnel group | virtual `Link`s, the group a `Connection` |
| Virtual circuit, point-to-point L2VPN | virtual `Link` (subinterfaces fold into their parent port) |
| Multipoint L2VPN | `Segment` with virtual links to it |
| VM interface in a VLAN | virtual link to the VLAN `Segment` |
| Wireless link | `Link` with the medium in `description` (neither cabled nor virtual) |
| Virtual chassis, FHRP group, hypervisor cluster | `redundancy` (`vc`, `ha`, `cluster`); an FHRP VIP is written under the set |
| VLAN, prefix, IP address | `segments` with their `addresses`; a primary address with no prefix is `Node.address` |
| VRF | `routingDomains` |
| Cluster of a cloud cluster type | `cloud` node that hosts its VMs |

Left unwritten when NetBox does not state it. Nothing is coloured: the cable type is a fact on the link, and how a line is drawn is the drawing's to choose. `planned` and `inventory` devices and circuits are not drawn unless the status options say so.

A node is recognized by `mgmtIp` and `vendorIds` (the NetBox ids); a NetBox name is operator-written, so it is not a `sysName`. Ports carry `ifName`.

## Configuration

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `url` | string (uri) | yes | | NetBox base URL |
| `token` | string (password) | yes | | API token (v1 `Token` and v2 `Bearer` are both accepted) |
| `insecure` | boolean | | `false` | Skip TLS verification. Self-signed certs in trusted networks only |

## Topology options

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `groupDepth` | `site` \| `location` \| `rack` | `location` | How deep the places nest |
| `siteFilter` | string[] | | Include only these sites (candidates from NetBox) |
| `tagFilter` | string[] | | Include only devices with these tags |
| `roleFilter` | string[] | | Include only these device roles |
| `excludeRoleFilter` | string[] | | Exclude these roles |
| `excludeTagFilter` | string[] | | Exclude these tags |
| `tenantFilter` | string[] | | Include only these tenants |
| `cloudClusterTypes` | string[] | | Cluster type slugs that are a cloud (such as `aws`); each such cluster becomes a `cloud` node that hosts its VMs. Nothing is guessed from names |
| `roleTypes` | string[] | | `role-slug=type` lines, for roles the built-in map does not know (`hypervisor=server`) |
| `statusFilter` | string[] | `active, staged, offline, failed, decommissioning` | Device and VM statuses that are drawn |
| `circuitStatusFilter` | string[] | `active, offline, provisioning, deprovisioning` | Circuit statuses that are drawn |

Removed: `groupBy` (tag and prefix grouping), the tag-to-level mapping, `colorByCableType` and every other colour. Without `cloudClusterTypes`, VMs of a cluster with no hosts have no `host`, and the drawing guesses which way is up.

An app that is switched off (virtualization, circuits, VPN, wireless) or a token that cannot read it drops that family of facts, once logged; the sync goes on.

## Usage

Bundled with [`apps/server`](../../../apps/server). To register elsewhere:

```typescript
import { register } from 'shumoku-plugin-netbox'
register(pluginRegistry)
```

### As a library

```typescript
import { NetBoxClient, convertToSourceNetwork, toYaml } from 'shumoku-plugin-netbox'

const client = new NetBoxClient({ url: 'https://netbox.example.com', token })
const data = await client.fetchTopologyData({ site: ['hq'] })

// What NetBox knows, as a SourceNetwork (network + observation + drawing)
const options = { groupDepth: 'location', cloudClusterTypes: ['aws'] } as const
const source = convertToSourceNetwork(data, options)

// Or the network YAML
const yaml = toYaml(data, options)
```

`fetchTopologyData` asks for only the fields the mapping reads (`?fields=`) and, with a filter set, only the interfaces of the fetched devices.

Other exports: `NetBoxPlugin`, `ROLE_TO_TYPE`, `nominalSpeedFromInterfaceType`, and the `NetBox*` response types.

## Tests

`src/converter.test.ts` runs the mapping over the responses recorded from a seeded NetBox (`src/fixtures/fictional-corp/`, recorded by `live/`) and asserts the design document's expected output. `src/client.test.ts` and `src/plugin.test.ts` answer the client's calls from the same recordings. NetBox itself is not needed to run them.

Depends on [`@shumoku/core`](../../@shumoku/core) and [`@shumoku/plugin-sdk`](../../@shumoku/plugin-sdk). See [Plugin Authoring](../../../docs/plugin-authoring.md).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.

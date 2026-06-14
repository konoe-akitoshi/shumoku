# @shumoku/catalog

Device and service catalog for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Registers hardware, compute, and service entries and looks them up by **vendor + model**, **part number**, or **SNMP `sysObjectID`** — plus IANA enterprise-number → vendor resolution and PoE-standard helpers.

## Install

```bash
npm install @shumoku/catalog @shumoku/core
```

## Quick start

```typescript
import { Catalog, builtinEntries, vendorFromOid } from '@shumoku/catalog'

const catalog = new Catalog()
catalog.registerAll(builtinEntries())

// Resolve a device discovered over SNMP
const entry = catalog.findBySysObjectId('1.3.6.1.4.1.9.1.2495')

// Resolve just the vendor from an enterprise OID (via IANA enterprise numbers)
const vendor = vendorFromOid('1.3.6.1.4.1.9.1.2495')
```

## API

| Group | Exports |
|-------|---------|
| **Registry** | `Catalog` — `register`, `registerAll`, `findBySysObjectId`, `findByPartNumber`, `lookup`, `list`, `listByKind` |
| **Built-ins** | `builtinEntries()` — the bundled device/service entries |
| **Custom data** | `parseCatalogYaml`, `parseCatalogYamlMulti` — load catalog entries from YAML |
| **IANA / OID** | `ianaEnterpriseFromOid`, `vendorFromIanaEnterpriseId`, `vendorFromOid` |
| **PoE** | `effectivePoeClass`, `classReservationW`, `POE_CLASS_RESERVATION_W`, `POE_STANDARD_MAX_CLASS`, `PoEStandard` |
| **Ports** | `expandCatalogPorts`, `CatalogPortTemplate` |

Entries are typed as `HardwareCatalogEntry`, `ComputeCatalogEntry`, or `ServiceCatalogEntry` (all `CatalogEntry`), each with structured properties (physical, management, switching, wireless, power, PoE, …).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.

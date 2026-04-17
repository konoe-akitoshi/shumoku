// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

export { builtinEntries } from './builtin.js'
export { Catalog } from './catalog.js'
export { parseCatalogYaml, parseCatalogYamlMulti } from './loader.js'
export {
  classReservationW,
  effectivePoeClass,
  POE_CLASS_RESERVATION_W,
  POE_STANDARD_MAX_CLASS,
  type PoEStandard,
} from './poe.js'
export type {
  CatalogEntry,
  ComputeCatalogEntry,
  ComputeProperties,
  HardwareCatalogEntry,
  HardwareProperties,
  ManagementProperties,
  PhysicalProperties,
  PoEIn,
  PoEInClassProfile,
  PoEOut,
  PortGroup,
  PortProperties,
  PowerProperties,
  PropertiesFor,
  ServiceCatalogEntry,
  ServiceProperties,
  SwitchingProperties,
  WirelessProperties,
} from './types.js'

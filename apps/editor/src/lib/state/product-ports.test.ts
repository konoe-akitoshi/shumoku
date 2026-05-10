// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { NodePort } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import type { DeviceProduct } from '../types'
import { instantiatePortsFromProduct, mergeProductPortsIntoExisting } from './product-ports'

function template(overrides: Partial<NodePort>): NodePort {
  return {
    id: `tpl-${overrides.label ?? 'p'}`,
    label: '',
    connectors: ['rj45'],
    ...overrides,
  } as NodePort
}

function deviceProduct(ports: NodePort[]): DeviceProduct {
  return {
    id: 'product-test',
    kind: 'device',
    spec: { kind: 'hardware', vendor: 'cisco', model: 'test' },
    ports,
  }
}

describe('instantiatePortsFromProduct', () => {
  test('returns undefined when the product has no port snapshot', () => {
    expect(instantiatePortsFromProduct(undefined)).toBeUndefined()
    expect(instantiatePortsFromProduct(deviceProduct([]))).toBeUndefined()
  })

  test('every instantiated port gets a fresh node-side id', () => {
    const product = deviceProduct([
      template({ label: 'Gi1/0/1', faceplateLabel: '1' }),
      template({ label: 'Gi1/0/2', faceplateLabel: '2' }),
    ])
    const a = instantiatePortsFromProduct(product)
    const b = instantiatePortsFromProduct(product)
    expect(a?.length).toBe(2)
    expect(b?.length).toBe(2)
    // Two placements get different port ids
    const aIds = a?.map((p) => p.id)
    const bIds = b?.map((p) => p.id)
    expect(new Set([...(aIds ?? []), ...(bIds ?? [])]).size).toBe(4)
    // Template attrs are preserved
    expect(a?.[0]?.label).toBe('Gi1/0/1')
    expect(a?.[0]?.faceplateLabel).toBe('1')
    expect(a?.[0]?.id).toMatch(/^port-/)
  })
})

describe('mergeProductPortsIntoExisting', () => {
  test('returns existing untouched when product has no template', () => {
    const existing: NodePort[] = [{ id: 'p1', label: 'GE0', connectors: ['rj45'] }]
    expect(mergeProductPortsIntoExisting(existing, undefined)).toEqual(existing)
    expect(mergeProductPortsIntoExisting(existing, deviceProduct([]))).toEqual(existing)
  })

  test('matches existing ports by interfaceName and refreshes catalog attrs', () => {
    const existing: NodePort[] = [
      // Stale: legacy 1G/SFP-only data baked at first placement
      {
        id: 'old-port-id',
        label: 'GE2',
        interfaceName: 'GigaEthernet2.0',
        speed: '1g',
        connectors: ['sfp'],
      },
    ]
    // Catalog updated: GE2 is now 10G combo
    const product = deviceProduct([
      template({
        label: 'GE2',
        interfaceName: 'GigaEthernet2.0',
        speed: '10g',
        connectors: ['rj45', 'sfp+'],
      }),
    ])
    const merged = mergeProductPortsIntoExisting(existing, product)
    expect(merged).toHaveLength(1)
    // Stable id preserved
    expect(merged[0]?.id).toBe('old-port-id')
    // Physical attrs refreshed
    expect(merged[0]?.speed).toBe('10g')
    expect(merged[0]?.connectors).toEqual(['rj45', 'sfp+'])
    // Existing label preserved (catalog default would also be 'GE2'; this
    // covers both unedited-and-still-default and the refresh-attrs case)
    expect(merged[0]?.label).toBe('GE2')
  })

  test('overwrites label from template — no special preservation', () => {
    // Earlier the merge tried to preserve user-edited labels, but
    // there's no way to distinguish "user typed this" from "old
    // catalog default left behind", so stale labels rode forward and
    // broke (label, iface) pairing. Resync now always overwrites
    // label from the template; the planned Resync diff popup gives
    // users visibility before applying.
    const existing: NodePort[] = [
      {
        id: 'p',
        label: 'MyCustomLabel',
        interfaceName: 'GigaEthernet0.0',
        speed: '1g',
        connectors: ['rj45'],
      },
    ]
    const product = deviceProduct([
      template({
        label: 'GE0',
        interfaceName: 'GigaEthernet0.0',
        speed: '1g',
        connectors: ['rj45', 'sfp'],
      }),
    ])
    const merged = mergeProductPortsIntoExisting(existing, product)
    expect(merged[0]?.id).toBe('p')
    expect(merged[0]?.label).toBe('GE0')
    expect(merged[0]?.connectors).toEqual(['rj45', 'sfp'])
  })

  test('falls back to exact label match when interfaceName is absent', () => {
    const existing: NodePort[] = [{ id: 'p', label: '1', connectors: ['rj45'] }]
    const product = deviceProduct([
      template({ label: '1', faceplateLabel: '1', poe: true, connectors: ['rj45'] }),
    ])
    const merged = mergeProductPortsIntoExisting(existing, product)
    expect(merged[0]?.id).toBe('p')
    expect(merged[0]?.poe).toBe(true)
  })

  test('appends template ports that have no existing match (catalog grew)', () => {
    const existing: NodePort[] = [
      { id: 'p1', label: 'GE0', interfaceName: 'GigaEthernet0.0', connectors: ['rj45'] },
    ]
    const product = deviceProduct([
      template({ label: 'GE0', interfaceName: 'GigaEthernet0.0', connectors: ['rj45'] }),
      template({ label: 'GE1', interfaceName: 'GigaEthernet1.0', connectors: ['rj45'] }),
    ])
    const merged = mergeProductPortsIntoExisting(existing, product)
    expect(merged).toHaveLength(2)
    expect(merged[0]?.id).toBe('p1')
    expect(merged[1]?.id).toMatch(/^port-/)
    expect(merged[1]?.label).toBe('GE1')
  })

  test('keeps existing ports the template no longer mentions (custom + orphans)', () => {
    const existing: NodePort[] = [
      { id: 'p1', label: 'GE0', interfaceName: 'GigaEthernet0.0', connectors: ['rj45'] },
      // Custom user-added port — must survive a resync
      {
        id: 'p2',
        label: 'extra',
        connectors: ['rj45'],
        source: 'custom',
      },
      // Orphan: catalog used to have GE99 but no longer does
      { id: 'p3', label: 'GE99', interfaceName: 'GigaEthernet99.0', connectors: ['rj45'] },
    ]
    const product = deviceProduct([
      template({ label: 'GE0', interfaceName: 'GigaEthernet0.0', connectors: ['rj45'] }),
    ])
    const merged = mergeProductPortsIntoExisting(existing, product)
    expect(merged).toHaveLength(3)
    expect(merged.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  test('bind-after-manual: labels matching catalog ports get full template overwrite', () => {
    // Realistic flow: user creates an empty node, adds a few ports
    // by hand naming them after what they expect ("GE0", "GE2",
    // plus a custom one), then binds the node to a catalog Product.
    // bindNodeToProduct routes through this merge.
    const existing: NodePort[] = [
      { id: 'manual-ge0', label: 'GE0', connectors: [] },
      { id: 'manual-ge2', label: 'GE2', connectors: [] },
      { id: 'manual-custom', label: 'uplink-to-isp', connectors: [] },
    ]
    const product = deviceProduct([
      template({
        label: 'GE0',
        faceplateLabel: 'GE0',
        interfaceName: 'GigaEthernet0.0',
        speed: '1g',
        connectors: ['rj45', 'sfp'],
      }),
      template({
        label: 'GE1',
        faceplateLabel: 'GE1',
        interfaceName: 'GigaEthernet1.0',
        speed: '1g',
        connectors: ['rj45', 'sfp'],
      }),
      template({
        label: 'GE2',
        faceplateLabel: 'GE2',
        interfaceName: 'GigaEthernet2.0',
        speed: '10g',
        connectors: ['rj45', 'sfp+'],
      }),
    ])
    const merged = mergeProductPortsIntoExisting(existing, product)
    // Three template ports + one orphan custom port
    expect(merged).toHaveLength(4)

    // GE0: matched by label, full overwrite, id preserved
    const ge0 = merged.find((p) => p.label === 'GE0')
    expect(ge0?.id).toBe('manual-ge0')
    expect(ge0?.interfaceName).toBe('GigaEthernet0.0')
    expect(ge0?.connectors).toEqual(['rj45', 'sfp'])
    expect(ge0?.faceplateLabel).toBe('GE0')

    // GE1: no manual counterpart, gets a fresh id
    const ge1 = merged.find((p) => p.label === 'GE1')
    expect(ge1?.id).toMatch(/^port-/)
    expect(ge1?.interfaceName).toBe('GigaEthernet1.0')

    // GE2: matched by label; physical attrs now reflect the 10G combo
    const ge2 = merged.find((p) => p.label === 'GE2')
    expect(ge2?.id).toBe('manual-ge2')
    expect(ge2?.speed).toBe('10g')
    expect(ge2?.connectors).toEqual(['rj45', 'sfp+'])
    expect(ge2?.interfaceName).toBe('GigaEthernet2.0')

    // Custom port survives untouched at the end
    const orphan = merged[merged.length - 1]
    expect(orphan?.id).toBe('manual-custom')
    expect(orphan?.label).toBe('uplink-to-isp')
  })

  test('does not reuse the same existing port for two templates', () => {
    // Two templates that would both happen to match the same existing
    // port by label — the matcher should pick exactly one.
    const existing: NodePort[] = [{ id: 'p1', label: 'shared', connectors: ['rj45'] }]
    const product = deviceProduct([
      template({ label: 'shared', connectors: ['rj45'] }),
      template({ label: 'shared', connectors: ['rj45'] }),
    ])
    const merged = mergeProductPortsIntoExisting(existing, product)
    expect(merged).toHaveLength(2)
    // First template claims the existing id; second gets a fresh one.
    expect(merged[0]?.id).toBe('p1')
    expect(merged[1]?.id).toMatch(/^port-/)
    expect(merged[1]?.id).not.toBe('p1')
  })
})

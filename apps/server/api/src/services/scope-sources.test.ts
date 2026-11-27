// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { computeScopeSources } from './scope-sources.js'

const sources = [
  { dataSourceId: 'netbox', purpose: 'topology', priority: 2 },
  { dataSourceId: 'zabbix', purpose: 'topology', priority: 1 },
  { dataSourceId: 'deep-read', purpose: 'topology', priority: 100 },
  { dataSourceId: 'prometheus', purpose: 'metrics', priority: 5 },
]

describe('computeScopeSources', () => {
  it('auto takes the highest-priority source that holds regions, not one that holds none', () => {
    // the device read sits above every source and holds no regions: it must not take the
    // boundary, or attaching it opens the world
    const regions = new Set(['netbox', 'zabbix'])
    expect(computeScopeSources('auto', undefined, sources, (id) => regions.has(id))).toEqual(
      new Set(['netbox']),
    )
  })

  it('auto closes nothing when no source holds regions', () => {
    expect(computeScopeSources('auto', undefined, sources, () => false)).toEqual(new Set())
  })

  it('closed and open follow the topology whatever the regions', () => {
    expect(computeScopeSources('closed', 'zabbix', sources, () => false)).toEqual(
      new Set(['zabbix']),
    )
    expect(computeScopeSources('open', undefined, sources, () => true)).toEqual(new Set())
  })
})

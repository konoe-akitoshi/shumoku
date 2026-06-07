// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * C7 guard (plugin-contract-unification §3.7): the host must not branch on a
 * data-source plugin's `type` to build its config UI. After #270 the config
 * surfaces (datasources create/edit, topology Sources options) render
 * generically from the plugin's configSchema / optionsSchema, so a new
 * per-plugin `type === '<plugin>'` branch in these files is a regression —
 * adding a data source type must require zero host edits.
 *
 * (The former 'manual' exception is gone: the project's own graph is the
 * intrinsic contribution, edited at /topologies/:id/edit — not a data source.)
 */
const ALLOWED = new Set<string>()
const BUNDLED = ['zabbix', 'prometheus', 'netbox', 'grafana', 'aruba-instant-on', 'network-scan']

const here = dirname(fileURLToPath(import.meta.url))
const WEB = join(here, '..', '..', '..', 'web', 'src', 'routes', '(app)')
const SURFACES = [
  'datasources/+page.svelte',
  'datasources/[id]/+page.svelte',
  'topologies/[id]/sources/+page.svelte',
]

describe('host config surfaces do not branch on plugin type (#270 / C7)', () => {
  for (const rel of SURFACES) {
    it(`${rel} has no per-plugin config branch`, () => {
      const src = readFileSync(join(WEB, ...rel.split('/')), 'utf-8')
      const offenders = BUNDLED.filter(
        (type) => !ALLOWED.has(type) && new RegExp(`=== ['"]${type}['"]`).test(src),
      )
      expect(offenders, `${rel} branches on plugin type(s): ${offenders.join(', ')}`).toEqual([])
    })
  }
})

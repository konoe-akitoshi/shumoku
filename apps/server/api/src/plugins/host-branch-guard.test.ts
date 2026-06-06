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
 * Documented, intentional exception (NOT a config-form branch):
 * - 'manual': the editor-container source — no upstream; its graph is a
 *   per-topology observation snapshot (migration 014), not config_json.
 *   Architecturally special, not a normal data-source plugin. (Grafana's
 *   webhook URL is now generic via getConnectionInfo, so it no longer
 *   needs an exception.)
 */
const ALLOWED = new Set(['manual'])
const BUNDLED = [
  'zabbix',
  'prometheus',
  'netbox',
  'grafana',
  'aruba-instant-on',
  'network-scan',
  'manual',
]

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

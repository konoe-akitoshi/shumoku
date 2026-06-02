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
 * Documented, intentional exceptions (NOT config-form branches):
 * - 'manual': the editor-container source — no upstream, one-per-topology,
 *   carries its graph in config_json. Architecturally special, not a normal
 *   data-source plugin.
 * - 'grafana': the webhook-URL display + useWebhook gate, pending
 *   getConnectionInfo + a generic /api/webhooks/:type/:id route (design F6).
 *   Tracked cleanup, not a config-form branch.
 */
const ALLOWED = new Set(['manual', 'grafana'])
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

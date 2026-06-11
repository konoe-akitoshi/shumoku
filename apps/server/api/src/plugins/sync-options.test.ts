// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * parseSyncOptions — scope-marked option fields must NOT reach the plugin at
 * sync time. Scope is topology-level and enforced post-merge by resolve(); a
 * per-source leftover (e.g. a Zabbix `hostGroups` saved before the move) would
 * pre-filter the observation and make the topology Scope UI a no-op.
 */
import { expect, test } from 'bun:test'
import { pluginRegistry } from './registry.js'
import { parseSyncOptions } from './sync-options.js'

pluginRegistry.registerDescriptor(
  {
    type: 'sync-opts-test',
    displayName: 'Sync Opts Test',
    capabilities: ['topology'],
    optionsSchema: {
      type: 'object',
      properties: {
        hostGroups: {
          type: 'array',
          items: { type: 'string' },
          title: 'Host groups',
          scope: { kind: 'include', key: 'hostGroups' },
        },
        groupExclude: {
          type: 'array',
          items: { type: 'string' },
          title: 'Exclude groups',
          scope: { kind: 'exclude', key: 'hostGroups' },
        },
        groupBy: { type: 'string', title: 'Group by' },
      },
    },
  },
  () => {
    throw new Error('not instantiated in this test')
  },
)

test('strips scope-marked fields, keeps behavior fields', () => {
  const opts = parseSyncOptions(
    'sync-opts-test',
    JSON.stringify({ hostGroups: ['98'], groupExclude: ['99'], groupBy: 'hostgroup' }),
  )
  expect(opts).toEqual({ groupBy: 'hostgroup' })
})

test('passes options through untouched for plugins without an options schema', () => {
  const opts = parseSyncOptions('unknown-plugin-type', JSON.stringify({ anything: true }))
  expect(opts).toEqual({ anything: true })
})

test('handles absent / malformed optionsJson', () => {
  expect(parseSyncOptions('sync-opts-test', undefined)).toBeUndefined()
  expect(parseSyncOptions('sync-opts-test', null)).toBeUndefined()
  expect(parseSyncOptions('sync-opts-test', '{not json')).toBeUndefined()
})

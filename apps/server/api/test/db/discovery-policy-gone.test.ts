// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A rename, a hide and a suppression used to be written to the hidden project overlay. It is
 * gone, so those calls answer 410 and write nothing; the access / policy half of the same PATCH
 * (stored in `deep_read_config`) is untouched.
 *
 * Lives under test/db (bun test) because importing the route module pulls in `bun:sqlite`.
 *
 * Run with: cd apps/server/api && bun test test/db/discovery-policy-gone.test.ts
 */

import { expect, test } from 'bun:test'
import type { AppServices } from '../../src/app/services.ts'
import { createDiscoveryPolicyApi } from '../../src/modules/discovery-policy/routes.ts'

const written: unknown[] = []
const services = {
  discoveryPolicy: {
    getTopology: () => ({ id: 't', name: 't' }) as never,
    getParsedGraph: async () => null,
    clearCache: () => undefined,
    listConfigs: () => new Map(),
    bulkSetConfig: (...args: unknown[]) => void written.push(args),
    upsertConfig: (...args: unknown[]) => {
      written.push(args)
      return { mode: 'observe' } as never
    },
  },
} as unknown as Pick<AppServices, 'discoveryPolicy'>
const api = createDiscoveryPolicyApi(services)

const send = (method: string, path: string, body: unknown) =>
  api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

test('renaming a node answers 410 and writes nothing', async () => {
  const res = await send('PATCH', '/t/discovery-policy', { scope: 'node', id: 'n', label: 'X' })
  expect(res.status).toBe(410)
  expect(written).toEqual([])
})

test('suppressing attachments answers 410 even when access is sent along', async () => {
  const res = await send('PATCH', '/t/discovery-policy', {
    scope: 'node',
    id: 'n',
    attachments: [{ kind: 'policy', mode: 'observe' }],
    suppressedAttachments: ['policy'],
  })
  expect(res.status).toBe(410)
  expect(written).toEqual([])
})

test('hide and unhide answer 410', async () => {
  expect(
    (await send('POST', '/t/discovery-policy/exclusions', { mgmtIp: '10.0.0.1' })).status,
  ).toBe(410)
  expect(
    (await send('DELETE', '/t/discovery-policy/exclusions', { mgmtIp: '10.0.0.1' })).status,
  ).toBe(410)
})

test('the access / policy half of the PATCH still works', async () => {
  const res = await send('PATCH', '/t/discovery-policy', {
    scope: 'node',
    id: 'n',
    attachments: [{ kind: 'policy', mode: 'observe' }],
  })
  expect(res.status).toBe(200)
  expect(written).toHaveLength(1)
})

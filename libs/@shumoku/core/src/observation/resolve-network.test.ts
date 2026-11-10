// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { expect, test } from 'vitest'
import type { NetworkModel } from '../models/network-model.js'
import { resolveNetwork } from './resolve-network.js'

test('the order a person chose rides through the merge with the settings', () => {
  const project: NetworkModel = {
    config: {
      groups: [{ id: 'g' }],
      nodes: [
        { id: 'a', group: 'g' },
        { id: 'b', group: 'g' },
      ],
      links: [{ endpoints: [{ node: 'a' }, { node: 'b' }] }],
    },
    drawing: { settings: { direction: 'LR' }, order: { g: ['b', 'a'], '': ['g'] } },
  }
  const merged = resolveNetwork(project, [])
  expect(merged.drawing?.settings).toEqual({ direction: 'LR' })
  expect(merged.drawing?.order).toEqual({ g: ['b', 'a'], '': ['g'] })
  expect(resolveNetwork({ config: project.config }, []).drawing?.order).toBeUndefined()
})

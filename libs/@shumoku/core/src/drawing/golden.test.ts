// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/index.js'
import { drawNetwork } from './draw.js'
import { layoutDrawing } from './layout.js'
import { goldenCases as cases } from './testing/cases.js'
import { networkOf, testMetrics } from './testing/support.js'

/**
 * The whole drawing of a fixed set of networks, pinned. A change that moves any box or line fails
 * here, which is the point of a pass that must not change the output; when the change is meant,
 * the snapshot is accepted with `vitest -u`. Next to the hash of the full scene are a few plain
 * numbers, so that a failure says roughly what moved.
 */

/**
 * The scene a case draws. A written network goes through `drawNetwork`, the one entry, so the
 * boundary it finds (or guesses) is pinned too; a generated one names its boundary.
 */
function sceneOf(yaml: string, boundary: string[]) {
  if (boundary.length === 0)
    return drawNetwork(readNetworkModel(yaml), { metrics: () => testMetrics })
  const { network, structure } = networkOf(yaml, boundary)
  return layoutDrawing(network, structure, testMetrics)
}

function summary(yaml: string, boundary: string[]) {
  const scene = sceneOf(yaml, boundary)
  return {
    nodes: scene.nodes.length,
    groups: scene.groups.length,
    wires: scene.wires.length,
    bounds: scene.bounds,
    hash: createHash('sha1').update(JSON.stringify(scene)).digest('hex').slice(0, 16),
  }
}

describe('the drawing of fixed networks', () => {
  it.each(cases)('%s', (_name, yaml, boundary) => {
    expect(summary(yaml, boundary)).toMatchSnapshot()
  })
})

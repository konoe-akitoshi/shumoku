// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from '../structure/index.js'
import type { Metrics } from './metrics.js'
import { type Problem, readProblem } from './problem.js'

/** Round lengths for tests, so expected positions can be written down. */
export const testMetrics: Metrics = {
  card: () => ({ width: 100, height: 40 }),
  bus: (_id, lines) => ({ width: 20 * Math.max(lines, 1), height: 10 }),
  cloud: () => ({ width: 100, height: 40 }),
  group: () => ({ top: 20, right: 10, bottom: 10, left: 10 }),
  gap: 30,
  memberGap: 10,
  groupGap: 40,
  hullPad: 5,
  width: () => 0,
  gapTwin: 4,
  gapApart: 4,
  aspect: 16 / 9,
  leadOut: 10,
  portSlot: () => 20,
}

export function networkOf(yaml: string, boundary: string[]) {
  const network = readNetworkModel(yaml).config
  return { network, structure: deriveStructure(network, { boundary }) }
}

export function problemOf(yaml: string, boundary: string[]): Problem {
  const { network, structure } = networkOf(yaml, boundary)
  return readProblem(network, structure, testMetrics)
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { deriveStructure } from '../structure/index.js'
import { layoutDrawing } from './layout.js'
import type { Scene } from './scene.js'
import { randomYaml } from './testing/random.js'
import { generatedYaml, networkOf, testMetrics } from './testing/support.js'

/** A shuffle that gives the same order for the same seed (Fisher-Yates over a small generator). */
function shuffled<T>(list: readonly T[], seed: number): T[] {
  let state = seed
  const next = (n: number) => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state % n
  }
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = next(i + 1)
    const [a, b] = [out[i], out[j]]
    if (a !== undefined && b !== undefined) [out[i], out[j]] = [b, a]
  }
  return out
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * What a scene draws, whatever order it lists it in: each box by its id, each wire by its shape
 * (the link ids of a written network follow its order, so they are not part of it). `wires: false`
 * leaves the wires out, for the orders that only the boxes are held to.
 */
function drawn(scene: Scene, wires: boolean): string {
  const sorted = (items: string[]) => items.sort(byText)
  return JSON.stringify({
    nodes: sorted(scene.nodes.map((n) => JSON.stringify([n.node.id, n.box]))),
    groups: sorted(scene.groups.map((g) => JSON.stringify([g.group.id, g.box]))),
    wires: wires
      ? sorted(scene.wires.map((w) => JSON.stringify([w.points, w.radii, w.stroke, w.label])))
      : [],
    ports: wires
      ? sorted((scene.ports ?? []).map((p) => JSON.stringify([p.nodeId, p.at, p.side, p.label])))
      : [],
    bounds: scene.bounds,
  })
}

const networks: [string, string][] = [
  ['random:1', randomYaml(1)],
  ['random:2', randomYaml(2)],
  ['random:3', randomYaml(3)],
  ['generated:30', generatedYaml(30)],
]

/** The hash of what a network draws when its nodes and links are listed in the orders given. */
function hashOf(yaml: string, order: { nodes: number; links: number }, wires: boolean): string {
  const { network } = networkOf(yaml, ['top'])
  const written = {
    ...network,
    nodes: order.nodes === 0 ? network.nodes : shuffled(network.nodes, order.nodes),
    links: order.links === 0 ? network.links : shuffled(network.links, order.links),
  }
  const structure = deriveStructure(written, { boundary: ['top'] })
  const scene = layoutDrawing(written, structure, testMetrics)
  return createHash('sha1').update(drawn(scene, wires)).digest('hex')
}

describe('the order the network is written in', () => {
  it.each(networks)('%s: shuffling the nodes does not change the scene', (_n, yaml) => {
    const same = hashOf(yaml, { nodes: 0, links: 0 }, true)
    for (const seed of [1, 2, 3]) expect(hashOf(yaml, { nodes: seed, links: 0 }, true)).toBe(same)
  })

  it.each(networks.slice(0, 3))('%s: shuffling the links does not move a box', (_n, yaml) => {
    const same = hashOf(yaml, { nodes: 0, links: 0 }, false)
    for (const seed of [1, 2, 3]) expect(hashOf(yaml, { nodes: 0, links: seed }, false)).toBe(same)
  })

  // Known: the order of the links decides ties in a larger network, and moves its boxes; the wires
  // of any network are rounded in the order of the links. When that is fixed, this starts to pass
  // and `it.fails` says so.
  it.fails('generated:30: shuffling the links does not move a box', () => {
    const same = hashOf(generatedYaml(30), { nodes: 0, links: 0 }, false)
    for (const seed of [1, 2, 3])
      expect(hashOf(generatedYaml(30), { nodes: 0, links: seed }, false)).toBe(same)
  })
})

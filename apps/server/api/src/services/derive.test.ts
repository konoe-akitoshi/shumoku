// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { DrawingScene, NetworkModel, SourceNetwork } from '@shumoku/core'
import { drawNetworkScene, layoutNetwork } from '@shumoku/renderer/static'
import { describe, expect, it } from 'vitest'
import { derive } from './derive.js'

const project: NetworkModel = {
  config: {
    groups: [{ id: 'floor' }],
    nodes: [
      { id: 'core', type: 'router' },
      { id: 'sw1', group: 'floor' },
      { id: 'sw2', group: 'floor' },
      { id: 'sw3', group: 'floor' },
    ],
    links: [
      { endpoints: [{ node: 'core' }, { node: 'sw1' }] },
      { endpoints: [{ node: 'core' }, { node: 'sw2' }] },
      { endpoints: [{ node: 'core' }, { node: 'sw3' }] },
    ],
  },
}

/** The picture alone: where each box and line is. The merge adds provenance to the node objects. */
const pictureOf = (scene: DrawingScene) => ({
  nodes: scene.nodes.map((n) => [n.node.id, n.box]),
  groups: scene.groups.map((g) => [g.group.id, g.box]),
  wires: scene.wires.map((w) => w.points),
  bounds: scene.bounds,
})

describe('derive', () => {
  it('draws a model with the order a person chose, as the Editor draws it', () => {
    // the Editor's own picture: layoutNetwork(model) with the model's drawing.order
    const plain = layoutNetwork(project)
    const floor = plain.arrangement.frames.floor?.map((p) => p.id) ?? []
    const order = { floor: [...floor].reverse() }
    const hinted: NetworkModel = { ...project, drawing: { order } }
    const editor = layoutNetwork(hinted)
    expect(editor.arrangement.frames.floor?.map((p) => p.id)).toEqual(order.floor)
    expect(pictureOf(editor.scene)).not.toEqual(pictureOf(plain.scene))

    // the Server's bake of the same model, through the merge
    const contribution: SourceNetwork = { network: hinted.config, drawing: hinted.drawing }
    const baked = derive({ project: contribution, snapshots: [], hideDisconnected: false })
    expect(pictureOf(baked.scene)).toEqual(pictureOf(editor.scene))
    expect(pictureOf(baked.scene)).toEqual(pictureOf(drawNetworkScene(hinted)))
  })

  it('reports the stages in order', () => {
    const stages: string[] = []
    derive({ project: { network: project.config }, snapshots: [], hideDisconnected: false }, (s) =>
      stages.push(s),
    )
    expect(stages).toEqual(['resolve', 'layout'])
  })
})

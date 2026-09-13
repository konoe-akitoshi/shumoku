import { expect, test } from 'bun:test'
import { sideOfBoundaryPoint } from '../geometry/box'
import type { Box, Side } from '../geometry/types'
import { runsHorizontally, SIDES } from '../geometry/types'
import { createLayoutModel } from '../model'
import type { Route } from '../state'
import { assignNodePorts } from './port-distribution'

/** A 100×100 hub with three 40×40 peers beyond one of its sides. */
function hubFacing(side: Side) {
  const horizontal = runsHorizontally(side)
  const sign = side === 'top' || side === 'left' ? -1 : 1
  const nodes: Box[] = [
    { x: 0, y: 0, w: 100, h: 100 },
    ...[-30, 0, 30].map((offset) => ({
      x: horizontal ? offset : sign * 200,
      y: horizontal ? sign * 200 : offset,
      w: 40,
      h: 40,
    })),
  ]
  const model = createLayoutModel({
    nodes: nodes.map((node, index) => ({
      id: index === 0 ? 'hub' : `peer${index}`,
      width: node.w,
      height: node.h,
      position: { x: node.x, y: node.y },
      preferredOffsetX: node.x,
    })),
    groups: [
      {
        id: 'g',
        nodeIds: ['hub', 'peer1', 'peer2', 'peer3'],
        frame: { x: 0, y: 0, w: 600, h: 600 },
        padding: { left: 24, right: 24, top: 44, bottom: 24 },
      },
    ],
    links: [1, 2, 3].map((peer) => ({ id: `l${peer - 1}`, source: 'hub', target: `peer${peer}` })),
  })
  const routes: Route[] = nodes.slice(1).map((peer) => ({
    kind: 'internal',
    points: [
      { x: horizontal ? 0 : sign * 50, y: horizontal ? sign * 50 : 0 },
      {
        x: horizontal ? peer.x : peer.x - sign * 20,
        y: horizontal ? peer.y - sign * 20 : peer.y,
      },
    ],
  }))
  return { model, nodes, routes }
}

test('ports spread around the side midpoint by pitch, ordered toward their peers', () => {
  for (const side of SIDES) {
    const { model, nodes, routes } = hubFacing(side)
    const ports = assignNodePorts(model, nodes, routes, 5.5)
    const hub = ports.filter((port) => port.node === 0)
    expect(hub.map((port) => port.offset)).toEqual([-5.5, 0, 5.5])
    expect(hub.map((port) => port.link)).toEqual([0, 1, 2])
    for (const port of hub) expect(sideOfBoundaryPoint(nodes[0] as Box, port)).toBe(side)
    for (const port of ports.filter((p) => p.node !== 0)) expect(port.offset).toBe(0)
    expect(
      assignNodePorts(model, nodes, routes, 11)
        .filter((port) => port.node === 0)
        .map((port) => port.offset),
    ).toEqual([-11, 0, 11])
  }
})

test('a side too short for its ports is rejected instead of compressing the pitch', () => {
  const { model, nodes, routes } = hubFacing('top')
  expect(() => assignNodePorts(model, nodes, routes, 40)).toThrow('Not enough room')
})

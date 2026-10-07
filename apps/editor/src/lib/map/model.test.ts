import type { Link, Node, Subgraph } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import type { Scene } from '../types'
import { migrateScenesToMap } from './migrate'
import {
  mapCableMeters,
  mapSpans,
  omissionEndId,
  placementDrawing,
  transformedPoint,
} from './model'

const link: Link = { id: 'wire', from: { node: 'a', port: 'p1' }, to: { node: 'b', port: 'p2' } }
function fixture(): Scene {
  return {
    id: 'map',
    name: 'Map',
    placementOrigin: 'center',
    nodePlacements: [
      { nodeId: 'a', position: { x: 0, y: 100 } },
      { nodeId: 'b', position: { x: 10000, y: 100 } },
    ],
    map: {
      drawings: [
        {
          id: 'd1',
          name: '1F',
          src: '1.png',
          width: 500,
          height: 500,
          position: { x: 0, y: 0 },
          scale: 1,
          calibration: { pxPerMeter: 100 },
        },
        {
          id: 'd2',
          name: '2F',
          src: '2.png',
          width: 500,
          height: 500,
          position: { x: 9500, y: 0 },
          scale: 1,
          calibration: { pxPerMeter: 100 },
        },
      ],
      pointDrawingIds: {
        a: 'd1',
        b: 'd2',
        [omissionEndId('o', 'from')]: 'd1',
        [omissionEndId('o', 'to')]: 'd2',
      },
      omissions: [
        {
          id: 'o',
          label: 'C1',
          linkId: 'wire',
          afterId: 'a',
          beforeId: 'b',
          from: { x: 200, y: 100 },
          to: { x: 9700, y: 100 },
        },
      ],
    },
  }
}

describe('map cable continuations', () => {
  test('omits exactly the middle span without changing link identity or endpoints', () => {
    const scene = fixture()
    const before = structuredClone(link)
    const spans = mapSpans(link, scene, [])
    expect(spans).toHaveLength(3)
    expect(spans.filter((s) => !s.omission)).toHaveLength(2)
    expect(spans[1]?.omission?.id).toBe('o')
    expect(link).toEqual(before)
  })
  test('does not report partial or canvas-gap lengths', () => {
    const scene = fixture()
    expect(mapCableMeters(link, scene, [])).toBeNull()
    const omission = scene.map?.omissions[0]
    if (!omission || !scene.map) throw new Error('Fixture')
    omission.meters = 8
    expect(mapCableMeters(link, scene, [])).toBe(13)
    omission.meters = 0
    expect(mapCableMeters(link, scene, [])).toBe(5)
    scene.map.omissions = []
    expect(mapCableMeters(link, scene, [])).toBeNull()
  })
  test('unknown scale, missing placements and stale references cannot produce complete lengths', () => {
    const scene = fixture()
    const omission = scene.map?.omissions[0]
    const drawing = scene.map?.drawings[0]
    if (!omission || !drawing) throw new Error('Fixture')
    omission.meters = 8
    drawing.calibration = undefined
    expect(mapCableMeters(link, scene, [])).toBeNull()
    drawing.calibration = { pxPerMeter: 100 }
    omission.afterId = 'deleted-waypoint'
    expect(mapCableMeters(link, scene, [])).toBeNull()
    scene.nodePlacements = []
    expect(mapSpans(link, scene, [])).toEqual([])
  })
  test('uses ordered via and bend IDs, preserving EPS as a pass-through point', () => {
    const scene = fixture()
    const routed: Link = {
      ...link,
      via: ['eps'],
      bends: [{ id: 'bend', x: 100, y: 100, afterIndex: -1 }],
    }
    const omission = scene.map?.omissions[0]
    if (!omission) throw new Error('Fixture')
    omission.afterId = 'eps'
    const spans = mapSpans(routed, scene, [
      { id: 'eps', role: 'eps', label: 'EPS', position: { x: 200, y: 100 } },
    ])
    expect(spans.map((s) => [s.from.id, s.to.id])).toEqual([
      ['a', 'bend'],
      ['bend', 'eps'],
      ['eps', omissionEndId('o', 'from')],
      [omissionEndId('o', 'from'), omissionEndId('o', 'to')],
      [omissionEndId('o', 'to'), 'b'],
    ])
  })
  test('moving and scaling a drawing preserves attached relative image positions', () => {
    const drawing = fixture().map?.drawings[0]
    if (!drawing) throw new Error('Fixture')
    expect(
      transformedPoint({ x: 100, y: 50 }, drawing, {
        ...drawing,
        scale: 2,
        position: { x: 500, y: 200 },
      }),
    ).toEqual({ x: 700, y: 300 })
  })
})

describe('legacy scene migration', () => {
  test('merges backgrounds, preserves alternatives, prefers owning scope and is idempotent', () => {
    const scenes: Scene[] = [
      {
        id: 'root',
        name: 'Root',
        placementOrigin: 'center',
        background: { src: 'all.png', width: 500, height: 400 },
        nodePlacements: [{ nodeId: 'a', position: { x: 20, y: 30 } }],
      },
      {
        id: 'floor',
        name: 'Floor',
        scopeSubgraphId: 'sg',
        placementOrigin: 'center',
        calibration: { pxPerMeter: 10 },
        background: { src: 'floor.png', width: 500, height: 400 },
        nodePlacements: [{ nodeId: 'a', position: { x: 50, y: 60 } }],
      },
    ]
    const nodes = new Map<string, Node>([['a', { id: 'a', parent: 'sg' } as Node]])
    const subgraphs = new Map<string, Subgraph>([['sg', { id: 'sg' } as Subgraph]])
    const migrated = migrateScenesToMap(scenes, nodes, subgraphs, [link], [])
    expect(migrated.scene.map?.drawings).toHaveLength(2)
    expect(migrated.scene.nodePlacements).toHaveLength(1)
    expect(migrated.scene.map?.pointDrawingIds.a).toBe('drawing:floor')
    expect(migrated.scene.nodePlacements[0]?.position).toEqual({ x: 1200, y: 600 })
    expect(migrated.scene.map?.legacyScenes).toEqual(scenes)
    expect(
      migrateScenesToMap([migrated.scene], nodes, subgraphs, migrated.links, []).scene,
    ).toEqual(migrated.scene)
    expect(scenes[1]?.nodePlacements[0]?.position).toEqual({ x: 50, y: 60 })
  })
  test('an empty project has a map and no invented placements', () => {
    const result = migrateScenesToMap([], new Map(), new Map(), [], [])
    expect(result.scene.map?.drawings).toEqual([])
    expect(result.scene.nodePlacements).toEqual([])
  })
})

test('placement chooses the visible drawing, preserves ownership outside, and ignores removed drawings', () => {
  const drawings = fixture().map?.drawings ?? []
  expect(placementDrawing(drawings, { x: 9600, y: 100 }, 'd1')?.id).toBe('d2')
  expect(placementDrawing(drawings, { x: 600, y: 100 }, 'd1')?.id).toBe('d1')
  expect(placementDrawing(drawings, { x: 600, y: 100 })).toBeUndefined()
  expect(placementDrawing(drawings, { x: 600, y: 100 }, 'deleted')).toBeUndefined()
  const overlapping = drawings.map((d) => ({ ...d, position: { x: 0, y: 0 } }))
  expect(placementDrawing(overlapping, { x: 100, y: 100 }, 'd1')?.id).toBe('d2')
})

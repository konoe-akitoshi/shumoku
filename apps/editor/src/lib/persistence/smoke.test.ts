// Smoke test for the .neted zip writer/reader. Run with:
//   bunx vitest run src/lib/persistence/smoke.test.ts
// Asserts that an export round-trips through import without losing
// data, including content-addressed image assets.

import type { NetworkGraph, Node } from '@shumoku/core'
import { unzipSync, zipSync } from 'fflate'
import { expect, test } from 'vitest'
import { assetStore } from '../state/assets.svelte'
import type { Product, Scene } from '../types'
import { readProjectZip } from './reader'
import { writeProjectZip } from './writer'

test('stores topology and geometry in separate files and preserves moves across import and re-export', async () => {
  const diagram: NetworkGraph = {
    version: '1',
    nodes: [
      {
        id: 'a',
        label: 'A',
        position: { x: 100, y: 200 },
        size: { width: 200, height: 80 },
        metadata: { building: 'A' },
      },
      { id: 'b', label: 'B' },
    ],
    links: [{ id: 'uplink', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth1' } }],
  }
  const input = { name: 'Geometry', diagram, products: [], scenes: [] }
  const before = structuredClone(input)
  const blob = await writeProjectZip(input)
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const topology = JSON.parse(new TextDecoder().decode(files['diagram.json']))
  const presentation = JSON.parse(new TextDecoder().decode(files['presentation.json']))
  expect(topology.nodes[0]).not.toHaveProperty('position')
  expect(topology.nodes[0]).not.toHaveProperty('size')
  expect(presentation.nodeGeometry).toEqual([
    { nodeId: 'a', position: { x: 100, y: 200 }, size: { width: 200, height: 80 } },
  ])
  const loaded = await readProjectZip(blob)
  expect(loaded.diagram).toEqual(diagram)
  const moved = structuredClone(loaded)
  const node = moved.diagram.nodes[0]
  if (!node) throw new Error('Missing fixture')
  node.position = { x: 800, y: 600 }
  const movedZip = await writeProjectZip({ ...moved, scenes: moved.scenes ?? [] })
  const movedFiles = unzipSync(new Uint8Array(await movedZip.arrayBuffer()))
  expect(JSON.parse(new TextDecoder().decode(movedFiles['diagram.json']))).toEqual(topology)
  expect((await readProjectZip(movedZip)).diagram.nodes[0]?.position).toEqual({ x: 800, y: 600 })
  expect(input).toEqual(before)
})

test('rejects a missing presentation file or a stale geometry reference', async () => {
  const blob = await writeProjectZip({
    name: 'T',
    diagram: { version: '1', nodes: [], links: [] },
    products: [],
    scenes: [],
  })
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  delete files['presentation.json']
  await expect(readProjectZip(zipSync(files))).rejects.toThrow('Missing presentation.json')
  files['presentation.json'] = new TextEncoder().encode(
    JSON.stringify({ nodeGeometry: [{ nodeId: 'missing', position: { x: 1, y: 2 } }] }),
  )
  await expect(readProjectZip(zipSync(files))).rejects.toThrow('Missing presentation node')
})

test('rejects v1 archives instead of silently accepting geometry inside topology', async () => {
  const blob = await writeProjectZip({
    name: 'Legacy',
    diagram: { version: '1', nodes: [], links: [] },
    products: [],
    scenes: [],
  })
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
  expect(manifest.version).toBe(2)
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify({ ...manifest, version: 1 }))
  await expect(readProjectZip(zipSync(files))).rejects.toThrow('Unsupported project version: 1')
})

function pngBlob(): Blob {
  // 1x1 transparent PNG.
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ])
  return new Blob([bytes], { type: 'image/png' })
}

test('imported blob URLs survive the load pipeline', async () => {
  // Regression: a stale `assetStore.reset()` after `readProjectZip`
  // would revoke the blobs the reader just registered, leaving image
  // fields pointing at dead `blob:` URLs after import.
  const revoked = new Set<string>()
  globalThis.URL.createObjectURL = ((b: object) => {
    const u = `blob:test/${Math.random()}`
    revokedTracking.set(b, u)
    return u
  }) as typeof URL.createObjectURL
  globalThis.URL.revokeObjectURL = (u: string) => {
    revoked.add(u)
  }

  assetStore.reset()
  const entry = await assetStore.put(pngBlob(), 'png')
  const blob = await writeProjectZip({
    name: 'T',
    diagram: { version: '1', nodes: [], links: [], subgraphs: [] },
    products: [],
    scenes: [
      {
        id: 's1',
        name: 'F1',
        nodePlacements: [],
        background: { src: entry.url, width: 1, height: 1 },
      },
    ],
  })

  // Simulate the import path: reset → read → loadProject (we just
  // call read here; loadProject itself is plain state mutation).
  assetStore.reset()
  const loaded = await readProjectZip(blob)

  const sceneSrc = loaded.scenes?.[0]?.background?.src ?? ''
  expect(sceneSrc.startsWith('blob:')).toBe(true)
  expect(revoked.has(sceneSrc)).toBe(false)
})

const revokedTracking = new Map<object, string>()

test('round-trips a project through .neted', async () => {
  // URL.createObjectURL polyfill — Bun does not provide it.
  const urls = new Map<object, string>()
  let n = 0
  globalThis.URL.createObjectURL = (b: object) => {
    const u = `blob:test/${++n}`
    urls.set(b, u)
    return u
  }
  globalThis.URL.revokeObjectURL = () => {}

  assetStore.reset()

  // Register an image so blob URL ↔ hash mapping has a real entry.
  const entry = await assetStore.put(pngBlob(), 'png')
  expect(entry.hash).toMatch(/^[a-f0-9]+$/)

  const sceneBg = entry.url
  const productIcon = entry.url

  const diagram: NetworkGraph = {
    version: '1',
    nodes: [
      {
        id: 'n1',
        label: 'sw1',
        spec: { kind: 'hardware', vendor: 'cisco', model: 'c9300', icon: productIcon },
      } as Node,
    ],
    links: [],
    subgraphs: [],
  }
  const products: Product[] = [
    {
      id: 'p1',
      kind: 'device',
      icon: productIcon,
      spec: { kind: 'hardware', vendor: 'cisco', model: 'c9300' },
    },
  ]
  const scenes: Scene[] = [
    {
      id: 'scene1',
      name: 'Floor 1',
      nodePlacements: [],
      background: { src: sceneBg, width: 100, height: 100 },
    },
  ]

  const blob = await writeProjectZip({ name: 'Test', diagram, products, scenes })
  expect(blob.size).toBeGreaterThan(0)

  // Drop everything (simulate switching projects), then re-import.
  assetStore.reset()
  const loaded = await readProjectZip(blob)

  expect(loaded.name).toBe('Test')
  expect(loaded.scenes?.length).toBe(1)
  expect(loaded.scenes?.[0]?.background?.src.startsWith('blob:')).toBe(true)
  expect(loaded.products[0]?.icon?.startsWith('blob:')).toBe(true)
  expect(loaded.diagram.nodes[0]?.spec?.icon?.startsWith('blob:')).toBe(true)

  // Re-export round-trips to the same hash (content-addressed).
  const blob2 = await writeProjectZip({
    name: loaded.name,
    diagram: loaded.diagram,
    products: loaded.products,
    scenes: loaded.scenes ?? [],
  })
  // Inflate just to peek at the JSON refs.
  const { unzipSync } = await import('fflate')
  const files = unzipSync(new Uint8Array(await blob2.arrayBuffer()))
  const productsJson = JSON.parse(new TextDecoder().decode(files['products.json']))
  expect(productsJson[0].icon).toMatch(/^asset:[a-f0-9]+\.png$/)
  const sceneJson = JSON.parse(new TextDecoder().decode(files['scenes/scene1.json']))
  expect(sceneJson.background.src).toMatch(/^asset:[a-f0-9]+\.png$/)
  // Same content → same hash.
  expect(productsJson[0].icon).toBe(sceneJson.background.src)
})

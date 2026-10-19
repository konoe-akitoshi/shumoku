// Smoke test for the .neted zip writer/reader. Run with:
//   bunx vitest run src/lib/persistence/smoke.test.ts
// Asserts that an export round-trips through import without losing
// data, including content-addressed image assets.

import { fromNetworkGraph, type NetworkGraph, type Node, toNetworkGraph } from '@shumoku/core'
import { renderGraphToSvg } from '@shumoku/renderer-svg'
import { unzipSync, zipSync } from 'fflate'
import { expect, test } from 'vitest'
import { assetStore } from '../state/assets.svelte'
import type { Product, Scene } from '../types'
import { readProjectZip } from './reader'
import { writeProjectZip } from './writer'

test('round-trips appearance through ZIP and SVG, keeping it out of the configuration', async () => {
  const diagram: NetworkGraph = {
    version: '1',
    settings: {
      direction: 'LR',
      theme: 'dark',
      canvas: { width: 800, height: 600, fit: true },
      legend: false,
    },
    nodes: [
      {
        id: 'a',
        label: 'A',
        parent: 'g',
        shape: 'cylinder',
        style: { fill: '#123456', textColor: '#654321' },
        ports: [
          { id: 'eth0', label: 'eth0', connectors: [], placement: { side: 'left', order: 0 } },
        ],
      },
      { id: 'b', label: 'B', parent: 'g' },
    ],
    links: [
      {
        id: 'l',
        from: { node: 'a', port: 'eth0' },
        to: { node: 'b', port: 'eth1' },
        style: { stroke: '#234567', strokeWidth: 3 },
      },
    ],
    subgraphs: [
      {
        id: 'g',
        label: 'Group',
        direction: 'BT',
        style: { fill: '#345678', stroke: '#456789', padding: 24 },
        bounds: { x: -999, y: -999, width: 999, height: 999 },
      },
    ],
  }
  const before = await renderGraphToSvg(diagram)
  const model = fromNetworkGraph(diagram)
  const blob = await writeProjectZip({ name: 'Appearance', model, products: [], scenes: [] })
  const loaded = await readProjectZip(blob)
  const graph = toNetworkGraph(loaded.model)
  const after = await renderGraphToSvg(graph)
  expect(after).toEqual(before)
  for (const color of ['#123456', '#234567', '#345678', '#456789']) expect(after).toContain(color)
  expect(graph.settings).toEqual(diagram.settings)
  expect(graph.subgraphs?.[0]).not.toHaveProperty('bounds')
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  // The configuration holds no appearance; the drawing layer holds all of it.
  const yaml = new TextDecoder().decode(files['network.yaml'])
  for (const word of ['style', 'shape', 'placement', 'settings', 'direction', 'bounds'])
    expect(yaml).not.toContain(word)
  const layers = JSON.parse(new TextDecoder().decode(files['layers.json']))
  expect(layers.drawing.nodes.a).toMatchObject({
    shape: 'cylinder',
    style: { fill: '#123456' },
    ports: { eth0: { placement: { side: 'left', order: 0 } } },
  })
  expect(layers.drawing.links.l.style).toEqual({ stroke: '#234567', strokeWidth: 3 })
  expect(layers.drawing.groups.g).toMatchObject({ direction: 'BT' })
  expect(layers.drawing.groups.g).not.toHaveProperty('bounds')
  expect(layers.drawing.settings).toEqual(diagram.settings)
})

test('keeps the configuration as YAML and geometry in the drawing layer across moves', async () => {
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
  const input = { name: 'Geometry', model: fromNetworkGraph(diagram), products: [], scenes: [] }
  const before = structuredClone(input)
  const blob = await writeProjectZip(input)
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const yaml = new TextDecoder().decode(files['network.yaml'])
  expect(yaml).not.toContain('position')
  const layers = JSON.parse(new TextDecoder().decode(files['layers.json']))
  expect(layers.drawing.nodes.a).toEqual({
    position: { x: 100, y: 200 },
    size: { width: 200, height: 80 },
  })
  const loaded = await readProjectZip(blob)
  const graph = toNetworkGraph(loaded.model)
  expect(graph.nodes[0]).toMatchObject({
    id: 'a',
    label: 'A',
    position: { x: 100, y: 200 },
    metadata: { building: 'A' },
  })
  expect(graph.links[0]).toMatchObject({
    id: 'uplink',
    from: { node: 'a', port: 'eth0' },
    to: { node: 'b', port: 'eth1' },
  })
  const drawing = loaded.model.drawing ?? {}
  const moved = {
    ...loaded.model,
    drawing: { ...drawing, nodes: { ...drawing.nodes, a: { position: { x: 800, y: 600 } } } },
  }
  const movedZip = await writeProjectZip({ ...loaded, model: moved, scenes: loaded.scenes ?? [] })
  const movedFiles = unzipSync(new Uint8Array(await movedZip.arrayBuffer()))
  // Moving a node changes the drawing, never the configuration.
  expect(new TextDecoder().decode(movedFiles['network.yaml'])).toEqual(yaml)
  const reread = toNetworkGraph((await readProjectZip(movedZip)).model)
  expect(reread.nodes[0]?.position).toEqual({ x: 800, y: 600 })
  expect(input).toEqual(before)
})

test('rejects an archive missing its configuration or its layers', async () => {
  const blob = await writeProjectZip({
    name: 'T',
    model: { config: { nodes: [], links: [] } },
    products: [],
    scenes: [],
  })
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const withoutYaml = { ...files }
  delete withoutYaml['network.yaml']
  await expect(readProjectZip(zipSync(withoutYaml))).rejects.toThrow('Missing network.yaml')
  const withoutLayers = { ...files }
  delete withoutLayers['layers.json']
  await expect(readProjectZip(zipSync(withoutLayers))).rejects.toThrow('Missing layers.json')
})

test('still reads a format v4 archive, which kept topology and presentation apart', async () => {
  const enc = new TextEncoder()
  const archive = zipSync({
    'manifest.json': enc.encode(
      JSON.stringify({ format: 'neted', version: 4, name: 'Old', sceneIds: [] }),
    ),
    'diagram.json': enc.encode(
      JSON.stringify({
        version: '1',
        nodes: [{ id: 'a', label: 'A' }],
        links: [],
      }),
    ),
    'presentation.json': enc.encode(
      JSON.stringify({
        nodes: [{ nodeId: 'a', position: { x: 1, y: 2 } }],
        links: [],
        subgraphs: [],
      }),
    ),
    'products.json': enc.encode('[]'),
  })
  const loaded = await readProjectZip(archive)
  expect(loaded.model.config.nodes).toEqual([{ id: 'a', label: 'A' }])
  expect(loaded.model.drawing?.nodes?.a).toEqual({ position: { x: 1, y: 2 } })
})

test.each([1, 2, 3])('rejects v%i archives', async (version) => {
  const blob = await writeProjectZip({
    name: 'Legacy',
    model: { config: { nodes: [], links: [] } },
    products: [],
    scenes: [],
  })
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
  expect(manifest.version).toBe(5)
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify({ ...manifest, version }))
  await expect(readProjectZip(zipSync(files))).rejects.toThrow(
    `Unsupported project version: ${version}`,
  )
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
    model: { config: { nodes: [], links: [] } },
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

  // Covers the reader's asset boundary. The Editor load pipeline
  // is verified separately; this test does not invoke loadProject.
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

  const blob = await writeProjectZip({
    name: 'Test',
    model: fromNetworkGraph(diagram),
    products,
    scenes,
  })
  expect(blob.size).toBeGreaterThan(0)

  // Drop everything (simulate switching projects), then re-import.
  assetStore.reset()
  const loaded = await readProjectZip(blob)

  expect(loaded.name).toBe('Test')
  expect(loaded.scenes?.length).toBe(1)
  expect(loaded.scenes?.[0]?.background?.src.startsWith('blob:')).toBe(true)
  expect(loaded.products[0]?.icon?.startsWith('blob:')).toBe(true)
  expect(loaded.model.drawing?.nodes?.n1?.icon?.startsWith('blob:')).toBe(true)

  // Re-export round-trips to the same hash (content-addressed).
  const blob2 = await writeProjectZip({
    name: loaded.name,
    model: loaded.model,
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

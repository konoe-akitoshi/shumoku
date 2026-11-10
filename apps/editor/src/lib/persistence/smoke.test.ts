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
        ports: [{ id: 'eth0', label: 'eth0', connectors: ['sfp+'], speed: '10G' }],
      },
      { id: 'b', label: 'B', parent: 'g' },
    ],
    links: [
      {
        id: 'l',
        from: { node: 'a', port: 'eth0', plug: { cage: 'sfp+' } },
        to: { node: 'b', port: 'eth1' },
        style: { stroke: '#234567', strokeWidth: 3 },
      },
    ],
    subgraphs: [
      {
        id: 'g',
        label: 'Group',
        style: { fill: '#345678', stroke: '#456789', padding: 24 },
      },
    ],
  }
  const before = await renderGraphToSvg(diagram)
  const model = fromNetworkGraph(diagram).model
  const blob = await writeProjectZip({ name: 'Appearance', model, products: [], scenes: [] })
  const loaded = await readProjectZip(blob)
  const graph = toNetworkGraph(loaded.model)
  const after = await renderGraphToSvg(graph)
  expect(after).toEqual(before)
  for (const color of ['#123456', '#234567', '#345678', '#456789']) expect(after).toContain(color)
  expect(graph.settings).toEqual(diagram.settings)
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  // The configuration holds the network, ports and plugs included, and no appearance; the
  // drawing holds all of it.
  const yaml = new TextDecoder().decode(files['network.yaml'])
  for (const word of ['style', 'shape', 'settings']) expect(yaml).not.toContain(word)
  expect(yaml).toContain('connectors')
  expect(yaml).toContain('cage: sfp+')
  const drawing = JSON.parse(new TextDecoder().decode(files['drawing.json']))
  expect(drawing.nodes.a).toEqual({
    shape: 'cylinder',
    style: { fill: '#123456', textColor: '#654321' },
  })
  expect(drawing.links.l.style).toEqual({ stroke: '#234567', strokeWidth: 3 })
  expect(drawing.groups.g).toEqual({ style: { fill: '#345678', stroke: '#456789', padding: 24 } })
  expect(drawing.settings).toEqual(diagram.settings)
  expect(files['layers.json']).toBeUndefined()
})

test('rejects an archive missing its configuration or its drawing', async () => {
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
  const withoutDrawing = { ...files }
  delete withoutDrawing['drawing.json']
  await expect(readProjectZip(zipSync(withoutDrawing))).rejects.toThrow('Missing drawing.json')
})

test('still reads a format v5 archive, lifting its layers into the configuration and scenes', async () => {
  const enc = new TextEncoder()
  const archive = zipSync({
    'manifest.json': enc.encode(
      JSON.stringify({ format: 'neted', version: 5, name: 'Layered', sceneIds: ['s1'] }),
    ),
    'network.yaml': enc.encode(
      [
        'nodes:',
        '  - { id: a, label: A }',
        '  - { id: b }',
        'links:',
        '  - { id: l, endpoints: [{ node: a, port: eth0 }, { node: b }], cable: cat6 }',
        '',
      ].join('\n'),
    ),
    'layers.json': enc.encode(
      JSON.stringify({
        observation: {
          nodes: { a: { metadata: { displayScale: 2 } } },
          links: { l: { metadata: { wireScale: 3 } } },
        },
        design: {
          nodes: {
            a: {
              productId: 'lib-1',
              spec: { kind: 'compute', platform: 'esxi' },
              ports: { eth0: { label: 'Gi0', connectors: ['rj45'], poe: true, disabled: false } },
            },
          },
          links: {
            l: {
              via: ['out-1'],
              bends: [{ id: 'bd', x: 5, y: 6, afterIndex: -1 }],
              ends: [{ plug: { cage: 'rj45' } }, {}],
              cable: { medium: 'twisted-pair', category: 'cat6', productId: 'cab-1' },
            },
          },
          terminations: [
            {
              id: 'out-1',
              label: 'Outlet',
              role: 'outlet',
              position: { x: 7, y: 8 },
              metadata: { autoFor: 'l:eps' },
            },
          ],
        },
        drawing: {
          nodes: { a: { shape: 'rect', position: { x: 1, y: 2 }, size: { width: 3, height: 4 } } },
          groups: {},
        },
      }),
    ),
    'products.json': enc.encode('[]'),
    'scenes/s1.json': enc.encode(
      JSON.stringify({
        id: 's1',
        name: 'Floor',
        nodePlacements: [{ nodeId: 'a', position: { x: 10, y: 10 } }],
      }),
    ),
  })
  const loaded = await readProjectZip(archive)
  expect(loaded.model).toEqual({
    config: {
      nodes: [
        {
          id: 'a',
          label: 'A',
          productId: 'lib-1',
          platform: 'esxi',
          ports: [{ name: 'eth0', label: 'Gi0', connectors: ['rj45'], poe: true }],
        },
        { id: 'b' },
      ],
      links: [
        {
          id: 'l',
          endpoints: [{ node: 'a', port: 'eth0', plug: { cage: 'rj45' } }, { node: 'b' }],
          cable: { type: 'cat6', productId: 'cab-1' },
          via: ['out-1'],
        },
      ],
      terminations: [{ id: 'out-1', label: 'Outlet', role: 'outlet', autoFor: 'l:eps' }],
    },
    drawing: { nodes: { a: { shape: 'rect' } } },
  })
  expect(loaded.scenes?.[0]).toEqual({
    id: 's1',
    name: 'Floor',
    nodePlacements: [
      { nodeId: 'a', position: { x: 10, y: 10 }, scale: 2 },
      { nodeId: 'out-1', position: { x: 7, y: 8 } },
    ],
    wires: [{ linkId: 'l', bends: [{ id: 'bd', x: 5, y: 6, afterIndex: -1 }], wireScale: 3 }],
  })
})

test('still reads a format v4 archive, which kept topology and presentation apart', async () => {
  const enc = new TextEncoder()
  const archive = zipSync({
    'manifest.json': enc.encode(
      JSON.stringify({ format: 'neted', version: 4, name: 'Old', sceneIds: ['s1'] }),
    ),
    'diagram.json': enc.encode(
      JSON.stringify({
        version: '1',
        nodes: [
          { id: 'a', label: 'A', productId: 'lib-1' },
          { id: 'b', label: 'B' },
          { id: 'eps-1', label: 'EPS', termination: { role: 'eps' } },
          { id: 'bend-1', label: '', termination: { role: 'bend' } },
        ],
        links: [
          {
            id: 'l',
            from: { node: 'a', port: 'p' },
            to: { node: 'b', port: 'q' },
            via: ['bend-1', 'eps-1'],
          },
        ],
      }),
    ),
    'presentation.json': enc.encode(
      JSON.stringify({
        nodes: [{ nodeId: 'a', position: { x: 1, y: 2 }, shape: 'circle' }],
        links: [],
        subgraphs: [],
      }),
    ),
    'products.json': enc.encode('[]'),
    'scenes/s1.json': enc.encode(
      JSON.stringify({
        id: 's1',
        name: 'Floor',
        placementOrigin: 'center',
        nodePlacements: [
          { nodeId: 'eps-1', position: { x: 30, y: 40 } },
          { nodeId: 'bend-1', position: { x: 5, y: 6 } },
        ],
      }),
    ),
  })
  const loaded = await readProjectZip(archive)
  expect(loaded.model).toEqual({
    config: {
      nodes: [
        { id: 'a', label: 'A', productId: 'lib-1' },
        { id: 'b', label: 'B' },
      ],
      links: [
        {
          id: 'l',
          endpoints: [
            { node: 'a', port: 'p' },
            { node: 'b', port: 'q' },
          ],
          via: ['eps-1'],
        },
      ],
      terminations: [{ id: 'eps-1', label: 'EPS', role: 'eps' }],
    },
    drawing: { nodes: { a: { shape: 'circle' } } },
  })
  expect(loaded.scenes?.[0]).toEqual({
    id: 's1',
    name: 'Floor',
    placementOrigin: 'center',
    nodePlacements: [{ nodeId: 'eps-1', position: { x: 30, y: 40 } }],
    wires: [{ linkId: 'l', bends: [{ id: 'bend-1', x: 5, y: 6, afterIndex: -1 }] }],
  })
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
  expect(manifest.version).toBe(6)
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
    model: fromNetworkGraph(diagram).model,
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

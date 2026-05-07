// serializeEntity / rehydrateEntity round-trip tests. These are the
// boundary that keeps blob URLs out of IDB rows / .neted.zip JSON.
// Ref the bug "imported blob URLs survive the load pipeline" (PR #173)
// for why a regression here breaks images after reload.

import { expect, test } from 'vitest'
import { assetStore, rehydrateEntity, serializeEntity } from './assets.svelte'

function pngBlob(): Blob {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ])
  return new Blob([bytes], { type: 'image/png' })
}

function withFakeUrl(): () => void {
  let n = 0
  const map = new Map<object, string>()
  const origCreate = globalThis.URL.createObjectURL
  const origRevoke = globalThis.URL.revokeObjectURL
  globalThis.URL.createObjectURL = ((b: object) => {
    const u = `blob:test/${++n}`
    map.set(b, u)
    return u
  }) as typeof URL.createObjectURL
  globalThis.URL.revokeObjectURL = () => {}
  return () => {
    globalThis.URL.createObjectURL = origCreate
    globalThis.URL.revokeObjectURL = origRevoke
  }
}

test('serializeEntity replaces blob URLs in nested fields with asset: refs', async () => {
  const restore = withFakeUrl()
  try {
    assetStore.reset()
    const entry = await assetStore.put(pngBlob(), 'png')

    const scene = {
      id: 's1',
      name: 'F1',
      background: { src: entry.url, width: 100, height: 100 },
      nodePlacements: [],
    }
    const serialized = serializeEntity(scene)
    expect(serialized.background?.src).toBe(`asset:${entry.hash}.png`)
    // Original is not mutated.
    expect(scene.background.src).toMatch(/^blob:/)
  } finally {
    restore()
  }
})

test('rehydrateEntity restores blob URLs from asset: refs', async () => {
  const restore = withFakeUrl()
  try {
    assetStore.reset()
    const entry = await assetStore.put(pngBlob(), 'png')

    const stored = {
      id: 's1',
      background: { src: `asset:${entry.hash}.png`, width: 100, height: 100 },
    }
    const live = rehydrateEntity(stored)
    expect(live.background.src).toBe(entry.url)
  } finally {
    restore()
  }
})

test('round-trip is idempotent for non-image strings', () => {
  const obj = {
    label: 'switch-1',
    metadata: { vendor: 'cisco' },
    refs: ['n-abc', 'http://example.com/icon.svg'],
    nested: { svg: '<svg xmlns="...">...</svg>' },
  }
  expect(rehydrateEntity(serializeEntity(obj))).toEqual(obj)
})

test('round-trip preserves arrays of mixed scalar / object values', async () => {
  const restore = withFakeUrl()
  try {
    assetStore.reset()
    const entry = await assetStore.put(pngBlob(), 'png')
    const product = {
      id: 'p1',
      kind: 'device',
      icon: entry.url,
      ports: [{ id: 'pt1', label: 'eth0' }],
    }
    const serialized = serializeEntity(product)
    expect(serialized.icon).toBe(`asset:${entry.hash}.png`)
    expect(serialized.ports).toEqual(product.ports)
    const back = rehydrateEntity(serialized)
    expect(back.icon).toBe(entry.url)
    expect(back.ports).toEqual(product.ports)
  } finally {
    restore()
  }
})

test('asset ref to a hash that is not in the store passes through untouched', () => {
  assetStore.reset()
  const obj = { icon: 'asset:deadbeef.png' }
  // Without the asset registered, rehydrate falls back to the ref
  // string — caller code can decide how to handle the miss.
  expect(rehydrateEntity(obj).icon).toBe('asset:deadbeef.png')
})

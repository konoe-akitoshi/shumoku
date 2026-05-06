// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { type Zippable, zipSync } from 'fflate'
import { assetStore, toSerializedRef } from '../state/assets.svelte'
import type { NetedProject, Product, Scene } from '../types'

// Zip writer for `.neted` projects (format v1).
//
// Layout:
//   manifest.json     { format, version, name, settings, sceneIds }
//   diagram.json      NetworkGraph
//   products.json     Product[]
//   scenes/<id>.json  Scene
//   assets/<hash>.<ext>
//
// Image fields (Scene.background.src, Product.icon, Node.spec.icon)
// hold runtime URLs in state. `toSerializedRef()` turns blob URLs
// back into `asset:<hash>.<ext>` so the JSON is content-addressed,
// then the writer pulls each referenced asset out of `assetStore`
// and embeds the bytes under `assets/`.

interface Manifest {
  format: 'neted'
  version: 1
  name: string
  settings?: Record<string, unknown>
  /** Order of scenes (the on-disk filenames are id-based, this preserves UI ordering). */
  sceneIds: string[]
  createdAt?: string
  updatedAt: string
}

const ENC = new TextEncoder()

function jsonBytes(value: unknown): Uint8Array {
  return ENC.encode(`${JSON.stringify(value, null, 2)}\n`)
}

/** Serialize Product, replacing runtime icon URLs with `asset:` refs. */
function serializeProduct(p: Product): Product {
  return p.icon ? { ...p, icon: toSerializedRef(p.icon) } : p
}

/** Serialize Scene, replacing background URL with an `asset:` ref. */
function serializeScene(s: Scene): Scene {
  if (!s.background) return s
  return { ...s, background: { ...s.background, src: toSerializedRef(s.background.src) } }
}

/** Serialize NetworkGraph, replacing Node.spec.icon URLs with `asset:` refs. */
function serializeDiagram(diagram: NetedProject['diagram']): NetedProject['diagram'] {
  return {
    ...diagram,
    nodes: diagram.nodes.map((n) => {
      const icon = n.spec?.icon
      if (!icon || !n.spec) return n
      const serialized = toSerializedRef(icon)
      if (serialized === icon) return n
      return { ...n, spec: { ...n.spec, icon: serialized } }
    }),
  }
}

/**
 * Walk the serialized JSON tree for `asset:` refs so we know which
 * assets to embed. Strings only — that's where refs live.
 */
function collectAssetHashes(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    if (value.startsWith('asset:')) {
      const m = /^asset:([a-f0-9]+)\./.exec(value)
      if (m?.[1]) out.add(m[1])
    }
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectAssetHashes(v, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectAssetHashes(v, out)
  }
}

export interface WriteProjectInput {
  name: string
  settings?: Record<string, unknown>
  diagram: NetedProject['diagram']
  products: Product[]
  scenes: Scene[]
}

/**
 * Build a `.neted` zip blob from the current project state. The
 * caller is responsible for triggering a download; this function
 * just produces the bytes.
 */
export async function writeProjectZip(input: WriteProjectInput): Promise<Blob> {
  const diagram = serializeDiagram(input.diagram)
  const products = input.products.map(serializeProduct)
  const scenes = input.scenes.map(serializeScene)

  // Find every `asset:` ref across all serialized JSON, then embed
  // only the assets that are actually referenced. Orphaned blobs
  // hanging in the AssetStore from since-undone uploads stay out.
  const used = new Set<string>()
  collectAssetHashes(diagram, used)
  collectAssetHashes(products, used)
  for (const s of scenes) collectAssetHashes(s, used)

  const manifest: Manifest = {
    format: 'neted',
    version: 1,
    name: input.name,
    settings: input.settings,
    sceneIds: scenes.map((s) => s.id),
    updatedAt: new Date().toISOString(),
  }

  const zipInput: Zippable = {
    'manifest.json': jsonBytes(manifest),
    'diagram.json': jsonBytes(diagram),
    'products.json': jsonBytes(products),
  }
  for (const s of scenes) {
    zipInput[`scenes/${s.id}.json`] = jsonBytes(s)
  }
  for (const hash of used) {
    const entry = assetStore.byHash(hash)
    if (!entry) continue // Stale ref — silently skip; reader treats as missing.
    const bytes = new Uint8Array(await entry.blob.arrayBuffer())
    zipInput[`assets/${entry.hash}.${entry.ext}`] = bytes
  }

  const zipped = zipSync(zipInput, { level: 6 })
  // Cast to a known ArrayBuffer-backed array so the Blob ctor's
  // strict BlobPart typing accepts the chunk on lib.dom builds where
  // Uint8Array is generic over the buffer kind.
  return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

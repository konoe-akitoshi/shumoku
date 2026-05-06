// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { type Zippable, zipSync } from 'fflate'
import { type AssetEntry, assetStore, serializeEntity } from '../state/assets.svelte'
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
  /**
   * Source of asset bytes for the `assets/<hash>.<ext>` entries.
   * Defaults to the in-memory `AssetStore` so old call sites keep
   * working; the DB-backed export path passes its own resolver
   * built from the per-project asset rows.
   */
  resolveAsset?: (hash: string) => AssetEntry | undefined
}

/**
 * Build a `.neted` zip blob from a project payload. The caller is
 * responsible for triggering a download; this function just
 * produces the bytes.
 *
 * Inputs may already hold `asset:` refs (DB read path) or raw
 * blob URLs (legacy state path); `serializeEntity` is idempotent
 * for already-serialized values.
 */
export async function writeProjectZip(input: WriteProjectInput): Promise<Blob> {
  const diagram = serializeEntity(input.diagram)
  const products = input.products.map((p) => serializeEntity(p))
  const scenes = input.scenes.map((s) => serializeEntity(s))

  // Find every `asset:` ref across all serialized JSON, then embed
  // only the assets that are actually referenced. Orphaned blobs
  // (e.g. since-undone uploads still in the AssetStore) stay out.
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
  const resolveAsset = input.resolveAsset ?? ((hash) => assetStore.byHash(hash))
  for (const hash of used) {
    const entry = resolveAsset(hash)
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

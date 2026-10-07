// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import {
  combineNetworkDocument,
  type NetworkPresentation,
  type NetworkTopology,
} from '@shumoku/core'
import { unzipSync } from 'fflate'
import { assetStore, fromSerializedRef } from '../state/assets.svelte'
import { NETED_FORMAT_VERSION, type NetedProject, type Product, type Scene } from '../types'

// Zip reader for `.neted` projects (format v2). See writer.ts for
// the on-disk layout. Mirrors the writer in two reverse passes:
//
//   1. Extract `assets/<hash>.<ext>` into the AssetStore so each
//      asset gets a session-scoped blob URL.
//   2. Walk the parsed JSON for `asset:<hash>.<ext>` refs and
//      replace them with the now-live blob URLs. State leaving this
//      function holds runtime URLs only — no caller has to know.

const DEC = new TextDecoder()

interface Manifest {
  format?: string
  version?: number
  name?: string
  settings?: Record<string, unknown>
  sceneIds?: string[]
}

function readJson<T>(bytes: Uint8Array | undefined, label: string): T {
  if (!bytes) throw new Error(`Missing ${label} in project archive`)
  return JSON.parse(DEC.decode(bytes)) as T
}

/**
 * Replace `asset:` ref strings inside a parsed JSON tree with the
 * now-live blob URL from the AssetStore, without changing the parsed input.
 */
function rehydrateRefs(value: unknown): unknown {
  if (typeof value === 'string') return fromSerializedRef(value)
  if (Array.isArray(value)) return value.map(rehydrateRefs)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, rehydrateRefs(entry)]),
    )
  }
  return value
}

/** Parse a `.neted` zip blob into an in-memory NetedProject. */
export async function readProjectZip(
  input: Blob | ArrayBuffer | Uint8Array,
): Promise<NetedProject> {
  const bytes =
    input instanceof Uint8Array
      ? input
      : new Uint8Array(input instanceof Blob ? await input.arrayBuffer() : input)
  const files = unzipSync(bytes)

  // Pass 1 — register every asset so refs can resolve when we
  // rehydrate the JSON. We do this before parsing so order within
  // the zip doesn't matter.
  for (const path of Object.keys(files)) {
    if (!path.startsWith('assets/')) continue
    const m = /^assets\/([a-f0-9]+)\.([a-z0-9]+)$/.exec(path)
    if (!m?.[1] || !m[2]) continue
    const fileBytes = files[path]
    if (!fileBytes) continue
    const blob = new Blob([fileBytes as Uint8Array<ArrayBuffer>])
    assetStore.putWithHash(m[1], m[2], blob)
  }

  const manifest = readJson<Manifest>(files['manifest.json'], 'manifest.json')
  if (manifest.format !== 'neted') {
    throw new Error(`Unsupported project format: ${manifest.format ?? '(missing)'}`)
  }
  if (manifest.version !== NETED_FORMAT_VERSION) {
    throw new Error(`Unsupported project version: ${manifest.version ?? '(missing)'}`)
  }

  const topology = rehydrateRefs(
    readJson<NetworkTopology>(files['diagram.json'], 'diagram.json'),
  ) as NetworkTopology
  const presentation = readJson<NetworkPresentation>(
    files['presentation.json'],
    'presentation.json',
  )
  const diagram = combineNetworkDocument({ schemaVersion: '1', topology, presentation })
  const products = rehydrateRefs(
    readJson<Product[]>(files['products.json'], 'products.json'),
  ) as Product[]

  // Honour manifest.sceneIds for ordering; fall back to alphabetical
  // if a scene file is in the zip but not listed (defensive).
  const sceneFiles = Object.keys(files).filter((p) => /^scenes\/[^/]+\.json$/.test(p))
  const idsFromFiles = sceneFiles
    .map((p) => /^scenes\/(.+)\.json$/.exec(p)?.[1])
    .filter((id): id is string => !!id)
  const orderedIds = (manifest.sceneIds ?? []).filter((id) => idsFromFiles.includes(id))
  for (const id of idsFromFiles.sort()) {
    if (!orderedIds.includes(id)) orderedIds.push(id)
  }
  const scenes = orderedIds.map((id) => {
    const scene = readJson<Scene>(files[`scenes/${id}.json`], `scenes/${id}.json`)
    return rehydrateRefs(scene) as Scene
  })

  return {
    version: NETED_FORMAT_VERSION,
    name: manifest.name ?? 'Project',
    settings: manifest.settings,
    products,
    diagram,
    scenes,
  }
}

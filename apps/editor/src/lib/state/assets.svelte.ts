// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Session-scoped binary asset store. Holds image blobs (scene
// backgrounds, raster product icons) keyed by content hash so that:
//
//   - state always carries a runtime-displayable URL (blob:) — render
//     paths don't need to learn an `asset:` indirection
//   - the zip writer can walk state for blob URLs, recover the hash,
//     and emit content-addressed `asset:<hash>.<ext>` refs
//   - the zip reader extracts assets/<hash>.<ext>, registers each
//     under its hash → blob URL, and rewrites JSON refs in place
//
// Refs in serialized form: `asset:<hash>.<ext>` (16 hex chars of
// SHA-256 + an inferred extension). `asset:` is the disk format —
// state never holds it.

const ASSET_REF_RE = /^asset:([a-f0-9]+)\.([a-z0-9]+)$/

export interface AssetEntry {
  hash: string
  ext: string
  blob: Blob
  /** Object URL valid for the lifetime of the current session. */
  url: string
}

interface AssetStoreState {
  byHash: Map<string, AssetEntry>
  byUrl: Map<string, string> // blob URL → hash
}

const state: AssetStoreState = {
  byHash: new Map(),
  byUrl: new Map(),
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  // 16 hex chars (64 bits) is plenty for a single project's worth of
  // assets — collision probability stays well under 1 in 10^9 even
  // with millions of distinct images. Full hash kept for reference
  // but truncated for filenames.
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  const arr = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < 8; i++) out += arr[i]?.toString(16).padStart(2, '0') ?? '00'
  return out
}

function inferExt(file: File | Blob, fallback = 'bin'): string {
  if (file instanceof File) {
    const m = /\.([a-z0-9]+)$/i.exec(file.name)
    if (m) return m[1]?.toLowerCase() ?? fallback
  }
  const t = file.type
  if (!t) return fallback
  if (t === 'image/svg+xml') return 'svg'
  if (t === 'image/png') return 'png'
  if (t === 'image/jpeg') return 'jpg'
  if (t === 'image/gif') return 'gif'
  if (t === 'image/webp') return 'webp'
  if (t.startsWith('image/')) return t.slice('image/'.length)
  return fallback
}

export const assetStore = {
  /**
   * Hash a blob, register it (idempotent on hash collision), and
   * return the entry. Use the entry's `url` as the in-state value.
   */
  async put(blob: Blob, ext?: string): Promise<AssetEntry> {
    const buf = await blob.arrayBuffer()
    const hash = await sha256Hex(buf)
    const existing = state.byHash.get(hash)
    if (existing) return existing
    const finalExt = ext ?? inferExt(blob)
    const url = URL.createObjectURL(blob)
    const entry: AssetEntry = { hash, ext: finalExt, blob, url }
    state.byHash.set(hash, entry)
    state.byUrl.set(url, hash)
    return entry
  },
  /**
   * Read a user-selected file into the store. SVGs are *not* asset-
   * ified — they're small text and inline content fits the diagram's
   * snapshot model better. Returns the value to put in state:
   *   - SVG: the raw `<svg>...` text
   *   - else: the blob URL of the registered asset
   */
  async putUserImage(file: File): Promise<string> {
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      return await file.text()
    }
    const entry = await assetStore.put(file)
    return entry.url
  },
  /**
   * Register a blob already extracted from a zip under a known hash.
   * Used by the reader so the in-zip `asset:<hash>` refs round-trip
   * back to the same hash on re-export.
   */
  putWithHash(hash: string, ext: string, blob: Blob): AssetEntry {
    const existing = state.byHash.get(hash)
    if (existing) return existing
    const url = URL.createObjectURL(blob)
    const entry: AssetEntry = { hash, ext, blob, url }
    state.byHash.set(hash, entry)
    state.byUrl.set(url, hash)
    return entry
  },
  /** Look up an entry by its blob URL. */
  byUrl(url: string): AssetEntry | undefined {
    const hash = state.byUrl.get(url)
    return hash ? state.byHash.get(hash) : undefined
  },
  byHash(hash: string): AssetEntry | undefined {
    return state.byHash.get(hash)
  },
  /**
   * Drop everything and revoke object URLs. Called on project
   * switch — there's no cross-project asset sharing.
   */
  reset(): void {
    for (const entry of state.byHash.values()) URL.revokeObjectURL(entry.url)
    state.byHash.clear()
    state.byUrl.clear()
  },
  list(): AssetEntry[] {
    return [...state.byHash.values()]
  },
}

/** Parse `asset:<hash>.<ext>` → its parts. Returns null otherwise. */
export function parseAssetRef(ref: string): { hash: string; ext: string } | null {
  const m = ASSET_REF_RE.exec(ref)
  if (!m || !m[1] || !m[2]) return null
  return { hash: m[1], ext: m[2] }
}

/** Build an `asset:` URI for a registered entry. */
export function assetRef(entry: AssetEntry): string {
  return `asset:${entry.hash}.${entry.ext}`
}

/**
 * Map a state-side string to a serialized form. Blob URLs we own
 * become `asset:<hash>.<ext>`; everything else (inline svg, http
 * URLs, data URLs we didn't ingest) passes through untouched.
 */
export function toSerializedRef(value: string): string {
  if (!value.startsWith('blob:')) return value
  const entry = assetStore.byUrl(value)
  return entry ? assetRef(entry) : value
}

/**
 * Map a serialized string back to its runtime form. `asset:` refs
 * resolve through the store; anything else passes through.
 */
export function fromSerializedRef(value: string): string {
  const parsed = parseAssetRef(value)
  if (!parsed) return value
  const entry = assetStore.byHash(parsed.hash)
  return entry?.url ?? value
}

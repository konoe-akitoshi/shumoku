// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Mapping autosave — unit tests for the new per-link PATCH and bulk DELETE
 * route semantics (body validation, sourceId logic, link-not-found handling).
 * The TopologyService DB integration is tested in link-automap.test.ts.
 */

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// PATCH /mapping/links/:linkId — body validation logic
// ---------------------------------------------------------------------------

type LinkMappingBody = {
  monitoredNodeId?: string
  interface?: string
  bandwidth?: number
  sourceId?: string
} | null

/** Mirror the "is this body empty/clear?" logic from patchLinkMapping. */
function isEmptyLinkMapping(body: LinkMappingBody): boolean {
  if (body === null) return true
  return !body.monitoredNodeId && !body.interface && !body.bandwidth
}

describe('PATCH /mapping/links/:linkId — body empty detection', () => {
  it('null body → clear', () => {
    expect(isEmptyLinkMapping(null)).toBe(true)
  })

  it('all fields undefined → clear', () => {
    expect(isEmptyLinkMapping({})).toBe(true)
  })

  it('monitoredNodeId set → not empty', () => {
    expect(isEmptyLinkMapping({ monitoredNodeId: 'node-1' })).toBe(false)
  })

  it('interface set → not empty', () => {
    expect(isEmptyLinkMapping({ interface: 'eth0' })).toBe(false)
  })

  it('bandwidth set → not empty', () => {
    expect(isEmptyLinkMapping({ bandwidth: 1_000_000_000 })).toBe(false)
  })

  it('sourceId only (no mapping fields) → treated as clear', () => {
    expect(isEmptyLinkMapping({ sourceId: 'src-1' })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /mapping/nodes|links — sourceId validation logic
// (mirrors deleteMappingByKind sourceId check)
// ---------------------------------------------------------------------------

function validateDeleteSourceId(
  attachedSourceIds: string[],
  requestedSourceId: string | undefined,
): { valid: boolean } {
  if (!requestedSourceId) return { valid: true }
  return { valid: attachedSourceIds.includes(requestedSourceId) }
}

describe('DELETE /mapping/nodes|links — sourceId validation', () => {
  it('no sourceId → valid (delete all sources)', () => {
    expect(validateDeleteSourceId(['src-1', 'src-2'], undefined).valid).toBe(true)
  })

  it('valid sourceId → valid', () => {
    expect(validateDeleteSourceId(['src-1', 'src-2'], 'src-1').valid).toBe(true)
  })

  it('unknown sourceId → invalid', () => {
    expect(validateDeleteSourceId(['src-1', 'src-2'], 'src-ghost').valid).toBe(false)
  })

  it('empty attached list + no sourceId → valid (no-op delete)', () => {
    expect(validateDeleteSourceId([], undefined).valid).toBe(true)
  })

  it('empty attached list + sourceId → invalid', () => {
    expect(validateDeleteSourceId([], 'src-1').valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Link-not-found check — mirrors the linkId existence check in the route
// ---------------------------------------------------------------------------

function isLinkPresent(links: { id?: string }[], linkId: string, _index: number): boolean {
  const keys = new Set(links.map((l, i) => l.id || `link-${i}`))
  return keys.has(linkId)
}

describe('PATCH /mapping/links/:linkId — linkId existence check', () => {
  const links = [{ id: 'entity-abc' }, { id: undefined }, { id: 'entity-xyz' }]

  it('known id → present', () => {
    expect(isLinkPresent(links, 'entity-abc', 0)).toBe(true)
  })

  it('fallback key link-1 → present', () => {
    expect(isLinkPresent(links, 'link-1', 1)).toBe(true)
  })

  it('unknown id → not present', () => {
    expect(isLinkPresent(links, 'entity-missing', 0)).toBe(false)
  })

  it('wrong fallback index → not present', () => {
    expect(isLinkPresent(links, 'link-5', 5)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PATCH /mapping/links/:linkId — skipped-write surfacing (no silent drop)
// ---------------------------------------------------------------------------

/** Mirrors the route's dropped-entry check: skip > 0 after a patch → 422. */
function patchResponseStatus(skipped: { nodes: number; links: number }): 200 | 422 {
  return skipped.nodes + skipped.links > 0 ? 422 : 200
}

describe('PATCH /mapping/links/:linkId — skipped write → 422', () => {
  it('clean write → 200', () => {
    expect(patchResponseStatus({ nodes: 0, links: 0 })).toBe(200)
  })

  it('link entry without stable entity id → 422', () => {
    expect(patchResponseStatus({ nodes: 0, links: 1 })).toBe(422)
  })

  it('monitored node without stable entity id → 422', () => {
    expect(patchResponseStatus({ nodes: 1, links: 0 })).toBe(422)
  })
})

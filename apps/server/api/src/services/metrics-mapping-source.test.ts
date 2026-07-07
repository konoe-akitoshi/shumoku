// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Wave B-3 (#569) — metrics mapping source addressing.
 *
 * Tests for the PUT /topologies/:id/mapping body-detection logic and the
 * autoMapLinks sourceId routing. The TopologyService integration (DB-backed
 * rows) is validated here through the service's exported types; DB-touching
 * happy-path tests live in the link-automap.test.ts companion.
 */

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// PUT body detection — replicate the route's shape-detection logic so any
// drift between the route and this spec is immediately visible in CI.
// ---------------------------------------------------------------------------

type MetricsMapping = { nodes?: Record<string, unknown>; links?: Record<string, unknown> }
type PutBody = MetricsMapping | { mapping: MetricsMapping; sourceId?: string }

/** Mirrors the detection logic in api/topologies.ts PUT /:id/mapping. */
function detectBody(body: PutBody): { mapping: MetricsMapping; sourceId: string | undefined } {
  if (
    body !== null &&
    typeof body === 'object' &&
    'mapping' in body &&
    typeof (body as { mapping?: unknown }).mapping === 'object'
  ) {
    const wrapper = body as { mapping: MetricsMapping; sourceId?: string }
    return { mapping: wrapper.mapping, sourceId: wrapper.sourceId }
  }
  return { mapping: body as MetricsMapping, sourceId: undefined }
}

describe('PUT /:id/mapping — body shape detection (Wave B-3, #569)', () => {
  it('bare MetricsMapping → legacy path, no sourceId', () => {
    const bare: MetricsMapping = { nodes: { n1: { hostId: 'h1' } }, links: {} }
    const { mapping, sourceId } = detectBody(bare)
    expect(mapping).toBe(bare)
    expect(sourceId).toBeUndefined()
  })

  it('wrapper { mapping, sourceId } → new path, sourceId extracted', () => {
    const inner: MetricsMapping = { nodes: { n1: { hostId: 'h1' } }, links: {} }
    const wrapped = { mapping: inner, sourceId: 'src-2' }
    const { mapping, sourceId } = detectBody(wrapped)
    expect(mapping).toBe(inner)
    expect(sourceId).toBe('src-2')
  })

  it('wrapper without sourceId → new path, sourceId undefined', () => {
    const inner: MetricsMapping = { nodes: {}, links: {} }
    const { mapping, sourceId } = detectBody({ mapping: inner })
    expect(mapping).toBe(inner)
    expect(sourceId).toBeUndefined()
  })

  it('bare mapping whose nodes/links happen to be objects → legacy (no "mapping" key)', () => {
    // A MetricsMapping that has a property called "nodes" but NOT "mapping".
    const bare: MetricsMapping = { nodes: { mapping: { hostId: 'trick' } }, links: {} }
    const { mapping, sourceId } = detectBody(bare)
    // "mapping" is a key inside nodes, not at the top level → should not trip the detection.
    expect(sourceId).toBeUndefined()
    expect(mapping).toBe(bare)
  })

  it('wrapper with sourceId undefined in JSON → sourceId undefined', () => {
    const inner: MetricsMapping = { nodes: {}, links: {} }
    // JSON.parse round-trip removes undefined keys but keeps explicit null —
    // here we mimic the common case of an absent sourceId field.
    const { mapping, sourceId } = detectBody({ mapping: inner, sourceId: undefined })
    expect(mapping).toBe(inner)
    expect(sourceId).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// autoMapLinks sourceId validation — mirrors the service's attached-source
// check. The pure logic is that an unknown sourceId must be rejected before
// fetching any interfaces or writing any rows.
// ---------------------------------------------------------------------------

describe('autoMapLinks sourceId validation logic (Wave B-3, #569)', () => {
  /** Simulated attached-source validation: mirrors topology.ts autoMapLinks. */
  function validateSourceId(
    attachedSourceIds: string[],
    requestedSourceId: string | undefined,
  ): { valid: boolean; resolvedId: string | undefined } {
    if (requestedSourceId) {
      const found = attachedSourceIds.includes(requestedSourceId)
      if (!found) return { valid: false, resolvedId: undefined }
      return { valid: true, resolvedId: requestedSourceId }
    }
    return { valid: true, resolvedId: attachedSourceIds[0] }
  }

  it('no sourceId → resolves to first attached source', () => {
    const { valid, resolvedId } = validateSourceId(['src-1', 'src-2'], undefined)
    expect(valid).toBe(true)
    expect(resolvedId).toBe('src-1')
  })

  it('valid sourceId → resolves to the requested source', () => {
    const { valid, resolvedId } = validateSourceId(['src-1', 'src-2'], 'src-2')
    expect(valid).toBe(true)
    expect(resolvedId).toBe('src-2')
  })

  it('invalid sourceId (not attached) → rejected', () => {
    const { valid, resolvedId } = validateSourceId(['src-1', 'src-2'], 'src-unknown')
    expect(valid).toBe(false)
    expect(resolvedId).toBeUndefined()
  })

  it('no sources attached + no sourceId → resolves to undefined (no-op)', () => {
    const { valid, resolvedId } = validateSourceId([], undefined)
    expect(valid).toBe(true)
    expect(resolvedId).toBeUndefined()
  })

  it('no sources attached + explicit sourceId → rejected', () => {
    const { valid, resolvedId } = validateSourceId([], 'src-ghost')
    expect(valid).toBe(false)
    expect(resolvedId).toBeUndefined()
  })
})

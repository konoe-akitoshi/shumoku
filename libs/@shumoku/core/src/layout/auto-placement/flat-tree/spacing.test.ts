// deriveSpacing — derivation rules and override behaviour.

import { describe, expect, test } from 'vitest'
import { PORT_LABEL_OUTER_REACH } from '../../../constants.js'
import { deriveSpacing } from './spacing.js'

describe('deriveSpacing — defaults', () => {
  test('produces the historical baseline values when no metrics or overrides are supplied', () => {
    const s = deriveSpacing()
    expect(s.labelClearance).toBeCloseTo(8, 5)
    expect(s.portLabelOuterReach).toBe(PORT_LABEL_OUTER_REACH)
    expect(s.internalNodeGap).toBeCloseTo(PORT_LABEL_OUTER_REACH + 8, 5)
    expect(s.internalLayerGap).toBeCloseTo(PORT_LABEL_OUTER_REACH * 2 + 8, 5)
    expect(s.internalRootGap).toBeCloseTo(PORT_LABEL_OUTER_REACH + 8, 5)
    expect(s.subgraphPadding).toBeCloseTo(20, 5)
    expect(s.subgraphLabelHeight).toBeCloseTo(28, 5)
  })

  test('outer gaps are at least as large as the matching internal gaps', () => {
    const s = deriveSpacing()
    expect(s.outerNodeGap).toBeGreaterThanOrEqual(s.internalNodeGap)
    expect(s.outerLayerGap).toBeGreaterThanOrEqual(s.internalLayerGap)
  })
})

describe('deriveSpacing — metrics drive the derivation', () => {
  test('larger fontEmSize widens label clearance and the subgraph label band', () => {
    const small = deriveSpacing({ fontEmSize: 12 })
    const big = deriveSpacing({ fontEmSize: 18 })
    expect(big.labelClearance).toBeGreaterThan(small.labelClearance)
    expect(big.subgraphLabelHeight).toBeGreaterThan(small.subgraphLabelHeight)
    expect(big.subgraphPadding).toBeGreaterThan(small.subgraphPadding)
  })

  test('larger portLabelOuterReach widens all label-bound gaps', () => {
    const tight = deriveSpacing({ portLabelOuterReach: 20 })
    const wide = deriveSpacing({ portLabelOuterReach: 40 })
    expect(wide.internalNodeGap).toBeGreaterThan(tight.internalNodeGap)
    expect(wide.internalLayerGap).toBeGreaterThan(tight.internalLayerGap)
    expect(wide.outerNodeGap).toBeGreaterThan(tight.outerNodeGap)
    expect(wide.outerLayerGap).toBeGreaterThan(tight.outerLayerGap)
  })

  test('pre-measured subgraphLabelHeight wins over em derivation', () => {
    const s = deriveSpacing({ fontEmSize: 12, subgraphLabelHeight: 50 })
    expect(s.subgraphLabelHeight).toBe(50)
  })

  test('label clearance scales linearly with em-size', () => {
    const a = deriveSpacing({ fontEmSize: 12 })
    const b = deriveSpacing({ fontEmSize: 24 })
    expect(b.labelClearance).toBeCloseTo(a.labelClearance * 2, 5)
  })
})

describe('deriveSpacing — overrides win over derivation', () => {
  test('option overrides replace the derived outer gaps and hull params', () => {
    const s = deriveSpacing(
      { fontEmSize: 18 },
      { nodeGap: 99, layerGap: 111, subgraphPadding: 7, subgraphLabelHeight: 13 },
    )
    expect(s.outerNodeGap).toBe(99)
    expect(s.outerLayerGap).toBe(111)
    expect(s.subgraphPadding).toBe(7)
    expect(s.subgraphLabelHeight).toBe(13)
    // Internal gaps are *not* overridable — they're tied to label geometry.
    expect(s.internalNodeGap).toBeGreaterThan(0)
  })

  test('overrides win over a pre-measured subgraphLabelHeight in metrics', () => {
    const s = deriveSpacing({ subgraphLabelHeight: 50 }, { subgraphLabelHeight: 13 })
    expect(s.subgraphLabelHeight).toBe(13)
  })
})

describe('deriveSpacing — purity', () => {
  test('called twice with the same inputs returns equal output', () => {
    const a = deriveSpacing({ fontEmSize: 14, portLabelOuterReach: 25 })
    const b = deriveSpacing({ fontEmSize: 14, portLabelOuterReach: 25 })
    expect(a).toEqual(b)
  })
})

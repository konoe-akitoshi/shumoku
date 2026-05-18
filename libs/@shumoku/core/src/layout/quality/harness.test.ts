// Regression bounds for the engine over the corpus.
//
// The harness runs every corpus fixture and asserts:
//   1. Hull-overlap invariant (sibling hulls must not overlap).
//   2. Per-fixture upper bounds on edge-crossings (catches the
//      "we accidentally regressed sort order" class of bug).
//   3. Total runtime stays in the same order of magnitude.
//
// When this test fails after an algorithm change, look at the
// printed table for which fixture moved.

import { describe, expect, test } from 'vitest'
import { createFlatTreeEngine } from '../flat-tree/engine.js'
import { CORPUS } from './corpus.js'
import { formatReport, runHarness } from './harness.js'

describe('layout quality harness', () => {
  test('all fixtures lay out without sibling-hull overlap', () => {
    const report = runHarness()
    // Print so a developer running `bun x vitest run harness.test.ts`
    // sees the numbers.
    console.log(`\n${formatReport(report)}\n`)
    for (const fx of report.fixtures) {
      expect(fx.metrics.siblingHullOverlap, `${fx.name} has sibling-hull overlap`).toBe(0)
    }
  })

  test('crossings stay within per-fixture upper bounds', () => {
    // Tight upper bounds informed by the current engine output.
    // A regression that increases crossings will trip the matching
    // fixture; a real improvement (lower crossings) flips this
    // safely — adjust the bound down in the same PR.
    const upperBounds: Record<string, number> = {
      minimal: 0,
      'linear-chain': 0,
      star: 0,
      'wide-tree': 0,
      'deep-chain': 0,
      'multi-component': 0,
      'ha-pair': 1, // overlay edge crosses primary chain in worst case
      'single-subgraph': 0,
      'multi-emitter-sg': 0,
      'nested-subgraph': 0,
      'noc-like': 2,
      'no-port-labels': 0,
      'ha-crossing': 0,
    }
    const report = runHarness()
    for (const fx of report.fixtures) {
      const bound = upperBounds[fx.name] ?? 0
      expect(
        fx.metrics.crossings.total,
        `${fx.name} crossings ${fx.metrics.crossings.total} exceeded bound ${bound}`,
      ).toBeLessThanOrEqual(bound)
    }
  })

  test('total runtime stays under 200 ms for the whole corpus', () => {
    const report = runHarness()
    expect(report.totals.elapsedMs).toBeLessThan(200)
  })
})

describe('overlayReorder option', () => {
  function swColumnOrder(positions: Map<string, { x: number; y: number }>): string[] {
    return ['sw1', 'sw2', 'sw3', 'sw4']
      .map((id) => ({ id, x: positions.get(id)?.x ?? Number.NaN }))
      .sort((a, b) => a.x - b.x)
      .map((e) => e.id)
  }

  test('ha-crossing fixture: HA peers become adjacent when overlayReorder is on', () => {
    const engine = createFlatTreeEngine()
    const graph = CORPUS.find((c) => c.name === 'ha-crossing')?.graph
    if (!graph) throw new Error('ha-crossing fixture missing')
    const sizeById = new Map(
      graph.nodes.map((node) => [node.id, node.size ?? { width: 80, height: 60 }]),
    )

    const off = engine.layout(graph, { sizeById })
    const offOrder = swColumnOrder(off.nodePositions)
    expect(offOrder.indexOf('sw3') - offOrder.indexOf('sw1')).toBe(2)

    const on = engine.layout(graph, { sizeById, overlayReorder: true })
    const onOrder = swColumnOrder(on.nodePositions)
    expect(Math.abs(onOrder.indexOf('sw3') - onOrder.indexOf('sw1'))).toBe(1)
  })

  test('overlayReorder is deterministic — same input twice → identical output', () => {
    const engine = createFlatTreeEngine()
    const graph = CORPUS.find((c) => c.name === 'ha-crossing')?.graph
    if (!graph) throw new Error('ha-crossing fixture missing')
    const sizeById = new Map(
      graph.nodes.map((node) => [node.id, node.size ?? { width: 80, height: 60 }]),
    )
    const r1 = engine.layout(graph, { sizeById, overlayReorder: true })
    const r2 = engine.layout(graph, { sizeById, overlayReorder: true })
    expect([...r1.nodePositions.entries()]).toEqual([...r2.nodePositions.entries()])
  })
})

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout quality harness.
 *
 * Runs the flat-tree engine over the corpus, collects metrics
 * per fixture, and produces a single report. Use in tests
 * (`harness.test.ts`) for regression bounds, and in interactive
 * `bun run quality` runs to compare two algorithm versions.
 */

import { createFlatTreeEngine } from '../flat-tree/engine.js'
import type { FlatTreeLayoutResult, Size } from '../flat-tree/types.js'
import { CORPUS, type CorpusFixture } from './corpus.js'
import { type QualityReport, summarize } from './metrics.js'

export interface FixtureReport {
  name: string
  description: string
  nodeCount: number
  linkCount: number
  result: FlatTreeLayoutResult
  metrics: QualityReport
  /** Wall-clock milliseconds spent in `engine.layout`. */
  elapsedMs: number
  /**
   * Count of sibling-sort groups that hit the
   * `port-label-absent-fallback` path. Non-zero means the
   * fixture didn't carry enough port-label signal to drive
   * the primary sort — a target for future signal extraction
   * (e.g. inferring labels from port ids, sub-graph
   * ordering, …).
   */
  portLabelFallbackGroups: number
}

export interface HarnessReport {
  fixtures: FixtureReport[]
  /** Aggregate sums across the corpus. */
  totals: {
    nodes: number
    links: number
    edgeLengthTotal: number
    rootAreaTotal: number
    crossingsTotal: number
    crossingsOverlay: number
    siblingHullOverlapTotal: number
    elapsedMs: number
  }
}

/**
 * Run the engine over every corpus fixture and collect metrics.
 *
 * @param fixtures Override the fixture set (defaults to {@link CORPUS}).
 */
export function runHarness(fixtures: readonly CorpusFixture[] = CORPUS): HarnessReport {
  const engine = createFlatTreeEngine()
  const out: FixtureReport[] = []
  for (const fx of fixtures) {
    const sizeById = new Map<string, Size>(
      fx.graph.nodes.map((node) => [node.id, node.size ?? { width: 80, height: 60 }]),
    )
    const t0 = performance.now()
    const result = engine.layout(fx.graph, { sizeById, explain: true })
    const elapsedMs = performance.now() - t0
    const portLabelFallbackGroups = result.diagnostics.filter(
      (d) => d.code === 'sibling-order' && d.message.includes('port-label-absent-fallback'),
    ).length
    out.push({
      name: fx.name,
      description: fx.description,
      nodeCount: fx.graph.nodes.length,
      linkCount: fx.graph.links.length,
      result,
      metrics: summarize(fx.graph, result),
      elapsedMs,
      portLabelFallbackGroups,
    })
  }
  return {
    fixtures: out,
    totals: aggregate(out),
  }
}

function aggregate(rows: FixtureReport[]): HarnessReport['totals'] {
  let nodes = 0
  let links = 0
  let edgeLengthTotal = 0
  let rootAreaTotal = 0
  let crossingsTotal = 0
  let crossingsOverlay = 0
  let siblingHullOverlapTotal = 0
  let elapsedMs = 0
  for (const r of rows) {
    nodes += r.nodeCount
    links += r.linkCount
    edgeLengthTotal += r.metrics.edgeLength.total
    rootAreaTotal += r.metrics.rootArea
    crossingsTotal += r.metrics.crossings.total
    crossingsOverlay += r.metrics.crossings.overlay
    siblingHullOverlapTotal += r.metrics.siblingHullOverlap
    elapsedMs += r.elapsedMs
  }
  return {
    nodes,
    links,
    edgeLengthTotal,
    rootAreaTotal,
    crossingsTotal,
    crossingsOverlay,
    siblingHullOverlapTotal,
    elapsedMs,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Pretty-printing
// ─────────────────────────────────────────────────────────────────────

/**
 * Format a harness report as a fixed-width text table. Used by
 * the harness test (which logs it as the run completes) and by
 * the `bun run quality` script.
 */
export function formatReport(report: HarnessReport): string {
  const header = [
    'fixture',
    'N',
    'L',
    'edge_tot',
    'area',
    'ar',
    'xings',
    'xov',
    'hull_ov',
    'pl_fb',
    'ms',
  ]
  const rows: string[][] = [header.map((h) => h)]
  for (const fx of report.fixtures) {
    rows.push([
      fx.name,
      String(fx.nodeCount),
      String(fx.linkCount),
      fx.metrics.edgeLength.total.toFixed(0),
      fx.metrics.rootArea.toFixed(0),
      fx.metrics.aspectRatio.toFixed(2),
      String(fx.metrics.crossings.total),
      String(fx.metrics.crossings.overlay),
      fx.metrics.siblingHullOverlap.toFixed(0),
      String(fx.portLabelFallbackGroups),
      fx.elapsedMs.toFixed(2),
    ])
  }
  rows.push([
    'TOTAL',
    String(report.totals.nodes),
    String(report.totals.links),
    report.totals.edgeLengthTotal.toFixed(0),
    report.totals.rootAreaTotal.toFixed(0),
    '—',
    String(report.totals.crossingsTotal),
    String(report.totals.crossingsOverlay),
    report.totals.siblingHullOverlapTotal.toFixed(0),
    String(report.fixtures.reduce((s, f) => s + f.portLabelFallbackGroups, 0)),
    report.totals.elapsedMs.toFixed(2),
  ])
  const widths = header.map((_, col) => Math.max(...rows.map((r) => (r[col] ?? '').length)))
  return rows.map((r) => r.map((cell, col) => cell.padEnd(widths[col] ?? 0)).join('  ')).join('\n')
}

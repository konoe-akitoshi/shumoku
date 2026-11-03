// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../../input/model.js'
import { readNetworkModel } from '../../models/network-model-graph.js'
import { deriveStructure } from '../../structure/index.js'
import type { Structure } from '../../structure/types.js'
import { splitSide } from '../keys.js'
import type { Parts } from '../layout.js'
import type { Metrics } from '../metrics.js'
import { type Problem, readProblem } from '../problem.js'
import { nodeName } from '../routes.js'
import type { Scene } from '../scene.js'
import { drawingReport } from './report.js'

/** Round lengths for tests, so expected positions can be written down. */
export const testMetrics: Metrics = {
  card: () => ({ width: 100, height: 40 }),
  bus: (_id, lines) => ({ width: 20 * Math.max(lines, 1), height: 10 }),
  cloud: () => ({ width: 100, height: 40 }),
  group: () => ({ top: 20, right: 10, bottom: 10, left: 10 }),
  gap: 30,
  memberGap: 10,
  groupGap: 40,
  hullPad: 5,
  line: () => 4,
  stroke: 4,
  gapApart: 4,
  aspect: 16 / 9,
  leadOut: 10,
  portSlot: () => 20,
}

export function networkOf(yaml: string, boundary: string[]) {
  const network = readNetworkModel(yaml).config
  return { network, structure: deriveStructure(network, { boundary }) }
}

export function problemOf(yaml: string, boundary: string[]): Problem {
  const { network, structure } = networkOf(yaml, boundary)
  return readProblem(network, structure, testMetrics)
}

/**
 * The wiring half of the drawing report of a scene alone, flattened: the tests that look at how
 * lines run have no network or structure to give.
 */
export function wiringOf(scene: Scene, metrics: Metrics, problem?: Problem) {
  const r = drawingReport(scene, {
    network: { nodes: [], links: [] },
    structure: { nodes: {}, candidates: [], boundary: [], planes: [] },
    metrics,
    ...(problem && { problem }),
  })
  return {
    ...r.wiring,
    ports: { drawn: r.ports.drawn, ends: r.ports.ends },
    portCrossings: r.ports.crossings,
    reversals: r.flow.reversals,
  }
}

/**
 * A layered network of about `n` nodes, written the same way every time: a top, distribution
 * switches in groups of four, access switches with two uplinks each, and hosts below them.
 * For tests that need a size to grow without real data.
 */
export function generatedYaml(n: number): string {
  const nodes: string[] = ['  - { id: top }']
  const links: string[] = []
  const groups: string[] = []
  const nd = Math.max(2, Math.round(n / 10))
  const na = Math.round(n / 3)
  const nh = n - 1 - nd - na
  const groupOf = (i: number) => Math.floor(i / 4)
  for (let i = 0; i < nd; i++) {
    nodes.push(`  - { id: d${i}, group: g${groupOf(i)} }`)
    links.push(`  - { endpoints: [{ node: top }, { node: d${i} }] }`)
  }
  for (let g = 0; g <= groupOf(nd - 1); g++) groups.push(`  - { id: g${g} }`)
  for (let i = 0; i < na; i++) {
    const p = Math.floor((i * nd) / na)
    nodes.push(`  - { id: a${i}, group: g${groupOf(p)} }`)
    links.push(`  - { endpoints: [{ node: d${p} }, { node: a${i} }] }`)
    links.push(`  - { endpoints: [{ node: d${(p + 1) % nd} }, { node: a${i} }] }`)
  }
  for (let i = 0; i < nh; i++) {
    nodes.push(`  - { id: h${i} }`)
    links.push(`  - { endpoints: [{ node: a${i % na} }, { node: h${i} }] }`)
  }
  return `groups:\n${groups.join('\n')}\nnodes:\n${nodes.join('\n')}\nlinks:\n${links.join('\n')}\n`
}

/** Small changes to the lengths the drawing is given, such as a font that measures a little differently. */
export interface Jitter {
  /** Added to every side of every group's insets. */
  inset?: number
  /** Added to, or taken from, each card's width and height, the sign by the card's id. */
  card?: number
  /** A share of each card's width added or taken, the sign by the card's id: the text measured wider or narrower. */
  text?: number
  /** Turns every sign, so that two jitters of one size differ. */
  flip?: boolean
}

const signOf = (id: string, flip: boolean) => {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return (h % 2 === 0 ? 1 : -1) * (flip ? -1 : 1)
}

export function jittered(base: Metrics, jitter: Jitter): Metrics {
  const { inset = 0, card = 0, text = 0, flip = false } = jitter
  return {
    ...base,
    card: (id) => {
      const s = base.card(id)
      const sign = signOf(id, flip)
      return { width: s.width * (1 + sign * text) + sign * card, height: s.height + sign * card }
    },
    group: (id) => {
      const g = base.group(id)
      return {
        top: g.top + inset,
        right: g.right + inset,
        bottom: g.bottom + inset,
        left: g.left + inset,
      }
    },
  }
}

/**
 * What a layout decided in each stage, by names that do not move when a length does, so that
 * two layouts of one network can be compared: the order of siblings, the corridors each line
 * passes through (named by what bounds them), the order of the lines in the columns and of the
 * ports on the sides, and the crossings the discrete stages count.
 */
export function decisionsOf(
  parts: Parts,
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
) {
  const { problem, layers, corridors, routes, tracks } = parts
  const report = drawingReport(parts.scene, { network, structure, metrics, problem })
  return {
    order: [
      ...[...layers.siblings].map(([f, keys]) => `${f}: ${keys.join(' ')}`),
      ...[...layers.members].map(([u, ids]) => `${u}: ${ids.join(' ')}`),
    ].sort(),
    routes: [...routes.routes].map(
      ([id, r]) => `${id}: ${r.nodes.map((n) => nodeName(corridors, n)).join(' > ')}`,
    ),
    ordering: [
      ...[...tracks.columns].map(([n, keys]) => `${nodeName(corridors, n)}: ${keys.join(' ')}`),
      ...[...tracks.ports].map(([key, ids]) => {
        const { box, side } = splitSide(key)
        return `${box} ${side}: ${ids.join(' ')}`
      }),
    ].sort(),
    crossings: { layers: layers.crossings, tracks: tracks.crossings },
    /** Counted on the coordinates, which the runs along the rows are ordered by, so not held to the jitter. */
    drawn: report.crossings.crossings,
  }
}

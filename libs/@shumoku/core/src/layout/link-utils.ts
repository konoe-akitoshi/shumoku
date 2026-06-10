// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { getStandardSpec } from '../models/standards.js'
import type { Link, LinkBandwidth } from '../models/types.js'

/**
 * Canonical bps for the preset bandwidth labels.
 */
const PRESET_BPS: Record<string, number> = {
  '10M': 10_000_000,
  '100M': 100_000_000,
  '1G': 1_000_000_000,
  '2.5G': 2_500_000_000,
  '5G': 5_000_000_000,
  '10G': 10_000_000_000,
  '25G': 25_000_000_000,
  '40G': 40_000_000_000,
  '50G': 50_000_000_000,
  '100G': 100_000_000_000,
  '200G': 200_000_000_000,
  '400G': 400_000_000_000,
}

const BANDWIDTH_RE = /^(\d+(?:\.\d+)?)\s*(K|M|G|T)?(?:BIT|B|BPS|BE)?$/

/**
 * Parse a bandwidth string ("10G", "2.5Gbps", "500M") or raw bps number
 * into bits/sec. Pure utility — used by plugin configs that accept
 * user-typed bandwidth values; not tied to Link semantics.
 */
export function resolveBandwidthBps(bw: LinkBandwidth | null | undefined): number | undefined {
  if (bw === undefined || bw === null || bw === '') return undefined
  if (typeof bw === 'number') return bw > 0 && Number.isFinite(bw) ? bw : undefined
  const normalized = bw.toUpperCase().replace(/\s/g, '')
  const preset = PRESET_BPS[normalized]
  if (preset !== undefined) return preset
  const match = BANDWIDTH_RE.exec(normalized)
  if (!match) return undefined
  const valueStr = match[1]
  if (valueStr === undefined) return undefined
  const value = Number.parseFloat(valueStr)
  if (!Number.isFinite(value) || value <= 0) return undefined
  const unit = match[2]
  const multiplier =
    unit === 'T' ? 1e12 : unit === 'G' ? 1e9 : unit === 'M' ? 1e6 : unit === 'K' ? 1e3 : 1
  return value * multiplier
}

/**
 * Width anchors in (log10(bps), pixel-width) form. Calibration bumped
 * from the original 1G→6…100G→24 curve by ~40% so diagrams read as
 * "pipes" rather than hairlines, and so the weathermap flow (which
 * lives inside the stroke) has enough room for its two lanes.
 */
const WIDTH_ANCHORS: readonly (readonly [number, number])[] = [
  [Math.log10(100_000_000), 5], // 100M
  [Math.log10(1_000_000_000), 8], // 1G
  [Math.log10(10_000_000_000), 14], // 10G
  [Math.log10(25_000_000_000), 20], // 25G
  [Math.log10(40_000_000_000), 26], // 40G
  [Math.log10(100_000_000_000), 34], // 100G
]

/**
 * Resolve a link's nominal speed (bits/sec). Reads per-endpoint module
 * standards (the canonical source) and falls back to runtime `rateBps`
 * when neither end has a module set. For symmetric links both endpoints
 * return the same speed; for asymmetric links (BiDi etc.) we pick the
 * lower of the two (conservative for utilization math).
 */
export function linkSpeedBps(link: Link | null | undefined): number | undefined {
  if (!link) return undefined
  const fromBps = getStandardSpec(link.from?.plug?.module?.standard)?.speedBps
  const toBps = getStandardSpec(link.to?.plug?.module?.standard)?.speedBps
  if (fromBps !== undefined && toBps !== undefined) return Math.min(fromBps, toBps)
  if (fromBps !== undefined) return fromBps
  if (toBps !== undefined) return toBps
  if (typeof link.rateBps === 'number' && link.rateBps > 0 && Number.isFinite(link.rateBps)) {
    return link.rateBps
  }
  return undefined
}

function bpsToWidth(bps: number): number {
  const x = Math.log10(bps)
  const first = WIDTH_ANCHORS[0]
  if (!first) return 2
  if (x <= first[0]) return first[1]
  for (const [i, curr] of WIDTH_ANCHORS.entries()) {
    if (i === 0) continue
    const prev = WIDTH_ANCHORS[i - 1]
    if (!prev) continue
    if (x <= curr[0]) {
      const t = (x - prev[0]) / (curr[0] - prev[0])
      return prev[1] + t * (curr[1] - prev[1])
    }
  }
  // Extrapolate past the top anchor using the last segment's slope
  // so 200G/400G etc. still scale monotonically.
  const last = WIDTH_ANCHORS[WIDTH_ANCHORS.length - 1]
  const prev = WIDTH_ANCHORS[WIDTH_ANCHORS.length - 2]
  if (!last || !prev) return 2
  const slope = (last[1] - prev[1]) / (last[0] - prev[0])
  return last[1] + slope * (x - last[0])
}

/** Map a raw bits/sec value to the calibrated stroke width. */
export function bpsToLinkWidth(bps: number | undefined): number {
  return bps === undefined ? 0 : bpsToWidth(bps)
}

// ============================================================================
// Width modes (engine-v3-migration.md A1, #430)
// ============================================================================

/**
 * How bandwidth maps to stroke width.
 *
 *   - `log`    — the legacy anchored log curve above. Compresses the range
 *                so every link stays visible; the read is "fast vs slow",
 *                not proportion.
 *   - `linear` — width ∝ bandwidth (px per Gbps). Honest proportion: a
 *                400G trunk is visibly 40× a 10G access link, like river
 *                width on a map. Requires a width-aware layout (v3 router)
 *                because trunk ribbons get genuinely wide; slow links
 *                bottom out at `LINEAR_MIN_WIDTH`.
 *   - `class`  — discrete road classes (motorway / trunk / regional /
 *                local / lane). Rank is readable at a glance; differences
 *                within a class are intentionally suppressed.
 */
export type LinkWidthMode = 'log' | 'linear' | 'class'

/** px per Gbps for `linear` mode (v3 prototype calibration: 400G → 16px). */
const LINEAR_PX_PER_GBPS = 0.04
const LINEAR_MIN_WIDTH = 0.4
const LINEAR_MAX_WIDTH = 64

/** Discrete class widths for `class` mode, fastest first. */
const CLASS_STEPS: readonly (readonly [number, number])[] = [
  [400e9, 6.5],
  [100e9, 4],
  [25e9, 2.6],
  [10e9, 1.7],
]
const CLASS_MIN_WIDTH = 1.1

/**
 * Map bits/sec to stroke width under the given mode. Unknown bandwidth
 * returns 0 (caller decides the fallback), matching `bpsToLinkWidth`.
 */
export function bpsToLinkWidthMode(bps: number | undefined, mode: LinkWidthMode = 'log'): number {
  if (bps === undefined || !Number.isFinite(bps) || bps <= 0) return 0
  if (mode === 'log') return bpsToWidth(bps)
  if (mode === 'linear') {
    const width = (bps / 1e9) * LINEAR_PX_PER_GBPS
    return Math.min(LINEAR_MAX_WIDTH, Math.max(LINEAR_MIN_WIDTH, width))
  }
  for (const [threshold, width] of CLASS_STEPS) {
    if (bps >= threshold) return width
  }
  return CLASS_MIN_WIDTH
}

/**
 * Visual line width for a link under a width mode. Same precedence as
 * `getLinkWidth` (explicit style > bandwidth > type > default). Because a
 * core `Link` is one physical link, this IS the per-strand width — a LAG
 * renders as N parallel links each at its own width, never as one merged
 * stroke (v3 "railway discipline": no two services share a drawn line).
 */
export function getLinkWidthForMode(link: Link, mode: LinkWidthMode = 'log'): number {
  if (link.style?.strokeWidth) return link.style.strokeWidth
  const bps = linkSpeedBps(link)
  if (bps !== undefined) return bpsToLinkWidthMode(bps, mode)
  if (link.type === 'thick') return 4
  return mode === 'log' ? 3 : 1.5
}

/** Map a bandwidth label/number to the calibrated stroke width. */
export function getBandwidthWidth(bw: LinkBandwidth | null | undefined): number {
  return bpsToLinkWidth(resolveBandwidthBps(bw))
}

/**
 * Compute the visual line width for a link.
 * Single source of truth — used by layout, routing, and rendering.
 */
export function getLinkWidth(link: Link): number {
  // Explicit style overrides everything
  if (link.style?.strokeWidth) return link.style.strokeWidth

  const bps = linkSpeedBps(link)
  if (bps !== undefined) return bpsToWidth(bps)

  // Link type
  if (link.type === 'thick') return 4

  // Default
  return 3
}

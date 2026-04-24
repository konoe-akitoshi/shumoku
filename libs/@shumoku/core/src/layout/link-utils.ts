// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link, LinkBandwidth } from '../models/types.js'

/**
 * Canonical bps values for the preset labels in `LinkBandwidthLabel`.
 * Any string not in this table is parsed by the regex below, so adding
 * a new preset here is purely for readability — unlisted values like
 * "2.5G" or "500M" still resolve correctly.
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
 * Resolve a `LinkBandwidth` (number or string label) to bits per
 * second. The single source of truth used by both stroke-width
 * calculation and metrics-utilization computation — if this agrees,
 * the two axes stay in sync.
 *
 * Returns `undefined` for unrecognized or non-positive input so
 * callers can fall back cleanly instead of inheriting NaN.
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
 * now lives inside the stroke) has enough room for its two lanes.
 * In-between values (2.5G, 50G, 500M, …) are smoothly interpolated.
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
 * Map a `LinkBandwidth` value (number or label) to pixel width,
 * using the same piecewise-log interpolation as `getLinkWidth` but
 * without the Link-style overrides. Returns 0 when the value can't
 * be resolved, letting callers pick their own fallback.
 *
 * Exported so the SVG renderer (and anything that only has a
 * bandwidth scalar, not a full Link) can share one calibration
 * curve with the rest of the codebase.
 */
export function getBandwidthWidth(bw: LinkBandwidth | null | undefined): number {
  const bps = resolveBandwidthBps(bw)
  return bps === undefined ? 0 : bpsToWidth(bps)
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

/**
 * Compute the visual line width for a link.
 * Single source of truth — used by layout, routing, and rendering.
 */
export function getLinkWidth(link: Link): number {
  // Explicit style overrides everything
  if (link.style?.strokeWidth) return link.style.strokeWidth

  const bps = resolveBandwidthBps(link.bandwidth)
  if (bps !== undefined) return bpsToWidth(bps)

  // Link type
  if (link.type === 'thick') return 4

  // Default
  return 3
}

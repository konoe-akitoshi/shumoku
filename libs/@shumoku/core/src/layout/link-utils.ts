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
 * Resolve a link's nominal speed (bits/sec). Picks `link.standard` first
 * (via the standards registry — single source of truth), then falls back
 * to `link.rateBps` when only runtime metrics are available. Returns
 * undefined when neither is set.
 */
export function linkSpeedBps(link: Link | null | undefined): number | undefined {
  if (!link) return undefined
  const fromStandard = getStandardSpec(link.standard)?.speedBps
  if (fromStandard !== undefined) return fromStandard
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

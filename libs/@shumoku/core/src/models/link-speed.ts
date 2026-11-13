// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The nominal speed of a link, in one place. Whoever asks how fast a line is (the drawing's width,
 * the old layout's weight, a mock of the metrics) asks here, so the answer cannot differ.
 */

import { getStandardSpec } from './standards.js'
import type { Link, LinkPlug } from './types.js'

/**
 * The speed (bits/sec) the standards of the plugs name: the slower when the two ends differ
 * (a BiDi link), the only one when one end names it, nothing when neither does.
 */
export function standardSpeedBps(plugs: readonly (LinkPlug | undefined)[]): number | undefined {
  const speeds = plugs.flatMap((plug) => getStandardSpec(plug?.module?.standard)?.speedBps ?? [])
  return speeds.length > 0 ? Math.min(...speeds) : undefined
}

/**
 * The nominal speed of a link (bits/sec): what its ends' standards name, else the `speedBps` the
 * link carries for a link that no standard describes. (`toNetworkGraph` fills that `speedBps`
 * with the slower of the ends' port speeds when the link names none.)
 */
export function linkSpeedBps(link: Link | null | undefined): number | undefined {
  if (!link) return undefined
  const standard = standardSpeedBps([link.from?.plug, link.to?.plug])
  if (standard !== undefined) return standard
  return typeof link.speedBps === 'number' && link.speedBps > 0 && Number.isFinite(link.speedBps)
    ? link.speedBps
    : undefined
}

const rateUnits: Record<string, number> = { m: 1e6, g: 1e9, t: 1e12 }

/** A port's `speed` (a rate such as `10G`, `2.5g`, `100M`) in bits/sec; nothing when unreadable. */
export function portSpeedBps(speed: string | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s?([mgt])$/i.exec(speed?.trim() ?? '')
  const unit = match?.[2] && rateUnits[match[2].toLowerCase()]
  const bps = match?.[1] && unit ? Number.parseFloat(match[1]) * unit : undefined
  return bps && bps > 0 ? bps : undefined
}

/**
 * The speed the ports at a link's ends name: the slower of the two, the only one when one end
 * names it, nothing when neither does.
 */
export function portsSpeedBps(speeds: readonly (string | undefined)[]): number | undefined {
  const known = speeds.flatMap((speed) => portSpeedBps(speed) ?? [])
  return known.length > 0 ? Math.min(...known) : undefined
}

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
 * link carries for a link that no standard describes.
 */
export function linkSpeedBps(link: Link | null | undefined): number | undefined {
  if (!link) return undefined
  const standard = standardSpeedBps([link.from?.plug, link.to?.plug])
  if (standard !== undefined) return standard
  return typeof link.speedBps === 'number' && link.speedBps > 0 && Number.isFinite(link.speedBps)
    ? link.speedBps
    : undefined
}

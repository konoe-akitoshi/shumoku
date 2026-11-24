// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { deviceTypeOf } from '../models/network-model-graph.js'

/**
 * Device types by how near the way out of a network they usually stand, nearest first: what lies
 * beyond the network, then what routes out of it, down to what ends traffic. The one place the
 * drawing reads a node's type to decide up and down: `upstreamOf` guesses a top from it, and
 * `readProblem` puts the nearer of two linked devices above the other with it.
 */
export const TIERS: readonly (readonly string[])[] = [
  ['internet', 'external', 'cloud'],
  ['router'],
  ['firewall', 'vpn', 'cpe'],
  ['l3-switch', 'load-balancer'],
  ['l2-switch'],
  ['access-point'],
  ['server', 'database', 'console-server'],
]

const tierByType = new Map(TIERS.flatMap((types, tier) => types.map((t) => [t, tier] as const)))

/**
 * A written type's place in `TIERS`, read as the configuration reads it (an alias such as `switch`
 * or `ap`, in any case); `undefined` for no type or one the tiers do not name.
 */
export const tierOfType = (type: string | undefined): number | undefined => {
  if (type === undefined) return undefined
  const written = type.toLowerCase()
  return tierByType.get(written) ?? tierByType.get(deviceTypeOf(written))
}

/** Whether a written type stands for what lies beyond the network (the first tier). */
export const isBeyond = (type: string | undefined): boolean => tierOfType(type) === 0

/** The tiers a top may be guessed among: not what lies beyond (named before), nor an end device. */
export const isTopTier = (tier: number): boolean => tier > 0 && tier < TIERS.length - 1

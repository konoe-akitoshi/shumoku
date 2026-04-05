// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link } from '../models/types.js'

/**
 * Compute the visual line width for a link.
 * Single source of truth — used by layout, routing, and rendering.
 */
export function getLinkWidth(link: Link): number {
  // Explicit style overrides everything
  if (link.style?.strokeWidth) return link.style.strokeWidth

  // Bandwidth determines width
  switch (link.bandwidth) {
    case '100G':
      return 24
    case '40G':
      return 18
    case '25G':
      return 14
    case '10G':
      return 10
    case '1G':
      return 6
  }

  // Link type
  if (link.type === 'thick') return 3

  // Default
  return 2
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Icon resolution — single source of truth shared by every renderer.
 *
 * `Node.spec.icon` is the producer-supplied final value. Editors fill it
 * by snapshotting Product.icon (which itself was copied from a catalog
 * entry or supplied by a user upload). The renderer reads this string
 * and decides only whether it's inline SVG content or a URL.
 *
 * If `spec.icon` is empty, we fall back to the bundled device-type
 * icon set (`getDeviceIcon`) as a last resort, so a node with only a
 * `kind`/`type` still gets a recognizable shape.
 */

import type { NodeSpec } from '../models/types.js'
import { specDeviceType } from '../models/types.js'
import { getDeviceIcon } from './generated-icons.js'

export type ResolvedIcon = { kind: 'inline'; svg: string } | { kind: 'url'; url: string }

/**
 * Classify a raw icon string into inline-SVG vs URL.
 *
 * Inline content starts with `<` (either a bare `<path .../>` fragment
 * or a full `<svg>...</svg>` block). Anything else is treated as a URL,
 * including `data:` URIs.
 */
export function classifyIcon(icon: string | undefined): ResolvedIcon | null {
  if (!icon) return null
  return icon.trim().startsWith('<') ? { kind: 'inline', svg: icon } : { kind: 'url', url: icon }
}

/**
 * Resolve the icon to render for a given spec. Returns the explicit
 * `spec.icon` if any; otherwise the bundled device-type fallback;
 * otherwise null.
 */
export function resolveIcon(spec: NodeSpec | undefined): ResolvedIcon | null {
  const explicit = classifyIcon(spec?.icon)
  if (explicit) return explicit
  const fallback = getDeviceIcon(specDeviceType(spec))
  return fallback ? { kind: 'inline', svg: fallback } : null
}

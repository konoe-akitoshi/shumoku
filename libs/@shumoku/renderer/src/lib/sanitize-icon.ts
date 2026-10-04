// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Browser-side `{@html}` defense-in-depth for inline icon SVG. Passes through
// during SSR/prerender (no DOM, no untrusted data yet); sanitizes once hydrated.

import { sanitizeIconSvg } from '@shumoku/core'

export function sanitizeInlineIcon(svg: string): string {
  if (typeof window === 'undefined') return svg
  return sanitizeIconSvg(svg)
}

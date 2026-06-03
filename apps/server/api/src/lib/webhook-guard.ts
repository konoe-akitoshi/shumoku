// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time webhook-secret comparison (layer 3 of the 3-layer shared design
 * — server-side, since the server receives webhooks). Avoids the timing
 * side-channel of `===` or a SQL `WHERE webhook_secret = ?` (which is why the
 * generic /api/webhooks/:type/:id route looks the source up by its public id
 * and compares the secret here). Length is not treated as secret — webhook
 * secrets are fixed-length — so an early length mismatch returns fast.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

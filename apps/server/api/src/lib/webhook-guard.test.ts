// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { timingSafeEqualStr } from './webhook-guard.js'

describe('timingSafeEqualStr', () => {
  it('matches equal strings and rejects different ones', () => {
    expect(timingSafeEqualStr('s3cret-token', 's3cret-token')).toBe(true)
    expect(timingSafeEqualStr('s3cret-token', 's3cret-tokeX')).toBe(false)
  })

  it('rejects different lengths without throwing', () => {
    expect(timingSafeEqualStr('short', 'much-longer-secret')).toBe(false)
    expect(timingSafeEqualStr('', '')).toBe(true)
    expect(timingSafeEqualStr('x', '')).toBe(false)
  })
})

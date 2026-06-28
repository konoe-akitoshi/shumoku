// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { isSecretProp } from './secrets.js'

describe('isSecretProp', () => {
  it('treats secret:true and format:password as secret, nothing else', () => {
    expect(isSecretProp({ type: 'string', secret: true })).toBe(true)
    expect(isSecretProp({ type: 'string', format: 'password' })).toBe(true)
    expect(isSecretProp({ type: 'string', format: 'uri' })).toBe(false)
    expect(isSecretProp({ type: 'string' })).toBe(false)
  })
})

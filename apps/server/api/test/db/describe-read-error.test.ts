// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, test } from 'bun:test'
import { describeReadError } from '../../src/discovery/deep-read.ts'

describe('describeReadError', () => {
  test('a timeout names the likely causes and keeps the raw message', () => {
    const message = describeReadError(new Error('Request timed out'))
    expect(message).toContain('No response')
    expect(message).toContain('community')
    expect(message).toContain('Request timed out')
  })

  test('a refused send says the device cannot be reached', () => {
    const message = describeReadError(new Error('send undefined 127.0.0.1:161'))
    expect(message).toContain('Cannot reach')
    expect(message).toContain('send undefined 127.0.0.1:161')
  })

  test('anything else passes through unchanged, including non-Errors', () => {
    expect(describeReadError(new Error('Unknown OID'))).toBe('Unknown OID')
    expect(describeReadError('plain string')).toBe('plain string')
  })
})

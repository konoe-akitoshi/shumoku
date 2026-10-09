// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readSandboxLimits } from './sandbox-limits.js'

const MB = 1024 * 1024

function read(env: Record<string, string | undefined>) {
  const warnings: string[] = []
  const limits = readSandboxLimits(env, (message) => warnings.push(message))
  return { limits, warnings }
}

describe('readSandboxLimits', () => {
  it.each([
    ['nothing is set', {}],
    ['a value is empty', { SHUMOKU_PLUGIN_CALL_TIMEOUT_SEC: '' }],
  ])('uses the defaults when %s', (_label, env) => {
    expect(read(env)).toEqual({
      limits: { memoryLimitBytes: 64 * MB, methodTimeoutMs: 60_000, gcThresholdPercent: 50 },
      warnings: [],
    })
  })

  it('reads memory, call timeout, and GC threshold from the environment', () => {
    const { limits, warnings } = read({
      SHUMOKU_PLUGIN_MEMORY_MB: '128',
      SHUMOKU_PLUGIN_CALL_TIMEOUT_SEC: '120',
      SHUMOKU_PLUGIN_GC_THRESHOLD_PERCENT: '40',
    })

    expect(limits).toEqual({
      memoryLimitBytes: 128 * MB,
      methodTimeoutMs: 120_000,
      gcThresholdPercent: 40,
    })
    expect(warnings).toEqual([])
  })

  it.each(['64MB', 'Infinity'])('falls back to the default, with a warning, for %s', (raw) => {
    const { limits, warnings } = read({ SHUMOKU_PLUGIN_MEMORY_MB: raw })

    expect(limits.memoryLimitBytes).toBe(64 * MB)
    expect(warnings).toEqual([
      `SHUMOKU_PLUGIN_MEMORY_MB="${raw}" is not a number; using the default 64`,
    ])
  })

  it.each([
    ['SHUMOKU_PLUGIN_MEMORY_MB', '2048', 'memoryLimitBytes', 1024 * MB, '1024'],
    ['SHUMOKU_PLUGIN_MEMORY_MB', '4', 'memoryLimitBytes', 16 * MB, '16'],
    ['SHUMOKU_PLUGIN_CALL_TIMEOUT_SEC', '0', 'methodTimeoutMs', 1_000, '1'],
    ['SHUMOKU_PLUGIN_CALL_TIMEOUT_SEC', '3600', 'methodTimeoutMs', 600_000, '600'],
    ['SHUMOKU_PLUGIN_GC_THRESHOLD_PERCENT', '100', 'gcThresholdPercent', 90, '90'],
    ['SHUMOKU_PLUGIN_GC_THRESHOLD_PERCENT', '5', 'gcThresholdPercent', 10, '10'],
  ] as const)('clamps %s=%s into range, with a warning', (name, raw, key, expected, clamped) => {
    const { limits, warnings } = read({ [name]: raw })

    expect(limits[key]).toBe(expected)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(`${name}=${raw} is out of range`)
    expect(warnings[0]).toContain(`using ${clamped}`)
  })
})

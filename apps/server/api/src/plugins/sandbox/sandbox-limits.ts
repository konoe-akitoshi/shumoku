// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Operator-tunable limits for sandboxed plugins, read from the Server's
 * environment. Loosening them costs resources, not isolation, so they are
 * safe to expose — unlike the interrupt deadline, which is deliberately not
 * here: guest code runs on the Server's main thread, so that deadline is the
 * longest the whole Server can be blocked.
 */
export interface SandboxLimits {
  /** Per VM, i.e. per data source. */
  memoryLimitBytes: number
  /** One async plugin method call, start to settle. */
  methodTimeoutMs: number
  /** The auto-GC trigger's cap, as a percentage of the memory limit. */
  gcThresholdPercent: number
}

interface LimitSpec {
  env: string
  default: number
  min: number
  max: number
}

const MEMORY_MB: LimitSpec = { env: 'SHUMOKU_PLUGIN_MEMORY_MB', default: 64, min: 16, max: 1024 }
const CALL_TIMEOUT_SEC: LimitSpec = {
  env: 'SHUMOKU_PLUGIN_CALL_TIMEOUT_SEC',
  default: 60,
  min: 1,
  max: 600,
}
const GC_THRESHOLD_PERCENT: LimitSpec = {
  env: 'SHUMOKU_PLUGIN_GC_THRESHOLD_PERCENT',
  default: 50,
  min: 10,
  max: 90,
}

/**
 * A malformed value falls back to the default and an out-of-range one is
 * clamped, each with a warning, rather than failing: a typo shouldn't take
 * every external plugin down.
 */
function readLimit(
  spec: LimitSpec,
  env: Readonly<Record<string, string | undefined>>,
  warn: (message: string) => void,
): number {
  const raw = env[spec.env]
  if (raw === undefined || raw.trim() === '') return spec.default
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    warn(`${spec.env}="${raw}" is not a number; using the default ${spec.default}`)
    return spec.default
  }
  const clamped = Math.min(spec.max, Math.max(spec.min, value))
  if (clamped !== value) {
    warn(`${spec.env}=${raw} is out of range (${spec.min}-${spec.max}); using ${clamped}`)
  }
  return clamped
}

export function readSandboxLimits(
  env: Readonly<Record<string, string | undefined>>,
  warn: (message: string) => void,
): SandboxLimits {
  return {
    memoryLimitBytes: readLimit(MEMORY_MB, env, warn) * 1024 * 1024,
    methodTimeoutMs: readLimit(CALL_TIMEOUT_SEC, env, warn) * 1000,
    gcThresholdPercent: readLimit(GC_THRESHOLD_PERCENT, env, warn),
  }
}

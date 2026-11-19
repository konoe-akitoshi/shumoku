// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * alerts-contract.ts
 *
 * Validator for what an alert-capable plugin returns. The Server collects every alert source
 * once and keeps each alert's state; it can only do that if the plugin keeps the contract:
 *
 *   - `getAlerts({ activeOnly: true })` returns every alert open at the source now, or throws.
 *     Never an empty or partial list on failure: the Server reads an alert missing from a
 *     successful answer as resolved.
 *   - `Alert.id` names one occurrence: unchanged while it is open, unique within the source.
 *   - `startTime` is a finite time in ms, and `status` is `active` or `resolved`.
 *
 * The first rule is about behaviour and is tested per plugin (a failed request must throw);
 * this function checks the shape of one answer.
 */

import type { Alert } from '../plugin-types.js'

export interface AlertsContractResult {
  /** Positions (index in the answer) of alerts with no id. */
  missingId: number[]
  /** Ids that appear more than once. */
  duplicateIds: string[]
  /** Ids whose `startTime` is not a finite number. */
  badStartTime: string[]
  /** Ids whose `status` is outside the vocabulary. */
  badStatus: string[]
}

/** Check one answer of `getAlerts`. Every array empty → the contract's shape is met. */
export function validateAlertsContract(alerts: readonly Alert[]): AlertsContractResult {
  const result: AlertsContractResult = {
    missingId: [],
    duplicateIds: [],
    badStartTime: [],
    badStatus: [],
  }
  const seen = new Set<string>()
  for (const [i, alert] of alerts.entries()) {
    if (typeof alert.id !== 'string' || alert.id.length === 0) {
      result.missingId.push(i)
      continue
    }
    if (seen.has(alert.id)) {
      if (!result.duplicateIds.includes(alert.id)) result.duplicateIds.push(alert.id)
    }
    seen.add(alert.id)
    if (!Number.isFinite(alert.startTime)) result.badStartTime.push(alert.id)
    if (alert.status !== 'active' && alert.status !== 'resolved') result.badStatus.push(alert.id)
  }
  return result
}

/** Whether an answer meets the contract's shape. */
export function meetsAlertsContract(result: AlertsContractResult): boolean {
  return (
    result.missingId.length === 0 &&
    result.duplicateIds.length === 0 &&
    result.badStartTime.length === 0 &&
    result.badStatus.length === 0
  )
}

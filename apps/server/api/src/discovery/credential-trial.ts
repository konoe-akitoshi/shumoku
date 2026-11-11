// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Credential trial — find which credential a device answers to.
 *
 * Each device is tried with the credentials in the order given and keeps the first
 * that answers. The probe is one cheap SNMP GET with no retry, so a device that
 * does not answer costs one short timeout per credential, not a full read. Devices
 * are tried in parallel (bounded); a failure or timeout simply means "did not
 * answer" — a wrong community and a silent host look the same over SNMP v2c,
 * so the trial never claims to tell them apart.
 */

import { mapWithConcurrency } from '@shumoku/core'
import { SnmpClient } from './snmp-client.js'

/** sysObjectID.0 — every SNMP agent answers it, and it is one small value. */
const SYS_OBJECT_ID = '1.3.6.1.2.1.1.2.0'

/** A short timeout and no retry: a trial must be cheap when nobody answers. */
const TRIAL_TIMEOUT_MS = 800
const TRIAL_CONCURRENCY = 16

export interface TrialCredential {
  id: string
  community: string
}

export interface TrialDevice {
  entityId: string
  address: string
  /** Do not try this credential on the device (it already holds it and it failed). */
  skipCredentialId?: string
}

export interface TrialResult {
  /** Devices that answered, with the credential that worked. */
  matched: Array<{ entityId: string; credentialId: string }>
  /** Devices that answered none of the credentials tried on them. */
  silent: string[]
}

/** Does `address` answer an SNMP GET with `community`? */
export type Probe = (address: string, community: string) => Promise<boolean>

/** The real probe: one SNMP v2c GET, no retry. */
export const probeSnmp: Probe = async (address, community) => {
  const client = new SnmpClient({
    address,
    community,
    timeoutMs: TRIAL_TIMEOUT_MS,
    retries: 0,
  })
  try {
    await client.get([SYS_OBJECT_ID])
    return true
  } catch {
    return false
  } finally {
    client.close()
  }
}

/**
 * Try `credentials` (in order) on every device. `probe` is injectable so the
 * logic is testable without a network.
 */
export async function trialDevices(
  devices: readonly TrialDevice[],
  credentials: readonly TrialCredential[],
  probe: Probe = probeSnmp,
  concurrency = TRIAL_CONCURRENCY,
): Promise<TrialResult> {
  const found = await mapWithConcurrency(devices, concurrency, async (device) => {
    for (const credential of credentials) {
      if (credential.id === device.skipCredentialId) continue
      if (await probe(device.address, credential.community)) {
        return { entityId: device.entityId, credentialId: credential.id }
      }
    }
    return null
  })
  const matched: TrialResult['matched'] = []
  const silent: string[] = []
  devices.forEach((device, i) => {
    const hit = found[i]
    if (hit) matched.push(hit)
    else silent.push(device.entityId)
  })
  return { matched, silent }
}

/**
 * Send one probe per device with one community and report which answered. Used
 * by "test this credential": it changes nothing and stores nothing.
 */
export async function probeDevices(
  devices: readonly TrialDevice[],
  community: string,
  probe: Probe = probeSnmp,
  concurrency = TRIAL_CONCURRENCY,
): Promise<{ answered: string[]; silent: string[] }> {
  const results = await mapWithConcurrency(devices, concurrency, (device) =>
    probe(device.address, community),
  )
  const answered: string[] = []
  const silent: string[] = []
  devices.forEach((device, i) => {
    if (results[i]) answered.push(device.entityId)
    else silent.push(device.entityId)
  })
  return { answered, silent }
}

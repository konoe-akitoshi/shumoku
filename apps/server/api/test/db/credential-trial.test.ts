// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/** Finding the working credential by trying: the pure trial (no database). */

import { describe, expect, test } from 'bun:test'
import { type Probe, probeDevices, trialDevices } from '../../src/discovery/credential-trial.ts'

describe('trialDevices', () => {
  test('each device keeps the first credential that answers, others are reported silent', async () => {
    // Device 0 answers "a", device 1 answers "b" (second), device 2 answers nothing.
    const answers: Record<string, string> = { '10.0.0.1': 'a', '10.0.0.2': 'b' }
    const probe: Probe = async (address, community) => answers[address] === community
    const result = await trialDevices(
      [
        { entityId: 'e0', address: '10.0.0.1' },
        { entityId: 'e1', address: '10.0.0.2' },
        { entityId: 'e2', address: '10.0.0.3' },
      ],
      [
        { id: 'pa', community: 'a' },
        { id: 'pb', community: 'b' },
      ],
      probe,
    )
    expect(result.matched).toEqual([
      { entityId: 'e0', credentialId: 'pa' },
      { entityId: 'e1', credentialId: 'pb' },
    ])
    expect(result.silent).toEqual(['e2'])
  })

  test('stops at the first answer: later credentials are not sent', async () => {
    const sent: string[] = []
    const probe: Probe = async (_address, community) => {
      sent.push(community)
      return true
    }
    await trialDevices(
      [{ entityId: 'e0', address: '10.0.0.1' }],
      [
        { id: 'p1', community: 'first' },
        { id: 'p2', community: 'second' },
      ],
      probe,
    )
    expect(sent).toEqual(['first'])
  })

  test('a throwing probe is not swallowed by the trial (the real probe swallows its own errors)', async () => {
    const probe: Probe = async () => {
      throw new Error('socket exploded')
    }
    // The real probe swallows errors itself; this pins what a throwing one does to the caller.
    await expect(
      trialDevices([{ entityId: 'e0', address: '10.0.0.1' }], [{ id: 'p', community: 'c' }], probe),
    ).rejects.toThrow('socket exploded')
  })

  test('no devices or no credentials is not an error', async () => {
    expect(await trialDevices([], [{ id: 'p', community: 'c' }], async () => true)).toEqual({
      matched: [],
      silent: [],
    })
    const none = await trialDevices([{ entityId: 'e0', address: '10.0.0.1' }], [], async () => true)
    expect(none).toEqual({ matched: [], silent: ['e0'] })
  })

  test('devices are tried at most `concurrency` at a time', async () => {
    let inFlight = 0
    let peak = 0
    const probe: Probe = async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return false
    }
    const devices = Array.from({ length: 20 }, (_, i) => ({
      entityId: `e${i}`,
      address: `10.0.0.${i + 1}`,
    }))
    await trialDevices(devices, [{ id: 'p', community: 'c' }], probe, 4)
    expect(peak).toBeLessThanOrEqual(4)
    expect(peak).toBeGreaterThan(1)
  })
})

describe('trialDevices: lost retry', () => {
  test('a device never has the credential it already holds tried again', async () => {
    const sent: string[] = []
    const probe: Probe = async (_address, community) => {
      sent.push(community)
      return community === 'b'
    }
    const result = await trialDevices(
      [{ entityId: 'e0', address: '10.0.0.1', skipCredentialId: 'pa' }],
      [
        { id: 'pa', community: 'a' },
        { id: 'pb', community: 'b' },
      ],
      probe,
    )
    expect(sent).toEqual(['b'])
    expect(result.matched).toEqual([{ entityId: 'e0', credentialId: 'pb' }])
  })
})

describe('probeDevices', () => {
  test('sends one probe per device with one community and reports who answered', async () => {
    const seen: string[] = []
    const probe: Probe = async (address, community) => {
      seen.push(`${address}|${community}`)
      return address === '10.0.0.1'
    }
    const result = await probeDevices(
      [
        { entityId: 'e0', address: '10.0.0.1' },
        { entityId: 'e1', address: '10.0.0.2' },
      ],
      'c',
      probe,
    )
    expect(seen.sort()).toEqual(['10.0.0.1|c', '10.0.0.2|c'])
    expect(result).toEqual({ answered: ['e0'], silent: ['e1'] })
  })
})

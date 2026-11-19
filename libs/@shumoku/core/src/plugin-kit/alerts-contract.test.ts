import { describe, expect, it } from 'vitest'
import type { Alert } from '../plugin-types.js'
import { meetsAlertsContract, validateAlertsContract } from './alerts-contract.js'

const alert = (over: Partial<Alert>): Alert => ({
  id: 'a',
  severity: 'medium',
  title: 't',
  startTime: 1,
  status: 'active',
  source: 'test',
  ...over,
})

describe('alerts contract', () => {
  it('accepts alerts with unique ids, finite start times and known statuses', () => {
    const result = validateAlertsContract([
      alert({ id: 'a' }),
      alert({ id: 'b', status: 'resolved' }),
    ])
    expect(meetsAlertsContract(result)).toBe(true)
  })

  it('names what breaks it', () => {
    const result = validateAlertsContract([
      alert({ id: '' }),
      alert({ id: 'x' }),
      alert({ id: 'x' }),
      alert({ id: 'y', startTime: Number.NaN }),
      alert({ id: 'z', status: 'open' as Alert['status'] }),
    ])
    expect(result).toEqual({
      missingId: [0],
      duplicateIds: ['x'],
      badStartTime: ['y'],
      badStatus: ['z'],
    })
    expect(meetsAlertsContract(result)).toBe(false)
  })
})

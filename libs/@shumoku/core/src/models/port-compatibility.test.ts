import { describe, expect, test } from 'bun:test'
import {
  defaultMediumForPorts,
  isPoeCapableConnector,
  validatePortMediumCompatibility,
} from './port-compatibility.js'
import type { NodePort } from './types.js'

const port = (label: string, connector: string, poe = false): NodePort => ({
  id: label,
  label,
  connector,
  poe,
})

describe('port medium compatibility', () => {
  test('defaults RJ45 links to twisted pair', () => {
    expect(defaultMediumForPorts(port('1', 'rj45'), port('2', 'rj45'))).toEqual({
      kind: 'twisted-pair',
    })
  })

  test('defaults SFP/QSFP links to fiber', () => {
    expect(defaultMediumForPorts(port('Te1/0/1', 'sfp+'), port('Te1/0/2', 'sfp+'))).toEqual({
      kind: 'fiber',
    })
  })

  test('rejects PoE on pluggable ports', () => {
    const issues = validatePortMediumCompatibility(
      port('Te1/0/1', 'sfp+', true),
      port('Te1/0/2', 'sfp+'),
      { kind: 'fiber' },
    )
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true)
  })

  test('warns for RJ45 to SFP links', () => {
    const issues = validatePortMediumCompatibility(
      port('Gi1/0/1', 'rj45'),
      port('Te1/0/1', 'sfp+'),
      { kind: 'twisted-pair' },
    )
    expect(issues.some((issue) => issue.severity === 'warning')).toBe(true)
  })

  test('only RJ45 is PoE-capable by connector', () => {
    expect(isPoeCapableConnector('rj45')).toBe(true)
    expect(isPoeCapableConnector('sfp+')).toBe(false)
  })
})

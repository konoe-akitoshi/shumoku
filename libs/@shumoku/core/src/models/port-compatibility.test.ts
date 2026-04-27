import { describe, expect, test } from 'vitest'
import {
  defaultMediumForLink,
  isPoeCapableConnector,
  validateLinkCompatibility,
} from './port-compatibility.js'
import type { NodePort, PlugSpec } from './types.js'

const port = (label: string, cage: string, poe = false): NodePort => ({
  id: label,
  label,
  cage,
  poe,
})

const plug = (connector: string): PlugSpec => ({ connector })

describe('link compatibility', () => {
  test('defaults RJ45 links to twisted pair', () => {
    expect(
      defaultMediumForLink(port('1', 'rj45'), port('2', 'rj45'), plug('rj45'), plug('rj45')),
    ).toEqual({ kind: 'twisted-pair' })
  })

  test('defaults SFP/QSFP links to fiber', () => {
    expect(
      defaultMediumForLink(
        port('Te1/0/1', 'sfp+'),
        port('Te1/0/2', 'sfp+'),
        plug('sfp+'),
        plug('sfp+'),
      ),
    ).toEqual({ kind: 'fiber' })
  })

  test('rejects PoE on pluggable cages', () => {
    const issues = validateLinkCompatibility(
      port('Te1/0/1', 'sfp+', true),
      port('Te1/0/2', 'sfp+'),
      plug('sfp+'),
      plug('sfp+'),
      { kind: 'fiber' },
    )
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true)
  })

  test('warns when plug does not match cage (transceiver needed)', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+'),
      port('2', 'sfp+'),
      plug('rj45'),
      plug('sfp+'),
      { kind: 'fiber' },
    )
    expect(issues.some((issue) => issue.severity === 'warning')).toBe(true)
  })

  test('warns for RJ45-to-SFP links by effective connector', () => {
    const issues = validateLinkCompatibility(
      port('Gi1/0/1', 'rj45'),
      port('Te1/0/1', 'sfp+'),
      plug('rj45'),
      plug('sfp+'),
      { kind: 'twisted-pair' },
    )
    expect(issues.some((issue) => issue.severity === 'warning')).toBe(true)
  })

  test('only RJ45 is PoE-capable by connector', () => {
    expect(isPoeCapableConnector('rj45')).toBe(true)
    expect(isPoeCapableConnector('sfp+')).toBe(false)
  })
})

import { describe, expect, test } from 'vitest'
import {
  defaultStandardForCages,
  isPoeCapableConnector,
  validateLinkCompatibility,
} from './port-compatibility.js'
import type { Link, NodePort } from './types.js'

const port = (label: string, cage: string, poe = false): NodePort => ({
  id: label,
  label,
  cage,
  poe,
})

const link = (overrides: Partial<Link>): Link => ({
  from: { node: 'a', port: 'p1' },
  to: { node: 'b', port: 'p2' },
  ...overrides,
})

describe('link compatibility', () => {
  test('1000BASE-T fits two RJ45 cages', () => {
    expect(
      validateLinkCompatibility(
        port('1', 'rj45'),
        port('2', 'rj45'),
        link({ standard: '1000BASE-T' }),
      ),
    ).toEqual([])
  })

  test('rejects 10GBASE-SR on RJ45 cage', () => {
    const issues = validateLinkCompatibility(
      port('1', 'rj45'),
      port('2', 'sfp+'),
      link({ standard: '10GBASE-SR' }),
    )
    expect(issues.some((i) => i.severity === 'error')).toBe(true)
  })

  test('flags PoE on a pluggable cage as misconfig', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+', true),
      port('2', 'sfp+'),
      link({ standard: '10GBASE-SR' }),
    )
    expect(issues.some((i) => i.severity === 'error')).toBe(true)
  })

  test('warns when cable length exceeds standard reach', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+'),
      port('2', 'sfp+'),
      link({ standard: '10GBASE-SR', cable: { length_m: 1000 } }),
    )
    expect(issues.some((i) => i.severity === 'warning')).toBe(true)
  })

  test('reach drops with weaker cable grade (10GBASE-T over Cat6)', () => {
    // 10GBASE-T spec max is 100m on Cat6a; Cat6 caps it at 55m.
    // 70m on Cat6 should warn even though it fits the spec maximum.
    const issues = validateLinkCompatibility(
      port('1', 'rj45'),
      port('2', 'rj45'),
      link({ standard: '10GBASE-T', cable: { category: 'cat6', length_m: 70 } }),
    )
    expect(issues.some((i) => i.severity === 'warning')).toBe(true)
  })

  test('reach drops on OM3 fiber for 10GBASE-SR', () => {
    // 10GBASE-SR is 400m on OM4 but only 300m on OM3.
    const issues = validateLinkCompatibility(
      port('1', 'sfp+'),
      port('2', 'sfp+'),
      link({ standard: '10GBASE-SR', cable: { category: 'om3', length_m: 350 } }),
    )
    expect(issues.some((i) => i.severity === 'warning')).toBe(true)
  })

  test('combo cage accepts any standard', () => {
    expect(
      validateLinkCompatibility(
        port('1', 'combo'),
        port('2', 'rj45'),
        link({ standard: '1000BASE-T' }),
      ),
    ).toEqual([])
  })

  test('only RJ45 is PoE-capable', () => {
    expect(isPoeCapableConnector('rj45')).toBe(true)
    expect(isPoeCapableConnector('sfp+')).toBe(false)
  })

  test('proposes default standard from cage pair', () => {
    expect(defaultStandardForCages('rj45', 'rj45')).toBe('1000BASE-T')
    expect(defaultStandardForCages('sfp+', 'sfp+')).toBe('10GBASE-SR')
    expect(defaultStandardForCages('sfp+', 'rj45')).toBeUndefined()
  })
})

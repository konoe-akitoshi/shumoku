import { describe, expect, test } from 'vitest'
import {
  defaultStandardForCages,
  findComboInterfaceConflicts,
  isPoeCapableConnector,
  issuesForTarget,
  plugFromStandard,
  validateLinkCompatibility,
} from './port-compatibility.js'
import type { EthernetStandard, Link, LinkCable, NodePort } from './types.js'

const port = (label: string, cage: string, poe = false): NodePort => ({
  id: label,
  label,
  cage,
  poe,
})

const comboPort = (id: string, cage: string, interfaceName: string): NodePort => ({
  id,
  label: id,
  cage,
  interfaceName,
})

const link = (
  fromStd?: EthernetStandard,
  toStd?: EthernetStandard,
  cable?: LinkCable,
): Pick<Link, 'from' | 'to' | 'cable'> => ({
  from: { node: 'a', port: 'p1', plug: fromStd ? plugFromStandard(fromStd) : undefined },
  to: { node: 'b', port: 'p2', plug: toStd ? plugFromStandard(toStd) : undefined },
  cable,
})

describe('link compatibility', () => {
  test('1000BASE-T fits two RJ45 cages (symmetric)', () => {
    expect(
      validateLinkCompatibility(
        port('1', 'rj45'),
        port('2', 'rj45'),
        link('1000BASE-T', '1000BASE-T'),
      ),
    ).toEqual([])
  })

  test('rejects 10GBASE-SR on RJ45 cage', () => {
    const issues = validateLinkCompatibility(
      port('1', 'rj45'),
      port('2', 'sfp+'),
      link('10GBASE-SR', '10GBASE-SR'),
    )
    expect(issues.some((i) => i.severity === 'error')).toBe(true)
  })

  test('flags PoE on a pluggable cage as misconfig', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+', true),
      port('2', 'sfp+'),
      link('10GBASE-SR', '10GBASE-SR'),
    )
    expect(issues.some((i) => i.severity === 'error')).toBe(true)
  })

  test('warns when cable length exceeds standard reach', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+'),
      port('2', 'sfp+'),
      link('10GBASE-SR', '10GBASE-SR', { length_m: 1000 }),
    )
    expect(issues.some((i) => i.severity === 'warning')).toBe(true)
  })

  test('combo cage accepts any standard', () => {
    expect(
      validateLinkCompatibility(
        port('1', 'combo'),
        port('2', 'rj45'),
        link('1000BASE-T', '1000BASE-T'),
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

  test('reach drops with weaker cable grade (10GBASE-T over Cat6)', () => {
    const issues = validateLinkCompatibility(
      port('1', 'rj45'),
      port('2', 'rj45'),
      link('10GBASE-T', '10GBASE-T', { category: 'cat6', length_m: 70 }),
    )
    expect(issues.some((i) => i.severity === 'warning')).toBe(true)
  })

  test('reach drops on OM3 fiber for 10GBASE-SR', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+'),
      port('2', 'sfp+'),
      link('10GBASE-SR', '10GBASE-SR', { category: 'om3', length_m: 350 }),
    )
    expect(issues.some((i) => i.severity === 'warning')).toBe(true)
  })

  test('warns on asymmetric per-endpoint standards', () => {
    // Both ends have a standard but they differ — typical BiDi pair, but
    // we surface a soft warning so accidental mismatches are visible.
    const issues = validateLinkCompatibility(
      port('1', 'sfp+'),
      port('2', 'sfp+'),
      link('10GBASE-SR' as EthernetStandard, '10GBASE-LR' as EthernetStandard),
    )
    expect(issues.some((i) => i.severity === 'warning')).toBe(true)
  })

  test('one-sided standard (only fromTransceiver set) still validates cage', () => {
    const issues = validateLinkCompatibility(
      port('1', 'rj45'),
      port('2', 'sfp+'),
      link('10GBASE-SR' as EthernetStandard, undefined),
    )
    // from cage RJ45 cannot host 10GBASE-SR (requires SFP+).
    expect(issues.some((i) => i.severity === 'error')).toBe(true)
  })
})

describe('issue targets', () => {
  test('cage mismatch issue targets the source endpoint plug.module', () => {
    const issues = validateLinkCompatibility(
      port('1', 'rj45'),
      port('2', 'sfp+'),
      link('10GBASE-SR', '10GBASE-SR'),
    )
    const matching = issuesForTarget(issues, {
      kind: 'endpoint',
      side: 'source',
      field: 'plug.module',
    })
    expect(matching.length).toBeGreaterThan(0)
    expect(matching[0]?.code).toBe('port-cage-cannot-host-module')
  })

  test('reach warning targets cable.length_m', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+'),
      port('2', 'sfp+'),
      link('10GBASE-SR', '10GBASE-SR', { length_m: 1000 }),
    )
    const matching = issuesForTarget(issues, { kind: 'cable', field: 'length_m' })
    expect(matching).toHaveLength(1)
    expect(matching[0]?.code).toBe('cable-length-exceeds-reach')
    expect(matching[0]?.severity).toBe('warning')
  })

  test('asymmetric warning targets the link as a whole', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+'),
      port('2', 'sfp+'),
      link('10GBASE-SR', '10GBASE-LR'),
    )
    const matching = issuesForTarget(issues, { kind: 'link' })
    expect(matching.some((i) => i.code === 'endpoints-standards-asymmetric')).toBe(true)
  })

  test('PoE flag on non-RJ45 cage targets port.poe', () => {
    const issues = validateLinkCompatibility(
      port('1', 'sfp+', true),
      port('2', 'sfp+'),
      link('10GBASE-SR', '10GBASE-SR'),
    )
    const matching = issuesForTarget(issues, { kind: 'port', side: 'source', field: 'poe' })
    expect(matching).toHaveLength(1)
    expect(matching[0]?.code).toBe('poe-flag-on-non-rj45')
  })
})

describe('combo interface conflicts', () => {
  const rj45 = comboPort('GE0', 'rj45', 'GigaEthernet0.0')
  const sfp = comboPort('GE0(SFP)', 'sfp', 'GigaEthernet0.0')

  test('flags two active links on a shared interface', () => {
    const linked = new Set(['GE0', 'GE0(SFP)'])
    const issues = findComboInterfaceConflicts([rj45, sfp], (p) => linked.has(p.id))
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('combo-interface-multi-active')
    expect(issues[0]?.severity).toBe('warning')
  })

  test('no issue when only one combo side is connected', () => {
    const linked = new Set(['GE0'])
    const issues = findComboInterfaceConflicts([rj45, sfp], (p) => linked.has(p.id))
    expect(issues).toEqual([])
  })

  test('ports without shared interface name are ignored', () => {
    const ge1 = comboPort('GE1', 'rj45', 'GigaEthernet1.0')
    const linked = new Set(['GE0', 'GE1'])
    const issues = findComboInterfaceConflicts([rj45, ge1], (p) => linked.has(p.id))
    expect(issues).toEqual([])
  })

  test('reports separate issues for distinct combo groups', () => {
    const rj45b = comboPort('GE2', 'rj45', 'GigaEthernet2.0')
    const sfpb = comboPort('GE2(SFP+)', 'sfp+', 'GigaEthernet2.0')
    const linked = new Set(['GE0', 'GE0(SFP)', 'GE2', 'GE2(SFP+)'])
    const issues = findComboInterfaceConflicts([rj45, sfp, rj45b, sfpb], (p) => linked.has(p.id))
    expect(issues).toHaveLength(2)
  })
})

describe('issue targets — cable medium', () => {
  test('cable medium / category mismatch targets cable.medium', () => {
    const issues = validateLinkCompatibility(
      port('1', 'rj45'),
      port('2', 'rj45'),
      link('1000BASE-T', '1000BASE-T', { medium: 'fiber-mm', category: 'cat6a' }),
    )
    const matching = issuesForTarget(issues, { kind: 'cable', field: 'medium' })
    expect(matching).toHaveLength(1)
    expect(matching[0]?.code).toBe('cable-medium-category-mismatch')
  })
})

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { displayPortName, displayPortNames } from './port-name.js'

describe('displayPortName', () => {
  const table: [string, string][] = [
    ['HundredGigabitEthernet1/0/1', 'Hu1/0/1'],
    ['HundredGigE1/0/1', 'Hu1/0/1'],
    ['FortyGigabitEthernet1/0/1', 'Fo1/0/1'],
    ['TwentyFiveGigE1/0/1', 'Twe1/0/1'],
    ['TenGigabitEthernet1/0/1', 'Te1/0/1'],
    ['TwoGigabitEthernet1/0/1', 'Tw1/0/1'],
    ['FiveGigabitEthernet1/0/1', 'Fi1/0/1'],
    ['GigabitEthernet1/0/1', 'Gi1/0/1'],
    ['FastEthernet0/1', 'Fa0/1'],
    ['Ethernet1/49', 'Et1/49'],
    ['Management1', 'Ma1'],
    ['Port-Channel12', 'Po12'],
    ['Port-channel12', 'Po12'],
    ['Loopback0', 'Lo0'],
    ['Bundle-Ether12', 'BE12'],
    ['Ten-GigabitEthernet1/0/1', 'XGE1/0/1'],
    ['Twenty-FiveGigE1/0/1', 'WGE1/0/1'],
    ['FortyGigE1/0/1', 'FGE1/0/1'],
    ['M-GigabitEthernet0/0/0', 'MGE0/0/0'],
    ['Tunnel100000', 'Tu100000'],
    ['Vlan100000', 'Vl100000'],
  ]
  it.each(table)('%s -> %s', (full, short) => {
    expect(displayPortName(full)).toBe(short)
  })

  it('leaves short or unknown names alone', () => {
    expect(displayPortName('Vlan10')).toBe('Vlan10')
    expect(displayPortName('EthernetX1/1')).toBe('EthernetX1/1')
    expect(displayPortName('25GE1/0/48')).toBe('25GE1/0/48')
    expect(displayPortName('port1.24')).toBe('port1.24')
    expect(displayPortName('mgmt0')).toBe('mgmt0')
    expect(displayPortName('xe-0/0/1')).toBe('xe-0/0/1')
    expect(displayPortName('Ethernet')).toBe('Ethernet')
  })

  it('matches without regard to case, and trims', () => {
    expect(displayPortName('ethernet1/49')).toBe('Et1/49')
    expect(displayPortName('  Ethernet1/49 ')).toBe('Et1/49')
  })

  it('drops the word Interface', () => {
    expect(displayPortName('Interface eth1')).toBe('eth1')
    expect(displayPortName('Port 1')).toBe('Port 1')
  })
})

describe('displayPortNames', () => {
  it('shortens each name of a box', () => {
    const out = displayPortNames(['Ethernet1', 'Ethernet2'])
    expect(out.get('Ethernet1')).toBe('Et1')
    expect(out.get('Ethernet2')).toBe('Et2')
  })

  it('puts back the names that would show alike', () => {
    const out = displayPortNames(['Ethernet1', 'Et1'])
    expect(out.get('Ethernet1')).toBe('Ethernet1')
    expect(out.get('Et1')).toBe('Et1')
  })

  it('puts back a name that shows like a plain one once Interface is dropped', () => {
    const out = displayPortNames(['Interface eth1', 'eth1'])
    expect(out.get('Interface eth1')).toBe('Interface eth1')
  })
})

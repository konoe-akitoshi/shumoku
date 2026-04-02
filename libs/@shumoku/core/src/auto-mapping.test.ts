import { describe, expect, it } from 'vitest'
import {
  findBestInterfaceMatch,
  interfaceMatchScore,
  nodeNameMatchScore,
  normalizeInterfaceName,
  rankInterfaceMatches,
} from './auto-mapping'

// ============================================
// normalizeInterfaceName
// ============================================

describe('normalizeInterfaceName', () => {
  it('normalizes Cisco full names', () => {
    const r = normalizeInterfaceName('GigabitEthernet1/0/2')
    expect(r.prefix).toBe('ge')
    expect(r.numbers).toEqual([1, 0, 2])
    expect(r.sub).toBeNull()
  })

  it('normalizes Cisco abbreviations', () => {
    const r = normalizeInterfaceName('Gi1/0/1')
    expect(r.prefix).toBe('ge')
    expect(r.numbers).toEqual([1, 0, 1])
  })

  it('normalizes NetBox short names', () => {
    const r = normalizeInterfaceName('GE0/1')
    expect(r.prefix).toBe('ge')
    expect(r.numbers).toEqual([0, 1])
  })

  it('normalizes UNIVERGE IX names', () => {
    const r = normalizeInterfaceName('GigaEthernet0')
    expect(r.prefix).toBe('ge')
    expect(r.numbers).toEqual([0])
  })

  it('handles sub-interface suffix', () => {
    const r = normalizeInterfaceName('GigaEthernet0.0')
    expect(r.prefix).toBe('ge')
    expect(r.numbers).toEqual([0])
    expect(r.sub).toBe(0)
  })

  it('handles sub-interface on last segment only', () => {
    const r = normalizeInterfaceName('GigaEthernet3.0')
    expect(r.prefix).toBe('ge')
    expect(r.numbers).toEqual([3])
    expect(r.sub).toBe(0)
  })

  it('normalizes TenGig', () => {
    expect(normalizeInterfaceName('Te1/1/1').prefix).toBe('te')
    expect(normalizeInterfaceName('TenGigabitEthernet0/1').prefix).toBe('te')
    expect(normalizeInterfaceName('TE1/1').prefix).toBe('te')
    expect(normalizeInterfaceName('xe-0/0/2').prefix).toBe('te')
  })

  it('normalizes Linux ethernet', () => {
    const r = normalizeInterfaceName('eth0')
    expect(r.prefix).toBe('eth')
    expect(r.numbers).toEqual([0])
  })

  it('normalizes LAG variants', () => {
    expect(normalizeInterfaceName('Port-Channel1').prefix).toBe('lag')
    expect(normalizeInterfaceName('Po1').prefix).toBe('lag')
    expect(normalizeInterfaceName('ae0').prefix).toBe('lag')
    expect(normalizeInterfaceName('bond0').prefix).toBe('lag')
  })

  it('normalizes VLAN', () => {
    expect(normalizeInterfaceName('Vl128').prefix).toBe('vlan')
    expect(normalizeInterfaceName('VLAN-128').prefix).toBe('vlan')
    expect(normalizeInterfaceName('irb0').prefix).toBe('vlan')
  })

  it('normalizes tunnel', () => {
    expect(normalizeInterfaceName('Tunnel0').prefix).toBe('tun')
    expect(normalizeInterfaceName('Tu0').prefix).toBe('tun')
  })

  it('handles unknown prefixes gracefully', () => {
    const r = normalizeInterfaceName('wired0')
    expect(r.prefix).toBe('wired')
    expect(r.numbers).toEqual([0])
  })

  it('handles AP main interface', () => {
    const r = normalizeInterfaceName('main')
    expect(r.prefix).toBe('main')
    expect(r.numbers).toEqual([])
  })

  it('preserves original', () => {
    expect(normalizeInterfaceName('GE0/1').original).toBe('GE0/1')
  })
})

// ============================================
// interfaceMatchScore
// ============================================

describe('interfaceMatchScore', () => {
  const n = normalizeInterfaceName

  it('scores exact match as 1.0', () => {
    expect(interfaceMatchScore(n('Gi1/0/1'), n('Gi1/0/1'))).toBe(1.0)
  })

  it('matches different abbreviations for same port', () => {
    // GE0/1 [0,1] vs Gi1/0/1 [1,0,1] → right-to-left: 1==1, 0==0 → 2/3 match
    const score = interfaceMatchScore(n('GE0/1'), n('Gi1/0/1'))
    expect(score).toBeGreaterThan(0.5)
  })

  it('matches UNIVERGE IX style: GE0/0 ↔ GigaEthernet0', () => {
    const score = interfaceMatchScore(n('GE0/0'), n('GigaEthernet0'))
    expect(score).toBeGreaterThan(0.5)
  })

  it('matches UNIVERGE IX style: GE0/2 ↔ GigaEthernet2', () => {
    const score = interfaceMatchScore(n('GE0/2'), n('GigaEthernet2'))
    expect(score).toBeGreaterThan(0.5)
  })

  it('matches TenGig: TE1/1 ↔ Te1/1/1', () => {
    const score = interfaceMatchScore(n('TE1/1'), n('Te1/1/1'))
    expect(score).toBeGreaterThan(0.5)
  })

  it('matches Cisco ASR: GE0/0 ↔ Gi0/0/0', () => {
    const score = interfaceMatchScore(n('GE0/0'), n('Gi0/0/0'))
    expect(score).toBeGreaterThan(0.5)
  })

  it('matches Cisco ASR TenGig: TE0/0 ↔ Te0/0/0', () => {
    const score = interfaceMatchScore(n('TE0/0'), n('Te0/0/0'))
    expect(score).toBeGreaterThan(0.5)
  })

  it('rejects different port numbers', () => {
    expect(interfaceMatchScore(n('GE0/1'), n('Gi1/0/2'))).toBe(0)
  })

  it('rejects different types', () => {
    expect(interfaceMatchScore(n('GE0/1'), n('Te1/0/1'))).toBe(0)
  })

  it('ignores sub-interface for matching', () => {
    const a = n('GigaEthernet0')
    const b = n('GigaEthernet0.0')
    expect(interfaceMatchScore(a, b)).toBeGreaterThan(0.5)
  })

  it('matches LAG variants', () => {
    expect(interfaceMatchScore(n('Po1'), n('Port-Channel1'))).toBe(1.0)
    expect(interfaceMatchScore(n('ae0'), n('bond0'))).toBe(1.0)
  })
})

// ============================================
// findBestInterfaceMatch - real-world scenarios
// ============================================

describe('findBestInterfaceMatch', () => {
  it('UNIVERGE IX: NetBox GE0/N ↔ Zabbix GigaEthernetN', () => {
    const zabbixInterfaces = [
      'GigaEthernet0',
      'GigaEthernet1',
      'GigaEthernet2',
      'GigaEthernet3',
      'GigaEthernet5',
    ]
    expect(findBestInterfaceMatch('GE0/0', zabbixInterfaces)).toBe('GigaEthernet0')
    expect(findBestInterfaceMatch('GE0/1', zabbixInterfaces)).toBe('GigaEthernet1')
    expect(findBestInterfaceMatch('GE0/2', zabbixInterfaces)).toBe('GigaEthernet2')
    expect(findBestInterfaceMatch('GE0/3', zabbixInterfaces)).toBe('GigaEthernet3')
    expect(findBestInterfaceMatch('GE0/5', zabbixInterfaces)).toBe('GigaEthernet5')
  })

  it('Cisco Catalyst: NetBox GE0/N ↔ Zabbix Gi1/0/N', () => {
    const zabbixInterfaces = [
      'Gi1/0/1',
      'Gi1/0/2',
      'Gi1/0/3',
      'Gi1/0/4',
      'Gi1/0/10',
      'Gi1/0/22',
      'Gi1/0/24',
      'Te1/1/1',
      'Te1/1/2',
      'Te1/1/3',
      'Te1/1/4',
    ]
    expect(findBestInterfaceMatch('GE0/1', zabbixInterfaces)).toBe('Gi1/0/1')
    expect(findBestInterfaceMatch('GE0/2', zabbixInterfaces)).toBe('Gi1/0/2')
    expect(findBestInterfaceMatch('GE0/3', zabbixInterfaces)).toBe('Gi1/0/3')
    expect(findBestInterfaceMatch('GE0/10', zabbixInterfaces)).toBe('Gi1/0/10')
    expect(findBestInterfaceMatch('GE0/24', zabbixInterfaces)).toBe('Gi1/0/24')
    expect(findBestInterfaceMatch('TE1/1', zabbixInterfaces)).toBe('Te1/1/1')
    expect(findBestInterfaceMatch('TE1/2', zabbixInterfaces)).toBe('Te1/1/2')
  })

  it('Cisco ASR: NetBox GE0/N ↔ Zabbix Gi0/0/N', () => {
    const zabbixInterfaces = [
      'Gi0',
      'Gi0/0/0',
      'Gi0/0/1',
      'Gi0/0/2',
      'Gi0/0/3',
      'Gi0/0/4',
      'Gi0/0/5',
      'Te0/0/0',
      'Te0/0/1',
    ]
    expect(findBestInterfaceMatch('GE0/0', zabbixInterfaces)).toBe('Gi0/0/0')
    expect(findBestInterfaceMatch('GE0/1', zabbixInterfaces)).toBe('Gi0/0/1')
    expect(findBestInterfaceMatch('GE0/5', zabbixInterfaces)).toBe('Gi0/0/5')
    expect(findBestInterfaceMatch('TE0/0', zabbixInterfaces)).toBe('Te0/0/0')
    expect(findBestInterfaceMatch('TE0/1', zabbixInterfaces)).toBe('Te0/0/1')
  })

  it('Cisco full name: NetBox GigabitEthernet1/0/N ↔ Zabbix Gi1/0/N', () => {
    const zabbixInterfaces = ['Gi1/0/1', 'Gi1/0/2', 'Gi1/0/3', 'Gi1/0/48']
    expect(findBestInterfaceMatch('GigabitEthernet1/0/1', zabbixInterfaces)).toBe('Gi1/0/1')
    expect(findBestInterfaceMatch('GigabitEthernet1/0/48', zabbixInterfaces)).toBe('Gi1/0/48')
  })

  it('returns null for unmatched prefix by default', () => {
    expect(findBestInterfaceMatch('main', ['wired0'])).toBeNull()
  })

  it('AP single candidate fallback: main ↔ wired0', () => {
    expect(findBestInterfaceMatch('main', ['wired0'], { singleCandidateFallback: true })).toBe(
      'wired0',
    )
  })

  it('single candidate fallback disabled by default', () => {
    expect(
      findBestInterfaceMatch('main', ['wired0'], { singleCandidateFallback: false }),
    ).toBeNull()
  })

  it('single candidate fallback only works with exactly 1 candidate', () => {
    expect(
      findBestInterfaceMatch('main', ['wired0', 'wired1'], { singleCandidateFallback: true }),
    ).toBeNull()
  })

  it('returns null for empty candidates', () => {
    expect(findBestInterfaceMatch('GE0/1', [])).toBeNull()
  })

  it('Juniper xe style', () => {
    const candidates = ['xe-0/0/0', 'xe-0/0/1', 'xe-0/0/2']
    expect(findBestInterfaceMatch('xe-0/0/1', candidates)).toBe('xe-0/0/1')
    expect(findBestInterfaceMatch('TE0/1', candidates)).toBe('xe-0/0/1')
  })
})

// ============================================
// rankInterfaceMatches
// ============================================

describe('rankInterfaceMatches', () => {
  it('ranks candidates by score descending', () => {
    const candidates = ['Gi1/0/1', 'Gi1/0/2', 'Te1/1/1']
    const ranked = rankInterfaceMatches('GE0/1', candidates)
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked[0].name).toBe('Gi1/0/1')
  })

  it('filters out below threshold', () => {
    const ranked = rankInterfaceMatches('GE0/1', ['Te1/1/1', 'Lo0'], 0.5)
    expect(ranked.every((r) => r.score >= 0.5)).toBe(true)
  })
})

// ============================================
// nodeNameMatchScore
// ============================================

describe('nodeNameMatchScore', () => {
  it('exact match → 1.0', () => {
    expect(nodeNameMatchScore('l3-noc-01', 'l3-noc-01')).toBe(1.0)
  })

  it('case insensitive exact match', () => {
    expect(nodeNameMatchScore('SW13', 'sw13')).toBe(1.0)
  })

  it('display name match', () => {
    expect(nodeNameMatchScore('l3-noc-01', 'some-host', 'l3-noc-01')).toBe(1.0)
  })

  it('base name match without domain', () => {
    expect(nodeNameMatchScore('router1', 'router1.example.com')).toBe(0.9)
  })

  it('partial containment', () => {
    const score = nodeNameMatchScore('noc-01', 'l3-noc-01')
    expect(score).toBe(0.7)
  })

  it('no match → 0', () => {
    expect(nodeNameMatchScore('router1', 'switch2')).toBe(0)
  })

  it('NetBox HV01 vs Zabbix hv01 (case diff)', () => {
    expect(nodeNameMatchScore('HV01', 'hv01')).toBe(1.0)
  })
})

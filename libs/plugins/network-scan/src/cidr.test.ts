// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { expandCidr, expandTargets, isCidr, isIPv4, MAX_HOSTS } from './cidr.js'

describe('cidr utilities', () => {
  describe('isIPv4', () => {
    it.each([
      ['10.0.0.1', true],
      ['255.255.255.255', true],
      ['0.0.0.0', true],
      ['10.0.0', false],
      ['10.0.0.256', false],
      ['10.0.0.a', false],
      ['fe80::1', false],
      ['', false],
    ])('isIPv4(%j) → %j', (input, expected) => {
      expect(isIPv4(input)).toBe(expected)
    })
  })

  describe('isCidr', () => {
    it.each([
      ['10.0.0.0/24', true],
      ['10.0.0.5/32', true],
      ['10.0.0.0/0', true],
      ['10.0.0.5', false],
      ['10.0.0.5/', false],
      ['fe80::/64', false], // IPv6 not supported in v1
      ['10.0.0/24', false],
    ])('isCidr(%j) → %j', (input, expected) => {
      expect(isCidr(input)).toBe(expected)
    })
  })

  describe('expandCidr', () => {
    it('/32 → single host', () => {
      expect(expandCidr('10.0.0.5/32')).toEqual(['10.0.0.5'])
    })

    it('/31 → both addresses (RFC 3021 point-to-point)', () => {
      expect(expandCidr('10.0.0.0/31')).toEqual(['10.0.0.0', '10.0.0.1'])
    })

    it('/30 → 2 hosts (excludes .0 network and .3 broadcast)', () => {
      expect(expandCidr('10.0.0.0/30')).toEqual(['10.0.0.1', '10.0.0.2'])
    })

    it('/24 → 254 hosts, no .0 or .255', () => {
      const hosts = expandCidr('192.168.1.0/24')
      expect(hosts).toHaveLength(254)
      expect(hosts[0]).toBe('192.168.1.1')
      expect(hosts[253]).toBe('192.168.1.254')
      expect(hosts).not.toContain('192.168.1.0')
      expect(hosts).not.toContain('192.168.1.255')
    })

    it('normalizes the base address (10.0.0.5/24 → 10.0.0.x)', () => {
      const hosts = expandCidr('10.0.0.5/24')
      expect(hosts[0]).toBe('10.0.0.1')
      expect(hosts).toHaveLength(254)
    })

    it('rejects expansion larger than MAX_HOSTS', () => {
      // /8 = 16M addresses — way over the limit
      expect(() => expandCidr('10.0.0.0/8')).toThrow(/refusing/)
    })

    it('allows /16 (exactly 65,534 hosts)', () => {
      const hosts = expandCidr('10.0.0.0/16')
      expect(hosts.length).toBeLessThanOrEqual(MAX_HOSTS)
    })

    it('rejects invalid prefix', () => {
      expect(() => expandCidr('10.0.0.0/33')).toThrow()
    })

    it('rejects non-CIDR input', () => {
      expect(() => expandCidr('10.0.0.1')).toThrow(/Not a valid/)
    })
  })

  describe('expandTargets', () => {
    it('passes single IPs through', () => {
      expect(expandTargets(['10.0.0.1', '10.0.0.2'])).toEqual(['10.0.0.1', '10.0.0.2'])
    })

    it('passes hostnames through', () => {
      expect(expandTargets(['core-rtr-01', 'sw01.example.net'])).toEqual([
        'core-rtr-01',
        'sw01.example.net',
      ])
    })

    it('expands CIDR entries', () => {
      const out = expandTargets(['10.0.0.0/30'])
      expect(out).toEqual(['10.0.0.1', '10.0.0.2'])
    })

    it('mixes CIDR + single IPs + hostnames', () => {
      const out = expandTargets(['10.0.0.1', '192.168.5.0/30', 'core-rtr-01'])
      expect(out).toEqual(['10.0.0.1', '192.168.5.1', '192.168.5.2', 'core-rtr-01'])
    })

    it('deduplicates while preserving first-occurrence order', () => {
      const out = expandTargets(['10.0.0.1', '10.0.0.0/30', '10.0.0.1'])
      // 10.0.0.1 was listed first explicitly, then again from the CIDR — kept once
      expect(out).toEqual(['10.0.0.1', '10.0.0.2'])
    })

    it('skips empty / whitespace entries', () => {
      expect(expandTargets(['', '  ', '10.0.0.1'])).toEqual(['10.0.0.1'])
    })

    it('propagates CIDR errors', () => {
      expect(() => expandTargets(['10.0.0.0/8'])).toThrow(/refusing/)
    })
  })
})

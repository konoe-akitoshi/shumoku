import { describe, expect, it } from 'vitest'
import { decodeChassisId, decodePortId, portNameOf } from './lldp-id.js'

const hex = (value: string) => Buffer.from(value.replaceAll(':', ''), 'hex')

// The values below were read from Arista 7050SX3 switches on a live show network.
describe('decodeChassisId', () => {
  it('reads subtype 4 as a MAC address', () => {
    expect(decodeChassisId(hex('000e88003dae'), 4)).toEqual({
      kind: 'mac',
      value: '00:0e:88:00:3d:ae',
    })
  })

  it('reads subtype 7 as the string the device chose, not as a MAC', () => {
    // 13 bytes that spell NEO2101.01071; read as a MAC they became a colon-separated hex run.
    expect(decodeChassisId(hex('4e454f323130312e3031303731'), 7)).toEqual({
      kind: 'text',
      value: 'NEO2101.01071',
    })
  })

  it('reads subtype 5 as an IPv4 or IPv6 address', () => {
    expect(decodeChassisId(Buffer.from([1, 10, 0, 0, 1]), 5)).toEqual({
      kind: 'address',
      value: '10.0.0.1',
    })
    expect(decodeChassisId(Buffer.from([2, ...Array(15).fill(0), 1]), 5)).toEqual({
      kind: 'address',
      value: '0000:0000:0000:0000:0000:0000:0000:0001',
    })
  })

  it('keeps bytes that are not text as hex rather than as garbled text', () => {
    expect(decodeChassisId(Buffer.from([0x01, 0x02, 0x03]), 7)).toEqual({
      kind: 'opaque',
      value: '01:02:03',
    })
  })

  it('guesses when the agent reports no subtype: six non-text bytes are a MAC', () => {
    expect(decodeChassisId(hex('8099e72a38ce'))).toEqual({
      kind: 'mac',
      value: '80:99:e7:2a:38:ce',
    })
    expect(decodeChassisId(Buffer.from('core-sw'))).toEqual({ kind: 'text', value: 'core-sw' })
  })

  it('returns undefined for an empty id', () => {
    expect(decodeChassisId(Buffer.alloc(0), 4)).toBeUndefined()
    expect(decodeChassisId(undefined, 4)).toBeUndefined()
  })
})

describe('decodePortId', () => {
  it('reads subtype 5 as the interface name', () => {
    expect(decodePortId(Buffer.from('port19'), 5)).toEqual({ kind: 'text', value: 'port19' })
    expect(decodePortId(hex('4574686572 6e657434392f31'.replace(' ', '')), 5)).toEqual({
      kind: 'text',
      value: 'Ethernet49/1',
    })
  })

  it('reads subtype 3 as a MAC address instead of garbled text', () => {
    // 00:14:57:02:b8:5e decoded as UTF-8 gave "\u0000\u0014W\u0002�^".
    expect(decodePortId(hex('00145702b85e'), 3)).toEqual({
      kind: 'mac',
      value: '00:14:57:02:b8:5e',
    })
  })

  it('reads subtype 7 as text when printable and hex otherwise', () => {
    expect(decodePortId(Buffer.from('LAN 1'), 7)).toEqual({ kind: 'text', value: 'LAN 1' })
    expect(decodePortId(Buffer.from([0, 1, 2, 3]), 7)).toEqual({
      kind: 'opaque',
      value: '00:01:02:03',
    })
  })
})

describe('portNameOf', () => {
  it('uses a readable id as the name', () => {
    expect(portNameOf({ kind: 'text', value: 'port19' }, 'ignored')).toBe('port19')
  })

  it('names a MAC port by its description when it has one', () => {
    expect(portNameOf({ kind: 'mac', value: '00:14:57:02:b8:5e' }, 'Ethernet 3.3')).toBe(
      'Ethernet 3.3',
    )
  })

  it('falls back to the id when the description is empty or not text', () => {
    expect(portNameOf({ kind: 'mac', value: '00:20:fc:3a:be:47' }, '')).toBe('00:20:fc:3a:be:47')
    expect(portNameOf({ kind: 'mac', value: '00:20:fc:3a:be:47' }, Buffer.from([0, 1]))).toBe(
      '00:20:fc:3a:be:47',
    )
    expect(portNameOf({ kind: 'mac', value: '00:20:fc:3a:be:47' }, undefined)).toBe(
      '00:20:fc:3a:be:47',
    )
  })
})

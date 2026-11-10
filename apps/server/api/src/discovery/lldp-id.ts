// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Reading LLDP chassis ids and port ids.
 *
 * Both are free-form octet strings (LLDP-MIB LldpChassisId / LldpPortId carry no
 * display hint), and only the subtype that travels with them says what the bytes
 * are. Reading them all as text turns a MAC address into garbage, and reading
 * them all as a MAC turns a name into a run of hex. So the subtype decides.
 */

import { normalizeMacKey } from '@shumoku/core'

/** What an LLDP id turned out to be. */
export type LldpId =
  /** A MAC address, written `aa:bb:cc:dd:ee:ff`. */
  | { kind: 'mac'; value: string }
  /** A network address (IPv4 or IPv6). */
  | { kind: 'address'; value: string }
  /** A name or a device-assigned string. */
  | { kind: 'text'; value: string }
  /** Bytes with no readable form, written as colon-separated hex. */
  | { kind: 'opaque'; value: string }

type Raw = Buffer | string | number | bigint | boolean | null | undefined

// LldpChassisIdSubtype
const CHASSIS_MAC = 4
const CHASSIS_ADDRESS = 5
const CHASSIS_TEXT = new Set([1, 2, 3, 6, 7])
// LldpPortIdSubtype
const PORT_MAC = 3
const PORT_ADDRESS = 4
const PORT_TEXT = new Set([1, 2, 5, 7])

// IANA address family numbers, the first byte of an LLDP network address.
const AF_IPV4 = 1
const AF_IPV6 = 2

function bytesOf(raw: Raw): Buffer | undefined {
  if (raw === undefined || raw === null) return undefined
  if (Buffer.isBuffer(raw)) return raw
  return Buffer.from(String(raw), 'utf8')
}

function hexOf(bytes: Buffer): string {
  return (bytes.toString('hex').match(/.{1,2}/g) ?? []).join(':')
}

/** The text in `bytes`, or undefined when it holds control characters or invalid UTF-8. */
export function printableText(bytes: Buffer): string | undefined {
  const text = bytes.toString('utf8').replace(/[\0 ]+$/, '')
  if (text.length === 0) return undefined
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (/[\u0000-\u001f\u007f�]/.test(text)) return undefined
  return text
}

function addressOf(bytes: Buffer): string | undefined {
  const family = bytes[0]
  const rest = bytes.subarray(1)
  if (family === AF_IPV4 && rest.length === 4) return Array.from(rest).join('.')
  if (family === AF_IPV6 && rest.length === 16) {
    return (rest.toString('hex').match(/.{4}/g) ?? []).join(':')
  }
  return undefined
}

function decode(
  raw: Raw,
  subtype: number | undefined,
  macSubtype: number,
  addressSubtype: number,
  textSubtypes: ReadonlySet<number>,
): LldpId | undefined {
  const bytes = bytesOf(raw)
  if (!bytes || bytes.length === 0) return undefined

  if (subtype === macSubtype && bytes.length === 6) {
    return { kind: 'mac', value: normalizeMacKey(bytes.toString('hex')) }
  }
  if (subtype === addressSubtype) {
    const address = addressOf(bytes)
    if (address) return { kind: 'address', value: address }
  }
  if (subtype !== undefined && textSubtypes.has(subtype)) {
    const text = printableText(bytes)
    if (text) return { kind: 'text', value: text }
  }
  if (subtype === undefined) {
    // No subtype reported (an agent that omits it): six bytes that are not text are a MAC.
    const text = printableText(bytes)
    if (text && bytes.length !== 6) return { kind: 'text', value: text }
    if (bytes.length === 6 && !text) {
      return { kind: 'mac', value: normalizeMacKey(bytes.toString('hex')) }
    }
    if (text) return { kind: 'text', value: text }
  }
  return { kind: 'opaque', value: hexOf(bytes) }
}

/** A chassis id, by its `LldpChassisIdSubtype`. */
export function decodeChassisId(raw: Raw, subtype?: number): LldpId | undefined {
  return decode(raw, subtype, CHASSIS_MAC, CHASSIS_ADDRESS, CHASSIS_TEXT)
}

/** A port id, by its `LldpPortIdSubtype`. */
export function decodePortId(raw: Raw, subtype?: number): LldpId | undefined {
  return decode(raw, subtype, PORT_MAC, PORT_ADDRESS, PORT_TEXT)
}

/**
 * The name to show for a far-end port. A readable id is the name; for a MAC, an address or
 * bytes, the port description is the name when it has one (such devices fill it with `eth0`
 * or `Ethernet 3.3`), and the id itself is the fallback.
 */
export function portNameOf(id: LldpId, description: Raw): string {
  if (id.kind === 'text') return id.value
  const bytes = bytesOf(description)
  const text = bytes ? printableText(bytes) : undefined
  return text ?? id.value
}

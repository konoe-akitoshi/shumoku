/**
 * Address arithmetic for matching an address to the prefix it sits in. NetBox gives addresses and
 * prefixes as CIDR text, so this reads both families and finds the longest prefix that holds an
 * address, in the same VRF.
 */

export interface Cidr {
  readonly family: 4 | 6
  /** The address as a number of `family === 4 ? 32 : 128` bits. */
  readonly bits: bigint
  readonly length: number
}

/** The host part of an address: `10.0.0.1/24` is `10.0.0.1`. */
export function hostOf(address: string): string {
  return address.split('/')[0] ?? address
}

function parseV4(text: string): bigint | undefined {
  const parts = text.split('.')
  if (parts.length !== 4) return undefined
  let value = 0n
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return undefined
    const octet = Number(part)
    if (octet > 255) return undefined
    value = (value << 8n) | BigInt(octet)
  }
  return value
}

function parseV6(text: string): bigint | undefined {
  const halves = text.split('::')
  if (halves.length > 2) return undefined
  const groups = (part: string | undefined): string[] =>
    part === undefined || part === '' ? [] : part.split(':')
  const head = groups(halves[0])
  const tail = groups(halves[1])
  // A dotted tail such as ::ffff:1.2.3.4 carries two groups in its last part.
  const expand = (list: string[]): string[] | undefined => {
    const last = list[list.length - 1]
    if (last?.includes('.')) {
      const v4 = parseV4(last)
      if (v4 === undefined) return undefined
      return [...list.slice(0, -1), (v4 >> 16n).toString(16), (v4 & 0xffffn).toString(16)]
    }
    return list
  }
  const headGroups = expand(head)
  const tailGroups = expand(tail)
  if (!headGroups || !tailGroups) return undefined
  const missing = 8 - headGroups.length - tailGroups.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return undefined
  const all = [
    ...headGroups,
    ...Array<string>(halves.length === 2 ? missing : 0).fill('0'),
    ...tailGroups,
  ]
  let value = 0n
  for (const group of all) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return undefined
    value = (value << 16n) | BigInt(Number.parseInt(group, 16))
  }
  return value
}

/** Reads `10.0.0.1/24`, `10.0.0.0/24` or `2001:db8::/32`; an address without a length is a host. */
export function parseCidr(text: string): Cidr | undefined {
  const [host = '', len] = text.split('/')
  const family = host.includes(':') ? 6 : 4
  const bits = family === 4 ? parseV4(host) : parseV6(host)
  if (bits === undefined) return undefined
  const max = family === 4 ? 32 : 128
  const length = len === undefined ? max : Number(len)
  if (!Number.isInteger(length) || length < 0 || length > max) return undefined
  return { family, bits, length }
}

/** The network part: the bits below the prefix length cleared. */
function network(cidr: Cidr, length: number): bigint {
  const max = cidr.family === 4 ? 32 : 128
  const shift = BigInt(max - length)
  return (cidr.bits >> shift) << shift
}

/** Prefixes of one VRF and family, found by length so an address needs few lookups. */
export class PrefixIndex<T> {
  private readonly byKey = new Map<string, T>()
  private readonly lengths = new Map<string, number[]>()

  private static scope(vrf: number | null, family: 4 | 6): string {
    return `${vrf ?? 'global'}/${family}`
  }

  add(prefix: string, vrf: number | null, value: T): void {
    const cidr = parseCidr(prefix)
    if (!cidr) return
    const scope = PrefixIndex.scope(vrf, cidr.family)
    const key = `${scope}/${cidr.length}/${network(cidr, cidr.length)}`
    if (this.byKey.has(key)) return
    this.byKey.set(key, value)
    const known = this.lengths.get(scope) ?? []
    if (!known.includes(cidr.length)) {
      known.push(cidr.length)
      known.sort((a, b) => b - a)
    }
    this.lengths.set(scope, known)
  }

  /** The longest prefix of the same VRF that holds the address. */
  longestMatch(address: string, vrf: number | null): T | undefined {
    const cidr = parseCidr(address)
    if (!cidr) return undefined
    const scope = PrefixIndex.scope(vrf, cidr.family)
    for (const length of this.lengths.get(scope) ?? []) {
      const hit = this.byKey.get(`${scope}/${length}/${network(cidr, length)}`)
      if (hit !== undefined) return hit
    }
    return undefined
  }
}

/** Whether `inner` lies within `outer` (the same prefix counts). */
export function contains(outer: string, inner: string): boolean {
  const a = parseCidr(outer)
  const b = parseCidr(inner)
  if (!a || !b || a.family !== b.family || a.length > b.length) return false
  return network(a, a.length) === network(b, a.length)
}

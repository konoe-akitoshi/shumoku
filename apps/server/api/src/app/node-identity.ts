import type { DeviceAttributes } from '../services/resolved-record.js'

/**
 * Whether two nodes share an attribute that anchors them to one device: the same chassis id,
 * the same address (one the node writes, or one it holds in a segment) or the same sysName.
 */
export function nodeIdentitiesMatch(
  a: DeviceAttributes | undefined,
  b: DeviceAttributes | undefined,
): boolean {
  if (!a || !b) return false
  const equal = (left: string | undefined, right: string | undefined, lower: boolean): boolean => {
    if (!left || !right) return false
    const normalizedLeft = lower ? left.trim().toLowerCase() : left.trim()
    const normalizedRight = lower ? right.trim().toLowerCase() : right.trim()
    return normalizedLeft === normalizedRight
  }
  const addresses = (x: DeviceAttributes) =>
    [x.address, ...(x.addresses ?? [])].flatMap((v) => (v ? [v.split('/')[0] ?? v] : []))
  return (
    equal(a.chassisId, b.chassisId, false) ||
    addresses(a).some((left) => addresses(b).some((right) => equal(left, right, true))) ||
    equal(a.sysName, b.sysName, true)
  )
}

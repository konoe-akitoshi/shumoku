import type { Identity } from '@shumoku/core'

/** Whether two node identities share a strong entity-registry anchor. */
export function nodeIdentitiesMatch(a: Identity | undefined, b: Identity | undefined): boolean {
  if (!a || !b) return false
  const equal = (left: string | undefined, right: string | undefined, lower: boolean): boolean => {
    if (!left || !right) return false
    const normalizedLeft = lower ? left.trim().toLowerCase() : left.trim()
    const normalizedRight = lower ? right.trim().toLowerCase() : right.trim()
    return normalizedLeft === normalizedRight
  }
  return (
    equal(a.chassisId, b.chassisId, false) ||
    equal(a.mgmtIp, b.mgmtIp, true) ||
    equal(a.sysName, b.sysName, true)
  )
}

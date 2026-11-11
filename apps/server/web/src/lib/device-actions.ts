import type { Credential, CredentialUsage, Device, TopologyCredential } from './api'
import { STATE_META } from './devices'

/** What a bulk edit changes; the same shape `devices.assign` takes. */
export interface DeviceChange {
  credentialId?: string | null
  enabled?: boolean
}

type Prior = Pick<Device, 'id' | 'credentialId' | 'enabled'>

/** One `assign` call that restores a group of devices to the same previous value. */
export interface UndoCall {
  entityIds: string[]
  change: DeviceChange
}

function groupBy<T>(devices: Prior[], ids: string[], pick: (d: Prior) => T): [T, string[]][] {
  const wanted = new Set(ids)
  const groups = new Map<T, string[]>()
  for (const d of devices) {
    if (!wanted.has(d.id)) continue
    const key = pick(d)
    const list = groups.get(key)
    if (list) list.push(d.id)
    else groups.set(key, [d.id])
  }
  return [...groups]
}

/**
 * The calls that put `ids` back as they were in `before`: one per distinct
 * previous value of each field the change touched.
 */
export function undoCalls(before: Prior[], ids: string[], change: DeviceChange): UndoCall[] {
  const calls: UndoCall[] = []
  if ('credentialId' in change) {
    for (const [credentialId, entityIds] of groupBy(before, ids, (d) => d.credentialId ?? null)) {
      calls.push({ entityIds, change: { credentialId } })
    }
  }
  if ('enabled' in change) {
    for (const [enabled, entityIds] of groupBy(before, ids, (d) => d.enabled)) {
      calls.push({ entityIds, change: { enabled } })
    }
  }
  return calls
}

/** Plain-Japanese result of an edit, with the skipped count when there is one. */
export function changeNotice(
  change: DeviceChange,
  updated: number,
  skipped: number,
  credentialName = '',
): string {
  let text: string
  if (change.credentialId) text = `${updated} 台に ${credentialName} を割り当てました`
  else if ('credentialId' in change) text = `${updated} 台の割り当てを外しました`
  else if (change.enabled === false) text = `${updated} 台を対象外にしました`
  else text = `${updated} 台の対象外を解除しました`
  return skipped > 0 ? `${text}（${skipped} 台はスキップ）` : text
}

/** Whether a group of this state makes sense to read as a whole. */
export function canReadGroup(state: Device['state']): boolean {
  return STATE_META[state].readable === true
}

/** Header state of a "select all" checkbox over `ids`. */
export function selectionState(ids: string[], selected: Set<string>): 'none' | 'some' | 'all' {
  let n = 0
  for (const id of ids) if (selected.has(id)) n++
  if (n === 0) return 'none'
  return n === ids.length ? 'all' : 'some'
}

/** `selected` with `ids` all added, or all removed. */
export function toggleIds(selected: string[], ids: string[], on: boolean): string[] {
  if (!on) {
    const drop = new Set(ids)
    return selected.filter((id) => !drop.has(id))
  }
  const have = new Set(selected)
  return [...selected, ...ids.filter((id) => !have.has(id))]
}

/** Devices a credential is attached to on one topology (every state counted). */
export function usageTotal(u: CredentialUsage): number {
  return u.ok + u.partial + u.failed + u.pending
}

/** The usage line of a credential: `{n} 台`, or a warning when some cannot be read. */
export function usageSummary(u: CredentialUsage): { text: string; warn: boolean } {
  const total = usageTotal(u)
  const bad = u.failed + u.partial
  if (bad > 0) return { text: `${bad}/${total} 台が読めません`, warn: true }
  return { text: `${total} 台`, warn: false }
}

/** One credential's share of a group of devices. */
export interface CredentialShare {
  id: string
  name: string
  count: number
}

/**
 * How a group's devices split over credentials; empty unless at least two
 * credentials are involved (a single one says nothing the header does not).
 */
export function credentialBreakdown(
  devices: Pick<Device, 'credentialId'>[],
  credentials: Pick<TopologyCredential, 'id' | 'name'>[],
): CredentialShare[] {
  const counts = new Map<string, number>()
  for (const d of devices) {
    if (d.credentialId) counts.set(d.credentialId, (counts.get(d.credentialId) ?? 0) + 1)
  }
  const shares: CredentialShare[] = []
  for (const c of credentials) {
    const count = counts.get(c.id)
    if (count) shares.push({ id: c.id, name: c.name, count })
  }
  return shares.length < 2 ? [] : shares
}

type LinkedTopology = Credential['topologies'][number]

/** What saving an edit touches, from the credential's per-topology numbers. */
export interface Impact {
  /** Devices read with this credential on the affected topologies. */
  inUse: number
  /** Silent devices there that go back to being retried. */
  silent: number
}

export function impactOf(affected: LinkedTopology[]): Impact {
  let inUse = 0
  let silent = 0
  for (const t of affected) {
    inUse += usageTotal(t.usage)
    silent += t.silent
  }
  return { inUse, silent }
}

/** The linked topologies besides `currentId`, for 他で使用. */
export function otherTopologies(topologies: LinkedTopology[], currentId: string): LinkedTopology[] {
  return topologies.filter((t) => t.id !== currentId)
}

/** The impact sentence shown before saving an edit. */
export function impactText(impact: Impact): string {
  return `保存すると: この認証情報で読んでいる ${impact.inUse} 台を新しい値で読みます。応答なしの ${impact.silent} 台が再試行の対象に戻ります。`
}

/** The impact sentence when an edit only takes topologies away from the credential. */
export function unlinkImpactText(inUse: number): string {
  return `保存すると: 外したトポロジーの ${inUse} 台が未確認に戻ります。`
}

/** The full topology set a credential keeps after leaving `currentId`. */
export function withoutTopology(topologies: { id: string }[], currentId: string): string[] {
  return topologies.filter((t) => t.id !== currentId).map((t) => t.id)
}

/** The confirm message before removing a credential from this topology, or deleting it. */
export function removeMessage(
  devicesHere: number,
  others: { name: string }[],
  scope: 'here' | 'all',
): string {
  if (scope === 'here' && others.length > 0) {
    const names = others.map((t) => t.name).join('、')
    return `${devicesHere} 台が未確認に戻り、次の読み取りで他の認証情報が試されます。${names} では引き続き使われます。`
  }
  return `${devicesHere} 台が未確認に戻ります。この認証情報は削除され、元に戻せません。`
}

/** The notice after a credential edit, from the server's per-topology effect. */
export function effectNotice(
  effect: { name: string; devices: number; retrySilent: number }[],
): string {
  if (effect.length === 0) return '保存しました'
  const devices = effect.reduce((n, e) => n + e.devices, 0)
  const retry = effect.reduce((n, e) => n + e.retrySilent, 0)
  const names = effect.map((e) => e.name).join('、')
  return `保存しました（${names}: ${devices} 台に反映、応答なし ${retry} 台を再試行の対象に戻しました）`
}

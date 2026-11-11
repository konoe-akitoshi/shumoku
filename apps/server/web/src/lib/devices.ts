import type { DeviceState, ReadDevicesResult } from './api'

export type StatusTone = 'muted' | 'ok' | 'warn' | 'error'

export const TONE_CLASS: Record<StatusTone, string> = {
  muted: 'text-muted-foreground',
  ok: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-destructive',
}

export interface StateMeta {
  label: string
  /** One line under the group header. */
  hint?: string
  /** Longer explanation shown in the device sheet. */
  explanation: string
  tone: StatusTone
  /** Whether the group starts expanded. */
  open: boolean
  /** Whether `lastError` is worth a line in the row. */
  showsError?: boolean
  /** Whether reading the whole group at once makes sense. */
  readable?: boolean
}

/** How each server-derived state reads. The server decides the state; the UI only labels it. */
export const STATE_META: Record<DeviceState, StateMeta> = {
  lost: {
    label: '読めなくなった',
    readable: true,
    explanation: '認証情報はありますが、前回の読み取りに失敗しました。',
    tone: 'error',
    open: true,
    showsError: true,
  },
  partial: {
    label: '一部だけ読めた',
    readable: true,
    explanation: '機器は応答しましたが、読み取りの一部が失敗しました。',
    tone: 'warn',
    open: true,
    showsError: true,
  },
  unconfirmed: {
    label: '未確認',
    readable: true,
    hint: '認証情報をまだ試していません',
    explanation:
      '認証情報がまだ決まっていません。新しい機器か、認証情報が追加・変更されたあとで、まだ試していません。「読み取る」で自動的に試します。',
    tone: 'warn',
    open: true,
  },
  pending: {
    label: '未取得',
    readable: true,
    hint: '認証情報あり・まだ読んでいません',
    explanation: '認証情報はありますが、まだ一度も読んでいません。',
    tone: 'muted',
    open: true,
  },
  ok: {
    label: '読めている',
    explanation: '最後の読み取りが成功しました。',
    tone: 'ok',
    open: false,
  },
  silent: {
    label: '応答なし',
    readable: true,
    hint: 'どの認証情報にも応えません。PC やプリンタなど。認証情報を変えると再試行されます',
    explanation:
      'すべての認証情報を試しましたが、応答がありませんでした。PC やプリンタなど SNMP を話さない機器に多く見られます。認証情報を変えると自動で再試行されます。',
    tone: 'muted',
    open: false,
  },
  'no-address': {
    label: 'アドレスなし',
    explanation: '管理アドレスがないため、読み取り先がありません。',
    tone: 'muted',
    open: false,
  },
  disabled: {
    label: '対象外',
    explanation: '読み取りを止めています（対象外）。',
    tone: 'muted',
    open: false,
  },
}

/** The order a person should look at the groups. */
export const STATE_ORDER: DeviceState[] = [
  'lost',
  'partial',
  'unconfirmed',
  'pending',
  'ok',
  'silent',
  'no-address',
  'disabled',
]

/** Counts of successful / failed reads in a read result (partial counts as read). */
export function countOutcomes(outcomes: ReadDevicesResult['outcomes']): {
  ok: number
  failed: number
} {
  let failed = 0
  for (const o of outcomes) if (o.status === 'failed') failed++
  return { ok: outcomes.length - failed, failed }
}

/** Plain-Japanese summary of a finished read. */
export function readSummary(res: ReadDevicesResult): string {
  const { ok, failed } = countOutcomes(res.outcomes)
  const read = `読み取り: 成功 ${ok} 台 / 失敗 ${failed} 台`
  if (res.trial.tried === 0) return read
  return `${res.trial.tried} 台を試し、${res.trial.matched} 台が応答、${res.trial.silent} 台は応答なし。${read}`
}

/** Message of an API error (the client throws `Error`s carrying the payload's `error`). */
export function errorMessage(e: unknown, fallback = 'failed'): string {
  return e instanceof Error && e.message ? e.message : fallback
}

import { describe, expect, it } from 'vitest'
import type { Alert } from '$lib/types'
import { mayReplaceFlash, mostSevereActive, SEVERITY_RANK } from './alert-highlight'

function alert(id: string, severity: Alert['severity'], extra: Partial<Alert> = {}): Alert {
  return {
    id,
    severity,
    status: 'active',
    host: `host-${id}`,
    title: id,
    startTime: 0,
    ...extra,
  } as Alert
}

describe('mostSevereActive', () => {
  it('keeps a critical alert over a newer, milder one', () => {
    // newest first, as the widget sorts them
    const alerts = [alert('util', 'info'), alert('primary-down', 'critical')]
    expect(mostSevereActive(alerts)?.id).toBe('primary-down')
  })

  it('takes the newest of equally severe alerts', () => {
    const alerts = [alert('new', 'high'), alert('old', 'high')]
    expect(mostSevereActive(alerts)?.id).toBe('new')
  })

  it('skips resolved alerts and alerts without a host', () => {
    const alerts = [
      alert('resolved', 'critical', { status: 'resolved' }),
      alert('nohost', 'critical', { host: undefined }),
      alert('warn', 'medium'),
    ]
    expect(mostSevereActive(alerts)?.id).toBe('warn')
  })

  it('returns undefined when nothing is active', () => {
    expect(mostSevereActive([alert('r', 'high', { status: 'resolved' })])).toBeUndefined()
  })
})

describe('mayReplaceFlash', () => {
  const critical = { rank: SEVERITY_RANK.critical, until: 15_000 }

  it('lets anything flash when nothing is on screen or the flash has ended', () => {
    expect(mayReplaceFlash(null, SEVERITY_RANK.info, 0)).toBe(true)
    expect(mayReplaceFlash(critical, SEVERITY_RANK.info, 15_000)).toBe(true)
  })

  it('keeps a severe flash while a milder alert arrives', () => {
    expect(mayReplaceFlash(critical, SEVERITY_RANK.info, 5_000)).toBe(false)
    expect(mayReplaceFlash(critical, SEVERITY_RANK.medium, 5_000)).toBe(false)
  })

  it('lets an equally or more severe alert replace the flash', () => {
    expect(mayReplaceFlash(critical, SEVERITY_RANK.critical, 5_000)).toBe(true)
    const medium = { rank: SEVERITY_RANK.medium, until: 15_000 }
    expect(mayReplaceFlash(medium, SEVERITY_RANK.high, 5_000)).toBe(true)
  })
})

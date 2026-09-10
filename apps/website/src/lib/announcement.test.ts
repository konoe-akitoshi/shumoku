import { describe, expect, it } from 'vitest'
import { announcement, isAnnouncementActive } from './announcement'

describe('announcement expiry', () => {
  it('shows before the end and hides at and after the end in JST', () => {
    expect(isAnnouncementActive(Date.parse('2027-02-16T10:59:59Z'))).toBe(true)
    expect(isAnnouncementActive(Date.parse('2027-02-16T11:00:00Z'))).toBe(false)
    expect(isAnnouncementActive(Date.parse('2027-02-17T00:00:00Z'))).toBe(false)
    expect(isAnnouncementActive(Number.NaN)).toBe(false)
  })
  it('provides the same event destination for both languages', () => {
    expect(announcement.href).toBe('https://shumoku.connpass.com/event/406346/')
    expect(announcement.ja.action).toBeTruthy()
    expect(announcement.en.action).toBeTruthy()
  })
})

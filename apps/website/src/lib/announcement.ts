export const communityUrl = 'https://shumoku.connpass.com/'

// Keep temporary announcements separate from permanent navigation.
export const announcement = {
  href: 'https://shumoku.connpass.com/event/400597/',
  expiresAt: '2026-09-08T20:00:00+09:00',
  ja: { title: 'Shumoku Meetup #1', date: '9月8日', venue: '東京・オンライン', action: '参加する' },
  en: { title: 'Shumoku Meetup #1', date: 'Sep 8', venue: 'Tokyo & online', action: 'Join us' },
}

export function isAnnouncementActive(now: number) {
  return Number.isFinite(now) && now < Date.parse(announcement.expiresAt)
}

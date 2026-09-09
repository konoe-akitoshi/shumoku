export const communityUrl = 'https://shumoku.connpass.com/'

// Keep temporary announcements separate from permanent navigation.
export const announcement = {
  href: 'https://shumoku.connpass.com/event/406346/',
  expiresAt: '2027-02-16T20:00:00+09:00',
  ja: {
    title: 'Shumoku Meetup #2',
    date: '2027年2月16日',
    venue: '東京・オンライン',
    action: '詳細・参加申込',
  },
  en: {
    title: 'Shumoku Meetup #2',
    date: 'Feb 16, 2027',
    venue: 'Tokyo & online',
    action: 'Event details',
  },
}

export function isAnnouncementActive(now: number) {
  return Number.isFinite(now) && now < Date.parse(announcement.expiresAt)
}

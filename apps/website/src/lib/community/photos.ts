export const photos = {
  group: {
    source: '260908200921461.jpg',
    ja: 'Shumoku Meetup #1の集合写真。ご参加ありがとうございました。',
    en: 'The Shumoku Meetup #1 group photo. Thank you for joining us.',
  },
  welcome: {
    source: '20260908_181149.jpg',
    ja: 'Shumokuの案内を持って入口で参加者を迎えるスタッフ。',
    en: 'A staff member welcoming attendees with a Shumoku sign at the entrance.',
  },
  speaker: {
    source: '20260908_183515.jpg',
    ja: 'マイクを手に笑顔で話す登壇者。',
    en: 'A speaker smiling while addressing the room.',
  },
  selfie: {
    source: 'PXL_20260908_150004312.MP.jpg',
    ja: 'Meetupの後、街で撮った参加者たちのセルフィー。',
    en: 'A selfie out in the city after the meetup.',
  },
  coffee: {
    source: 'PXL_20260908_124332545.MP.jpg',
    ja: 'Shumokuのネットワーク図をあしらったドリップバッグ。',
    en: 'Drip coffee bags featuring a Shumoku network diagram.',
  },
  conversations: {
    source: 'PXL_20260908_104109013.MP.jpg',
    ja: '会場のあちこちで交わされる会話。',
    en: 'Conversations around the room.',
  },
  diagrams: {
    source: 'PXL_20260908_101316404.MP.jpg',
    ja: 'ネットワーク図を機械で扱うことについての発表。',
    en: 'A presentation on working with network diagrams programmatically.',
  },
  toast: {
    source: '20260908_201725.jpg',
    ja: '会場のみなさんと乾杯。',
    en: 'A toast together at the venue.',
  },
  sign: {
    source: 'PXL_20260908_124915227.MP.jpg',
    ja: '会場の外でShumoku Meetup #1の看板を手に。',
    en: 'Holding the Shumoku Meetup #1 sign outside the venue.',
  },
  streaming: {
    source: 'PXL_20260908_091830543.jpg',
    ja: 'カメラとPCを並べて、配信の準備。',
    en: 'Cameras and laptops ready for the stream.',
  },
  farewell: {
    source: 'PXL_20260908_123035641.jpg',
    ja: '会場を出る前に、カメラへ手を振る参加者たち。',
    en: 'Attendees waving to the camera before leaving the venue.',
  },
} as const

export type PhotoId = keyof typeof photos
export const photoWidths = [640, 1280, 1920] as const
export const photoUrl = (id: PhotoId, width: (typeof photoWidths)[number] = 1920) =>
  `/images/community/meetup-1/${id}-${width}.webp`

export const communityPhotos = [
  'group',
  'welcome',
  'speaker',
  'selfie',
  'coffee',
  'conversations',
  'diagrams',
  'toast',
  'sign',
  'streaming',
  'farewell',
] as const
export const communityEvent = { date: '2026-09-08', label: 'Shumoku Meetup #1' }

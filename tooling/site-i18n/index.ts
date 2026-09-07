export type Locale = 'en' | 'ja'
export const languageCookie = 'shumoku_language'
export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ja'
}

export function savedLanguage(cookies: string | null): Locale | null {
  for (const part of (cookies ?? '').split(';')) {
    const [name, value] = part.trim().split('=')
    if (name === languageCookie && isLocale(value)) return value
  }
  return null
}

/** Negotiate only the unprefixed entry point; explicit localized URLs always win. */
export function preferredLanguage(acceptLanguage: string | null, cookies: string | null): Locale {
  const saved = savedLanguage(cookies)
  if (saved) return saved
  const ranges = (acceptLanguage ?? '').split(',').flatMap((item, order) => {
    const match = item
      .trim()
      .match(/^([a-z]{2,8}(?:-[a-z0-9]{1,8})*|\*)(?:\s*;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i)
    if (!match?.[1]) return []
    return [{ language: match[1].toLowerCase().split('-')[0], q: Number(match[2] ?? 1), order }]
  })
  const candidates = (['en', 'ja'] as const)
    .map((locale) => {
      const specific = ranges.filter((range) => range.language === locale)
      const matches = specific.length ? specific : ranges.filter((range) => range.language === '*')
      const best = matches.sort((a, b) => b.q - a.q || a.order - b.order)[0]
      return { locale, q: best?.q ?? 0, order: best?.order ?? Infinity }
    })
    .filter((candidate) => candidate.q > 0)
    .sort((a, b) => b.q - a.q || a.order - b.order)
  return candidates[0]?.locale ?? 'en'
}

export function languagePreferenceCookie(locale: Locale, url: URL): string {
  const shared = url.hostname === 'shumoku.dev' || url.hostname.endsWith('.shumoku.dev')
  return `${languageCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}${shared ? '; Domain=shumoku.dev' : ''}`
}

/** Called only for explicit selection, never just because a localized URL was visited. */
export function rememberLanguage(locale: Locale): void {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: Save synchronously before the native link navigates, including browsers without Cookie Store.
    document.cookie = languagePreferenceCookie(locale, new URL(window.location.href))
  } catch {
    /* Explicit links still work when cookies are unavailable. */
  }
}

export function languageRedirect(request: Request): Response {
  const locale = preferredLanguage(
    request.headers.get('accept-language'),
    request.headers.get('cookie'),
  )
  const url = new URL(request.url)
  return new Response(null, {
    status: 307,
    headers: {
      location: `/${locale}${url.search}`,
      'cache-control': 'private, no-store',
      vary: 'Accept-Language, Cookie',
    },
  })
}

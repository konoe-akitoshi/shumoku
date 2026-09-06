/** Public documentation has its own origin; never include a Server release number here. */
export function docsUrl(locale: string, section = ''): string {
  const lang = locale === 'ja' ? 'ja' : 'en'
  return `https://docs.shumoku.dev/${lang}${section ? `/${section}` : ''}`
}

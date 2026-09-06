import { load } from 'cheerio'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const markdown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
markdown.use(gfm)

export function machinePage(html: string) {
  const $ = load(html)
  if ($('meta[name="robots"]').attr('content')?.includes('noindex')) return undefined
  const main = $('main[data-pagefind-body]')
  const canonical = $('link[rel="canonical"]').attr('href')
  if (!main.length || !canonical) return undefined
  const url = new URL(canonical)
  const lang = $('html').attr('lang') ?? 'en'
  const title = $('title')
    .text()
    .replace(/ · Shumoku Docs$/, '')
  const version = main.attr('data-docs-version')
  const channel = main.attr('data-docs-channel')
  const productVersion = main.attr('data-docs-product-version')
  main.find('script, style, button, [aria-hidden="true"]').remove()
  main.find('[href], [src]').each((_index, element) => {
    for (const attribute of ['href', 'src']) {
      const value = $(element).attr(attribute)
      if (value) $(element).attr(attribute, new URL(value, url).href)
    }
  })
  const body = markdown.turndown(main.html() ?? '')
  const scope = version
    ? `${lang}/server/${version}`
    : `${lang}/${url.pathname.split('/')[2] === 'library' ? 'library' : url.pathname.split('/')[2] === 'cli' ? 'cli' : 'overview'}`
  return {
    url: url.href,
    pathname: url.pathname,
    lang,
    title,
    version,
    channel,
    scope,
    markdown: `# ${title}\n\nCanonical: ${url.href}\nLanguage: ${lang}\n${version ? `Server documentation version: ${version}\nProduct version: ${productVersion}\nChannel: ${channel}\n` : ''}\n${body}\n`,
  }
}

export function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

import { expect, test } from 'bun:test'
import { machinePage, xmlEscape } from './machine-page'

const document = (body: string, head = '') =>
  `<html lang="ja"><head><title>Guide · Shumoku Docs</title><link rel="canonical" href="https://docs.shumoku.dev/ja/server/next/guide">${head}</head><body><nav>DO NOT INCLUDE</nav><main data-pagefind-body data-docs-version="next" data-docs-product-version="0.1.0" data-docs-channel="development">${body}</main></body></html>`

test('Markdown preserves version, code, tables and absolute citations without navigation', () => {
  const page = machinePage(
    document(
      '<h1>Guide</h1><pre><code class="language-ts">const x = 1 &lt; 2</code></pre><a href="./api#auth">API</a><table><thead><tr><th>Field</th></tr></thead><tbody><tr><td>name</td></tr></tbody></table>',
    ),
  )
  expect(page?.scope).toBe('ja/server/next')
  expect(page?.markdown).toContain('Channel: development')
  expect(page?.markdown).toContain('```ts')
  expect(page?.markdown).toContain('const x = 1 < 2')
  expect(page?.markdown).toContain('https://docs.shumoku.dev/ja/server/next/api#auth')
  expect(page?.markdown).toContain('| Field |')
  expect(page?.markdown).not.toContain('DO NOT INCLUDE')
})

test('recovery, aliases and non-document pages are not indexed', () => {
  expect(machinePage(document('text', '<meta name="robots" content="noindex">'))).toBeUndefined()
  expect(machinePage('<html><body>redirect</body></html>')).toBeUndefined()
})

test('sitemap escapes URL query characters', () => {
  expect(xmlEscape('https://example.com/?a=1&b=2')).toBe('https://example.com/?a=1&amp;b=2')
})

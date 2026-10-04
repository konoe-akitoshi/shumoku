import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { readWebUiCsp, webUiCsp } from './web-ui-csp.js'

const POLICY = "object-src 'none'; script-src 'self' 'sha256-abc+/='; base-uri 'self'"

// The shape SvelteKit's `kit.csp` writes into the built index.html.
const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <script src="/theme-init.js"></script>
    <meta http-equiv="content-security-policy" content="${POLICY}">
  </head>
  <body></body>
</html>`

describe('readWebUiCsp', () => {
  it('reads the policy SvelteKit put in the built index.html', () => {
    expect(readWebUiCsp(INDEX_HTML)).toBe(POLICY)
  })

  it('returns null when the build has no CSP meta', () => {
    expect(readWebUiCsp('<!doctype html><html><head></head></html>')).toBeNull()
  })
})

describe('webUiCsp', () => {
  it('sends the policy as a header on the SPA shell', async () => {
    const app = new Hono()
    app.use('*', webUiCsp(POLICY))
    app.get('*', (c) => c.html(INDEX_HTML))

    const response = await app.request('http://shumoku.example/topologies/abc')

    expect(response.headers.get('Content-Security-Policy')).toBe(POLICY)
  })
})

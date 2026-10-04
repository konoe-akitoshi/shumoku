import type { MiddlewareHandler } from 'hono'

// SvelteKit's `kit.csp` writes the policy, including the hash of its own
// bootstrap script, into the built index.html as a <meta>. Reading it back
// keeps the header in step with each build instead of repeating the policy.
export function readWebUiCsp(indexHtml: string): string | null {
  return (
    indexHtml.match(/<meta http-equiv="content-security-policy" content="([^"]*)"/i)?.[1] ?? null
  )
}

// A <meta> policy only covers what the parser sees after it; a header covers
// the whole document.
export function webUiCsp(policy: string): MiddlewareHandler {
  return async (c, next) => {
    await next()
    c.header('Content-Security-Policy', policy)
  }
}

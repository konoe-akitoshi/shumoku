# @shumoku/plugin-sdk

Node-runtime SDK for [Shumoku](https://github.com/konoe-akitoshi/shumoku) data-source plugins. Provides an HTTP client (with auth strategies and self-signed-TLS support) and a pagination helper.

This is **layer 2** of the shared plugin toolkit: it needs Node (fetch dispatcher / TLS control), so it lives outside the browser-safe [`@shumoku/core`](../core). Pure, runtime-agnostic helpers (severity mapping, Alertmanager parsing, `flattenObject`, `stampObserved`, `validateAgainstSchema`) stay in core's plugin kit.

## Install

```bash
npm install @shumoku/plugin-sdk
```

## Quick start

```typescript
import { HttpClient, paginate } from '@shumoku/plugin-sdk'

const client = new HttpClient({
  baseUrl: 'https://netbox.example.com',
  auth: { type: 'token', token: process.env.NETBOX_TOKEN ?? '' }, // NetBox's scheme is `Token`
  insecure: false, // set true only for trusted self-signed upstreams
})

// Single request — returns a standard Response
const res = await client.request('/api/dcim/sites/', { query: { limit: 50 } })
const { results } = await res.json()

// Follow `next` links to the end
const devices = await paginate('/api/dcim/devices/?limit=100', async (path) => {
  const r = await client.request(path)
  const body = await r.json()
  return { items: body.results, next: body.next }
})
```

## API

- **`HttpClient`** — `new HttpClient(options)` with `request(path, opts?) → Promise<Response>`. Options: `baseUrl`, `auth`, `timeoutMs` (default 10000), `insecure`, `defaultHeaders`, `debug`, `fetchImpl`. Request options: `method`, `query`, `headers`, `body` (non-string is JSON-encoded), `timeoutMs`, `signal`.
- **`AuthStrategy`** — `{ type: 'none' }`, `{ type: 'bearer', token }`, `{ type: 'token', token, scheme? }`, `{ type: 'basic', username, password }`.
- **`HttpError`** — thrown on non-2xx; carries `status`, `url`, `bodyText`.
- **`paginate(firstPath, fetchPage, options?)`** — walks `next` cursors, accumulating `items`. `options.maxPages` defaults to 1000 (`onTruncated` fires if hit).

See [Plugin Authoring](../../../docs/plugin-authoring.md) and the bundled plugins in [`libs/plugins`](../../plugins) for real usage.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.

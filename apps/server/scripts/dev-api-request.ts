import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const serverDir = fileURLToPath(new URL('..', import.meta.url))
const credentialPath = path.join(serverDir, '.shumoku', 'dev-api-token')

interface CliOptions {
  method: string
  pathname: string
  body?: string
  baseUrl: string
}

export function parseArgs(args: string[]): CliOptions {
  const [rawMethod, pathname, ...rest] = args
  const method = rawMethod?.toUpperCase()
  if (!method || !ALLOWED_METHODS.has(method) || !pathname) {
    throw new Error(
      'Usage: bun run dev:request -- <GET|POST|PUT|PATCH|DELETE> /api/path [--json JSON] [--base-url URL]',
    )
  }
  if (!pathname.startsWith('/api/')) {
    throw new Error('The request path must start with /api/')
  }

  let body: string | undefined
  let baseUrl = process.env['SHUMOKU_DEV_API_URL'] ?? 'http://127.0.0.1:8080'
  const remaining = [...rest]
  while (remaining.length > 0) {
    const value = remaining.shift()
    if (value === '--json') {
      const argument = remaining.shift()
      if (!argument) throw new Error('--json requires a JSON value')
      body = JSON.stringify(JSON.parse(argument))
      continue
    }
    if (value === '--base-url') {
      const argument = remaining.shift()
      if (!argument) throw new Error('--base-url requires a URL')
      baseUrl = argument
      continue
    }
    throw new Error(`Unknown option: ${value}`)
  }

  const url = new URL(baseUrl)
  const loopback = url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The development API URL must use HTTP or HTTPS')
  }
  if (!loopback) {
    throw new Error('The generated development credential is restricted to 127.0.0.1 or ::1')
  }

  const requestUrl = new URL(pathname, `${url.origin}/`)
  if (!requestUrl.pathname.startsWith('/api/')) {
    throw new Error('The normalized request path must stay within /api/')
  }

  return {
    method,
    pathname: `${requestUrl.pathname}${requestUrl.search}`,
    body,
    baseUrl: url.origin,
  }
}

async function readCredential(): Promise<string> {
  const fromEnvironment = process.env['SHUMOKU_DEV_API_TOKEN']?.trim()
  if (fromEnvironment) return fromEnvironment

  try {
    const metadata = await stat(credentialPath)
    if (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0) {
      throw new Error(`Credential permissions are too broad: ${credentialPath}`)
    }
    return (await readFile(credentialPath, 'utf8')).trim()
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Credential permissions')) throw error
    throw new Error(
      'Development API credential not found; start the server with bun run dev:server',
    )
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const token = await readCredential()
  const response = await fetch(`${options.baseUrl}${options.pathname}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body,
  })

  const text = await response.text()
  let output = text
  try {
    output = JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    // Preserve non-JSON responses as-is.
  }

  if (output) console.log(output)
  if (!response.ok) {
    console.error(`[Dev API] HTTP ${response.status} ${response.statusText}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Dev API] ${message}`)
    process.exit(1)
  })
}

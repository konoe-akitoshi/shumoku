import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = fileURLToPath(new URL('..', import.meta.url))
const apiDir = path.join(serverDir, 'api')
const credentialDir = path.join(serverDir, '.shumoku')
const credentialPath = path.join(credentialDir, 'dev-api-token')

async function createCredential(): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await mkdir(credentialDir, { recursive: true, mode: 0o700 })
  await writeFile(credentialPath, `${token}\n`, { mode: 0o600 })
  await chmod(credentialDir, 0o700)
  await chmod(credentialPath, 0o600)
  return token
}

async function removeCredential(token: string): Promise<void> {
  try {
    const current = (await readFile(credentialPath, 'utf8')).trim()
    if (current === token) await unlink(credentialPath)
  } catch {
    // The credential may already have been replaced or removed by another dev process.
  }
}

async function main(): Promise<void> {
  const host = process.env['HOST'] ?? '127.0.0.1'

  if (host !== '127.0.0.1' && host !== '::1' && host !== '[::1]') {
    throw new Error('The development API token requires a loopback HOST')
  }

  const token = await createCredential()

  console.log(`[Dev API] Bearer credential ready at ${credentialPath}`)
  console.log(`[Dev API] Listening on loopback (${host}); the token will not be printed`)

  let exitCode = 1
  try {
    const child = Bun.spawn(['bun', '--watch', 'src/index.ts'], {
      cwd: apiDir,
      env: {
        ...process.env,
        HOST: host,
        NODE_ENV: 'development',
        SHUMOKU_DEV_API_TOKEN: token,
      },
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })

    const forward = (signal: NodeJS.Signals) => {
      child.kill(signal)
    }
    process.on('SIGINT', () => forward('SIGINT'))
    process.on('SIGTERM', () => forward('SIGTERM'))

    exitCode = await child.exited
  } finally {
    await removeCredential(token)
  }

  process.exit(exitCode)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[Dev API] ${message}`)
  process.exit(1)
})

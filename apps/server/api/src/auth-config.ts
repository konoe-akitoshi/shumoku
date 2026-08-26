type AuthEnvironment = Record<string, string | undefined>

export function isPublicDemoEnabled(env: AuthEnvironment = process.env): boolean {
  return env['PUBLIC_DEMO'] === 'true'
}

/** Browser-driven first-run setup is an explicit local-development capability. */
export function isWebSetupEnabled(env: AuthEnvironment = process.env): boolean {
  if (env['SHUMOKU_ALLOW_WEB_SETUP'] === 'true') return true
  if (env['NODE_ENV'] !== 'development') return false
  const host = env['HOST'] ?? '0.0.0.0'
  return host === '127.0.0.1' || host === '::1' || host === '[::1]' || host === 'localhost'
}

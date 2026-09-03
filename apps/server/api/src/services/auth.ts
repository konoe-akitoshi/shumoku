/**
 * Authentication Service
 * Handles password management, session creation/validation, rate limiting
 */

import * as fs from 'node:fs'
import {
  type AuthPrincipal,
  isAuthMethod,
  isAuthRole,
  LOCAL_ADMIN_PRINCIPAL,
} from '../auth/principal.js'
import { getDatabase } from '../db/index.js'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

let lastCleanup = 0
let initialPasswordInProgress = false

/** In-memory rate limiting for login attempts */
const loginAttempts: Map<string, { count: number; firstAttempt: number }> = new Map()

/**
 * Check if initial password setup has been completed
 */
export function isSetupComplete(): boolean {
  const db = getDatabase()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'auth_password_hash'").get() as
    | { value: string }
    | undefined
  return !!row?.value
}

/**
 * Set the password (initial setup or change)
 * Uses Bun's built-in Bun.password API (argon2id by default)
 */
export async function setPassword(password: string): Promise<void> {
  const hash = await Bun.password.hash(password)
  const db = getDatabase()
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_password_hash', ?)").run(
    hash,
  )
}

/**
 * Claim the one-time initial password setup. The in-process guard closes the
 * async hash race where two setup requests could both pass isSetupComplete().
 */
export async function setInitialPassword(password: string): Promise<boolean> {
  if (initialPasswordInProgress || isSetupComplete()) return false
  initialPasswordInProgress = true
  try {
    if (isSetupComplete()) return false
    await setPassword(password)
    return true
  } finally {
    initialPasswordInProgress = false
  }
}

type AuthEnvironment = Record<string, string | undefined>

function secretFileValue(path: string): string {
  const descriptor = fs.openSync(path, fs.constants.O_RDONLY)
  try {
    const stat = fs.fstatSync(descriptor)
    if (!stat.isFile()) throw new Error('SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE must name a file')
    return fs.readFileSync(descriptor, 'utf8').replace(/\r?\n$/, '')
  } finally {
    fs.closeSync(descriptor)
  }
}

/** Resolve the one-time bootstrap password without logging its value. */
export function getBootstrapAdminPassword(env: AuthEnvironment = process.env): string | null {
  const passwordFile = env['SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE']?.trim()
  const passwordValue = env['SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD']
  if (passwordFile && passwordValue !== undefined) {
    throw new Error(
      'Set only one of SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE or SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD',
    )
  }

  const password = passwordFile ? secretFileValue(passwordFile) : passwordValue
  if (password === undefined || password === '') return null
  if (password.length < 8) {
    throw new Error('The bootstrap administrator password must be at least 8 characters')
  }
  return password
}

/** Initialize authentication exactly once from an orchestrator-provided secret. */
export async function bootstrapAdminAuthentication(
  env: AuthEnvironment = process.env,
): Promise<boolean> {
  if (isSetupComplete()) return false
  const password = getBootstrapAdminPassword(env)
  if (!password) return false
  const created = await setInitialPassword(password)
  if (created) console.log('[Auth] Administrator authentication bootstrapped from a secret')
  return created
}

/**
 * Instances exposed beyond loopback must not start in the historic fail-open
 * setup state. Local development keeps the web setup flow by binding to
 * loopback explicitly.
 */
export function assertAuthenticationReady(host: string): void {
  if (isSetupComplete()) return
  if (host === '127.0.0.1' || host === '::1' || host === '[::1]' || host === 'localhost') return
  throw new Error(
    'Administrator authentication is not configured. Provide SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE (recommended) or SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD for the first start.',
  )
}

/**
 * Check rate limit for login attempts by IP
 * Returns remaining seconds if locked out, 0 if allowed
 */
export function checkRateLimit(ip: string): number {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry) return 0

  // Reset if lockout window has passed
  if (now - entry.firstAttempt > LOCKOUT_DURATION_MS) {
    loginAttempts.delete(ip)
    return 0
  }

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    const remaining = Math.ceil((entry.firstAttempt + LOCKOUT_DURATION_MS - now) / 1000)
    return remaining
  }

  return 0
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry || now - entry.firstAttempt > LOCKOUT_DURATION_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now })
  } else {
    entry.count++
  }
}

/**
 * Clear login attempts for an IP (on successful login)
 */
export function clearAttempts(ip: string): void {
  loginAttempts.delete(ip)
}

/**
 * Verify a password against the stored hash
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const db = getDatabase()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'auth_password_hash'").get() as
    | { value: string }
    | undefined
  if (!row?.value) return false
  return Bun.password.verify(password, row.value)
}

/**
 * Create a new session and return the token
 */
export function createSession(principal: AuthPrincipal = LOCAL_ADMIN_PRINCIPAL): string {
  if (principal.role === 'anonymous' || principal.authMethod === 'anonymous') {
    throw new Error('Anonymous principals cannot create sessions')
  }
  const token = crypto.getRandomValues(new Uint8Array(32)).toBase64({ alphabet: 'base64url' })
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS
  const db = getDatabase()
  db.prepare(
    'INSERT INTO sessions (token, subject, role, auth_method, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(token, principal.subject, principal.role, principal.authMethod, expiresAt, now)
  return token
}

/**
 * Clean up expired sessions (throttled to once per hour)
 */
function cleanupExpiredSessions(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  const db = getDatabase()
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now)
}

/**
 * Resolve a session into the authenticated principal it represents.
 */
export function getSessionPrincipal(token: string): AuthPrincipal | null {
  cleanupExpiredSessions()

  const db = getDatabase()
  const now = Date.now()
  const row = db
    .prepare(
      'SELECT subject, role, auth_method AS authMethod FROM sessions WHERE token = ? AND expires_at > ?',
    )
    .get(token, now) as { subject: string; role: string; authMethod: string } | undefined
  if (!row || !isAuthRole(row.role) || !isAuthMethod(row.authMethod)) return null
  return { subject: row.subject, role: row.role, authMethod: row.authMethod }
}

/**
 * Delete a session (logout)
 */
export function deleteSession(token: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

/** Invalidate every administrator session after a password change. */
export function deleteAllSessions(): void {
  getDatabase().prepare('DELETE FROM sessions').run()
}

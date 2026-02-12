/**
 * Authentication Service
 * Handles password management, session creation/validation, rate limiting
 */

import { getDatabase } from '../db/index.js'

export const SESSION_COOKIE = 'shumoku_session'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

let lastCleanup = 0

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
export function createSession(): string {
  const token = crypto.randomUUID()
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS
  const db = getDatabase()
  db.prepare('INSERT INTO sessions (token, expires_at, created_at) VALUES (?, ?, ?)').run(
    token,
    expiresAt,
    now,
  )
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
 * Validate a session token
 * Returns true if valid and not expired
 */
export function validateSession(token: string): boolean {
  cleanupExpiredSessions()

  const db = getDatabase()
  const now = Date.now()
  const row = db
    .prepare('SELECT id FROM sessions WHERE token = ? AND expires_at > ?')
    .get(token, now) as { id: number } | undefined
  return !!row
}

/**
 * Delete a session (logout)
 */
export function deleteSession(token: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

/**
 * Auth API
 * Handles login, logout, setup, and status endpoints
 */

import type { Context } from 'hono'
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import {
  SESSION_COOKIE,
  isSetupComplete,
  setPassword,
  verifyPassword,
  createSession,
  deleteSession,
  validateSession,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
} from '../services/auth.js'

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds

function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || '0.0.0.0'
  )
}

function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: c.req.url.startsWith('https'),
  })
}

export function createAuthApi(): Hono {
  const app = new Hono()

  // GET /auth/status - Check auth state
  app.get('/status', (c) => {
    const setupComplete = isSetupComplete()
    const token = getCookie(c, SESSION_COOKIE)
    const authenticated = !!token && validateSession(token)
    return c.json({ setupComplete, authenticated })
  })

  // POST /auth/setup - Initial password setup
  app.post('/setup', async (c) => {
    if (isSetupComplete()) {
      return c.json({ error: 'Setup already completed' }, 400)
    }

    const body = (await c.req.json()) as { password?: string }
    if (!body.password || body.password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400)
    }

    await setPassword(body.password)
    const token = createSession()
    setSessionCookie(c, token)

    return c.json({ success: true })
  })

  // POST /auth/login - Login
  app.post('/login', async (c) => {
    if (!isSetupComplete()) {
      return c.json({ error: 'Setup not completed' }, 400)
    }

    const ip = getClientIp(c)
    const lockoutSeconds = checkRateLimit(ip)
    if (lockoutSeconds > 0) {
      return c.json({ error: `Too many attempts. Try again in ${lockoutSeconds} seconds.` }, 429)
    }

    const body = (await c.req.json()) as { password?: string }
    if (!body.password) {
      return c.json({ error: 'Password is required' }, 400)
    }

    const valid = await verifyPassword(body.password)
    if (!valid) {
      recordFailedAttempt(ip)
      return c.json({ error: 'Invalid password' }, 401)
    }

    clearAttempts(ip)
    const token = createSession()
    setSessionCookie(c, token)

    return c.json({ success: true })
  })

  // POST /auth/change-password - Change password (requires current password)
  app.post('/change-password', async (c) => {
    if (!isSetupComplete()) {
      return c.json({ error: 'Setup not completed' }, 400)
    }

    const token = getCookie(c, SESSION_COOKIE)
    if (!token || !validateSession(token)) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const body = (await c.req.json()) as {
      currentPassword?: string
      newPassword?: string
    }
    if (!body.currentPassword || !body.newPassword) {
      return c.json({ error: 'Current password and new password are required' }, 400)
    }
    if (body.newPassword.length < 8) {
      return c.json({ error: 'New password must be at least 8 characters' }, 400)
    }

    const valid = await verifyPassword(body.currentPassword)
    if (!valid) {
      return c.json({ error: 'Current password is incorrect' }, 401)
    }

    await setPassword(body.newPassword)
    return c.json({ success: true })
  })

  // POST /auth/logout - Logout
  app.post('/logout', (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) {
      deleteSession(token)
    }
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ success: true })
  })

  return app
}

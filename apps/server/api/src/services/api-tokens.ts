/**
 * API tokens: long-lived Bearer credentials for automation (Terraform, CI, scripts).
 *
 * An administrator issues a token with a role; the secret (`shmk_` + 256 random bits,
 * base64url) is returned once and only its SHA-256 is stored. A high-entropy secret
 * needs no slow hash: the digest is the lookup key, so verification is one indexed read.
 */

import { createHash } from 'node:crypto'
import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
  type AuthPrincipal,
  type AuthRole,
  isAuthRole,
} from '../auth/principal.js'
import { API_TOKEN_PREFIX } from '../auth/resolve-principal.js'
import { getDatabase } from '../db/index.js'

export type ApiTokenRole = AssignableRole

/** How long `last_used_at` may lag behind; avoids a write on every request. */
const LAST_USED_RESOLUTION_MS = 60 * 1000
/** Characters of the secret kept for display: the prefix plus 4 of the random part. */
const DISPLAY_PREFIX_LENGTH = API_TOKEN_PREFIX.length + 4
const SECRET_PATTERN = /^shmk_[A-Za-z0-9_-]{43}$/

export interface ApiTokenView {
  id: string
  name: string
  prefix: string
  role: ApiTokenRole
  createdAt: number
  expiresAt: number | null
  lastUsedAt: number | null
}

interface ApiTokenRow {
  id: string
  name: string
  prefix: string
  role: string
  created_at: number
  expires_at: number | null
  last_used_at: number | null
}

export function isApiTokenRole(value: string): value is ApiTokenRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value)
}

export function apiTokenSubject(id: string): string {
  return `api-token:${id}`
}

function digest(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

function toView(row: ApiTokenRow): ApiTokenView {
  const role: ApiTokenRole = isApiTokenRole(row.role) ? row.role : 'viewer'
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
  }
}

export function listApiTokens(): ApiTokenView[] {
  const rows = getDatabase()
    .prepare(
      'SELECT id, name, prefix, role, created_at, expires_at, last_used_at FROM api_tokens ORDER BY created_at DESC',
    )
    .all() as ApiTokenRow[]
  return rows.map(toView)
}

export function createApiToken(input: {
  name: string
  role: ApiTokenRole
  expiresAt?: number | null
  now?: number
}): { token: string; apiToken: ApiTokenView } {
  const now = input.now ?? Date.now()
  const random = crypto.getRandomValues(new Uint8Array(32)).toBase64({
    alphabet: 'base64url',
    omitPadding: true,
  })
  const token = `${API_TOKEN_PREFIX}${random}`
  const row: ApiTokenRow = {
    id: crypto.randomUUID(),
    name: input.name,
    prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
    role: input.role,
    created_at: now,
    expires_at: input.expiresAt ?? null,
    last_used_at: null,
  }
  getDatabase()
    .prepare(
      'INSERT INTO api_tokens (id, name, token_hash, prefix, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(row.id, row.name, digest(token), row.prefix, row.role, row.created_at, row.expires_at)
  return { token, apiToken: toView(row) }
}

/** Revoke a token. Returns false when no such token exists. */
export function revokeApiToken(id: string): boolean {
  const result = getDatabase().prepare('DELETE FROM api_tokens WHERE id = ?').run(id)
  return result.changes > 0
}

/** Resolve a presented secret into the principal it stands for, or null when unknown/expired. */
export function getApiTokenPrincipal(
  secret: string,
  now: number = Date.now(),
): AuthPrincipal | null {
  if (!SECRET_PATTERN.test(secret)) return null
  const db = getDatabase()
  const row = db
    .prepare('SELECT id, role, expires_at, last_used_at FROM api_tokens WHERE token_hash = ?')
    .get(digest(secret)) as
    | { id: string; role: string; expires_at: number | null; last_used_at: number | null }
    | undefined
  if (!row) return null
  if (row.expires_at !== null && row.expires_at <= now) return null
  if (!isAuthRole(row.role) || row.role === 'anonymous') return null
  if (row.last_used_at === null || now - row.last_used_at >= LAST_USED_RESOLUTION_MS) {
    db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').run(now, row.id)
  }
  const role: AuthRole = row.role
  return { subject: apiTokenSubject(row.id), role, authMethod: 'bearer' }
}

import { describe, expect, it } from 'vitest'
import type { PluginConfigSchema } from '../plugin-types.js'
import { validateAgainstSchema } from './validate-schema.js'

const schema: PluginConfigSchema = {
  type: 'object',
  required: ['email'],
  properties: { email: { type: 'string', format: 'email' } },
}

describe('email format validation', () => {
  it.each(['user@example.com', 'a+b@example.co.jp', 'a@b.c.', 'a@.b.c'])(
    'preserves the permissive format contract for %s',
    (email) => expect(validateAgainstSchema(schema, { email }).ok).toBe(true),
  )

  it.each(['', '@example.com', 'a@@b.c', 'a@b', 'a@.b', 'a@b.', 'a b@c.d', 'a@b.c\n'])(
    'rejects invalid input %j',
    (email) => expect(validateAgainstSchema(schema, { email }).ok).toBe(false),
  )

  it('handles long dotted domains without backtracking', () => {
    const prefix = `!@!.${'!.'.repeat(100_000)}`
    expect(validateAgainstSchema(schema, { email: `${prefix} ` }).ok).toBe(false)
    expect(validateAgainstSchema(schema, { email: `${prefix}x` }).ok).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { escapeLabelValue, labelSelector } from './plugin.js'

describe('escapeLabelValue', () => {
  it('escapes backslash, double-quote, and newline', () => {
    expect(escapeLabelValue('plain')).toBe('plain')
    expect(escapeLabelValue('a"b')).toBe('a\\"b')
    expect(escapeLabelValue('a\\b')).toBe('a\\\\b')
    expect(escapeLabelValue('a\nb')).toBe('a\\nb')
  })

  it('neutralizes a PromQL injection attempt', () => {
    // A malicious instance value trying to break out of the selector.
    const evil = '10.0.0.1"} or up{job="x'
    const escaped = escapeLabelValue(evil)
    // Every double-quote must be backslash-escaped, so none can close the
    // selector's quoted value.
    expect(escaped).not.toMatch(/(^|[^\\])"/)
    expect(escaped).toContain('\\"')
  })
})

describe('labelSelector', () => {
  it('builds a selector with escaped values and drops empties', () => {
    expect(labelSelector({ instance: '1.2.3.4', job: undefined })).toBe('{instance="1.2.3.4"}')
    expect(labelSelector({ instance: '1.2.3.4', job: 'snmp' })).toBe(
      '{instance="1.2.3.4",job="snmp"}',
    )
    expect(labelSelector({ instance: '', job: '' })).toBe('{}')
  })

  it('escapes injected quotes so the selector stays well-formed', () => {
    const sel = labelSelector({ instance: 'x"} or up{' })
    // exactly one opening and closing brace, the inner quote escaped
    expect(sel.startsWith('{instance="')).toBe(true)
    expect(sel.endsWith('"}')).toBe(true)
    expect(sel).toContain('\\"')
  })
})

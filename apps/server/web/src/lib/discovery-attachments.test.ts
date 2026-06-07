// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Attachment } from './api'
import {
  accessKey,
  isAuthoredAttachment,
  stripProvenance,
  unifyAccessRows,
} from './discovery-attachments'

describe('accessKey', () => {
  it('matches core attachmentKey for access (access:<protocol>)', () => {
    expect(accessKey('snmp')).toBe('access:snmp')
    expect(accessKey('ssh')).toBe('access:ssh')
  })
})

describe('isAuthoredAttachment', () => {
  it('intrinsic when provenance.source is "intrinsic"', () => {
    expect(
      isAuthoredAttachment({ kind: 'policy', mode: 'auto', provenance: { source: 'intrinsic' } }),
    ).toBe(true)
  })
  it('intrinsic when provenance is absent (fresh local attachment)', () => {
    expect(isAuthoredAttachment({ kind: 'access', protocol: 'ssh' })).toBe(true)
  })
  it('not intrinsic when provenance.source is a discovery source', () => {
    expect(
      isAuthoredAttachment({
        kind: 'access',
        protocol: 'snmp',
        community: 'public',
        provenance: { source: 'network-scan:1' },
      }),
    ).toBe(false)
  })
})

describe('unifyAccessRows (one editable row per protocol — no two-tier)', () => {
  it('an observed-only protocol becomes one row whose value is editable (no separate layer)', () => {
    const observed: Attachment[] = [
      { kind: 'access', protocol: 'snmp', community: 'public', provenance: { source: 'scan:1' } },
    ]
    const rows = unifyAccessRows([], observed)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.protocol).toBe('snmp')
    expect(rows[0]?.authored).toBeUndefined() // not overridden — effective = observed
    expect(rows[0]?.observed?.kind === 'access' ? rows[0]?.observed?.protocol : undefined).toBe(
      'snmp',
    )
  })

  it('an override and its observed value collapse into ONE row (override + fallback both kept)', () => {
    const intrinsic: Attachment[] = [{ kind: 'access', protocol: 'snmp', community: 'override' }]
    const observed: Attachment[] = [
      { kind: 'access', protocol: 'snmp', community: 'public', provenance: { source: 'scan:1' } },
    ]
    const rows = unifyAccessRows(intrinsic, observed)
    expect(rows).toHaveLength(1) // one row, not two layers
    expect(rows[0]?.authored?.kind === 'access' ? rows[0]?.authored?.protocol : undefined).toBe(
      'snmp',
    )
    expect(rows[0]?.observed).toBeDefined() // the observed value is the revert target
  })

  it('mixes overridden snmp, a pure-intrinsic ssh, and leaves policy out', () => {
    const intrinsic: Attachment[] = [
      { kind: 'access', protocol: 'snmp', community: 'mine' },
      { kind: 'access', protocol: 'ssh', username: 'admin' },
      { kind: 'policy', mode: 'disabled' },
    ]
    const observed: Attachment[] = [
      { kind: 'access', protocol: 'snmp', community: 'public', provenance: { source: 'scan:1' } },
    ]
    const rows = unifyAccessRows(intrinsic, observed)
    expect(rows.map((r) => r.protocol)).toEqual(['snmp', 'ssh'])
    const ssh = rows.find((r) => r.protocol === 'ssh')
    expect(ssh?.authored).toBeDefined()
    expect(ssh?.observed).toBeUndefined() // pure intrinsic → remove deletes it outright
  })
})

describe('stripProvenance', () => {
  it('drops provenance so the value PATCHes as a plain intrinsic attachment', () => {
    const a: Attachment = {
      kind: 'access',
      protocol: 'snmp',
      community: 'x',
      provenance: { source: 'intrinsic' },
    }
    expect(stripProvenance(a)).toEqual({ kind: 'access', protocol: 'snmp', community: 'x' })
  })
})

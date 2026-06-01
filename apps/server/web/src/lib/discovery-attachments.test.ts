// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Attachment } from './api'
import {
  isAuthoredAttachment,
  partitionAttachments,
  stripProvenance,
} from './discovery-attachments'

describe('isAuthoredAttachment (C5)', () => {
  it('authored when provenance.source is "authored"', () => {
    expect(
      isAuthoredAttachment({ kind: 'policy', mode: 'auto', provenance: { source: 'authored' } }),
    ).toBe(true)
  })
  it('authored when provenance is absent (fresh local attachment)', () => {
    expect(isAuthoredAttachment({ kind: 'access', protocol: 'ssh' })).toBe(true)
  })
  it('observed when provenance.source is a discovery source', () => {
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

describe('partitionAttachments (C5 — read-only observed vs editable human)', () => {
  it('an observed-only access goes to observedAccess (read-only), not authored', () => {
    const attachments: Attachment[] = [
      { kind: 'access', protocol: 'snmp', community: 'public', provenance: { source: 'scan:1' } },
    ]
    const { authored, observedAccess } = partitionAttachments(attachments)
    expect(authored).toHaveLength(0) // no ✕ — nothing the operator can remove
    expect(observedAccess).toHaveLength(1)
    expect(observedAccess[0]?.protocol).toBe('snmp')
  })

  it('a human access is editable, and a human override hides the observed row of the same protocol', () => {
    const attachments: Attachment[] = [
      // resolve already deduped: only the authored snmp survives, but assert
      // the partition is robust even if both are present.
      { kind: 'access', protocol: 'snmp', community: 'public', provenance: { source: 'scan:1' } },
      {
        kind: 'access',
        protocol: 'snmp',
        community: 'override',
        provenance: { source: 'authored' },
      },
    ]
    const { authored, observedAccess } = partitionAttachments(attachments)
    expect(authored).toHaveLength(1)
    expect(observedAccess).toHaveLength(0) // observed snmp hidden — authored supersedes it
  })

  it('mixes: human ssh editable, observed snmp read-only, authored policy editable', () => {
    const attachments: Attachment[] = [
      { kind: 'access', protocol: 'snmp', community: 'public', provenance: { source: 'scan:1' } },
      { kind: 'access', protocol: 'ssh', username: 'admin', provenance: { source: 'authored' } },
      { kind: 'policy', mode: 'disabled', provenance: { source: 'authored' } },
    ]
    const { authored, observedAccess } = partitionAttachments(attachments)
    expect(authored.map((a) => a.kind).sort()).toEqual(['access', 'policy'])
    expect(observedAccess.map((a) => a.protocol)).toEqual(['snmp'])
  })
})

describe('stripProvenance', () => {
  it('drops provenance so the value PATCHes as a plain authored attachment', () => {
    const a: Attachment = {
      kind: 'access',
      protocol: 'snmp',
      community: 'x',
      provenance: { source: 'authored' },
    }
    expect(stripProvenance(a)).toEqual({ kind: 'access', protocol: 'snmp', community: 'x' })
  })
})

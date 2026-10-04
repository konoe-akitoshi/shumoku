// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { buildNetPolicy, isOriginAllowed } from './net-policy.js'

describe('buildNetPolicy', () => {
  it('allows the origin of every format: uri field, and nothing from other fields', () => {
    const schema = {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        webhookUrl: { type: 'string', format: 'uri' },
        token: { type: 'string' },
      },
    }
    const policy = buildNetPolicy(schema, {
      url: 'https://netbox.example.com/api/',
      webhookUrl: 'https://hooks.example.org/notify',
      token: 'https://not-a-destination.example.net',
    })
    expect(policy.allowedOrigins).toEqual([
      'https://netbox.example.com',
      'https://hooks.example.org',
    ])
  })

  it('collects origins from format: uri fields nested under an object field', () => {
    const schema = {
      type: 'object',
      properties: {
        alertmanager: {
          type: 'object',
          properties: { url: { type: 'string', format: 'uri' } },
        },
      },
    }
    const policy = buildNetPolicy(schema, {
      alertmanager: { url: 'https://alerts.example.com/api/v2' },
    })
    expect(policy.allowedOrigins).toEqual(['https://alerts.example.com'])
  })

  it('allows nothing for a format: uri field left unset', () => {
    const schema = {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        alertmanager: {
          type: 'object',
          properties: { url: { type: 'string', format: 'uri' } },
        },
      },
    }
    expect(buildNetPolicy(schema, {}).allowedOrigins).toEqual([])
  })

  it('treats a format: uri field saved as an empty string as unset', () => {
    // The Web UI's SchemaForm saves a text field the user typed into and then
    // cleared as '' rather than dropping the key.
    const schema = {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        alertmanagerUrl: { type: 'string', format: 'uri' },
      },
    }
    const policy = buildNetPolicy(schema, {
      url: 'https://prometheus.example.com',
      alertmanagerUrl: '',
    })
    expect(policy.allowedOrigins).toEqual(['https://prometheus.example.com'])
  })

  // Only '' means blank: whitespace is still a value, and not a URL.
  it.each(['netbox.local', ' '])(
    'names the field and value when a format: uri field is %j, not a URL',
    (value) => {
      const schema = {
        type: 'object',
        properties: {
          alertmanager: {
            type: 'object',
            properties: { url: { type: 'string', format: 'uri' } },
          },
        },
      }
      expect(() => buildNetPolicy(schema, { alertmanager: { url: value } })).toThrow(
        `Config field "alertmanager.url" is not a valid URL: ${value}`,
      )
    },
  )
})

describe('isOriginAllowed', () => {
  const policy = { allowedOrigins: ['https://netbox.example.com'] }

  it('allows a URL matching an allowed origin exactly', () => {
    expect(isOriginAllowed(policy, 'https://netbox.example.com/api/devices/')).toBe(true)
  })

  it.each([
    ['host', 'https://evil.example.com/api/devices/'],
    ['port', 'https://netbox.example.com:8443/api/'],
    ['scheme', 'http://netbox.example.com/api/'],
  ])('rejects a URL with a different %s', (_part, url) => {
    expect(isOriginAllowed(policy, url)).toBe(false)
  })

  it('rejects a non-http(s) scheme even when its origin matches the allowed list', () => {
    const ftpPolicy = { allowedOrigins: ['ftp://netbox.example.com'] }
    expect(isOriginAllowed(ftpPolicy, 'ftp://netbox.example.com/devices')).toBe(false)
  })
})

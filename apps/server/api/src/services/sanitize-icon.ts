// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Sanitize an untrusted plugin `spec.icon` at the ingestion boundary, using a
// jsdom-backed DOMPurify (no `window` under node/bun). jsdom is server-only.

import { sanitizeIconSvgWith } from '@shumoku/core'
import createDOMPurify, { type DOMPurify } from 'dompurify'
import { JSDOM } from 'jsdom'

let purify: DOMPurify | null = null

function getPurify(): DOMPurify {
  if (!purify) {
    const { window } = new JSDOM('')
    purify = createDOMPurify(window)
  }
  return purify
}

export function sanitizeObservationIcon(icon: string): string {
  return sanitizeIconSvgWith(getPurify(), icon)
}

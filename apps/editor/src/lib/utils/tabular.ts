// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Cell escapers for tabular text formats used by export buttons.
// CSV follows RFC 4180 (quote when the cell holds delimiters,
// quotes, or newlines); TSV is for clipboard paste into spreadsheets
// — no quoting rules, just sanitize embedded tabs/newlines so the
// row shape survives.

export function csvCell(value: string | number | undefined | null): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function tsvCell(value: string | number | undefined | null): string {
  if (value == null) return ''
  return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}

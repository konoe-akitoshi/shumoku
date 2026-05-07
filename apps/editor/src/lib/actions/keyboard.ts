// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { getActionContext } from './context-provider.svelte'
import { runAction, visibleActions } from './registry'
import type { Action } from './types'

// Window-level keyboard dispatcher. Reads the active context from
// the provider, walks visible actions, and runs the first one
// whose `shortcut` matches the event. Pages don't wire shortcuts
// individually — defining a shortcut on an Action is enough.
//
// Skip-when-typing is built in: events from inputs / textareas /
// contenteditable elements pass through to the page so users can
// type Mod+Z to undo their text input rather than the diagram.

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

interface ParsedShortcut {
  needsMod: boolean
  needsShift: boolean
  needsAlt: boolean
  /** Lower-cased final key (e.g. 'z', '0', '=', '-', 'delete'). */
  key: string
}

function parseShortcut(s: string): ParsedShortcut | null {
  const parts = s.split('+').map((p) => p.trim())
  const last = parts[parts.length - 1]?.toLowerCase()
  if (!last) return null
  return {
    needsMod: parts.some((p) => p === 'Mod' || p === '⌘' || p === 'Ctrl' || p === 'Cmd'),
    needsShift: parts.includes('Shift'),
    needsAlt: parts.includes('Alt') || parts.includes('Option'),
    key: last,
  }
}

function eventMatches(parsed: ParsedShortcut, e: KeyboardEvent): boolean {
  // ⌘ on macOS = metaKey; on Windows / Linux = ctrlKey. Either is
  // accepted as "Mod" so people pasting Win shortcuts on Mac (or
  // vice versa) still hit something sensible.
  const modPressed = isMac ? e.metaKey : e.ctrlKey
  if (parsed.needsMod !== modPressed) return false
  if (parsed.needsShift !== e.shiftKey) return false
  if (parsed.needsAlt !== e.altKey) return false

  const k = e.key.toLowerCase()
  // Tolerate '+' / '_' which require Shift on US layouts.
  if (parsed.key === '=') return k === '=' || k === '+'
  if (parsed.key === '-') return k === '-' || k === '_'
  if (parsed.key === 'del' || parsed.key === 'delete') {
    return k === 'delete' || k === 'backspace'
  }
  return k === parsed.key
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return /^(input|textarea|select)$/i.test(target.tagName)
}

/** Install the global handler; returns a cleanup. */
export function installKeyboardShortcuts(): () => void {
  if (typeof window === 'undefined') return () => {}

  function handler(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return
    const ctx = getActionContext()
    let match: { action: Action; parsed: ParsedShortcut } | null = null
    for (const a of visibleActions(ctx)) {
      if (!a.shortcut) continue
      const parsed = parseShortcut(a.shortcut)
      if (!parsed) continue
      if (eventMatches(parsed, e)) {
        match = { action: a, parsed }
        break
      }
    }
    if (!match) return
    if (match.action.enabled && !match.action.enabled(ctx)) return
    e.preventDefault()
    void runAction(match.action.id, ctx)
  }

  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}

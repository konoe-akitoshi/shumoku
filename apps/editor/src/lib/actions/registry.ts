// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Action, ActionContext, ActionGroup } from './types'

// Single-process registry. Actions register themselves at module
// load (see `builtin.ts`) and consumers query by id or by context.

const actions = new Map<string, Action>()

export function defineAction(action: Action): void {
  if (actions.has(action.id)) {
    console.warn(`[actions] re-defining action ${action.id}`)
  }
  actions.set(action.id, action)
}

export function getAction(id: string): Action | undefined {
  return actions.get(id)
}

/**
 * Actions visible for `ctx`, with `when` filter applied. Caller
 * decides what to do with `enabled === false` (typically render
 * disabled). Stable insertion order is preserved.
 */
export function visibleActions(ctx: ActionContext): Action[] {
  const out: Action[] = []
  for (const a of actions.values()) {
    if (a.when && !a.when(ctx)) continue
    out.push(a)
  }
  return out
}

/** Same as `visibleActions` but bucketed by group, group keys preserved in registration order. */
export function visibleActionsByGroup(ctx: ActionContext): Array<[ActionGroup, Action[]]> {
  const buckets = new Map<ActionGroup, Action[]>()
  for (const a of visibleActions(ctx)) {
    const g = a.group ?? 'misc'
    let bucket = buckets.get(g)
    if (!bucket) {
      bucket = []
      buckets.set(g, bucket)
    }
    bucket.push(a)
  }
  return [...buckets.entries()]
}

/** Run an action by id. Returns whether it ran (id matched and `enabled` allowed). */
export async function runAction(id: string, ctx: ActionContext): Promise<boolean> {
  const a = actions.get(id)
  if (!a) return false
  if (a.when && !a.when(ctx)) return false
  if (a.enabled && !a.enabled(ctx)) return false
  await a.run(ctx)
  return true
}

/** Test-only / module-reset helper. */
export function _resetRegistry(): void {
  actions.clear()
}

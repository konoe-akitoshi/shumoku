/**
 * A dashboard's layout as stored (`Dashboard.layoutJson`): a grid of widgets, each a type, its
 * config and a cell box. The Server reads only `widgets[].config.topologyId` / `.dataSourceId`
 * from it, to know what a shared dashboard may read (`apps/server/api/src/app/share.ts`), so
 * those two keys keep their names in every widget's config.
 */

import type { DashboardLayout, WidgetInstance, WidgetPosition } from '$lib/types'

export type { DashboardLayout, WidgetInstance, WidgetPosition }

export const DEFAULT_LAYOUT: DashboardLayout = {
  columns: 12,
  rowHeight: 100,
  margin: 8,
  widgets: [],
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback
}

function cell(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads a stored layout. What a layout written by an older version (or by hand) leaves out or
 * gets wrong takes the default; a widget without an id or a type is dropped, since nothing can
 * show it.
 */
export function parseLayout(json: string | undefined): DashboardLayout {
  let raw: unknown
  try {
    raw = json ? JSON.parse(json) : {}
  } catch {
    raw = {}
  }
  const layout = isRecord(raw) ? raw : {}
  const widgets: WidgetInstance[] = []
  const seen = new Set<string>()
  for (const w of Array.isArray(layout['widgets']) ? layout['widgets'] : []) {
    if (!isRecord(w)) continue
    const id = w['id']
    const type = w['type']
    if (typeof id !== 'string' || !id || typeof type !== 'string' || !type || seen.has(id)) continue
    seen.add(id)
    const position = isRecord(w['position']) ? w['position'] : {}
    widgets.push({
      id,
      type,
      config: isRecord(w['config']) ? { ...w['config'] } : {},
      position: {
        x: cell(position['x']),
        y: cell(position['y']),
        w: positiveInt(position['w'], 4),
        h: positiveInt(position['h'], 3),
      },
    })
  }
  return {
    columns: positiveInt(layout['columns'], DEFAULT_LAYOUT.columns),
    rowHeight: positiveInt(layout['rowHeight'], DEFAULT_LAYOUT.rowHeight),
    margin: cell(layout['margin'] ?? DEFAULT_LAYOUT.margin),
    widgets,
  }
}

/** The first row below every widget: where a widget goes when no free cell is known. */
export function rowBelow(widgets: readonly WidgetInstance[]): number {
  let bottom = 0
  for (const w of widgets) bottom = Math.max(bottom, w.position.y + w.position.h)
  return bottom
}

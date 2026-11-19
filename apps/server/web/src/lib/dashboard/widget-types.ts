/**
 * What a widget is to the dashboard: its definition (name, icon, sizes, config schema,
 * component) and the props every widget component takes. The list of widgets is in
 * `./widgets.ts`.
 */

import type { PluginConfigSchema } from '@shumoku/core'
import type { SquaresFourIcon } from 'phosphor-svelte'
import type { Component } from 'svelte'

export interface WidgetProps {
  /** This widget's id in the layout. */
  id: string
  /** Its config, with the schema's defaults filled in. */
  config: Record<string, unknown>
  /** Name the widget's header when its config gives no title (e.g. the topology's name). */
  setTitle: (title: string) => void
  /** Open this widget's settings; absent while the dashboard is not being edited. */
  openSettings?: () => void
}

export interface WidgetDefinition {
  type: string
  displayName: string
  description: string
  icon: typeof SquaresFourIcon
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
  /**
   * Rendered by the generic `SchemaForm`. A `topologyId` / `dataSourceId` key is what a shared
   * dashboard may read (the Server reads those two names from the layout), so a widget names
   * what it reads with them. Dynamic choices use `optionsSource`: `topologies`, `alert-sources`.
   */
  configSchema: PluginConfigSchema
  /** Shows only what is not server-wide inventory, so it works on a shared dashboard. */
  shareable: boolean
  /** Its content runs to the frame's edges (no padding, no scroll): a drawing. */
  bleed?: boolean
  component: Component<WidgetProps>
}

/** The schema's defaults under `config`: what a widget reads, and what its settings form edits. */
export function withDefaults(
  definition: WidgetDefinition,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(definition.configSchema.properties)) {
    if (prop.default !== undefined) out[key] = prop.default
  }
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined && value !== '') out[key] = value
  }
  return out
}

export function configString(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

export function configNumber(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = config[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function configBoolean(config: Record<string, unknown>, key: string): boolean {
  return config[key] === true
}

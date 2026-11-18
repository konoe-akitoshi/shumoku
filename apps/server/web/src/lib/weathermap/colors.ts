/**
 * The colours the live layers draw with: a link's utilization, a device's status and its
 * monitoring path, per theme. Each is worked out in OKLCH for the theme it is drawn on, so it is
 * seen against the diagram (`colors.test.ts`):
 *
 * - A link's colour keeps 3.6:1 against the background. A group's surface lies within 1.2:1 of
 *   the background, so on a group it still keeps 3:1 (WCAG 2.1, 1.4.11 Non-text Contrast).
 * - A status border and a monitoring badge keep 3:1 against the card they sit on.
 * - Neighbouring utilization steps are told apart, as far as two line colours must be.
 * - Each step has a `flow`: the same hue, lighter, for the dots that stream along the link over
 *   its colour, so the motion is seen without fading the link itself.
 *
 * The colours reach the page as CSS variables (`metricColorsCss`), set for the light theme on
 * `:root` and for the dark one on `.dark`, the class the theme store puts on `<html>`, so the
 * components name a variable and follow the theme without being told it.
 */

export type MetricTheme = 'light' | 'dark'

/** A utilization step: up to which percentage it holds, and what it is called. */
export interface UtilizationStep {
  key: 'idle' | 'low' | 'moderate' | 'busy' | 'high' | 'saturated'
  upTo: number
  label: string
}

/** From idle up to full, each step holding the utilizations up to its `upTo`. */
export const UTILIZATION_STEPS: readonly UtilizationStep[] = [
  { key: 'idle', upTo: 0, label: '0% · no data' },
  { key: 'low', upTo: 25, label: '≤25%' },
  { key: 'moderate', upTo: 50, label: '≤50%' },
  { key: 'busy', upTo: 75, label: '≤75%' },
  { key: 'high', upTo: 90, label: '≤90%' },
  { key: 'saturated', upTo: 100, label: '>90%' },
]

export const DEVICE_STATUSES = ['up', 'down', 'warning', 'degraded', 'unknown'] as const
export const MONITORING_STATES = ['healthy', 'degraded', 'failing', 'pending', 'paused'] as const

export interface MetricPalette {
  /** A link's colour at each step, and the lighter one its flow streams in. */
  utilization: Record<UtilizationStep['key'], { link: string; flow: string }>
  status: Record<(typeof DEVICE_STATUSES)[number], string>
  monitoring: Record<(typeof MONITORING_STATES)[number], string>
}

/** Grey, green, amber, orange, red and crimson; status and monitoring reuse them, plus blue. */
function palette(c: {
  grey: [string, string]
  green: [string, string]
  amber: [string, string]
  orange: [string, string]
  red: [string, string]
  crimson: [string, string]
  blue: string
}): MetricPalette {
  const step = ([link, flow]: [string, string]) => ({ link, flow })
  return {
    utilization: {
      idle: step(c.grey),
      low: step(c.green),
      moderate: step(c.amber),
      busy: step(c.orange),
      high: step(c.red),
      saturated: step(c.crimson),
    },
    status: {
      up: c.green[0],
      down: c.red[0],
      warning: c.orange[0],
      degraded: c.amber[0],
      unknown: c.grey[0],
    },
    monitoring: {
      healthy: c.green[0],
      degraded: c.amber[0],
      failing: c.red[0],
      pending: c.grey[0],
      paused: c.blue,
    },
  }
}

export const METRIC_PALETTES: Readonly<Record<MetricTheme, MetricPalette>> = {
  // Links at OKLCH L .56 (crimson .46), flows at L .84; hues 145, 95, 50, 27, 355.
  light: palette({
    grey: ['#747474', '#cacaca'],
    green: ['#008f19', '#70ea79'],
    amber: ['#8b7300', '#e3ca6a'],
    orange: ['#b85300', '#ffb789'],
    red: ['#d8151e', '#ffb3a9'],
    crimson: ['#a1005d', '#ff96c2'],
    blue: '#0070e8',
  }),
  // Links at OKLCH L .71 (red and crimson .66), flows at L .9.
  dark: palette({
    grey: ['#a1a1a1', '#dedede'],
    green: ['#0fc338', '#70ff7c'],
    amber: ['#bf9f00', '#fddd5b'],
    orange: ['#fb7600', '#ffd2b5'],
    red: ['#fc4540', '#ffd0c9'],
    crimson: ['#f14499', '#ffc2da'],
    blue: '#56a3ff',
  }),
}

/** The step a utilization (a percentage) falls in; anything not a number is idle (no data). */
export function utilizationStep(utilization: number): UtilizationStep {
  const idle = UTILIZATION_STEPS[0] as UtilizationStep
  if (!Number.isFinite(utilization)) return idle
  const u = Math.max(0, Math.min(100, utilization))
  return UTILIZATION_STEPS.find((s) => u <= s.upTo) ?? idle
}

const vars = (p: MetricPalette): string[] => [
  ...Object.entries(p.utilization).flatMap(([key, c]) => [
    `--shumoku-util-${key}: ${c.link};`,
    `--shumoku-util-${key}-flow: ${c.flow};`,
  ]),
  ...Object.entries(p.status).map(([key, c]) => `--shumoku-status-${key}: ${c};`),
  ...Object.entries(p.monitoring).map(([key, c]) => `--shumoku-monitoring-${key}: ${c};`),
]

/** The palettes as CSS variables: the light one on `:root`, the dark one on `.dark`. */
export function metricColorsCss(): string {
  return `:root { ${vars(METRIC_PALETTES.light).join(' ')} }\n.dark { ${vars(METRIC_PALETTES.dark).join(' ')} }`
}

/** A link's colour at a utilization, as the CSS variable that follows the theme. */
export function utilizationColor(utilization: number): string {
  return `var(--shumoku-util-${utilizationStep(utilization).key})`
}

/** The colour a link's flow streams in at a utilization, as a CSS variable. */
export function utilizationFlowColor(utilization: number): string {
  return `var(--shumoku-util-${utilizationStep(utilization).key}-flow)`
}

/** A device's status colour, as a CSS variable. */
export function statusColor(status: (typeof DEVICE_STATUSES)[number]): string {
  return `var(--shumoku-status-${status})`
}

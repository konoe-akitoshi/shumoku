/**
 * One shown dashboard, as its widgets share it: how to read (`reader`), whether it is being
 * edited, and what the widgets ask of each other.
 *
 * Widgets meet through state, not one-shot events. A widget that wants nodes marked says so
 * (`setMarks`, `setFocus`) and keeps saying it until it stops (`clearMarks`, `clearFocus`); a
 * topology widget draws from what is asked now. So a topology that mounts, or whose host mapping
 * loads, after an alert came in still shows it, and a mark goes away when the alert does.
 * Moving a topology's camera is an act, not a state, so topology widgets register a handle
 * (`registerTopology`) that the others call.
 */

import { createContext } from 'svelte'
import type { DashboardReader } from './reader'

/**
 * A host to mark, in a colour; `rank` orders marks on one host (higher wins: more severe).
 * `newSince` is set while what the mark is for is new: when it started (ms). A topology pulses a
 * new mark, and one set to follow alerts flies to it.
 */
export interface HostMark {
  host: string
  color: string
  rank: number
  newSince?: number
}

type Mark = Omit<HostMark, 'host'>

/** Two marks on one host as one: the more severe's colour and rank, new if either is. */
function merge(held: Mark | undefined, mark: Mark): Mark {
  if (!held) return mark
  const top = mark.rank > held.rank ? mark : held
  const newSince = Math.max(held.newSince ?? 0, mark.newSince ?? 0) || undefined
  return newSince ? { ...top, newSince } : { color: top.color, rank: top.rank }
}

/**
 * What the pointer is on, in another widget: the nodes to bring forward while it stays there.
 * One at a time; a newer focus replaces an older one.
 */
export interface Focus {
  /** The widget asking. Only it clears its focus. */
  source: string
  /** Only this topology; absent, every topology on the dashboard. */
  topologyId?: string
  hosts?: readonly string[]
  nodeIds?: readonly string[]
  color?: string
  /** Dim everything else. */
  dim?: boolean
}

/** A topology widget, as the others can move it. */
export interface TopologyHandle {
  readonly topologyId: string
  /**
   * Bring the node a host is drawn as into view. `peek` remembers the view first, for `restore`
   * (a hover); without it, the move stays (a click). False when the host is not on this topology.
   */
  showHost(host: string, options: { peek: boolean }): boolean
  /** Go back to the view a peek remembered, if one did. */
  restore(): void
}

export class DashboardState {
  readonly reader: DashboardReader
  editing = $state(false)
  focus = $state<Focus | null>(null)

  /** By widget id: host → its mark. */
  #marks = $state<Record<string, Record<string, Mark>>>({})
  #topologies = new Set<TopologyHandle>()
  /** By topology widget id: monitored host → the name its node has on that topology. */
  #hostLabels = $state<Record<string, Record<string, string>>>({})

  constructor(reader: DashboardReader) {
    this.reader = reader
  }

  /** Host → the most severe mark any widget keeps on it, new if any of them is. */
  readonly hostMarks = $derived.by(() => {
    const out = new Map<string, Mark>()
    for (const marks of Object.values(this.#marks)) {
      for (const [host, mark] of Object.entries(marks)) out.set(host, merge(out.get(host), mark))
    }
    return out
  })

  /** Replace what `source` asks to keep marked. */
  setMarks(source: string, marks: Iterable<HostMark>): void {
    const byHost: Record<string, Mark> = {}
    for (const { host, ...mark } of marks) byHost[host] = merge(byHost[host], mark)
    this.#marks[source] = byHost
  }

  clearMarks(source: string): void {
    delete this.#marks[source]
  }

  setFocus(focus: Focus): void {
    this.focus = focus
  }

  /** Drop `source`'s focus; another widget's newer focus stays. */
  clearFocus(source: string): void {
    if (this.focus?.source === source) this.focus = null
  }

  /**
   * Say what the hosts are called on a topology: the device names an operator knows, where the
   * monitoring system only has its own host names. Replaces what `source` said before.
   */
  setHostLabels(source: string, labels: Record<string, string>): void {
    this.#hostLabels[source] = labels
  }

  clearHostLabels(source: string): void {
    delete this.#hostLabels[source]
  }

  /** A host's name on the dashboard's topologies, if one draws it. */
  hostLabel(host: string): string | undefined {
    for (const labels of Object.values(this.#hostLabels)) {
      const label = labels[host]
      if (label) return label
    }
    return undefined
  }

  /** Returns the unregister function. */
  registerTopology(handle: TopologyHandle): () => void {
    this.#topologies.add(handle)
    return () => this.#topologies.delete(handle)
  }

  /** Every topology widget shown now (optionally only one topology's). */
  topologies(topologyId?: string): TopologyHandle[] {
    return [...this.#topologies].filter((t) => !topologyId || t.topologyId === topologyId)
  }
}

const [getDashboard, setDashboard] = createContext<DashboardState>()

/** The dashboard this widget is shown in. */
export const useDashboard = getDashboard
export const provideDashboard = setDashboard

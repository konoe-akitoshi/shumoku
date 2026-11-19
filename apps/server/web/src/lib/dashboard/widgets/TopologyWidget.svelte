<script lang="ts">
  import type { NetworkGraph } from '@shumoku/core'
  /**
   * A topology on the dashboard: the same view as the topology's own page, compact. It marks the
   * nodes other widgets ask for: what the pointer is on in another widget (`focus`) while it
   * stays there, else every host an alert widget keeps marked; a new mark beats. Other widgets
   * move its camera through the handle it registers.
   *
   * On a wall display it moves by itself, and only while nobody uses it: with `followAlerts` it
   * flies to the nodes of a new alert (the most severe first, a burst in one flight), holds there
   * `HOLD_MS` and flies back to the whole topology; and a view someone moved and left goes back
   * to the whole topology after `returnAfterIdle` seconds. A person always wins: any move of
   * theirs stops a flight and keeps the view theirs for a while, and the pointer over the
   * topology holds everything.
   */
  import { severityRank } from '@shumoku/core/plugin-kit'
  import { ArrowSquareOutIcon, TreeStructureIcon } from 'phosphor-svelte'
  import { untrack } from 'svelte'
  import TopologyView from '$lib/components/topology/TopologyView.svelte'
  import type { AlertSeverity } from '$lib/types'
  import { nodeLabel } from '$lib/utils/node-label'
  import { useDashboard } from '../dashboard.svelte'
  import type { HostNodes } from '../reader'
  import { configBoolean, configNumber, configString, type WidgetProps } from '../widget-types'
  import WidgetEmpty from './WidgetEmpty.svelte'

  let { id, config, setTitle, openSettings }: WidgetProps = $props()
  const dashboard = useDashboard()
  const reader = dashboard.reader

  const topologyId = $derived(configString(config, 'topologyId'))
  const followAlerts = $derived(configBoolean(config, 'followAlerts'))
  const followMinRank = $derived(
    severityRank((configString(config, 'followMinSeverity') || 'high') as AlertSeverity),
  )
  const returnAfterIdleMs = $derived(Math.max(0, configNumber(config, 'returnAfterIdle', 120)) * 1000)

  /** How long a flight to new alerts holds before flying back. */
  const HOLD_MS = 20_000
  /** Flights to alerts at most this often, so a run of alerts does not throw the view about. */
  const FOLLOW_GAP_MS = 30_000

  let view = $state<TopologyView>()
  let hostNodes = $state<HostNodes>(new Map())
  let graph = $state.raw<NetworkGraph | null>(null)
  /** The view a hover peek moved away from, to go back to. */
  let peekFrom: { x: number; y: number; k: number } | null = null

  async function loadName(id: string) {
    try {
      const topology = await reader.topology(id)
      if (id === topologyId) setTitle(topology.name)
    } catch {
      // The header keeps its default title.
    }
  }

  /** Which node each host is: again with each drawing, since the mapping may have changed. */
  async function loadHostNodes(id: string) {
    try {
      const nodes = await reader.hostNodes(id)
      if (id === topologyId) hostNodes = nodes
    } catch {
      // No marks by host until the next drawing.
    }
  }

  $effect(() => {
    const id = topologyId
    hostNodes = new Map()
    peekFrom = null
    if (id) void loadName(id)
  })

  // What each host is called here, for the other widgets (an alert names its device by it).
  $effect(() => {
    const labels: Record<string, string> = {}
    const nodes = new Map((graph?.nodes ?? []).map((n) => [n.id, n]))
    for (const [host, nodeIds] of hostNodes) {
      const node = nodeIds[0] ? nodes.get(nodeIds[0]) : undefined
      if (node) labels[host] = nodeLabel(node)
    }
    dashboard.setHostLabels(id, labels)
  })
  $effect(() => () => dashboard.clearHostLabels(id))

  /** The marked nodes whose mark is new: they beat. */
  const fresh = $derived.by(() => {
    const out = new Set<string>()
    for (const [host, mark] of dashboard.hostMarks) {
      if (mark.newSince === undefined) continue
      for (const nodeId of hostNodes.get(host) ?? []) out.add(nodeId)
    }
    return out
  })

  // --- Moving by itself, only while nobody uses it ---

  /** When a person last moved this view (0: never). */
  let lastUserMove = 0
  let lastFlight = 0
  /** New marks already flown to, by host and start. */
  let followed = $state<Record<string, true>>({})
  /** A flight to alerts being held: its hosts, and when it flies back. */
  let showing = $state<{ hosts: string[]; backAt: number } | null>(null)
  /** Kept where it is by a person: no flight and no return until they resume. */
  let pinned = $state(false)
  let clock = $state(Date.now())
  let followTimer: ReturnType<typeof setTimeout> | undefined
  let returnTimer: ReturnType<typeof setTimeout> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  /** The new marks to fly to: severe enough, not flown to yet, drawn on this topology. */
  const candidates = $derived.by(() => {
    const out: { key: string; host: string; rank: number }[] = []
    for (const [host, mark] of dashboard.hostMarks) {
      if (mark.newSince === undefined || mark.rank < followMinRank) continue
      const key = `${host}@${mark.newSince}`
      if (followed[key] || !hostNodes.get(host)?.length) continue
      out.push({ key, host, rank: mark.rank })
    }
    return out
  })

  /** How long the view is a person's after they moved it: the idle return's wait, else 2 min. */
  const handsOffMs = $derived(returnAfterIdleMs || 120_000)

  function handsOff(): boolean {
    return (
      dashboard.editing ||
      pinned ||
      (view?.isPointerOver() ?? false) ||
      Date.now() - lastUserMove < handsOffMs
    )
  }

  function scheduleFollow(delay: number) {
    clearTimeout(followTimer)
    followTimer = setTimeout(tryFollow, delay)
  }

  function tryFollow() {
    if (!followAlerts || !view || candidates.length === 0) return
    if (handsOff()) return scheduleFollow(5_000)
    const wait = lastFlight + FOLLOW_GAP_MS - Date.now()
    if (wait > 0) return scheduleFollow(wait)
    // The most severe first; all of them at once, so a burst is one flight. The rest follow
    // after the gap.
    const top = Math.max(...candidates.map((c) => c.rank))
    const chosen = candidates.filter((c) => c.rank === top)
    for (const c of chosen) followed[c.key] = true
    const nodeIds = chosen.flatMap((c) => hostNodes.get(c.host) ?? [])
    if (!view.flyTo(nodeIds, { maxScale: 6 })) return
    lastFlight = Date.now()
    showing = { hosts: chosen.map((c) => c.host), backAt: lastFlight + HOLD_MS }
    clearTimeout(returnTimer)
    returnTimer = setTimeout(flyBack, HOLD_MS)
  }

  function flyBack() {
    clearTimeout(returnTimer)
    showing = null
    if (!pinned) view?.flyTo('fit')
  }

  function idleReturn() {
    if (pinned || dashboard.editing) return
    if (view?.isPointerOver()) {
      idleTimer = setTimeout(idleReturn, 10_000)
      return
    }
    view?.flyTo('fit')
  }

  /** A person moved the view: it is theirs; a held flight is over, and the idle wait starts. */
  function noteUserMove() {
    lastUserMove = Date.now()
    if (showing) {
      clearTimeout(returnTimer)
      showing = null
    }
    clearTimeout(idleTimer)
    if (returnAfterIdleMs > 0) idleTimer = setTimeout(idleReturn, returnAfterIdleMs)
  }

  function stay() {
    pinned = true
    clearTimeout(returnTimer)
    showing = null
  }

  function resume() {
    pinned = false
    view?.flyTo('fit')
    scheduleFollow(FOLLOW_GAP_MS)
  }

  $effect(() => {
    if (!followAlerts || candidates.length === 0) return
    untrack(() => scheduleFollow(0))
  })

  $effect(() => {
    const current = view
    if (!current) return
    return current.onUserMove(noteUserMove)
  })

  $effect(() => {
    if (!showing) return
    const timer = setInterval(() => {
      clock = Date.now()
    }, 1_000)
    return () => clearInterval(timer)
  })

  $effect(() => () => {
    clearTimeout(followTimer)
    clearTimeout(returnTimer)
    clearTimeout(idleTimer)
  })

  const highlight = $derived.by(() => {
    const marks = new Map<string, string | undefined>()
    const focus = dashboard.focus
    if (focus && (!focus.topologyId || focus.topologyId === topologyId)) {
      for (const nodeId of focus.nodeIds ?? []) marks.set(nodeId, focus.color)
      for (const host of focus.hosts ?? []) {
        for (const nodeId of hostNodes.get(host) ?? []) marks.set(nodeId, focus.color)
      }
      if (marks.size > 0) return { marks, dim: focus.dim === true }
    }
    for (const [host, mark] of dashboard.hostMarks) {
      for (const nodeId of hostNodes.get(host) ?? []) marks.set(nodeId, mark.color)
    }
    return { marks, dim: false }
  })

  $effect(() => {
    const id = topologyId
    if (!id) return
    return dashboard.registerTopology({
      topologyId: id,
      showHost(host, { peek }) {
        const nodeId = hostNodes.get(host)?.[0]
        if (!nodeId || !view) return false
        // Only the first peek of a run remembers the view, so a run of hovers goes back to
        // where it started; a click keeps where it goes.
        if (peek) peekFrom ??= view.getCameraTransform()
        else {
          peekFrom = null
          // A click in another widget moved it for a person: theirs, as a drag would be.
          noteUserMove()
        }
        view.panToNode(nodeId)
        return true
      },
      restore() {
        if (peekFrom) view?.setCameraTransform(peekFrom)
        peekFrom = null
      },
    })
  })

  function loadView(id: string) {
    return () => reader.view(id)
  }
</script>

{#if !topologyId}
  <WidgetEmpty icon={TreeStructureIcon} message="No topology selected" {openSettings} />
{:else}
  {#key topologyId}
    <TopologyView
      bind:this={view}
      graphLoader={loadView(topologyId)}
      liveSource={reader.liveSource(topologyId)}
      compact
      wheel="cooperative"
      marks={highlight.marks}
      dimOthers={highlight.dim}
      {fresh}
      onloaded={(loaded) => {
        graph = loaded
        if (topologyId) void loadHostNodes(topologyId)
      }}
    >
      {#snippet controls()}
        {#if !reader.shared}
          <a href="/topologies/{topologyId}" title="Open topology" aria-label="Open topology">
            <ArrowSquareOutIcon size={14} />
          </a>
        {/if}
      {/snippet}
    </TopologyView>
  {/key}
  {#if showing}
    <div class="follow-bar" role="status">
      <span>
        {showing.hosts.length === 1 ? showing.hosts[0] : `${showing.hosts.length} new alerts`}
        · back in {Math.max(0, Math.ceil((showing.backAt - clock) / 1000))} s
      </span>
      <button type="button" onclick={stay}>Stay</button>
      <button type="button" onclick={flyBack}>Back</button>
    </div>
  {:else if pinned}
    <div class="follow-bar" role="status">
      <span>Staying here</span>
      <button type="button" onclick={resume}>Resume</button>
    </div>
  {/if}
{/if}

<style>
  .follow-bar {
    position: absolute;
    left: 8px;
    bottom: 8px;
    z-index: 15;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: calc(100% - 16px);
    padding: 3px 4px 3px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-bg-elevated) 92%, transparent);
    border: 1px solid var(--border);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
  }
  .follow-bar span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .follow-bar button {
    flex-shrink: 0;
    padding: 1px 8px;
    border-radius: 4px;
    font-weight: 600;
    background: var(--color-bg-canvas);
  }
  .follow-bar button:hover {
    filter: brightness(1.2);
  }
</style>

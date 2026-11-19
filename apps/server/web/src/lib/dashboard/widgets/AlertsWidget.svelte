<script lang="ts">
  /**
   * Alerts from one alert-capable data source. It keeps the alerting hosts marked on the
   * dashboard's topologies until each alert resolves, the stale in grey. A new one (started within
   * `NEW_MS`) beats there besides, and a topology set to follow alerts flies to it. Hovering an alert peeks at its node; clicking opens its details and moves there.
   *
   * On a screen nobody touches, two more things: the change log on top (what started and what was
   * resolved lately, a burst as one line), and a warning when the alerts stop updating, so an
   * empty list is never a list that merely failed to load.
   *
   * The list is read as an operator reads it (`alert-groups.ts`): an alert raised again and again
   * is one row with a count, the worst come first, and what has stayed open without being raised
   * again for `staleAfterHours` is set apart, greyed on the topologies rather than red.
   */
  import { severityRank } from '@shumoku/core/plugin-kit'
  import {
    ArrowSquareOutIcon,
    ArrowsClockwiseIcon,
    CaretDownIcon,
    CaretRightIcon,
    CheckCircleIcon,
    FireIcon,
    InfoIcon,
    SpinnerIcon,
    WarningIcon,
  } from 'phosphor-svelte'
  import * as Dialog from '$lib/components/ui/dialog'
  import type { Alert, AlertSeverity } from '$lib/types'
  import {
    type AlertChange,
    type AlertGroup,
    changeLines,
    groupAlerts,
    isNew,
    severityCounts,
  } from '../alert-groups'
  import { useDashboard } from '../dashboard.svelte'
  import {
    configBoolean,
    configNumber,
    configString,
    type WidgetProps,
  } from '../widget-types'
  import WidgetEmpty from './WidgetEmpty.svelte'

  let { id, config, openSettings }: WidgetProps = $props()
  const dashboard = useDashboard()

  const dataSourceId = $derived(configString(config, 'dataSourceId'))
  const maxItems = $derived(configNumber(config, 'maxItems', 10))
  const refreshSeconds = $derived(configNumber(config, 'autoRefresh', 30))
  const showResolved = $derived(configBoolean(config, 'showResolved'))
  const staleAfterHours = $derived(configNumber(config, 'staleAfterHours', 24))

  /** How far back the change log goes. */
  const CHANGES_MS = 30 * 60_000
  /** The change log's lines shown at most. */
  const CHANGE_LINES = 4

  const SEVERITY_COLORS: Record<AlertSeverity, string> = {
    critical: '#dc2626', // red-600
    high: '#ea580c', // orange-600
    medium: '#d97706', // amber-600
    low: '#ca8a04', // yellow-600
    info: '#eab308', // yellow-500
    ok: '#6b7280', // gray-500
  }

  const SEVERITY_BG_COLORS: Record<AlertSeverity, string> = {
    critical: 'bg-red-500/10',
    high: 'bg-orange-500/10',
    medium: 'bg-amber-500/10',
    low: 'bg-yellow-500/10',
    info: 'bg-yellow-400/10',
    ok: 'bg-gray-500/10',
  }

  const STALE_COLOR = '#6b7280' // gray-500
  const RESOLVED_COLOR = '#16a34a' // green-600
  const RESOLVED_BG_COLOR = 'bg-green-500/10'

  let alerts = $state.raw<Alert[]>([])
  let loading = $state(true)
  /** A load in flight that the refresh button shows, also when alerts are already on screen. */
  let refreshing = $state(false)
  let error = $state<string | null>(null)
  /** When the alerts on screen were loaded: what "stale" is measured from. */
  let loadedAt = $state(Date.now())
  let showStale = $state(false)
  let selectedGroup = $state<AlertGroup | null>(null)
  const selectedAlert = $derived(selectedGroup?.latest ?? null)
  let showDetailModal = $state(false)
  /** The time the widget reads by (new, stale, how long ago): moved on every few seconds. */
  let now = $state(Date.now())
  /** When the alerts last loaded without error. */
  let lastLoadedAt = $state<number | null>(null)
  /** Rows that went away between two loads (resolved), for the change log; this page's view only. */
  let resolvedChanges = $state.raw<AlertChange[]>([])
  /** The open rows at the previous load, by key; null before the first load. */
  let previousOpen: Map<string, AlertGroup> | null = null

  function getSeverityIcon(severity: AlertSeverity) {
    switch (severity) {
      case 'critical':
        return FireIcon
      case 'high':
      case 'medium':
        return WarningIcon
      case 'low':
      case 'info':
        return InfoIcon
      case 'ok':
        return CheckCircleIcon
      default:
        return WarningIcon
    }
  }

  function getAlertColor(alert: Alert): string {
    if (alert.status === 'resolved') return RESOLVED_COLOR
    return SEVERITY_COLORS[alert.severity]
  }

  function getAlertBgColor(alert: Alert): string {
    if (alert.status === 'resolved') return RESOLVED_BG_COLOR
    return SEVERITY_BG_COLORS[alert.severity]
  }

  function formatDuration(timestamp: number): string {
    const diff = now - timestamp
    if (diff < 0) return 'just now'

    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)

    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    if (mins > 0) return `${mins}m`
    return '<1m'
  }

  $effect(() => {
    const timer = setInterval(() => {
      now = Date.now()
    }, 5_000)
    return () => clearInterval(timer)
  })

  async function loadAlerts(sourceId: string) {
    error = null
    refreshing = true
    try {
      const fetched = await dashboard.reader.alerts(sourceId, { activeOnly: !showResolved })
      if (sourceId !== dataSourceId) return
      // All kept, not only those listed: every active one is marked.
      alerts = fetched
      loadedAt = Date.now()
      now = loadedAt
      lastLoadedAt = loadedAt
      noteResolved(fetched, loadedAt)
    } catch (err) {
      if (sourceId === dataSourceId) {
        error = err instanceof Error ? err.message : 'Failed to load alerts'
      }
    } finally {
      if (sourceId === dataSourceId) {
        loading = false
        refreshing = false
      }
    }
  }

  // Load now and every `autoRefresh` seconds; from scratch again when the source or the filter
  // (`showResolved`, which `loadAlerts` reads before its first await) changes.
  $effect(() => {
    const sourceId = dataSourceId
    const seconds = refreshSeconds
    if (!sourceId) {
      alerts = []
      loading = false
      return
    }
    previousOpen = null
    resolvedChanges = []
    lastLoadedAt = null
    loading = true
    void loadAlerts(sourceId)
    if (seconds <= 0) return
    const timer = setInterval(() => void loadAlerts(sourceId), seconds * 1000)
    return () => clearInterval(timer)
  })

  const groups = $derived(
    groupAlerts(alerts, { now: loadedAt, staleAfterMs: Math.max(0, staleAfterHours) * 3_600_000 }),
  )
  const counts = $derived(severityCounts(groups.current))

  /** The open rows of a load that were open at the one before and are gone now: resolved. */
  function noteResolved(fetched: Alert[], at: number) {
    const { current, stale } = groupAlerts(fetched, { now: at, staleAfterMs: 0 })
    const open = new Map(
      [...current, ...stale].filter((g) => g.status === 'active').map((g) => [g.key, g]),
    )
    if (previousOpen) {
      const gone: AlertChange[] = []
      for (const [key, group] of previousOpen) {
        if (!open.has(key)) gone.push({ kind: 'resolved', at, group })
      }
      resolvedChanges = [...gone, ...resolvedChanges.filter((c) => at - c.at <= CHANGES_MS)]
    }
    previousOpen = open
  }

  const changes = $derived(
    changeLines(
      [
        ...groups.current
          .filter((g) => g.status === 'active')
          .map((group): AlertChange => ({ kind: 'new', at: group.firstAt, group })),
        ...resolvedChanges,
      ],
      { now, windowMs: CHANGES_MS },
    ).slice(0, CHANGE_LINES),
  )

  /**
   * When the alerts stopped updating, or null while they are current: a failed load, or none
   * that succeeded for three refreshes (at least 90 s).
   */
  const stoppedAt = $derived.by(() => {
    if (lastLoadedAt === null) return null
    if (error) return lastLoadedAt
    if (refreshSeconds <= 0) return null
    return now - lastLoadedAt > Math.max(90_000, refreshSeconds * 3000) ? lastLoadedAt : null
  })
  const displayedGroups = $derived(groups.current.slice(0, maxItems))

  // What this widget asks the topologies to mark, kept up to date; dropped when it goes away. A
  // stale row stays marked, in grey and below any live alert on the same host.
  $effect(() => {
    const open = groups.current.filter((g) => g.status === 'active')
    const marks = open.flatMap((g) =>
      g.host
        ? [
            {
              host: g.host,
              color: SEVERITY_COLORS[g.severity],
              rank: severityRank(g.severity),
              ...(isNew(g, now) ? { newSince: g.firstAt } : {}),
            },
          ]
        : [],
    )
    for (const g of groups.stale) {
      if (g.host) marks.push({ host: g.host, color: STALE_COLOR, rank: 0 })
    }
    dashboard.setMarks(id, marks)
  })
  $effect(() => () => dashboard.clearMarks(id))

  function groupColor(group: AlertGroup): string {
    if (group.status === 'resolved') return RESOLVED_COLOR
    return group.stale ? STALE_COLOR : SEVERITY_COLORS[group.severity]
  }

  function handleAlertHover(group: AlertGroup) {
    if (!group.host) return
    dashboard.setFocus({ source: id, hosts: [group.host], color: groupColor(group) })
    for (const topology of dashboard.topologies()) topology.showHost(group.host, { peek: true })
  }

  function handleAlertLeave() {
    dashboard.clearFocus(id)
    // The dialog's click moved the camera for good; leaving the row then must not undo it.
    if (showDetailModal) return
    for (const topology of dashboard.topologies()) topology.restore()
  }

  /** A change log line: one row's host, or a burst's hosts, brought forward; a single one peeked. */
  function handleChangeHover(groups: AlertGroup[]) {
    const hosts = groups.flatMap((g) => (g.host ? [g.host] : []))
    if (hosts.length === 0) return
    const color = groups[0]?.status === 'active' ? groupColor(groups[0]) : RESOLVED_COLOR
    dashboard.setFocus({ source: id, hosts, color })
    if (hosts.length === 1 && hosts[0]) {
      for (const topology of dashboard.topologies()) topology.showHost(hosts[0], { peek: true })
    }
  }

  /** The device a host is, as the topologies call it; the host name where none draws it. */
  function deviceName(host: string): string {
    return dashboard.hostLabel(host) ?? host
  }

  function formatClock(at: number): string {
    return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function handleAlertClick(group: AlertGroup) {
    selectedGroup = group
    showDetailModal = true
    if (!group.host) return
    for (const topology of dashboard.topologies()) topology.showHost(group.host, { peek: false })
  }
</script>

<div class="h-full flex flex-col">
  {#if !dataSourceId}
    <WidgetEmpty icon={WarningIcon} message="No data source selected" {openSettings} />
  {:else if loading && alerts.length === 0}
    <div class="h-full flex items-center justify-center">
      <SpinnerIcon size={24} class="animate-spin text-theme-text-muted" />
    </div>
  {:else if error && alerts.length === 0}
    <div class="h-full flex flex-col items-center justify-center text-danger gap-2">
      <span class="text-sm">{error}</span>
      <button
        type="button"
        onclick={() => dataSourceId && loadAlerts(dataSourceId)}
        class="text-xs text-primary hover:underline"
      >
        Retry
      </button>
    </div>
  {:else}
    <!-- Open problems by severity, and refresh -->
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="flex flex-wrap items-center gap-1.5 text-xs text-theme-text-muted min-w-0">
        {#each counts as [severity, count] (severity)}
          <span
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium {SEVERITY_BG_COLORS[
              severity
            ]}"
            style="color: {SEVERITY_COLORS[severity]}"
            title="{count} open {severity}"
          >
            {count}
            <span class="font-normal">{severity}</span>
          </span>
        {:else}
          <span>No active alerts</span>
        {/each}
      </div>
      {#if lastLoadedAt !== null}
        <span class="ml-auto shrink-0 text-[10px] tabular-nums text-theme-text-muted" title="Last updated">
          {new Date(lastLoadedAt).toLocaleTimeString()}
        </span>
      {/if}
      <button
        type="button"
        onclick={() => dataSourceId && loadAlerts(dataSourceId)}
        disabled={refreshing}
        class="p-1 rounded hover:bg-theme-bg-canvas text-theme-text-muted hover:text-theme-text transition-colors disabled:opacity-60 shrink-0"
        title="Refresh alerts"
      >
        <ArrowsClockwiseIcon size={14} class={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>

    {#if stoppedAt !== null}
      <div
        class="mb-2 px-2 py-1 rounded text-xs font-medium text-white bg-red-700"
        role="status"
        title={error ?? undefined}
      >
        Not updating · last {new Date(stoppedAt).toLocaleTimeString()}
      </div>
    {/if}

    {#if changes.length > 0}
      <div class="mb-2 border-b border-theme-border pb-1.5 space-y-0.5" aria-label="Recent changes">
        {#each changes as line (`${line.kind}-${line.at}-${line.groups[0]?.key}`)}
          {@const single = line.groups.length === 1 ? line.groups[0] : undefined}
          <button
            type="button"
            class="w-full flex items-center gap-1.5 px-1 py-0.5 rounded text-[11px] text-left hover:bg-theme-bg-canvas"
            onmouseenter={() => handleChangeHover(line.groups)}
            onmouseleave={handleAlertLeave}
            onclick={() => single && handleAlertClick(single)}
          >
            <span class="tabular-nums text-theme-text-muted shrink-0">{formatClock(line.at)}</span>
            {#if line.kind === 'new'}
              <span
                class="shrink-0 font-semibold"
                style="color: {single ? groupColor(single) : SEVERITY_COLORS[line.groups[0]?.severity ?? 'medium']}"
              >
                {single ? 'NEW' : `${line.groups.length} new`}
              </span>
            {:else}
              <span class="shrink-0 font-semibold" style="color: {RESOLVED_COLOR}">
                {single ? 'resolved' : `${line.groups.length} resolved`}
              </span>
            {/if}
            <span class="truncate text-theme-text">
              {#if single}
                {single.host ? `${deviceName(single.host)} · ` : ''}{single.title}
              {:else}
                {line.groups
                  .slice(0, 3)
                  .map((g) => (g.host ? deviceName(g.host) : g.title))
                  .join(', ')}{line.groups.length > 3 ? ', …' : ''}
              {/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="flex-1 overflow-y-auto space-y-1 min-h-0">
      {#if displayedGroups.length === 0}
        <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-2 py-4">
          <CheckCircleIcon size={32} class="text-success" />
          <span class="text-sm">All clear</span>
        </div>
      {:else}
        {#each displayedGroups as group (group.key)}
          {@render row(group)}
        {/each}
        {#if groups.current.length > displayedGroups.length}
          <div class="text-[11px] text-theme-text-muted px-2">
            +{groups.current.length - displayedGroups.length} more
          </div>
        {/if}
      {/if}

      {#if groups.stale.length > 0}
        <button
          type="button"
          class="w-full flex items-center gap-1 px-2 py-1 mt-1 text-[11px] text-theme-text-muted hover:text-theme-text"
          onclick={() => (showStale = !showStale)}
          title="Open, but not raised again for over {staleAfterHours} h"
        >
          {#if showStale}<CaretDownIcon size={12} />{:else}<CaretRightIcon size={12} />{/if}
          Stale ({groups.stale.length}) · open over {staleAfterHours} h
        </button>
        {#if showStale}
          {#each groups.stale as group (group.key)}
            {@render row(group)}
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
</div>

{#snippet row(group: AlertGroup)}
  {@const SeverityIcon = getSeverityIcon(group.severity)}
  <button
    type="button"
    class="w-full text-left p-2 rounded transition-colors cursor-pointer hover:brightness-90 {group.stale
      ? 'opacity-60 bg-gray-500/10'
      : getAlertBgColor(group.latest)}"
    onclick={() => handleAlertClick(group)}
    onmouseenter={() => handleAlertHover(group)}
    onmouseleave={handleAlertLeave}
  >
    <div class="flex items-start gap-2">
      <SeverityIcon size={16} color={groupColor(group)} weight="fill" class="mt-0.5 flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          {#if isNew(group, now)}
            <span
              class="shrink-0 px-1 rounded text-[10px] font-bold text-white"
              style="background: {groupColor(group)}"
            >
              NEW
            </span>
          {/if}
          <span class="text-sm font-medium truncate text-theme-text">{group.title}</span>
          {#if group.alerts.length > 1}
            <span
              class="shrink-0 px-1 rounded text-[10px] font-medium bg-theme-bg-canvas text-theme-text-muted"
              title="Raised {group.alerts.length} times"
            >
              ×{group.alerts.length}
            </span>
          {/if}
        </div>
        <div class="text-xs text-theme-text-muted flex items-center gap-1.5 mt-0.5">
          {#if group.host}
            <span class="truncate min-w-0 font-medium text-theme-text" title={group.host}>
              {deviceName(group.host)}
            </span>
            <span>-</span>
          {/if}
          {#if group.alerts.length > 1}
            <span class="shrink-0">last {formatDuration(group.lastAt)} ago</span>
          {:else}
            <span class="shrink-0">{formatDuration(group.lastAt)}</span>
          {/if}
          {#if group.status === 'resolved'}
            <span class="px-1 py-0.5 text-[10px] bg-success/20 text-success rounded">
              resolved
            </span>
          {/if}
        </div>
      </div>
    </div>
  </button>
{/snippet}

<!-- Alert Detail Modal -->
<Dialog.Root bind:open={showDetailModal}>
  <Dialog.Content class="sm:max-w-lg">
    {#if selectedAlert}
      {@const SeverityIcon = getSeverityIcon(selectedAlert.severity)}
      <Dialog.Header>
        <div class="flex items-start gap-3">
          <div class="p-1.5 rounded {getAlertBgColor(selectedAlert)}">
            <SeverityIcon size={20} color={getAlertColor(selectedAlert)} weight="fill" />
          </div>
          <div class="min-w-0">
            <Dialog.Title class="break-words">{selectedAlert.title}</Dialog.Title>
            <div class="flex items-center gap-2 mt-1">
              <span
                class="text-xs px-1.5 py-0.5 rounded font-medium {getAlertBgColor(selectedAlert)}"
                style="color: {getAlertColor(selectedAlert)}"
              >
                {selectedAlert.severity}
              </span>
              {#if selectedAlert.status === 'active'}
                <span class="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">
                  active
                </span>
              {:else}
                <span class="text-xs px-1.5 py-0.5 rounded bg-success/20 text-success font-medium">
                  resolved
                </span>
              {/if}
              <span class="text-xs text-theme-text-muted">{selectedAlert.source}</span>
            </div>
          </div>
        </div>
      </Dialog.Header>

      <div class="space-y-4 py-2">
        {#if selectedAlert.description}
          <div>
            <div class="text-xs font-medium text-theme-text-muted mb-1">Description</div>
            <p class="text-sm text-theme-text break-words">{selectedAlert.description}</p>
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-3 text-sm">
          {#if selectedAlert.host}
            <div>
              <div class="text-xs font-medium text-theme-text-muted">Device</div>
              <div class="text-theme-text">{deviceName(selectedAlert.host)}</div>
              {#if dashboard.hostLabel(selectedAlert.host)}
                <div class="text-xs text-theme-text-muted font-mono">{selectedAlert.host}</div>
              {/if}
            </div>
          {/if}
          <div>
            <div class="text-xs font-medium text-theme-text-muted">Started</div>
            <div class="text-theme-text">{new Date(selectedAlert.startTime).toLocaleString()}</div>
          </div>
          {#if selectedAlert.endTime}
            <div>
              <div class="text-xs font-medium text-theme-text-muted">Ended</div>
              <div class="text-theme-text">{new Date(selectedAlert.endTime).toLocaleString()}</div>
            </div>
          {/if}
          <div>
            <div class="text-xs font-medium text-theme-text-muted">Duration</div>
            <div class="text-theme-text">{formatDuration(selectedAlert.startTime)}</div>
          </div>
          {#if selectedGroup && selectedGroup.alerts.length > 1}
            <div>
              <div class="text-xs font-medium text-theme-text-muted">Raised</div>
              <div class="text-theme-text">
                {selectedGroup.alerts.length} times, first
                {new Date(selectedGroup.firstAt).toLocaleString()}
              </div>
            </div>
          {/if}
        </div>

        {#if selectedAlert.labels && Object.keys(selectedAlert.labels).length > 0}
          <div>
            <div class="text-xs font-medium text-theme-text-muted mb-1.5">Labels</div>
            <div class="flex flex-wrap gap-1.5">
              {#each Object.entries(selectedAlert.labels) as [key, value] (key)}
                <span
                  class="inline-flex items-center text-xs px-2 py-0.5 rounded bg-theme-bg-canvas border border-theme-border text-theme-text"
                >
                  <span class="text-theme-text-muted">{key}=</span>
                  {value}
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if selectedAlert.url}
        <Dialog.Footer>
          <a
            href={selectedAlert.url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Open in {selectedAlert.source}
            <ArrowSquareOutIcon size={14} />
          </a>
        </Dialog.Footer>
      {/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>

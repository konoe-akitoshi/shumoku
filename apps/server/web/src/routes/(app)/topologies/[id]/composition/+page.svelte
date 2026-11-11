<script lang="ts">
  /**
   * Devices — what happened when Shumoku tried to read each device. The
   * operator registers credentials and presses 読み取る; the server
   * tries the topology's credentials on devices that have none and keeps the one that
   * answered. The list is a result view grouped by outcome, so a person only
   * touches the exceptions.
   *
   * Imperative counterpart to Sources, which is declarative. "Press the
   * button" and "edit the config" are intentionally separate surfaces.
   */
  import { goto } from '$app/navigation'
  import {
    type AccessMethod,
    api,
    type Credential,
    type Device,
    type ReadPlan,
    type TopologyCredential,
  } from '$lib/api'
  import CredentialEditor, { type CredentialOutcome } from '$lib/components/CredentialEditor.svelte'
  import CredentialSection from '$lib/components/CredentialSection.svelte'
  import CredentialSheet from '$lib/components/CredentialSheet.svelte'
  import DeviceList from '$lib/components/DeviceList.svelte'
  import DeviceNotice from '$lib/components/DeviceNotice.svelte'
  import DeviceSheet from '$lib/components/DeviceSheet.svelte'
  import ReadConfirmDialog from '$lib/components/ReadConfirmDialog.svelte'
  import { Button } from '$lib/components/ui/button'
  import {
    changeNotice,
    type DeviceChange,
    effectNotice,
    type UndoCall,
    undoCalls,
  } from '$lib/device-actions'
  import { errorMessage, readSummary } from '$lib/devices'
  import { authAccess } from '$lib/stores/auth'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  let methods = $state<AccessMethod[]>([])
  let credentials = $state<TopologyCredential[]>([])
  /** Admin view of the credentials (with every topology that uses them). */
  let adminCredentials = $state<Credential[]>([])
  let allTopologies = $state<{ id: string; name: string }[]>([])
  const isAdmin = $derived($authAccess.permissions.includes('admin:manage'))
  /** Show only this credential's devices. */
  let credentialFilter = $state<string | null>(null)
  let sheetOpen = $state(false)
  /** The credential the sheet edits; null creates one. */
  let sheetCredentialId = $state<string | null>(null)
  let devices = $state<Device[]>([])
  let recentObservations = $state<
    Array<{
      id: string
      sourceId: string
      capturedAt: number
      status: 'ok' | 'partial' | 'failed' | 'empty'
      statusMessage?: string
      nodeCount: number
      linkCount: number
      portCount: number
    }>
  >([])
  let loading = $state(false)
  let busy = $state(false)
  let error = $state<string | null>(null)
  /** The one result notice: last read, or last edit (with its undo); dismissible. */
  let notice = $state<{ text: string; undo?: () => void } | null>(null)
  /** The ticked devices in the list. */
  let selected = $state<string[]>([])
  /** The devices a pending read (awaiting consent) is for; undefined = all. */
  let readIds = $state<string[] | undefined>(undefined)
  /** Devices to give the credential that is about to be created. */
  let assignAfterCreate = $state<string[] | null>(null)
  /** Result of reading one device from the sheet. */
  let detailNotice = $state<string | null>(null)
  /** The plan awaiting the person's consent before a trial. */
  let confirmPlan = $state<ReadPlan | null>(null)
  /** Offer 読み取る right after a credential was created. */
  let offerRead = $state(false)

  let detailId = $state<string | null>(null)
  let detailError = $state<string | null>(null)

  const sheetCredential = $derived(adminCredentials.find((c) => c.id === sheetCredentialId) ?? null)
  const detail = $derived(devices.find((d) => d.id === detailId) ?? null)
  let topologySources = $derived(ctx.currentSources.filter((s) => s.purpose === 'topology'))

  // Refresh whenever the layout has finished loading (so we have a
  // topology id) and on subsequent topology switches.
  $effect(() => {
    if (ctx.topology && ctx.topologyId) void refresh()
  })

  // `mutated` = this refresh follows a change that can alter the drawing, so the
  // persistent diagram should re-fetch too.
  async function refresh(mutated = false) {
    if (!ctx.topologyId) return
    loading = true
    try {
      const [view, obsList] = await Promise.all([
        api.topologies.devices.list(ctx.topologyId),
        api.topologies.listObservations(ctx.topologyId, 20),
      ])
      methods = view.methods
      credentials = view.credentials
      devices = view.devices
      recentObservations = obsList
      await refreshAdmin()
      if (mutated) ctx.bumpRevision()
    } catch (e) {
      error = errorMessage(e, 'デバイスの読み込みに失敗しました')
    } finally {
      loading = false
    }
  }

  /** What only an admin may read: every credential with its topologies, and all topologies. */
  async function refreshAdmin() {
    if (!isAdmin) return
    try {
      const [admin, tops] = await Promise.all([api.credentials.list(), api.topologies.list()])
      adminCredentials = admin.credentials
      allTopologies = tops.map((t) => ({ id: t.id, name: t.name }))
    } catch {
      // Without this data the admin controls just have nothing to edit.
    }
  }

  /** Run a mutation, surface its error inline, then refresh the list. */
  async function mutate(
    run: () => Promise<unknown>,
    opts: { redraw?: boolean; target?: 'page' | 'detail' } = {},
  ): Promise<boolean> {
    busy = true
    error = null
    detailError = null
    detailNotice = null
    try {
      await run()
    } catch (e) {
      const msg = errorMessage(e)
      if (opts.target === 'detail') detailError = msg
      else error = msg
      busy = false
      return false
    }
    try {
      await refresh(opts.redraw)
    } finally {
      busy = false
    }
    return true
  }

  /**
   * Apply one edit to many devices in a single call, then say what happened.
   * The notice carries an undo that restores each device's previous value.
   */
  async function applyChange(
    ids: string[],
    change: DeviceChange,
    target: 'page' | 'detail' = 'page',
  ): Promise<boolean> {
    if (ids.length === 0) return false
    const before = devices
    notice = null
    return mutate(
      async () => {
        const res = await api.topologies.devices.assign(ctx.topologyId, {
          entityIds: ids,
          ...change,
        })
        const skipped = new Set(res.skipped)
        const calls = undoCalls(
          before,
          ids.filter((id) => !skipped.has(id)),
          change,
        )
        const name = credentials.find((c) => c.id === change.credentialId)?.name ?? ''
        notice = {
          text: changeNotice(change, res.updated, res.skipped.length, name),
          undo: calls.length > 0 ? () => void undo(calls) : undefined,
        }
      },
      { redraw: true, target },
    )
  }

  async function undo(calls: UndoCall[]) {
    notice = null
    await mutate(
      async () => {
        for (const c of calls) {
          await api.topologies.devices.assign(ctx.topologyId, {
            entityIds: c.entityIds,
            ...c.change,
          })
        }
        notice = { text: '元に戻しました' }
      },
      { redraw: true },
    )
  }

  /** Read one device the person picked: they asked for exactly it, so no consent step. */
  function readOne(id: string) {
    return mutate(
      async () => {
        const res = await api.topologies.devices.read(ctx.topologyId, [id])
        detailNotice = readSummary(res)
      },
      { redraw: true, target: 'detail' },
    )
  }

  /**
   * 読み取る for all devices, or for the given ones: preview first, ask only
   * when a trial would send something new.
   */
  async function startRead(ids?: string[]) {
    notice = null
    offerRead = false
    if (credentials.length === 0) {
      notice = { text: '読み取るには、先に認証情報が必要です。' }
      return
    }
    readIds = ids
    busy = true
    error = null
    try {
      const { plan } = await api.topologies.devices.read(ctx.topologyId, ids, {
        dryRun: true,
      })
      if (plan.toTry > 0) {
        confirmPlan = plan
      } else if (plan.toRead > 0) {
        busy = false
        await runRead()
        return
      } else {
        notice = {
          text: '読み取れる機器がありません（未確認の機器がなく、認証情報のある機器もありません）。',
        }
      }
    } catch (e) {
      error = errorMessage(e, '読み取りに失敗しました')
    }
    busy = false
  }

  async function runRead() {
    confirmPlan = null
    const ids = readIds
    const ok = await mutate(
      async () => {
        const res = await api.topologies.devices.read(ctx.topologyId, ids)
        notice = { text: readSummary(res) }
      },
      { redraw: true },
    )
    if (!ok) notice = null
  }

  function openSheet(id: string | null) {
    sheetCredentialId = id
    sheetOpen = true
  }

  function createCredentialFor(ids: string[]) {
    assignAfterCreate = ids
    openSheet(null)
  }

  /** A credential was created / edited / removed: say what happened, then refresh. */
  async function onCredentialDone(outcome: CredentialOutcome) {
    sheetOpen = false
    const ids = assignAfterCreate
    assignAfterCreate = null
    if (outcome.kind === 'created') {
      await refresh(true)
      const here = outcome.credential.topologies.some((t) => t.id === ctx.topologyId)
      if (ids && here) {
        if (await applyChange(ids, { credentialId: outcome.credential.id })) selected = []
        return
      }
      offerRead = here
      notice = outcome.linkedExisting
        ? { text: `登録済みの「${outcome.credential.name}」と同じ内容なので、それを使います。` }
        : null
      return
    }
    if (outcome.kind === 'updated') {
      notice = { text: effectNotice(outcome.result.effect) }
    } else if (outcome.kind === 'unlinked') {
      notice = { text: `「${outcome.name}」をこのトポロジーから外しました` }
    } else {
      notice = { text: `「${outcome.name}」を削除しました` }
    }
    await refresh(true)
  }

  async function setLabel(label: string | null) {
    if (!detail) return
    await mutate(
      () => api.topologies.discoveryPolicy.patch(ctx.topologyId, { id: detail.id, label }),
      { redraw: true, target: 'detail' },
    )
  }

  /** Drop the node's whole override so it returns to the bare source state. */
  async function resetNode() {
    if (!detail) return
    await mutate(
      () =>
        api.topologies.discoveryPolicy.patch(ctx.topologyId, {
          id: detail.id,
          label: null,
          suppressedAttachments: null,
        }),
      { redraw: true, target: 'detail' },
    )
  }

  /** Hide the node from the diagram (identity-keyed). */
  async function hideNode() {
    if (!detail) return
    const { mgmtIp, chassisId, sysName } = detail
    const identity = {
      ...(mgmtIp ? { mgmtIp } : {}),
      ...(chassisId ? { chassisId } : {}),
      ...(sysName ? { sysName } : {}),
    }
    if (Object.keys(identity).length === 0) return
    const ok = await mutate(() => api.topologies.discoveryPolicy.hide(ctx.topologyId, identity), {
      redraw: true,
      target: 'detail',
    })
    if (ok) detailId = null
  }

  function formatAgo(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return new Date(ts).toLocaleString()
  }
</script>

<div class="p-4 space-y-4">
  {#if topologySources.length === 0}
    <div class="card p-8 text-center space-y-2">
      <p class="text-theme-text-emphasis font-medium">デバイスの取得元がありません</p>
      <p class="text-sm text-theme-text-muted">
        デバイスは、NetBox・Network Discovery・Zabbix
        などのトポロジーソースを同期すると現れます。先にソースを追加してください。
      </p>
      <div class="pt-2">
        <Button
          variant="secondary"
          size="sm"
          onclick={() => goto(`/topologies/${ctx.topologyId}/sources`)}
        >
          Sources を開く →
        </Button>
      </div>
    </div>
  {:else}
    <!-- `.card` clips (overflow hidden), which would stop the selection bar from sticking to the
         bottom of the scrolling panel; this card must not clip. -->
    <div class="card" style:overflow="visible">
      <div class="card-header">
        <h2 class="font-medium text-theme-text-emphasis">
          デバイス
          <span class="ml-2 text-xs text-theme-text-muted">({devices.length})</span>
        </h2>
        <p class="text-xs text-theme-text-muted mt-0.5">
          認証情報を登録して「読み取る」を押すと、Shumoku
          が機器ごとに合うものを探します。気になる機器だけ開いて直してください。
        </p>
      </div>
      <div class="card-body space-y-3">
        <CredentialSection
          {credentials}
          {methods}
          admin={isAdmin}
          {loading}
          filter={credentialFilter}
          onFilter={(id) => (credentialFilter = id)}
          onEdit={(id) => openSheet(id)}
          onAdd={() => {
    assignAfterCreate = null
    openSheet(null)
  }}
        >
          {#snippet firstRun()}
            <CredentialEditor
              topologyId={ctx.topologyId}
              {methods}
              credential={null}
              topologies={allTopologies}
              compact
              onDone={onCredentialDone}
            />
          {/snippet}
        </CredentialSection>

        <div class="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy || credentials.length === 0} onclick={() => startRead()}>
            {busy && detailId === null ? '読み取り中…' : '読み取る'}
          </Button>
        </div>

        {#if error}
          <p
            class="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        {/if}
        {#if notice}
          <DeviceNotice
            text={notice.text}
            {busy}
            onUndo={notice.undo}
            onDismiss={() => (notice = null)}
          />
        {/if}
        {#if offerRead && credentials.length > 0}
          <div
            class="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/40 px-3 py-2 text-sm"
          >
            <p class="min-w-0 flex-1">認証情報を保存しました。続けて読み取りますか？</p>
            <Button size="sm" disabled={busy} onclick={() => startRead()}>読み取る</Button>
          </div>
        {/if}

        {#if devices.length === 0}
          <p class="py-8 text-center text-sm text-theme-text-muted">
            {#if loading}
              読み込み中…
            {:else}
              デバイスがまだありません。トポロジーソースを同期すると、見つかったデバイスがここに表示されます。
            {/if}
          </p>
        {:else}
          <DeviceList
            {devices}
            {credentials}
            bind:credentialFilter
            {busy}
            bind:selected
            {formatAgo}
            onOpen={(d) => {
    detailError = null
    detailNotice = null
    detailId = d.id
  }}
            onAssign={(ids, credentialId) => applyChange(ids, { credentialId })}
            onSetEnabled={(ids, enabled) => applyChange(ids, { enabled })}
            onRead={(ids) => startRead(ids)}
            onCreateCredential={isAdmin ? createCredentialFor : undefined}
          />
        {/if}
      </div>
    </div>

    <!-- Observation history -->
    <div class="card">
      <div class="card-header">
        <h2 class="font-medium text-theme-text-emphasis">Recent observations</h2>
        <p class="text-xs text-theme-text-muted mt-0.5">Last 20 snapshots across all sources.</p>
      </div>
      <div class="card-body">
        {#if recentObservations.length === 0}
          <p class="text-xs text-theme-text-muted text-center py-4">
            No observations yet. Sync a source to record one.
          </p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-theme-border text-left text-theme-text-muted">
                  <th class="py-1.5 font-medium">When</th>
                  <th class="py-1.5 font-medium">Source</th>
                  <th class="py-1.5 font-medium">Status</th>
                  <th class="py-1.5 font-medium text-right">Nodes</th>
                  <th class="py-1.5 font-medium text-right">Links</th>
                  <th class="py-1.5 font-medium text-right">Ports</th>
                </tr>
              </thead>
              <tbody>
                {#each recentObservations as o (o.id)}
                  <tr class="border-b border-theme-border last:border-0">
                    <td class="py-1.5">{formatAgo(o.capturedAt)}</td>
                    <td class="py-1.5 font-mono text-theme-text-muted">
                      {ctx.getDataSource(o.sourceId)?.name ?? 'デバイス読み取り'}
                    </td>
                    <td class="py-1.5">
                      {#if o.status === 'ok'}
                        <span class="text-green-600 dark:text-green-400">✓ ok</span>
                      {:else if o.status === 'partial'}
                        <span class="text-amber-600 dark:text-amber-400">⚠ partial</span>
                      {:else if o.status === 'empty'}
                        <span class="text-theme-text-muted">empty</span>
                      {:else}
                        <span class="text-red-500" title={o.statusMessage}>✗ failed</span>
                      {/if}
                    </td>
                    <td class="py-1.5 text-right">{o.nodeCount}</td>
                    <td class="py-1.5 text-right">{o.linkCount}</td>
                    <td class="py-1.5 text-right">{o.portCount}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<DeviceSheet
  open={detailId !== null}
  onOpenChange={(v) => {
    if (!v) detailId = null
  }}
  device={detail}
  {credentials}
  {busy}
  error={detailError}
  notice={detailNotice}
  {formatAgo}
  onAssign={(credentialId) => (detail ? applyChange([detail.id], { credentialId }, 'detail') : undefined)}
  onSetEnabled={(enabled) => (detail ? applyChange([detail.id], { enabled }, 'detail') : undefined)}
  onRead={() => (detail ? readOne(detail.id) : undefined)}
  onSetLabel={setLabel}
  onReset={resetNode}
  onHide={hideNode}
/>

<ReadConfirmDialog plan={confirmPlan} onConfirm={runRead} onCancel={() => (confirmPlan = null)} />

{#if isAdmin}
  <CredentialSheet
    open={sheetOpen}
    onOpenChange={(v) => {
    sheetOpen = v
    if (!v) assignAfterCreate = null
  }}
    topologyId={ctx.topologyId}
    {methods}
    credential={sheetCredential}
    topologies={allTopologies}
    onDone={onCredentialDone}
  />
{/if}

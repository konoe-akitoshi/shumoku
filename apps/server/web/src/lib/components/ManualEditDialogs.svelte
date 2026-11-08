<script lang="ts">
  /**
   * Where a hand edit (rename / hide) is kept: a Manual source of this topology.
   * The server never finds or creates one, so this decides, asking only when it must:
   *   - one Manual source attached → use it;
   *   - none → offer to create one;
   *   - several → ask which (remembered for this page's lifetime).
   * A 409 "not top priority" offers to raise the Manual source and resends.
   *
   * Mount once on a topology page, then `await dialogs.apply(edit)`.
   */
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import type { TopologyDataSource } from '$lib/types'
  import { useTopologyCtx } from '../../routes/(app)/topologies/[id]/_context.svelte'

  type ManualEdit = { nodeId: string; label?: string | null; absent?: boolean }
  type Ask = 'create' | 'pick' | 'priority'

  const ctx = useTopologyCtx()

  let ask = $state<Ask | null>(null)
  let settle: ((value: string | boolean | null) => void) | null = null
  let newName = $state('')
  let picked = $state('')
  let remembered: string | null = null

  let manualSources = $derived(
    ctx.currentSources.filter(
      (s) => s.purpose === 'topology' && ctx.getDataSource(s.dataSourceId)?.type === 'manual',
    ),
  )
  let candidates = $derived([...manualSources].sort((a, b) => b.priority - a.priority))

  function nameOf(s: TopologyDataSource): string {
    return ctx.getDataSource(s.dataSourceId)?.name ?? s.dataSourceId
  }

  function prompt(kind: Ask): Promise<string | boolean | null> {
    return new Promise((resolve) => {
      settle = resolve
      ask = kind
    })
  }

  function answer(value: string | boolean | null) {
    const resolve = settle
    settle = null
    ask = null
    resolve?.(value)
  }

  /** Re-read the attachments so priorities are current, and keep the shell's copy in step. */
  async function freshSources(): Promise<TopologyDataSource[]> {
    const list = await api.topologies.sources.list(ctx.topologyId)
    ctx.currentSources = list
    return list
  }

  async function raiseToTop(dataSourceId: string): Promise<void> {
    const list = await freshSources()
    const own = list.find((s) => s.dataSourceId === dataSourceId && s.purpose === 'topology')
    if (!own) return
    const others = list.filter((s) => s.purpose === 'topology' && s.id !== own.id)
    const top = Math.max(-1, ...others.map((s) => s.priority))
    await api.topologies.sources.update(ctx.topologyId, own.id, { priority: top + 1 })
    await freshSources()
  }

  async function createManual(name: string): Promise<string> {
    const { dataSourceId } = await api.topologies.sources.attachManual(ctx.topologyId)
    const renamed = await api.dataSources.update(dataSourceId, { name })
    ctx.topologyDataSources = [
      ...ctx.topologyDataSources.filter((ds) => ds.id !== dataSourceId),
      renamed,
    ]
    await raiseToTop(dataSourceId)
    return dataSourceId
  }

  async function chooseSource(): Promise<string | null> {
    if (remembered && manualSources.some((s) => s.dataSourceId === remembered)) return remembered
    const [top, second] = candidates
    if (top && !second) return top.dataSourceId
    if (!top) {
      newName = `${ctx.topology?.name ?? 'Topology'} edits`
      const name = await prompt('create')
      if (typeof name !== 'string') return null
      return createManual(name)
    }
    picked = top.dataSourceId
    const chosen = await prompt('pick')
    if (typeof chosen !== 'string') return null
    remembered = chosen
    return chosen
  }

  /**
   * Write one hand edit to a Manual source (asking for it when needed).
   * Resolves true when written, false when the user cancelled; throws with the
   * server's message when the edit cannot be kept.
   */
  export async function apply(edit: ManualEdit): Promise<boolean> {
    const sourceId = await chooseSource()
    if (!sourceId) return false
    for (const attempt of [0, 1]) {
      const outcome = await api.topologies.sources.editNode(ctx.topologyId, sourceId, edit)
      if (outcome.ok) return true
      if (outcome.conflict.reason !== 'not-top-priority' || attempt > 0) {
        throw new Error(outcome.conflict.error)
      }
      if ((await prompt('priority')) !== true) return false
      await raiseToTop(sourceId)
    }
    return false
  }
</script>

<Dialog.Root
  open={ask !== null}
  onOpenChange={(v) => {
    if (!v) answer(null)
  }}
>
  <!-- Opened over the node's detail dialog, so it stacks above it. -->
  <Dialog.Content class="z-[60] sm:max-w-md" overlayClass="z-[60]">
    {#if ask === 'create'}
      <Dialog.Header>
        <Dialog.Title>Keep hand edits in a Manual source</Dialog.Title>
        <Dialog.Description>No Manual source to keep hand edits. Create one?</Dialog.Description>
      </Dialog.Header>
      <Dialog.Body>
        <div class="space-y-2">
          <Label for="manual-edit-name">Name</Label>
          <Input id="manual-edit-name" bind:value={newName} />
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => answer(null)}>Cancel</Button>
        <Button disabled={!newName.trim()} onclick={() => answer(newName.trim())}>Create</Button>
      </Dialog.Footer>
    {:else if ask === 'pick'}
      <Dialog.Header>
        <Dialog.Title>Which Manual source?</Dialog.Title>
        <Dialog.Description>
          This topology has several Manual sources. Pick the one that keeps this edit.
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Body>
        <div class="space-y-2">
          {#each candidates as s, i (s.dataSourceId)}
            <label class="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="manual-edit-source"
                value={s.dataSourceId}
                bind:group={picked}
              >
              <span class="font-medium text-theme-text-emphasis">{nameOf(s)}</span>
              <span class="text-theme-text-muted">priority {s.priority}</span>
              {#if i === 0}
                <span class="text-xs text-theme-text-muted">(top)</span>
              {/if}
            </label>
          {/each}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => answer(null)}>Cancel</Button>
        <Button disabled={!picked} onclick={() => answer(picked)}>Use this source</Button>
      </Dialog.Footer>
    {:else if ask === 'priority'}
      <Dialog.Header>
        <Dialog.Title>This edit would not take effect</Dialog.Title>
        <Dialog.Description>
          Another source outranks this Manual source, so its value would win over your edit. Make
          the Manual source the top priority?
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => answer(false)}>Cancel</Button>
        <Button onclick={() => answer(true)}>Make it top priority</Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<script lang="ts" module>
  import type { Credential, UpdateCredentialResult } from '$lib/api'

  /** What happened in the editor, for the page to report and refresh. */
  export type CredentialOutcome =
    | { kind: 'created'; credential: Credential; linkedExisting: boolean }
    | { kind: 'updated'; result: UpdateCredentialResult }
    | { kind: 'unlinked' | 'deleted'; name: string }
</script>

<script lang="ts">
  import { type AccessMethod, api, type TestCredentialResult } from '$lib/api'
  import CredentialForm from '$lib/components/CredentialForm.svelte'
  import { Button } from '$lib/components/ui/button'
  import {
    impactOf,
    impactText,
    otherTopologies,
    removeMessage,
    unlinkImpactText,
    usageTotal,
    withoutTopology,
  } from '$lib/device-actions'
  import { errorMessage } from '$lib/devices'

  /**
   * Create or edit one server-wide credential: fields, the topologies that use
   * it, a harmless test (最大 10 台に 1 回ずつ), what saving will touch, and
   * removing it. Used inline for the first credential and inside the sheet.
   */
  interface Props {
    topologyId: string
    methods: AccessMethod[]
    /** The credential to edit (admin view); null creates one. */
    credential: Credential | null
    /** Every topology, for 使うトポロジー. */
    topologies: { id: string; name: string }[]
    /** First-run form: just the method's fields, used by this topology only. */
    compact?: boolean
    onDone: (outcome: CredentialOutcome) => void | Promise<void>
    onCancel?: () => void
  }

  let {
    topologyId,
    methods,
    credential,
    topologies,
    compact = false,
    onDone,
    onCancel,
  }: Props = $props()

  // Mounted fresh per credential (callers use {#if}/{#key}); props seed it once.
  // svelte-ignore state_referenced_locally
  let name = $state(credential?.name ?? '')
  // svelte-ignore state_referenced_locally
  let methodId = $state(credential?.method ?? methods[0]?.id ?? '')
  // svelte-ignore state_referenced_locally
  let values = $state<Record<string, string>>({ ...(credential?.params ?? {}) })
  // svelte-ignore state_referenced_locally
  let picked = $state<string[]>(credential ? credential.topologies.map((t) => t.id) : [topologyId])
  // svelte-ignore state_referenced_locally
  const initialPicked = credential ? credential.topologies.map((t) => t.id) : []

  let saving = $state(false)
  let testing = $state(false)
  let testResult = $state<TestCredentialResult | null>(null)
  let error = $state<string | null>(null)
  let confirming = $state<'here' | 'all' | null>(null)

  const method = $derived(methods.find((m) => m.id === methodId))
  const ordered = $derived([
    ...topologies.filter((t) => t.id === topologyId),
    ...topologies.filter((t) => t.id !== topologyId),
  ])

  /** The typed, trimmed, non-empty params. */
  const typed = $derived.by(() => {
    const params: Record<string, string> = {}
    for (const f of method?.fields ?? []) {
      const v = (values[f.key] ?? '').trim()
      if (v) params[f.key] = v
    }
    return params
  })

  const valuesChanged = $derived.by(() => {
    if (!credential || !method) return false
    return method.fields.some((f) => {
      const v = typed[f.key] ?? ''
      return f.secret ? v !== '' : v !== (credential.params[f.key] ?? '')
    })
  })
  const topologiesChanged = $derived(
    credential !== null &&
      (picked.length !== initialPicked.length || picked.some((id) => !initialPicked.includes(id))),
  )

  const impact = $derived.by(() => {
    if (!credential) return null
    if (valuesChanged) return { text: impactText(impactOf(credential.topologies)) }
    if (!topologiesChanged) return null
    const removed = credential.topologies.filter((t) => !picked.includes(t.id))
    return removed.length > 0 ? { text: unlinkImpactText(impactOf(removed).inUse) } : null
  })
  const others = $derived(credential ? otherTopologies(credential.topologies, topologyId) : [])

  const canSave = $derived.by(() => {
    if (!method || picked.length === 0) return false
    return method.fields.every(
      (f) =>
        !f.required ||
        typed[f.key] !== undefined ||
        (credential !== null && f.secret && credential.secretsSet.includes(f.key)),
    )
  })

  // A result describes the values it was sent with; typing makes it stale.
  $effect(() => {
    void JSON.stringify(values)
    void methodId
    testResult = null
  })

  function toggle(id: string, on: boolean) {
    picked = on ? [...picked, id] : picked.filter((x) => x !== id)
  }

  async function test() {
    if (!method) return
    testing = true
    error = null
    testResult = null
    try {
      testResult = await api.credentials.test({
        topologyId,
        method: method.id,
        params: typed,
        ...(credential ? { credentialId: credential.id } : {}),
      })
    } catch (e) {
      error = errorMessage(e, '確認に失敗しました')
    } finally {
      testing = false
    }
  }

  async function save() {
    if (!method || !canSave || saving) return
    saving = true
    error = null
    try {
      if (credential) {
        const result = await api.credentials.update(credential.id, {
          ...(name.trim() !== credential.name ? { name: name.trim() } : {}),
          ...(valuesChanged ? { params: typed } : {}),
          ...(topologiesChanged ? { topologyIds: picked } : {}),
        })
        await onDone({ kind: 'updated', result })
      } else {
        const res = await api.credentials.create({
          ...(name.trim() ? { name: name.trim() } : {}),
          method: method.id,
          params: typed,
          topologyIds: picked,
        })
        await onDone({
          kind: 'created',
          credential: res.credential,
          linkedExisting: res.linkedExisting,
        })
      }
    } catch (e) {
      error = errorMessage(e, '保存に失敗しました')
    } finally {
      saving = false
    }
  }

  async function remove(scope: 'here' | 'all') {
    if (!credential) return
    saving = true
    error = null
    try {
      if (scope === 'here') {
        await api.credentials.update(credential.id, {
          topologyIds: withoutTopology(credential.topologies, topologyId),
        })
        await onDone({ kind: 'unlinked', name: credential.name })
      } else {
        await api.credentials.delete(credential.id)
        await onDone({ kind: 'deleted', name: credential.name })
      }
    } catch (e) {
      error = errorMessage(e, '削除に失敗しました')
    } finally {
      saving = false
    }
  }

  const devicesHere = $derived(
    credential
      ? usageTotal(
          credential.topologies.find((t) => t.id === topologyId)?.usage ?? {
            ok: 0,
            partial: 0,
            failed: 0,
            pending: 0,
          },
        )
      : 0,
  )
  const devicesAll = $derived(
    credential ? credential.topologies.reduce((n, t) => n + usageTotal(t.usage), 0) : 0,
  )
</script>

<form
  class="space-y-4"
  onsubmit={(e) => {
    e.preventDefault()
    void save()
  }}
>
  <CredentialForm
    {methods}
    secretsSet={credential?.secretsSet}
    editing={credential !== null}
    hideName={compact}
    bind:name
    bind:methodId
    bind:values
    disabled={saving}
    onSubmit={() => void save()}
  />

  {#if !compact}
    <fieldset class="space-y-1">
      <legend class="text-sm font-medium">使うトポロジー</legend>
      <ul class="rounded-lg border border-border">
        {#each ordered as t (t.id)}
          <li>
            <label class="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm">
              <input
                type="checkbox"
                class="size-4"
                checked={picked.includes(t.id)}
                disabled={saving}
                onchange={(e) => toggle(t.id, e.currentTarget.checked)}
              >
              <span class="min-w-0 flex-1 truncate">{t.name}</span>
              {#if t.id === topologyId}
                <span class="text-xs text-muted-foreground">このトポロジー</span>
              {/if}
            </label>
          </li>
        {/each}
      </ul>
      <p class="text-xs text-muted-foreground">
        同じネットワークを描いた複数の図は、まとめて選びます。別のネットワークなら、このトポロジーだけにします。
      </p>
    </fieldset>
  {/if}

  <div class="space-y-1">
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={testing || saving || !method}
      onclick={() => void test()}
    >
      {testing ? '確認中…' : '応答を確認（最大 10 台に 1 回ずつ送信）'}
    </Button>
    {#if testResult}
      <div class="space-y-1 text-xs" role="status">
        {#if testResult.sent === 0}
          <p>確認できる機器がありません</p>
        {:else}
          <p>
            {testResult.sent}
            台に送信: 応答 {testResult.answered} 台 / 応答なし {testResult.silent}
            台
          </p>
          <p class="text-muted-foreground">
            応答なしは、値の誤りか機器が応答しないのかを区別できません。全台に試すには保存して「読み取る」を押してください。
          </p>
        {/if}
      </div>
    {/if}
  </div>

  {#if credential}
    {#if impact}
      <p class="rounded border border-border bg-muted/40 px-3 py-2 text-xs">{impact.text}</p>
    {/if}
    {#if others.length > 0}
      <p class="text-xs text-muted-foreground">
        他で使用: {others.map((t) => `${t.name}（${usageTotal(t.usage)} 台）`).join('、')}
      </p>
    {/if}
  {/if}

  {#if error}
    <p class="text-sm text-destructive" role="alert">{error}</p>
  {/if}

  <div class="flex flex-wrap items-center justify-end gap-2">
    {#if onCancel}
      <Button type="button" variant="ghost" size="sm" onclick={onCancel}>やめる</Button>
    {/if}
    <Button type="submit" size="sm" disabled={!canSave || saving}>
      {saving ? '保存中…' : '保存'}
    </Button>
  </div>

  {#if credential}
    <div class="space-y-2 border-t border-border pt-3">
      {#if confirming}
        <p class="text-sm" role="alert">
          {removeMessage(
    confirming === 'all' ? devicesAll : devicesHere,
    confirming === 'here' ? others : [],
    confirming,
  )}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={saving}
            onclick={() => void remove(confirming ?? 'all')}
          >
            {confirming === 'here'
    ? 'このトポロジーから外す'
    : others.length > 0
      ? 'すべてのトポロジーから削除'
      : '削除'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onclick={() => (confirming = null)}>
            やめる
          </Button>
        </div>
      {:else if others.length > 0}
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onclick={() => (confirming = 'here')}
          >
            このトポロジーから外す
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="text-muted-foreground hover:text-destructive"
            disabled={saving}
            onclick={() => (confirming = 'all')}
          >
            すべてのトポロジーから削除
          </Button>
        </div>
      {:else}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="text-muted-foreground hover:text-destructive"
          disabled={saving}
          onclick={() => (confirming = 'all')}
        >
          削除
        </Button>
      {/if}
    </div>
  {/if}
</form>

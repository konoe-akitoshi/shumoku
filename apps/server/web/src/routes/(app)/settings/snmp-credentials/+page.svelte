<script lang="ts">
  /**
   * SNMP Credentials — manage named SNMP community strings that
   * topology nodes can reference via the discovery-policy chain.
   *
   * The community itself is masked everywhere it appears in the UI
   * after creation (same convention as data-source secrets).
   * Editing the community requires re-typing it. Operators with a
   * lot of credentials are expected to track them in their own
   * password manager rather than rely on UI readback.
   */
  import { ArrowLeftIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { type SnmpCredential, snmpCredentials } from '$lib/api'
  import { Button } from '$lib/components/ui/button'

  let credentials = $state<SnmpCredential[]>([])
  let loading = $state(true)
  let error = $state('')

  // Form state — used for both Create and Edit. `editingId` null = new.
  let formOpen = $state(false)
  let editingId = $state<string | null>(null)
  let formName = $state('')
  let formCommunity = $state('')
  let saving = $state(false)

  onMount(() => void refresh())

  async function refresh() {
    loading = true
    try {
      credentials = await snmpCredentials.list()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load'
    } finally {
      loading = false
    }
  }

  function openCreate() {
    editingId = null
    formName = ''
    formCommunity = ''
    formOpen = true
  }

  function openEdit(c: SnmpCredential) {
    editingId = c.id
    formName = c.name
    // Community comes back masked; leave the input blank so the
    // operator types a new value only if they want to change it.
    formCommunity = ''
    formOpen = true
  }

  async function save() {
    saving = true
    error = ''
    try {
      if (editingId) {
        // Edit: omit community when blank so the server keeps the
        // stored secret (the masked GET round-trip already handled).
        const patch: { name: string; community?: string } = { name: formName }
        if (formCommunity) patch.community = formCommunity
        await snmpCredentials.update(editingId, patch)
      } else {
        if (!formCommunity) {
          error = 'Community is required when creating a new credential'
          return
        }
        await snmpCredentials.create({ name: formName, community: formCommunity })
      }
      formOpen = false
      await refresh()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Save failed'
    } finally {
      saving = false
    }
  }

  async function remove(c: SnmpCredential) {
    if (
      !confirm(
        `Delete credential "${c.name}"? Nodes referencing it will fall back to their inherited credential.`,
      )
    )
      return
    try {
      await snmpCredentials.delete(c.id)
      await refresh()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Delete failed'
    }
  }
</script>

<div class="container mx-auto p-6 max-w-3xl space-y-6">
  <div>
    <a
      href="/settings"
      class="inline-flex items-center gap-2 text-sm text-theme-text-muted hover:text-theme-text mb-4"
    >
      <ArrowLeftIcon size={16} />
      Back to Settings
    </a>
    <h1 class="text-xl font-semibold text-theme-text-emphasis">SNMP Credentials</h1>
    <p class="text-sm text-theme-text-muted mt-1">
      Named SNMP community strings. Topology nodes reference one via the discovery-policy chain; the
      SNMP-LLDP plugin uses the resolved credential when scanning that target.
    </p>
  </div>

  {#if error}
    <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
      {error}
    </div>
  {/if}

  <div class="card">
    <div class="card-header flex items-center justify-between">
      <h2 class="font-medium text-theme-text-emphasis">
        Credentials <span class="text-xs text-theme-text-muted ml-2">({credentials.length})</span>
      </h2>
      <Button size="sm" onclick={openCreate}>
        <PlusIcon size={16} class="mr-1" />
        Add
      </Button>
    </div>
    <div class="card-body">
      {#if loading}
        <p class="text-sm text-theme-text-muted text-center py-6">Loading…</p>
      {:else if credentials.length === 0}
        <p class="text-sm text-theme-text-muted text-center py-6">
          No SNMP credentials yet. Add one to override the per-source community on individual nodes.
        </p>
      {:else}
        <div class="space-y-2">
          {#each credentials as c (c.id)}
            <div class="flex items-center justify-between rounded border border-theme-border p-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-theme-text-emphasis">{c.name}</p>
                <p class="text-xs font-mono text-theme-text-muted mt-0.5">
                  community: {c.community}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <Button variant="ghost" size="sm" onclick={() => openEdit(c)}>
                  <PencilSimpleIcon size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-danger hover:bg-danger/10"
                  onclick={() => remove(c)}
                >
                  <TrashIcon size={14} />
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if formOpen}
    <div class="card">
      <div class="card-header">
        <h2 class="font-medium text-theme-text-emphasis">
          {editingId ? 'Edit credential' : 'New credential'}
        </h2>
      </div>
      <div class="card-body space-y-3">
        <div>
          <label for="cred-name" class="text-sm text-theme-text block mb-1">Name</label>
          <input
            id="cred-name"
            type="text"
            class="input w-full"
            placeholder="Core switches"
            bind:value={formName}
          >
        </div>
        <div>
          <label for="cred-community" class="text-sm text-theme-text block mb-1">
            Community
            {#if editingId}
              <span class="text-xs text-theme-text-muted ml-1">
                — leave blank to keep current
              </span>
            {/if}
          </label>
          <input
            id="cred-community"
            type="password"
            class="input w-full font-mono"
            placeholder={editingId ? '(unchanged)' : 'public'}
            bind:value={formCommunity}
          >
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onclick={() => (formOpen = false)}>Cancel</Button>
          <Button size="sm" onclick={save} disabled={saving || !formName}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>

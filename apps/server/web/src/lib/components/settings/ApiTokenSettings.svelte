<script lang="ts">
  /**
   * API tokens: Bearer credentials an administrator issues for automation (Terraform, CI,
   * scripts). The secret is shown once, right after it is issued; the Server keeps only a
   * digest of it.
   */
  import { type ApiToken, type ApiTokenRole, api } from '$lib/api'
  import { copyTextToClipboard } from '$lib/clipboard'

  const ROLES: { value: ApiTokenRole; label: string }[] = [
    { value: 'viewer', label: 'Viewer: read only' },
    { value: 'user', label: 'User: read and edit topologies and dashboards' },
    { value: 'admin', label: 'Admin: everything, data sources and credentials included' },
  ]
  const EXPIRY: { days: number | null; label: string }[] = [
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 365, label: '1 year' },
    { days: null, label: 'Never' },
  ]
  const DAY_MS = 24 * 60 * 60 * 1000

  let tokens = $state<ApiToken[]>([])
  let loading = $state(true)
  let error = $state('')
  let name = $state('')
  let role = $state<ApiTokenRole>('admin')
  let expiryDays = $state('90')
  let creating = $state(false)
  let issued = $state<{ name: string; token: string } | null>(null)
  let copied = $state(false)

  $effect(() => {
    void load()
  })

  async function load() {
    try {
      tokens = await api.apiTokens.list()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load API tokens'
    } finally {
      loading = false
    }
  }

  async function create() {
    creating = true
    error = ''
    copied = false
    try {
      const days = expiryDays === '' ? null : Number(expiryDays)
      const result = await api.apiTokens.create({
        name: name.trim(),
        role,
        expiresAt: days === null ? null : Date.now() + days * DAY_MS,
      })
      issued = { name: result.apiToken.name, token: result.token }
      tokens = [result.apiToken, ...tokens]
      name = ''
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to issue the token'
    } finally {
      creating = false
    }
  }

  async function revoke(token: ApiToken) {
    error = ''
    try {
      await api.apiTokens.revoke(token.id)
      tokens = tokens.filter((t) => t.id !== token.id)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to revoke the token'
    }
  }

  async function copy() {
    if (!issued) return
    try {
      await copyTextToClipboard(issued.token)
      copied = true
    } catch {
      error = 'Copy failed; select the token and copy it by hand.'
    }
  }

  function date(ms: number | null): string {
    return ms === null ? '—' : new Date(ms).toLocaleDateString()
  }
</script>

<div class="card lg:col-span-2">
  <div class="card-header">
    <h2 class="font-medium text-theme-text-emphasis">API Tokens</h2>
  </div>
  <div class="card-body space-y-4">
    <p class="text-sm text-theme-text-muted">
      For automation such as Terraform, CI and scripts. Send it as
      <code>Authorization: Bearer &lt;token&gt;</code>. Use HTTPS: a token is as good as a
      password.
    </p>

    <form
      class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end"
      onsubmit={(e) => { e.preventDefault(); void create() }}
    >
      <div>
        <label for="api-token-name" class="label">Name</label>
        <input
          id="api-token-name"
          class="input"
          placeholder="terraform"
          maxlength="100"
          bind:value={name}
          disabled={creating}
        >
      </div>
      <div>
        <label for="api-token-role" class="label">Role</label>
        <select id="api-token-role" class="input" bind:value={role} disabled={creating}>
          {#each ROLES as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="api-token-expiry" class="label">Expires</label>
        <select id="api-token-expiry" class="input" bind:value={expiryDays} disabled={creating}>
          {#each EXPIRY as option (option.label)}
            <option value={option.days === null ? '' : String(option.days)}>{option.label}</option>
          {/each}
        </select>
      </div>
      <button type="submit" class="btn btn-primary" disabled={creating || name.trim() === ''}>
        {creating ? 'Issuing…' : 'Issue token'}
      </button>
    </form>

    {#if issued}
      <div class="rounded-lg border border-theme-border p-3 space-y-2">
        <p class="text-sm text-theme-text-emphasis">
          Token “{issued.name}” issued. Copy it now: it is not shown again.
        </p>
        <div class="flex items-center gap-2">
          <input class="input font-mono text-xs" readonly value={issued.token}>
          <button type="button" class="btn btn-primary" onclick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" class="btn" onclick={() => (issued = null)}>Done</button>
        </div>
      </div>
    {/if}

    {#if error}
      <div class="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
    {/if}

    {#if loading}
      <p class="text-sm text-theme-text-muted">Loading…</p>
    {:else if tokens.length === 0}
      <p class="text-sm text-theme-text-muted">No API tokens yet.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-theme-text-muted">
            <tr>
              <th class="py-1 pr-3 font-normal">Name</th>
              <th class="py-1 pr-3 font-normal">Token</th>
              <th class="py-1 pr-3 font-normal">Role</th>
              <th class="py-1 pr-3 font-normal">Created</th>
              <th class="py-1 pr-3 font-normal">Last used</th>
              <th class="py-1 pr-3 font-normal">Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each tokens as token (token.id)}
              <tr class="border-t border-theme-border">
                <td class="py-2 pr-3 text-theme-text-emphasis">{token.name}</td>
                <td class="py-2 pr-3 font-mono text-xs">{token.prefix}…</td>
                <td class="py-2 pr-3">{token.role}</td>
                <td class="py-2 pr-3">{date(token.createdAt)}</td>
                <td class="py-2 pr-3">{date(token.lastUsedAt)}</td>
                <td class="py-2 pr-3">
                  {#if token.expiresAt !== null && token.expiresAt <= Date.now()}
                    <span class="text-danger">Expired</span>
                  {:else}
                    {date(token.expiresAt)}
                  {/if}
                </td>
                <td class="py-2 text-right">
                  <button
                    type="button"
                    class="text-xs text-danger hover:underline"
                    onclick={() => revoke(token)}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

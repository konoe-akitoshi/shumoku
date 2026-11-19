<script lang="ts">
  /**
   * The Server's polling defaults: how often it collects alerts, reads metrics and syncs a
   * topology's structure. Stored on the Server (`settings`) and used by it; a data source can
   * override the first two on its own page.
   */
  import { api } from '$lib/api'
  import {
    ALERTS_CHOICES,
    intervalLabel,
    METRICS_CHOICES,
    POLLING_BUILT_IN,
    POLLING_KEYS,
    type PollingChoice,
    SYNC_CHOICES,
  } from '$lib/polling'
  import { readOnlyAccess } from '$lib/stores/auth'

  type Key = keyof typeof POLLING_KEYS

  const ROWS: { key: Key; label: string; help: string; choices: PollingChoice[] }[] = [
    {
      key: 'alertsMs',
      label: 'Alerts',
      help: 'How often each monitoring system is asked for its open alerts.',
      choices: ALERTS_CHOICES,
    },
    {
      key: 'metricsMs',
      label: 'Metrics',
      help: 'Traffic and device status while someone watches a topology. Zabbix items mostly update once a minute.',
      choices: METRICS_CHOICES,
    },
    {
      key: 'syncMs',
      label: 'Topology sync',
      help: 'How often a topology’s structure is read again from its sources (NetBox, LLDP, …).',
      choices: SYNC_CHOICES,
    },
  ]

  /** The saved value per row as a menu value: '' is the built-in default. */
  let values = $state<Record<Key, string>>({ alertsMs: '', metricsMs: '', syncMs: '' })
  let saved = $state<Record<Key, string>>({ alertsMs: '', metricsMs: '', syncMs: '' })
  let loading = $state(true)
  let saving = $state(false)
  let message = $state('')
  let error = $state('')

  const dirty = $derived(ROWS.some((row) => values[row.key] !== saved[row.key]))

  $effect(() => {
    void load()
  })

  async function load() {
    try {
      const all = await api.settings.get()
      const next = { alertsMs: '', metricsMs: '', syncMs: '' }
      for (const row of ROWS) next[row.key] = all[POLLING_KEYS[row.key]] ?? ''
      values = { ...next }
      saved = { ...next }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load the polling settings'
    } finally {
      loading = false
    }
  }

  async function save() {
    saving = true
    message = ''
    error = ''
    try {
      const set: Record<string, string> = {}
      for (const row of ROWS) {
        if (values[row.key] !== '') set[POLLING_KEYS[row.key]] = values[row.key]
      }
      if (Object.keys(set).length > 0) await api.settings.update(set)
      // Back to the default: the stored value goes.
      for (const row of ROWS) {
        if (values[row.key] === '' && saved[row.key] !== '') {
          await api.settings.delete(POLLING_KEYS[row.key])
        }
      }
      saved = { ...values }
      message = 'Saved. The Server uses the new intervals from its next poll.'
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      saving = false
    }
  }
</script>

<div class="card">
  <div class="card-header">
    <h2 class="font-medium text-theme-text-emphasis">Polling</h2>
  </div>
  <div class="card-body space-y-4">
    {#if loading}
      <p class="text-sm text-theme-text-muted">Loading…</p>
    {:else}
      {#each ROWS as row (row.key)}
        <div>
          <label for="polling-{row.key}" class="label">{row.label}</label>
          <select
            id="polling-{row.key}"
            class="input"
            bind:value={values[row.key]}
            disabled={$readOnlyAccess || saving}
          >
            <option value="">
              Default ({intervalLabel(POLLING_BUILT_IN[row.key], row.choices)})
            </option>
            {#each row.choices as choice (choice.value)}
              <option value={String(choice.value)}>{choice.label}</option>
            {/each}
          </select>
          <p class="text-xs text-theme-text-muted mt-1">{row.help}</p>
        </div>
      {/each}

      {#if !$readOnlyAccess}
        <div class="flex items-center gap-3">
          <button type="button" class="btn btn-primary" onclick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {#if message}<span class="text-xs text-success">{message}</span>{/if}
          {#if error}<span class="text-xs text-danger">{error}</span>{/if}
        </div>
      {/if}

      <p class="text-xs text-theme-text-muted pt-2 border-t border-theme-border">
        Kept on the Server for everyone. A data source can set its own alerts and metrics
        intervals on its page (a cloud API with a tight rate limit, say).
      </p>
    {/if}
  </div>
</div>

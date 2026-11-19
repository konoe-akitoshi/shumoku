<script lang="ts">
  /**
   * A data source's own polling intervals, over the Server's defaults on the Settings page:
   * for the exceptions (a cloud API with a tight rate limit, alerts not wanted from this one).
   * Only what the source can do is shown: alerts if it reports alerts, metrics if it has them.
   */
  import { api } from '$lib/api'
  import { ALERTS_CHOICES, METRICS_CHOICES } from '$lib/polling'
  import { readOnlyAccess } from '$lib/stores/auth'
  import type { DataSource } from '$lib/types'

  interface Props {
    dataSource: DataSource
    capabilities: readonly string[]
    onsaved?: (dataSource: DataSource) => void
  }

  let { dataSource, capabilities, onsaved }: Props = $props()

  const showAlerts = $derived(capabilities.includes('alerts'))
  const showMetrics = $derived(capabilities.includes('metrics'))

  /** '' is "the Server's default". */
  let alertsMs = $state('')
  let metricsMs = $state('')
  let saving = $state(false)
  let message = $state('')
  let error = $state('')

  const savedAlerts = $derived(
    dataSource.polling?.alertsMs !== undefined ? String(dataSource.polling.alertsMs) : '',
  )
  const savedMetrics = $derived(
    dataSource.polling?.metricsMs !== undefined ? String(dataSource.polling.metricsMs) : '',
  )
  const dirty = $derived(alertsMs !== savedAlerts || metricsMs !== savedMetrics)

  $effect(() => {
    alertsMs = savedAlerts
    metricsMs = savedMetrics
  })

  async function save() {
    saving = true
    message = ''
    error = ''
    try {
      const polling: { alertsMs?: number; metricsMs?: number } = {}
      if (alertsMs !== '') polling.alertsMs = Number(alertsMs)
      if (metricsMs !== '') polling.metricsMs = Number(metricsMs)
      const updated = await api.dataSources.update(dataSource.id, {
        // An empty one clears the override.
        polling,
      })
      onsaved?.(updated)
      message = 'Saved.'
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      saving = false
    }
  }
</script>

{#if showAlerts || showMetrics}
  <div class="card mt-4">
    <div class="card-header">
      <h2 class="font-medium text-theme-text-emphasis">Polling</h2>
    </div>
    <div class="card-body space-y-4">
      {#if showAlerts}
        <div>
          <label for="ds-polling-alerts" class="label">Alerts</label>
          <select
            id="ds-polling-alerts"
            class="input"
            bind:value={alertsMs}
            disabled={$readOnlyAccess || saving}
          >
            <option value="">Server default (Settings)</option>
            {#each ALERTS_CHOICES as choice (choice.value)}
              <option value={String(choice.value)}>{choice.label}</option>
            {/each}
            <option value="0">Off: don't collect this source's alerts</option>
          </select>
        </div>
      {/if}
      {#if showMetrics}
        <div>
          <label for="ds-polling-metrics" class="label">Metrics</label>
          <select
            id="ds-polling-metrics"
            class="input"
            bind:value={metricsMs}
            disabled={$readOnlyAccess || saving}
          >
            <option value="">Server default (Settings)</option>
            {#each METRICS_CHOICES as choice (choice.value)}
              <option value={String(choice.value)}>{choice.label}</option>
            {/each}
          </select>
        </div>
      {/if}
      {#if !$readOnlyAccess}
        <div class="flex items-center gap-3">
          <button type="button" class="btn btn-primary" onclick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {#if message}<span class="text-xs text-success">{message}</span>{/if}
          {#if error}<span class="text-xs text-danger">{error}</span>{/if}
        </div>
      {/if}
      <p class="text-xs text-theme-text-muted">
        Only for this data source. The defaults for all are on the Settings page.
      </p>
    </div>
  </div>
{/if}

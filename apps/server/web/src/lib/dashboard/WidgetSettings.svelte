<script lang="ts">
  /**
   * One widget's settings: its `configSchema` in the generic `SchemaForm`, on a copy that is
   * applied only with Apply. Only while the dashboard is edited (a workspace dashboard), so the
   * choices come straight from the workspace.
   */

  import { api } from '$lib/api'
  import SchemaForm from '$lib/components/SchemaForm.svelte'
  import * as Dialog from '$lib/components/ui/dialog'
  import type { WidgetInstance } from './layout'
  import { type WidgetDefinition, withDefaults } from './widget-types'

  interface Props {
    open: boolean
    widget: WidgetInstance
    definition: WidgetDefinition
    onapply: (config: Record<string, unknown>) => void
  }

  let { open = $bindable(), widget, definition, onapply }: Props = $props()

  let draft = $state<Record<string, unknown>>({})

  // A fresh copy each time it opens: Cancel leaves the widget as it was.
  $effect(() => {
    if (open) draft = withDefaults(definition, $state.snapshot(widget.config))
  })

  const missing = $derived(
    (definition.configSchema.required ?? []).filter(
      (key) => draft[key] === undefined || draft[key] === '',
    ),
  )

  async function getOptions(key: string): Promise<{ value: string; label: string }[]> {
    switch (key) {
      case 'topologies':
        return (await api.topologies.list()).map((t) => ({ value: t.id, label: t.name }))
      case 'alert-sources':
        return (await api.dataSources.listByCapability('alerts')).map((ds) => ({
          value: ds.id,
          label: `${ds.name} (${ds.type})`,
        }))
      default:
        return []
    }
  }

  function apply() {
    const config: Record<string, unknown> = {}
    for (const [key, value] of Object.entries($state.snapshot(draft))) {
      if (value !== undefined && value !== '') config[key] = value
    }
    onapply(config)
    open = false
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{definition.displayName} settings</Dialog.Title>
      <Dialog.Description>{definition.description}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Body>
      {#if open}
        <SchemaForm schema={definition.configSchema} bind:value={draft} {getOptions} />
      {/if}
    </Dialog.Body>
    <Dialog.Footer>
      <button type="button" class="btn btn-secondary" onclick={() => (open = false)}>Cancel</button>
      <button type="button" class="btn btn-primary" disabled={missing.length > 0} onclick={apply}>
        Apply
      </button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

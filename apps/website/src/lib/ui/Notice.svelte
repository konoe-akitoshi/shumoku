<script lang="ts">
  import { CircleAlert, CircleCheck, Info } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import './ui.css'
  import './notice.css'
  interface Props {
    title: string
    tone?: 'info' | 'success' | 'danger'
    live?: boolean
    children?: Snippet
  }
  let { title, tone = 'info', live = false, children }: Props = $props()
  const Icon = $derived(tone === 'danger' ? CircleAlert : tone === 'success' ? CircleCheck : Info)
  const role = $derived(live ? (tone === 'danger' ? 'alert' : 'status') : undefined)
</script>

<div class="ui-notice" data-tone={tone} {role}>
  <span class="ui-notice-icon" aria-hidden="true"><Icon size={20} /></span>
  <div class="ui-notice-content">
    <strong class="ui-notice-title">{title}</strong>
    {#if children}
      <div class="ui-notice-description">{@render children()}</div>
    {/if}
  </div>
</div>

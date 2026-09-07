<script lang="ts">
  let { locale }: { locale: 'en' | 'ja' } = $props()
  let busy = $state(false)
  let failed = $state(false)
  async function open() {
    busy = true
    failed = false
    try {
      const client = await import('./client')
      await client.openAnalyticsPreferences()
    } catch {
      failed = true
    } finally {
      busy = false
    }
  }
</script>
<button type="button" onclick={open} disabled={busy}>
  {locale === 'ja' ? 'アクセス解析の設定' : 'Analytics preferences'}
</button>
{#if failed}
  <span role="status"
    >{locale === 'ja' ? '読み込めませんでした。もう一度お試しください。' : 'Unable to load. Please try again.'}</span
  >
{/if}
<style>
  button {
    font: inherit;
    color: var(--site-muted);
    cursor: pointer;
    text-align: left;
    padding-block: 0.5rem;
    text-underline-offset: 4px;
  }
  button:hover {
    text-decoration: underline;
  }
  button:disabled {
    cursor: wait;
  }
  span {
    display: block;
    font-size: 0.875rem;
  }
</style>

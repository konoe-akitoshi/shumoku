<script lang="ts">
  import { docsUrl } from './styles'

  let { href, label, locale }: { href: string; label: string; locale: string } = $props()
  const normalizedHref = $derived(
    href.startsWith('/docs/')
      ? docsUrl(locale, href.slice('/docs/'.length))
      : href.startsWith('/')
        ? `/${locale}${href}`
        : href,
  )
  const isExternal = $derived(normalizedHref.startsWith('http'))
  const className = $derived(
    'text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline mt-3 inline-flex items-center gap-1',
  )
</script>
{#if isExternal}
  <a href={normalizedHref} target="_blank" rel="noopener noreferrer" class={className}>
    {label}
    →
  </a>
{:else}
  <a href={normalizedHref} class={className}> {label} → </a>
{/if}

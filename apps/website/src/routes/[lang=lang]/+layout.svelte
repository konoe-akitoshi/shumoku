<script lang="ts">
  import '../website.css'
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import Header from '$lib/home/Header.svelte'
  import type { LayoutData } from './$types'

  let { data, children }: { data: LayoutData; children: Snippet } = $props()
  $effect(() => {
    document.documentElement.lang = data.lang
  })
</script>

<Header locale={data.lang} path={page.url.pathname.endsWith('/playground') ? '/playground' : ''} />
{@render children()}

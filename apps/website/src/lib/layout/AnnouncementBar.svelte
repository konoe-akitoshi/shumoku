<script lang="ts">
  import { onMount } from 'svelte'
  import { announcement, isAnnouncementActive } from '$lib/announcement'
  import type { Locale } from '$lib/site'

  let { locale }: { locale: Locale } = $props()
  const copy = $derived(announcement[locale])
  // A prerendered timestamp would leave expired notices visible until the next deploy.
  let active = $state(false)
  onMount(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      active = isAnnouncementActive(Date.now())
      if (active)
        timer = setTimeout(
          update,
          Math.min(60_000, Date.parse(announcement.expiresAt) - Date.now()),
        )
    }
    update()
    return () => clearTimeout(timer)
  })
</script>

{#if active}
  <aside
    class="announcement"
    aria-label={locale === 'ja' ? 'イベントのお知らせ' : 'Upcoming event'}
  >
    <a class="site-container announcement-link" href={announcement.href}>
      <span class="event"
        >{copy.title}<span class="separator" aria-hidden="true"> · </span
        ><span>{copy.date}</span></span
      >
      <span class="venue">{copy.venue}</span>
      <span class="action">{copy.action} <span aria-hidden="true">→</span></span>
    </a>
  </aside>
{/if}

<style>
  .announcement {
    background: var(--ui-surface);
    font-size: 0.875rem;
  }
  .announcement-link {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    min-height: 44px;
    padding-block: 0.5rem;
    text-decoration: none;
  }
  .event {
    font-weight: 500;
  }
  .separator {
    margin-inline: 0.25em;
  }
  .venue {
    color: var(--site-muted);
  }
  .action {
    white-space: nowrap;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .announcement-link:hover .action {
    text-decoration-thickness: 2px;
  }
  .announcement-link:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: -3px;
  }
  @media (max-width: 600px) {
    .venue {
      display: none;
    }
  }
</style>

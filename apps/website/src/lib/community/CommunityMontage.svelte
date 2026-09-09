<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Locale } from '$lib/site'
  import { communityPhotos, photos, photoUrl, photoWidths } from './photos'

  let {
    locale,
    introduction,
    events,
    discussion,
  }: { locale: Locale; introduction: Snippet; events: Snippet; discussion: Snippet } = $props()
  const tiles = communityPhotos
</script>

<div class="community-sequence">
  <div class="montage">
    {#each tiles as id, index}
      {#if id === 'speaker'}
        <div class="interlude introduction">{@render introduction()}</div>
      {/if}
      {#if id === 'conversations'}
        <div class="interlude events">{@render events()}</div>
      {/if}
      {#if id === 'sign'}
        <div class="interlude discussion">{@render discussion()}</div>
      {/if}
      <img
        class:group={id === 'group'}
        class:welcome={id === 'welcome'}
        style:grid-area={id}
        style:object-position={id === 'farewell' ? 'center 80%' : id === 'sign' ? 'center 65%' : id === 'selfie' ? 'center 60%' : undefined}
        src={photoUrl(id, 1280)}
        srcset={photoWidths.map(width => `${photoUrl(id, width)} ${width}w`).join(', ')}
        sizes={id === 'group' ? '(max-width: 1168px) 66vw, 744px' : id === 'welcome' ? '(max-width: 1168px) 33vw, 368px' : id === 'farewell' ? '(max-width: 650px) calc(100vw - 2rem), (max-width: 1168px) 33vw, 368px' : '(max-width: 650px) 50vw, (max-width: 1168px) 33vw, 368px'}
        alt={photos[id][locale]}
        loading="eager"
        fetchpriority={index === 0 ? 'high' : 'auto'}
        decoding="async"
      >
    {/each}
  </div>
</div>

<style>
  .montage {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-areas:
      "group group welcome"
      "introduction introduction introduction"
      "speaker selfie coffee"
      "events events events"
      "conversations diagrams toast"
      "discussion discussion discussion"
      "sign streaming farewell";
    gap: var(--ui-space-2);
    border-radius: var(--ui-panel-radius);
  }
  img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 0;
    min-width: 0;
    object-fit: cover;
    object-position: center 35%;
    border-radius: inherit;
  }
  .group {
    object-position: center bottom;
  }
  .welcome {
    height: 100%;
    aspect-ratio: auto;
    contain: size;
  }
  .interlude {
    min-width: 0;
    padding-block: var(--ui-space-8);
  }
  .introduction {
    grid-area: introduction;
    padding-block-start: var(--ui-space-4);
  }
  .events {
    grid-area: events;
  }
  .discussion {
    grid-area: discussion;
  }
  @media (max-width: 650px) {
    .montage {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-template-areas:
        "group group group group welcome welcome"
        "introduction introduction introduction introduction introduction introduction"
        "speaker speaker speaker selfie selfie selfie"
        "coffee coffee coffee conversations conversations conversations"
        "events events events events events events"
        "diagrams diagrams diagrams toast toast toast"
        "sign sign sign streaming streaming streaming"
        "discussion discussion discussion discussion discussion discussion"
        "farewell farewell farewell farewell farewell farewell";
      gap: var(--ui-space-1);
    }
    img {
      aspect-ratio: 4 / 3;
    }
    .group {
      aspect-ratio: 16 / 9;
    }
  }
</style>

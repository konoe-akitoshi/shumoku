<script lang="ts">
  import type { Locale } from '$lib/site'
  import { communityEvent, communityPhotos, photos, photoUrl, photoWidths } from './photos'

  let { locale }: { locale: Locale } = $props()
  const tiles = communityPhotos
</script>

<figure>
  <div class="montage">
    {#each tiles as id, index}
      <img
        class:group={id === 'group'}
        class:welcome={id === 'welcome'}
        style:grid-area={id}
        style:object-position={id === 'farewell' ? 'center 80%' : id === 'sign' ? 'center 65%' : id === 'selfie' ? 'center 60%' : undefined}
        src={photoUrl(id, 1280)}
        srcset={photoWidths.map(width => `${photoUrl(id, width)} ${width}w`).join(', ')}
        sizes={index === 0 ? '(max-width: 650px) calc(100vw - 2rem), (max-width: 1168px) 66vw, 744px' : id === 'selfie' ? '(max-width: 650px) calc(100vw - 2rem), (max-width: 1168px) 33vw, 368px' : '(max-width: 650px) 50vw, (max-width: 1168px) 33vw, 368px'}
        alt={photos[id][locale]}
        loading="eager"
        fetchpriority={index === 0 ? 'high' : 'auto'}
        decoding="async"
      >
    {/each}
  </div>
  <figcaption>
    {communityEvent.label}
    · <time datetime={communityEvent.date}>{communityEvent.date.replaceAll('-', '.')}</time>
  </figcaption>
</figure>

<style>
  figure {
    margin: 0;
  }
  .montage {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(5, minmax(0, 1fr));
    grid-template-areas:
      "group group welcome"
      "group group welcome"
      "speaker selfie coffee"
      "conversations diagrams toast"
      "sign streaming farewell";
    gap: var(--ui-space-2);
    aspect-ratio: 16 / 15;
    border-radius: var(--ui-panel-radius);
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    object-fit: cover;
    object-position: center 35%;
    border-radius: inherit;
  }
  .group {
    object-position: center bottom;
  }
  figcaption {
    margin-block-start: var(--ui-space-2);
    color: var(--site-muted);
    font-size: 0.875rem;
    line-height: var(--ui-leading);
  }
  @media (max-width: 650px) {
    .montage {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: auto;
      grid-template-areas:
        "group group"
        "welcome speaker"
        "welcome coffee"
        "selfie selfie"
        "conversations diagrams"
        "toast sign"
        "streaming farewell";
      aspect-ratio: auto;
      gap: var(--ui-space-1);
    }
    img {
      aspect-ratio: 4 / 3;
    }
    .group {
      aspect-ratio: 2 / 1;
    }
    .welcome {
      aspect-ratio: auto;
    }
  }
</style>

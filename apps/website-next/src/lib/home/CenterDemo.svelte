<script lang="ts">
  let { description }: { description: string } = $props()
</script>
<div
  class="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60"
>
  <div class="px-2.5 pt-2.5">
    <div class="rounded-lg overflow-hidden border border-neutral-100 dark:border-neutral-700/30">
      <video
        autoplay
        muted
        loop
        playsinline
        src="/screenshots/demo.mp4"
        class="w-full h-auto"
      ></video>
    </div>
  </div>
  <div class="flex items-center gap-2 px-4 py-3">
    <img src="/logo-symbol.svg" alt="Shumoku" class="w-7 h-7 shrink-0">
    <div>
      <span class="text-sm font-semibold">Shumoku</span>
      <p class="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">{description}</p>
    </div>
  </div>
</div>

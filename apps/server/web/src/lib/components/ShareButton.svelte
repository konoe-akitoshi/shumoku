<script lang="ts">
  import { CheckIcon, LinkSimpleIcon, ShareNetworkIcon, XIcon } from 'phosphor-svelte'

  export let shareToken: string | undefined = undefined
  export let shareType: 'topologies' | 'dashboards' = 'topologies'
  export let onShare: () => Promise<void> = async () => {}
  export let onUnshare: () => Promise<void> = async () => {}

  let showPopover = false
  let copied = false
  let loading = false

  function getShareUrl(): string {
    const base = window.location.origin
    return `${base}/share/${shareType}/${shareToken}`
  }

  async function handleShare() {
    loading = true
    try {
      await onShare()
    } finally {
      loading = false
    }
  }

  async function handleUnshare() {
    loading = true
    try {
      await onUnshare()
    } finally {
      loading = false
    }
  }

  async function copyLink() {
    if (!shareToken) return
    try {
      await navigator.clipboard.writeText(getShareUrl())
      copied = true
      setTimeout(() => (copied = false), 2000)
    } catch {
      // Fallback
    }
  }

  function togglePopover() {
    showPopover = !showPopover
    copied = false
  }
</script>

<div class="relative">
  <button
    onclick={togglePopover}
    class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors {shareToken
      ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
      : 'bg-theme-bg-canvas border-theme-border text-theme-text-muted hover:border-primary/50 hover:text-theme-text'}"
    title="Share"
  >
    <ShareNetworkIcon size={16} />
    <span>Share</span>
  </button>

  {#if showPopover}
    <!-- Backdrop -->
    <button
      class="fixed inset-0 z-20"
      onclick={() => (showPopover = false)}
      aria-label="Close"
    ></button>

    <!-- Popover -->
    <div
      class="absolute right-0 top-full mt-2 w-80 bg-theme-bg-elevated border border-theme-border rounded-xl shadow-xl z-30 p-4"
    >
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-theme-text-emphasis">Share Link</h3>
        <button
          onclick={() => (showPopover = false)}
          class="w-6 h-6 flex items-center justify-center rounded hover:bg-theme-bg text-theme-text-muted hover:text-theme-text"
        >
          <XIcon size={14} />
        </button>
      </div>

      {#if shareToken}
        <!-- Shared: show link + copy + disable -->
        <div class="flex items-center gap-2 mb-3">
          <input
            type="text"
            readonly
            value={getShareUrl()}
            class="flex-1 text-xs bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-theme-text font-mono truncate"
          >
          <button
            onclick={copyLink}
            class="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-theme-border hover:bg-theme-bg transition-colors {copied
              ? 'text-success'
              : 'text-theme-text-muted hover:text-theme-text'}"
            title="Copy link"
          >
            {#if copied}
              <CheckIcon size={16} />
            {:else}
              <LinkSimpleIcon size={16} />
            {/if}
          </button>
        </div>
        <p class="text-xs text-theme-text-muted mb-3">
          Anyone with this link can view this page without logging in.
        </p>
        <button
          onclick={handleUnshare}
          disabled={loading}
          class="w-full text-xs px-3 py-2 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
        >
          {loading ? 'Disabling...' : 'Disable sharing'}
        </button>
      {:else}
        <!-- Not shared: enable button -->
        <p class="text-xs text-theme-text-muted mb-3">
          Create a public link that anyone can use to view this page without logging in.
        </p>
        <button
          onclick={handleShare}
          disabled={loading}
          class="w-full text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create share link'}
        </button>
      {/if}
    </div>
  {/if}
</div>

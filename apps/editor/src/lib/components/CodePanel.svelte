<script lang="ts">
  import { Tabs } from 'bits-ui'
  import { CaretLeft, Code, Play } from 'phosphor-svelte'

  let {
    open = false,
    yaml = '',
    json = '',
    ontoggle,
    onyamlchange,
    onjsonchange,
    onyamlapply,
    onjsonapply,
  }: {
    open?: boolean
    yaml?: string
    json?: string
    ontoggle?: () => void
    onyamlchange?: (value: string) => void
    onjsonchange?: (value: string) => void
    onyamlapply?: () => void
    onjsonapply?: () => void
  } = $props()
</script>

<div class="flex h-full items-stretch gap-1">
  {#if open}
    <div
      class="w-[380px] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl flex flex-col overflow-hidden"
    >
      <Tabs.Root value="yaml" class="flex flex-col h-full">
        <Tabs.List class="flex border-b border-neutral-200 dark:border-neutral-700 shrink-0">
          <Tabs.Trigger
            value="yaml"
            class="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            YAML
          </Tabs.Trigger>
          <Tabs.Trigger
            value="json"
            class="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            JSON
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="yaml" class="flex-1 min-h-0 flex flex-col">
          <textarea
            class="flex-1 w-full p-4 text-[12px] font-mono leading-relaxed bg-transparent text-neutral-700 dark:text-neutral-200 resize-none outline-none placeholder:text-neutral-400 themed-scrollbar"
            spellcheck="false"
            placeholder="# Network topology YAML..."
            value={yaml}
            oninput={(e) => onyamlchange?.((e.target as HTMLTextAreaElement).value)}
          ></textarea>
          <div
            class="flex justify-end px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 shrink-0"
          >
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              onclick={() => onyamlapply?.()}
            >
              <Play class="w-3 h-3" weight="fill" />
              Apply
            </button>
          </div>
        </Tabs.Content>

        <Tabs.Content value="json" class="flex-1 min-h-0 flex flex-col">
          <textarea
            class="flex-1 w-full p-4 text-[12px] font-mono leading-relaxed bg-transparent text-neutral-700 dark:text-neutral-200 resize-none outline-none placeholder:text-neutral-400 themed-scrollbar"
            spellcheck="false"
            value={json}
            oninput={(e) => onjsonchange?.((e.target as HTMLTextAreaElement).value)}
          ></textarea>
          <div
            class="flex justify-end px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 shrink-0"
          >
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              onclick={() => onjsonapply?.()}
            >
              <Play class="w-3 h-3" weight="fill" />
              Apply
            </button>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  {/if}

  <button
    type="button"
    class="self-center flex items-center justify-center shrink-0 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors {open ? 'w-6 h-10' : 'w-10 h-10'}"
    onclick={() => ontoggle?.()}
  >
    {#if open}
      <CaretLeft class="w-4 h-4" />
    {:else}
      <Code class="w-5 h-5" />
    {/if}
  </button>
</div>

<style>
  .themed-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #d4d4d4 transparent;
  }
  :global(.dark) .themed-scrollbar {
    scrollbar-color: #525252 transparent;
  }
</style>

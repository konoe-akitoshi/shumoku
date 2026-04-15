<script lang="ts">
  import { Cube, Plus } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'

  const projects = [
    { id: 'sample', name: 'Sample Network', description: 'Multi-site campus network with PoE' },
    { id: 'empty', name: 'Empty Project', description: 'Start from scratch' },
  ]
</script>

<div class="min-h-screen bg-background px-6 py-8 max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-bold">shumoku</h1>
      <p class="text-sm text-muted-foreground">Network Topology Editor</p>
    </div>
    <Button disabled title="Requires database (coming soon)">
      <Plus class="w-4 h-4 mr-1" />
      New Project
    </Button>
  </div>

  <div class="grid gap-4">
    {#each projects as project}
      <Card.Root
        class="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
        onclick={() => goto(`/project/${project.id}/diagram`)}
      >
        <Card.Content class="pt-4 flex items-center gap-4">
          <div class="p-3 rounded-lg bg-muted"><Cube class="w-6 h-6 text-muted-foreground" /></div>
          <div>
            <div class="font-semibold">{project.name}</div>
            <div class="text-sm text-muted-foreground">{project.description}</div>
          </div>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
</div>

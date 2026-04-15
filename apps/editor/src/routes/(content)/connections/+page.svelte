<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'

  interface ConnectionRow {
    id: string
    fromNode: string
    fromPort: string
    toNode: string
    toPort: string
    bandwidth: string
    vlan: string
    fromIp: string
    toIp: string
    label: string
  }

  const rows = $derived.by<ConnectionRow[]>(() => {
    return diagramState.links.map((link, i) => {
      const from = typeof link.from === 'object' ? link.from : { node: link.from }
      const to = typeof link.to === 'object' ? link.to : { node: link.to }
      const rawFromIp = 'ip' in from ? from.ip : undefined
      const rawToIp = 'ip' in to ? to.ip : undefined
      return {
        id: link.id ?? `link-${i}`,
        fromNode: from.node,
        fromPort: 'port' in from ? (from.port ?? '') : '',
        toNode: to.node,
        toPort: 'port' in to ? (to.port ?? '') : '',
        bandwidth: link.bandwidth ?? '',
        vlan: link.vlan
          ? Array.isArray(link.vlan)
            ? link.vlan.join(', ')
            : String(link.vlan)
          : '',
        fromIp: rawFromIp ? (Array.isArray(rawFromIp) ? rawFromIp.join(', ') : rawFromIp) : '',
        toIp: rawToIp ? (Array.isArray(rawToIp) ? rawToIp.join(', ') : rawToIp) : '',
        label: Array.isArray(link.label) ? link.label.join(', ') : (link.label ?? ''),
      }
    })
  })
</script>

<div class="flex items-center justify-between mb-6">
  <div>
    <h1 class="text-lg font-semibold">Connections</h1>
    <p class="text-sm text-muted-foreground">{rows.length} links</p>
  </div>
</div>

{#if rows.length > 0}
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>From</Table.Head>
          <Table.Head>To</Table.Head>
          <Table.Head>Bandwidth</Table.Head>
          <Table.Head>VLAN</Table.Head>
          <Table.Head>From IP</Table.Head>
          <Table.Head>To IP</Table.Head>
          <Table.Head>Label</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each rows as row}
          <Table.Row>
            <Table.Cell class="font-mono text-xs">
              <span class="font-medium">{row.fromNode}</span>
              {#if row.fromPort}
                <span class="text-muted-foreground">:{row.fromPort}</span>
              {/if}
            </Table.Cell>
            <Table.Cell class="font-mono text-xs">
              <span class="font-medium">{row.toNode}</span>
              {#if row.toPort}
                <span class="text-muted-foreground">:{row.toPort}</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if row.bandwidth}
                <Badge variant="secondary" class="font-mono text-[10px]">{row.bandwidth}</Badge>
              {:else}
                <span class="text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell class="font-mono text-xs text-muted-foreground"
              >{row.vlan || '—'}</Table.Cell
            >
            <Table.Cell class="font-mono text-[10px] text-muted-foreground"
              >{row.fromIp || '—'}</Table.Cell
            >
            <Table.Cell class="font-mono text-[10px] text-muted-foreground"
              >{row.toIp || '—'}</Table.Cell
            >
            <Table.Cell class="text-muted-foreground">{row.label || '—'}</Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Root>
{:else}
  <Card.Root class="py-16">
    <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
      <p class="text-sm">No connections in diagram.</p>
    </Card.Content>
  </Card.Root>
{/if}

<script lang="ts">
  import type { ReadPlan } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'

  /** Consent before a trial: it sends SNMP requests to live devices. */
  interface Props {
    plan: ReadPlan | null
    onConfirm: () => void
    onCancel: () => void
  }

  let { plan, onConfirm, onCancel }: Props = $props()
</script>

<Dialog.Root bind:open={() => plan !== null, (v) => !v && onCancel()}>
  <Dialog.Content class="sm:max-w-md">
    {#if plan}
      <Dialog.Header>
        <Dialog.Title>認証情報を試して読み取る</Dialog.Title>
        <Dialog.Description class="text-sm">
          認証情報を持たない {plan.toTry} 台に、{plan.credentials}
          個の認証情報を順に試します（SNMP リクエストは最大 {plan.requests}
          件）。対象にしたくない機器は先に「対象外」にしてください。
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Body>
        <div class="space-y-2 text-sm text-muted-foreground">
          {#if plan.retryLost > 0}
            <p>失敗中の {plan.retryLost} 台には、現在以外の認証情報を試します。</p>
          {/if}
          {#if plan.toRead > 0}
            <p>すでに認証情報のある {plan.toRead} 台も読み取ります。</p>
          {/if}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" size="sm" onclick={onCancel}>キャンセル</Button>
        <Button size="sm" onclick={onConfirm}>試して読み取る</Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<script lang="ts">
  import type { AccessMethod, Credential } from '$lib/api'
  import CredentialEditor, { type CredentialOutcome } from '$lib/components/CredentialEditor.svelte'
  import * as Dialog from '$lib/components/ui/dialog'

  /**
   * Create or edit a credential (admin). A bottom sheet on a narrow screen, a
   * centred dialog from `sm` up, like the device sheet.
   */
  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    topologyId: string
    methods: AccessMethod[]
    /** The credential to edit; null creates one. */
    credential: Credential | null
    topologies: { id: string; name: string }[]
    onDone: (outcome: CredentialOutcome) => void | Promise<void>
  }

  let { open, onOpenChange, topologyId, methods, credential, topologies, onDone }: Props = $props()
</script>

<Dialog.Root bind:open={() => open, (v) => onOpenChange(v)}>
  <Dialog.Content
    class="top-auto bottom-0 left-0 max-w-full translate-x-0 translate-y-0 rounded-b-none sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-b-lg"
  >
    <Dialog.Header>
      <Dialog.Title>{credential ? '認証情報を編集' : '認証情報を追加'}</Dialog.Title>
      <Dialog.Description class="text-xs">
        機器の読み取りに使う認証情報です。「読み取る」で、認証情報のない機器に順に試されます。
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Body>
      {#key credential?.id ?? 'new'}
        <CredentialEditor
          {topologyId}
          {methods}
          {credential}
          {topologies}
          {onDone}
          onCancel={() => onOpenChange(false)}
        />
      {/key}
    </Dialog.Body>
  </Dialog.Content>
</Dialog.Root>

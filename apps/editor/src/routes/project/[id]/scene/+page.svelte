<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'

  $effect(() => {
    goto(`/project/${$page.params.id}/map`, { replaceState: true })
  })
</script>

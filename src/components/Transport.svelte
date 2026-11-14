<script lang="ts">
  import { Play, Square, Ban } from '@lucide/svelte';
  import { store } from '$lib';
  import { onMount } from 'svelte';

  // The host reads the real scheduler; clients get an extrapolated position from the host's messages.
  let position = $state(0);
  onMount(() => {
    const id = setInterval(() => (position = store.transport.position()), 100);
    return () => clearInterval(id);
  });
</script>

<div>
  <button onclick={() => store.transport.toggle()}>
    {#if store.transport.playing}
      <Square size={20} />
    {:else}
      <Play size={20} />
    {/if}
  </button>
  <!-- stop -->
  <button onclick={() => store.transport.stop()}><Ban size={20} /></button>
  <span>{position.toFixed(2)}</span>
</div>

<script lang="ts">
  import { Play, Square, Ban } from '@lucide/svelte';
  import { strudel, store } from '$lib';

  let time = $derived(strudel.time);
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
  <span>{$time.toFixed(2)}</span>
</div>

<script lang="ts">
  import { Play, Square, Ban } from '@lucide/svelte';
  import type { Dispatch } from '$lib/commands';

  // Pure view: state comes in as props, intent goes out as commands.
  let { playing, position, dispatch }: { playing: boolean; position: number; dispatch: Dispatch } =
    $props();
</script>

<div>
  <button
    aria-label={playing ? 'Pause' : 'Play'}
    onclick={() => dispatch({ type: 'transport', action: 'toggle' })}
  >
    {#if playing}
      <Square size={20} />
    {:else}
      <Play size={20} />
    {/if}
  </button>
  <!-- stop -->
  <button aria-label="Stop" onclick={() => dispatch({ type: 'transport', action: 'stop' })}
    ><Ban size={20} /></button
  >
  <span>{position.toFixed(2)}</span>
</div>

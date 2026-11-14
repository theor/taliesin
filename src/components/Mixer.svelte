<script lang="ts">
  import { getInstrumentIcon } from '$lib/Store.svelte';
  import type { Dispatch, Song } from '$lib/commands';
  import { Volume } from '@lucide/svelte';
  import { Slider } from 'svelte-tweakpane-ui';

  // Pure view: the song comes in as a prop, changes go out as commands.
  let { song, dispatch }: { song: Song; dispatch: Dispatch } = $props();
</script>

<div class="grid w-full grid-flow-row auto-rows-min gap-2 md:auto-cols-min md:grid-flow-col">
  <div
    class="card preset-filled-surface-100-900 border-surface-200-800 card-hover divide-surface-200-800 block w-sm divide-y overflow-hidden border-[1px]"
  >
    <header class="flex flex-row gap-2 p-4">
      <Volume size="36" />
      <h3 class="h3">Main</h3>
    </header>
    <article class="h-64 space-y-4 overflow-y-auto p-4">
      <Slider
        label="Master Volume"
        value={song.volume}
        min={0}
        max={1}
        step={0.01}
        on:change={(e) =>
          e.detail.origin === 'internal' &&
          dispatch({ type: 'setMasterVolume', volume: e.detail.value })}
      />
    </article>
  </div>
  {#each song.instrumentsData as instrumentData (instrumentData.id)}
    {@const Icon = getInstrumentIcon(instrumentData.instrumentName)}
    <div
      class="card preset-filled-surface-100-900 border-surface-200-800 card-hover divide-surface-200-800 block w-sm divide-y overflow-hidden border-[1px]"
    >
      <header class="flex flex-row gap-2 p-4">
        <Icon size="36" />
        <h3 class="h3">{instrumentData.name}</h3>
      </header>
      <article class="h-64 space-y-4 overflow-y-auto p-4">
        <Slider
          label="Volume"
          value={instrumentData.volume}
          min={0}
          max={1}
          step={0.01}
          on:change={(e) =>
            e.detail.origin === 'internal' &&
            dispatch({
              type: 'setInstrumentFields',
              instrumentId: instrumentData.id,
              fields: { volume: e.detail.value }
            })}
        />
      </article>
    </div>
  {/each}
</div>

<script lang="ts">
  import { getInstrumentIcon } from '$lib/Store.svelte';
  import type { Dispatch, Song } from '$lib/commands';
  import { Volume } from '@lucide/svelte';
  import ParamSlider from './ParamSlider.svelte';
  import ParamSelect from './ParamSelect.svelte';
  import { KEYS, MODE_NAMES } from '$lib/scale';

  const setScale = (scaleKey: string, scaleMode: string) =>
    dispatch({ type: 'setScale', scaleKey, scaleMode });

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
      <ParamSlider
        label="Master Volume"
        bind:value={() => song.volume, (volume) => dispatch({ type: 'setMasterVolume', volume })}
        min={0}
        max={1}
        step={0.01}
      />
      <ParamSelect
        label="Key"
        options={[...KEYS]}
        bind:value={() => song.scale.scaleKey, (k) => setScale(k, song.scale.scaleMode)}
      />
      <ParamSelect
        label="Mode"
        options={[...MODE_NAMES]}
        bind:value={() => song.scale.scaleMode, (m) => setScale(song.scale.scaleKey, m)}
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
        <ParamSlider
          label="Volume"
          bind:value={
            () => instrumentData.volume,
            (volume) =>
              dispatch({
                type: 'setInstrumentFields',
                instrumentId: instrumentData.id,
                fields: { volume }
              })
          }
          min={0}
          max={1}
          step={0.01}
        />
      </article>
    </div>
  {/each}
</div>

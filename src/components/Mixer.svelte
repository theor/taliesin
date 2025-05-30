<script lang="ts">
  import { store } from '$lib';
  import { getInstrumentIcon } from '$lib/Store.svelte';
  import { Volume } from '@lucide/svelte';
  import { Slider } from 'svelte-tweakpane-ui';
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
          bind:value={store.instrumentsData.volume}
          min={0}
          max={1}
          step={0.01}
        />
      </article>
  </div>
  {#each store.instrumentsData.instrumentsData as instrumentData, index}
    {@const Icon = getInstrumentIcon(instrumentData.instrumentName)}
    <div
      class="card preset-filled-surface-100-900 border-surface-200-800 card-hover divide-surface-200-800 block w-sm divide-y overflow-hidden border-[1px]"
    >
      <header class="flex flex-row gap-2 p-4">
        <Icon size="36" />
        <h3 class="h3">{instrumentData.name}</h3>
      </header>
      <article class="h-64 space-y-4 overflow-y-auto p-4">
        <Slider label="Volume" bind:value={instrumentData.volume} min={0} max={1} step={0.01} />
      </article>
    </div>
  {/each}
</div>

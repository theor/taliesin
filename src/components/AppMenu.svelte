<script lang="ts">
  import {store } from '$lib';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import { Plus } from '@lucide/svelte';
    import { getInstrumentIcon } from '$lib/Store.svelte';
    import { PianoScale } from '$lib/instruments/MonoSynth';

  let {
    drawerClose,
    selectedIndex = $bindable()
  }: {
    drawerClose?: () => void;
    selectedIndex: number;
  } = $props();
  const instrumentsData = store.instrumentsData;

  function onValueChange(x: string) {
    let i = parseInt(x);
    if (isNaN(i) || i < 0 || i >= instrumentsData.instrumentsData.length) {
      i = instrumentsData.instrumentsData.length - 1;
    }
    console.log('selectedIndex', i);

    selectedIndex = i;
  }
  function onAdd() {
    store.createInstrument(PianoScale);
    selectedIndex = instrumentsData.instrumentsData.length - 1;
  }
</script>

<!-- <header class="flex justify-between">
	<h2 class="h2">Drawer Example</h2>
</header> -->
<Navigation.Rail expanded={true} value={selectedIndex.toString()} {onValueChange}>
  {#snippet tiles()}
    {#each instrumentsData.instrumentsData as instrumentData, index}
      {@const Icon = getInstrumentIcon(instrumentData.instrumentName)}
      <Navigation.Tile labelExpanded={instrumentData.instrumentName} id={index.toString()}>
        <Icon size={24} />
      </Navigation.Tile>
    {/each}
  {/snippet}

  {#snippet footer()}
    <Navigation.Tile labelExpanded="Add" title="Add" onclick={onAdd}><Plus /></Navigation.Tile>`
    <div class="flex w-full flex-row gap-4">
      {#if drawerClose}
        <button
          type="button"
          class="rounded-container preset-outlined-primary-500 flex items-center gap-4 p-4 py-3"
          onclick={drawerClose}>Close Drawer</button
        >
      {/if}
    </div>
  {/snippet}
</Navigation.Rail>

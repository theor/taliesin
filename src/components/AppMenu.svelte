<script lang="ts">
  import {store } from '$lib';
  import { Modal, Navigation } from '@skeletonlabs/skeleton-svelte';
  import { Plus, Volume } from '@lucide/svelte';
    import { getInstrumentIcon, mixerIndex, presets } from '$lib/Store.svelte';
    import { addInstrumentCommand } from '$lib/commandBuilders';
    import type { Dispatch } from '$lib/commands';

  let {
    drawerClose,
    selectedIndex = $bindable(),
    dispatch
  }: {
    drawerClose?: () => void;
    selectedIndex: number;
    dispatch: Dispatch;
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
    addModalOpened = true;
  }
  let addModalOpened = $state(false);
</script>

<!-- <header class="flex justify-between">
	<h2 class="h2">Drawer Example</h2>
</header> -->
<Modal
  open={addModalOpened}
  onOpenChange={(e) => (addModalOpened = e.open)}
  contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
  backdropClasses="backdrop-blur-sm"
>
  {#snippet content()}
    <header class="flex justify-between">
      <h2 class="h2">Add instrument</h2>
    </header>
    <article>
     <div>
      {#each presets as preset}
      {@const Icon = getInstrumentIcon(preset.instrument.name)}
      <button
          type="button"
          class="btn  w-full justify-start"
          onclick={() => {
            dispatch(addInstrumentCommand(preset));
            selectedIndex = instrumentsData.instrumentsData.length - 1;
            addModalOpened = false;
          }}
        >
          <Icon size={24} />
          {preset.name}
        </button>
      {/each}
     </div>
    </article>
    <footer class="flex justify-end gap-4">
      <button type="button" class="btn preset-tonal" onclick={() => addModalOpened = false}>Cancel</button>
    </footer>
  {/snippet}
</Modal>
<Navigation.Rail expanded={true} >
  {#snippet tiles()}
    {#each instrumentsData.instrumentsData as instrumentData, index}
      {@const instrIndex = index}
      {@const Icon = getInstrumentIcon(instrumentData.instrumentName)}
      <Navigation.Tile labelExpanded={instrumentData.name} onclick={() => {console.log(instrIndex); selectedIndex = instrIndex}} selected={selectedIndex === instrIndex}>
        <Icon size={24} />
      </Navigation.Tile>
    {/each}
    <Navigation.Tile labelExpanded="Mixer" title="Mixer" background="preset-secondary" onclick={() => selectedIndex = mixerIndex} selected={selectedIndex === mixerIndex} ><Volume /></Navigation.Tile>`
    <Navigation.Tile labelExpanded="Add" title="Add" background="preset-secondary" onclick={onAdd}><Plus /></Navigation.Tile>`
  {/snippet}

  {#snippet footer()}
    
    <div class="flex w-full flex-row gap-4">
      {#if drawerClose}
        <button
          type="button"
          class="rounded-container preset-outlined-primary-500 flex items-center gap-4 p-4 py-3"
          onclick={drawerClose}>Close Drawer</button
        >
      {/if}
    </div>
    {selectedIndex}
  {/snippet}
</Navigation.Rail>

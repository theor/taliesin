<script lang="ts">
  import { store } from '$lib';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import { Plus, Volume } from '@lucide/svelte';
  import { getInstrumentIcon, mixerIndex } from '$lib/Store.svelte';
  import { TrackState } from '$lib/instruments';
  import type { Dispatch } from '$lib/commands';
  import AddInstrumentModal from './AddInstrumentModal.svelte';

  /** The desktop sidebar: one tile per instrument, the mixer, and "Add". (Phones use `phone/PhoneApp`.) */
  let {
    selectedIndex = $bindable(),
    dispatch
  }: {
    selectedIndex: number;
    dispatch: Dispatch;
  } = $props();

  const instrumentsData = store.instrumentsData;
  let addModalOpened = $state(false);
</script>

<AddInstrumentModal bind:open={addModalOpened} bind:selectedIndex {dispatch} />
<Navigation.Rail expanded={true}>
  {#snippet tiles()}
    {#each instrumentsData.instrumentsData as instrumentData, index (instrumentData.id)}
      {@const Icon = getInstrumentIcon(instrumentData.instrumentName)}
      {@const muted = instrumentData.state === TrackState.Muted}
      <Navigation.Tile
        labelExpanded="{instrumentData.name}{instrumentData.state === TrackState.Solo
          ? ' (solo)'
          : muted
            ? ' (muted)'
            : ''}"
        onclick={() => (selectedIndex = index)}
        selected={selectedIndex === index}
      >
        <span class="relative block {muted ? 'opacity-40' : ''}">
          <Icon size={24} />
          {#key store.activity[instrumentData.id]}
            {#if store.activity[instrumentData.id]}
              <span class="edit-flash bg-warning-500 absolute -top-1 -right-1 size-2.5 rounded-full"
              ></span>
            {/if}
          {/key}
        </span>
      </Navigation.Tile>
    {/each}
    <Navigation.Tile
      labelExpanded="Mixer"
      title="Mixer"
      background="preset-secondary"
      onclick={() => (selectedIndex = mixerIndex)}
      selected={selectedIndex === mixerIndex}><Volume /></Navigation.Tile
    >
    <Navigation.Tile
      labelExpanded="Add"
      title="Add"
      background="preset-secondary"
      onclick={() => (addModalOpened = true)}><Plus /></Navigation.Tile
    >
  {/snippet}
</Navigation.Rail>

<style>
  /* a dot that flashes once whenever someone else edits the instrument (re-created by {#key}) */
  .edit-flash {
    animation: edit-flash 1.6s ease-out forwards;
  }
  @keyframes edit-flash {
    from {
      opacity: 1;
      transform: scale(1.6);
    }
    to {
      opacity: 0;
      transform: scale(1);
    }
  }
</style>

<script lang="ts">
  import { store } from '$lib';
  import { Plus, Volume, Play, Square, Ban, Volume2 } from '@lucide/svelte';
  import { getInstrumentIcon, mixerIndex } from '$lib/Store.svelte';
  import { TrackState } from '$lib/instruments';
  import type { Dispatch } from '$lib/commands';
  import AddInstrumentModal from './AddInstrumentModal.svelte';

  /**
   * The phone's controls, pinned to the bottom edge where a thumb reaches: play / stop (and "tap to hear"
   * for guests, whose browsers keep audio locked until a tap) above a strip with one tab per instrument.
   */
  let {
    selectedIndex = $bindable(),
    dispatch,
    playing,
    needsTap,
    onTap
  }: {
    selectedIndex: number;
    dispatch: Dispatch;
    playing: boolean;
    /** A guest whose audio is still locked. */
    needsTap: boolean;
    onTap: () => void;
  } = $props();

  let addOpen = $state(false);
  const tab = 'flex min-w-16 flex-none flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-xs';
</script>

<AddInstrumentModal bind:open={addOpen} bind:selectedIndex {dispatch} />

<nav
  class="bg-surface-100-900 border-surface-200-800 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
  aria-label="Instruments and transport"
>
  {#if needsTap}
    <button class="btn preset-filled-primary-500 w-full rounded-none py-3" onclick={onTap}>
      <Volume2 size={20} /> Tap to hear
    </button>
  {/if}
  <div class="flex items-center gap-3 px-3 pt-2">
    <button
      class="btn-icon preset-filled-primary-500 size-12"
      aria-label={playing ? 'Pause' : 'Play'}
      onclick={() => dispatch({ type: 'transport', action: 'toggle' })}
    >
      {#if playing}<Square size={22} />{:else}<Play size={22} />{/if}
    </button>
    <button
      class="btn-icon preset-tonal size-12"
      aria-label="Stop"
      onclick={() => dispatch({ type: 'transport', action: 'stop' })}><Ban size={22} /></button
    >
    <span class="text-surface-600-400 ml-auto text-xs">{store.peers.length + 1} here</span>
  </div>
  <div class="flex gap-1 overflow-x-auto px-2 py-2">
    {#each store.instrumentsData.instrumentsData as instrumentData, index (instrumentData.id)}
      {@const Icon = getInstrumentIcon(instrumentData.instrumentName)}
      {@const muted = instrumentData.state === TrackState.Muted}
      <button
        class="{tab} {selectedIndex === index ? 'preset-filled-primary-500' : 'preset-tonal'}"
        title={instrumentData.name}
        aria-current={selectedIndex === index}
        onclick={() => (selectedIndex = index)}
      >
        <span class="relative block {muted ? 'opacity-40' : ''}">
          <Icon size={22} />
          {#if instrumentData.state === TrackState.Solo}
            <span
              class="bg-warning-500 absolute -top-1 -right-2 rounded px-1 text-[10px] leading-3 text-black"
              >S</span
            >
          {/if}
          {#key store.activity[instrumentData.id]}
            {#if store.activity[instrumentData.id]}
              <span class="edit-flash bg-warning-500 absolute -top-1 -left-1 size-2.5 rounded-full"
              ></span>
            {/if}
          {/key}
        </span>
        <span class="max-w-16 truncate">{instrumentData.name}</span>
      </button>
    {/each}
    <button
      class="{tab} {selectedIndex === mixerIndex
        ? 'preset-filled-secondary-500'
        : 'preset-tonal-secondary'}"
      title="Mixer"
      onclick={() => (selectedIndex = mixerIndex)}
    >
      <Volume size={22} /><span>Mixer</span>
    </button>
    <button class="{tab} preset-tonal-secondary" title="Add" onclick={() => (addOpen = true)}>
      <Plus size={22} /><span>Add</span>
    </button>
  </div>
</nav>

<style>
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

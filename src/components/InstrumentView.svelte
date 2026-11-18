<script lang="ts">
  import { TrackState, type IDispatchingInstrumentViewProps } from '$lib';
  import { getInstrumentIcon } from '$lib/Store.svelte';
  import { randomizeCommands, setTrackStateCommand } from '$lib/commandBuilders';
  import { Dices, Headphones, VolumeX } from '@lucide/svelte';
  import InstrumentMenu from './InstrumentMenu.svelte';
  import InputViewSwitcher from '../instruments/InputViewSwitcher.svelte';
  import InstrumentPartView from './InstrumentPartView.svelte';
  import QuickControls from './QuickControls.svelte';
  import { PART_VIEWS } from './partViews';

  let {
    index,
    instrumentData = $bindable(),
    dispatch,
    position,
    playing,
    now,
    editedByOther
  }: IDispatchingInstrumentViewProps = $props();

  let Icon = $derived(getInstrumentIcon(instrumentData.instrumentName));

  let moreOpen = $state(false);

  const muted = $derived(instrumentData.state === TrackState.Muted);
  const soloed = $derived(instrumentData.state === TrackState.Solo);

  /** The parts this instrument has controls for, in the registry's order. */
  const editableParts = $derived(
    PART_VIEWS.flatMap(({ id, component }) => {
      const part = instrumentData.parts.find((p) => p.partName === id);
      return part ? [{ part, component }] : [];
    })
  );

  const iconButton = 'btn-icon btn-icon-sm';
</script>

<div class="card preset-outlined-surface-200-800 bg-surface-50-950 space-y-3 p-3">
  <header
    class="card-header instrument-header border-primary-500 flex flex-row items-center justify-between gap-2 border-b-2 pb-2"
  >
    <span class="flex min-w-0 items-center gap-2">
      <span class="relative {muted ? 'opacity-40' : ''}"><Icon size="24" /></span>
      <span class="truncate">{instrumentData.name}</span>
      {#key editedByOther}
        {#if editedByOther}
          <span
            class="edit-flash bg-warning-500 inline-block size-2.5 rounded-full"
            title="Someone else just edited this"
          ></span>
        {/if}
      {/key}
    </span>

    <span class="relative flex items-center gap-1">
      <button
        aria-label="Randomize"
        title="Randomize"
        class="btn preset-filled-primary-500 px-3 py-1"
        onclick={() => randomizeCommands(instrumentData).forEach((c) => dispatch(c))}
        ><Dices size={18} /></button
      >
      <button
        aria-label="Mute"
        aria-pressed={muted}
        title="Mute"
        class="{iconButton} {muted ? 'preset-filled-error-500' : 'preset-tonal'}"
        onclick={() => dispatch(setTrackStateCommand(instrumentData, TrackState.Muted))}
        ><VolumeX size={18} /></button
      >
      <button
        aria-label="Solo"
        aria-pressed={soloed}
        title="Solo"
        class="{iconButton} {soloed ? 'preset-filled-warning-500' : 'preset-tonal'}"
        onclick={() => dispatch(setTrackStateCommand(instrumentData, TrackState.Solo))}
        ><Headphones size={18} /></button
      >
      <InstrumentMenu {instrumentData} {dispatch} buttonClass={iconButton} />
    </span>
  </header>

  <InputViewSwitcher bind:instrumentData {index} {dispatch} {position} {playing} {now} />

  <QuickControls {instrumentData} {dispatch} />

  <details
    class="border-surface-200-800 rounded border"
    data-testid="more-controls"
    ontoggle={(e) => (moreOpen = e.currentTarget.open)}
  >
    <summary class="cursor-pointer px-2 py-2 text-sm">More controls</summary>
    {#if moreOpen}
      <div class="space-y-1 p-2">
        {#each editableParts as { part, component } (part.partName)}
          <InstrumentPartView
            instrumentId={instrumentData.id}
            {dispatch}
            PartComponent={component}
            partData={part}
          />
        {/each}
      </div>
    {/if}
  </details>
</div>

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

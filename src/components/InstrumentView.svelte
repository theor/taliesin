<script lang="ts">
  import { TrackState, type IDispatchingInstrumentViewProps } from '$lib';
  import { randomizeCommands, setTrackStateCommand } from '$lib/commandBuilders';
  import { getInstrument } from '$lib/Store.svelte';
  import { trackColor, trackInitials, trackKind } from '$lib/trackColors';
  import { Dices, Headphones, VolumeX } from '@lucide/svelte';
  import InstrumentMenu from './InstrumentMenu.svelte';
  import InputViewSwitcher from '../instruments/InputViewSwitcher.svelte';
  import QuickControls from './QuickControls.svelte';
  import RackModules from './RackModules.svelte';

  /**
   * The desktop's instrument: its header, the input views (grid, circles...), the quick sliders, and its
   * rack of modules. Wears the track's colour as the primary colour, like the phone's Edit screen.
   */
  let {
    index,
    instrumentData = $bindable(),
    dispatch,
    position,
    playing,
    now,
    editedByOther
  }: IDispatchingInstrumentViewProps = $props();

  const color = $derived(trackColor(index));
  const muted = $derived(instrumentData.state === TrackState.Muted);
  const soloed = $derived(instrumentData.state === TrackState.Solo);
  const length = $derived(getInstrument(instrumentData)?.getLength(instrumentData));

  const button =
    'bg-surface-900 border-surface-700 hover:border-surface-500 flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold';
</script>

<div class="flex flex-col gap-4" style:--color-primary-500={color}>
  <header class="flex items-center gap-3">
    <span
      class="relative flex size-10 flex-none items-center justify-center rounded-lg text-[13px] font-bold text-[#0B0C0F] {muted
        ? 'opacity-40'
        : ''}"
      style:background={color}
    >
      {trackInitials(instrumentData.name)}
      {#key editedByOther}
        {#if editedByOther}
          <span
            class="edit-flash bg-warning-500 border-surface-950 absolute -top-1 -right-1 size-3 rounded-full border-2"
            title="Someone else just edited this"
          ></span>
        {/if}
      {/key}
    </span>
    <div class="flex min-w-0 flex-1 flex-col">
      <h1 class="truncate text-xl leading-tight font-bold">{instrumentData.name}</h1>
      <span class="text-surface-300 truncate text-xs"
        >{trackKind(instrumentData.instrumentName)}{length
          ? ` · ${length.stepsPerMeasure * length.measures} steps`
          : ''}{muted ? ' · muted' : soloed ? ' · solo' : ''}</span
      >
    </div>
    <button
      aria-label="Randomize"
      title="Randomize"
      class={button}
      onclick={() => randomizeCommands(instrumentData).forEach((c) => dispatch(c))}
      ><Dices size={18} /><span class="hidden lg:inline">Randomize</span></button
    >
    <button
      aria-label="Mute"
      aria-pressed={muted}
      title="Mute"
      class="{button} {muted
        ? 'bg-warning-500! border-warning-500! text-warning-contrast-500'
        : ''}"
      onclick={() => dispatch(setTrackStateCommand(instrumentData, TrackState.Muted))}
      ><VolumeX size={18} /></button
    >
    <button
      aria-label="Solo"
      aria-pressed={soloed}
      title="Solo"
      class="{button} {soloed
        ? 'bg-primary-500! border-primary-500! text-primary-contrast-500'
        : ''}"
      onclick={() => dispatch(setTrackStateCommand(instrumentData, TrackState.Solo))}
      ><Headphones size={18} /></button
    >
    <InstrumentMenu {instrumentData} {dispatch} buttonClass="{button} w-10 px-0" />
  </header>

  <InputViewSwitcher bind:instrumentData {index} {dispatch} {position} {playing} {now} />

  <div class="bg-surface-900 border-surface-700 rounded-2xl border px-4 py-2">
    <QuickControls {instrumentData} {dispatch} columns="sm:grid-cols-2 xl:grid-cols-3" />
  </div>

  <section aria-label="Rack" class="flex flex-col gap-3 pb-8">
    <h2 class="text-sm font-bold tracking-[0.08em] uppercase">Rack</h2>
    <RackModules {instrumentData} {dispatch} layout="grid" />
  </section>
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

<script lang="ts">
  import {
    PartArpeggiator,
    PartChords,
    PartEffects,
    PartFilter,
    PartOctave,
    PartSteps,
    PartVoice,
    PartFm,
    PartEnvelope,
    getPart,
    TrackState,
    type Constructor,
    type IDispatchingInstrumentViewProps,
    type InstrumentPartTyped,
    type IPartViewProps,
    type PartType
  } from '$lib';
  import { getInstrumentIcon } from '$lib/Store.svelte';
  import {
    canDoubleLoop,
    canHalveLoop,
    clearCommands,
    randomizeCommands,
    resizeLoopCommands,
    setTrackStateCommand
  } from '$lib/commandBuilders';
  import { type Component } from 'svelte';
  import { Dices, EllipsisVertical, Eraser, Headphones, Trash2, VolumeX } from '@lucide/svelte';
  import PianoScaleView from '../instruments/PianoScaleView.svelte';
  import InstrumentPartView from './InstrumentPartView.svelte';
  import MacroSlider from './MacroSlider.svelte';
  import PartOctaveView from './PartOctaveView.svelte';
  import PartStepsView from './PartStepsView.svelte';
  import PartFilterView from './PartFilterView.svelte';
  import PartEffectsView from './PartEffectsView.svelte';
  import PartChordsView from './PartChordsView.svelte';
  import PartArpView from './PartArpView.svelte';
  import PartVoiceView from './PartVoiceView.svelte';
  import PartFmView from './PartFmView.svelte';
  import PartEnvelopeView from './PartEnvelopeView.svelte';

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
  let menuOpen = $state(false);
  let confirmRemove = $state(false);
  const closeMenu = () => {
    menuOpen = false;
    confirmRemove = false;
  };

  const effects = $derived(getPart(PartEffects, instrumentData));
  const octave = $derived(getPart(PartOctave, instrumentData));
  const filter = $derived(getPart(PartFilter, instrumentData));
  const muted = $derived(instrumentData.state === TrackState.Muted);
  const soloed = $derived(instrumentData.state === TrackState.Solo);

  const setPart = (partName: string, fields: { [key: string]: number }) =>
    dispatch({ type: 'setPartFields', instrumentId: instrumentData.id, partName, fields });
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
      <button
        aria-label="Instrument menu"
        aria-expanded={menuOpen}
        class={iconButton}
        onclick={() => (menuOpen ? closeMenu() : (menuOpen = true))}
        ><EllipsisVertical size={18} /></button
      >
      {#if menuOpen}
        <div
          class="bg-surface-100-900 border-surface-300-700 absolute top-full right-0 z-30 mt-1 flex w-48 flex-col gap-1 rounded-lg border p-2 shadow-xl"
        >
          <button
            class="btn preset-tonal justify-start"
            onclick={() => {
              clearCommands(instrumentData).forEach((c) => dispatch(c));
              closeMenu();
            }}><Eraser size={16} /> Clear pattern</button
          >
          <button
            class="btn preset-tonal justify-start"
            disabled={!canHalveLoop(instrumentData)}
            onclick={() => {
              resizeLoopCommands(instrumentData, 'halve').forEach((c) => dispatch(c));
              closeMenu();
            }}>½ Shorter loop</button
          >
          <button
            class="btn preset-tonal justify-start"
            disabled={!canDoubleLoop(instrumentData)}
            onclick={() => {
              resizeLoopCommands(instrumentData, 'double').forEach((c) => dispatch(c));
              closeMenu();
            }}>×2 Longer loop</button
          >
          {#if confirmRemove}
            <p class="px-1 text-sm">Remove {instrumentData.name} for everyone?</p>
            <button
              class="btn preset-filled-error-500 justify-start"
              onclick={() =>
                dispatch({ type: 'removeInstrument', instrumentId: instrumentData.id })}
              >Yes, remove it</button
            >
            <button class="btn preset-tonal justify-start" onclick={() => (confirmRemove = false)}
              >Keep it</button
            >
          {:else}
            <button
              aria-label="Remove instrument"
              class="btn preset-outlined-error-500 justify-start"
              onclick={() => (confirmRemove = true)}><Trash2 size={16} /> Remove instrument</button
            >
          {/if}
        </div>
      {/if}
    </span>
  </header>

  <PianoScaleView bind:instrumentData {index} {dispatch} {position} {playing} {now} />

  <section class="grid gap-x-6 gap-y-1 sm:grid-cols-2" aria-label="Quick controls">
    <MacroSlider
      label="Volume"
      value={instrumentData.volume}
      onchange={(volume) =>
        dispatch({
          type: 'setInstrumentFields',
          instrumentId: instrumentData.id,
          fields: { volume }
        })}
    />
    {#if effects}
      <MacroSlider
        label="Reverb"
        value={effects.reverb}
        onchange={(reverb) => setPart(PartEffects.name, { reverb })}
      />
      <MacroSlider
        label="Delay"
        value={effects.delay}
        onchange={(delay) => setPart(PartEffects.name, { delay })}
      />
    {/if}
    {#if filter}
      <MacroSlider
        label="Filter"
        value={Math.log2(filter.freq)}
        min={5}
        max={14}
        step={0.1}
        format={(v) => `${Math.round(2 ** v)} Hz`}
        onchange={(v) => setPart(PartFilter.name, { freq: Math.round(2 ** v) })}
      />
    {/if}
    {#if octave}
      <MacroSlider
        label="Octave"
        value={octave.octave}
        min={0}
        max={8}
        step={1}
        format={(v) => `${v}`}
        onchange={(v) => setPart(PartOctave.name, { octave: v })}
      />
    {/if}
  </section>

  <details
    class="border-surface-200-800 rounded border"
    data-testid="more-controls"
    ontoggle={(e) => (moreOpen = e.currentTarget.open)}
  >
    <summary class="cursor-pointer px-2 py-2 text-sm">More controls</summary>
    {#if moreOpen}
      {#snippet renderOptionalPart(
        partType: Constructor<InstrumentPartTyped<any>>,
        component: Component<IPartViewProps<any>>
      )}
        {#each instrumentData.parts as part, partIndex}
          {#if part.partName === partType.name}
            <InstrumentPartView
              instrumentId={instrumentData.id}
              {dispatch}
              PartComponent={component as Component<IPartViewProps<InstrumentPartTyped<any>>>}
              partData={instrumentData.parts[partIndex] as PartType<InstrumentPartTyped<any>>}
            />
          {/if}
        {/each}
      {/snippet}
      <div class="space-y-1 p-2">
        {@render renderOptionalPart(PartVoice, PartVoiceView)}
        {@render renderOptionalPart(PartFm, PartFmView)}
        {@render renderOptionalPart(PartEnvelope, PartEnvelopeView)}
        {@render renderOptionalPart(PartChords, PartChordsView)}
        {@render renderOptionalPart(PartArpeggiator, PartArpView)}
        {@render renderOptionalPart(PartFilter, PartFilterView)}
        {@render renderOptionalPart(PartOctave, PartOctaveView)}
        {@render renderOptionalPart(PartSteps, PartStepsView)}
        {@render renderOptionalPart(PartEffects, PartEffectsView)}
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

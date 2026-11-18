<script lang="ts">
  import type { InstrumentData } from '$lib';
  import type { PatternCues } from '$lib/cues.svelte';
  import { playheadStep } from '$lib/gesture';
  import { liveSlot, patternLabel } from '$lib/patterns';
  import { getInstrument } from '$lib/Store.svelte';
  import { ArrowRight, Headphones } from '@lucide/svelte';

  /**
   * Shown while this device has a pattern open that is not live (a cue): only this device hears it.
   * Choose what this device plays (the cue or the live pattern), launch the cue for everyone at the next
   * bar, or go back to the live one. Underneath, what everybody else hears.
   */
  let {
    data,
    cues,
    color,
    position = 0,
    playing = false,
    hostOnly = false
  }: {
    /** The instrument as it is in the song (its live pattern). */
    data: InstrumentData;
    cues: PatternCues;
    color: string;
    position?: number;
    playing?: boolean;
    /** Only the host makes sound in this jam: this device plays nothing, cue or not. */
    hostOnly?: boolean;
  } = $props();

  const live = $derived(patternLabel(liveSlot(data)));
  const slot = $derived(cues.slot(data));
  const open = $derived(patternLabel(slot));
  const hearLive = $derived(!!cues.hearLive[data.id]);
  const waiting = $derived(cues.queued[data.id] === slot);

  /** The live pattern, one cell per step (any note on it), for the "room hears" strip. */
  const MAX_CELLS = 32;
  const strip = $derived.by(() => {
    const instr = getInstrument(data);
    const seq = instr?.sequencer;
    if (!instr || !seq) return { cells: [] as boolean[], now: undefined };
    const length = instr.getLength(data);
    const total = Math.min(length.stepsPerMeasure * length.measures, MAX_CELLS);
    const cells = Array.from({ length: total }, (_, step) =>
      seq.tracks.some((_, track) => seq.getCell(data, track, step))
    );
    return { cells, now: playheadStep(position, playing, length) };
  });

  const segment = 'h-9 rounded-lg text-xs font-semibold';
</script>

<section
  class="cue-hatch cue-edge flex flex-col gap-2.5 rounded-2xl p-3"
  aria-label="Cue"
  data-testid="cue-banner"
>
  <div class="flex items-start gap-2.5">
    <span
      class="bg-surface-50 text-surface-950 flex size-8 flex-none items-center justify-center rounded-lg"
      ><Headphones size={18} /></span
    >
    <div class="flex min-w-0 flex-col gap-0.5">
      <span class="text-sm font-bold" data-testid="cue-title">
        {#if waiting}
          {open} starts at the next bar
        {:else if hostOnly}
          Editing {open}, not live
        {:else if hearLive}
          You hear {live}, like everyone
        {:else}
          Only you hear {open}
        {/if}
      </span>
      <span class="text-surface-200 text-xs leading-snug">
        {#if waiting}
          {live} switches to {open} at the next bar, for everyone.
        {:else if hostOnly}
          Everyone hears {live}. Launch {open} to play it.
        {:else if hearLive}
          {open} is silent while you edit it.
        {:else}
          This device plays {open} in place of {live}. Everyone else still hears {live}.
        {/if}
      </span>
    </div>
  </div>

  {#if !hostOnly}
    <div
      class="bg-surface-950 grid grid-cols-2 gap-1 rounded-[10px] p-[3px]"
      role="group"
      aria-label="This device hears"
    >
      <button
        class="{segment} {hearLive ? 'text-surface-200' : 'bg-surface-50 text-surface-950'}"
        aria-pressed={!hearLive}
        onclick={() => cues.setHearLive(data, false)}>Hear {open} (cue)</button
      >
      <button
        class="{segment} {hearLive ? 'bg-surface-50 text-surface-950' : 'text-surface-200'}"
        aria-pressed={hearLive}
        onclick={() => cues.setHearLive(data, true)}>Hear {live} (live)</button
      >
    </div>
  {/if}

  <div class="flex gap-2">
    {#if waiting}
      <button
        class="bg-surface-700 text-surface-100 flex h-11 flex-1 items-center justify-center rounded-[10px] text-sm font-bold"
        onclick={() => cues.cancelLaunch(data)}>Waiting for the bar… (cancel)</button
      >
    {:else}
      <button
        class="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-sm font-bold text-[#0B0C0F]"
        style:background={color}
        onclick={() => cues.launch(data, slot)}
        ><ArrowRight size={16} strokeWidth={2.5} /> Launch {open}{playing
          ? ' at next bar'
          : ''}</button
      >
    {/if}
    <button
      class="border-surface-600 text-surface-50 h-11 rounded-[10px] border px-3.5 text-sm font-semibold"
      onclick={() => cues.pick(data, liveSlot(data))}>Edit {live}</button
    >
  </div>

  {#if strip.cells.length}
    <div class="flex items-center gap-2.5" aria-label="What everyone hears">
      <span
        class="text-surface-300 text-[10px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase"
        >Room hears {live}</span
      >
      <div
        class="grid flex-1 gap-[3px]"
        style:grid-template-columns="repeat({strip.cells.length}, minmax(0, 1fr))"
      >
        {#each strip.cells as on, step (step)}
          <span
            class="h-2.5 rounded-[3px] {on ? '' : 'bg-surface-800'} {strip.now === step
              ? 'ring-surface-50 ring-1 ring-inset'
              : ''}"
            style:background={on ? color : undefined}
          ></span>
        {/each}
      </div>
    </div>
  {/if}
</section>

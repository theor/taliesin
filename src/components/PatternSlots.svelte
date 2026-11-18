<script lang="ts">
  import type { InstrumentData } from '$lib';
  import type { PatternCues, SlotState } from '$lib/cues.svelte';
  import { MAX_PATTERNS, patternLabel, shownSlots } from '$lib/patterns';
  import { Headphones, Plus } from '@lucide/svelte';

  /**
   * An instrument's pattern slots (A, B, C...). Filled with the track's colour: live, played for everyone.
   * Hatched: not live. Dashed light edge with headphones: open here, heard on this device only (a cue).
   * Coloured edge: launched, live from the next bar. Dotted: someone else's cue. Tapping a slot opens it.
   * `data-state` carries the state for tests (live, cue, queued, other, stopped, empty).
   */
  let {
    data,
    cues,
    color,
    size = 'md',
    onPick
  }: {
    /** The instrument as it is in the song (its live pattern). */
    data: InstrumentData;
    cues: PatternCues;
    color: string;
    /** `sm`: the session's track cards (no captions, no "new" slot). */
    size?: 'md' | 'sm';
    /** After a slot was opened (the session opens the editor). */
    onPick?: (slot: number) => void;
  } = $props();

  const open = $derived(cues.slot(data));
  const slots = $derived(shownSlots(data, open));
  const canAdd = $derived(size === 'md' && slots.length < MAX_PATTERNS);

  type State = SlotState;
  const stateOf = (slot: number): State => cues.state(data, slot);
  const CAPTION: Partial<Record<State, string>> = {
    live: 'Live',
    cue: 'Cue',
    queued: 'Next bar',
    other: 'Cued'
  };
  const DESCRIBE: Record<State, string> = {
    live: 'live',
    cue: 'cue, only you hear it',
    queued: 'live from the next bar',
    other: 'someone else is cueing it',
    stopped: 'not playing',
    empty: 'empty'
  };

  function pick(slot: number) {
    cues.pick(data, slot);
    onPick?.(slot);
  }

  const chip = $derived(
    size === 'md'
      ? 'h-12 w-full min-w-11 rounded-xl text-base'
      : 'size-7 flex-none rounded-md text-xs'
  );
</script>

<div
  class="flex {size === 'md' ? 'gap-2' : 'gap-1'}"
  role="group"
  aria-label="{data.name} patterns"
  data-testid="pattern-slots"
>
  {#each slots as slot (slot)}
    {@const state = stateOf(slot)}
    {@const isOpen = slot === open}
    <div class="flex flex-col items-center gap-1 {size === 'md' ? 'flex-1' : ''}">
      <button
        class="flex items-center justify-center gap-1 font-bold {chip} {state === 'live'
          ? 'text-[#0B0C0F]'
          : state === 'empty'
            ? 'border-surface-600 text-surface-400 border border-dashed'
            : state === 'stopped'
              ? 'bg-surface-800 border-surface-600 text-surface-200 border'
              : state === 'other'
                ? 'bg-surface-800 border-surface-300 text-surface-200 border-[1.5px] border-dotted'
                : 'cue-hatch text-surface-50'} {state === 'cue'
          ? 'border-surface-50 border-2 border-dashed'
          : ''} {state === 'queued' ? 'border-2' : ''} {state === 'live' && isOpen && size === 'md'
          ? 'ring-surface-50 ring-offset-surface-950 ring-2 ring-offset-2'
          : ''}"
        style:background={state === 'live' ? color : undefined}
        style:border-color={state === 'queued' ? color : undefined}
        data-state={state}
        data-open={isOpen || undefined}
        aria-pressed={isOpen}
        aria-label="Pattern {patternLabel(slot)}, {DESCRIBE[state]}"
        title="Pattern {patternLabel(slot)}: {DESCRIBE[state]}"
        onclick={() => pick(slot)}
      >
        {#if state === 'cue' && size === 'md'}<Headphones size={13} strokeWidth={2.5} />{/if}
        {patternLabel(slot)}
      </button>
      {#if size === 'md'}
        <span
          class="h-3 text-[10px] leading-3 font-bold tracking-[0.08em] uppercase {state === 'cue' ||
          state === 'other'
            ? 'text-surface-100'
            : ''}"
          style:color={state === 'live' || state === 'queued' ? color : undefined}
          >{CAPTION[state] ?? ''}</span
        >
      {/if}
    </div>
  {/each}
  {#if canAdd}
    <div class="flex flex-col items-center gap-1">
      <button
        class="border-surface-600 text-surface-300 hover:text-surface-50 flex h-12 w-11 items-center justify-center rounded-xl border border-dashed"
        aria-label="New pattern"
        title="New pattern {patternLabel(slots.length)}"
        onclick={() => pick(slots.length)}><Plus size={18} /></button
      >
      <span class="h-3"></span>
    </div>
  {/if}
</div>

<script lang="ts">
  import { TrackState, type InstrumentData } from '$lib';
  import { DEFAULT_BPM, type Dispatch, type Song } from '$lib/commands';
  import { presetCommands, setTrackStateCommand } from '$lib/commandBuilders';
  import { playheadStep } from '$lib/gesture';
  import { getInstrument } from '$lib/Store.svelte';
  import { trackColor, trackInitials, trackKind } from '$lib/trackColors';
  import { Plus } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import type { PatternCues } from '$lib/cues.svelte';
  import { patternLabel, shownSlots } from '$lib/patterns';
  import PatternSlots from '../PatternSlots.svelte';
  import Transport from '../Transport.svelte';

  /**
   * The phone's home screen: the transport, then one card per instrument with a glance at its pattern.
   * Pure view: the song comes in, commands go out; tapping a card opens that instrument.
   */
  let {
    song,
    dispatch,
    position,
    playing,
    selectedIndex,
    activity = {},
    onSelect,
    onAdd,
    status,
    cues
  }: {
    song: Song;
    dispatch: Dispatch;
    position: number;
    playing: boolean;
    selectedIndex: number;
    /** When someone else last edited each instrument, by id. */
    activity?: Record<string, number>;
    onSelect: (index: number) => void;
    onAdd: () => void;
    /** A line under the transport: who is hosting, how many are here. */
    status?: Snippet;
    /** This device's patterns (slots shown on each card when an instrument has more than one). */
    cues?: PatternCues;
  } = $props();

  /** The line under a card's pattern slots: a launch waiting, this device's cue, or someone else's. */
  function cueNote(data: InstrumentData): string {
    if (!cues) return '';
    const queued = cues.queued[data.id];
    if (queued !== undefined) return `${patternLabel(queued)} starts at the next bar`;
    if (cues.isCue(data)) {
      const open = patternLabel(cues.slot(data));
      return cues.hearLive[data.id]
        ? `Editing ${open}, not live`
        : `Cueing ${open}: only you hear it`;
    }
    const other = cues.othersOn(data)[0];
    return other ? `Someone is cueing ${patternLabel(other.slot)}` : '';
  }

  /** The most steps a card shows; longer loops show their start. */
  const MAX_CELLS = 32;

  function overview(data: InstrumentData) {
    const instr = getInstrument(data);
    const seq = instr?.sequencer;
    if (!instr || !seq) return { cells: [] as boolean[], total: 0, now: undefined };
    const length = instr.getLength(data);
    const total = length.stepsPerMeasure * length.measures;
    const cells = Array.from({ length: Math.min(total, MAX_CELLS) }, (_, step) =>
      seq.tracks.some((_, track) => seq.getCell(data, track, step))
    );
    return { cells, total, now: playheadStep(position, playing, length) };
  }
</script>

<section
  aria-label="Transport"
  class="bg-surface-900 border-surface-700 mx-4 flex items-center gap-3 rounded-2xl border p-3"
>
  <Transport {playing} {position} {dispatch} scale={song.scale} tempo={song.tempo ?? DEFAULT_BPM} />
</section>

{#if status}
  <div class="text-surface-300 flex items-center gap-2 px-5 pt-2 text-xs">{@render status()}</div>
{/if}

<div class="flex items-baseline justify-between px-5 pt-4 pb-2">
  <h1 class="text-xl font-bold">Tracks</h1>
  <span class="text-surface-300 text-xs">{song.instrumentsData.length} instruments</span>
</div>

<ul class="flex flex-col gap-2 px-4" aria-label="Tracks">
  {#each song.instrumentsData as data, index (data.id)}
    {@const color = trackColor(index)}
    {@const muted = data.state === TrackState.Muted}
    {@const soloed = data.state === TrackState.Solo}
    {@const o = overview(data)}
    {@const cueing = !!cues?.isCue(data)}
    <li
      class="flex flex-col gap-2 rounded-2xl p-2.5 pl-3 {cueing
        ? 'cue-hatch cue-edge'
        : `bg-surface-900 border ${selectedIndex === index ? 'border-surface-500' : 'border-surface-700'}`}"
      data-cue={cueing || undefined}
    >
      <div class="flex items-center gap-2.5">
        <button
          class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-label="Edit {data.name}"
          onclick={() => onSelect(index)}
        >
          <span
            class="relative flex size-10 flex-none items-center justify-center rounded-lg text-[13px] font-bold text-[#0B0C0F] {muted
              ? 'opacity-40'
              : ''}"
            style:background={color}
          >
            {trackInitials(data.name)}
            {#key activity[data.id]}
              {#if activity[data.id]}
                <span
                  class="edit-flash bg-warning-500 border-surface-900 absolute -top-1 -right-1 size-3 rounded-full border-2"
                  title="Someone else just edited this"
                ></span>
              {/if}
            {/key}
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-[15px] font-semibold">{data.name}</span>
            <span class="text-surface-300 truncate text-xs"
              >{trackKind(data.instrumentName)}{o.total ? ` · ${o.total} steps` : ''}</span
            >
          </span>
        </button>
        <button
          class="size-11 rounded-lg border text-sm font-bold {muted
            ? 'bg-warning-500 border-warning-500 text-warning-contrast-500'
            : 'bg-surface-800 border-surface-700'}"
          aria-label="Mute {data.name}"
          aria-pressed={muted}
          onclick={() => dispatch(setTrackStateCommand(data, TrackState.Muted))}>M</button
        >
        <button
          class="size-11 rounded-lg border text-sm font-bold {soloed
            ? 'bg-primary-500 border-primary-500 text-primary-contrast-500'
            : 'bg-surface-800 border-surface-700'}"
          aria-label="Solo {data.name}"
          aria-pressed={soloed}
          onclick={() => dispatch(setTrackStateCommand(data, TrackState.Solo))}>S</button
        >
      </div>
      {#if o.cells.length}
        <div
          class="grid gap-[3px]"
          style:grid-template-columns="repeat({o.cells.length}, minmax(0, 1fr))"
          aria-hidden="true"
          data-testid="mini-pattern"
        >
          {#each o.cells as on, step (step)}
            <span
              class="h-3.5 rounded-[3px] {on ? '' : 'bg-surface-800'} {o.now === step
                ? 'ring-surface-100 ring-[1.5px]'
                : ''}"
              style:background={on ? color : undefined}
              style:opacity={on && muted ? 0.35 : 1}
            ></span>
          {/each}
        </div>
      {/if}
      {#if cues && (shownSlots(data, cues.slot(data)).length > 1 || cues.othersOn(data).length)}
        <div class="flex items-center gap-2.5">
          <PatternSlots {data} {cues} {color} size="sm" onPick={() => onSelect(index)} />
          <span class="text-surface-200 min-w-0 truncate text-xs font-medium" data-testid="cue-note"
            >{cueNote(data)}</span
          >
        </div>
      {/if}
    </li>
  {:else}
    <li class="bg-surface-900 border-surface-700 space-y-3 rounded-2xl border p-6 text-center">
      <p class="text-lg">Nothing playing yet.</p>
      <button
        class="btn preset-filled-primary-500"
        onclick={() => presetCommands().forEach(dispatch)}>Start with a beat</button
      >
      <p class="text-surface-300 text-sm">Adds piano, bass and drums.</p>
    </li>
  {/each}
</ul>

<div class="px-4 pt-2">
  <button
    class="border-surface-600 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-semibold"
    onclick={onAdd}><Plus size={18} /> Add instrument</button
  >
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

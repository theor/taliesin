<script lang="ts">
  import { TrackState, type InstrumentData } from '$lib';
  import type { Dispatch, Song } from '$lib/commands';
  import type { PatternCues, SlotState } from '$lib/cues.svelte';
  import { columnHasNotes, copyPatternCommands } from '$lib/commandBuilders';
  import { hasNotes, liveSlot, MAX_PATTERNS, patternLabel, shownSlots } from '$lib/patterns';
  import { getInstrument, patternStrip } from '$lib/Store.svelte';
  import { trackColor, trackInitials } from '$lib/trackColors';
  import { ClipboardPaste, Copy, Headphones, Play, X } from '@lucide/svelte';

  /**
   * The pattern launcher: one row per track, one column per pattern slot (A, B, C...), like a clip
   * launcher. A column is a scene: launch it (every track that has notes there goes live together at the
   * next bar), cue it (hear it on this device only), or copy it onto another column. A clip launches on
   * its own with its ▶; tapping it opens it here (a cue when it is not live), and the track's name, or a
   * double click, opens it in the editor. Clips carry `data-state` like the pattern chips.
   */
  let {
    song,
    cues,
    dispatch,
    position = 0,
    playing = false,
    hostOnly = false,
    onEdit
  }: {
    song: Song;
    cues: PatternCues;
    dispatch: Dispatch;
    position?: number;
    playing?: boolean;
    /** Only the host makes sound in this jam: nothing to cue on this device. */
    hostOnly?: boolean;
    /** Open an instrument in the editor (its open slot was just picked). */
    onEdit?: (index: number) => void;
  } = $props();

  const tracks = $derived(song.instrumentsData);
  /** Every column in use or open somewhere, and one more to copy or write into. */
  const columns = $derived.by(() => {
    let n = 1;
    for (const data of tracks) n = Math.max(n, shownSlots(data, cues.slot(data)).length);
    return Array.from({ length: Math.min(n + 1, MAX_PATTERNS) }, (_, i) => i);
  });

  /** The column being copied (pick a column to paste it onto), and a paste waiting to be confirmed. */
  let copying = $state<number | undefined>();
  let confirming = $state<number | undefined>();
  const anyCue = $derived(tracks.some((d) => cues.isCue(d)));

  type ColumnState = 'live' | 'queued' | 'cue' | 'stopped' | 'empty';
  function columnState(slot: number): ColumnState {
    if (cues.columnQueued(tracks, slot)) return 'queued';
    const filled = tracks.filter((d) => hasNotes(d, slot));
    if (filled.length === 0) return 'empty';
    if (filled.every((d) => liveSlot(d) === slot)) return 'live';
    return cues.columnCued(tracks, slot) ? 'cue' : 'stopped';
  }
  const anyLive = (slot: number) => tracks.some((d) => liveSlot(d) === slot);

  function paste(to: number) {
    if (copying === undefined) return;
    if (columnHasNotes(tracks, to) && confirming !== to) {
      confirming = to; // a second tap replaces what is there
      return;
    }
    copyPatternCommands(tracks, copying, to).forEach(dispatch);
    copying = confirming = undefined;
  }
  function startCopy(slot: number) {
    copying = copying === slot ? undefined : slot;
    confirming = undefined;
  }

  const DESCRIBE: Record<SlotState, string> = {
    live: 'live',
    cue: 'cue, only you hear it',
    queued: 'live from the next bar',
    other: 'someone else is cueing it',
    stopped: 'not playing',
    empty: 'empty'
  };

  /** How far through its loop an instrument is (0..1), while playing. */
  function progress(data: InstrumentData): number | undefined {
    const length = getInstrument(data)?.getLength(data);
    if (!playing || !length || position < 0) return undefined;
    const total = length.stepsPerMeasure * length.measures;
    return total > 0 ? ((position * length.stepsPerMeasure) % total) / total : undefined;
  }

  function open(data: InstrumentData, index: number, slot: number) {
    cues.pick(data, slot);
    if (!hasNotes(data, slot)) onEdit?.(index); // an empty clip: straight to the editor to write it
  }

  const headerButton =
    'flex size-8 items-center justify-center rounded-lg border disabled:opacity-30 disabled:pointer-events-none';
</script>

<section class="flex flex-col gap-3" aria-label="Pattern launcher" data-testid="pattern-launcher">
  {#if copying !== undefined}
    <div
      class="bg-surface-900 border-surface-600 flex items-center gap-3 rounded-xl border px-3 py-2 text-sm"
      role="status"
    >
      <Copy size={16} />
      <span class="flex-1"
        >Copying column {patternLabel(copying)}: pick the column to paste it onto.</span
      >
      <button
        class="border-surface-600 h-9 rounded-lg border px-3 text-xs font-semibold"
        onclick={() => (copying = confirming = undefined)}>Cancel</button
      >
    </div>
  {:else if anyCue && !hostOnly}
    <div
      class="cue-hatch cue-edge flex items-center gap-3 rounded-xl px-3 py-2 text-sm"
      role="status"
    >
      <Headphones size={16} />
      <span class="flex-1">You are hearing cues: patterns only this device plays.</span>
      <button
        class="bg-surface-50 text-surface-950 h-9 rounded-lg px-3 text-xs font-bold"
        onclick={() => cues.uncueAll(tracks)}>Back to live</button
      >
    </div>
  {/if}

  <div class="overflow-x-auto pb-2">
    <div
      class="grid gap-1.5 [--track-col:2.25rem] sm:[--track-col:minmax(7.5rem,10rem)]"
      style:grid-template-columns="var(--track-col) repeat({columns.length}, minmax(5.5rem, 1fr))"
      role="grid"
      aria-label="Patterns"
    >
      <!-- column headers: a column is a scene -->
      <div class="contents" role="row">
        <div class="bg-surface-950 sticky left-0 z-10" role="columnheader">
          <span class="rack-label hidden px-1 sm:inline">Tracks</span>
        </div>
        {#each columns as slot (slot)}
          {@const state = columnState(slot)}
          {@const label = patternLabel(slot)}
          <div
            class="bg-surface-900 border-surface-700 flex flex-col gap-1.5 rounded-xl border p-1.5 {state ===
            'live'
              ? 'border-surface-400'
              : ''}"
            role="columnheader"
            data-testid="column"
            data-state={state}
            aria-label="Column {label}"
          >
            <span class="px-1 text-sm font-bold">{label}</span>
            {#if copying !== undefined && copying !== slot}
              <button
                class="flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-bold {confirming ===
                slot
                  ? 'bg-warning-500 text-warning-contrast-500'
                  : 'bg-surface-50 text-surface-950'}"
                aria-label={confirming === slot
                  ? `Replace column ${label}`
                  : `Paste onto column ${label}`}
                title={anyLive(slot) && confirming === slot
                  ? 'Some of these are live: everyone will hear the copy'
                  : undefined}
                onclick={() => paste(slot)}
                ><ClipboardPaste size={14} />
                {confirming === slot ? 'Replace?' : 'Paste'}</button
              >
            {:else}
              <div class="flex gap-1">
                <button
                  class="{headerButton} {state === 'queued'
                    ? 'border-primary-500 animate-pulse'
                    : 'border-surface-600'}"
                  aria-label={state === 'queued'
                    ? `Cancel the launch of column ${label}`
                    : `Launch column ${label}`}
                  title={state === 'queued'
                    ? 'Waiting for the bar (cancel)'
                    : `Launch ${label} for everyone${playing ? ' at the next bar' : ''}`}
                  disabled={state === 'empty' || state === 'live'}
                  onclick={() =>
                    state === 'queued'
                      ? cues.cancelColumn(tracks, slot)
                      : cues.launchColumn(tracks, slot)}
                  ><Play size={14} fill="currentColor" /></button
                >
                {#if !hostOnly}
                  <button
                    class="{headerButton} {state === 'cue'
                      ? 'bg-surface-50 text-surface-950 border-surface-50'
                      : 'border-surface-600'}"
                    aria-label="Cue column {label}"
                    aria-pressed={state === 'cue'}
                    title={state === 'cue'
                      ? 'Back to the live patterns'
                      : `Hear ${label} on this device only`}
                    disabled={state === 'empty' || state === 'live'}
                    onclick={() =>
                      state === 'cue' ? cues.uncueAll(tracks) : cues.cueColumn(tracks, slot)}
                    ><Headphones size={14} /></button
                  >
                {/if}
                <button
                  class="{headerButton} {copying === slot
                    ? 'bg-surface-50 text-surface-950 border-surface-50'
                    : 'border-surface-600'}"
                  aria-label={copying === slot ? 'Cancel copy' : `Copy column ${label}`}
                  aria-pressed={copying === slot}
                  title={copying === slot ? 'Cancel' : `Copy ${label} onto another column`}
                  disabled={copying !== slot && state === 'empty'}
                  onclick={() => startCopy(slot)}
                  >{#if copying === slot}<X size={14} />{:else}<Copy size={14} />{/if}</button
                >
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- one row per track -->
      {#each tracks as data, index (data.id)}
        {@const color = trackColor(index)}
        {@const now = progress(data)}
        {@const heard = cues.heard(data)}
        <div class="contents" role="row" aria-label={data.name}>
          <div class="bg-surface-950 sticky left-0 z-10 flex" role="rowheader">
            <button
              class="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1 pr-1 text-left"
              title="Edit {data.name}"
              aria-label="Edit {data.name}"
              onclick={() => onEdit?.(index)}
            >
              <span
                class="flex size-8 flex-none items-center justify-center rounded-lg text-[11px] font-bold text-[#0B0C0F] {data.state ===
                TrackState.Muted
                  ? 'opacity-40'
                  : ''}"
                style:background={color}>{trackInitials(data.name)}</span
              >
              <span class="hidden truncate text-sm font-semibold sm:inline">{data.name}</span>
            </button>
          </div>
          {#each columns as slot (slot)}
            {@const state = cues.state(data, slot)}
            {@const strip = state === 'empty' ? [] : patternStrip(data, slot)}
            {@const label = `${data.name} ${patternLabel(slot)}`}
            <div
              class="relative flex h-12 min-w-0 items-stretch overflow-hidden rounded-lg {state ===
              'live'
                ? ''
                : state === 'empty'
                  ? 'border-surface-700 border border-dashed'
                  : state === 'stopped'
                    ? 'bg-surface-800 border-surface-600 border'
                    : state === 'other'
                      ? 'bg-surface-800 border-surface-300 border-[1.5px] border-dotted'
                      : 'cue-hatch'} {state === 'cue'
                ? 'border-surface-50 border-2 border-dashed'
                : ''} {state === 'queued' ? 'animate-pulse border-2' : ''}"
              style:background={state === 'live' ? color : undefined}
              style:border-color={state === 'queued' ? color : undefined}
              data-testid="clip"
              data-state={state}
              role="gridcell"
            >
              {#if state !== 'empty'}
                <button
                  class="flex w-7 flex-none items-center justify-center {state === 'live'
                    ? 'text-[#0B0C0F]'
                    : 'text-surface-100 hover:bg-surface-700/60'}"
                  aria-label={state === 'queued'
                    ? `Cancel the launch of ${label}`
                    : state === 'live'
                      ? `${label} is live`
                      : `Launch ${label}`}
                  title={state === 'live'
                    ? 'Live: everyone hears it'
                    : state === 'queued'
                      ? 'Waiting for the bar (cancel)'
                      : `Launch for everyone${playing ? ' at the next bar' : ''}`}
                  disabled={state === 'live'}
                  onclick={() =>
                    state === 'queued' ? cues.cancelLaunch(data) : cues.launch(data, slot)}
                  ><Play size={12} fill={state === 'live' ? 'currentColor' : 'none'} /></button
                >
              {/if}
              <button
                class="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-1.5 text-left {state ===
                'empty'
                  ? 'pl-2'
                  : ''}"
                aria-label="{label}, {DESCRIBE[state]}"
                aria-pressed={cues.slot(data) === slot}
                title={state === 'empty' ? `Write ${label}` : `${label}: ${DESCRIBE[state]}`}
                onclick={() => open(data, index, slot)}
                ondblclick={() => onEdit?.(index)}
              >
                {#if state === 'empty'}
                  <span class="text-surface-500 text-xs">+</span>
                {:else}
                  <span
                    class="flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] uppercase {state ===
                    'live'
                      ? 'text-[#0B0C0F]'
                      : 'text-surface-100'}"
                  >
                    {#if state === 'cue'}<Headphones size={10} strokeWidth={2.5} />{/if}
                    {patternLabel(slot)}{state === 'queued' ? ' · next bar' : ''}
                  </span>
                  <span class="flex h-1.5 gap-px">
                    {#each strip as on, i (i)}
                      <span
                        class="h-full flex-1 rounded-[1px] {on
                          ? state === 'live'
                            ? 'bg-[#0B0C0F]/70'
                            : ''
                          : state === 'live'
                            ? 'bg-[#0B0C0F]/15'
                            : 'bg-surface-700'}"
                        style:background={on && state !== 'live' ? color : undefined}
                      ></span>
                    {/each}
                  </span>
                {/if}
              </button>
              {#if now !== undefined && (slot === liveSlot(data) || slot === heard)}
                <span
                  class="pointer-events-none absolute bottom-0 left-0 h-0.5 {state === 'live'
                    ? 'bg-[#0B0C0F]/60'
                    : 'bg-surface-50'}"
                  style:width="{now * 100}%"
                  data-testid="clip-progress"
                ></span>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <p class="text-surface-300 text-xs leading-snug">
    ▶ on a column launches it for everyone{playing ? ' at the next bar' : ''}: each track with
    notes there goes live, the others keep playing.{hostOnly
      ? ''
      : ' The headphones play a column on this device only.'} Tap a clip to open it here; tap the track
    to edit it.
  </p>
</section>

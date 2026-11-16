<script lang="ts">
  import { Instrument, type IDispatchingInstrumentViewProps } from '$lib';
  import { playheadStep } from '$lib/gesture';
  import { Recorder, type Quantize } from '$lib/recorder';
  import { getInstrument } from '$lib/Store.svelte';
  import { getGlobalContext } from '$lib/context';
  import ParamSelect from '../components/ParamSelect.svelte';

  // Tap a pad in time with the music: the note lands on the step the song is at (quantized). The
  // view only dispatches absolute `setCells` commands, through a Recorder that owns the timing.
  const { instrumentData, dispatch, position, playing, now }: IDispatchingInstrumentViewProps =
    $props();
  const instr: Instrument | undefined = $derived(getInstrument(instrumentData));
  const seq = $derived(instr?.sequencer);
  const scale = getGlobalContext() ?? { scaleKey: 'A', scaleMode: 'minor' };

  const length = $derived(instr?.getLength(instrumentData) ?? { stepsPerMeasure: 4, measures: 1 });
  const steps = $derived(length.stepsPerMeasure * length.measures);
  const nowStep = $derived(playheadStep(position ?? 0, playing ?? false, length));
  const tracks = $derived((seq?.tracks ?? []).map((track, trackIndex) => ({ track, trackIndex })));

  const RESOLUTIONS = { 'Every step': 1, 'Every 2 steps': 2, 'Every 4 steps': 4 } as const;
  let resolutionLabel = $state<string>('Every step');
  const quantize = $derived<Quantize>({
    resolution: RESOLUTIONS[resolutionLabel as keyof typeof RESOLUTIONS] ?? 1,
    mode: 'nearest'
  });

  const recorder = $derived(
    new Recorder({
      instrumentId: instrumentData.id,
      dispatch,
      // the live clock when the page provides one; the 50 ms playhead prop is only a fallback
      now: () => now?.() ?? position ?? 0,
      playing: () => playing ?? false,
      length: () => length,
      quantize: () => quantize
    })
  );

  /** The step each pad last recorded to, shown briefly so the user sees where the hit went. */
  let lastHit = $state<Record<number, number>>({});
  let flashing = $state<Record<number, boolean>>({});
  const timers: Record<number, ReturnType<typeof setTimeout>> = {};

  function press(trackIndex: number, e: PointerEvent) {
    e.preventDefault(); // no emulated mouse/click events afterwards
    const step = recorder.hit(trackIndex);
    if (step === undefined) return;
    lastHit[trackIndex] = step;
    flashing[trackIndex] = true;
    clearTimeout(timers[trackIndex]);
    timers[trackIndex] = setTimeout(() => (flashing[trackIndex] = false), 150);
  }
  const label = (track: string) => instr?.trackLabel(track, scale) ?? track;
</script>

{#if instr && seq}
  <div data-testid="record-view" class="space-y-3">
    <!-- where the song is, so you can feel the beat -->
    <div
      class="flex gap-px"
      role="img"
      aria-label={nowStep === undefined ? 'Stopped' : `Step ${nowStep + 1} of ${steps}`}
    >
      {#each { length: steps } as _, i (i)}
        <span
          class="h-2 flex-1 rounded-xs {nowStep === i
            ? 'bg-warning-500'
            : i % length.stepsPerMeasure === 0
              ? 'bg-surface-500/60'
              : 'bg-surface-500/25'}"
        ></span>
      {/each}
    </div>

    {#if !playing}
      <p class="text-center text-sm opacity-70" data-testid="record-hint">
        Press play, then tap the pads in time.
      </p>
    {/if}

    <div class="grid gap-2" style:grid-template-columns="repeat(auto-fit, minmax(5.5rem, 1fr))">
      {#each tracks as { track, trackIndex } (trackIndex)}
        <button
          type="button"
          class="btn min-h-20 flex-col gap-0 select-none {flashing[trackIndex]
            ? 'preset-filled-warning-500'
            : 'preset-filled-primary-500'}"
          style:touch-action="manipulation"
          disabled={!playing}
          aria-label="Record {label(track)}"
          onpointerdown={(e) => press(trackIndex, e)}
        >
          <span class="text-lg font-semibold">{label(track)}</span>
          <span class="text-xs opacity-80"
            >{lastHit[trackIndex] === undefined ? '' : `step ${lastHit[trackIndex] + 1}`}</span
          >
        </button>
      {/each}
    </div>

    <ParamSelect
      label="Quantize"
      bind:value={resolutionLabel}
      options={Object.keys(RESOLUTIONS)}
    />
  </div>
{:else}
  <p>Instrument not found</p>
{/if}

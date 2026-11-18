<script lang="ts">
  import { Instrument, type IDispatchingInstrumentViewProps } from '$lib';
  import { playheadStep } from '$lib/gesture';
  import { getInstrument } from '$lib/Store.svelte';
  import { getGlobalContext } from '$lib/context';
  import { LiveTake } from './liveTake.svelte';
  import TakeControls from './TakeControls.svelte';

  // Pads to play along on. They always sound (when "hear notes" is on); during a take (see `Take`)
  // each hit is also recorded on the step the song is at (quantized), as absolute `setCells` commands.
  const props: IDispatchingInstrumentViewProps = $props();
  const { instrumentData, position, playing } = $derived(props);
  const instr: Instrument | undefined = $derived(getInstrument(instrumentData));
  const seq = $derived(instr?.sequencer);
  const scale = getGlobalContext() ?? { scaleKey: 'A', scaleMode: 'minor' };

  const length = $derived(instr?.getLength(instrumentData) ?? { stepsPerMeasure: 4, measures: 1 });
  const nowStep = $derived(playheadStep(position ?? 0, playing ?? false, length));
  const tracks = $derived((seq?.tracks ?? []).map((track, trackIndex) => ({ track, trackIndex })));

  // nearest: a tap slightly before the beat lands on the beat
  const live = new LiveTake(() => props, scale, 'nearest');

  /** The step each pad last recorded to, shown so the user sees where the hit went. */
  let lastHit = $state<Record<number, number>>({});
  let flashing = $state<Record<number, boolean>>({});
  const timers: Record<number, ReturnType<typeof setTimeout>> = {};

  function press(trackIndex: number, e: PointerEvent) {
    e.preventDefault(); // no emulated mouse/click events afterwards
    live.monitor(trackIndex);
    const step = live.take.hit(trackIndex);
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
    {#if !playing}
      <p class="text-center text-sm opacity-70" data-testid="record-hint">
        Press play, then record a take and tap the pads in time.
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
          aria-label="Play {label(track)}"
          onpointerdown={(e) => press(trackIndex, e)}
        >
          <span class="text-lg font-semibold">{label(track)}</span>
          <span class="text-xs opacity-80"
            >{lastHit[trackIndex] === undefined ? '' : `step ${lastHit[trackIndex] + 1}`}</span
          >
        </button>
      {/each}
    </div>

    <TakeControls {live} playing={playing ?? false} {nowStep} />
  </div>
{:else}
  <p>Instrument not found</p>
{/if}

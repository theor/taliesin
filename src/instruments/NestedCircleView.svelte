<script lang="ts">
  import { Instrument, type IDispatchingInstrumentViewProps } from '$lib';
  import { euclid, resolveParams } from '$lib/euclid';
  import { playheadStep } from '$lib/gesture';
  import { getInstrument } from '$lib/Store.svelte';
  import { getGlobalContext } from '$lib/context';
  import ParamStepper from '../components/ParamStepper.svelte';

  // All tracks as concentric rings (a polyrhythm clock). Step `i` sits at the same angle on every
  // ring, so the spokes line the tracks up. Like the other views it only dispatches absolute
  // `setCells` commands; the steppers act on the selected ring.
  const { instrumentData, dispatch, position, playing }: IDispatchingInstrumentViewProps = $props();
  const instr: Instrument | undefined = $derived(getInstrument(instrumentData));
  const seq = $derived(instr?.sequencer);
  const scale = getGlobalContext() ?? { scaleKey: 'A', scaleMode: 'minor' };

  const length = $derived(instr?.getLength(instrumentData) ?? { stepsPerMeasure: 4, measures: 1 });
  const steps = $derived(length.stepsPerMeasure * length.measures);
  const nowStep = $derived(playheadStep(position ?? 0, playing ?? false, length));
  const tracks = $derived((seq?.tracks ?? []).map((track, trackIndex) => ({ track, trackIndex })));
  const label = (track: string) => instr?.trackLabel(track, scale) ?? track;

  const cellsOf = (trackIndex: number) =>
    Array.from({ length: steps }, (_, i) => seq!.getCell(instrumentData, trackIndex, i));

  let selected = $state(0);
  /** What the user last asked for per track; only used while it still matches the cells. */
  let asked = $state<Record<number, { pulses: number; rotation: number }>>({});

  // Rings are drawn for the tracks that have hits, plus the selected one (so an empty track can
  // be picked from the chips and filled in).
  const rings = $derived(
    tracks
      .filter(({ trackIndex }) => trackIndex === selected || cellsOf(trackIndex).some(Boolean))
      .map((t) => ({ ...t, cells: cellsOf(t.trackIndex) }))
  );
  const selectedCells = $derived(selected < tracks.length ? cellsOf(selected) : []);
  const params = $derived(resolveParams(selectedCells, asked[selected]));

  const OUTER = 46;
  const INNER = 14;
  const spacing = $derived(Math.min(8, (OUTER - INNER) / Math.max(rings.length - 1, 1)));
  const radius = (ringIndex: number) => OUTER - ringIndex * spacing;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / Math.max(steps, 1);
  const at = (i: number, r: number) => ({
    x: 50 + r * Math.cos(angle(i)),
    y: 50 + r * Math.sin(angle(i))
  });
  /** Dots shrink when rings are close together or steps are many. */
  const dotR = (r: number) =>
    Math.max(1, Math.min(spacing * 0.36, ((Math.PI * r) / steps) * 0.6, 3));
  const hitR = (r: number) => Math.max(dotR(r), Math.min(spacing / 2, (Math.PI * r) / steps / 1.2));

  function setParams(pulses: number, rotation: number) {
    asked[selected] = { pulses, rotation };
    dispatch({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: selected,
      cells: euclid(pulses, steps, rotation).map((on, step) => ({ step, on }))
    });
  }

  function toggle(trackIndex: number, step: number, on: boolean) {
    selected = trackIndex;
    dispatch({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: trackIndex,
      cells: [{ step, on: !on }]
    });
  }
</script>

{#if instr && seq}
  <div data-testid="nested-view">
    <svg
      viewBox="0 0 100 100"
      class="mx-auto aspect-square w-full max-w-md"
      role="group"
      aria-label="Nested rings"
    >
      {#each rings as ring, ringIndex (ring.trackIndex)}
        {@const r = radius(ringIndex)}
        {@const isSelected = ring.trackIndex === selected}
        <circle
          cx="50"
          cy="50"
          {r}
          fill="none"
          class={isSelected ? 'stroke-primary-500' : 'stroke-current'}
          stroke-opacity={isSelected ? 0.7 : 0.18}
          stroke-width={isSelected ? 0.6 : 0.3}
        />
      {/each}

      {#if nowStep !== undefined}
        {@const tip = at(nowStep, OUTER + 3)}
        <line
          x1="50"
          y1="50"
          x2={tip.x}
          y2={tip.y}
          class="stroke-warning-500"
          stroke-width="0.8"
          stroke-linecap="round"
          opacity="0.8"
        />
      {/if}

      {#each rings as ring, ringIndex (ring.trackIndex)}
        {@const r = radius(ringIndex)}
        {#each ring.cells as on, step (step)}
          {@const { x, y } = at(step, r)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <g
            data-x={step}
            data-y={ring.trackIndex}
            aria-label="ring-{ring.trackIndex}-{step}"
            class="cursor-pointer"
            onclick={() => toggle(ring.trackIndex, step, on)}
          >
            <circle cx={x} cy={y} r={hitR(r)} fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={dotR(r)}
              class={on ? 'fill-primary-500' : 'stroke-primary-500 fill-transparent'}
              stroke-width="0.5"
              opacity={ring.trackIndex === selected ? 1 : 0.75}
            />
          </g>
        {/each}
      {/each}

      <text x="50" y="52" text-anchor="middle" class="fill-current text-[6px] font-semibold"
        >{label(tracks[selected]?.track ?? '')}</text
      >
    </svg>

    <div class="mb-2 flex flex-wrap justify-center gap-1" role="group" aria-label="Choose a ring">
      {#each tracks as { track, trackIndex } (trackIndex)}
        <button
          class="btn btn-sm min-w-11 {trackIndex === selected
            ? 'preset-filled-primary-500'
            : cellsOf(trackIndex).some(Boolean)
              ? 'preset-tonal'
              : 'preset-outlined-surface-500'}"
          aria-pressed={trackIndex === selected}
          aria-label="Select {label(track)}"
          onclick={() => (selected = trackIndex)}>{label(track)}</button
        >
      {/each}
    </div>

    <div class="grid gap-x-6 sm:grid-cols-2">
      <ParamStepper
        label="Pulses"
        min={0}
        max={steps}
        bind:value={() => params.pulses, (p) => setParams(p, params.rotation)}
      />
      <ParamStepper
        label="Rotate"
        min={0}
        max={Math.max(0, steps - 1)}
        bind:value={() => params.rotation, (r) => setParams(params.pulses, r)}
      />
    </div>
    {#if params.custom}
      <p class="text-xs opacity-60">hand-edited: changing these resets it</p>
    {/if}
  </div>
{:else}
  <p>Instrument not found</p>
{/if}

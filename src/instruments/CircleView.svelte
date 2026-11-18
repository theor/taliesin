<script lang="ts">
  import { Instrument, type IDispatchingInstrumentViewProps } from '$lib';
  import { euclid, resolveParams } from '$lib/euclid';
  import { playheadStep } from '$lib/gesture';
  import { getInstrument } from '$lib/Store.svelte';
  import { getGlobalContext } from '$lib/context';
  import ParamStepper from '../components/ParamStepper.svelte';

  // Euclidean view of the same cells the grid edits. The view only reads state and dispatches
  // absolute `setCells` commands; the pulses/rotation are worked out from the cells, not stored.
  const { instrumentData, dispatch, position, playing }: IDispatchingInstrumentViewProps = $props();
  const instr: Instrument | undefined = getInstrument(instrumentData);
  const seq = instr?.sequencer;
  const scale = getGlobalContext() ?? { scaleKey: 'A', scaleMode: 'minor' };

  const steps = $derived(
    instr
      ? instr.getLength(instrumentData).stepsPerMeasure * instr.getLength(instrumentData).measures
      : 0
  );
  const nowStep = $derived(
    instr
      ? playheadStep(position ?? 0, playing ?? false, instr.getLength(instrumentData))
      : undefined
  );
  const tracks = $derived((seq?.tracks ?? []).map((track, trackIndex) => ({ track, trackIndex })));

  const cellsOf = (trackIndex: number) =>
    Array.from({ length: steps }, (_, i) => seq!.getCell(instrumentData, trackIndex, i));

  /** What the user last asked for on a track; only used when it still matches the cells. */
  let asked = $state<Record<number, { pulses: number; rotation: number }>>({});

  const paramsOf = (trackIndex: number, cells: boolean[]) =>
    resolveParams(cells, asked[trackIndex]);

  function setParams(trackIndex: number, pulses: number, rotation: number) {
    asked[trackIndex] = { pulses, rotation };
    const pattern = euclid(pulses, steps, rotation);
    dispatch({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: trackIndex,
      cells: pattern.map((on, step) => ({ step, on }))
    });
  }

  function toggle(trackIndex: number, step: number, on: boolean) {
    dispatch({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: trackIndex,
      cells: [{ step, on: !on }]
    });
  }

  const R = 38; // ring radius in the 100x100 viewBox
  const point = (i: number, n: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: 50 + R * Math.cos(angle), y: 50 + R * Math.sin(angle) };
  };
  /** Dots shrink as the ring fills up. */
  const dotRadius = (n: number) => Math.max(2.2, Math.min(7, (Math.PI * R) / n - 1));
</script>

{#if instr && seq}
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="circle-view">
    {#each tracks as { track, trackIndex } (trackIndex)}
      {@const cells = cellsOf(trackIndex)}
      {@const params = paramsOf(trackIndex, cells)}
      <div class="border-surface-200-800 flex items-center gap-3 rounded border p-2">
        <svg viewBox="0 0 100 100" class="size-32 flex-none" role="group" aria-label="{track} ring">
          <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" stroke-opacity="0.2" />
          {#each cells as on, step (step)}
            {@const { x, y } = point(step, steps)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <g
              data-x={step}
              data-y={trackIndex}
              aria-label="circle-{trackIndex}-{step}"
              class="cursor-pointer"
              onclick={() => toggle(trackIndex, step, on)}
            >
              <circle cx={x} cy={y} r={Math.max(dotRadius(steps) + 2, 6)} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={dotRadius(steps)}
                class={on ? 'fill-primary-500' : 'stroke-primary-500 fill-transparent'}
                stroke-width="1.5"
              />
              {#if nowStep === step}
                <circle
                  cx={x}
                  cy={y}
                  r={dotRadius(steps) + 3}
                  fill="none"
                  class="stroke-warning-500"
                  stroke-width="2"
                />
              {/if}
            </g>
          {/each}
          <text x="50" y="54" text-anchor="middle" class="fill-current text-[10px]"
            >{instr.trackLabel(track, scale)}</text
          >
        </svg>
        <div class="min-w-0 flex-1">
          <ParamStepper
            label="Pulses"
            min={0}
            max={steps}
            bind:value={() => params.pulses, (p) => setParams(trackIndex, p, params.rotation)}
          />
          <ParamStepper
            label="Rotate"
            min={0}
            max={Math.max(0, steps - 1)}
            bind:value={() => params.rotation, (r) => setParams(trackIndex, params.pulses, r)}
          />
          {#if params.custom}
            <p class="text-xs opacity-60">hand-edited: changing these resets it</p>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{:else}
  <p>Instrument not found</p>
{/if}

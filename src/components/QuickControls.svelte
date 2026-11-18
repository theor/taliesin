<script lang="ts">
  import { PartEffects, PartFilter, PartOctave, getPart, type InstrumentData } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import MacroSlider from './MacroSlider.svelte';

  /** The controls you reach for while jamming: volume, reverb, delay, filter, octave. */
  let {
    instrumentData,
    dispatch,
    columns = 'sm:grid-cols-2'
  }: { instrumentData: InstrumentData; dispatch: Dispatch; columns?: string } = $props();

  const effects = $derived(getPart(PartEffects, instrumentData));
  const octave = $derived(getPart(PartOctave, instrumentData));
  const filter = $derived(getPart(PartFilter, instrumentData));
  const setPart = (partName: string, fields: { [key: string]: number }) =>
    dispatch({ type: 'setPartFields', instrumentId: instrumentData.id, partName, fields });
</script>

<section class="grid gap-x-6 gap-y-1 {columns}" aria-label="Quick controls">
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
      onchange={(reverb) => setPart(PartEffects.id, { reverb })}
    />
    <MacroSlider
      label="Delay"
      value={effects.delay}
      onchange={(delay) => setPart(PartEffects.id, { delay })}
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
      onchange={(v) => setPart(PartFilter.id, { freq: Math.round(2 ** v) })}
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
      onchange={(v) => setPart(PartOctave.id, { octave: v })}
    />
  {/if}
</section>

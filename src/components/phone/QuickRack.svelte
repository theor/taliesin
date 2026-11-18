<script lang="ts">
  import {
    MAX_FILTER_HZ,
    MIN_FILTER_HZ,
    PartEffects,
    PartFilter,
    PartOctave,
    getPart,
    type InstrumentData
  } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import { ChevronRight } from '@lucide/svelte';
  import Knob from '../Knob.svelte';

  /**
   * Under the grid on the phone: the instrument's most-used settings as a sideways row of knob modules,
   * and a way into the full rack. Controlled: values come from the song, turns go out as commands.
   */
  let {
    instrumentData,
    dispatch,
    onOpenRack
  }: { instrumentData: InstrumentData; dispatch: Dispatch; onOpenRack: () => void } = $props();

  const effects = $derived(getPart(PartEffects, instrumentData));
  const octave = $derived(getPart(PartOctave, instrumentData));
  const filter = $derived(getPart(PartFilter, instrumentData));
  const setPart = (partName: string, fields: { [key: string]: number }) =>
    dispatch({ type: 'setPartFields', instrumentId: instrumentData.id, partName, fields });
  const hz = (v: number) => {
    const f = Math.round(2 ** v);
    return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${f}`;
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<section aria-label="Quick controls" class="flex flex-col gap-2">
  <div class="flex items-center justify-between px-1">
    <h2 class="text-[15px] font-bold">Rack</h2>
    <button
      type="button"
      class="text-surface-300 flex h-9 items-center gap-1 text-xs font-semibold"
      onclick={onOpenRack}>All modules <ChevronRight size={14} /></button
    >
  </div>
  <div class="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
    {@render module('Mix', mix)}
    {#if filter}{@render module('Filter', filterKnobs)}{/if}
    {#if effects}{@render module('Space', space)}{/if}
    <button
      type="button"
      class="border-surface-600 text-surface-300 flex w-28 flex-none snap-start flex-col items-center justify-center gap-1 rounded-2xl border border-dashed text-xs font-semibold"
      onclick={onOpenRack}><ChevronRight size={20} />All modules</button
    >
  </div>
</section>

{#snippet module(title: string, body: import('svelte').Snippet)}
  <div
    class="bg-surface-900 border-surface-700 flex w-44 flex-none snap-start flex-col gap-2 rounded-2xl border p-2.5"
  >
    <div class="flex items-center justify-between">
      <span class="text-xs font-bold tracking-[0.08em] uppercase">{title}</span>
      <span class="bg-primary-500 size-2 rounded-full" aria-hidden="true"></span>
    </div>
    <div class="grid grid-cols-2 gap-1">{@render body()}</div>
  </div>
{/snippet}

{#snippet mix()}
  <Knob
    label="Volume"
    value={instrumentData.volume}
    min={0}
    max={1}
    step={0.01}
    format={pct}
    onchange={(volume) =>
      dispatch({
        type: 'setInstrumentFields',
        instrumentId: instrumentData.id,
        fields: { volume }
      })}
  />
  {#if octave}
    <Knob
      label="Octave"
      value={octave.octave}
      min={0}
      max={8}
      step={1}
      onchange={(v) => setPart(PartOctave.id, { octave: v })}
    />
  {/if}
{/snippet}

{#snippet filterKnobs()}
  {#if filter}
    <Knob
      label="Cutoff"
      value={Math.log2(filter.freq)}
      min={Math.log2(MIN_FILTER_HZ)}
      max={Math.log2(MAX_FILTER_HZ)}
      step={0.05}
      format={hz}
      onchange={(v) => setPart(PartFilter.id, { freq: Math.round(2 ** v) })}
    />
  {/if}
{/snippet}

{#snippet space()}
  {#if effects}
    <Knob
      label="Reverb"
      value={effects.reverb ?? 0}
      min={0}
      max={1}
      step={0.05}
      format={pct}
      onchange={(reverb) => setPart(PartEffects.id, { reverb })}
    />
    <Knob
      label="Delay"
      value={effects.delay ?? 0}
      min={0}
      max={1}
      step={0.05}
      format={pct}
      onchange={(delay) => setPart(PartEffects.id, { delay })}
    />
  {/if}
{/snippet}

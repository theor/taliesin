<script lang="ts">
  import { tick } from 'svelte';
  import type { InstrumentData } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import { setControlStyle } from '$lib/controlStyle';
  import { getInstrument } from '$lib/Store.svelte';
  import { Plus, X } from '@lucide/svelte';
  import InstrumentPartView from './InstrumentPartView.svelte';
  import { addablePartGroups, partViewGroups } from './partViews';

  /**
   * The rack (phone and desktop): every part of the instrument as a module of knobs and chips, in signal order,
   * under a header per role (notes, note FX, sound, sound FX). "Add module" gives it a part it lacks.
   */
  let {
    instrumentData,
    dispatch,
    layout = 'stack'
  }: {
    instrumentData: InstrumentData;
    dispatch: Dispatch;
    /** `stack`: one module per row (phone). `grid`: modules side by side, as many columns as fit (desktop). */
    layout?: 'stack' | 'grid';
  } = $props();
  setControlStyle('rack');

  const groups = $derived(partViewGroups(instrumentData.parts));
  const addable = $derived(
    addablePartGroups(getInstrument(instrumentData)?.addableParts ?? [], instrumentData.parts)
  );

  let picking = $state(false);
  let root: HTMLElement;

  async function add(partName: string) {
    dispatch({ type: 'addPart', instrumentId: instrumentData.id, partName });
    picking = false;
    await tick();
    root
      .querySelector(`[data-part="${partName}"]`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }
</script>

<div class="flex flex-col gap-4" bind:this={root}>
  {#if layout === 'grid'}
    <!-- side by side, the modules flow in signal order; each says its role, as there is no group header -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] items-start gap-3">
      {#each groups as group (group.role)}
        {#each group.modules as { part, component } (part.partName)}
          <div data-role={group.role}>
            <InstrumentPartView
              instrumentId={instrumentData.id}
              {dispatch}
              PartComponent={component}
              partData={part}
              kicker={group.label}
            />
          </div>
        {/each}
      {/each}
    </div>
  {:else}
    {#each groups as group (group.role)}
      <section aria-label={group.label} data-role={group.role} class="flex flex-col gap-2">
        <h3 class="rack-label flex items-center gap-2 px-1">
          {group.label}
          <span class="bg-surface-800 h-px flex-1" aria-hidden="true"></span>
        </h3>
        {#each group.modules as { part, component } (part.partName)}
          <InstrumentPartView
            instrumentId={instrumentData.id}
            {dispatch}
            PartComponent={component}
            partData={part}
          />
        {/each}
      </section>
    {/each}
  {/if}
  {#if groups.length === 0}
    <p class="text-surface-300 p-4 text-sm">This instrument has no settings yet.</p>
  {/if}

  {#if addable.length > 0}
    {#if picking}
      <section
        aria-label="Add module"
        class="bg-surface-900 border-surface-700 flex flex-col gap-3 rounded-2xl border p-3 {layout ===
        'grid'
          ? 'max-w-2xl'
          : ''}"
      >
        <header class="flex items-center justify-between">
          <span class="text-xs font-bold tracking-[0.08em] uppercase">Add module</span>
          <button
            type="button"
            class="text-surface-300 -m-2 flex size-11 items-center justify-center"
            aria-label="Close"
            onclick={() => (picking = false)}><X size={18} /></button
          >
        </header>
        {#each addable as group (group.role)}
          <div class="flex flex-col gap-1.5">
            <span class="rack-label">{group.label}</span>
            <div class="flex flex-wrap gap-2">
              {#each group.parts as part (part.id)}
                <button
                  type="button"
                  class="bg-surface-800 border-surface-700 active:bg-primary-500 active:text-surface-950 flex h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold"
                  aria-label="Add {part.title}"
                  onclick={() => add(part.id)}
                >
                  <Plus size={16} aria-hidden="true" />{part.title}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </section>
    {:else}
      <button
        type="button"
        class="border-surface-700 text-surface-300 hover:text-surface-100 flex h-12 items-center {layout ===
        'grid'
          ? 'sm:w-72'
          : ''} justify-center gap-2 rounded-2xl border border-dashed text-sm font-semibold"
        onclick={() => (picking = true)}
      >
        <Plus size={18} aria-hidden="true" /> Add module
      </button>
    {/if}
  {/if}
</div>

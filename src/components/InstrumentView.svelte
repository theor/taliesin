<script lang="ts">
  import {
    PartArpeggiator,
    PartChords,
    PartEffects,
    PartFilter,
    PartOctave,
    PartSteps,
    type Constructor,
    type IDispatchingInstrumentViewProps,
    type InstrumentPartTyped,
    type IPartViewProps,
    type PartType
  } from '$lib';
  import { getInstrumentIcon } from '$lib/Store.svelte';
  import { randomizeCommands } from '$lib/commandBuilders';
  import { type Component } from 'svelte';
  import { Pane, ThemeUtils } from 'svelte-tweakpane-ui';
  import PartOctaveView from './PartOctaveView.svelte';
  import PartStepsView from './PartStepsView.svelte';
  import { Dices, SettingsIcon, SheetIcon, X } from '@lucide/svelte';
  import PianoScaleView from '../instruments/PianoScaleView.svelte';
  import PartFilterView from './PartFilterView.svelte';
  import PartEffectsView from './PartEffectsView.svelte';
  import PartChordsView from './PartChordsView.svelte';
  import PartArpView from './PartArpView.svelte';
  import InstrumentPartView from './InstrumentPartView.svelte';
  import { Switch, Tabs } from '@skeletonlabs/skeleton-svelte';
  let { index, instrumentData = $bindable(), dispatch }: IDispatchingInstrumentViewProps = $props();

  let Icon = getInstrumentIcon(instrumentData.instrumentName);

  $effect(() => {
    console.log('InstrumentView c', instrumentData.parts);
    // console.log('InstrumentView index', index);
  });
  let group = $state(false);
</script>

<div class="card preset-outlined-surface-200-800 bg-surface-50-950 space-y-1 p-2">
  <header
    class="card-header instrument-header border-primary-500 flex flex-row justify-between border-b-2"
  >
    <span class="mb-2 flex gap-2"><Icon size="24" /> {instrumentData.instrumentName}</span>
    <Switch
      checked={group}
      onCheckedChange={() => (group = !group)}
      label={group ? 'Effects' : 'Notes'}
    >
      {#snippet activeChild()}<SettingsIcon size="14" />{/snippet}
      {#snippet inactiveChild()}<SheetIcon size="14" />{/snippet}
    </Switch>
  </header>
  {#if group}
    {#snippet renderOptionalPart(
      partType: Constructor<InstrumentPartTyped<any>>,
      component: Component<IPartViewProps<any>>
    )}
      {#each instrumentData.parts as part, partIndex}
        {#if part.partName === partType.name}
          <InstrumentPartView
            instrumentId={instrumentData.id}
            {dispatch}
            PartComponent={component as Component<IPartViewProps<InstrumentPartTyped<any>>>}
            partData={instrumentData.parts[partIndex] as PartType<InstrumentPartTyped<any>>}
          />
        {/if}
      {/each}
    {/snippet}
    <!-- {#key index} -->
    <!-- {#key group} -->
    {@render renderOptionalPart(PartChords, PartChordsView)}
    {@render renderOptionalPart(PartArpeggiator, PartArpView)}
    {@render renderOptionalPart(PartFilter, PartFilterView)}
    {@render renderOptionalPart(PartOctave, PartOctaveView)}
    {@render renderOptionalPart(PartSteps, PartStepsView)}
    {@render renderOptionalPart(PartEffects, PartEffectsView)}
    <!-- {/key} -->
    <!-- {/key} -->
    <button aria-label="Randomize" class="btn preset-filled mr-4 px-2 py-1" onclick={() => randomizeCommands(instrumentData).forEach(dispatch)}
      ><Dices size={16} /></button
    >

    <button
      aria-label="Remove instrument"
      class="btn btn-xs preset-outlined-error-500 rounded-lg px-2 py-1"
      onclick={() => dispatch({ type: 'removeInstrument', instrumentId: instrumentData.id })}><X size="16" /></button
    >
  {:else}
    <PianoScaleView bind:instrumentData {index} {dispatch} />
  {/if}
</div>

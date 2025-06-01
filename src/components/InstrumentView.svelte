<script lang="ts">
  import { PartArpeggiator, PartChords, PartEffects, PartFilter, PartOctave, PartSteps, type  Constructor,type IInstrumentViewProps,type InstrumentPartTyped,type IPartViewProps, type PartType } from '$lib';
  import { getInstrumentIcon, getPartType, store } from '$lib/Store.svelte';
    import { type Component } from 'svelte';
    import { Pane, ThemeUtils } from 'svelte-tweakpane-ui';
    import PartOctaveView from './PartOctaveView.svelte';
    import PartStepsView from './PartStepsView.svelte';
    import { Dices, X } from '@lucide/svelte';
    import PianoScaleView from '../instruments/PianoScaleView.svelte';
    import PartFilterView from './PartFilterView.svelte';
    import PartEffectsView from './PartEffectsView.svelte';
    import PartChordsView from './PartChordsView.svelte';
    import PartArpView from './PartArpView.svelte';
    import InstrumentPartView from './InstrumentPartView.svelte';
  let { index, instrumentData = $bindable() }: IInstrumentViewProps = $props();
  
  let Icon = getInstrumentIcon(instrumentData.instrumentName);

  $effect(() => {
    console.log('InstrumentView c', instrumentData.parts);
    // console.log('InstrumentView index', index);
  });
</script>

<div class="card preset-outlined-surface-200-800 bg-surface-50-950 space-y-1 p-2">
  <header class="card-header instrument-header flex justify-between flex-col">
    <span class="border-primary-500 mb-2 flex gap-2 border-b-2"
      ><Icon size="24" /> {instrumentData.instrumentName}</span
    >
    <div class="flex gap-2 portrait:flex-col">
      {#snippet renderOptionalPart<TPart extends InstrumentPartTyped<any>>(
        partType: Constructor<TPart>,
        component: Component<IPartViewProps<TPart>>
      )}
        {#each instrumentData.parts as part, partIndex}
          {#if part.partName === partType.name}
            <InstrumentPartView
            instrumentIndex={index}
            instrumentData={instrumentData}
            {partIndex}
              PartComponent={component as Component<IPartViewProps<InstrumentPartTyped<any>>>}
              bind:partData={instrumentData.parts[partIndex] as PartType<TPart>}/>
            
          {/if}
        {/each}
      {/snippet}

      {#key index}
      {@render renderOptionalPart(PartChords, PartChordsView)}
      {@render renderOptionalPart(PartArpeggiator, PartArpView)}
      {@render renderOptionalPart(PartFilter, PartFilterView)}
      {@render renderOptionalPart(PartOctave, PartOctaveView)}
      {@render renderOptionalPart(PartSteps, PartStepsView)}
      {@render renderOptionalPart(PartEffects, PartEffectsView)}
      {/key}
      <button class="btn preset-filled mr-4 px-2 py-1" onclick={() => store.randomize(index)}
        ><Dices size={16} /></button
      >

      <button
        class="btn btn-xs preset-outlined-error-500 rounded-lg px-2 py-1"
        onclick={() => store.removeInstrument(index)}><X size="16" /></button
      >
    </div>
  </header>

  <PianoScaleView bind:instrumentData={instrumentData} {index} />
</div>

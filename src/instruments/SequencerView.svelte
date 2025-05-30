<script lang="ts">
  import { store, Instrument, type IInstrumentViewProps } from '$lib';
  import { getInstrument } from '$lib/Store.svelte';
    import { Progress } from '@skeletonlabs/skeleton-svelte';
    import { derived } from 'svelte/store';

  const { index, instrumentData = $bindable() }: IInstrumentViewProps = $props();
  const instr: Instrument | undefined = getInstrument(instrumentData);
  const seq = instr?.sequencer!;

  const buttonClassOn = 'preset-filled-primary-500';
  const buttonClassOff = 'preset-outlined-primary-500';
  const buttonClassOnOdd = 'preset-filled-tertiary-500';
  const buttonClassOffOdd = 'preset-outlined-tertiary-500';
  let progress = derived(instr?.progress(instrumentData)!, (x:number) => x!*100)!;

  $effect(() => {
    // console.log('SEQ instrumentData', instrumentData);
    // if (instr) {
    // 	instrumentData.notes = instr.getNotes(instrumentData);
    // }
  });

  function toggleCell(track: number, i: number): any {
    seq.setCell(instrumentData, track, i, !seq.getCell(instrumentData, track, i));
    store.setInstrument(index, instrumentData);
  }
</script>

{#if instr}
  {@const length = instr.getLength(instrumentData)}
  <div class="flex flex-1 my-4 ml-6">
  <Progress classes="" value={$progress} max={100} />
</div>

  <div class="flex flex-col gap-1">
    {#each seq.tracks as track, index}
      <div class="flex flex-row gap-1">
        <div class="mr-1 w-4 flex-none">{track}</div>
        {#each { length: length.measures * length.stepsPerMeasure }, i}
          {@const cell = seq.getCell(instrumentData, index, i)}
          {@const odd = Math.floor(i / length.stepsPerMeasure) % 2 === 1}
          <button
            aria-label="seq-{index}-{i}"
            onclick={() => toggleCell(index, i)}
            class="btn flex-1 {cell
              ? odd
                ? buttonClassOnOdd
                : buttonClassOn
              : odd
                ? buttonClassOffOdd
                : buttonClassOff}"
          ></button>
        {/each}
      </div>
    {/each}
  </div>
{:else}
  <p>Instrument not found</p>
{/if}

<script lang="ts">
  import { store, type IInstrument, type IInstrumentViewProps } from '$lib';
  import { getInstrument } from '$lib/Store.svelte';

  const props: IInstrumentViewProps = $props();
  const instrumentData = $state.snapshot(props.instrumentData);
  const instr: IInstrument | undefined = getInstrument(instrumentData);
  const seq = instr?.sequencer!;

  const buttonClassOn = 'preset-filled-primary-500';
  const buttonClassOff = 'preset-outlined-primary-500';

  $effect(() => {
    console.log('SEQ instrumentData', instrumentData);
    // if (instr) {
    // 	instrumentData.notes = instr.getNotes(instrumentData);
    // }
  });

  function toggleCell(track: number, i: number): any {
    seq.setCell(instrumentData, track, i, !seq.getCell(instrumentData, track, i));
    // let track = instrumentData.notes[track as DrumNote];
    // if (track) {
    // 	const cell = track[i];
    // 	if (cell === 1) {
    // 		track[i] = 0;
    // 	} else {
    // 		track[i] = 1;
    // 	}
    // }
    // else {
    //     track = new Array(8).fill(0);
    //     track[i] = 1;
    // }
    // 	instrumentData.notes[track as DrumNote] = track;
    //     console.log(instrumentData.notes);
    store.setInstrument(props.index, instrumentData);
  }
</script>

{#if instr}
  {@const length = instr.getLength(instrumentData)}
  <div class="flex flex-col gap-1">
    {#each seq.tracks as track, index}
      <div class="flex flex-row gap-1">
        <div class="mr-1 w-4 flex-none">{track}</div>
        {#each { length: length.measures * length.stepsPerMeasure }, i}
          {@const cell = seq.getCell(instrumentData, index, i)}
          <button
            aria-label="seq-{index}-{i}"
            onclick={() => toggleCell(index, i)}
            class="btn flex-1 {cell ? buttonClassOn : buttonClassOff}"
          ></button>
        {/each}
      </div>
    {/each}
  </div>
{:else}
  <p>Instrument not found</p>
{/if}

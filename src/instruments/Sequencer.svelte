<script lang="ts">
	import {
		getInstrument,
		store,
		type IInstrument,
		type IInstrumentViewProps
	} from '$lib';

	const props: IInstrumentViewProps = $props();
	const instrumentData = $state.snapshot(props.instrumentData);
	const instr: IInstrument | undefined = getInstrument(instrumentData);
    const seq = instr?.sequencer!;

	const buttonClassOn = 'preset-filled-primary-500';
    const buttonClassOff = 'preset-outlined-primary-500';

	function toggleCell(track: number, i: number): any {
        seq.setCell(instrumentData,track, i, !seq.getCell(instrumentData, track, i));
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
	<div class="flex flex-col gap-1">
		{#each seq.tracks as track, index}
			
			<div class="flex flex-row gap-1">
				<div class="w-4 mr-1 flex-none">{track}</div>
				{#each { length: 8 }, i}
					{@const cell = seq.getCell(instrumentData,index, i)}
					<button aria-label="seq-{index}-{i}" onclick={() => toggleCell(index, i)} class="btn flex-1 {cell ? buttonClassOn : buttonClassOff}" ></button>
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<p>Instrument not found</p>
{/if}

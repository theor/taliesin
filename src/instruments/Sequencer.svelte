<script lang="ts">
	import {
		DrumNote,
		getInstrument,
		store,
		type DrumData,
		type IInstrument,
		type IInstrumentViewProps
	} from '$lib';

	const props: IInstrumentViewProps = $props();
	const instrumentData = $state.snapshot(props.instrumentData);
	const instr: IInstrument | undefined = getInstrument(instrumentData);
    const seq = instr?.sequencer!;

	const buttonClassOn = 'preset-filled-primary-500';
    const buttonClassOff = 'preset-outlined-primary-500';

	function toggleCell(note: string, i: number): any {
        seq.setCell(instrumentData,note, i, !seq.getCell(instrumentData, note, i));
		// let track = instrumentData.notes[note as DrumNote];
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
		// 	instrumentData.notes[note as DrumNote] = track;
        //     console.log(instrumentData.notes);
            store.setInstrument(props.index, instrumentData);
	}
</script>

{#if instr}
	<div class="flex flex-col gap-1">
		{#each seq.tracks() as track, index}
			
			<div class="flex flex-row gap-1">
				<div class="w-4 mr-1 flex-none">{track}</div>
				{#each { length: 8 }, i}
					{@const cell = seq.getCell(instrumentData,track, i)}
					<a aria-label="seq-{index}-{i}" role="application" onclick={() => toggleCell(track, i)} class="btn flex-1 {cell ? buttonClassOn : buttonClassOff}" />
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<p>Instrument not found</p>
{/if}

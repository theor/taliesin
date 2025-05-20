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
	const instrumentData = $state.snapshot(props.instrumentData as DrumData);
	const instr: IInstrument | undefined = getInstrument(instrumentData);

	const buttonClasses = {
		1: 'preset-filled-primary-500',
		0: 'preset-outlined-surface-200-800'
	};

	function toggleCell(note: string, i: number): any {
		let track = instrumentData.notes[note as DrumNote];
		if (track) {
			const cell = track[i];
			if (cell === 1) {
				track[i] = 0;
			} else {
				track[i] = 1;
			}
		}
        else {
            track = new Array(8).fill(0);
            track[i] = 1;
        }
			instrumentData.notes[note as DrumNote] = track;
            console.log(instrumentData.notes);
            store.setInstrument(props.index, instrumentData);
            // store.instrumentsData[props.index].notes[note as DrumNote] = track;
            
			// store.setInstrumentPartial(props.index, instrumentData);
	}
</script>

{#if instr}
	<div class="flex flex-col gap-1">
		{#each instr.notes as note, index}
			{@const notes = instrumentData.notes[note as DrumNote]}
			<div class="flex flex-row gap-1">
				<div class="w-14 flex-none">{note}</div>
				{#each { length: 8 }, i}
					{@const cell = notes ? notes[i] : undefined}
					<a onclick={() => toggleCell(note, i)} class="btn flex-1 {buttonClasses[cell ?? 0]}" />
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<p>Instrument not found</p>
{/if}

<script lang="ts">
	import {
	getInstrument,
	store,
		type IInstrument,
		type IInstrumentData,
		type IInstrumentViewProps,
		type PianoScaleData
	} from '$lib';
	import Sequencer from './Sequencer.svelte';

	const props: IInstrumentViewProps = $props();
	let instrumentData = props.instrumentData as PianoScaleData;
	const instr: IInstrument | undefined = getInstrument(instrumentData);
	const seq = instr?.sequencer;
	let rnd = () => {
		const notes = instrumentData.notes.map(() => {
			return Math.floor(7 + Math.random() * 7);
		});
		// store.setInstrumentData(instrumentData, props.index, { notes});
		// $commands.commands.push({
		// 	name: 'setData',
		// 	index: props.index,

		// 	value: {
		// 		notes,
		// 	}
		// });
		// instrumentData.notes = notes;
	};
</script>

<div>
	<h2>{instrumentData.instrumentName}</h2>
	<!--     <pre>
        {instrument.generate()}
    </pre> -->
	<p>notes: {instrumentData.notes.length}</p>
	<pre>data: {JSON.stringify(instrumentData)}</pre>
	<button class="btn preset-filled my-4" onclick={rnd}>Randomize</button>
	{#if seq}
	<Sequencer instrumentData={instrumentData} index={props.index} />
	{/if}
</div>

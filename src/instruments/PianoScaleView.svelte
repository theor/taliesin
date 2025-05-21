<script lang="ts">
	import {
	getInstrument,
	store,
		type IInstrument,
		type IInstrumentData,
		type IInstrumentViewProps,
		type PianoScaleData
	} from '$lib';
	import { getGlobalContext } from '$lib/context';
	import Sequencer from './Sequencer.svelte';

	const ctx = getGlobalContext();

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
	<!--     <pre>
        {instrument.generate()}
    </pre> -->
	{#if ctx.debug}
	<p>notes: {instrumentData.notes.length}</p>
	<pre class="whitespace-normal">data: {JSON.stringify(instrumentData)}</pre>
	{/if}
	{#if seq}
	<Sequencer instrumentData={instrumentData} index={props.index} />
	{/if}
</div>

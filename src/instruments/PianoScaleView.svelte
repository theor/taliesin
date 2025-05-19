<script lang="ts">
	import {
	store,
		type IInstrumentData,
		type IInstrumentViewProps,
		type PianoScaleData
	} from '$lib';

	const props: IInstrumentViewProps = $props();
	let instrumentData = props.instrumentData as PianoScaleData;

	let rnd = () => {
		const notes = instrumentData.notes.map(() => {
			return Math.floor(7 + Math.random() * 7);
		});
		store.setInstrumentData(instrumentData, props.index, { notes});
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
	<pre>data: {JSON.stringify(instrumentData)}</pre>
	<button onclick={rnd}>Randomize</button>
</div>

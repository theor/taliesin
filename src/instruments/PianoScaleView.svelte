<script lang="ts">
	import {
	getInstrument,
	store,
		type IInstrument,
		type IInstrumentViewProps,
	} from '$lib';
	import { getGlobalContext } from '$lib/context';
	import Sequencer from './Sequencer.svelte';

	const ctx = getGlobalContext();

	const props: IInstrumentViewProps = $props();
	let instrumentData = props.instrumentData;
	const instr: IInstrument | undefined = getInstrument(instrumentData);
	const seq = instr?.sequencer;

</script>

<div>
	<!--     <pre>
        {instrument.generate()}
    </pre> -->
	{#if ctx.debug}
	<!-- <p>notes: {instrumentData.notes.length}</p> -->
	<pre class="whitespace-normal">data: {JSON.stringify(instrumentData)}</pre>
	{/if}
	{#if seq}
	<Sequencer instrumentData={instrumentData} index={props.index} />
	{/if}
</div>

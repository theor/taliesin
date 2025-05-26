<script lang="ts">
	import {
		type IInstrument,
		type IInstrumentViewProps,
	} from '$lib';
	import { getGlobalContext } from '$lib/context';
    import { getInstrument } from '$lib/Store.svelte';
	import SequencerView from './SequencerView.svelte';

	const ctx = getGlobalContext();

	let {index, instrumentData = $bindable()}: IInstrumentViewProps = $props();

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
	<!-- TODO should not be keyed -->
	{#key index}
	<SequencerView bind:instrumentData={instrumentData} index={index} />
	{/key}
	{/if}
</div>

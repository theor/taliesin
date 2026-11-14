<script lang="ts">
	import {
		Instrument,
		type IDispatchingInstrumentViewProps,
	} from '$lib';
	import { getGlobalContext } from '$lib/context';
    import { getInstrument } from '$lib/Store.svelte';
	import SequencerView from './SequencerView.svelte';

	let {index, instrumentData = $bindable(), dispatch}: IDispatchingInstrumentViewProps = $props();

	const instr: Instrument | undefined = getInstrument(instrumentData);
	const seq = instr?.sequencer;
	

</script>

<div>
	{#if seq}
	<!-- TODO should not be keyed ? at least index is better than instrument data -->
	{#key index}
	<SequencerView bind:instrumentData={instrumentData} index={index} {dispatch} />
	{/key}
	{/if}
</div>

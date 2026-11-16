<script lang="ts">
	import type { IPartViewProps, PartFilter } from '$lib';
	import ParamSlider from './ParamSlider.svelte';

	const { partData = $bindable() }: IPartViewProps<PartFilter> = $props();
	let logVal = $state(Math.log2(partData.freq));
	$effect(() => {
		partData.freq = Math.pow(2, logVal);
	});
</script>

<ParamSlider
	bind:value={logVal}
	min={0}
	max={14}
	step={0.1}
	label="Filter"
	format={(e) => Math.pow(2, e).toFixed() + 'hz'}
/>

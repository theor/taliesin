<script lang="ts">
	import type { IPartViewProps, PartFilter } from '$lib';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
    import { Slider, Wheel } from 'svelte-tweakpane-ui';
	// import { type Component } from 'svelte';

	const { partData = $bindable()  }: IPartViewProps<PartFilter> = $props();
	let logVal = $state(Math.log2(partData.freq));
	$effect(() => {
		partData.freq = Math.pow(2, logVal);
	})
</script>

<!-- on:change={onPartChanged}  -->
<Wheel bind:value={logVal} min={0} max={14} step={0.1} label="Filter" format={e => Math.pow(2, e).toFixed() + "hz"}  />
<!-- <span>octave {part.octave}</span>
{@render btnSnippet(ChevronUp, onPartChanged(() => part.octave++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.octave--))} -->

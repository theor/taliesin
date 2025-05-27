<script lang="ts">
	import type { IPartViewProps, PartEffects } from '$lib';
	import { Slider } from 'svelte-tweakpane-ui';
	// import { type Component } from 'svelte';

	const { part }: IPartViewProps<PartEffects> = $props();
	// $effect(() => {
	// 	console.log('PartEffectsView c', part);
	// });
	
</script>

<Slider bind:value={part.data.delay} min={0} max={1} step={0.05} label="Delay"  />
<Slider bind:value={part.data.reverb} min={0} max={1} step={0.05} label="Reverb"  />

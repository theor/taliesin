<script lang="ts">
	import type { IPartViewProps, PartEffects } from '$lib';
	import { Slider } from 'svelte-tweakpane-ui';
	// import { type Component } from 'svelte';

	const { partData}: IPartViewProps<PartEffects> = $props();
	// $effect(() => {
	// 	console.log('PartEffectsView c', part);
	// });
	
</script>

<Slider bind:value={partData.delay} min={0} max={1} step={0.05} label="Delay"  />
<Slider bind:value={partData.reverb} min={0} max={1} step={0.05} label="Reverb"  />
<Slider bind:value={partData.chorus} min={0} max={.5} step={0.05} label="Chorus"  />

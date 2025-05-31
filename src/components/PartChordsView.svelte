<script lang="ts">
	import { VoicingMode, type IPartViewProps, type PartChords } from '$lib';
	import { Checkbox, Slider,List, type ListOptions } from 'svelte-tweakpane-ui';
	// import { type Component } from 'svelte';

	const { part,partData }: IPartViewProps<PartChords> = $props();
	// $effect(() => {
	// 	console.log('PartEffectsView c', part);
	// });
	const options: ListOptions<string> =VoicingMode;
</script>

<Checkbox bind:value={partData.enabled} label="Enabled"  />
<List bind:value={partData.mode as string} label="Chords" {options}/>
	
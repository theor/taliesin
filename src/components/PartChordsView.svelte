<script lang="ts">
	import { VoicingMode, type IPartViewProps, type PartChords } from '$lib';
	import { Checkbox, Slider,List, type ListOptions } from 'svelte-tweakpane-ui';
	// import { type Component } from 'svelte';

	const { part }: IPartViewProps<PartChords> = $props();
	// $effect(() => {
	// 	console.log('PartEffectsView c', part);
	// });
	const options: ListOptions<string> =VoicingMode;
</script>

<Checkbox bind:value={part.data.enabled} label="Enabled"  />
<List bind:value={part.data.mode as string} label="Chords" {options}/>
	
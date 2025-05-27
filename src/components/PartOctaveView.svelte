<script lang="ts">
	import type { IPartViewProps, PartOctave } from '$lib';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
    import { Slider } from 'svelte-tweakpane-ui';
	// import { type Component } from 'svelte';

	const { part = $bindable()  }: IPartViewProps<PartOctave> = $props();
</script>

<!-- on:change={onPartChanged}  -->
<Slider bind:value={part.data.octave} min={0} max={8} step={1} label="Octave"  />
<!-- <span>octave {part.octave}</span>
{@render btnSnippet(ChevronUp, onPartChanged(() => part.octave++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.octave--))} -->

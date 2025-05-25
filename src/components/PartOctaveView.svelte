<script lang="ts">
	import type { IPartViewProps, PartOctave } from '$lib';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	// import { type Component } from 'svelte';

	const { part, btnSnippet,onPartChanged }: IPartViewProps<PartOctave> = $props();
</script>

<span>octave {part.octave}</span>
<!-- {#snippet btn(a:Component,onclick: () => void)}
	{@const IconComp = a}
    <button {onclick}>
		<IconComp size={16} />
	</button>
{/snippet} -->
{@render btnSnippet(ChevronUp, onPartChanged(() => part.octave++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.octave--))}

<script lang="ts">
	import type { IPartPartialViewProps, Steps } from '$lib';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	// import { type Component } from 'svelte';

	const { part, btnSnippet }: IPartPartialViewProps<Steps> = $props();
</script>

<span>steps {part.stepsPerMeasure} x {part.measures}</span>
<!-- {#snippet btn(a:Component,onclick: () => void)}
	{@const IconComp = a}
    <button {onclick}>
		<IconComp size={16} />
	</button>
{/snippet} -->
{@render btnSnippet(ChevronUp, () => part.stepsPerMeasure++)}
{@render btnSnippet(ChevronDown, () => part.stepsPerMeasure--)}

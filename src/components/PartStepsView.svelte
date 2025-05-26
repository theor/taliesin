<script lang="ts">
	import type { IPartViewProps, PartSteps } from '$lib';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
    import { Stepper } from 'svelte-tweakpane-ui';
	// import { type Component } from 'svelte';

	const { part , btnSnippet,onPartChanged }: IPartViewProps<PartSteps> = $props();
	$effect(() => {
		console.log('PartStepsView c', part);
	});
	function formatSteps(value: number): string {
		return (1 << value).toString();
	}
</script>

<Stepper bind:value={part.stepsPerMeasure} min={1} max={16} step={1} label="Steps per measure" format={formatSteps}  />
<Stepper bind:value={part.measures} min={1} max={16} step={1} label="Measures" format={formatSteps}  />
<!-- {@render btnSnippet(ChevronUp, onPartChanged(() => part.stepsPerMeasure++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.stepsPerMeasure--))}
{@render btnSnippet(ChevronUp, onPartChanged(() => part.measures++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.measures--))} -->

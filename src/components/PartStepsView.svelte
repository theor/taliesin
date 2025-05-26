<script lang="ts">
	import type { IPartViewProps, PartSteps } from '$lib';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
    import { Checkbox, Slider, Stepper } from 'svelte-tweakpane-ui';
	// import { type Component } from 'svelte';

	const { part }: IPartViewProps<PartSteps> = $props();
	// $effect(() => {
	// 	console.log('PartStepsView c', part);
	// });
	function formatSteps(value: number): string {
		return  (part.oddSignature ? value.toString() : (1 << value).toString()) + "#";
	}


    function getSteps(): number {
		return part.oddSignature ? part.stepsPerMeasure : Math.log2(part.stepsPerMeasure);
    }
	function setSteps(value: number): void {
		if (part.oddSignature) {
			part.stepsPerMeasure = value;
		} else {
			value = 1 << value;
		}
		part.stepsPerMeasure = value;
	}
</script>

<Checkbox bind:value={part.oddSignature} label="Odd signature" />
<Stepper bind:value={getSteps, setSteps} min={part.oddSignature ? 1 : 0} max={16} step={1} label="Steps per measure" format={formatSteps}  />
<!-- <Slider bind:value={getSteps, setSteps} min={part.oddSignature ? 1 : 0} max={16} step={1} label="Steps per measure" format={e => "asde"}  /> -->
<Stepper bind:value={part.measures} min={1} max={16} step={1} label="Measures"  />
<!-- {@render btnSnippet(ChevronUp, onPartChanged(() => part.stepsPerMeasure++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.stepsPerMeasure--))}
{@render btnSnippet(ChevronUp, onPartChanged(() => part.measures++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.measures--))} -->

<script lang="ts">
	import { strudel, type IPartViewProps, type PartSteps } from '$lib';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
    import { Checkbox, Slider, Stepper } from 'svelte-tweakpane-ui';
    import { derived } from 'svelte/store';
	// import { type Component } from 'svelte';

	const props: IPartViewProps<PartSteps> = $props();
	const part = props.partData;// $state.snapshot(props.part);
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
	let time = derived(strudel.time, x => props.part.time(part, x));// derived(strudel.time, (x:number) => (x/part.measures) %1);
	console.warn('steps', part)
</script>

<Checkbox bind:value={part.oddSignature} label="Odd signature" />
<Stepper bind:value={getSteps, setSteps} min={part.oddSignature ? 1 : 0} max={16} step={1} label="Steps per measure" format={formatSteps}  />
<!-- <Slider bind:value={getSteps, setSteps} min={part.oddSignature ? 1 : 0} max={16} step={1} label="Steps per measure" format={e => "asde"}  /> -->
<Stepper bind:value={part.measures} min={0} max={16} step={1} label="Measures"  />
<Slider disabled value={$time} min={0} max={1} step={0.01} label="Progress"/>
<!-- {@render btnSnippet(ChevronUp, onPartChanged(() => part.stepsPerMeasure++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.stepsPerMeasure--))}
{@render btnSnippet(ChevronUp, onPartChanged(() => part.measures++))}
{@render btnSnippet(ChevronDown, onPartChanged(() => part.measures--))} -->

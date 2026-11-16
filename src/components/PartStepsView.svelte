<script lang="ts">
	import { type IPartViewProps, type PartSteps } from '$lib';
	import ParamStepper from './ParamStepper.svelte';
	import ParamToggle from './ParamToggle.svelte';

	const { partData = $bindable() }: IPartViewProps<PartSteps> = $props();
	function formatSteps(value: number): string {
		return (partData.oddSignature ? value.toString() : (1 << value).toString()) + '#';
	}

	function getSteps(): number {
		return partData.oddSignature ? partData.stepsPerMeasure : Math.log2(partData.stepsPerMeasure);
	}
	function setSteps(value: number): void {
		if (partData.oddSignature) {
			partData.stepsPerMeasure = value;
		} else {
			value = 1 << value;
		}
		partData.stepsPerMeasure = value;
	}
</script>

<ParamToggle bind:value={partData.oddSignature} label="Odd signature" />
<ParamStepper
	bind:value={getSteps, setSteps}
	min={partData.oddSignature ? 1 : 0}
	max={16}
	step={1}
	label="Steps per measure"
	format={formatSteps}
/>
<ParamStepper bind:value={partData.measures} min={0} max={16} step={1} label="Measures" />

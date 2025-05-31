<script lang="ts">
	import { type IPartViewProps, type PartSteps } from '$lib';
	import { Checkbox, Stepper } from 'svelte-tweakpane-ui';

	const {partData = $bindable()}: IPartViewProps<PartSteps> = $props();
	function formatSteps(value: number): string {
		return  (partData.oddSignature ? value.toString() : (1 << value).toString()) + "#";
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
	// let time = derived(strudel.time, x => props.partData.time(part, x));// derived(strudel.time, (x:number) => (x/partData.measures) %1);
	// console.warn('steps', part)
</script>

<Checkbox bind:value={partData.oddSignature} label="Odd signature" />
<Stepper bind:value={getSteps, setSteps} min={partData.oddSignature ? 1 : 0} max={16} step={1} label="Steps per measure" format={formatSteps}  />
<Stepper bind:value={partData.measures} min={0} max={16} step={1} label="Measures"  />
<!-- <Slider disabled value={$time} min={0} max={1} step={0.01} label="Progress"/> -->

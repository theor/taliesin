<script lang="ts">
  import { MAX_MEASURES, MAX_STEPS_PER_MEASURE, type IPartViewProps, type PartSteps } from '$lib';
  import ParamStepper from './ParamStepper.svelte';
  import ParamToggle from './ParamToggle.svelte';

  const { partData = $bindable() }: IPartViewProps<PartSteps> = $props();

  // Odd signatures step through every count; even ones through powers of two (shown as the count).
  const getSteps = () =>
    partData.oddSignature
      ? partData.stepsPerMeasure
      : Math.round(Math.log2(partData.stepsPerMeasure));
  const setSteps = (v: number) => (partData.stepsPerMeasure = partData.oddSignature ? v : 2 ** v);
  const formatSteps = (v: number) => `${partData.oddSignature ? v : 2 ** v}#`;
</script>

<ParamToggle bind:value={partData.oddSignature} label="Odd signature" />
<ParamStepper
  bind:value={getSteps, setSteps}
  min={partData.oddSignature ? 1 : 0}
  max={partData.oddSignature ? 16 : Math.log2(MAX_STEPS_PER_MEASURE)}
  step={1}
  label="Steps per measure"
  format={formatSteps}
/>
<ParamStepper bind:value={partData.measures} min={1} max={MAX_MEASURES} step={1} label="Measures" />

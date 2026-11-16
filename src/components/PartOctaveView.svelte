<script lang="ts">
	import type { IPartViewProps, PartOctave } from '$lib';
	import ParamStepper from './ParamStepper.svelte';

	const { partData = $bindable() }: IPartViewProps<PartOctave> = $props();
</script>

<ParamStepper bind:value={partData.octave} min={0} max={8} step={1} label="Octave" />

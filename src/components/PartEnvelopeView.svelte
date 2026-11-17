<script lang="ts">
	import type { IPartViewProps, PartEnvelope } from '$lib';
	import ParamSlider from './ParamSlider.svelte';

	const { partData }: IPartViewProps<PartEnvelope> = $props();
	const secs = (v: number) => `${v}s`;
</script>

<ParamSlider bind:value={partData.attack} min={0} max={1} step={0.005} label="Attack" format={secs} />
<ParamSlider bind:value={partData.decay} min={0} max={2} step={0.05} label="Decay" format={secs} />
<ParamSlider bind:value={partData.sustain} min={0} max={1} step={0.05} label="Sustain" />
<ParamSlider bind:value={partData.release} min={0} max={2} step={0.05} label="Release" format={secs} />

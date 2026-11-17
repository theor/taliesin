<script lang="ts">
	import type { IPartViewProps, PartFm } from '$lib';
	import ParamSlider from './ParamSlider.svelte';

	const { partData }: IPartViewProps<PartFm> = $props();
</script>

<ParamSlider bind:value={partData.index} min={0} max={16} step={0.5} label="Amount" />
<ParamSlider bind:value={partData.ratio} min={0.5} max={8} step={0.5} label="Ratio" format={(v) => `×${v}`} />
<ParamSlider bind:value={partData.decay} min={0} max={2} step={0.05} label="Decay" format={(v) => (v ? `${v}s` : 'off')} />

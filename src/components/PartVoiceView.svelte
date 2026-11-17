<script lang="ts">
	import { VOICES, type IPartViewProps, type PartVoice } from '$lib';
	import ParamSelect from './ParamSelect.svelte';

	const { partData }: IPartViewProps<PartVoice> = $props();
	const options = [...VOICES] as string[];
</script>

<ParamSelect bind:value={partData.sound} label="Sound" {options} />

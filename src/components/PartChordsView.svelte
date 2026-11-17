<script lang="ts">
	import { ChordHold, VoicingMode, type IPartViewProps, type PartChords } from '$lib';
	import ParamSelect from './ParamSelect.svelte';
	import ParamToggle from './ParamToggle.svelte';

	const { partData }: IPartViewProps<PartChords> = $props();
	const options = Object.values(VoicingMode) as string[];
	const holds = Object.values(ChordHold) as string[];
</script>

<ParamToggle bind:value={partData.enabled} label="Enabled" />
<ParamSelect bind:value={partData.mode as string} label="Chords" {options} />
<ParamSelect bind:value={partData.hold as string} label="Length" options={holds} />

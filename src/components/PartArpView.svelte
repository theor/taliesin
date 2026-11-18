<script lang="ts">
  import { ArpeggiatorType, PartArpeggiator, type IPartViewProps } from '$lib';
  import ParamSelect from './ParamSelect.svelte';
  import ParamStepper from './ParamStepper.svelte';
  import ParamToggle from './ParamToggle.svelte';

  const { partData = $bindable() }: IPartViewProps<PartArpeggiator> = $props();
  const options = Object.values(ArpeggiatorType) as string[];
</script>

<ParamToggle bind:value={partData.enabled} label="Enabled" power />
<ParamSelect bind:value={partData.arpeggiatorType as string} label="Type" {options} />
<ParamStepper bind:value={partData.speed} min={1} max={16} step={1} label="Speed" />

<script lang="ts">
  import { ArpeggiatorType, PartArpeggiator, type IPartViewProps } from '$lib';
  import { Checkbox, List, type ListOptions, Stepper } from 'svelte-tweakpane-ui';
  // import { type Component } from 'svelte';

  const { part }: IPartViewProps<PartArpeggiator> = $props();
  // $effect(() => {
  // 	console.log('PartEffectsView c', part);
  // });
  const options: ListOptions<string> = ArpeggiatorType;
</script>

<Checkbox bind:value={part.data.enabled} label="Enabled" />
<List bind:value={part.data.arpeggiatorType as string} label="Type" {options} />
<Stepper
  bind:value={part.data.speed}
  min={1}
  max={16}
  step={1}
  label="Speed"
/>

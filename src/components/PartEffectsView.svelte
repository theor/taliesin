<script lang="ts">
  import type { IPartViewProps, PartEffects } from '$lib';
  import ParamSlider from './ParamSlider.svelte';

  const { partData = $bindable() }: IPartViewProps<PartEffects> = $props();
</script>

<ParamSlider
  bind:value={() => partData.delay ?? 0, (v) => (partData.delay = v)}
  min={0}
  max={1}
  step={0.05}
  label="Delay"
/>
<ParamSlider
  bind:value={() => partData.reverb ?? 0, (v) => (partData.reverb = v)}
  min={0}
  max={1}
  step={0.05}
  label="Reverb"
/>
<ParamSlider
  bind:value={() => partData.chorus ?? 0, (v) => (partData.chorus = v)}
  min={0}
  max={0.5}
  step={0.05}
  label="Chorus"
/>

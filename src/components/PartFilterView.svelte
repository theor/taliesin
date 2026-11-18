<script lang="ts">
  import { MAX_FILTER_HZ, MIN_FILTER_HZ, type IPartViewProps, type PartFilter } from '$lib';
  import ParamSlider from './ParamSlider.svelte';

  const { partData = $bindable() }: IPartViewProps<PartFilter> = $props();
  // the slider moves in octaves; the part stores Hz (whole ones, so a round trip changes nothing)
</script>

<ParamSlider
  bind:value={() => Math.log2(partData.freq), (v) => (partData.freq = Math.round(2 ** v))}
  min={Math.log2(MIN_FILTER_HZ)}
  max={Math.log2(MAX_FILTER_HZ)}
  step={0.1}
  label="Filter"
  format={(e) => Math.round(2 ** e) + 'hz'}
/>

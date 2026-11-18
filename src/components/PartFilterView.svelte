<script lang="ts">
  import {
    FilterType,
    MAX_FILTER_HZ,
    MIN_FILTER_HZ,
    type IPartViewProps,
    type PartFilter
  } from '$lib';
  import ParamSelect from './ParamSelect.svelte';
  import ParamSlider from './ParamSlider.svelte';

  const { partData = $bindable() }: IPartViewProps<PartFilter> = $props();
  const types = Object.values(FilterType) as string[];
  // the cutoff moves in octaves; the part stores Hz (whole ones, so a round trip changes nothing)
</script>

<ParamSelect bind:value={partData.type as string} label="Type" options={types} />
<ParamSlider
  bind:value={() => Math.log2(partData.freq), (v) => (partData.freq = Math.round(2 ** v))}
  min={Math.log2(MIN_FILTER_HZ)}
  max={Math.log2(MAX_FILTER_HZ)}
  step={0.1}
  label="Cutoff"
  format={(e) => Math.round(2 ** e) + 'hz'}
/>
<ParamSlider bind:value={partData.res} min={0} max={20} step={0.1} label="Resonance" />
<ParamSlider
  bind:value={partData.env}
  min={0}
  max={8}
  step={0.5}
  label="Envelope"
  format={(v) => (v ? `${v} oct` : 'off')}
/>

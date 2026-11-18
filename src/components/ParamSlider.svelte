<script lang="ts">
  // Touch-friendly labelled slider: a native range input with a large thumb; a knob in the rack.
  import { getControlStyle } from '$lib/controlStyle';
  import Knob from './Knob.svelte';
  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    format?: (v: number) => string;
  }
  let {
    value = $bindable(),
    min,
    max,
    step = 1,
    label,
    format = (v) => String(v)
  }: Props = $props();
</script>

{#if getControlStyle() === 'rack'}
  <Knob bind:value {min} {max} {step} {label} {format} />
{:else}
  <label class="block py-2">
    <span class="mb-1 flex justify-between text-sm">
      <span>{label}</span>
      <span class="tabular-nums opacity-70">{format(value)}</span>
    </span>
    <input type="range" class="param-slider" aria-label={label} {min} {max} {step} bind:value />
  </label>
{/if}

<style>
  .param-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 44px; /* big touch target */
    background: transparent;
    touch-action: pan-y; /* horizontal drags move the slider, vertical still scrolls */
    cursor: pointer;
  }
  .param-slider::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 4px;
    background: color-mix(in oklab, currentColor 25%, transparent);
  }
  .param-slider::-moz-range-track {
    height: 8px;
    border-radius: 4px;
    background: color-mix(in oklab, currentColor 25%, transparent);
  }
  .param-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 32px;
    height: 32px;
    margin-top: -12px;
    border-radius: 50%;
    border: none;
    background: var(--color-primary-500, currentColor);
  }
  .param-slider::-moz-range-thumb {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--color-primary-500, currentColor);
  }
</style>

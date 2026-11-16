<script lang="ts">
  import { Minus, Plus } from '@lucide/svelte';

  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    format?: (v: number) => string;
  }
  let { value = $bindable(), min, max, step = 1, label, format = (v) => String(v) }: Props =
    $props();

  function nudge(delta: number) {
    value = Math.min(max, Math.max(min, value + delta));
  }
</script>

<div class="flex min-h-11 items-center justify-between gap-4 py-2 text-sm">
  <span>{label}</span>
  <span class="flex items-center gap-2">
    <button
      type="button"
      class="btn-icon preset-tonal size-11"
      aria-label="{label} down"
      disabled={value <= min}
      onclick={() => nudge(-step)}><Minus size="20" /></button
    >
    <span class="min-w-12 text-center tabular-nums" aria-label={label}>{format(value)}</span>
    <button
      type="button"
      class="btn-icon preset-tonal size-11"
      aria-label="{label} up"
      disabled={value >= max}
      onclick={() => nudge(step)}><Plus size="20" /></button
    >
  </span>
</div>

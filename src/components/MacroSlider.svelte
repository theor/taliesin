<script lang="ts">
  /** A big, thumb-sized slider for the controls you reach for while jamming. Controlled: it shows `value`. */
  let {
    label,
    value,
    min = 0,
    max = 1,
    step = 0.01,
    format = (v: number) => v.toFixed(2),
    onchange
  }: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    format?: (v: number) => string;
    onchange: (value: number) => void;
  } = $props();
</script>

<label class="flex flex-col gap-1">
  <span class="flex justify-between text-sm">
    <span>{label}</span>
    <span class="text-surface-600-400 tabular-nums">{format(value)}</span>
  </span>
  <input
    type="range"
    class="accent-primary-500 h-9 w-full touch-pan-y"
    {min}
    {max}
    {step}
    {value}
    aria-label={label}
    oninput={(e) => onchange(Number(e.currentTarget.value))}
  />
</label>

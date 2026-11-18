<script lang="ts">
  import { getControlStyle } from '$lib/controlStyle';

  /** A labelled on/off: a checkbox in a list, an On/Off pill in the rack. */
  interface Props {
    value: boolean;
    label: string;
    /** The part's on/off switch: in the rack it lives in the module's header, not here. */
    power?: boolean;
  }
  let { value = $bindable(), label, power = false }: Props = $props();
  const rack = getControlStyle() === 'rack';
</script>

{#if rack && power}
  <!-- shown by the rack module's header -->
{:else if rack}
  <div class="col-span-2 flex flex-col gap-1.5">
    <span class="rack-label" aria-hidden="true">{label}</span>
    <button
      type="button"
      class="flex h-10 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold {value
        ? 'bg-primary-500 text-primary-contrast-500'
        : 'bg-surface-800 border-surface-700 border'}"
      aria-label={label}
      aria-pressed={value}
      onclick={() => (value = !value)}
    >
      <span class="size-2 rounded-full {value ? 'bg-surface-950' : 'bg-surface-500'}"></span>
      {value ? 'On' : 'Off'}
    </button>
  </div>
{:else}
  <label class="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2 text-sm">
    <span>{label}</span>
    <input type="checkbox" class="size-7 cursor-pointer" bind:checked={value} />
  </label>
{/if}

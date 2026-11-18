<script lang="ts">
  import { getControlStyle } from '$lib/controlStyle';

  /** A labelled choice: a select in a list; in the rack, a row of chips when there are few options. */
  interface Props {
    value: string;
    label: string;
    options: string[];
  }
  let { value = $bindable(), label, options }: Props = $props();
  const rack = getControlStyle() === 'rack';
  /** Chips fit up to this many options on a phone's width; more get a select. */
  const MAX_CHIPS = 5;
</script>

{#if rack && options.length <= MAX_CHIPS}
  <div class="col-span-full flex flex-col gap-1.5" role="group" aria-label={label}>
    <span class="rack-label">{label}</span>
    <div
      class="grid gap-1.5"
      style:grid-template-columns="repeat({options.length}, minmax(0, 1fr))"
    >
      {#each options as option (option)}
        <button
          type="button"
          class="h-10 min-w-0 truncate rounded-lg px-1 text-[13px] font-semibold {value === option
            ? 'bg-primary-500 text-primary-contrast-500'
            : 'bg-surface-800 border-surface-700 border'}"
          aria-pressed={value === option}
          onclick={() => (value = option)}>{option}</button
        >
      {/each}
    </div>
  </div>
{:else if rack}
  <label class="col-span-full flex flex-col gap-1.5">
    <span class="rack-label">{label}</span>
    <select
      class="bg-surface-800 border-surface-700 h-11 w-full rounded-lg border px-2.5 text-[15px]"
      bind:value
    >
      {#each options as option (option)}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </label>
{:else}
  <label class="flex min-h-11 items-center justify-between gap-4 py-2 text-sm">
    <span>{label}</span>
    <select class="select min-h-11 w-auto min-w-32 text-base" bind:value>
      {#each options as option (option)}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </label>
{/if}

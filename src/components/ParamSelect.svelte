<script lang="ts">
  interface Props {
    value: string;
    label: string;
    options: string[];
  }
  let { value = $bindable(), label, options }: Props = $props();
</script>

<label class="flex min-h-11 items-center justify-between gap-4 py-2 text-sm">
  <span>{label}</span>
  <select class="select min-h-11 w-auto min-w-32 text-base" bind:value>
    {#each options as option (option)}
      <option value={option}>{option}</option>
    {/each}
  </select>
</label>

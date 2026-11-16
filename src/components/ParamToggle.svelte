<script lang="ts">
  interface Props {
    value: boolean;
    label: string;
  }
  let { value = $bindable(), label }: Props = $props();
</script>

<label class="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2 text-sm">
  <span>{label}</span>
  <input type="checkbox" class="size-7 cursor-pointer" bind:checked={value} />
</label>

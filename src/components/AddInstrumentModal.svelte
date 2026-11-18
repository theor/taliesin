<script lang="ts">
  import { store } from '$lib';
  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import { Sparkles } from '@lucide/svelte';
  import { getInstrumentIcon, instrumentOf, presets } from '$lib/Store.svelte';
  import { addInstrumentCommand, presetCommands } from '$lib/commandBuilders';
  import type { Dispatch } from '$lib/commands';

  let {
    open = $bindable(false),
    selectedIndex = $bindable(),
    dispatch
  }: { open: boolean; selectedIndex: number; dispatch: Dispatch } = $props();

  const hints: Record<string, string> = {
    Piano: 'Chords and arpeggios',
    Bass: 'A low line',
    Drum: 'Kick, snare and hats'
  };
  const count = () => store.instrumentsData.instrumentsData.length;
</script>

<Modal
  {open}
  onOpenChange={(e) => (open = e.open)}
  contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
  backdropClasses="backdrop-blur-sm"
>
  {#snippet content()}
    <header class="flex justify-between">
      <h2 class="h2">Add instrument</h2>
    </header>
    <article class="space-y-1">
      <button
        type="button"
        class="btn preset-tonal-primary w-full justify-start"
        onclick={() => {
          const before = count();
          presetCommands().forEach(dispatch);
          selectedIndex = Math.min(before, count() - 1);
          open = false;
        }}
      >
        <Sparkles size={24} />
        <span class="flex flex-col items-start">
          <span>Full band</span>
          <span class="text-xs opacity-70">Three instruments, ready to play</span>
        </span>
      </button>
      {#each presets as preset}
        {@const Icon = getInstrumentIcon(instrumentOf(preset.instrument).name)}
        <button
          type="button"
          class="btn w-full justify-start"
          onclick={() => {
            dispatch(addInstrumentCommand(preset));
            selectedIndex = count() - 1;
            open = false;
          }}
        >
          <Icon size={24} />
          <span class="flex flex-col items-start">
            <span>{preset.name}</span>
            {#if hints[preset.name]}<span class="text-xs opacity-70">{hints[preset.name]}</span
              >{/if}
          </span>
        </button>
      {/each}
    </article>
    <footer class="flex justify-end gap-4">
      <button type="button" class="btn preset-tonal" onclick={() => (open = false)}>Cancel</button>
    </footer>
  {/snippet}
</Modal>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { InstrumentData } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import {
    canDoubleLoop,
    canHalveLoop,
    clearCommands,
    resizeLoopCommands
  } from '$lib/commandBuilders';
  import { EllipsisVertical, Eraser, Trash2 } from '@lucide/svelte';

  /** The instrument's "⋯" menu: clear, loop length, remove (asks first). `extra` goes on top. */
  let {
    instrumentData,
    dispatch,
    buttonClass = 'btn-icon btn-icon-sm',
    extra
  }: {
    instrumentData: InstrumentData;
    dispatch: Dispatch;
    buttonClass?: string;
    extra?: Snippet<[close: () => void]>;
  } = $props();

  let menuOpen = $state(false);
  let confirmRemove = $state(false);
  const closeMenu = () => {
    menuOpen = false;
    confirmRemove = false;
  };
</script>

<span class="relative">
  <button
    aria-label="Instrument menu"
    aria-expanded={menuOpen}
    class={buttonClass}
    onclick={() => (menuOpen ? closeMenu() : (menuOpen = true))}
    ><EllipsisVertical size={18} /></button
  >
  {#if menuOpen}
    <div
      class="bg-surface-100-900 border-surface-300-700 absolute top-full right-0 z-30 mt-1 flex w-56 flex-col gap-1 rounded-lg border p-2 shadow-xl"
    >
      {@render extra?.(closeMenu)}
      <button
        class="btn preset-tonal justify-start"
        onclick={() => {
          clearCommands(instrumentData).forEach((c) => dispatch(c));
          closeMenu();
        }}><Eraser size={16} /> Clear pattern</button
      >
      <button
        class="btn preset-tonal justify-start"
        disabled={!canHalveLoop(instrumentData)}
        onclick={() => {
          resizeLoopCommands(instrumentData, 'halve').forEach((c) => dispatch(c));
          closeMenu();
        }}>½ Shorter loop</button
      >
      <button
        class="btn preset-tonal justify-start"
        disabled={!canDoubleLoop(instrumentData)}
        onclick={() => {
          resizeLoopCommands(instrumentData, 'double').forEach((c) => dispatch(c));
          closeMenu();
        }}>×2 Longer loop</button
      >
      {#if confirmRemove}
        <p class="px-1 text-sm">Remove {instrumentData.name} for everyone?</p>
        <button
          class="btn preset-filled-error-500 justify-start"
          onclick={() => dispatch({ type: 'removeInstrument', instrumentId: instrumentData.id })}
          >Yes, remove it</button
        >
        <button class="btn preset-tonal justify-start" onclick={() => (confirmRemove = false)}
          >Keep it</button
        >
      {:else}
        <button
          aria-label="Remove instrument"
          class="btn preset-outlined-error-500 justify-start"
          onclick={() => (confirmRemove = true)}><Trash2 size={16} /> Remove instrument</button
        >
      {/if}
    </div>
  {/if}
</span>

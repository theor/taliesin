<script lang="ts">
  import { VOICES, type IPartViewProps, type PartVoice } from '$lib';
  import { getControlStyle } from '$lib/controlStyle';
  import ParamSelect from './ParamSelect.svelte';

  const { partData = $bindable() }: IPartViewProps<PartVoice> = $props();
  const options = [...VOICES] as string[];

  /** The basic waves get a button each in the rack (drawn as their shape); every sound is in the select. */
  const WAVES = [
    { id: 'sine', label: 'Sine', d: 'M1 7c2.5-8 7.5-8 10 0s7.5 8 10 0' },
    { id: 'sawtooth', label: 'Sawtooth', d: 'M1 12L11 2v10L21 2' },
    { id: 'square', label: 'Square', d: 'M1 12V2h10v10h10V2' },
    { id: 'triangle', label: 'Triangle', d: 'M1 12L6 2l10 10 5-10' }
  ].filter((w) => (VOICES as readonly string[]).includes(w.id));
</script>

{#if getControlStyle() === 'rack'}
  <div class="col-span-full grid grid-cols-4 gap-1.5" role="group" aria-label="Wave">
    {#each WAVES as w (w.id)}
      {@const on = partData.sound === w.id}
      <button
        type="button"
        class="flex h-10 items-center justify-center rounded-lg {on
          ? 'bg-primary-500 text-primary-contrast-500'
          : 'bg-surface-800 border-surface-700 border'}"
        aria-label={w.label}
        aria-pressed={on}
        onclick={() => (partData.sound = w.id)}
      >
        <svg
          width="22"
          height="14"
          viewBox="0 0 22 14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
          aria-hidden="true"><path d={w.d} /></svg
        >
      </button>
    {/each}
  </div>
{/if}
<ParamSelect bind:value={partData.sound} label="Sound" {options} />

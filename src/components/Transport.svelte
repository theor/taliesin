<script lang="ts">
  import { Pause, Play, Square } from '@lucide/svelte';
  import type { Dispatch } from '$lib/commands';
  import type { Scale } from '$lib/parts.svelte';
  import TempoControl from './TempoControl.svelte';

  /**
   * Play/pause, stop, where the song is (bar.beat), its tempo and its key. Pure view: state comes in as
   * props, intent goes out as commands. `size` is the button size: big on the phone, smaller in a header.
   */
  let {
    playing,
    position,
    dispatch,
    scale,
    tempo,
    size = 'lg'
  }: {
    playing: boolean;
    position: number;
    dispatch: Dispatch;
    scale?: Scale;
    /** BPM; without it no tempo is shown. */
    tempo?: number;
    size?: 'md' | 'lg';
  } = $props();

  const bar = $derived(
    playing && Number.isFinite(position) && position >= 0
      ? `${Math.floor(position) + 1}.${Math.floor((position % 1) * 4) + 1}`
      : '–'
  );
  const button = $derived(size === 'lg' ? 'size-14 rounded-xl' : 'h-11 w-12 rounded-xl');
</script>

<button
  class="bg-primary-500 text-primary-contrast-500 flex flex-none items-center justify-center {button}"
  aria-label={playing ? 'Pause' : 'Play'}
  onclick={() => dispatch({ type: 'transport', action: 'toggle' })}
>
  {#if playing}<Pause size={size === 'lg' ? 24 : 20} fill="currentColor" />{:else}<Play
      size={size === 'lg' ? 24 : 20}
      fill="currentColor"
    />{/if}
</button>
<button
  class="bg-surface-800 border-surface-700 flex flex-none items-center justify-center border {button}"
  aria-label="Stop"
  onclick={() => dispatch({ type: 'transport', action: 'stop' })}
  ><Square size={size === 'lg' ? 18 : 16} fill="currentColor" /></button
>
{#if size === 'lg'}
  <dl class="grid flex-1 {tempo === undefined ? 'grid-cols-2' : 'grid-cols-3'} gap-2">
    <div class="flex flex-col gap-0.5">
      <dt class="rack-label">Pos</dt>
      <dd class="font-mono text-lg font-semibold tabular-nums" data-testid="position">{bar}</dd>
    </div>
    {#if tempo !== undefined}
      <div>
        <dt class="sr-only">Tempo</dt>
        <dd><TempoControl bpm={tempo} {dispatch} /></dd>
      </div>
    {/if}
    {#if scale}
      <div class="flex flex-col gap-0.5">
        <dt class="rack-label">Key</dt>
        <dd class="font-mono text-lg font-semibold">
          {scale.scaleKey} <span class="text-sm">{scale.scaleMode}</span>
        </dd>
      </div>
    {/if}
  </dl>
{:else}
  <dl
    class="bg-surface-900 border-surface-700 flex h-11 items-center gap-5 rounded-xl border px-3 font-mono text-[15px] font-semibold"
  >
    <dt class="sr-only">Position</dt>
    <dd class="min-w-10 tabular-nums" data-testid="position">{bar}</dd>
    {#if tempo !== undefined}
      <dt class="sr-only">Tempo</dt>
      <dd><TempoControl bpm={tempo} {dispatch} size="md" /></dd>
    {/if}
    {#if scale}
      <dt class="sr-only">Key</dt>
      <dd>{scale.scaleKey} {scale.scaleMode}</dd>
    {/if}
  </dl>
{/if}

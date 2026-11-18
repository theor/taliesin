<script lang="ts">
  import { Minus, Plus } from '@lucide/svelte';
  import { MAX_BPM, MIN_BPM, type Dispatch } from '$lib/commands';
  import { clampBpm, TapTempo } from '$lib/tempo';

  /**
   * The song's tempo: the BPM, and a panel to change it (nudge, slider, tap along). Song state like the
   * key: it dispatches absolute `setTempo` commands, and the host's scheduler plays it for everyone.
   */
  let {
    bpm,
    dispatch,
    size = 'lg',
    now = () => performance.now()
  }: {
    bpm: number;
    dispatch: Dispatch;
    size?: 'md' | 'lg';
    /** Clock for tap tempo (ms); tests inject one. */
    now?: () => number;
  } = $props();

  let open = $state(false);
  const tapper = new TapTempo();
  const set = (value: number) => {
    const next = clampBpm(value);
    if (next !== bpm) dispatch({ type: 'setTempo', bpm: next });
  };
  function tap() {
    const tapped = tapper.tap(now());
    if (tapped !== undefined) set(tapped);
  }
  const step =
    'bg-surface-800 border-surface-700 flex size-10 items-center justify-center rounded-lg border';
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

<span class="relative">
  <button
    class={size === 'lg'
      ? 'flex flex-col items-start gap-0.5 text-left'
      : 'font-mono tabular-nums underline decoration-dotted underline-offset-4'}
    aria-label="Tempo {bpm} BPM"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    {#if size === 'lg'}
      <span class="rack-label">BPM</span>
      <span class="font-mono text-lg font-semibold tabular-nums" data-testid="tempo">{bpm}</span>
    {:else}
      <span data-testid="tempo">{bpm}</span>
    {/if}
  </button>
  {#if open}
    <div
      class="bg-surface-100-900 border-surface-300-700 absolute top-full left-1/2 z-30 mt-2 flex w-64 -translate-x-1/2 flex-col gap-3 rounded-xl border p-3 font-sans shadow-xl"
      role="dialog"
      aria-label="Tempo"
    >
      <div class="flex items-center gap-2">
        <button class={step} aria-label="Slower" onclick={() => set(bpm - 1)}
          ><Minus size={16} /></button
        >
        <span class="flex-1 text-center font-mono text-2xl font-semibold tabular-nums"
          >{bpm}<span class="text-surface-300 ml-1 text-xs">BPM</span></span
        >
        <button class={step} aria-label="Faster" onclick={() => set(bpm + 1)}
          ><Plus size={16} /></button
        >
      </div>
      <input
        type="range"
        class="w-full accent-[var(--color-primary-500)]"
        aria-label="Tempo slider"
        min={MIN_BPM}
        max={MAX_BPM}
        step={1}
        value={bpm}
        oninput={(e) => set(Number(e.currentTarget.value))}
      />
      <button
        class="bg-primary-500 text-primary-contrast-500 h-12 rounded-lg text-sm font-bold"
        style:touch-action="manipulation"
        onpointerdown={(e) => {
          e.preventDefault(); // a tap is a pointer down: no click delay, no emulated mouse events
          tap();
        }}>Tap along</button
      >
      <button class="btn preset-tonal" onclick={() => (open = false)}>Done</button>
    </div>
  {/if}
</span>

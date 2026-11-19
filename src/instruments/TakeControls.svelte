<script lang="ts">
  // The take card shared by the live-input views (pads, draw, tombola): the loop strip, the record button
  // and what the take is doing, what is heard here (the loop, or only what is played), and a summary of
  // the take settings that opens them in a sheet. The view
  // owns the take (it feeds it hits); this arms, stops and undoes it, and moves it on every frame.
  import { beatsPerBar, type OldNotes } from '$lib/take.svelte';
  import { ChevronRight, SlidersHorizontal, Undo2 } from '@lucide/svelte';
  import { RESOLUTIONS, type Heard, type LiveTake } from './liveTake.svelte';
  import TakeStrip from './TakeStrip.svelte';

  const {
    live,
    playing,
    nowStep,
    heardHelp = {
      loop: 'The pattern as everyone hears it, and what you play on top.',
      live: 'Only what you play: the pattern is silent here (the others still hear it).'
    }
  }: {
    live: LiveTake;
    playing: boolean;
    /** The playhead's step, or undefined when stopped. */
    nowStep: number | undefined;
    /** What "Loop" and "Live" mean for this view. */
    heardHelp?: Record<Heard, string>;
  } = $props();
  const take = $derived(live.take);
  const length = $derived(live.length());

  // the take follows the song clock: tick it every frame until it is done
  let progress = $state(0);
  let toStart = $state(0);
  let loopStep = $state(1);
  $effect(() => {
    if (take.phase === 'idle' || typeof requestAnimationFrame !== 'function') return;
    let frame = requestAnimationFrame(function loop() {
      take.tick();
      progress = take.progress();
      toStart = take.measuresToStart();
      loopStep = take.currentLoopStep();
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  });

  // the count-in: the beats of the bar before the take (passed, now, still to come)
  const beats = $derived(beatsPerBar(length.stepsPerMeasure));
  const beatsLeft = $derived(Math.max(1, Math.ceil(toStart * beats - 1e-6)));
  const pips = $derived(
    Array.from({ length: beats }, (_, b) => {
      const current = beats - beatsLeft;
      return b < current ? 'passed' : b === current ? 'now' : 'next';
    })
  );

  const OLD_NOTES_LABEL: Record<
    OldNotes,
    { button: string; summary: string; doing: string; help: string }
  > = {
    replace: {
      button: 'Replace',
      summary: 'Replace as it plays',
      doing: 'replacing as it plays',
      help: 'Each old note is cleared just before the playhead reaches it, so you hear the old part until you play over it.'
    },
    clearFirst: {
      button: 'Clear first',
      summary: 'Clear first',
      doing: 'over a cleared loop',
      help: 'The whole loop is cleared as the take starts: you play over silence.'
    },
    keep: {
      button: 'Keep',
      summary: 'Keep old notes',
      doing: 'adding on top',
      help: 'Nothing is cleared: the take adds to what is there.'
    }
  };
  const summary = $derived(
    [
      OLD_NOTES_LABEL[live.options.oldNotes].summary,
      live.options.loop ? 'keep layering' : 'stop after 1 loop',
      `hear ${live.hear ? 'on' : 'off'}`
    ].join(' · ')
  );

  const status = $derived.by(() => {
    if (take.phase === 'armed') {
      return {
        title: 'Armed',
        sub: `Starts in ${beatsLeft} beat${beatsLeft === 1 ? '' : 's'} · tap to cancel`,
        tone: 'text-warning-300'
      };
    }
    if (take.phase === 'recording') {
      const pass = live.options.loop ? ` · pass ${take.pass + 1}` : '';
      return {
        title: 'Recording',
        sub: `Step ${loopStep} of ${take.totalSteps}${pass} · ${OLD_NOTES_LABEL[live.options.oldNotes].doing}`,
        tone: 'text-error-300'
      };
    }
    if (take.result) {
      const n = take.result.notes;
      return {
        title: 'Take recorded',
        sub: `${n} note${n === 1 ? '' : 's'} · record again to replace it`,
        tone: 'text-primary-300'
      };
    }
    return {
      title: 'Record a take',
      sub: playing ? 'Starts at the next bar, lasts one loop' : 'Press play first',
      tone: ''
    };
  });

  function toggle() {
    if (take.phase === 'idle') {
      if (take.arm()) toStart = take.measuresToStart(); // right away, not on the next frame
    } else take.stop();
  }

  let sheetOpen = $state(false);
  let sheet = $state<HTMLElement>();
  $effect(() => sheet?.focus()); // so Escape reaches it, and screen readers land in it
  function onSheetKey(e: KeyboardEvent) {
    if (e.key === 'Escape') sheetOpen = false;
  }
  const segment = (on: boolean) =>
    `min-h-11 rounded-lg text-[13px] font-semibold ${on ? 'bg-surface-600 text-surface-50' : 'text-surface-300'}`;
</script>

<section
  aria-label="Take"
  class="bg-surface-900 flex flex-col gap-3 rounded-2xl border p-3.5 {take.phase === 'recording'
    ? 'border-error-700'
    : take.phase === 'armed'
      ? 'border-warning-800'
      : take.result
        ? 'border-primary-800'
        : 'border-surface-700'}"
  data-testid="take-controls"
>
  <TakeStrip
    {take}
    tracks={live.trackCount}
    stepsPerMeasure={length.stepsPerMeasure}
    measures={length.measures}
    {nowStep}
  />

  <div class="flex items-center gap-3.5">
    <button
      type="button"
      class="flex size-16 shrink-0 items-center justify-center rounded-full transition-shadow disabled:opacity-40 {take.phase ===
      'armed'
        ? 'bg-warning-500 ring-warning-500/20 ring-[6px]'
        : take.phase === 'recording'
          ? 'bg-error-600 ring-error-500/20 ring-[6px]'
          : 'border-surface-600 bg-surface-800 border-2'}"
      disabled={!playing && take.phase === 'idle'}
      aria-label={take.phase === 'idle'
        ? 'Record a take'
        : take.phase === 'armed'
          ? 'Cancel the take'
          : 'Stop recording'}
      data-phase={take.phase}
      onclick={toggle}
    >
      {#if take.phase === 'recording'}
        <span class="size-5 rounded bg-white"></span>
      {:else if take.phase === 'armed'}
        <span class="bg-warning-950 size-6 rounded-full"></span>
      {:else}
        <span class="bg-error-500 size-6 rounded-full"></span>
      {/if}
    </button>

    <div class="flex min-w-0 flex-1 flex-col gap-1" aria-live="polite">
      <span class="text-[17px] font-semibold {status.tone}" data-testid="take-status"
        >{status.title}</span
      >
      <span class="text-surface-300 text-[13px] leading-snug">{status.sub}</span>
      {#if take.phase === 'armed'}
        <div class="flex gap-1.5 pt-0.5" aria-hidden="true" data-testid="count-in">
          {#each pips as pip, i (i)}
            <span
              class="h-1.5 w-5 rounded-full {pip === 'now'
                ? 'bg-warning-500'
                : pip === 'passed'
                  ? 'bg-warning-900'
                  : 'border-warning-700 border'}"
            ></span>
          {/each}
        </div>
      {:else if take.phase === 'recording'}
        <div class="bg-surface-700 h-1 overflow-hidden rounded-full" aria-hidden="true">
          <div class="bg-error-500 h-full" style:width="{progress * 100}%"></div>
        </div>
      {/if}
    </div>

    {#if take.canUndo}
      <button
        type="button"
        class="border-surface-600 flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold"
        onclick={() => take.undo()}
      >
        <Undo2 size={16} /> Undo take
      </button>
    {/if}
  </div>

  <div class="flex flex-col gap-1.5">
    <div
      role="group"
      aria-label="Hear here"
      class="bg-surface-800 border-surface-700 grid grid-cols-2 gap-1 rounded-xl border p-1"
    >
      <button
        type="button"
        class={segment(live.heard === 'loop')}
        aria-pressed={live.heard === 'loop'}
        onclick={() => (live.heard = 'loop')}>Loop</button
      >
      <button
        type="button"
        class={segment(live.heard === 'live')}
        aria-pressed={live.heard === 'live'}
        onclick={() => (live.heard = 'live')}>Live</button
      >
    </div>
    <span class="text-surface-300 text-[13px] leading-snug">{heardHelp[live.heard]}</span>
  </div>

  {#if take.phase === 'idle'}
    <button
      type="button"
      class="border-surface-700 bg-surface-800 text-surface-200 flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-left text-[13px] font-medium"
      aria-label="Take settings: {summary}"
      aria-haspopup="dialog"
      onclick={() => (sheetOpen = true)}
    >
      <SlidersHorizontal size={18} class="text-surface-300 shrink-0" />
      <span class="min-w-0 flex-1 truncate">{summary}</span>
      <ChevronRight size={16} class="text-surface-300 shrink-0" />
    </button>
  {/if}
</section>

{#if sheetOpen}
  <div class="fixed inset-0 z-50 flex items-end justify-center md:items-center">
    <button
      type="button"
      class="absolute inset-0 bg-black/70"
      aria-label="Close take settings"
      onclick={() => (sheetOpen = false)}
    ></button>
    <div
      bind:this={sheet}
      role="dialog"
      aria-modal="true"
      aria-label="Take settings"
      tabindex="-1"
      onkeydown={onSheetKey}
      class="bg-surface-800 border-surface-600 relative flex w-full max-w-md flex-col gap-4.5 rounded-t-3xl border-t px-4 pt-2.5 pb-6 md:rounded-3xl md:border"
    >
      <span class="bg-surface-500 h-1 w-10 self-center rounded-full md:hidden" aria-hidden="true"
      ></span>
      <h2 class="text-xl font-bold">Take settings</h2>

      <div class="flex flex-col gap-2">
        <span class="text-surface-300 text-[13px] font-semibold">Old notes</span>
        <div
          role="group"
          aria-label="Old notes"
          class="bg-surface-900 border-surface-700 grid grid-cols-3 gap-1 rounded-xl border p-1"
        >
          {#each Object.entries(OLD_NOTES_LABEL) as [mode, text] (mode)}
            <button
              type="button"
              class={segment(live.options.oldNotes === mode)}
              aria-pressed={live.options.oldNotes === mode}
              onclick={() => (live.options.oldNotes = mode as OldNotes)}>{text.button}</button
            >
          {/each}
        </div>
        <span class="text-surface-300 text-[13px] leading-snug"
          >{OLD_NOTES_LABEL[live.options.oldNotes].help}</span
        >
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-surface-300 text-[13px] font-semibold">When the loop ends</span>
        <div
          role="group"
          aria-label="When the loop ends"
          class="bg-surface-900 border-surface-700 grid grid-cols-2 gap-1 rounded-xl border p-1"
        >
          <button
            type="button"
            class={segment(!live.options.loop)}
            aria-pressed={!live.options.loop}
            onclick={() => (live.options.loop = false)}>Stop</button
          >
          <button
            type="button"
            class={segment(live.options.loop)}
            aria-pressed={live.options.loop}
            onclick={() => (live.options.loop = true)}>Keep layering</button
          >
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-surface-300 text-[13px] font-semibold">Snap to</span>
        <div
          role="group"
          aria-label="Snap to"
          class="bg-surface-900 border-surface-700 grid grid-cols-3 gap-1 rounded-xl border p-1"
        >
          {#each RESOLUTIONS as r (r.value)}
            <button
              type="button"
              class={segment(live.resolution === r.value)}
              aria-pressed={live.resolution === r.value}
              onclick={() => (live.resolution = r.value)}>{r.label}</button
            >
          {/each}
        </div>
      </div>

      <button
        type="button"
        class="flex min-h-12 items-center justify-between gap-4 px-1 text-left text-[15px] font-medium"
        aria-pressed={live.hear}
        onclick={() => (live.hear = !live.hear)}
      >
        <span class="flex flex-col gap-0.5">
          Hear notes as you play
          <span class="text-surface-300 text-[13px]">Only on this device</span>
        </span>
        <span
          class="relative h-7 w-12 shrink-0 rounded-full {live.hear
            ? 'bg-primary-700'
            : 'bg-surface-600'}"
          aria-hidden="true"
        >
          <span
            class="bg-surface-50 absolute top-[3px] size-[22px] rounded-full {live.hear
              ? 'right-[3px]'
              : 'left-[3px]'}"
          ></span>
        </span>
      </button>

      <button
        type="button"
        class="bg-primary-500 text-surface-950 min-h-12 rounded-2xl text-base font-bold"
        onclick={() => (sheetOpen = false)}>Done</button
      >
    </div>
  </div>
{/if}

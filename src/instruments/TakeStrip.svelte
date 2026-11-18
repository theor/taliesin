<script lang="ts">
  // The loop as a strip, one column per step: what is there, and what the take is doing to it (old
  // notes grey, cleared ones dashed until the playhead gets there, the take's own notes in colour).
  // A note's height is its track (on a melody: its pitch).
  import type { CellState, Take } from '$lib/take.svelte';

  const {
    take,
    tracks,
    stepsPerMeasure,
    measures,
    nowStep
  }: {
    take: Take;
    tracks: number;
    stepsPerMeasure: number;
    measures: number;
    /** The playhead's step, or undefined when stopped. */
    nowStep: number | undefined;
  } = $props();

  const steps = $derived(stepsPerMeasure * measures);
  const bars = $derived(Array.from({ length: measures }, (_, m) => m + 1));
  const columns = $derived.by(() => {
    void take.changes; // the take's edits
    // while a take runs, a cleared note stops showing once the playhead passes it
    if (take.phase !== 'idle') void nowStep;
    return Array.from({ length: steps }, (_, step) => {
      const notes: { track: number; state: CellState }[] = [];
      for (let track = 0; track < tracks; track++) {
        const state = take.cellState(track, step);
        if (state !== 'off') notes.push({ track, state });
      }
      return notes;
    });
  });
  const counts = $derived(
    columns.reduce(
      (n, notes) => {
        for (const { state } of notes) n[state]++;
        return n;
      },
      { old: 0, new: 0, cleared: 0, off: 0 } as Record<CellState, number>
    )
  );
  const label = $derived(
    `Loop of ${steps} steps: ${counts.new} notes from this take, ${counts.old} older notes` +
      (counts.cleared ? `, ${counts.cleared} about to be replaced` : '')
  );
  /** Bottom of a note, in % of the strip's height. */
  const bottom = (track: number) => (tracks > 1 ? (track / (tracks - 1)) * 80 + 4 : 40);
  const NOTE_CLASS: Record<CellState, string> = {
    old: 'bg-surface-500',
    new: 'bg-primary-500',
    cleared: 'border border-dashed border-surface-400',
    off: ''
  };
</script>

<div class="flex flex-col gap-1" data-testid="take-strip">
  <div class="text-surface-300 flex text-[11px] font-semibold tracking-wider" aria-hidden="true">
    {#each bars as bar (bar)}
      <span class="min-w-0 flex-1 truncate">BAR {bar}</span>
    {/each}
  </div>
  <div
    role="img"
    aria-label={label}
    class="grid h-13 gap-px"
    style:grid-template-columns="repeat({steps}, minmax(0, 1fr))"
  >
    {#each columns as notes, step (step)}
      <div
        class="bg-surface-800 relative rounded-[3px] {step % stepsPerMeasure === 0
          ? 'border-surface-500 border-l'
          : ''}"
        data-step={step}
      >
        {#each notes as { track, state } (track)}
          <span
            class="absolute inset-x-px h-1.5 rounded-[2px] {NOTE_CLASS[state]}"
            style:bottom="{bottom(track)}%"
            data-state={state}
          ></span>
        {/each}
        {#if nowStep === step}
          <span
            class="bg-warning-500 absolute -inset-y-0.5 -left-0.5 w-0.5 rounded-full"
            data-now
            aria-hidden="true"
          ></span>
        {/if}
      </div>
    {/each}
  </div>
</div>

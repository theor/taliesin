<script lang="ts">
  // Picks how the instrument's cells are edited (grid, circles, rings, record) and shows that view.
  import { Instrument, type InputView, type IDispatchingInstrumentViewProps } from '$lib';
  import { getInstrument } from '$lib/Store.svelte';
  import { CircleDot, Grid3x3, Orbit, Target } from '@lucide/svelte';
  import CircleView from './CircleView.svelte';
  import NestedCircleView from './NestedCircleView.svelte';
  import RecordView from './RecordView.svelte';
  import SequencerView from './SequencerView.svelte';

  let {
    index,
    instrumentData = $bindable(),
    dispatch,
    position,
    playing,
    now,
    maxVisibleSteps
  }: IDispatchingInstrumentViewProps & {
    /** Passed to the grid: how many steps it shows before paging. */
    maxVisibleSteps?: number;
  } = $props();

  // The same component instance is reused when another instrument is selected, so everything
  // that depends on the instrument is derived, not computed once.
  const instr: Instrument | undefined = $derived(getInstrument(instrumentData));
  const seq = $derived(instr?.sequencer);
  const views: InputView[] = $derived(instr?.views ?? ['grid']);

  const VIEW_META = {
    grid: { label: 'Grid', aria: 'Grid view', icon: Grid3x3 },
    circle: { label: 'Circles', aria: 'Circle view', icon: Orbit },
    rings: { label: 'Rings', aria: 'Nested rings view', icon: Target },
    record: { label: 'Record', aria: 'Record view', icon: CircleDot }
  } as const;

  // Which input the user prefers is a per-device choice (not part of the song, not synced).
  const storageKey = (id: string) => `taliesin:view:${id}`;
  function loadView(id: string): InputView {
    try {
      const saved = localStorage.getItem(storageKey(id));
      if (saved === 'grid' || saved === 'circle' || saved === 'rings' || saved === 'record') {
        return views.includes(saved) ? saved : 'grid';
      }
    } catch {
      // storage unavailable: fall back to the grid
    }
    return 'grid';
  }
  let picked = $state<Record<string, InputView>>({});
  const view = $derived(picked[instrumentData.id] ?? loadView(instrumentData.id));
  function chooseView(v: InputView) {
    picked[instrumentData.id] = v;
    try {
      localStorage.setItem(storageKey(instrumentData.id), v);
    } catch {
      // not saving is fine
    }
  }
</script>

<div>
  {#if seq}
    {#if views.length > 1}
      <div
        class="bg-surface-100-900 border-surface-200-800 mb-3 grid gap-1 rounded-xl border p-1"
        style:grid-template-columns="repeat({views.length}, minmax(0, 1fr))"
        role="group"
        aria-label="Input view"
      >
        {#each views as v (v)}
          {@const Icon = VIEW_META[v].icon}
          <button
            class="btn min-h-10 px-1 text-sm font-semibold {view === v
              ? 'bg-surface-200-800'
              : 'opacity-70'}"
            aria-label={VIEW_META[v].aria}
            aria-pressed={view === v}
            onclick={() => chooseView(v)}><Icon size={18} /> {VIEW_META[v].label}</button
          >
        {/each}
      </div>
    {/if}
    <!-- one fresh set of views per instrument: they hold per-instrument state (gestures, the sequencer) -->
    {#key instrumentData.id}
      {#if view === 'circle'}
        <CircleView {instrumentData} {index} {dispatch} {position} {playing} />
      {:else if view === 'record'}
        <RecordView {instrumentData} {index} {dispatch} {position} {playing} {now} />
      {:else if view === 'rings'}
        <NestedCircleView {instrumentData} {index} {dispatch} {position} {playing} />
      {:else}
        <SequencerView
          bind:instrumentData
          {index}
          {dispatch}
          {position}
          {playing}
          {maxVisibleSteps}
        />
      {/if}
    {/key}
  {/if}
</div>

<script lang="ts">
  import { Instrument, type IDispatchingInstrumentViewProps } from '$lib';
  import { commitStroke, playheadStep, previewStroke, strideOf, type Cell } from '$lib/gesture';
  import { getInstrument } from '$lib/Store.svelte';
  import { getGlobalContext } from '$lib/context';
  import {
    ArrowLeftIcon,
    ArrowRightIcon,
    ChevronFirstIcon,
    ChevronLastIcon,
    EllipsisIcon,
    HelpCircleIcon
  } from '@lucide/svelte';
  import { Pagination } from '@skeletonlabs/skeleton-svelte';
  import { pointer } from '$lib/utils/hammerAction';
  import { SvelteMap } from 'svelte/reactivity';

  // The view only reads state and dispatches commands; it never mutates instrument data itself.
  const {
    instrumentData = $bindable(),
    dispatch,
    position,
    playing
  }: IDispatchingInstrumentViewProps = $props();
  const instr: Instrument | undefined = getInstrument(instrumentData);
  const seq = instr?.sequencer!;
  const scale = getGlobalContext() ?? { scaleKey: 'A', scaleMode: 'minor' };

  const buttonClassOn = 'preset-filled-primary-500';
  const buttonClassOff = 'preset-outlined-primary-500';
  const buttonClassOnOdd = 'preset-filled-tertiary-500';
  const buttonClassOffOdd = 'preset-outlined-tertiary-500';
  const buttonClassModifiedOn = 'preset-filled-secondary-500';
  const buttonClassModifiedOff = 'preset-tonal-secondary';
  const buttonClassErasing = 'preset-gradient';

  let panWillTurnOn: boolean | undefined = $state(undefined);
  let start: Cell | undefined; // where the current stroke began
  let last: Cell | undefined; // where the pointer is now
  let erasing = $state(false); // the stroke began on a note, so it erases instead of painting
  let stride = $state(1);
  let modifiedSteps = new SvelteMap<number, number>(); // live preview of the stroke, not yet committed
  let showHelp = $state(false);

  function onPointer(e: PointerEvent) {
    if (e.type === 'pointercancel') {
      // the browser took the gesture: drop the stroke without committing it
      modifiedSteps.clear();
      panWillTurnOn = undefined;
      stride = 1;
      erasing = false;
      start = last = undefined;
      return;
    }
    if (e.type === 'pointerup') {
      modifiedSteps.clear();
      panWillTurnOn = undefined;
      if (start && last) {
        const from = start;
        const { track, cells } = commitStroke({
          start,
          last,
          eraseEmpty: false,
          erase: erasing,
          isOn: (step) => seq.getCell(instrumentData, from.track, step)
        });
        if (cells.length) dispatch({ type: 'setCells', instrumentId: instrumentData.id, track, cells });
      }
      stride = 1;
      erasing = false;
      start = last = undefined;
      return;
    }

    const elt = document.elementFromPoint(e.x, e.y);
    if (!elt || !elt.hasAttribute('data-x')) return;
    const cell: Cell = { step: Number(elt.getAttribute('data-x')), track: Number(elt.getAttribute('data-y')) };
    if (isNaN(cell.step) || isNaN(cell.track)) return;

    if (last) last = { step: last.step, track: cell.track }; // the row can change within a column
    if (start) stride = strideOf(start, last ?? cell);
    if (last && cell.step === last.step) return;

    if (!start) {
      start = cell;
      erasing = seq.getCell(instrumentData, cell.track, cell.step);
    }
    last = cell;
    panWillTurnOn ??= true;
    stride = erasing ? 1 : strideOf(start, cell);
    modifiedSteps.clear();
    for (const p of previewStroke(start, cell, false, erasing)) {
      modifiedSteps.set(p.step + 1000 * start.track, p.offset);
    }
  }

  /** A loop up to this long is shown whole; a longer one is paged. */
  const MAX_VISIBLE_STEPS = 32;
  let page = $state(1);
  let pages = $derived(paginate(instr));

  $effect(() => {
    if (page - 1 >= pages.length) {
      page = Math.max(1, pages.length);
    }
  });

  function paginate(instr: Instrument | undefined) {
    if (!instr) return [];
    const length = instr.getLength(instrumentData);
    const totalLength = length.stepsPerMeasure * length.measures;
    const pagesCount = Math.ceil(totalLength / MAX_VISIBLE_STEPS);
    return Array.from({ length: pagesCount }, (_, i) => ({
      page: i + 1,
      label: `Page ${i + 1}`,
      start: i * MAX_VISIBLE_STEPS,
      end: Math.min((i + 1) * MAX_VISIBLE_STEPS, totalLength)
    }));
  }

  function currentPageRange() {
    if (!instr || page > pages.length) return { start: 0, end: 0, length: 0 };
    const curPage = pages[page - 1];
    return { ...curPage, length: curPage.end - curPage.start };
  }

  // grid rows run from the highest track (top) to the lowest
  const rows = (seq?.tracks ?? []).map((track, trackIndex) => ({ track, trackIndex })).reverse();
  const nowStep = $derived(
    instr ? playheadStep(position ?? 0, playing ?? false, instr.getLength(instrumentData)) : undefined
  );
</script>

{#if instr}
  {@const length = instr.getLength(instrumentData)}
  {@const currentRange = currentPageRange()}

  <div class="mb-2 flex flex-col select-none" data-testid="sequencer-grid" use:pointer={{ onPointer }}>
    {#each rows as { track, trackIndex } (trackIndex)}
      <div class="flex flex-row">
        <div class="mr-1 w-8 flex-none self-center text-right text-xs">
          {instr.trackLabel(track, scale)}
        </div>
        <div
          class="grid flex-1"
          style:grid-template-columns="repeat({Math.max(1, currentRange.length)}, minmax(0, 1fr))"
        >
          {#each { length: currentRange.length } as _, ri}
            {@const i = currentRange.start + ri}
            {@const modifiedCell = modifiedSteps.get(i + 1000 * trackIndex)}
            {@const cell = seq.getCell(instrumentData, trackIndex, i)}
            {@const odd = Math.floor(i / length.stepsPerMeasure) % 2 === 1}

            <div
              id="seq-{trackIndex}-{i}"
              aria-label="seq-{trackIndex}-{i}"
              data-x={i}
              data-y={trackIndex}
              class="flex h-8 p-px {i % 4 === 0 && ri > 0 ? 'border-surface-500/40 border-l-2' : ''} {nowStep ===
              i
                ? 'bg-warning-500/40'
                : ''}"
            >
              <span
                class="pointer-events-none h-full flex-1 rounded-xs {modifiedCell === undefined
                  ? cell
                    ? odd
                      ? buttonClassOnOdd
                      : buttonClassOn
                    : odd
                      ? buttonClassOffOdd
                      : buttonClassOff
                  : erasing
                    ? buttonClassErasing
                    : modifiedCell % stride === 0
                      ? buttonClassModifiedOn
                      : buttonClassModifiedOff}"
              ></span>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="flex items-center justify-between gap-2">
    {#if pages.length > 1}
      <Pagination data={pages} {page} pageSize={1} onPageChange={(e) => (page = e.page)}>
        {#snippet labelEllipsis()}<EllipsisIcon class="size-4" />{/snippet}
        {#snippet labelNext()}<ArrowRightIcon class="size-4" />{/snippet}
        {#snippet labelPrevious()}<ArrowLeftIcon class="size-4" />{/snippet}
        {#snippet labelFirst()}<ChevronFirstIcon class="size-4" />{/snippet}
        {#snippet labelLast()}<ChevronLastIcon class="size-4" />{/snippet}
      </Pagination>
    {:else}
      <span></span>
    {/if}
    <div class="flex flex-row items-center gap-2">
      {#if panWillTurnOn && !erasing && stride > 1}
        <span class="text-sm">every {stride}</span>
      {:else if panWillTurnOn && erasing}
        <span class="text-sm">erasing</span>
      {/if}
      <button
        class="btn-icon btn-icon-sm"
        aria-label="How the grid works"
        aria-expanded={showHelp}
        onclick={() => (showHelp = !showHelp)}><HelpCircleIcon size={20} /></button
      >
    </div>
  </div>
  {#if showHelp}
    <p class="bg-surface-100-900 mt-2 rounded p-2 text-sm" data-testid="grid-help">
      Tap a cell to switch it on or off. Drag across to fill a stretch; drag up or down as you go to
      skip steps (every 2nd, 3rd…). Start a drag on a lit cell to erase instead.
    </p>
  {/if}
{:else}
  <p>Instrument not found</p>
{/if}

<script lang="ts">
  import { Instrument, type IDispatchingInstrumentViewProps } from '$lib';
  import { commitStroke, previewStroke, strideOf, type Cell } from '$lib/gesture';
  import { getInstrument } from '$lib/Store.svelte';
  import {
    ArrowLeftIcon,
    ArrowRightIcon,
    ChevronFirstIcon,
    ChevronLastIcon,
    EllipsisIcon,
    EraserIcon,
    HelpCircleIcon
  } from '@lucide/svelte';
  import { Pagination, Progress, Switch } from '@skeletonlabs/skeleton-svelte';
  import { writable } from 'svelte/store';
  import { gestures, pointer, SwipeDirection } from '$lib/utils/hammerAction';
  import { SvelteMap } from 'svelte/reactivity';


  // The view only reads state and dispatches commands; it never mutates instrument data itself.
  const { instrumentData = $bindable(), dispatch }: IDispatchingInstrumentViewProps = $props();
  const instr: Instrument | undefined = getInstrument(instrumentData);
  const seq = instr?.sequencer!;

  const buttonClassOn = 'preset-filled-primary-500';
  const buttonClassOff = 'preset-outlined-primary-500';
  const buttonClassOnOdd = 'preset-filled-tertiary-500';
  const buttonClassOffOdd = 'preset-outlined-tertiary-500';
  const buttonClassModifiedOn = 'preset-filled-secondary-500';
  const buttonClassModifiedOff = 'preset-tonal-secondary';
  const buttonClassModifiedOffErase = 'preset-gradient';
  let progress = writable(0); //derived(instr?.progress(instrumentData)!, (x:number) => Number.isNaN(x) ? 0 : x!*100)!;

  let panWillTurnOn: boolean | undefined = $state(undefined);
  let start: Cell | undefined; // where the current stroke began
  let last: Cell | undefined; // where the pointer is now
  let stride = $state(1);
  let modifiedSteps = new SvelteMap<number, number>(); // live preview of the stroke, not yet committed

  function onPointer(e: PointerEvent) {
    if (e.type === 'pointerup') {
      modifiedSteps.clear();
      panWillTurnOn = undefined;
      if (start && last) {
        const from = start;
        const { track, cells } = commitStroke({
          start,
          last,
          eraseEmpty,
          isOn: (step) => seq.getCell(instrumentData, from.track, step)
        });
        if (cells.length) dispatch({ type: 'setCells', instrumentId: instrumentData.id, track, cells });
      }
      stride = 1;
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

    start ??= cell;
    last = cell;
    panWillTurnOn ??= true;
    stride = strideOf(start, cell);
    modifiedSteps.clear();
    for (const p of previewStroke(start, cell, eraseEmpty)) {
      modifiedSteps.set(p.step + 1000 * start.track, p.offset);
    }
  }

  let page = $state(1);
  let pages = $derived(paginate(page, instr));
  let eraseEmpty = $state(false);

  $effect(() => {
    if (page - 1 >= pages.length) {
      page = pages.length;
    }
  });

  function paginate(page: number, instr: Instrument | undefined) {
    // console.log('paginate', page, instr);

    if (!instr) return [];
    const length = instr.getLength(instrumentData);
    const totalLength = length.stepsPerMeasure * length.measures;
    const stepsPerPage = 8;
    const pagesCount = Math.ceil(totalLength / stepsPerPage);
    return Array.from({ length: pagesCount }, (_, i) => ({
      page: i + 1,
      label: `Page ${i + 1}`,
      start: i * stepsPerPage,
      end: Math.min((i + 1) * stepsPerPage, totalLength)
    }));
  }

  function currentPageRange(pageIndex: number) {
    if (!instr || page > pages.length) return { start: 0, end: 0, length: 0 };

    const curPage = pages[page - 1];
    return { ...curPage, length: curPage.end - curPage.start };
  }
</script>

{#if instr}
  {@const length = instr.getLength(instrumentData)}
  {@const totalLength = length.stepsPerMeasure * length.measures}
  <!-- {@const pages = Math.ceil(totalLength / 16)} -->

  <div class="my-4 ml-6 flex flex-1">

    <Progress classes="" value={$progress} max={100} />
  </div>

  <div class="mb-2 flex flex-col touch-none " use:pointer={{ onPointer }}>
    {#each seq.tracks.reverse() as track, rindex}
      {@const trackIndex = seq.tracks.length - 1 - rindex}

      {@const currentRange = currentPageRange(page)}
      <div class="flex flex-row">
        <div class="mr-1 w-4 flex-none">{track}</div>
        <div class="flex-1 grid grid-cols-8">
        {#each currentRange, ri}
          {@const i = currentRange.start + ri}

          {@const modifiedCell = modifiedSteps.get(i + 1000 * trackIndex)}
          {@const cell = seq.getCell(instrumentData, trackIndex, i)}
          {@const odd = Math.floor(i / length.stepsPerMeasure) % 2 === 1}

          <div
            id="seq-{trackIndex}-{i}"
            aria-label="seq-{trackIndex}-{i}"
            data-x={i}
            data-y={trackIndex}
            class="flex-1 p-px flex "
          >
        <span class="flex-1 h-full pointer-events-none rounded-xs {modifiedCell === undefined
          ? cell
            ? odd
              ? buttonClassOnOdd
              : buttonClassOn
            : odd
              ? buttonClassOffOdd
              : buttonClassOff
          : modifiedCell % stride === 0
            ? buttonClassModifiedOn
            : (eraseEmpty ?buttonClassModifiedOffErase: buttonClassModifiedOff)}"></span>  
        </div>
        {/each}
      </div>
      </div>
    {/each}
  </div>
  <!-- {#if pages > 0} -->
  <div class="flex justify-between">
    <Pagination data={pages} {page} pageSize={1} onPageChange={(e) => (page = e.page)}>
      {#snippet labelEllipsis()}<EllipsisIcon class="size-4" />{/snippet}
      {#snippet labelNext()}<ArrowRightIcon class="size-4" />{/snippet}
      {#snippet labelPrevious()}<ArrowLeftIcon class="size-4" />{/snippet}
      {#snippet labelFirst()}<ChevronFirstIcon class="size-4" />{/snippet}
      {#snippet labelLast()}<ChevronLastIcon class="size-4" />{/snippet}
    </Pagination>
    <div class="flex flex-row items-center gap-2">
      {#if panWillTurnOn}
        {stride}
      {/if}
      <Switch  compact checked={eraseEmpty} onCheckedChange={() => (eraseEmpty = !eraseEmpty)}
        label="Erase empty">
        {#snippet inactiveChild()}<EraserIcon size="20" />{/snippet}
        {#snippet activeChild()}<EraserIcon size="20" />{/snippet}
      </Switch>
      <HelpCircleIcon />
    </div>
  </div>
  <!-- {/if} -->
{:else}
  <p>Instrument not found</p>
{/if}

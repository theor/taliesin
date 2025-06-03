<script lang="ts">
  import { store, Instrument, type IInstrumentViewProps } from '$lib';
  import { getInstrument } from '$lib/Store.svelte';
  import {
    ArrowLeftIcon,
    ArrowRightIcon,
    ChevronFirstIcon,
    ChevronLastIcon,
    EllipsisIcon,
    HelpCircleIcon
  } from '@lucide/svelte';
  import { Pagination, Progress } from '@skeletonlabs/skeleton-svelte';
  import { writable } from 'svelte/store';
  import { gestures, pointer, SwipeDirection } from '$lib/utils/hammerAction';

  const { index, instrumentData = $bindable() }: IInstrumentViewProps = $props();
  const instr: Instrument | undefined = getInstrument(instrumentData);
  const seq = instr?.sequencer!;

  const buttonClassOn = 'preset-filled-primary-500';
  const buttonClassOff = 'preset-outlined-primary-500';
  const buttonClassOnOdd = 'preset-filled-tertiary-500';
  const buttonClassOffOdd = 'preset-outlined-tertiary-500';
  let progress = writable(0); //derived(instr?.progress(instrumentData)!, (x:number) => Number.isNaN(x) ? 0 : x!*100)!;

  $effect(() => {
    // console.log('SEQ instrumentData', instrumentData);
    // if (instr) {
    // 	instrumentData.notes = instr.getNotes(instrumentData);
    // }
  });

  let panWillTurnOn: boolean | undefined = $state(undefined);
  let lastCell = [-1, -1];
  let startX = [-1, -1];
  let stride = $state(1);
  function onPointer(e: PointerEvent) {
    // console.log(e);
    e.preventDefault();
    if (e.type === 'pointerup') {
      console.log('pointerup reset turn on');

      panWillTurnOn = undefined;
      stride =1;
      lastCell = [-1, -1];
      startX = [-1, -1];
      return;
    }
    const elt = document.elementFromPoint(e.x, e.y);
    if (!elt || !elt.hasAttribute('data-x')) return;
    const [x, y] = [Number(elt.getAttribute('data-x')), Number(elt.getAttribute('data-y'))];
    
    stride = 1 + Math.abs(y -  startX[1]);
    if (x === lastCell[0]) {
      // console.log('same cell', x, y, elt);
      return;
    }
    if (startX[0] === -1) {
      startX = [x, y];
    }
    lastCell[0] = x;
    // console.log('e.pointer', e.type, x,y,elt);
    console.log(e.type, x, y);

    if (isNaN(x) || isNaN(y)) {
      return;
    }

    if (panWillTurnOn === undefined) {
      // console.log('panWillTurnOn', e.type, elt);
      panWillTurnOn = true; // !seq.getCell(instrumentData, x, y);
    }
    console.log('panWillTurnOn', panWillTurnOn, e.type, elt);
    let anyChanged = false;
    for (let index = startX[0]; index <= x; index++) {
      console.log(index, startX[1], (index - startX[0]) % stride === 0);
      let thisChanged = seq.setCell(
        instrumentData,
        startX[1],
        index,
        (index - startX[0]) % stride === 0
      );
      if (thisChanged) {
        anyChanged = true;
      }
    }
    // if(seq.setCell(instrumentData, y, x, panWillTurnOn))
    // if(anyChanged)
    store.setInstrument(index, instrumentData);
  }
  let panStride = $state<number | undefined>(undefined);

  let page = $state(1);
  let pages = $derived(paginate(page, instr));

  $effect(() => {
    if (page - 1 >= pages.length) {
      page = pages.length;
    }
  });

  function paginate(page: number, instr: Instrument | undefined) {
    console.log('paginate', page, instr);

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

  <div class="mb-2 flex flex-col gap-1" use:pointer={{ onPointer }}>
    {#each seq.tracks.reverse() as track, rindex}
      {@const index = seq.tracks.length - 1 - rindex}

      {@const currentRange = currentPageRange(page)}
      <div class="flex flex-row gap-1">
        <div class="mr-1 w-4 flex-none">{track}</div>
        {#each currentRange, ri}
          {@const i = currentRange.start + ri}

          {@const cell = seq.getCell(instrumentData, index, i)}
          {@const odd = Math.floor(i / length.stepsPerMeasure) % 2 === 1}
          <button
            id="seq-{index}-{i}"
            aria-label="seq-{index}-{i}"
            data-x={i}
            data-y={index}
            class="flex-1 {cell
              ? odd
                ? buttonClassOnOdd
                : buttonClassOn
              : odd
                ? buttonClassOffOdd
                : buttonClassOff}"
          ></button>
        {/each}
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
      <HelpCircleIcon />
    </div>
  </div>
  <!-- {/if} -->
{:else}
  <p>Instrument not found</p>
{/if}

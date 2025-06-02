<script lang="ts">
  import { store, Instrument, type IInstrumentViewProps } from '$lib';
  import { getInstrument } from '$lib/Store.svelte';
  import {
    ArrowLeftIcon,
    ArrowRightIcon,
    ChevronFirstIcon,
    ChevronLastIcon,
    EllipsisIcon
  } from '@lucide/svelte';
  import { Pagination, Progress } from '@skeletonlabs/skeleton-svelte';
  import { writable } from 'svelte/store';

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

  function toggleCell(track: number, i: number): any {
    seq.setCell(instrumentData, track, i, !seq.getCell(instrumentData, track, i));
    store.setInstrument(index, instrumentData);
  }

  let page = $state(1);
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
  $effect(() => {
    if (page - 1 >= pages.length) {
      page = pages.length;
    }
  });
  let pages = $derived(paginate(page, instr));
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

  <div class="mb-2 flex flex-col gap-1">
    {#each seq.tracks as track, index}
      {@const currentRange = currentPageRange(page)}
      <div class="flex flex-row gap-1">
        <div class="mr-1 w-4 flex-none">{track}</div>
        {#each currentRange, ri}
          {@const i = currentRange.start + ri}

          {@const cell = seq.getCell(instrumentData, index, i)}
          {@const odd = Math.floor(i / length.stepsPerMeasure) % 2 === 1}
          <button
            aria-label="seq-{index}-{i}"
            onclick={() => toggleCell(index, i)}
            class="btn flex-1 {cell
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
  </div>
  <!-- {/if} -->
{:else}
  <p>Instrument not found</p>
{/if}

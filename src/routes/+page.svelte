<script lang="ts">
  import { AppBar } from '@skeletonlabs/skeleton-svelte';
  import Menu from '@lucide/svelte/icons/menu';

  import {
    strudel,
    store,
    type InstrumentData,
    hasPart,
    getPart,
    type PartOctave,
    type InstrumentPart,
    type IPartViewProps,
    type PartTrackNotes,
    type MonoSequence,
    type PartSteps
  } from '$lib';
  import '../main.scss';
  import Network from '../components/Network.svelte';
  import Transport from '../components/Transport.svelte';
  import PianoScaleView from '../instruments/PianoScaleView.svelte';
  import { X, Dices } from '@lucide/svelte';
  import { setGlobalContext } from '$lib/context';
  import { type Component } from 'svelte';
  import PartOctaveView from '../components/PartOctaveView.svelte';

  const params = new URLSearchParams(window.location.search);
  const isHost = params.getAll('join').length == 0;
  const isDebug = params.getAll('debug').length > 0;
  setGlobalContext({
    host: isHost,
    debug: isDebug,
    scaleKey: "A",
    scaleMode: "minor",
  });
  store.init(isHost);

  function onKeyDown(event: KeyboardEvent) {
    console.log(event, event.code);

    switch (event.code) {
      case 'Backquote':
        drawerState = !drawerState;
        break;
      case 'Space':
        strudel.toggle();
        break;
      case 'Escape':
        strudel.stop();
        break;
      case 'KeyA':
        store.preset();
        break;
      default:
        break;
    }
  }
  let title = 'Taliesin';

  const instrumentsData = store.instrumentsData;
  // console.log($instrumentsData.instrumentsData);
  let code = $state(store.code());
  // let group = $state('0');
  let selectedIndex = $state(0);
  let currentInstrument = $derived(instrumentsData.instrumentsData[selectedIndex]);
  $effect(() => {
    // console.log('store changed', $state.snapshot(instrumentsData.instrumentsData), instrumentsData.instrumentsData[0]);
    code = store.code();
    if(isHost)
        strudel.evaluate(code);
    if (selectedIndex >= instrumentsData.instrumentsData.length) {
      selectedIndex = instrumentsData.instrumentsData.length - 1;
    }
   
  });

  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import AppMenu from '../components/AppMenu.svelte';
    import InstrumentView from '../components/InstrumentView.svelte';
	import { mixerIndex } from '$lib/Store.svelte';
	import Mixer from '../components/Mixer.svelte';

  let drawerState = $state(false);

  function drawerClose() {
    drawerState = false;
  }
</script>

<div class="flex h-screen flex-col">
  <AppBar headlineClasses="sm:hidden" centerClasses="hidden sm:block" toolbarClasses="">
    {#snippet lead()}
      <!-- <ArrowLeft size={24} /> -->
      <Network />
    {/snippet}
    {#snippet trail()}
      <div class="hidden space-x-4 sm:flex">
        <Transport />
      </div>
      <div class="block md:hidden">
        <Modal
          open={drawerState}
          onOpenChange={(e) => (drawerState = e.open)}
          triggerBase="btn preset-tonal"
          contentBase="card border-surface-100-900 border-[1px] space-y-4 shadow-xl  h-screen"
          positionerJustify="justify-start"
          positionerAlign=""
          positionerPadding=""
          closeOnInteractOutside={true}
          transitionsPositionerIn={{ x: -480, duration: 200 }}
          transitionsPositionerOut={{ x: -480, duration: 200 }}
        >
          {#snippet trigger()}<Menu size={20} />{/snippet}
          {#snippet content()}
            <AppMenu {drawerClose} bind:selectedIndex />
          {/snippet}
        </Modal>
      </div>
    {/snippet}
    <span>{title}</span>
  </AppBar>

  <div class="flex h-full flex-row">
    <div class="card border-surface-100-900 hidden flex-col border-[1px] md:flex">
      <AppMenu bind:selectedIndex />
    </div>

    <div class="flex-1 gap-4 p-4">
      {#if isDebug}
        <div
          class="card preset-outlined-surface-200-800 bg-surface-50-950 hidden space-y-5 p-5 lg:flex"
        >
          Code
          <button class="btn preset-filled ml-4" onclick={() => store.clearCommands()}>Clear</button
          >
          <pre>
{code}
            </pre>
            <pre>{store.serialized()}</pre>
        </div>
      {/if}
      
	  {#if selectedIndex === mixerIndex}
	  <Mixer />
	  {:else if currentInstrument}
      <InstrumentView bind:instrumentData={currentInstrument} index={selectedIndex} />
        <!-- {@render instrumentCard(currentInstrument, selectedIndex)} -->
      {/if}

      <!-- {#each instrumentsData.instrumentsData as instrumentData, index}
			{@render instrumentCard(instrumentData, index)}
		{/each} -->
      <!-- <Tabs value={group} onValueChange={(e) => (group = e.value)}>
			{#snippet list()}
				{#each instrumentsData.instrumentsData as instrumentData, index}
					<Tabs.Control value={index.toString()}>{instrumentData.instrumentName}</Tabs.Control>
				{/each}
			{/snippet}
			{#snippet content()}
				{#each instrumentsData.instrumentsData as instrumentData, index}
					<Tabs.Panel value={index.toString()}>
						{@render instrumentCard(instrumentData, index)}
					</Tabs.Panel>
				{/each}
			{/snippet}
		</Tabs> -->
    </div>
  </div>
  <!-- <footer class=" h-10% p-4">(footer)</footer> -->
</div>

<svelte:window on:keydown={onKeyDown} />

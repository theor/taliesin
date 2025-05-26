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
    debug: isDebug
  });
  store.init(isHost);

  function onKeyDown(event: KeyboardEvent) {
    // console.log(event.key, event.code);

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
    if (selectedIndex < 0) {
      selectedIndex = 0;
    }
  });

  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import AppMenu from '../components/AppMenu.svelte';
  import PartStepsView from '../components/PartStepsView.svelte';
  import { getInstrumentIcon } from '$lib/Store.svelte';
    import { Pane, ThemeUtils } from 'svelte-tweakpane-ui';

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
        </div>
      {/if}
      {#snippet instrumentCard(instrumentData: InstrumentData, index: number)}
          {@const Icon = getInstrumentIcon(instrumentData.instrumentName)}
          <div class="card preset-outlined-surface-200-800 bg-surface-50-950 space-y-1 p-2">
            <header
              class="card-header instrument-header flex flex-row justify-between portrait:flex-col"
            >
              <span class="border-secondary-500 mb-2 flex gap-2 border-b-2"
                ><Icon size="24" /> {instrumentData.instrumentName}</span
              >
              <div class="flex portrait:flex-col gap-2">
                {#snippet btnSnippet(icon: Component, onclick: () => void)}
                  {@const IconComp = icon}
                  <button class="btn preset-filled px-2 py-1" {onclick}
                    ><IconComp size={16} /></button
                  >
                {/snippet}
                {#snippet renderOptionalPart<TPart extends InstrumentPart>(
                  partName: TPart['type'],
                  component: Component<IPartViewProps<TPart>>
                )}
                  {#each instrumentData.parts as part, partIndex}
                    {#if part.type === partName}
                      {@const ViewComp = component}
                      <Pane position="inline" title={part.type} theme={ThemeUtils.presets.light} >
                      <ViewComp
                        bind:part={instrumentData.parts[partIndex] as TPart}
                        {btnSnippet}
                        onPartChanged={(e) => {
                            store.setInstrumentPart(selectedIndex, partIndex, part);
                        }}
                      />
                    </Pane>
                    {/if}
                  {/each}
                  <!-- {@const part = getPart(partName, instrumentData)}
                  {@const ViewComp = component}
                  {#if part}
                    <ViewComp {part} {btnSnippet} />
                  {/if} -->
                {/snippet}

                {@render renderOptionalPart<PartOctave>('octave', PartOctaveView)}
                {@render renderOptionalPart<PartSteps>('steps', PartStepsView)}
                <button
                  class="btn preset-filled mr-4 px-2 py-1"
                  onclick={() => store.randomize(index)}><Dices size={16} /></button
                >

                <button
                  class="btn btn-xs preset-outlined-error-500 rounded-lg px-2 py-1"
                  onclick={() => store.removeInstrument(index)}><X size="16" /></button
                >
              </div>
            </header>
                    {#key instrumentData}


            <PianoScaleView {instrumentData} {index} />
            {/key}
          </div>
      {/snippet}
      {#if currentInstrument}
        {@render instrumentCard(currentInstrument, selectedIndex)}
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

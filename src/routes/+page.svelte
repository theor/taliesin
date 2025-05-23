<script lang="ts">
	import { AppBar, Tabs } from '@skeletonlabs/skeleton-svelte';
	import Menu from '@lucide/svelte/icons/menu';

	import { strudel, store, type InstrumentData, getInstrument, hasPart, getPart, type PartOctave } from '$lib';
	import '../main.scss';
	import Network from '../components/Network.svelte';
	import Transport from '../components/Transport.svelte';
	import PianoScaleView from '../instruments/PianoScaleView.svelte';
	import { X, Dices, ChevronUp,ChevronDown } from '@lucide/svelte';
	import { setGlobalContext } from '$lib/context';
	import { type Component } from 'svelte';

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

		if (event.code === 'Space') {
			// console.log(strudel.isPlaying)
			// if (strudel.isPlaying) strudel.stop();
			// else
			strudel.evaluate(code);
		}
		if (event.code === 'Escape') {
			strudel.stop();
		}
		if (event.code === 'KeyA') {
			store.preset();
		}
	}
	let title = 'Rave';

	const instrumentsData = store.instrumentsData;
	// console.log($instrumentsData.instrumentsData);
	let code = $state(store.code());
	let group = $state('0');
	$effect(() => {
		// console.log('store changed', $state.snapshot(instrumentsData.instrumentsData), instrumentsData.instrumentsData[0]);
		code = store.code();
		strudel.evaluate(code);
	});

	$inspect(store);

	// $effect(() => {
	// 	const commandsSnapshot = $state.snapshot($commands.commands);
	// 	console.log('commands changed', commands);
	// 	commandsSnapshot.forEach((command) => {
	// 		if (command.name === 'setData') {
	// 			console.warn('cmd', $state.snapshot(command.value));
	// 			store.setInstrumentPartial(command.index, command.value);
	// 		}
	// 	});
	// 	store.clearCommands();
	// });
</script>

<div class="flex h-screen flex-col">
	<AppBar headlineClasses="sm:hidden" centerClasses="hidden sm:block">
		{#snippet lead()}
			<!-- <ArrowLeft size={24} /> -->
			<Network />
		{/snippet}
		{#snippet trail()}
			<div class="hidden space-x-4 sm:flex">
				<Transport />
			</div>
			<div class="block sm:hidden">
				<Menu size={20} />
			</div>
		{/snippet}
		{#snippet headline()}
			<h2 class="h2">{title}</h2>
		{/snippet}
		<span>{title}</span>
	</AppBar>

	<div class="col-span-2 grid flex-1 gap-4 p-4">
		{#if isDebug}
			<div
				class="card preset-outlined-surface-200-800 bg-surface-50-950 hidden space-y-5 p-5 lg:flex"
			>
				Code
				<button class="btn preset-filled ml-4" onclick={() => store.clearCommands()}>Clear</button>
				<pre>
{code}
            </pre>
			</div>
		{/if}
		{#snippet instrumentCard(instrumentData: InstrumentData, index: number)}
			{#key instrumentData}
			{@const instrument = getInstrument(instrumentData)}
			{@const octave = getPart<PartOctave>('octave',instrumentData)}
			<div class="card preset-outlined-surface-200-800 bg-surface-50-950 space-y-1 p-2">
					<header class="card-header flex justify-between">
						<span>{index} {instrumentData.instrumentName}</span>
						<div>
							{#snippet btn(icon: Component, onclick: () => void)}
							{@const IconComp = icon}
							<button
							class="btn preset-filled px-2 py-1"
							onclick={onclick}><IconComp size={16}/></button>
								
							{/snippet}

							{#if (octave)}
							<span>octave {octave.octave}</span>
							{@render btn(ChevronUp, () => (octave.octave)++)}
							{@render btn(ChevronDown, () => (octave.octave)--)}
							
							{/if}
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
					<PianoScaleView {instrumentData} {index} />
				</div>
			{/key}
		{/snippet}
		<!-- {#each instrumentsData.instrumentsData as instrumentData, index}
			{@render instrumentCard(instrumentData, index)}
		{/each} -->
		<Tabs value={group} onValueChange={(e) => (group = e.value)}>
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
		</Tabs>
	</div>
	<!-- <footer class=" h-10% p-4">(footer)</footer> -->
</div>

<svelte:window on:keydown={onKeyDown} />

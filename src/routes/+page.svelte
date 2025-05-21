<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import Menu from '@lucide/svelte/icons/menu';

	import { strudel, store, type IInstrumentData } from '$lib';
	import '../main.scss';
	import Network from '../components/Network.svelte';
	import Transport from '../components/Transport.svelte';
	import PianoScaleView from '../instruments/PianoScaleView.svelte';
import {X, Dices} from '@lucide/svelte';
	import { setGlobalContext } from '$lib/context';

	const params = new URLSearchParams(window.location.search);
	const isHost = params.getAll("join").length == 0;
	const isDebug = params.getAll("debug").length > 0;
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
		if(event.code === 'KeyA')
		{
			store.preset();
		}
	}
	let title = 'Rave';

	const instrumentsData = store.instrumentsData;
	// console.log($instrumentsData.instrumentsData);
	let code = $state(store.code());
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

<div class="h-screen flex flex-col">
	<AppBar headlineClasses="sm:hidden" centerClasses="hidden sm:block">
		{#snippet lead()}
			<!-- <ArrowLeft size={24} /> -->
			<Network  />
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

	<div class="flex-1 grid col-span-2 gap-4 p-4 ">
		{#if isDebug}
		<div class="hidden lg:flex card preset-outlined-surface-200-800 bg-surface-50-950 space-y-5 p-5">
			Code
			<button class="btn preset-filled ml-4" onclick={() => store.clearCommands()}>Clear</button>
			<pre>
{code}
            </pre>
		</div>
		{/if}
		{#each instrumentsData.instrumentsData as instrumentData, index}
			{#key instrumentData}
				<div class="card preset-outlined-surface-200-800 bg-surface-50-950 space-y-1 p-2">
					<header class="card-header flex justify-between">
						<span>{index} {instrumentData.instrumentName}</span>
						<div>
						<button class="btn preset-filled py-1 px-2 mr-4" onclick={store.randomize(index)}><Dices size={16}/></button>

						<button class="btn btn-xs rounded-lg preset-outlined-error-500 py-1 px-2" onclick={() => store.removeInstrument(index)}><X size="16"/></button>
					</div>
				</header>
					<PianoScaleView {instrumentData} {index} />
				</div>
			{/key}
		{/each}
	</div>
	<!-- <footer class=" h-10% p-4">(footer)</footer> -->
</div>

<!-- <main class="container">
	<header>
		<Network network={network} />
	</header>
	<h1>Welcome to SvelteKit</h1>
	<p>
		Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation
	</p>
</main> -->

<svelte:window on:keydown={onKeyDown} />

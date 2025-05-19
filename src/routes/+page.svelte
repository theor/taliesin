<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import Menu from '@lucide/svelte/icons/menu';

	import { strudel, store, type IInstrumentData } from '$lib';
	import '../main.scss';
	import Network from '../components/Network.svelte';
	import Transport from '../components/Transport.svelte';
	import PianoScaleView from '../instruments/PianoScaleView.svelte';

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
	}
	let title = 'Rave';

	console.log($state.snapshot(store.instrumentsData));
	let code = $state(store.code());
	$effect(() => {
		console.log('store changed', $state.snapshot(store.instrumentsData), store.instrumentsData[0]);
		code = store.code();
	});

	$inspect(store);

	const commands = store.commands;

	$effect(() => {
		const commandsSnapshot = $state.snapshot($commands.commands);
		console.log('commands changed', commands);
		commandsSnapshot.forEach((command) => {
			if (command.name === 'setData') {
				console.warn('cmd', $state.snapshot(command.value));
				store.setInstrumentPartial(command.index, command.value);
			}
		});
		store.clearCommands();
	});
</script>

<div class="grid h-screen grid-rows-[auto_1fr_auto]">
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

	<div class="h-100% grid grid-cols-2 gap-4 p-4">
		<div class="card preset-outlined-surface-200-800 bg-surface-50-950 space-y-5 p-5">
			Code
			<button class="btn preset-filled ml-4" onclick={() => store.clearCommands()}>Clear</button>
			<pre>
{JSON.stringify($commands.commands, null, 2)}
			</pre>
			<pre>
{code}
            </pre>
		</div>
		{#each store.instrumentsData as instrumentData, index}
			{#key instrumentData}
				<div class="card preset-outlined-surface-200-800 bg-surface-50-950 space-y-5 p-5">
					<p>i {index}</p>
					<PianoScaleView {instrumentData} {index} />
				</div>
			{/key}
		{/each}
	</div>
	<footer class=" h-10% p-4">(footer)</footer>
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

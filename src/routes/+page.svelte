<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import Menu from '@lucide/svelte/icons/menu';

	import { network, strudel, store, type IInstrumentData } from '$lib';
	import '../main.scss';
	import Network from '../components/Network.svelte';
	import Transport from '../components/Transport.svelte';
	console.log(network.id + ' ' + network.status);

	function onKeyDown(event: KeyboardEvent) {
		// console.log(event.key, event.code);

		if (event.code === 'Space') {
			strudel.toggle();
		}
		if (event.code === 'Escape') {
			strudel.stop();
		}
	}
	let title = 'Rave';

    $effect(() => {
        console.log('store changed', $state.snapshot(store.value));
    });

	let s = store.value;
	$inspect(s);

	function onChange(i: number, instrumentData: IInstrumentData) {
		console.log('onChange', i, instrumentData);
		store.setInstrument(i, instrumentData);
	}
</script>

<div class="h-screen grid grid-rows-[auto_1fr_auto]">
	<AppBar headlineClasses="sm:hidden" centerClasses="hidden sm:block">
		{#snippet lead()}
			<!-- <ArrowLeft size={24} /> -->
			<Network {network} />
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

	<div class="h-100% p-4">
		{#each s.instrumentViews as instrumentView, index}
			<p>i {index}</p>
            {@const Component   = instrumentView.component}
			<Component
				instrumentData={instrumentView.instrument.data}
				onChange={(d) => onChange(index, d)}
			/>
		{/each}
	</div>
	<footer class=" p-4 h-10%">(footer)</footer>
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

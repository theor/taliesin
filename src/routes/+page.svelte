<script lang="ts">
	import { network } from '$lib';
	import '../main.scss';
	import Network from '../components/Network.svelte';
	import Transport from '../components/Transport.svelte';
	console.log(network.id + ' ' + network.status);
</script>

<div class="h-screen grid grid-rows-[auto_1fr_auto]">
	<!-- Header -->
	<header class="flex items-center gap-8 p-4">
		<Network {network} />
        <Transport />
	</header>
	<!-- Main -->
	<main class=" p-4 space-y-4">
		<p class="h-[512px] p-4">Paragraph 1</p>
		<p class="h-[512px] p-4">Paragraph 2</p>
		<p class="h-[512px] p-4">Paragraph 3</p>
	</main>
	<!-- Footer -->
	<footer class=" p-4">(footer)</footer>
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

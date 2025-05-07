<script lang="ts">
	import { network } from '$lib';
	import '../main.scss';
	import Network from '../components/Network.svelte';
	console.log(network.id + ' ' + network.status);
</script>

<main class="container">
	<header>
		<Network />
	</header>
	<h1>Welcome to SvelteKit</h1>
	<p>
		Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation
	</p>
</main>
